const pool = require("../db");

async function getTenantWithPlan(tenantId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.plan, t.subscription_status,
            t.stripe_customer_id, t.stripe_subscription_id,
            p.api_calls_limit, p.ai_tokens_limit
     FROM tenants t
     JOIN plans p ON p.id = t.plan
     WHERE t.id = $1`,
    [tenantId]
  );
  return rows[0] || null;
}

async function updatePlanAndStatus(tenantId, { plan, subscriptionStatus, stripeSubscriptionId }) {
  const { rows } = await pool.query(
    `UPDATE tenants
     SET plan = COALESCE($2, plan),
         subscription_status = COALESCE($3, subscription_status),
         stripe_subscription_id = COALESCE($4, stripe_subscription_id)
     WHERE id = $1
     RETURNING *`,
    [tenantId, plan || null, subscriptionStatus || null, stripeSubscriptionId || null]
  );
  return rows[0] || null;
}

async function findByStripeCustomerId(stripeCustomerId) {
  const { rows } = await pool.query(`SELECT * FROM tenants WHERE stripe_customer_id = $1`, [
    stripeCustomerId,
  ]);
  return rows[0] || null;
}

module.exports = { getTenantWithPlan, updatePlanAndStatus, findByStripeCustomerId };
