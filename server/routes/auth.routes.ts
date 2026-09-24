import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import memoize from "memoizee";
import * as oidcClient from "openid-client";
import { Strategy as OidcStrategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import { sendPasswordResetEmail } from "../emailService";
import { env } from "../env";
import { logger } from "../logger";
import { requireAuth } from "../middleware/requireAuth";
import { authStorage } from "../replit_integrations/auth";
import { storage } from "../storage";

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? "")}:${((req.body?.email as string) ?? "").toLowerCase()}`,
  standardHeaders: true,
  legacyHeaders: false,
});

const AUTO_PROVISION_ACCOUNTS: Record<
  string,
  { role: "SUPER_ADMIN" | "ADMIN" | "SALES"; name: string }
> = {
  "smehta@fastsigns.com": { role: "ADMIN", name: "Smehta" },
  "developmentexpert121@gmail.com": { role: "ADMIN", name: "Development Expert" },
  "vjkalwani@yahoo.com": { role: "ADMIN", name: "VJ Kalwani" },
};

const getOidcConfig = memoize(
  async () => {
    const replId = env.REPL_ID;
    if (!replId) {
      throw new Error("REPL_ID is required for OIDC discovery");
    }
    return await oidcClient.discovery(new URL(env.ISSUER_URL ?? "https://replit.com/oidc"), replId);
  },
  { maxAge: 3600 * 1000 }
);

const registeredStrategies = new Set<string>();

async function ensureOidcStrategy(domain: string) {
  const strategyName = `replitauth:${domain}`;
  if (!registeredStrategies.has(strategyName)) {
    const config = await getOidcConfig();
    const verify: VerifyFunction = async (tokens, verified) => {
      const claims = tokens.claims();
      if (!claims) return verified(new Error("No claims in token"));
      const oidcUser = { claims, access_token: tokens.access_token };
      await authStorage.upsertUser({
        id: claims.sub as string,
        email: ((claims as any).email as string) || null,
        firstName: (claims as any).first_name || null,
        lastName: (claims as any).last_name || null,
        profileImageUrl: (claims as any).profile_image_url || null,
      });
      verified(null, oidcUser);
    };
    const strategy = new OidcStrategy(
      {
        name: strategyName,
        config,
        scope: "openid email profile",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
    registeredStrategies.add(strategyName);
  }
  return strategyName;
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const normalizedEmail = email.trim().toLowerCase();
    let user = await storage.getUserByEmail(normalizedEmail);

    if (!user) {
      const provision = AUTO_PROVISION_ACCOUNTS[normalizedEmail];
      if (!provision) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      user = await storage.createUser({
        name: provision.name,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: provision.role,
      });
    } else {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.tenantId && user.role !== "SUPER_ADMIN") {
      const tenant = await storage.getTenant(user.tenantId);
      if (tenant && !tenant.active) {
        return res.status(403).json({
          message:
            "Your organization account has been deactivated. Please contact your administrator.",
        });
      }
    }

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.userId = user.id;
    storage.updateUser(user.id, { lastLoginAt: new Date() }).catch(() => {});
    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  // SignSuiteIQ SSO callback — GET /sso/callback?code=<one-time-code>
  app.get("/sso/callback", async (req: Request, res: Response) => {
    const ssoErrorPage = (message: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign In Error — SignSalesIQ</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d2137;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:16px;padding:40px 36px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3)}
    .icon{width:56px;height:56px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .icon svg{width:28px;height:28px;color:#dc2626}
    h1{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
    p{font-size:14px;color:#6b7280;line-height:1.6;margin-bottom:24px}
    a{display:inline-block;padding:10px 24px;background:#1e3a5f;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
    a:hover{background:#122b4a}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color:#dc2626"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
    </div>
    <h1>Sign-in Failed</h1>
    <p>${message}</p>
    <a href="/">Back to Login</a>
  </div>
</body>
</html>`;

    const code = (req.query.code as string | undefined)?.trim();
    if (!code) {
      return res
        .status(400)
        .send(
          ssoErrorPage(
            "No authentication code was provided. Please try signing in again from SignSuiteIQ."
          )
        );
    }

    const ssoSecret = env.SIGNSUITEIQ_SSO_SECRET;
    if (!ssoSecret) {
      logger.error("[SSO] SIGNSUITEIQ_SSO_SECRET is not configured");
      return res
        .status(500)
        .send(
          ssoErrorPage("SSO is not configured on this server. Please contact your administrator.")
        );
    }

    let ssoUser: {
      id: number;
      name: string;
      username: string;
      email: string;
      phone?: string | null;
      role: string;
      companyId?: number | null;
    };
    try {
      const exchangeRes = await fetch("https://www.signsuiteiq.ai/api/sso/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, clientId: "signsalesiq", clientSecret: ssoSecret }),
      });

      if (!exchangeRes.ok) {
        let errMsg = `SSO exchange failed (HTTP ${exchangeRes.status}).`;
        try {
          const errBody = (await exchangeRes.json()) as any;
          if (errBody?.message) errMsg = errBody.message;
        } catch {}
        logger.error(`[SSO] Exchange error: ${errMsg}`);
        return res.status(502).send(ssoErrorPage(`Sign-in failed: ${errMsg}`));
      }

      const body = (await exchangeRes.json()) as {
        appKey: string;
        user: typeof ssoUser;
        widgetToken?: string;
        widgetTokenExpiresIn?: number; // seconds
      };
      ssoUser = body.user;

      // Stash the app-switcher widget token in the session for the frontend.
      // Always clear any prior token first so a stale token from an earlier
      // SSO login can never leak into a new session/account on this browser.
      req.session.widgetToken = undefined;
      req.session.widgetTokenExpiresAt = undefined;
      if (typeof body.widgetToken === "string" && body.widgetToken.length > 0) {
        req.session.widgetToken = body.widgetToken;
        const ttlSec =
          typeof body.widgetTokenExpiresIn === "number" && body.widgetTokenExpiresIn > 0
            ? body.widgetTokenExpiresIn
            : 86400;
        req.session.widgetTokenExpiresAt = Date.now() + ttlSec * 1000;
      }
    } catch (err) {
      logger.error({ err: err }, "[SSO] Network error during exchange:");
      return res
        .status(502)
        .send(
          ssoErrorPage("Could not reach the SignSuiteIQ authentication service. Please try again.")
        );
    }

    // Map the SignSuiteIQ role and resolve the tenant from the company id so
    // lazily-created SSO users land in the right company with the right role
    // (mirrors /api/internal/provision-user). The exchange does not return a
    // tenant name/slug, so we can only attach to a tenant that already exists;
    // the regular provision sync will create+link it otherwise.
    const ssoRole = mapRole(ssoUser.role);
    let resolvedTenantId: string | undefined;
    if (typeof ssoUser.companyId === "number" && ssoUser.companyId > 0) {
      const tenant = await storage.getTenantBySignSuiteIQCompanyId(ssoUser.companyId);
      if (tenant) resolvedTenantId = tenant.id;
    }

    let localUser = await storage.getUserBySignSuiteIQId(ssoUser.id);

    if (!localUser && ssoUser.email) {
      localUser = await storage.getUserByEmail(ssoUser.email);
      if (localUser) {
        await storage.updateUser(localUser.id, { signsuiteiqUserId: ssoUser.id });
        localUser = { ...localUser, signsuiteiqUserId: ssoUser.id };
      }
    }

    if (!localUser) {
      const unusableHash = `!sso_only:${crypto.randomBytes(32).toString("hex")}`;
      localUser = await storage.createUser({
        name: ssoUser.name || ssoUser.username || ssoUser.email,
        email: ssoUser.email.trim().toLowerCase(),
        passwordHash: unusableHash,
        role: ssoRole,
        signsuiteiqUserId: ssoUser.id,
        tenantId: resolvedTenantId,
      });
    } else {
      // Keep role/tenant in sync with SignSuiteIQ on every SSO login.
      const syncUpdates: Record<string, unknown> = {};
      if (localUser.role !== "SUPER_ADMIN" && localUser.role !== ssoRole) {
        syncUpdates.role = ssoRole;
      }
      if (resolvedTenantId && localUser.tenantId !== resolvedTenantId) {
        syncUpdates.tenantId = resolvedTenantId;
      }
      if (Object.keys(syncUpdates).length > 0) {
        await storage.updateUser(localUser.id, syncUpdates as any);
        localUser = { ...localUser, ...syncUpdates };
      }
    }

    req.session.userId = localUser.id;
    storage.updateUser(localUser.id, { lastLoginAt: new Date() }).catch(() => {});

    return res.redirect("/");
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const normalizedEmail = email.trim().toLowerCase();
      const user = await storage.getUserByEmail(normalizedEmail);

      if (user) {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
          .createHmac("sha256", env.SESSION_SECRET)
          .update(rawToken)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await storage.createPasswordResetToken({
          userId: user.id,
          token: tokenHash,
          expiresAt,
          used: false,
        });

        const baseUrl =
          (env.APP_BASE_URL ??
            (env.REPLIT_DOMAINS ? `https://${env.REPLIT_DOMAINS.split(",")[0]}` : "")) ||
          `http://localhost:5000`;
        const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

        sendPasswordResetEmail(user.name, user.email, resetLink);
      }

      res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (err: any) {
      logger.error({ err: err }, "[ForgotPassword] Error:");
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password)
        return res.status(400).json({ message: "Token and password are required" });

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const tokenHash = crypto.createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
      const resetToken = await storage.getPasswordResetToken(tokenHash);
      if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      const marked = await storage.markPasswordResetTokenUsed(resetToken.id);
      if (!marked) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      await storage.updateUser(resetToken.userId, { passwordHash: hashedPassword });

      res.json({ message: "Password has been reset successfully" });
    } catch (err: any) {
      logger.error({ err: err }, "[ResetPassword] Error:");
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const strategyName = await ensureOidcStrategy(req.hostname);
      passport.authenticate(strategyName, {
        prompt: "login consent",
        scope: ["openid", "email", "profile"],
      })(req, res, next);
    } catch (err) {
      logger.error({ err: err }, "OIDC login error:");
      res.redirect("/?sso_error=config");
    }
  });

  app.get("/api/callback", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const strategyName = await ensureOidcStrategy(req.hostname);
      passport.authenticate(strategyName, async (err: any, oidcUser: any) => {
        if (err || !oidcUser) {
          logger.error({ err: err }, "OIDC callback error:");
          return res.redirect("/?sso_error=auth");
        }
        const email = oidcUser.claims?.email;
        if (!email) {
          return res.redirect("/?sso_error=no_email");
        }
        const appUser = await storage.getUserByEmail(email);
        if (!appUser) {
          return res.redirect("/?sso_error=no_account");
        }
        req.session.userId = appUser.id;
        storage.updateUser(appUser.id, { lastLoginAt: new Date() }).catch(() => {});
        res.redirect("/");
      })(req, res, next);
    } catch (err) {
      logger.error({ err: err }, "OIDC callback error:");
      res.redirect("/?sso_error=config");
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { passwordHash, ...safe } = user;

    let tenantName: string | undefined;
    let tenantOnboardingComplete: boolean | undefined;
    let subscriptionStatus: any ;
    if (user.tenantId) {
      const tenant = await storage.getTenant(user.tenantId);
      tenantName = tenant?.name;
      if (user.role === "ADMIN") {
        tenantOnboardingComplete = tenant?.onboardingComplete ?? false;
      }
    }

    if (user.role !== "SUPER_ADMIN") {
      const settings = await storage.getSubscriptionSettings();
      const gateEnabled = settings?.subscriptionGateEnabled ?? false;
      if (gateEnabled) {
        let hasActiveSubscription = false;
        let planId: string | null = null;
        let ownerSub;
        if (user.tenantId) {
          ownerSub = await storage.getOwnerSubscription(user.tenantId);
        }
        if (!ownerSub) {
          ownerSub = await storage.getOwnerSubscriptionByUserId(user.id);
        }
        hasActiveSubscription = ownerSub?.status === "active" && !!ownerSub?.planId;
        planId = ownerSub?.planId || null;
        subscriptionStatus = {
          gateEnabled,
          hasActiveSubscription,
          needsSubscription: !hasActiveSubscription,
          planId,
        };
      } else {
        subscriptionStatus = {
          gateEnabled: false,
          hasActiveSubscription: false,
          needsSubscription: false,
          planId: null,
        };
      }
    }

    // Surface the SignSuiteIQ app-switcher widget token if it's still valid.
    // The widget script will be mounted by the frontend when this is present.
    let widgetToken: string | null = null;
    if (
      req.session.widgetToken &&
      typeof req.session.widgetTokenExpiresAt === "number" &&
      req.session.widgetTokenExpiresAt > Date.now()
    ) {
      widgetToken = req.session.widgetToken;
    }

    res.json({ ...safe, tenantName, tenantOnboardingComplete, subscriptionStatus, widgetToken });
  });

  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    const updates: any = {};
    if (req.body.name && req.body.name.trim()) updates.name = req.body.name.trim();
    if (req.body.phone !== undefined) updates.phone = req.body.phone?.trim() || null;
    if (req.body.email && req.body.email.trim()) {
      const newEmail = req.body.email.trim().toLowerCase();
      if (newEmail !== user.email) {
        const existing = await storage.getUserByEmail(newEmail);
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ message: "That email/username is already in use" });
        }
        updates.email = newEmail;
      }
    }

    if (req.body.currentPassword || req.body.newPassword) {
      if (!req.body.currentPassword || !req.body.newPassword) {
        return res.status(400).json({ message: "Both current and new password are required" });
      }
      if (req.body.newPassword !== req.body.confirmPassword) {
        return res.status(400).json({ message: "New password and confirmation do not match" });
      }
      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
      if (req.body.newPassword.length < 8)
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      updates.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No changes provided" });
    }

    const updated = await storage.updateUser(user.id, updates);
    if (!updated) return res.status(500).json({ message: "Update failed" });
    const { passwordHash: _, ...safe2 } = updated;
    res.json(safe2);
  });

  // ─── SignSuiteIQ Provisioning Receiver ───────────────────────────────────
  // Server-to-server endpoint. Auth via shared secret in X-App-Secret header.
  // No session/cookie/CSRF — the CSRF exclusion is in routes/index.ts.
  app.post("/api/internal/provision-user", async (req: Request, res: Response) => {
    try {
      const expectedSecret =
        process.env.SSO_SECRET_SIGNSALESIQ || process.env.SIGNSUITEIQ_SSO_SECRET;
      const presentedSecret = req.header("X-App-Secret");

      if (!expectedSecret) {
        logger.error("[Provision] No app secret configured (set SSO_SECRET_SIGNSALESIQ)");
        return res.status(401).json({ error: "invalid app secret" });
      }
      if (
        !presentedSecret ||
        !timingSafeEqualStr(presentedSecret, expectedSecret)
      ) {
        return res.status(401).json({ error: "invalid app secret" });
      }

      const body = req.body || {};
      const action = String(body.action || "").toLowerCase();
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const externalId = typeof body.external_id === "number" ? body.external_id : null;

      if (!email) return res.status(400).json({ error: "email is required" });
      if (action !== "upsert" && action !== "delete") {
        return res.status(400).json({ error: "action must be 'upsert' or 'delete'" });
      }

      // ── DELETE (soft-archive) ────────────────────────────────────────────
      if (action === "delete") {
        const archived = await storage.archiveUserByEmail(email);
        if (!archived) {
          return res.json({ status: "ok", detail: "user not found, nothing to delete" });
        }
        logger.info(`[Provision] Archived user ${archived.id} (${email})`);
        return res.json({ status: "ok", userId: archived.id });
      }

      // ── UPSERT ───────────────────────────────────────────────────────────
      const incomingRole = mapRole(body.role, body.job_title);
      const adminObj = body.admin as
        | { external_id?: number; email?: string; username?: string; name?: string }
        | undefined;
      const tenantObj = body.tenant as
        | {
            external_id?: number;
            name?: string;
            slug?: string;
            email?: string;
            phone?: string;
            website?: string;
          }
        | undefined;

      // Resolve or create the tenant from the SignSuiteIQ company/tenant block
      let resolvedTenantId: string | undefined;
      if (tenantObj?.external_id) {
        let tenant = await storage.getTenantBySignSuiteIQCompanyId(tenantObj.external_id);
        if (!tenant && tenantObj.name && tenantObj.slug) {
          tenant = await storage.createTenant({
            name: tenantObj.name,
            slug: tenantObj.slug + "-" + tenantObj.external_id,
            signsuiteiqCompanyId: tenantObj.external_id,
            email: tenantObj.email || null,
            phone: tenantObj.phone || null,
            website: tenantObj.website || null,
          });
          logger.info(
            `[Provision] Auto-created tenant ${tenant.id} (${tenantObj.name}) from SignSuiteIQ company ${tenantObj.external_id}`
          );
        }
        if (tenant) resolvedTenantId = tenant.id;
      }

      // Resolve the admin so we can link the user to the same tenant
      let adminLocalId: string | undefined;
      const adminEmail =
        adminObj && typeof adminObj.email === "string" ? adminObj.email.trim().toLowerCase() : null;

      if (adminEmail) {
        let adminUser = await storage.getUserByEmail(adminEmail);
        if (!adminUser && adminObj) {
          // Auto-create the admin user
          const unusableHash = `!provisioned:${crypto.randomBytes(32).toString("hex")}`;
          adminUser = await storage.createUser({
            name: (adminObj.name || adminEmail.split("@")[0]).trim(),
            email: adminEmail,
            passwordHash: unusableHash,
            role: "ADMIN",
            signsuiteiqUserId: adminObj.external_id ?? undefined,
            tenantId: resolvedTenantId,
            username: adminObj.username || adminEmail.split("@")[0],
          });
          logger.info(
            `[Provision] Auto-created admin ${adminUser.id} (${adminEmail}) from SignSuiteIQ external_id=${adminObj.external_id ?? "n/a"}`
          );
        }
        if (adminUser) {
          adminLocalId = adminUser.id;
          // Ensure admin is in the right tenant
          if (resolvedTenantId && adminUser.tenantId !== resolvedTenantId) {
            await storage.updateUser(adminUser.id, { tenantId: resolvedTenantId });
          }
        }
      }

      // If we still don't have a tenantId but admin has one, inherit it
      if (!resolvedTenantId && adminLocalId) {
        const adminUser = await storage.getUserByEmail(adminEmail!);
        if (adminUser?.tenantId) resolvedTenantId = adminUser.tenantId;
      }

      // Find or create the user
      let existing = externalId
        ? await storage.getUserBySignSuiteIQId(externalId)
        : undefined;
      if (!existing) {
        existing = await storage.getUserByEmail(email);
      }

      if (existing) {
        // Update existing user
        const updates: Record<string, unknown> = {
          name: body.name || existing.name,
          role: incomingRole,
          signsuiteiqUserId: externalId ?? existing.signsuiteiqUserId,
          deletedAt: null, // un-archive if previously soft-deleted
        };
        if (body.username) updates.username = body.username;
        if (body.phone !== undefined) updates.phone = body.phone;
        if (body.job_title !== undefined) updates.jobTitle = body.job_title;
        if (body.location !== undefined) updates.location = body.location;
        if (resolvedTenantId) updates.tenantId = resolvedTenantId;
        if (body.password) updates.passwordHash = await bcrypt.hash(body.password, 12);

        await storage.updateUser(existing.id, updates as any);
        logger.info(`[Provision] Updated user ${existing.id} (${email})`);
        return res.json({ status: "ok", userId: existing.id, action: "updated" });
      }

      // Create new user
      const passwordHash = body.password
        ? await bcrypt.hash(body.password, 12)
        : `!provisioned:${crypto.randomBytes(32).toString("hex")}`;

      const newUser = await storage.createUser({
        name: body.name || email.split("@")[0],
        email,
        passwordHash,
        role: incomingRole,
        signsuiteiqUserId: externalId ?? undefined,
        tenantId: resolvedTenantId,
        username: body.username || email.split("@")[0],
        phone: body.phone || null,
        jobTitle: body.job_title || null,
        location: body.location || null,
      });

      logger.info(`[Provision] Created user ${newUser.id} (${email})`);
      return res.json({ status: "ok", userId: newUser.id, action: "created" });
    } catch (err: any) {
      logger.error({ err }, "[Provision] Error:");
      return res.status(500).json({ error: "internal error" });
    }
  });
}

