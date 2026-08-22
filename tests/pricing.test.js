const test = require("node:test");
const assert = require("node:assert");
const { calculateApiCallCostCents, calculateAiTokenCostCents } = require("../src/pricing");

test("api call cost: 1000 calls at 0.1 cents each = 100 cents", () => {
  assert.strictEqual(calculateApiCallCostCents(1000), 100);
});

test("api call cost: 0 calls = 0 cents", () => {
  assert.strictEqual(calculateApiCallCostCents(0), 0);
});

test("ai token cost: cached input is exactly half price of regular input", () => {
  const regular = calculateAiTokenCostCents({ inputTokens: 1_000_000 });
  const cached = calculateAiTokenCostCents({ cachedInputTokens: 1_000_000 });
  assert.strictEqual(regular, 15);
  assert.strictEqual(cached, 8); // 7.5 rounds to 8
});

test("ai token cost: reasoning tokens bill at the SAME rate as output tokens", () => {
  const withReasoning = calculateAiTokenCostCents({ reasoningTokens: 1_000_000 });
  const withOutput = calculateAiTokenCostCents({ outputTokens: 1_000_000 });
  assert.strictEqual(withReasoning, withOutput);
  assert.strictEqual(withReasoning, 60);
});

test("ai token cost: categories are not simply additive — each has its own rate", () => {
  const cost = calculateAiTokenCostCents({
    inputTokens: 500_000,
    cachedInputTokens: 500_000,
    outputTokens: 100_000,
    reasoningTokens: 50_000,
  });
  // input:    500,000/1e6 * 15   = 7.5
  // cached:   500,000/1e6 * 7.5  = 3.75
  // output+reasoning: 150,000/1e6 * 60 = 9
  // total = 20.25 -> rounds to 20
  assert.strictEqual(cost, 20);
});

test("ai token cost: no metadata at all prices as 0, never throws", () => {
  assert.strictEqual(calculateAiTokenCostCents(undefined), 0);
  assert.strictEqual(calculateAiTokenCostCents(null), 0);
  assert.strictEqual(calculateAiTokenCostCents({}), 0);
});
