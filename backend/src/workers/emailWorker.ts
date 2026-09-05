import { Job, Worker } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

import { redis } from "../config/redis";
import pool from "../config/database";
import { sendEmail } from "../services/mailer";
import { indexEmail } from "../config/elasticsearch";
import { postSlackMessage } from "../services/slack";
import { QUEUE_NAME } from "../config/queue";

const MIN_DELAY = Number(process.env.MIN_EMAIL_DELAY_MS || 2000);
const MAX_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR || 20);

export async function emailProcessor(job: Job) {
  const { emailId, recipient, subject, body, sender, scheduledAt } = job.data as {
    emailId: string;
    recipient: string;
    subject: string;
    body: string;
    sender: string;
    scheduledAt: string;
  };

  // Idempotency: mark as processing only if still scheduled
  const markRes = await pool.query(
    "UPDATE emails SET status='processing', updated_at=NOW() WHERE id=$1 AND status='scheduled' RETURNING id",
    [emailId]
  );
  if (markRes.rowCount === 0) {
    console.log(`Job ${emailId} already processed or not found — skipping`);
    return { skipped: true };
  }

  // Rate limiting via Redis INCR
  const now = new Date();
  const hourKey = `email-rate:${sender}:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}-${String(now.getUTCHours()).padStart(2,"0")}`;

  let rateLimited = false;
  if (redis) {
    const count = await redis.incr(hourKey);
    if (count === 1) await redis.expire(hourKey, 3600);
    if (count > MAX_PER_HOUR) {
      rateLimited = true;
      // Reschedule to next hour
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 5, 0);
      const rescheduleDelay = nextHour.getTime() - Date.now();

      await pool.query(
        "UPDATE emails SET status='scheduled', scheduled_at=$2, updated_at=NOW() WHERE id=$1",
        [emailId, nextHour]
      );
      
      // Notify Slack
      await postSlackMessage(
        `Rate limit hit for sender ${sender}: ${MAX_PER_HOUR} emails/hr exceeded. Job ${emailId} rescheduled to ${nextHour.toISOString()}`
      );

      // Re-enqueue
      const { emailQueue } = await import("../config/queue");
      if (emailQueue) {
        await emailQueue.add("send-email", job.data, { jobId: `${emailId}-reschedule-${Date.now()}`, delay: rescheduleDelay });
      }
      console.log(`Rate limited: rescheduled ${emailId} to ${nextHour.toISOString()}`);
      return { rescheduled: true };
    }
  }

  // Throttle individual sends
  await new Promise((r) => setTimeout(r, MIN_DELAY));

  // Send
  const result = await sendEmail({ to: recipient, from: sender, subject, body });

  if (result.success) {
    await pool.query(
      "UPDATE emails SET status='sent', sent_at=NOW(), updated_at=NOW(), error=NULL WHERE id=$1",
      [emailId]
    );
    // Index in ES (non-fatal)
    await indexEmail({
      id: emailId, recipient, subject, body, sender,
      status: "sent", scheduled_at: scheduledAt, sent_at: new Date().toISOString(),
    });
    console.log(`Email ${emailId} sent successfully. Preview: ${result.previewUrl}`);
    return { sent: true, messageId: result.messageId };
  } else {
    await pool.query(
      "UPDATE emails SET status='failed', error=$2, updated_at=NOW() WHERE id=$1",
      [emailId, result.error]
    );
    await indexEmail({
      id: emailId, recipient, subject, body, sender,
      status: "failed", scheduled_at: scheduledAt, sent_at: null,
    });
    throw new Error(result.error || "Send failed");
  }
}

export function createWorker() {
  if (!redis) {
    console.warn("Redis not configured — worker cannot start");
    return null;
  }
  const worker = new Worker(QUEUE_NAME, emailProcessor, {
    connection: redis,
    concurrency: Number(process.env.CONCURRENCY || 5),
  });
  worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
  return worker;
}
