-- Usage Metering & Billing Engine — schema
-- Money is always an integer (cents); never a float, anywhere in this schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE plans (
  id TEXT PRIMARY KEY,                  -- 'free' | 'pro'
  api_calls_limit INTEGER NOT NULL,     -- per month
  ai_tokens_limit INTEGER NOT NULL,     -- per month
  stripe_price_id TEXT,                 -- NULL for 'free'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL REFERENCES plans(id) DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The idempotency guarantee lives here, not in application code:
-- the UNIQUE constraint is what makes double-counting impossible even
-- under a race between two near-simultaneous retries.
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  idempotency_key TEXT NOT NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('api_call', 'ai_tokens')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX idx_usage_events_tenant_type_created
  ON usage_events (tenant_id, usage_type, created_at);

-- Same pattern for Stripe webhooks: the event id itself is the
-- deduplication key. A replayed event is a duplicate primary key,
-- caught by the database, not by "have I seen this before" logic.
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,             -- Stripe's event id, e.g. evt_1N...
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

-- Seed data: the two plans this capstone supports.
INSERT INTO plans (id, api_calls_limit, ai_tokens_limit, stripe_price_id)
VALUES
  ('free', 1000, 100000, NULL),
  ('pro', 50000, 5000000, NULL) -- stripe_price_id filled in after Stripe setup (Phase 3)
ON CONFLICT (id) DO NOTHING;
