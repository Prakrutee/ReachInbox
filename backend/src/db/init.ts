import pool, { isDbConnected } from "../config/database";

export async function initDb() {
  if (!pool) {
    console.log("No PostgreSQL configured — running in-memory data store for local testing.");
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(320) UNIQUE NOT NULL,
          avatar TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS slack_connections (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          team_id VARCHAR(255) UNIQUE,
          team_name VARCHAR(255),
          access_token TEXT NOT NULL,
          webhook_url TEXT,
          channel VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS emails (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient VARCHAR(320) NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          sender VARCHAR(320) NOT NULL,
          scheduled_at TIMESTAMPTZ NOT NULL,
          sent_at TIMESTAMPTZ,
          status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails(recipient)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender)`);
      await client.query("COMMIT");
      console.log("Database initialized successfully");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("PostgreSQL initialization skipped (using in-memory fallback):", msg);
  }
}
