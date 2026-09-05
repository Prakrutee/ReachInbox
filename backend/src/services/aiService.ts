import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Groq({ apiKey });
}

const PRIMARY_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

async function runGroqChat(messages: Groq.Chat.ChatCompletionMessageParam[], temperature = 0.7): Promise<string> {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured in backend environment");
  }

  try {
    const res = await client.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      temperature,
    });
    return res.choices[0]?.message?.content || "";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`Groq primary model (${PRIMARY_MODEL}) error:`, errMsg);
    const res = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages,
      temperature,
    });
    return res.choices[0]?.message?.content || "";
  }
}

export interface GenerateEmailOptions {
  topic: string;
  tone?: "professional" | "friendly" | "persuasive" | "direct" | "follow-up";
  audience?: string;
  callToAction?: string;
  senderName?: string;
  recipientName?: string;
}

export interface GenerateEmailResult {
  subject: string;
  body: string;
}

export async function generateEmailContent(opts: GenerateEmailOptions): Promise<GenerateEmailResult> {
  const tone = opts.tone || "professional";
  const prompt = [
    "You are an elite B2B email copywriter specializing in high-converting cold outreach and personalized campaigns.",
    "Generate a high-converting, realistic email for outreach.",
    `Topic/Objective: ${opts.topic}`,
    `Tone: ${tone}`,
    opts.audience ? `Target Audience: ${opts.audience}` : "",
    opts.callToAction ? `Call to Action: ${opts.callToAction}` : "",
    opts.senderName ? `Sender Name: ${opts.senderName}` : "",
    opts.recipientName ? `Recipient Name: ${opts.recipientName}` : "",
    "",
    "Rules:",
    "1. Subject line must be punchy, compelling, under 60 characters, no spammy buzzwords.",
    "2. Email body should be formatted into clean, concise paragraphs.",
    "3. Output STRICT JSON only, matching this structure:",
    "{",
    '  "subject": "Compelling subject line",',
    '  "body": "The email body text"',
    "}",
    "Do not include any explanation or markdown ticks outside the JSON."
  ].filter(Boolean).join("\n");

  const text = await runGroqChat([
    { role: "system", content: "You are an AI assistant that outputs only valid JSON." },
    { role: "user", content: prompt }
  ], 0.7);

  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      subject: parsed.subject || "Quick question for you",
      body: parsed.body || text,
    };
  } catch {
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const subjectLine = lines[0]?.replace(/^Subject:\s*/i, "") || "Quick question";
    const bodyLines = lines.slice(1).join("\n");
    return {
      subject: subjectLine,
      body: bodyLines || text,
    };
  }
}

export async function suggestSubjects(opts: { topic: string; body?: string; count?: number }): Promise<string[]> {
  const count = opts.count || 3;
  const prompt = [
    `Generate ${count} distinct, catchy, high-open-rate email subject lines for outreach.`,
    `Topic: ${opts.topic}`,
    opts.body ? `Email Body Preview: ${opts.body.slice(0, 300)}...` : "",
    "",
    "Requirements:",
    "- Vary between curiosity-driven, benefit-focused, and casual short style.",
    "- Each subject line should be under 55 characters.",
    '- Return ONLY a JSON array of strings, e.g. ["Subject 1", "Subject 2", "Subject 3"]',
    "No markdown wrappers, no numbering."
  ].filter(Boolean).join("\n");

  const text = await runGroqChat([
    { role: "system", content: "You are an AI assistant that outputs only a JSON array of strings." },
    { role: "user", content: prompt }
  ], 0.8);

  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((s: unknown) => String(s).trim());
    }
  } catch {}

  return text
    .split("\n")
    .map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^[-*]\s*/, "").replace(/^"|"$/g, "").trim())
    .filter(l => l.length > 0 && l.length < 100)
    .slice(0, count);
}

export async function improveEmailDraft(opts: { body: string; instruction: string }): Promise<string> {
  const prompt = [
    "You are an expert email editor. Rewrite and polish the following email draft according to the instruction:",
    `Instruction: ${opts.instruction}`,
    "",
    "Original Email Draft:",
    opts.body,
    "",
    "Requirements:",
    "- Return ONLY the revised email body content.",
    "- Keep formatting clean.",
    "- No preamble or post-amble explanations."
  ].join("\n");

  const text = await runGroqChat([
    { role: "system", content: "You are an expert email copy editor. Output only the improved email text." },
    { role: "user", content: prompt }
  ], 0.6);

  return text.trim();
}

export async function cleanRecipientsAi(rawText: string): Promise<{
  valid: Array<{ email: string; name?: string }>;
  invalid: string[];
}> {
  const prompt = [
    "Parse and extract email contacts from the messy text below.",
    "Clean up common typos (e.g. gmial.com -> gmail.com, yaho.com -> yahoo.com).",
    "Extract full name or first name if present.",
    "Identify invalid emails.",
    "",
    "Messy Input:",
    rawText.slice(0, 3000),
    "",
    "Respond with STRICT JSON only in this format:",
    "{",
    '  "valid": [',
    '    { "email": "user@domain.com", "name": "John Doe" }',
    "  ],",
    '  "invalid": [',
    '    "bad-entry@xyz"',
    "  ]",
    "}"
  ].join("\n");

  const text = await runGroqChat([
    { role: "system", content: "You are a data parsing assistant that returns strict JSON." },
    { role: "user", content: prompt }
  ], 0.2);

  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      valid: Array.isArray(parsed.valid) ? parsed.valid : [],
      invalid: Array.isArray(parsed.invalid) ? parsed.invalid : [],
    };
  } catch {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawText.match(emailRegex) || [];
    const unique = Array.from(new Set(matches));
    return {
      valid: unique.map(e => ({ email: e })),
      invalid: [],
    };
  }
}
