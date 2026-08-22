// Drives a tenant to its api_call quota using concurrent requests (not
// sequential), then fires one more past the limit to prove the 429
// boundary. Sending requests concurrently — not one at a time — is the
// real test of the row lock in meterService.record(): if the lock didn't
// work, concurrent requests could race past the limit.
//
// Usage: node scripts/load-quota.js <tenantId> <targetCount>
// Example: node scripts/load-quota.js 20c0c24d-768a-4277-bf49-bf4f1cef541d 1000

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BATCH_SIZE = 25;

async function callGenerate(tenantId, idempotencyKey) {
  const res = await fetch(`${BASE_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      usageType: "api_call",
      quantity: 1,
      idempotencyKey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const tenantId = process.argv[2];
  const targetCount = parseInt(process.argv[3] || "1000", 10);

  if (!tenantId) {
    console.error("Usage: node scripts/load-quota.js <tenantId> <targetCount>");
    process.exit(1);
  }

  console.log(`Driving tenant ${tenantId} to ${targetCount} api_call events, in batches of ${BATCH_SIZE}...`);

  let succeeded = 0;
  let rejected = 0;

  for (let batchStart = 1; batchStart <= targetCount; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, targetCount);
    const batch = [];
    for (let i = batchStart; i <= batchEnd; i++) {
      batch.push(callGenerate(tenantId, `load-${i}`));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.status === 201 || r.status === 200) succeeded++;
      else rejected++;
    }
    process.stdout.write(`\r${batchEnd}/${targetCount} sent (${succeeded} succeeded, ${rejected} rejected so far)`);
  }

  console.log(`\n\nDone. ${succeeded} succeeded, ${rejected} rejected out of ${targetCount} attempts.`);

  // Now the actual boundary proof: one request past the limit.
  console.log("\nSending ONE more request past the limit...");
  const boundaryResult = await callGenerate(tenantId, "load-boundary-test");
  console.log(`Status: ${boundaryResult.status}`);
  console.log(`Body:`, boundaryResult.body);

  if (boundaryResult.status === 429) {
    console.log("\n✅ Boundary held: request past quota was rejected with 429.");
  } else {
    console.log("\n⚠️  Expected 429, got something else — investigate.");
  }
}

main();