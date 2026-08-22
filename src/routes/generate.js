const express = require("express");
const { z } = require("zod");
const meterService = require("../services/meterService");

const router = express.Router();

const GenerateInputSchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID"),
  usageType: z.enum(["api_call", "ai_tokens"], {
    errorMap: () => ({ message: "usageType must be 'api_call' or 'ai_tokens'" }),
  }),
  quantity: z.number().int().positive("quantity must be a positive integer"),
  idempotencyKey: z.string().min(1, "idempotencyKey is required"),
  metadata: z
    .object({
      inputTokens: z.number().int().nonnegative().optional(),
      cachedInputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
      reasoningTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

router.post("/generate", async (req, res) => {
  const parsed = GenerateInputSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
  }

  try {
    const result = await meterService.record(parsed.data.tenantId, parsed.data);
    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(result.status).json({ event: result.event, duplicate: result.duplicate });
  } catch (err) {
    console.error("POST /generate failed:", err);
    return res.status(500).json({ error: "Internal error recording usage" });
  }
});

module.exports = router;
