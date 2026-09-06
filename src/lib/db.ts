import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var facultyFlowPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const pooledUrl = new URL(connectionString);
  // Supavisor transaction pooling avoids reserving a database session per app connection.
  if (pooledUrl.hostname.endsWith(".pooler.supabase.com") && pooledUrl.port === "5432")
    pooledUrl.port = "6543";
  const caPath =
    process.env.SUPABASE_DB_CA_PATH ||
    path.join(process.cwd(), "certificates", "supabase-prod-ca-2021.crt");
  return new Pool({
    connectionString: pooledUrl.toString(),
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, "utf8") },
  });
}

export const db = globalThis.facultyFlowPool || createPool();
globalThis.facultyFlowPool = db;

export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export type { QueryResultRow };
