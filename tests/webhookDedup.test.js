require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert");
const pool = require("../src/db");
const stripeEventRepository = require("../src/repositories/stripeEventRepository");
const billingService = require("../src/services/billingService");

test("webhook dedup: the same event id processed twice is only recorded once", async () => {
  const fakeEvent = {
    id: `evt_test_${Date.now()}`,
    type: "checkout.session.completed",
    data: { object: {} },
  };

  const first = await stripeEventRepository.markProcessed(fakeEvent);
  const second = await stripeEventRepository.markProcessed(fakeEvent);

  assert.strictEqual(first, true, "the first delivery must be recognized as new");
  assert.strictEqual(second, false, "the second delivery of the SAME event id must be recognized as a duplicate");

  const { rows } = await pool.query(`SELECT COUNT(*) FROM stripe_events WHERE id = $1`, [fakeEvent.id]);
  assert.strictEqual(parseInt(rows[0].count, 10), 1, "exactly one row must exist, not two");
});

test("invalid webhook signature is rejected before any processing happens", () => {
  assert.throws(
    () => {
      billingService.verifyAndConstructEvent(Buffer.from("{}"), "t=1,v1=not-a-real-signature");
    },
    undefined,
    "a forged/invalid signature must throw, never silently succeed"
  );
});

test.after(async () => {
  await pool.end();
});
