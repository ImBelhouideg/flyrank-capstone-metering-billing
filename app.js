require("dotenv").config();
const express = require("express");

const webhookRouter = require("./src/routes/webhooks");
const generateRouter = require("./src/routes/generate");
const usageRouter = require("./src/routes/usage");
const billingRouter = require("./src/routes/billing");

const app = express();

// CRITICAL ORDER: the webhook router must be mounted BEFORE the global
// express.json() middleware. Its route uses express.raw() to get the
// exact raw bytes Stripe signed - if express.json() ran first, the body
// would already be parsed into an object and signature verification
// would always fail. Every other route matches nothing in webhookRouter
// and falls through to express.json() normally.
app.use(webhookRouter);

app.use(express.json());

app.use(generateRouter);
app.use(usageRouter);
app.use(billingRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Basic error handler as a last resort net.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
