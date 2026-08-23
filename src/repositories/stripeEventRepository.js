const pool = require("../db");

// Attempts to record this Stripe event id as processed. Returns true if
// this is genuinely new (insert succeeded), false if it's a duplicate
// (the id already exists — Stripe replayed an event we already handled).
// stripe_events.id is the primary key, so this is the same
// insert-or-detect-conflict pattern as usage_events' idempotency key,
// applied to webhooks instead of billable actions.
async function markProcessed(event) {
  const { rows } = await pool.query(
    `INSERT INTO stripe_events (id, type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [event.id, event.type, JSON.stringify(event)]
  );
  return rows.length > 0; // true = newly inserted, false = duplicate
}

module.exports = { markProcessed };