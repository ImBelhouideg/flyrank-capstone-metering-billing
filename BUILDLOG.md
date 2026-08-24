# Build log — AI usage

Where AI (Claude) helped, where it was wrong, what I changed. Kept
honest as I go — "the AI wrote it" is not an acceptable answer at the
demo.

## Phase 1 — Design

- Claude proposed the initial data model (tenants/plans/usage_events/
  stripe_events) and the idempotency strategy (UNIQUE constraint as the
  source of truth, not application-level checks).
- I reviewed the schema before building on it and confirmed the
  UNIQUE(tenant_id, idempotency_key) constraint matched what the brief
  asked for.

## Phase 2 — Core billing logic

- Claude proposed wrapping the quota check in a transaction with
  `SELECT ... FOR UPDATE` on the tenant row. I didn't fully understand
  at first why this mattered beyond the idempotency key alone — Claude
  explained that without the row lock, two concurrent requests with
  DIFFERENT idempotency keys could both read "under quota" before
  either commits, overshooting the limit. I verified this myself with
  `scripts/load-quota.js` (998 concurrent requests in batches of 25) —
  usage landed at exactly 1000, not 1001+, confirming the lock works
  under real concurrency, not just in theory.

## Phase 3 — Stripe integration

- Claude flagged a critical ordering requirement I would not have
  known to look for: the webhook route needs `express.raw()` and must
  be registered BEFORE the global `express.json()` middleware, or
  Stripe's signature verification always fails silently (the body gets
  parsed into an object before the raw bytes can be checked). I tested
  this directly by sending a request with no signature header at all —
  got a clean 400, confirmed the route wasn't crashing.
- The real Stripe Checkout flow, webhook signature rejection, and
  webhook deduplication were all tested against my own real (test-mode)
  Stripe account — not simulated. The deduplication proof in particular
  came from `stripe events resend` on a real event id and checking the
  `stripe_events` table directly — I wanted to see the database state
  myself, not just trust a 200 response.

## Phase 4 — Testing & hardening

- Claude wrote the automated test suite (`meterService.test.js`,
  `webhookDedup.test.js`). Writing these against a real database (not
  mocks) was deliberate — Claude explained that testing the row lock's
  behavior under concurrency needs a real Postgres transaction, which a
  mock can't meaningfully simulate.
- Hit a real, non-trivial bug that took a while to isolate: running
  `npm test` directly from Windows (not inside Docker) against
  Postgres's published port (`localhost:5432`) consistently failed
  with a password authentication error (`28P01`), even though the same
  password worked fine through `docker compose exec db psql` and even
  through a separate throwaway container on the same Docker network.
  Claude and I worked through several hypotheses together (stale .env
  values, a stale Postgres volume with an old password, IPv6 vs IPv4
  resolution) before landing on the actual fix: run the tests INSIDE
  the `app` container (`docker compose exec app npm test`), which uses
  the same `db:5432` internal network path that the running application
  already used successfully throughout Phases 2 and 3. The root cause
  (Docker Desktop's Windows port-forwarding vs Postgres 16's SCRAM
  auth) was never fully confirmed — I chose the pragmatic fix over
  continuing to chase the underlying cause, and documented this
  tradeoff honestly in the README's Limitations section rather than
  pretending it was smooth.