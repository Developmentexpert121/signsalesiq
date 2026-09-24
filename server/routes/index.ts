import connectPg from "connect-pg-simple";
import cookieParser from "cookie-parser";
import cors from "cors";
import { doubleCsrf } from "csrf-csrf";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Express } from "express";
import session from "express-session";
import helmet from "helmet";
import { type Server } from "http";
import passport from "passport";
import path from "path";

import { db, pool } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { setActiveMockupModel } from "../mockup/geminiClient";
import { seedDatabase } from "../seed";
import { storage } from "../storage";
import { registerEmailTemplateRoutes } from "./admin/email-templates.routes";
import { registerMockupRoutes } from "./admin/mockup.routes";
import { registerRulesRoutes } from "./admin/rules.routes";
import { registerSignTypeRoutes } from "./admin/sign-types.routes";
import { registerStorageRoutes } from "./admin/storage.routes";
import { registerTenantRoutes } from "./admin/tenants.routes";
import { registerUsageRoutes } from "./admin/usage.routes";
import { registerUserRoutes } from "./admin/users.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerBillingRoutes } from "./billing.routes";
import { registerDocsRoutes } from "./docs.routes";
import { registerFileRoutes } from "./files.routes";
import { registerHealthRoutes } from "./health.routes";
import { registerOpportunityRoutes } from "./opportunities.routes";
import { registerOutputFeedbackRoutes } from "./output-feedback.routes";
import { registerSignSpecRoutes } from "./sign-specs.routes";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    // SignSuiteIQ app-switcher widget token. Captured from /api/sso/exchange,
    // exposed via /api/auth/me so the frontend can mount the widget script.
    widgetToken?: string;
    widgetTokenExpiresAt?: number; // epoch ms
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const PgStore = connectPg(session);
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === "production"
          ? {
              useDefaults: true,
              directives: {
                // Allow the SignSuiteIQ app-switcher widget script, its API
                // calls (app list fetch), and its app icons.
                "script-src": ["'self'", "https://signsuiteiq.ai"],
                "connect-src": ["'self'", "https://signsuiteiq.ai"],
                "img-src": ["'self'", "data:", "blob:", "https://signsuiteiq.ai"],
              },
            }
          : false,
    })
  );
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.PUBLIC_APP_URL ?? false,
      credentials: true,
    })
  );

  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new PgStore({
        pool: pool,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
      }),
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: sessionTtl,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  passport.serializeUser((user: Express.User, cb) => cb(null, (user as any).id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user ?? false);
    } catch (e) {
      cb(e);
    }
  });

  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => env.SESSION_SECRET,
    getSessionIdentifier: (req) => req.session.id,
    cookieName: env.NODE_ENV === "production" ? "__Host-csrf" : "csrf-token",
    cookieOptions: {
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    },
  });

  app.use((req, res, next) => {
    const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
    if (
      safeMethods.has(req.method) ||
      req.path === "/api/csrf-token" ||
      req.path === "/api/stripe/webhook" ||
      req.path === "/api/internal/provision-user"
    )
      return next();
    if (env.NODE_ENV !== "production") return next();
    return doubleCsrfProtection(req, res, next);
  });

  app.get("/api/csrf-token", (req, res, next) => {
    (req.session as any).csrfBound = true;
    req.session.save((err) => {
      if (err) return next(err);
      res.json({ csrfToken: generateCsrfToken(req, res) });
    });
  });

  if (env.NODE_ENV === "production") {
    try {
      const migrationsFolder = path.join(__dirname, "..", "migrations");
      logger.info(`[DB] Running migrations from ${migrationsFolder}...`);
      await migrate(db, { migrationsFolder });
      logger.info("[DB] Migrations complete.");
    } catch (e: any) {
      // Fail loud: a swallowed migration error means the app would serve a
      // half-migrated schema with no alarm. Exit so the platform marks the
      // deploy failed and rolls back to the previous (consistent) release.
      logger.error({ err: e }, "[DB] Migration failed — aborting startup");
      process.exit(1);
    }
  }

  await seedDatabase();

  try {
    const ms = await storage.getMockupSettings();
    if (ms?.model) setActiveMockupModel(ms.model);
  } catch (e) {
    logger.warn({ err: e }, "[Mockup] Could not load persisted model setting; using default");
  }

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerTenantRoutes(app);
  registerUserRoutes(app);
  registerRulesRoutes(app);
  registerSignTypeRoutes(app);
  registerMockupRoutes(app);
  registerStorageRoutes(app);
  registerUsageRoutes(app);
  registerEmailTemplateRoutes(app);
  registerOpportunityRoutes(app);
  registerOutputFeedbackRoutes(app);
  registerSignSpecRoutes(app);
  registerFileRoutes(app);
  registerDocsRoutes(app);
  registerBillingRoutes(app);

  return httpServer;
}
