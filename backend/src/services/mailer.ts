import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

let cachedTestAccount: nodemailer.TestAccount | null = null;
let cachedTransporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const { ETHEREAL_HOST, ETHEREAL_PORT, ETHEREAL_USER, ETHEREAL_PASSWORD } = process.env;

  // Use configured credentials if present
  if (ETHEREAL_USER && ETHEREAL_PASSWORD) {
    if (!cachedTransporter) {
      cachedTransporter = nodemailer.createTransport({
        host: ETHEREAL_HOST || "smtp.ethereal.email",
        port: Number(ETHEREAL_PORT || 587),
        secure: false,
        auth: {
          user: ETHEREAL_USER,
          pass: ETHEREAL_PASSWORD,
        },
      });
    }
    return cachedTransporter;
  }

  // Otherwise, automatically create an ephemeral Ethereal test account
  if (!cachedTestAccount) {
    try {
      console.log("Generating automatic Ethereal test email credentials...");
      cachedTestAccount = await nodemailer.createTestAccount();
      console.log(`Generated Ethereal account: ${cachedTestAccount.user}`);
    } catch (err) {
      console.warn("Could not create automatic Ethereal test account:", err);
      return null;
    }
  }

  if (!cachedTransporter && cachedTestAccount) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: cachedTestAccount.user,
        pass: cachedTestAccount.pass,
      },
    });
  }

  return cachedTransporter;
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
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "Unable to initialize SMTP transporter for Ethereal email dispatch",
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
