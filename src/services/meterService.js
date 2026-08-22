const pool = require("../db");

// This function does three things inside ONE transaction, in this order:
//   1. Lock the tenant row (SELECT ... FOR UPDATE) — this is what makes
//      the quota check safe under concurrency. Without it, two
//      near-simultaneous requests with DIFFERENT idempotency keys could
//      both read "under quota" and both insert, overshooting the limit.
//      With the lock, the second request waits for the first to commit
//      or roll back before it can even read the current usage total.
//   2. Check idempotency FIRST: if this exact (tenant, idempotencyKey)
//      pair was already recorded, return the original result — no new
//      event, no quota re-check, no double charge.
//   3. Only for a genuinely new key: check quota, then insert.
//
// Returns a plain result object; never throws for a business-rule
// rejection (quota exceeded, bad subscription status) — only for a
// genuine infrastructure failure, which the caller should 500 on.
async function record(tenantId, { usageType, quantity, idempotencyKey, metadata }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tenantResult = await client.query(
      `SELECT t.id, t.plan, t.subscription_status,
              p.api_calls_limit, p.ai_tokens_limit
       FROM tenants t
       JOIN plans p ON p.id = t.plan
       WHERE t.id = $1
       FOR UPDATE`,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, error: "Tenant not found" };
    }

    const tenant = tenantResult.rows[0];

    // Idempotency check — before anything else touches quota logic.
    const existing = await client.query(
      `SELECT * FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2`,
      [tenantId, idempotencyKey]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return { success: true, duplicate: true, status: 200, event: existing.rows[0] };
    }

    // 402: the subscription itself doesn't allow usage right now
    // (payment required), independent of how much quota is left.
    if (tenant.subscription_status !== "active") {
      await client.query("ROLLBACK");
      return {
        success: false,
        status: 402,
        error: `Subscription status is '${tenant.subscription_status}' — payment required to continue.`,
      };
    }

    const usageResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total
       FROM usage_events
       WHERE tenant_id = $1 AND usage_type = $2
         AND created_at >= date_trunc('month', now())`,
      [tenantId, usageType]
    );
    const currentUsage = parseInt(usageResult.rows[0].total, 10);
    const limit = usageType === "api_call" ? tenant.api_calls_limit : tenant.ai_tokens_limit;

    // 429: quota exceeded for this billing period, subscription is fine.
    if (currentUsage + quantity > limit) {
      await client.query("ROLLBACK");
      return {
        success: false,
        status: 429,
        error: `Quota exceeded: ${usageType} limit is ${limit}, current usage is ${currentUsage}, this request needs ${quantity} more.`,
      };
    }

    const insertResult = await client.query(
      `INSERT INTO usage_events (tenant_id, idempotency_key, usage_type, quantity, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, idempotencyKey, usageType, quantity, metadata ? JSON.stringify(metadata) : null]
    );

    await client.query("COMMIT");
    return { success: true, duplicate: false, status: 201, event: insertResult.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { record };
