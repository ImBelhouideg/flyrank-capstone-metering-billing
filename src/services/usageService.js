const tenantRepository = require("../repositories/tenantRepository");
const usageEventRepository = require("../repositories/usageEventRepository");
const { calculateApiCallCostCents, calculateAiTokenCostCents } = require("../pricing");

async function rollup(tenantId) {
  const tenant = await tenantRepository.getTenantWithPlan(tenantId);
  if (!tenant) return null;

  const apiCallEvents = await usageEventRepository.getEventsThisMonth(tenantId, "api_call");
  const aiTokenEvents = await usageEventRepository.getEventsThisMonth(tenantId, "ai_tokens");

  const apiCallsUsed = apiCallEvents.reduce((sum, e) => sum + e.quantity, 0);
  const aiTokensUsed = aiTokenEvents.reduce((sum, e) => sum + e.quantity, 0);

  const apiCallCostCents = calculateApiCallCostCents(apiCallsUsed);
  // Each ai_tokens event carries its own input/cached/output/reasoning
  // breakdown in metadata, so cost is summed per-event, not derived from
  // the total token count alone (categories price differently).
  const aiTokenCostCents = aiTokenEvents.reduce(
    (sum, e) => sum + calculateAiTokenCostCents(e.metadata),
    0
  );

  return {
    plan: tenant.plan,
    subscriptionStatus: tenant.subscription_status,
    apiCalls: { used: apiCallsUsed, limit: tenant.api_calls_limit },
    aiTokens: { used: aiTokensUsed, limit: tenant.ai_tokens_limit },
    costCents: apiCallCostCents + aiTokenCostCents,
  };
}

module.exports = { rollup };
