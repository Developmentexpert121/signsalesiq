import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireRole";
import { sendPlanPurchaseEmail } from "../emailService";
import { env } from "../env";
import { db } from "../db";
import { processedStripeEvents } from "@shared/schema";
import { constructWebhookEvent, createCheckoutSession } from "../stripeService";
import { storage } from "../storage";

import { logger } from "../logger";
export function registerBillingRoutes(app: Express) {
  app.get("/api/subscription-plans/public", requireAuth, async (_req: Request, res: Response) => {
    try {
      const plans = await storage.getActiveSubscriptionPlans();
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch plans" });
    }
  });

  app.get("/api/subscription-plans", requireSuperAdmin, async (_req: Request, res: Response) => {
    const plans = await storage.getSubscriptionPlans();
    res.json(plans);
  });

  app.post("/api/subscription-plans", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const plan = await storage.createSubscriptionPlan(req.body);
      res.json(plan);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create plan" });
    }
  });

  app.patch(
    "/api/subscription-plans/:id",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const plan = await storage.updateSubscriptionPlan(req.params.id as string, req.body);
        if (!plan) return res.status(404).json({ message: "Plan not found" });
        res.json(plan);
      } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to update plan" });
      }
    }
  );

  app.delete(
    "/api/subscription-plans/:id",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteSubscriptionPlan(req.params.id as string);
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to delete plan" });
      }
    }
  );

  app.get("/api/owner-subscriptions", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const subs = await storage.getOwnerSubscriptions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch subscriptions" });
    }
  });

  app.patch(
    "/api/owner-subscriptions/:subKey",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { planId } = req.body;
        const data: any = { planId: planId || null };
        if (planId) {
          data.status = "active";
          data.subscribedAt = new Date();
        } else {
          data.status = "inactive";
          data.subscribedAt = null;
        }
        const subKey = req.params.subKey as string;
        let sub;
        if (subKey.startsWith("user:")) {
          const userId = subKey.replace("user:", "");
          sub = await storage.upsertOwnerSubscriptionByUserId(userId, data);
        } else {
          sub = await storage.upsertOwnerSubscription(subKey, data);
        }
        res.json(sub);
      } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to update subscription" });
      }
    }
  );

  app.get("/api/subscription-settings", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSubscriptionSettings();
      res.json(settings || { subscriptionGateEnabled: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch settings" });
    }
  });

  app.patch(
    "/api/subscription-settings",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        if (typeof req.body.subscriptionGateEnabled !== "boolean") {
          return res.status(400).json({ message: "subscriptionGateEnabled must be a boolean" });
        }
        const settings = await storage.updateSubscriptionSettings({
          subscriptionGateEnabled: req.body.subscriptionGateEnabled,
        });
        res.json(settings);
      } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to update settings" });
      }
    }
  );

  app.get("/api/subscription/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user)
        return res.json({
          gateEnabled: false,
          hasActiveSubscription: false,
          needsSubscription: false,
        });

      if (user.role === "SUPER_ADMIN") {
        return res.json({
          gateEnabled: false,
          hasActiveSubscription: true,
          needsSubscription: false,
        });
      }

      const settings = await storage.getSubscriptionSettings();
      const gateEnabled = settings?.subscriptionGateEnabled ?? false;

      let hasActiveSubscription = false;
      let planId: string | null = null;
      let planDetails = null;
      let eventsUsed = 0;
      let subscribedAt: string | null = null;

      let ownerSub;
      if (user.tenantId) {
        ownerSub = await storage.getOwnerSubscription(user.tenantId);
      }
      if (!ownerSub) {
        ownerSub = await storage.getOwnerSubscriptionByUserId(user.id);
      }

      if (ownerSub) {
        hasActiveSubscription = ownerSub.status === "active" && !!ownerSub.planId;
        planId = ownerSub.planId || null;
        eventsUsed = ownerSub.eventsUsed || 0;
        if (ownerSub.planId) {
          planDetails = await storage.getSubscriptionPlan(ownerSub.planId);
        }
        if (ownerSub.subscribedAt) {
          subscribedAt = ownerSub.subscribedAt.toISOString();
        }
      }

      let superAdminContact = null;
      if (!user.tenantId || (gateEnabled && !hasActiveSubscription)) {
        const allUsers = await storage.getAllUsers();
        const superAdmin = allUsers.find((u) => u.role === "SUPER_ADMIN");
        if (superAdmin) {
          superAdminContact = { name: superAdmin.name, email: superAdmin.email };
        }
      }

      res.json({
        gateEnabled,
        hasActiveSubscription,
        needsSubscription: gateEnabled && !hasActiveSubscription,
        planId,
        planDetails,
        eventsUsed,
        subscribedAt,
        superAdminContact,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch subscription status" });
    }
  });

  app.post(
    "/api/stripe/create-checkout-session",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = await storage.getUser(req.session.userId!);
        if (!user || user.role === "SUPER_ADMIN")
          return res.status(403).json({ message: "Super admins do not need subscriptions" });

        const { planId } = req.body;
        if (!planId) return res.status(400).json({ message: "planId is required" });

        const plan = await storage.getSubscriptionPlan(planId);
        if (!plan || !plan.active)
          return res.status(404).json({ message: "Plan not found or inactive" });

        const host = req.headers.host || "localhost:5000";
        const protocol =
          req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
        const baseUrl = `${protocol}://${host}`;

        const session = await createCheckoutSession({
          tenantId: user.tenantId,
          userId: user.id,
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          successUrl: `${baseUrl}/my-subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/subscribe?canceled=true`,
        });

        res.json({ url: session.url });
      } catch (err: any) {
        logger.error("Stripe checkout error:", err);
        res.status(500).json({ message: err.message || "Failed to create checkout session" });
      }
    }
  );

  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      const endpointSecret = env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        logger.error("Stripe webhook: STRIPE_WEBHOOK_SECRET is not configured");
        return res.status(400).json({ message: "Webhook not configured" });
      }
      if (!sig) {
        logger.error("Stripe webhook: missing Stripe-Signature header");
        return res.status(400).json({ message: "Missing webhook signature" });
      }
      if (!(req as any).rawBody) {
        logger.error("Stripe webhook: raw body unavailable");
        return res.status(400).json({ message: "Invalid request body" });
      }

      const event = await constructWebhookEvent((req as any).rawBody, sig, endpointSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const tenantId = session?.metadata?.tenantId;
        const userId = session?.metadata?.userId;
        const planId = session?.metadata?.planId;
        if (planId) {
          const subData = {
            planId,
            status: "active",
            stripeSessionId: session.id,
            subscribedAt: new Date(),
          };
          const user = userId ? await storage.getUser(userId) : null;
          const effectiveTenantId = tenantId || user?.tenantId;

          try {
            await db.insert(processedStripeEvents).values({ eventId: event.id });
          } catch (dbErr: any) {
            if (dbErr.code === "23505") {
              return res.json({ received: true });
            }
            throw dbErr;
          }

          if (effectiveTenantId) {
            await storage.upsertOwnerSubscription(effectiveTenantId, subData);
          } else if (userId) {
            await storage.upsertOwnerSubscriptionByUserId(userId, subData);
          }
          if (user) {
            const plan = await storage.getSubscriptionPlan(planId);
            sendPlanPurchaseEmail(
              user.email,
              user.name,
              plan?.name || "Subscription Plan",
              String(plan?.price || "")
            );
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      logger.error("Webhook error:", err);
      res.status(400).json({ message: err.message });
    }
  });

  app.get(
    "/api/stripe/verify-session/:sessionId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = await storage.getUser(req.session.userId!);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const { stripe } = await import("../stripeService");
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId as string);

        const matchesTenant = user.tenantId && session.metadata?.tenantId === user.tenantId;
        const matchesUser = session.metadata?.userId === user.id;
        if (
          session.payment_status === "paid" &&
          (matchesTenant || matchesUser) &&
          session.metadata
        ) {
          const subData = {
            planId: session.metadata.planId,
            status: "active",
            stripeSessionId: session.id,
            subscribedAt: new Date(),
          };
          if (user.tenantId) {
            await storage.upsertOwnerSubscription(user.tenantId, subData);
          } else {
            await storage.upsertOwnerSubscriptionByUserId(user.id, subData);
          }
          const plan = await storage.getSubscriptionPlan(session.metadata.planId);
          sendPlanPurchaseEmail(
            user.email,
            user.name,
            plan?.name || "Subscription Plan",
            String(plan?.price || "")
          );
          res.json({ success: true, planId: session.metadata.planId });
        } else {
          res.json({ success: false });
        }
      } catch (err: any) {
        res.status(500).json({ message: err.message || "Failed to verify session" });
      }
    }
  );
}
