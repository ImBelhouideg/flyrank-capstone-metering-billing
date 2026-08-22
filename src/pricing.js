// Pinned pricing constants. Money is always an integer number of cents —
// never a float, anywhere past this file's boundary.
//
// AI token pricing encodes three real-world rules (per the brief):
//   1. Cached input tokens are cheaper than fresh input tokens.
//   2. Reasoning tokens are billed at the OUTPUT rate, not a separate
//      "reasoning" rate — they are not a third category of their own.
//   3. Token categories cannot simply be added together and priced once —
//      each category has its own rate.
const PRICING = {
  api_call: {
    centsPerCall: 0.1, // $0.001 per API call
  },
  ai_tokens: {
    centsPerInputTokenPerMillion: 15, // $0.15 / 1M input tokens
    centsPerCachedInputTokenPerMillion: 7.5, // cached input: half price
    centsPerOutputTokenPerMillion: 60, // $0.60 / 1M output tokens
  },
};

function calculateApiCallCostCents(quantity) {
  return Math.round(quantity * PRICING.api_call.centsPerCall);
}

// metadata: { inputTokens, cachedInputTokens, outputTokens, reasoningTokens }
// Every field is optional and defaults to 0, so a plain api_call-style
// event (no metadata) safely prices as 0 through this function too.
function calculateAiTokenCostCents(metadata) {
  const {
    inputTokens = 0,
    cachedInputTokens = 0,
    outputTokens = 0,
    reasoningTokens = 0,
  } = metadata || {};

  const inputCost = (inputTokens / 1_000_000) * PRICING.ai_tokens.centsPerInputTokenPerMillion;
  const cachedInputCost =
    (cachedInputTokens / 1_000_000) * PRICING.ai_tokens.centsPerCachedInputTokenPerMillion;
  // Reasoning tokens are billed as output tokens — not a separate rate.
  const outputCost =
    ((outputTokens + reasoningTokens) / 1_000_000) * PRICING.ai_tokens.centsPerOutputTokenPerMillion;

  return Math.round(inputCost + cachedInputCost + outputCost);
}

module.exports = { PRICING, calculateApiCallCostCents, calculateAiTokenCostCents };
