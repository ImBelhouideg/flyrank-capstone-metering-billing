const Stripe = require("stripe");
const tenantRepository = require("../repositories/tenantRepository");
const stripeEventRepository = require("../repositories/stripeEventRepository");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession(tenantId) {
  const tenant = await tenantRepository.getTenantWithPlan(tenantId);
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  // Stripe needs a Customer to attach a subscription to. Create one on
  // the first checkout, reuse it afterward — keeps tenants and Stripe
  // customers in a 1:1 relationship.
  let stripeCustomerId = tenant.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    });
    stripeCustomerId = customer.id;
    await tenantRepository.updatePlanAndStatus(tenant.id, { stripeCustomerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: process.env.CHECKOUT_SUCCESS_URL,
    cancel_url: process.env.CHECKOUT_CANCEL_URL,
    // Carried through to the checkout.session.completed webhook, so the
    // handler knows which tenant this session belongs to.
    metadata: { tenantId: tenant.id },
  });

  return { checkoutUrl: session.url, sessionId: session.id };
}

// Throws if the signature is invalid — the route layer catches this and
// returns 400. Never trust a webhook body without this check first.
function verifyAndConstructEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

async function applyWebhookEvent(event) {
  const isNew = await stripeEventRepository.markProcessed(event);
  if (!isNew) {
    // Replayed event — acknowledge, do nothing. Stripe retries until it
    // sees a 2xx, so silently ignoring a duplicate is correct, not lazy.
    return { applied: false, reason: "duplicate event, already processed" };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const tenantId = session.metadata?.tenantId;
      if (tenantId) {
        await tenantRepository.updatePlanAndStatus(tenantId, {
          plan: "pro",
          subscriptionStatus: "active",
          stripeSubscriptionId: session.subscription,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const tenant = await tenantRepository.findByStripeCustomerId(subscription.customer);
      if (tenant) {
        const status =
          subscription.status === "active"
            ? "active"
            : subscription.status === "past_due"
            ? "past_due"
            : "canceled";
        await tenantRepository.updatePlanAndStatus(tenant.id, { subscriptionStatus: status });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const tenant = await tenantRepository.findByStripeCustomerId(subscription.customer);
      if (tenant) {
        await tenantRepository.updatePlanAndStatus(tenant.id, {
          plan: "free",
          subscriptionStatus: "canceled",
        });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged (200) and ignored — not
      // an error, just nothing this system needs to react to.
      break;
  }

  return { applied: true, type: event.type };
}

module.exports = { createCheckoutSession, verifyAndConstructEvent, applyWebhookEvent };