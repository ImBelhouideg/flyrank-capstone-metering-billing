const pool = require("../db");

async function findByIdempotencyKey(tenantId, idempotencyKey) {
  const { rows } = await pool.query(
    `SELECT * FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2`,
    [tenantId, idempotencyKey]
  );
  return rows[0] || null;
}

async function getEventsThisMonth(tenantId, usageType) {
  const { rows } = await pool.query(
    `SELECT * FROM usage_events
     WHERE tenant_id = $1 AND usage_type = $2
       AND created_at >= date_trunc('month', now())`,
    [tenantId, usageType]
  );
  return rows;
}

async function getUsageTotalThisMonth(tenantId, usageType) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM usage_events
     WHERE tenant_id = $1 AND usage_type = $2
       AND created_at >= date_trunc('month', now())`,
    [tenantId, usageType]
  );
  return parseInt(rows[0].total, 10);
}

module.exports = { findByIdempotencyKey, getEventsThisMonth, getUsageTotalThisMonth };
