import Stripe from "stripe";
import { env } from "./env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function createCheckoutSession(opts: {
  tenantId?: string | null;
  userId: string;
  planId: string;
  planName: string;
  planPrice: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const priceInCents = Math.round(parseFloat(opts.planPrice.replace(/[^0-9.]/g, "")) * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${opts.planName} - Monthly Subscription`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenantId: opts.tenantId || "",
      userId: opts.userId,
      planId: opts.planId,
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  return session;
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  endpointSecret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
}

export { stripe };
