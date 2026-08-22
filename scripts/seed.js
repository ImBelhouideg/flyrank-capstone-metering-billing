require("dotenv").config();
const pool = require("../src/db");

async function seed() {
  const { rows } = await pool.query(
    `INSERT INTO tenants (name, plan, subscription_status)
     VALUES ('Demo Tenant', 'free', 'active')
     RETURNING id, name, plan`
  );
  const tenant = rows[0];
  console.log("Seeded tenant:", tenant);
  console.log(`\nTry it:\ncurl -X POST http://localhost:3000/generate -H "Content-Type: application/json" -d '{"tenantId":"${tenant.id}","usageType":"api_call","quantity":1,"idempotencyKey":"seed-test-1"}'`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
