import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn("REDIS_URL not set — Redis features will not work");
}

export const redis = redisUrl
  ? new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: redisUrl.startsWith("rediss://") ? {} : undefined,
    })
  : (null as unknown as IORedis);

export default redis;
