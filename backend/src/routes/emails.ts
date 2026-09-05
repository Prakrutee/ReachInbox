import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import isEmail from "validator/lib/isEmail";
import { scheduleEmail, scheduleBulk, getScheduledEmails, getSentEmails } from "../services/emailService";
import { searchEmails } from "../config/elasticsearch";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/emails/scheduled
router.get("/scheduled", async (_req, res) => {
  try {
    const emails = await getScheduledEmails();
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/emails/sent
router.get("/sent", async (_req, res) => {
  try {
    const emails = await getSentEmails();
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/emails/search?q=
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "");
  if (!q) return res.json([]);
  try {
    const results = await searchEmails(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/emails/schedule  (multipart/form-data)
router.post("/schedule", upload.single("file"), async (req, res) => {
  try {
    const { subject, body, sender, startAt, delayBetweenMs } = req.body as {
      subject: string;
      body: string;
      sender: string;
      startAt: string;
      delayBetweenMs?: string;
    };

    if (!subject || !body || !sender) {
      return res.status(400).json({ error: "subject, body, and sender are required" });
    }
    if (!isEmail(sender)) {
      return res.status(400).json({ error: "Invalid sender email" });
    }

    const scheduledAt = startAt ? new Date(startAt) : new Date(Date.now() + 5000);
    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: "Invalid startAt date" });
    }

    const delay = Number(delayBetweenMs || 2000);

    // Parse recipients from file or body
    let allRecipients: string[] = [];

    if (req.file) {
      const content = req.file.buffer.toString("utf-8");
      try {
        // Try CSV
        const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
        if (records.length > 0 && "email" in records[0]) {
          allRecipients = records.map((r: Record<string, string>) => r.email);
        } else {
          // Bare list
          allRecipients = content.split(/[\r\n,]+/).map((e: string) => e.trim()).filter(Boolean);
        }
      } catch {
        // Plain list
        allRecipients = content.split(/[\r\n,]+/).map((e: string) => e.trim()).filter(Boolean);
      }
    } else if (req.body.recipients || req.body.recipient) {
      const field = req.body.recipients || req.body.recipient;
      const raw = Array.isArray(field) ? field : [field];
      allRecipients = raw.flatMap((r: string) => r.split(",").map((e: string) => e.trim()));
    }

    const valid = allRecipients.filter((r) => isEmail(r));
    const invalid = allRecipients.filter((r) => !isEmail(r));

    if (valid.length === 0) {
      return res.status(400).json({ error: "No valid recipients found", invalid });
    }

    const result = await scheduleBulk({
      recipients: valid,
      subject,
      body,
      sender,
      startAt: scheduledAt,
      delayBetweenMs: delay,
    });

    res.json({ ...result, total: allRecipients.length, invalid });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
