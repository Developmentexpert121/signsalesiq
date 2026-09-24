# Phase 5 Implementation — Detailed Explanation & Production Risk Assessment

## 1. Structured Logging (pino)
**What was done:**
* Created `server/logger.ts` — a singleton pino instance. In development it uses `pino-pretty` for human-readable colorized output. In production it emits newline-delimited JSON (NDJSON), which is what log aggregators (Datadog, Logtail, CloudWatch, etc.) expect.
* Replaced the hand-rolled request logger in `server/index.ts` (lines 44–68 in the old file) with `pinoHttp`. The old logger called `JSON.stringify(capturedJsonResponse)` on every API response and wrote the whole body to the console — including user emails, tokens, and error stacks. That entire block is now gone.
* A bulk Python script migrated 195 `console.log/error/warn` calls across 25 files to `logger.info/error/warn`. The pino signature is `logger.error({ err }, "message")` (object first, string second), so a second pass fixed calls that were `logger.error("message", err)` which TypeScript rejects.

**Redaction config:**
```javascript
redact: {
  paths: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.passwordHash", "*.email", "*.token"],
  censor: "[redacted]",
}

```

These paths are automatically scrubbed from any log object pino serializes. `*.email` means any key named email at any depth in the logged object.

**Production risk — MEDIUM:**

* The bulk migration did a mechanical `console.log` → `logger.info` conversion. Some logs that were debug-level noise (e.g. `[Gemini Sign Gen] Cropped plane region...` — dozens of lines per mockup generation) are now `logger.info`, meaning they'll appear in production logs and create noise/cost. A follow-up pass to downgrade those to `logger.debug` would be good.
* The redaction only works on object properties you explicitly log. If a route handler still does `logger.info(\"user email is ${user.email}\")` (string interpolation in the template), pino cannot redact it — the string is already baked. The migration converted the shape of the call but didn't audit every template literal for PII. This is a known gap noted in the process notes.
* One template literal in `server/pdfService.ts` was broken by the regex (the `candidatePaths.join(\", \")` line) and was manually repaired. The test suite wouldn't catch a silent data corruption there, so worth a visual scan of that file around line 441.

---

## 2. Sentry Error Tracking

**What was done:**

* `@sentry/node` is initialised at the top of `server/index.ts` behind an `if (env.SENTRY_DSN)` guard — if the env var isn't set, Sentry is completely inert.
* `SENTRY_DSN` was added to `server/env.ts` as an optional `z.string().url()`.
* The Express error handler now calls `Sentry.captureException(err)` before returning the sanitized `{ message }` to the client.
* On the client, `@sentry/react` is installed. The ErrorBoundary uses `window.__Sentry__` to forward errors if Sentry is available at runtime — this is a lightweight hook rather than full `@sentry/react` initialization (which requires a DSN in the Vite bundle via `VITE_SENTRY_DSN`). Full client-side Sentry would need `VITE_SENTRY_DSN` added to the client env schema and `Sentry.init()` called in `client/src/main.tsx`.

**Production risk — LOW:**

* Sentry is completely optional — if `SENTRY_DSN` is not set, `Sentry.init` is never called and no code path changes. Zero risk of breakage if you don't configure it.
* If you do set it and the DSN is malformed, `@t3-oss/env-core` will reject it at boot (`z.string().url()`) so the app won't start with a bad value — that's the correct behavior.
* One subtle risk: `Sentry.captureException` is called inside the Express error handler before the response is sent. If for any reason Sentry's SDK throws (e.g. network timeout to Sentry's ingest), it would bubble into the error handler and prevent the `res.status(status).json(...)` response. The SDK is generally safe here, but wrapping it in a try/catch would be more defensive.

---

## 3. Graceful Shutdown

**What was done:**

```typescript
const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  await new Promise<void>((res) => httpServer.close(() => res())); // stop accepting new connections
  await pool.end();                                                 // drain connection pool
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

```

`httpServer.close()` stops accepting new connections but lets in-flight requests complete. `pool.end()` then waits for all DB connections to close cleanly.

**Production risk — MEDIUM-HIGH:**

