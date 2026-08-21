# Evidence

One pasted proof per Definition-of-Done checkbox (§6 of the brief).
Filled in as each is completed — a claim without evidence here counts as
not done.

## Metering

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
