const express = require("express");
const usageService = require("../services/usageService");

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/usage", async (req, res) => {
  const { tenantId } = req.query;

  if (!tenantId || !UUID_REGEX.test(tenantId)) {
    return res.status(400).json({ error: "tenantId query parameter is required and must be a UUID" });
  }

  try {
    const summary = await usageService.rollup(tenantId);
    if (!summary) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    return res.status(200).json(summary);
  } catch (err) {
    console.error("GET /usage failed:", err);
    return res.status(500).json({ error: "Internal error computing usage" });
  }
});

module.exports = router;
