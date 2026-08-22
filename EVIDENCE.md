# Evidence

One pasted proof per Definition-of-Done checkbox (§6 of the brief).
Filled in as each is completed — a claim without evidence here counts as
not done.

## Metering

<<<<<<< HEAD
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

=======
- [ ] A billable action creates exactly one usage event, even under
      retries — deduplicated by idempotency key.
      <!-- proof: -->
- [ ] A test proves double-counting cannot happen.
      <!-- proof: -->

## Quotas

- [ ] Usage is checked against the tenant's plan; requests over the
      limit are rejected.
      <!-- proof: -->
- [ ] Responses carry the correct status codes (429/402) and a message
      explaining why.
      <!-- proof: -->
>>>>>>> 9e1fca23f0048e002225b8fd3f4f1323f5776e66

## Cost calculation

- [ ] Monthly usage rolls up into a cost figure per tenant.
      <!-- proof: -->
- [ ] AI token pricing handles cached input tokens, reasoning tokens,
      and output pricing correctly.
      <!-- proof: -->
- [ ] Pricing constants are pinned and covered by tests.
      <!-- proof: -->

## Stripe integration

- [ ] Subscription checkout works end-to-end in Stripe test mode.
      <!-- proof: -->
- [ ] Webhooks verify signatures, ignore duplicate events, and update
      tenant plan/status.
      <!-- proof: -->

## Data model, tests & documentation

- [ ] Database includes tenants, plans, subscriptions, and usage
      events; customer data isolated per tenant.
      <!-- proof: -->
- [ ] Tests cover: duplicate usage prevention, quota boundary cases,
      cost calculations, invalid-webhook rejection, duplicate-webhook
      handling.
      <!-- proof: -->
- [ ] README + architecture diagram + setup instructions;
      submission-pack files present.
      <!-- proof: -->
