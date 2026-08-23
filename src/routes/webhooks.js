const express = require("express");
const billingService = require("../services/billingService");

const router = express.Router();

// IMPORTANT: this route needs the RAW request body (a Buffer), not
// JSON-parsed, because Stripe computes the signature over the exact raw
// bytes it sent. If the global express.json() middleware parses this
// body first, signature verification will always fail. That's why
// express.raw() is scoped to just this route, and why this router must
// be mounted in app.js BEFORE app.use(express.json()) — see app.js.
router.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = billingService.verifyAndConstructEvent(req.body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    const result = await billingService.applyWebhookEvent(event);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Webhook processing failed:", err);
    // A genuine processing failure (e.g. DB down) gets a non-2xx on
    // purpose — that's the signal that tells Stripe to retry this event
    // later, rather than silently losing it.
    return res.status(500).json({ error: "Internal error processing webhook" });
  }
});

module.exports = router;