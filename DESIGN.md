# Design — Usage Metering & Billing Engine

## Problem

Every SaaS product must answer three questions for each customer:
how much have they used, how much should they pay, and have they hit
their limit? This service answers all three, safely under retries and
webhook replays — a double-counted usage event or a duplicated webhook
must never happen.

## Scope (§7 of the brief)

- 2 plans: **Free** and **Pro**
- 2 usage types: **API calls** and **AI tokens** (simulated — no real
  model call, we're metering numbers)
- 1 billable endpoint: `POST /generate` — records a usage event, checks
  quota, calculates cost
- Stripe test mode for subscription checkout + webhook sync

**Explicit non-goal:** no invoicing, no proration, no overage billing in
the core system. A customer who exceeds their quota is rejected
(429/402), not billed extra. These are stretch goals, not required.

## Data model

```
tenants
├── id (uuid, pk)
├── name (text)
├── plan (text: 'free' | 'pro')
├── stripe_customer_id (text, nullable)
├── stripe_subscription_id (text, nullable)
├── subscription_status (text: 'active' | 'past_due' | 'canceled', default 'active')
└── created_at (timestamptz)

plans (static reference data, seeded once)
├── id (text, pk: 'free' | 'pro')
├── api_calls_limit (integer, per month)
├── ai_tokens_limit (integer, per month)
├── stripe_price_id (text, nullable — Pro's Stripe Price ID)
└── created_at (timestamptz)

usage_events
├── id (uuid, pk)
├── tenant_id (uuid, fk -> tenants.id)
├── idempotency_key (text) — UNIQUE per tenant, this is the
│   double-counting guard
├── usage_type (text: 'api_call' | 'ai_tokens')
├── quantity (integer) — count of calls, or count of tokens
├── metadata (jsonb, nullable) — e.g. token breakdown for ai_tokens
├── created_at (timestamptz)
└── UNIQUE (tenant_id, idempotency_key)

stripe_events (webhook deduplication log)
├── id (text, pk) — the Stripe event id (evt_...), globally unique
├── type (text) — e.g. 'checkout.session.completed'
├── processed_at (timestamptz)
└── payload (jsonb) — the raw event, for debugging/replay
```

**Money is never stored as float.** Cost is computed on read (a rollup
over `usage_events`, priced against constants in `src/pricing.js`), and
whenever a cost figure is persisted or returned, it's an integer number
of **cents**.

## API surface

| Method | Path | Purpose |
|---|---|---|
| `POST /generate` | The one billable action. Body: `{ usageType, quantity, idempotencyKey }`. Records usage, enforces quota, returns the event + running cost. |
| `GET /usage?tenantId=...` | Rollup: `{ apiCalls: {used, limit}, aiTokens: {used, limit}, costCents, plan }` |
| `POST /billing/checkout` | Creates a Stripe Checkout session for the Pro plan, returns the session URL |
| `POST /webhooks/stripe` | Stripe webhook receiver: verifies signature, dedupes by event id, syncs tenant plan/status |

## Layer sketch

```
routes/           HTTP only: parse request, call a service, shape the response
  generate.js
  usage.js
  billing.js
  webhooks.js

services/         Business rules, no HTTP, no SQL strings
  meterService.js    record() — the idempotency + quota logic
  usageService.js    rollup() — aggregate usage_events into a cost figure
  billingService.js  createCheckoutSession(), applyWebhookEvent()

repositories/     The only files that touch the database
  tenantRepository.js
  usageEventRepository.js
  stripeEventRepository.js

pricing.js        Pinned pricing constants + the cost calculation function
                   (pure functions, no I/O — easy to unit test)
```

Swapping Postgres for another store later would only touch
`repositories/` — same principle proven in the Week 4 assignment
(BE-04), applied here to a system where getting it wrong costs money.

## Idempotency strategy

Every call to `POST /generate` carries a client-supplied
`idempotencyKey`. `usage_events` has a `UNIQUE (tenant_id,
idempotency_key)` constraint — the database itself is the source of
truth for "have I seen this before," not application logic (a race
between two near-simultaneous retries can't slip past a unique
constraint the way it could slip past an application-level check).

`meterService.record()`:
1. Attempts to `INSERT` the usage event.
2. If the insert succeeds → this is a new event. Check quota, return
   the result.
3. If the insert fails on the unique constraint → this exact
   (tenant, idempotencyKey) pair was already recorded. Look up the
   original event and return the *same* result — no new event, no
   second quota check, no double charge.

This is tested directly: send the same request twice concurrently,
assert exactly one row exists in `usage_events` for that key.

## Webhook deduplication strategy

Same pattern, applied to Stripe events instead of usage events.
`stripe_events.id` (the Stripe event id, e.g. `evt_1N...`) is the
primary key. Before processing a webhook, `billingService` attempts to
insert its id into `stripe_events`; a duplicate id means this event was
already processed, so it's acknowledged with `200` and ignored — Stripe
retries a webhook until it gets a `2xx`, so silently ignoring a replay
(rather than erroring) is required, not optional.
