import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "email-scheduler";

export const emailQueue = redis
  ? new Queue(QUEUE_NAME, { connection: redis })
  : (null as unknown as Queue);

export default emailQueue;
