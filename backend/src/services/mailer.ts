import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

function getTransporter() {
  const { ETHEREAL_HOST, ETHEREAL_PORT, ETHEREAL_USER, ETHEREAL_PASSWORD } = process.env;
  if (!ETHEREAL_HOST || !ETHEREAL_USER || !ETHEREAL_PASSWORD) {
    return null;
  }
  return nodemailer.createTransport({
    host: ETHEREAL_HOST,
    port: Number(ETHEREAL_PORT || 587),
    secure: false,
    auth: {
      user: ETHEREAL_USER,
      pass: ETHEREAL_PASSWORD,
    },
  });
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "SMTP not configured: ETHEREAL_HOST, ETHEREAL_USER, ETHEREAL_PASSWORD required",
    };
  }
  try {
    const info = await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.body,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    console.log(`Email sent to ${opts.to} | messageId=${info.messageId} | preview=${previewUrl}`);
    return { success: true, messageId: info.messageId as string, previewUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
