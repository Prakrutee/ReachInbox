import dotenv from "dotenv";
dotenv.config();

import { createWorker } from "./workers/emailWorker";
import { initDb } from "./db/init";

async function main() {
  console.log("Starting ReachInbox worker...");
  
  try {
    await initDb();
  } catch (err) {
    console.error("DB init failed:", err);
    // Continue — worker can still process jobs if DB recovers
  }

  const worker = createWorker();
  if (!worker) {
    console.error("Worker could not start (Redis not configured). Exiting.");
    process.exit(1);
  }

  console.log("Worker started and listening for jobs...");

  async function shutdown() {
    console.log("Shutting down worker gracefully...");
    await worker!.close();
    process.exit(0);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