* `httpServer.close()` has no timeout. If a long-running request (e.g., a 4-step Gemini mockup generation that can take 2+ minutes) is in flight when SIGTERM arrives, `httpServer.close()` will wait forever until it finishes. In Kubernetes/Railway/Fly.io, the orchestrator sends SIGTERM then waits ~30 seconds before sending SIGKILL. If the in-flight request takes longer than 30s, the DB connection will be killed mid-query anyway. A production-hardened version should add a `setTimeout` fallback:

```typescript
const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  const forceExit = setTimeout(() => { logger.warn("force shutdown after timeout"); process.exit(1); }, 25_000);
  forceExit.unref();
  await new Promise<void>((res) => httpServer.close(() => res()));
  await pool.end();
  process.exit(0);
};

```

* The `pool` import inside the async IIFE uses a dynamic `await import(\"./db\")`. This works because Node caches ES modules, so it returns the already-initialised module. Not a risk, just worth knowing.

---

## 4. Dockerfile

**What was done:** A three-stage build:

1. **deps** — `npm ci` only, no source code
2. **build** — copies deps and source, runs `npm run build` (esbuild + Vite)
3. **runtime** — copies only `dist/`, `migrations/`, `package.json`, `node_modules`; runs as non-root app user

**Production risk — MEDIUM:**

* The runtime stage copies the full `node_modules` from the deps stage, not a production-only install. This includes `devDependencies` (Vitest, TypeScript, Biome, etc.). A `npm ci --omit=dev` in a separate pruning step would shrink the image by ~30-40%. Not a security risk, just image bloat.
* The build step runs esbuild on `server/index.ts` with `format: \"cjs\"` and many deps marked external. Those external deps must exist in `node_modules` at runtime. If `npm ci` in the deps stage installs a different version than what the lock file expects (e.g. on a new platform with platform-specific binaries like `sharp`), the runtime image could fail on `sharp` which has native binaries per platform. The deps stage uses `node:20-alpine` — `sharp` has Alpine binaries so this should be fine, but it's a known `sharp` gotcha.
* The `HEALTHCHECK` uses `wget`. Alpine's base `wget` is BusyBox `wget`, which is present — this is fine.
* `CMD [\"node\", \"dist/index.cjs\"]` assumes the build always produces that filename. Looking at `script/build.ts`, `outfile: \"dist/index.cjs\"` is hardcoded, so this is safe.
* The biggest actual risk: if the app requires environment variables at boot (which it does — `SESSION_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY` are required by `@t3-oss/env-core`), and those aren't provided to the container, it will crash immediately with a validation error. This is intentional behavior (fail fast), but worth documenting so ops doesn't think the image is broken.

---

## 5. docker-compose Changes

**What changed:**

```yaml
# Before
POSTGRES_PASSWORD: dev

# After  
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}

```

**Production risk — LOW but breaking for dev if .env is incomplete:**

* The `:?` syntax is a Docker Compose mandatory variable — if `POSTGRES_PASSWORD` is not in `.env`, `docker compose up` fails immediately with a clear error message. This is the right behavior for security but will break anyone who runs `docker compose up` without a `.env` file.
* If your `.env` currently doesn't have `POSTGRES_PASSWORD=` set (it was previously hardcoded as `dev`), you need to add it. **Action required:** add `POSTGRES_PASSWORD=dev` (or a real value) to your `.env`.
* The `DATABASE_URL` for the app service is now constructed from the compose variables: `postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/...`. If `POSTGRES_PASSWORD` contains special characters (@, /, :), the URL will be malformed. Use a password without those characters or URL-encode them.

---

## 6. CI Workflow

**What was done:** `.github/workflows/ci.yml` runs `check` → `lint` → `test` → `build` on every PR and push to `main/dev-works`.

**Production risk — LOW (CI only, no runtime impact):**