/** Constant-time string comparison to prevent timing attacks on secrets. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

type SignSalesRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SALES"
  | "ACCOUNT_MANAGER"
  | "PROJECT_MANAGER"
  | "OUTSIDE_SALES"
  | "INSIDE_SALES"
  | "SALES_MANAGER"
  | "DESIGNER"
  | "PRODUCTION_MANAGER";

/**
 * Map SignSuiteIQ identity to a SignSalesIQ role enum value.
 *
 * Admin/super-admin roles always win. Otherwise SignSuiteIQ models seniority
 * via the *job title* (regular users all carry role "user"), so we map the
 * job title onto the closest SignSalesIQ role, defaulting to SALES.
 */
function mapRole(
  role: string | undefined,
  jobTitle?: string | null
): SignSalesRole {
  const r = (role ?? "").toLowerCase();
  if (r === "super_admin") return "SUPER_ADMIN";
  if (r === "admin") return "ADMIN";

  switch ((jobTitle ?? "").trim().toLowerCase()) {
    case "designer":
      return "DESIGNER";
    case "production":
      return "PRODUCTION_MANAGER";
    case "install manager":
    case "project manager":
      return "PROJECT_MANAGER";
    case "sales":
    case "installer":
    case "sub-contract installer":
    default:
      return "SALES";
  }
}
