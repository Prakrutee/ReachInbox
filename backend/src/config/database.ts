import { Pool, QueryResult } from "pg";
import dotenv from "dotenv";
dotenv.config();

export let isDbConnected = false;

const dbUrl = process.env.DATABASE_URL?.trim();

class DummyPool {
  async query(_text: unknown, _params?: unknown): Promise<QueryResult<any>> {
    return { rows: [], command: "", rowCount: 0, oid: 0, fields: [] };
  }
  async connect(): Promise<any> {
    return {
      query: async () => ({ rows: [], command: "", rowCount: 0, oid: 0, fields: [] }),
      release: () => {},
    };
  }
  on(_event: string, _listener: unknown) {
    return this;
  }
  async end() {}
}

let activePool: Pool;

if (dbUrl && dbUrl.length > 0) {
  const realPool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("render.com") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 3000,
  });

  realPool.on("error", (err) => {
    console.warn("Postgres pool error:", err.message);
    isDbConnected = false;
  });

  realPool
    .query("SELECT 1")
    .then(() => {
      isDbConnected = true;
      console.log("PostgreSQL connected successfully");
    })
    .catch((err) => {
      isDbConnected = false;
      console.warn("PostgreSQL unavailable, fallback in-memory mode active:", err.message);
    });

  activePool = realPool;
} else {
  activePool = new DummyPool() as unknown as Pool;
  console.log("No DATABASE_URL set. Running in resilient in-memory mode.");
}

export const pool = activePool;
export default pool;