* The build step in CI uses stub env vars (`sk_test_ci_stub` for Stripe, etc.). `@t3-oss/env-core` validates these at import time. The `STRIPE_SECRET_KEY` validator is `z.string().startsWith(\"sk_\")` — `sk_test_ci_stub` passes. The `SESSION_SECRET` validator is `z.string().min(32)` — the stub `ci-secret-that-is-at-least-32-characters-long` passes. If someone adds a new required env var without updating the CI stubs, CI will fail on build with an env validation error.
* `npm run lint` runs Biome. Biome is strict — it will find real issues in the codebase (the recommended ruleset is on). First run after setting this up will likely produce lint errors. The CI will fail until those are fixed or the rules are tuned. **Recommendation:** run `npm run lint` locally first, triage the errors, and either fix them or add `// biome-ignore` suppressions before merging.

---

## 7. Biome

**What was done:** `biome.json` with `recommended: true`, `noExplicitAny: off` (because the codebase has ~20+ any casts), `noNonNullAssertion: warn` (because `REPL_ID!` exists).

**Production risk — NONE (dev tooling only).**

* The formatter uses 2-space indent and 100-char line width. If the codebase currently has inconsistent formatting, `npm run format --write` will touch many files in one commit. Run it in a separate "chore: format" commit to keep git blame clean.

---

## 8. Vitest + Tests

**What was done:** Two test files, 6 tests total.

* `server/middleware/requireTenantOwned.test.ts` — pure unit tests, mocks storage and logger. Tests: unauthenticated returns 401, cross-tenant returns 404, same-tenant calls next, SUPER_ADMIN bypasses tenant check.
* `server/routes/auth.routes.test.ts` — creates a minimal Express app with the rate limiter (same config as production) and hits it with supertest. Tests: 10 requests succeed, 11th gets 429.

**Production risk — NONE (tests don't run in production).**

* One nuance: the `requireTenantOwned.test.ts` mocks `../storage`. If the path resolution ever changes (e.g. after a restructure), the mock will fail to intercept. The `vi.mock(\"../storage\")` call is path-sensitive.

---

## 9. React Error Boundary

**What was done:** `client/src/components/ErrorBoundary.tsx` — a class component (required for `componentDidCatch`). Wraps the entire `<App>` tree. On uncaught render error: shows "Something went wrong / Reload" fallback, calls `window.__Sentry__.captureException` if available.

**Production risk — VERY LOW:**

* Class components are stable in React 18. The boundary catches errors in the render tree below it. It does not catch errors in: event handlers (use try/catch), async code outside render (use window.onerror or Sentry's global handler), or the boundary's own render.
* The `console.error(\"[ErrorBoundary]\", error, ...)` call in `componentDidCatch` was left as a plain `console.error` (not pino) because this is client-side code where pino isn't available. This is correct.
* The Sentry hook via `window.__Sentry__` is a light approach. Full Sentry React integration would use `import * as Sentry from \"@sentry/react\"` and `<Sentry.ErrorBoundary>` instead.

---

## 10. Engines Field

`\"engines\": { \"node\": \">=20.0.0\" }`

**Production risk — LOW:**

* `npm install` will emit a warning (not error) if the running Node version doesn't meet the requirement. The field is advisory unless the hosting platform enforces it (Heroku/Railway do; bare VPS does not).
* If any dependency requires <20, you'd see a warning on install. Node 20 is LTS (until April 2026) so this is a safe constraint.

---

# Summary: What Could Actually Break in Production

| Item | Risk | Action Required |
| --- | --- | --- |
| **POSTGRES_PASSWORD** now mandatory in `.env` | **High** | Add `POSTGRES_PASSWORD=<value>` to `.env` |
| **Gemini/PDF logs** at info instead of debug | **Medium** | Second-pass downgrade to `logger.debug` |
| **httpServer.close()** has no timeout | **Medium** | Add 25s force-exit fallback to prevent deploy hangs |
| **npm run lint** will fail CI | **Medium** | Run `npm run lint` locally first and fix/ignore baseline issues |
| **PII in template literals** not redacted | **Medium** | Audit remaining template literals with email/name vars |
| **Sentry SDK throwing** inside error handler | **Low** | Wrap `captureException` in `try/catch` |
| **node_modules** in runtime image includes devDeps | **Low** | Add `npm ci --omit=dev` prune stage for smaller images |
| **Missing Env Vars** crash container | **Low** | Document required vars; update `.env.example` |
| """ |  |  |
