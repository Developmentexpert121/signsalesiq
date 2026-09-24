import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";

// The rate limiter used in auth.routes.ts (reproduced here to test the policy)
function makeAuthLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "127.0.0.1")}:${((req.body?.email as string) ?? "").toLowerCase()}`,
    standardHeaders: true,
    legacyHeaders: false,
    // Use memory store (default) — fine for unit tests
    skip: () => false,
  });
}

function makeTestApp() {
  const app = express();
  app.use(express.json());
  app.use(makeAuthLimiter());
  app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("login rate limiter", () => {
  it("allows the first 10 requests per window", async () => {
    const app = makeTestApp();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "user@test.com", password: "pw" });
      expect(res.status).toBe(200);
    }
  });

  it("blocks the 11th request with 429", async () => {
    const app = makeTestApp();
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login").send({ email: "brute@test.com", password: "pw" });
    }
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "brute@test.com", password: "pw" });
    expect(res.status).toBe(429);
  });
});
