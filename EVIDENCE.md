# Evidence

One pasted proof per Definition-of-Done checkbox (§6 of the brief).
Filled in as each is completed — a claim without evidence here counts as
not done.

## Metering

- [x] A billable action creates exactly one usage event, even under
      retries — deduplicated by idempotency key.
      Proof: POST /generate called twice with idempotencyKey="test-2".
      Both responses returned the same event.id. Second response had
      duplicate: true. GET /usage confirmed apiCalls.used stayed at 1.

## Quotas

## Quotas

- [x] Usage is checked against the tenant's plan; requests over the
      limit are rejected.
      Proof: ran scripts/load-quota.js with 998 concurrent requests
      (batches of 25) against a Free-plan tenant (limit 1000). Result:
      998 succeeded, then GET /usage confirmed apiCalls.used = 1000
      exactly — not 1001, not 998. The row lock (SELECT ... FOR UPDATE
      in meterService.js) held under real concurrency, not just
      sequential requests.

- [x] Responses carry the correct status codes (429/402) and a message
      explaining why.
      Proof: request #1001 returned 429 with body:
      {"error":"Quota exceeded: api_call limit is 1000, current usage
      is 1000, this request needs 1 more."}


## Cost calculation

- [ ] Monthly usage rolls up into a cost figure per tenant.
      <!-- proof: -->
- [ ] AI token pricing handles cached input tokens, reasoning tokens,
      and output pricing correctly.
      <!-- proof: -->
- [ ] Pricing constants are pinned and covered by tests.
      <!-- proof: -->

## Stripe integration

- [x] Subscription checkout works end-to-end in Stripe test mode.
      Proof: completed a real Checkout via POST /billing/checkout,
      paid with test card 4242 4242 4242 4242. Webhook
      checkout.session.completed (evt_1U7Lf0CRHdKV8bd4eWSoVz4E, with
      metadata.tenantId matching the tenant) was received and applied.
      GET /usage before: plan=free, apiCalls.limit=1000. After:
      plan=pro, apiCalls.limit=50000, subscriptionStatus=active.

- [x] Webhooks verify signatures, ignore duplicate events, and update
      tenant plan/status.
      Proof (dedup): ran `stripe events resend evt_1U7Lf0CRHdKV8bd4eWSoVz4E`
      — Stripe delivered the same event a second time. Server responded
      200. Verified in database:

      SELECT id, type, processed_at FROM stripe_events
      WHERE id = 'evt_1U7Lf0CRHdKV8bd4eWSoVz4E';

                id              |            type            |         processed_at
      -------------------------------+----------------------------+-------------------------------
       evt_1U7Lf0CRHdKV8bd4eWSoVz4E | checkout.session.completed | 2026-08-22 20:37:02.318737+00
      (1 row)

      Exactly one row, timestamped from the ORIGINAL delivery — not
      updated by the resend. Confirms the duplicate was recognized and
      ignored, not reprocessed.     
      Proof (signature check): sent a forged webhook with
      `Stripe-Signature: t=1,v1=fake` -> 400 "Webhook signature
      verification failed: No signatures found matching the expected
      signature for payload." Nothing in the database changed.

## Data model, tests & documentation

- [x] Tests cover: duplicate usage prevention, quota boundary cases,
      cost calculations, invalid-webhook rejection, duplicate-webhook
      handling.
      Proof: `docker compose exec app npm test` — 12/12 tests pass.

      ✔ idempotency: same key called twice returns the same event, only
        one row stored
      ✔ quota boundary: exactly at the limit succeeds, one more is
        rejected with 429
      ✔ subscription status: past_due returns 402, not 429
      ✔ unknown tenant returns 404, does not crash
      ✔ 6x pricing tests (api calls, cached input, reasoning tokens,
        non-additive categories, null-safe)
      ✔ webhook dedup: the same event id processed twice is only
        recorded once
      ✔ invalid webhook signature is rejected before any processing
        happens

      tests 12, pass 12, fail 0, duration 351ms

