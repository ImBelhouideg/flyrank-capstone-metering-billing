# Usage Metering & Billing Engine

A backend service that answers the three questions every SaaS product
needs answered: how much has this customer used, what does it cost, and
have they hit their limit? Built with idempotent metering, quota
enforcement, correct money math, and Stripe test-mode subscriptions.

**Status: Phase 1 (design) in progress.** This README will be filled in
fully as each phase completes — see `DESIGN.md` for the current design.

## Architecture

```
Client ─► POST /generate
  └─► MeterService.record(tenant, type, qty, idempotencyKey)
      ├─ duplicate key? → return original result (no new event)
      ├─ store usage_event
      └─► Quota Check ─► allowed
          └─► limit exceeded → 402 / 429 + clear message

GET /usage ◄── rollup(usage_events) → { used, limit, cost }

Stripe Checkout (test mode) ─► subscription created
Stripe ─signed webhook─► /webhooks/stripe
  ├─► verify signature (forged → 400)
  ├─► deduplicate event (replay → ignored)
  └─► update tenant plan / status
```

See [`DESIGN.md`](./DESIGN.md) for the full data model, API surface, and
layer sketch.

## Run it

```bash
docker compose up --build
```

Seed demo data:
```bash
docker compose exec app node scripts/seed.js
```

Run tests:
```bash
npm test
```

## Environment variables

See [`.env.example`](./.env.example) for every variable needed —
copy it to `.env` and fill in real values (a free Stripe test-mode
account, no card required).

## Limitations

<!-- Filled in honestly as the build progresses. -->

## License

MIT — see [`LICENSE`](./LICENSE).
