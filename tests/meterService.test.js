require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const pool = require("../src/db");
const meterService = require("../src/services/meterService");

async function createTenant(plan, subscriptionStatus = "active") {
  const { rows } = await pool.query(
    `INSERT INTO tenants (name, plan, subscription_status) VALUES ($1, $2, $3) RETURNING *`,
    [`test-${Date.now()}-${Math.random().toString(36).slice(2)}`, plan, subscriptionStatus]
  );
  return rows[0];
}

test("idempotency: same key called twice returns the same event, only one row stored", async () => {
  const tenant = await createTenant("free");
  const key = `idem-${Date.now()}`;

  const first = await meterService.record(tenant.id, {
    usageType: "api_call",
    quantity: 1,
    idempotencyKey: key,
  });
  const second = await meterService.record(tenant.id, {
    usageType: "api_call",
    quantity: 1,
    idempotencyKey: key,
  });

  assert.strictEqual(first.event.id, second.event.id, "both calls must return the SAME event id");
  assert.strictEqual(second.duplicate, true, "second call must be flagged as a duplicate");

  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2`,
    [tenant.id, key]
  );
  assert.strictEqual(parseInt(rows[0].count, 10), 1, "exactly one row must exist for this key, not two");
});

test("quota boundary: exactly at the limit succeeds, one more is rejected with 429", async () => {
  // A throwaway plan with a tiny limit, so this test runs in milliseconds
  // instead of needing 1000 real requests like the manual load test did.
  await pool.query(
    `INSERT INTO plans (id, api_calls_limit, ai_tokens_limit) VALUES ('test-tiny', 3, 1000)
     ON CONFLICT (id) DO NOTHING`
  );
  const tenant = await createTenant("test-tiny");

  for (let i = 1; i <= 3; i++) {
    const result = await meterService.record(tenant.id, {
      usageType: "api_call",
      quantity: 1,
      idempotencyKey: `boundary-${tenant.id}-${i}`,
    });
    assert.strictEqual(result.success, true, `call ${i} of 3 (at or under the limit) should succeed`);
  }

  const overLimit = await meterService.record(tenant.id, {
    usageType: "api_call",
    quantity: 1,
    idempotencyKey: `boundary-${tenant.id}-4`,
  });
  assert.strictEqual(overLimit.success, false, "the 4th call, over a limit of 3, must be rejected");
  assert.strictEqual(overLimit.status, 429, "over-quota must be 429, not some other status");
});

test("subscription status: past_due returns 402, not 429", async () => {
  const tenant = await createTenant("free", "past_due");

  const result = await meterService.record(tenant.id, {
    usageType: "api_call",
    quantity: 1,
    idempotencyKey: `status-${tenant.id}`,
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 402, "a bad subscription status must be 402, distinct from quota's 429");
});

test("unknown tenant returns 404, does not crash", async () => {
  const result = await meterService.record("00000000-0000-0000-0000-000000000000", {
    usageType: "api_call",
    quantity: 1,
    idempotencyKey: "nonexistent-tenant-test",
  });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 404);
});

test.after(async () => {
  await pool.end();
});
