import * as Sentry from "@sentry/node";
import "dotenv/config";
import express, { NextFunction, type Request, Response } from "express";
import { createServer } from "http";
import pinoHttp from "pino-http";
import { assertObjectStorageConfigured } from "./cloudStorage";
import { initEmailService, seedEmailTemplates, startExpirationScheduler } from "./emailService";
import { env } from "./env";
import { logger } from "./logger";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

app.use(pinoHttp({ logger }));

(async () => {
  assertObjectStorageConfigured();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (env.SENTRY_DSN) {
      try {
        Sentry.captureException(err);
      } catch (sentryErr) {
        logger.warn({ err: sentryErr }, "sentry capture failed");
      }
    }
    logger.error({ err }, "unhandled express error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = env.PORT;
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info({ port, env: env.NODE_ENV }, "server started");
    logger.info(`health check: http://0.0.0.0:${port}/api/health`);

    initEmailService(storage);
    seedEmailTemplates(storage);
    startExpirationScheduler(storage);
  });

  const { pool, db } = await import("./db");
  const { activityLogs } = await import("@shared/schema");
  const { lt } = await import("drizzle-orm");

  // Purge activity_logs rows older than 90 days — run once at startup then daily
  const pruneActivityLogs = async () => {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await db.delete(activityLogs).where(lt(activityLogs.createdAt, cutoff));
    } catch (err) {
      logger.error({ err }, "activity_logs retention purge failed");
    }
  };
  pruneActivityLogs();
  setInterval(pruneActivityLogs, 24 * 60 * 60 * 1000);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    const forceExit = setTimeout(() => {
      logger.warn("force shutdown after 25s timeout");
      process.exit(1);
    }, 25_000);
    forceExit.unref();
    try {
      await new Promise<void>((res) => httpServer.close(() => res()));
      await pool.end();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
