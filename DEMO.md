# Demo script — 6 minutes

Rehearse this flow start to finish, twice, before the real demo.
Closing line: **"usage, money, and customer access stay correct under
retries, failures, and real-world conditions."**

## Setup (before the demo starts, not part of the timed 6 minutes)

```powershell
docker compose down -v
docker compose up -d
docker compose exec app node scripts/seed-demo.js
```

Copy the printed `tenantId` — you'll use it throughout. Set it once:

```powershell
$tenantId = "<paste the printed tenantId>"
```

In a second terminal, start the Stripe CLI and leave it running,
visible on screen:

```powershell
stripe listen --forward-to localhost:3000/webhooks/stripe
```

If it prints a new `whsec_...`, update `.env` and restart the app
(`docker compose restart app`) — do this BEFORE the demo starts.

---

## 1. Drive to the quota boundary (~1 min)

The tenant is pre-loaded to 997/1000. Three live calls to prove the
exact boundary:

```powershell
1..3 | ForEach-Object {
  Invoke-RestMethod -Uri http://localhost:3000/generate -Method Post `
    -Body (@{tenantId=$tenantId; usageType="api_call"; quantity=1; idempotencyKey="demo-live-$_"} | ConvertTo-Json) `
    -ContentType "application/json"
}
```

Now show the clean refusal — the 1001st call:

```powershell
try {
  Invoke-RestMethod -Uri http://localhost:3000/generate -Method Post `
    -Body (@{tenantId=$tenantId; usageType="api_call"; quantity=1; idempotencyKey="demo-over-limit"} | ConvertTo-Json) `
    -ContentType "application/json"
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

**Say out loud:** "429, and the message tells you exactly why — limit,
current usage, how much this request needed."

## 2. Prove the retry doesn't double-count (~1 min)

```powershell
$r1 = Invoke-RestMethod -Uri http://localhost:3000/generate -Method Post `
  -Body (@{tenantId=$tenantId; usageType="api_call"; quantity=1; idempotencyKey="demo-retry-test"} | ConvertTo-Json) `
  -ContentType "application/json"
```

This will actually be a 429 too since we're at the limit — that's fine,
it proves the SAME error, not a new charge. To show the true idempotency
retry (not the quota edge), pick a key from earlier that succeeded and
call it again:

```powershell
$r1 = Invoke-RestMethod -Uri http://localhost:3000/generate -Method Post `
  -Body (@{tenantId=$tenantId; usageType="api_call"; quantity=1; idempotencyKey="demo-live-1"} | ConvertTo-Json) `
  -ContentType "application/json"

$r2 = Invoke-RestMethod -Uri http://localhost:3000/generate -Method Post `
  -Body (@{tenantId=$tenantId; usageType="api_call"; quantity=1; idempotencyKey="demo-live-1"} | ConvertTo-Json) `
  -ContentType "application/json"

Write-Host "Same event? $($r1.event.id -eq $r2.event.id)"
Write-Host "Second call flagged duplicate: $($r2.duplicate)"
```

**Say out loud:** "Same idempotency key, same event id, second call
flagged as duplicate — no new row written."

## 3. Live upgrade via Stripe Checkout (~2 min)

```powershell
$checkout = Invoke-RestMethod -Uri http://localhost:3000/billing/checkout -Method Post `
  -Body (@{tenantId=$tenantId} | ConvertTo-Json) -ContentType "application/json"

Start-Process $checkout.checkoutUrl
```

Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.

Point at the Stripe CLI terminal — the `checkout.session.completed`
event fires live. Then:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/usage?tenantId=$tenantId"
```

**Say out loud:** "Plan just flipped from free to pro, live, from a
real webhook — limit went from 1000 to 50000."

## 4. Forged webhook, then a real replay (~1 min)

```powershell
curl.exe -i -X POST http://localhost:3000/webhooks/stripe -H "Content-Type: application/json" -H "Stripe-Signature: t=1,v1=fake" -d "{}"
```

**Say out loud:** "400 — forged signature, rejected before it touches
any business logic."

Then replay a REAL event from this session (copy an event id from the
Stripe CLI output, e.g. the checkout.session.completed from step 3):

```powershell
stripe events resend <evt_id_from_step_3>
```

```powershell
docker compose exec db psql -U postgres -d billing -c "SELECT id, processed_at FROM stripe_events WHERE id = '<evt_id_from_step_3>';"
```

**Say out loud:** "Still exactly one row — the replay was recognized
and ignored, not reprocessed."

## 5. Finish on usage + cost (~1 min)

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/usage?tenantId=$tenantId"
```

Then show the pricing tests green on screen:

```powershell
docker compose exec app npm test
```

**Say out loud:** "Used, limit, and cost — all adding up exactly, and
the pricing math is pinned and tested, not eyeballed."

## Closing line

**"Usage, money, and customer access stay correct under retries,
failures, and real-world conditions."**

---

## Rehearsal checklist

- [ ] First run-through complete, timed
- [ ] Second run-through complete, timed
- [ ] `stripe listen` confirmed running with a FRESH `whsec_` before
      the real demo (restart it and update `.env` right before)
- [ ] A real `evt_...` id from THIS session copied and ready for the
      replay step (old event ids from previous sessions still work for
      `stripe events resend`, but a fresh one is more convincing live)
- [ ] Screen font size large enough to read from the back of the room
