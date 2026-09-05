import { Router, Request, Response } from "express";
import {
  generateEmailContent,
  suggestSubjects,
  improveEmailDraft,
  cleanRecipientsAi,
} from "../services/aiService";

const router = Router();

// GET /api/ai/status
router.get("/status", (_req: Request, res: Response) => {
  const configured = Boolean(process.env.GROQ_API_KEY);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  res.json({ configured, model });
});

// POST /api/ai/generate-email
router.post("/generate-email", async (req: Request, res: Response) => {
  const { topic, tone, audience, callToAction, senderName, recipientName } = req.body;
  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "Topic/Objective is required" });
  }

  try {
    const result = await generateEmailContent({
      topic,
      tone,
      audience,
      callToAction,
      senderName,
      recipientName,
    });
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/ai/suggest-subjects
router.post("/suggest-subjects", async (req: Request, res: Response) => {
  const { topic, body, count } = req.body;
  if (!topic && !body) {
    return res.status(400).json({ error: "Either topic or body is required" });
  }

  try {
    const suggestions = await suggestSubjects({
      topic: topic || "Outreach Campaign",
      body,
      count: Number(count) || 3,
    });
    res.json({ success: true, data: suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/ai/improve-draft
router.post("/improve-draft", async (req: Request, res: Response) => {
  const { body, instruction } = req.body;
  if (!body || !instruction) {
    return res.status(400).json({ error: "Both body and instruction are required" });
  }

  try {
    const improved = await improveEmailDraft({ body, instruction });
    res.json({ success: true, data: improved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/ai/clean-recipients
router.post("/clean-recipients", async (req: Request, res: Response) => {
  const { rawText } = req.body;
  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ error: "rawText is required" });
  }

  try {
    const cleaned = await cleanRecipientsAi(rawText);
    res.json({ success: true, data: cleaned });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
