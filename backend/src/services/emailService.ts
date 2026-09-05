import { v4 as uuidv4 } from "uuid";
import pool, { isDbConnected } from "../config/database";
import { emailQueue } from "../config/queue";
import isEmail from "validator/lib/isEmail";

export interface ScheduleEmailInput {
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduledAt: Date;
}

export interface BulkScheduleInput {
  recipients: string[];
  subject: string;
  body: string;
  sender: string;
  startAt: Date;
  delayBetweenMs: number;
}

export interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduled_at: string;
  sent_at: string | null;
  status: "scheduled" | "sent" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory store for local testing without PostgreSQL
export const inMemoryEmails: EmailRecord[] = [];

export async function scheduleEmail(input: ScheduleEmailInput) {
  const { recipient, subject, body, sender, scheduledAt } = input;
  if (!isEmail(recipient)) throw new Error(`Invalid email: ${recipient}`);

  const id = uuidv4();
  const now = new Date();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  // Record in memory
  const emailRecord: EmailRecord = {
    id,
    recipient,
    subject,
    body,
    sender,
    scheduled_at: scheduledAt.toISOString(),
    sent_at: null,
    status: "scheduled",
    error: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  inMemoryEmails.unshift(emailRecord);

  // If Postgres is connected, insert into DB
  if (pool && isDbConnected) {
    try {
      await pool.query(
        `INSERT INTO emails (id, recipient, subject, body, sender, scheduled_at, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8)`,
        [id, recipient, subject, body, sender, scheduledAt, now, now]
      );
    } catch (err: unknown) {
      console.warn("Postgres insert skipped, stored in memory:", err);
    }
  }

  // BullMQ Delayed Queue if Redis is connected
  if (emailQueue) {
    try {
      await emailQueue.add(
        "send-email",
        { emailId: id, recipient, subject, body, sender, scheduledAt: scheduledAt.toISOString() },
        { jobId: id, delay }
      );
    } catch (err: unknown) {
      console.warn("BullMQ enqueue skipped:", err);
    }
  } else {
    // Local simulation: mark as sent after delay (or max 8s for quick local testing)
    const simDelay = Math.min(delay, 8000);
    setTimeout(() => {
      emailRecord.status = "sent";
      emailRecord.sent_at = new Date().toISOString();
      console.log(`[Local Simulation] Email to ${recipient} delivered successfully!`);
    }, simDelay);
  }

  return { id, scheduledAt, delay };
}

export async function scheduleBulk(input: BulkScheduleInput) {
  const { recipients, subject, body, sender, startAt, delayBetweenMs } = input;
  const validRecipients = recipients.filter((r) => isEmail(r.trim()));
  const results = [];
  for (let i = 0; i < validRecipients.length; i++) {
    const scheduledAt = new Date(startAt.getTime() + i * delayBetweenMs);
    const result = await scheduleEmail({
      recipient: validRecipients[i].trim(),
      subject,
      body,
      sender,
      scheduledAt,
    });
    results.push(result);
  }
  return {
    scheduled: results.length,
    skipped: recipients.length - validRecipients.length,
    total: recipients.length,
  };
}

export async function getScheduledEmails(): Promise<EmailRecord[]> {
  if (pool && isDbConnected) {
    try {
      const res = await pool.query(
        "SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC"
      );
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      console.warn("getScheduledEmails fallback to memory");
    }
  }
  return inMemoryEmails.filter((e) => e.status === "scheduled");
}

export async function getSentEmails(): Promise<EmailRecord[]> {
  if (pool && isDbConnected) {
    try {
      const res = await pool.query(
        "SELECT * FROM emails WHERE status IN ('sent','failed') ORDER BY sent_at DESC NULLS LAST"
      );
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      console.warn("getSentEmails fallback to memory");
    }
  }
  return inMemoryEmails.filter((e) => e.status === "sent" || e.status === "failed");
}
