// Creates a demo-ready tenant: Free plan, already at 997/1000 api_calls,
// so the quota boundary is reachable with just 3 live calls during the
// demo instead of needing 1000 real requests on stage.
//
// Run with: docker compose exec app node scripts/seed-demo.js

require("dotenv").config();
const pool = require("../src/db");

async function seedDemo() {
  const { rows } = await pool.query(
    `INSERT INTO tenants (name, plan, subscription_status)
     VALUES ('Demo Tenant (near quota)', 'free', 'active')
     RETURNING id, name, plan`
  );
  const tenant = rows[0];

  // Pre-load 997 usage events directly (bypassing the API on purpose —
  // this is demo setup, not something we're demonstrating). Each has
  // its own idempotency key since the constraint requires uniqueness.
  const values = [];
  const params = [];
  let paramIndex = 1;
  for (let i = 1; i <= 997; i++) {
    values.push(`($${paramIndex++}, $${paramIndex++}, 'api_call', 1)`);
    params.push(tenant.id, `demo-preload-${i}`);
  }
  await pool.query(
    `INSERT INTO usage_events (tenant_id, idempotency_key, usage_type, quantity)
     VALUES ${values.join(", ")}`,
    params
  );

  console.log("Demo tenant ready:");
  console.log(`  tenantId: ${tenant.id}`);
  console.log(`  plan: ${tenant.plan}`);
  console.log(`  api_calls used: 997 / 1000 (3 more calls to hit the boundary)`);
  console.log("");
  console.log("Demo script uses this tenantId — see DEMO.md");

  await pool.end();
}

seedDemo().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
