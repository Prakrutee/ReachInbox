import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import connectPgSimple from "connect-pg-simple";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import pool, { isDbConnected } from "./config/database";
import { emailQueue } from "./config/queue";
import { initDb } from "./db/init";
import emailRoutes from "./routes/emails";
import authRoutes from "./routes/auth";
import slackRoutes from "./routes/slack";
import aiRoutes from "./routes/ai";

// Passport strategy setup
import "./middleware/passport";

const app = express();
const PORT = Number(process.env.PORT || 10000);

// Security
app.use(
  helmet({
    contentSecurityPolicy: false, // disabled for Bull Board UI
  })
);

// CORS
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session: Use Postgres session store if pool is available, else fallback to memory store
let sessionStore: session.Store | undefined = undefined;
if (pool) {
  try {
    const PgSession = connectPgSimple(session);
    sessionStore = new PgSession({ pool, tableName: "session", createTableIfMissing: true });
  } catch {
    console.log("Using standard in-memory session store.");
  }
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Bull Board
if (emailQueue) {
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");
    createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
    app.use("/admin/queues", serverAdapter.getRouter());
  } catch (err) {
    console.warn("Bull Board init warning:", err);
  }
}

// Health check
app.get("/api/health", async (_req, res) => {
  const checks: Record<string, string> = { status: "ok" };
  if (pool && isDbConnected) {
    try {
      await pool.query("SELECT 1");
      checks.db = "ok";
    } catch {
      checks.db = "in-memory-fallback";
    }
  } else {
    checks.db = "in-memory-fallback";
  }
  checks.groq = Boolean(process.env.GROQ_API_KEY) ? "active" : "not-configured";
  res.json(checks);
});

// Routes
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/slack", slackRoutes);
app.use("/auth/slack", slackRoutes);

export default app;

async function main() {
  try {
    await initDb();
  } catch (err) {
    console.warn("DB init notice:", err);
  }

  app.listen(PORT, () => {
    console.log(`ReachInbox API running on port ${PORT}`);
    console.log(`Bull Board: http://localhost:${PORT}/admin/queues`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
  });
}

main();
