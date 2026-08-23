const express = require("express");
const { z } = require("zod");
const billingService = require("../services/billingService");

const router = express.Router();

const CheckoutInputSchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID"),
});

router.post("/billing/checkout", async (req, res) => {
  const parsed = CheckoutInputSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
  }

  try {
    const { checkoutUrl, sessionId } = await billingService.createCheckoutSession(parsed.data.tenantId);
    return res.status(200).json({ checkoutUrl, sessionId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("POST /billing/checkout failed:", err);
    return res.status(500).json({ error: "Internal error creating checkout session" });
  }
});

// Simple landing routes for the Checkout redirect - not required by the
// brief, just makes the demo flow land somewhere readable.
router.get("/billing/success", (req, res) => {
  res.json({ message: "Checkout complete. The tenant's plan will update once the webhook arrives." });
});

router.get("/billing/cancel", (req, res) => {
  res.json({ message: "Checkout was canceled. No changes were made." });
});

module.exports = router;