CREATE TABLE IF NOT EXISTS "processed_stripe_events" (
  "event_id" text PRIMARY KEY,
  "processed_at" timestamptz NOT NULL DEFAULT NOW()
);
