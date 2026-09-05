import { Router, Request, Response } from "express";
import pool from "../config/database";
import https from "https";
import dotenv from "dotenv";
dotenv.config();

const router = Router();

// GET /auth/slack
router.get("/", (req: Request, res: Response) => {
  const { SLACK_CLIENT_ID, SLACK_REDIRECT_URI } = process.env;
  if (!SLACK_CLIENT_ID || !SLACK_REDIRECT_URI) {
    return res.status(503).json({ error: "Slack OAuth not configured" });
  }
  const scopes = "incoming-webhook,chat:write";
  const url = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;
  res.redirect(url);
});

// GET /auth/slack/callback
router.get("/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI, FRONTEND_URL } = process.env;
  const frontendUrl = FRONTEND_URL || "http://localhost:5173";

  if (!code) return res.redirect(`${frontendUrl}?slack_error=no_code`);

  try {
    const tokenData = await exchangeSlackCode(code, SLACK_CLIENT_ID!, SLACK_CLIENT_SECRET!, SLACK_REDIRECT_URI!);
    if (!tokenData.ok) throw new Error(tokenData.error || "Slack token exchange failed");

    await pool.query(
      `INSERT INTO slack_connections (team_id, team_name, access_token, webhook_url, channel, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (team_id) DO UPDATE SET access_token=$3, webhook_url=$4, channel=$5, updated_at=NOW()`,
      [
        tokenData.team?.id,
        tokenData.team?.name,
        tokenData.access_token,
        tokenData.incoming_webhook?.url,
        tokenData.incoming_webhook?.channel,
      ]
    ).catch(async () => {
      // team_id unique constraint may not exist yet — try insert without conflict
      await pool.query(
        `INSERT INTO slack_connections (team_id, team_name, access_token, webhook_url, channel)
         VALUES ($1,$2,$3,$4,$5)`,
        [tokenData.team?.id, tokenData.team?.name, tokenData.access_token,
         tokenData.incoming_webhook?.url, tokenData.incoming_webhook?.channel]
      );
    });
    res.redirect(`${frontendUrl}?slack_connected=true`);
  } catch (err) {
    console.error("Slack callback error:", err);
    res.redirect(`${frontendUrl}?slack_error=callback_failed`);
  }
});

// GET /api/slack/status
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT team_name, channel, created_at FROM slack_connections ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length === 0) return res.json({ connected: false });
    res.json({ connected: true, ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/slack/disconnect
router.post("/disconnect", async (_req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM slack_connections");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function exchangeSlackCode(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
    const options = {
      hostname: "slack.com",
      path: `/api/oauth.v2.access?${params}`,
      method: "GET",
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON from Slack")); }
      });
    }).on("error", reject);
  });
}

export default router;
