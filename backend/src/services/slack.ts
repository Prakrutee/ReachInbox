import pool from "../config/database";
import https from "https";
import dotenv from "dotenv";
dotenv.config();

export async function getSlackConnection() {
  try {
    const res = await pool.query("SELECT * FROM slack_connections ORDER BY created_at DESC LIMIT 1");
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

export async function postSlackMessage(text: string): Promise<void> {
  const conn = await getSlackConnection();
  if (!conn?.webhook_url) return;
  try {
    const body = JSON.stringify({ text });
    const url = new URL(conn.webhook_url);
    await new Promise<void>((resolve, reject) => {
      const req = https.request(
        { hostname: url.hostname, path: url.pathname + url.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => { res.resume(); resolve(); }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    console.error("Slack webhook error (non-fatal):", err);
  }
}
