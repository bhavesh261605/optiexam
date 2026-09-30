import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

// Each transaction has its own PostgreSQL connection. Local SQLite remains
// available for offline development, with a queue across asynchronous callers.
const cloud = Boolean(process.env.DATABASE_URL);
if (process.env.VERCEL && !cloud)
  throw new Error("DATABASE_URL is required on Vercel.");
const scope = new AsyncLocalStorage<PoolClient | "sqlite">();
let pool: Pool | undefined;
let sqlite: DatabaseSync | undefined;
let queue = Promise.resolve();
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((done) => {
    release = done;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
function local() {
  if (!sqlite) {
    const path = resolve(
      /* turbopackIgnore: true */ process.env.AURA_DB_PATH ||
        "./data/aura.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    sqlite = new DatabaseSync(path);
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  }
  return sqlite;
}
function postgres() {
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  }));
}
function sqlForPostgres(sql: string) {
  let n = 0;
  let result = sql
    .replace(/\?/g, () => `$${++n}`)
    .replace(/\bINTEGER\b/g, "BIGINT")
    .replace("id BIGINT PRIMARY KEY,actor", "id BIGSERIAL PRIMARY KEY,actor")
    .replace("SET count=count+1", "SET count=auth_limits.count+1");
  const replacement =
    /^INSERT OR REPLACE INTO (attempts|questions|exams) VALUES/i.exec(result);
  if (replacement) {
    result = result.replace("INSERT OR REPLACE", "INSERT");
    result +=
      replacement[1] === "attempts"
        ? " ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data"
        : " ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data";
  }
  return result;
}
function normalize(row: Record<string, unknown>) {
  const keys: Record<string, string> = {
    userid: "userId",
    examid: "examId",
    resetat: "resetAt",
  };
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [keys[key] || key, value]),
  );
}
async function query(
  sql: string,
  values: unknown[],
  mode: "all" | "get" | "run",
) {
  if (cloud) {
    const client = scope.getStore();
    const result = await (
      client && client !== "sqlite" ? client : postgres()
    ).query(sqlForPostgres(sql), values);
    const rows = result.rows.map(normalize);
    return mode === "get"
      ? rows[0]
      : mode === "all"
        ? rows
        : { changes: result.rowCount };
  }
  const execute = async () => {
    const statement = local().prepare(sql);
    return statement[mode](...(values as (string | number | null)[]));
  };
  return scope.getStore() ? execute() : exclusive(execute);
}
export const db = {
  prepare(sql: string) {
    return {
      get: (...values: unknown[]) =>
        query(sql, values, "get") as Promise<
          Record<string, unknown> | undefined
        >,
      all: (...values: unknown[]) =>
        query(sql, values, "all") as Promise<Record<string, unknown>[]>,
      run: (...values: unknown[]) => query(sql, values, "run"),
    };
  },
  async exec(sql: string) {
    if (cloud) {
      const client = scope.getStore();
      await (client && client !== "sqlite" ? client : postgres()).query(
        sqlForPostgres(sql),
      );
    } else {
      const execute = async () => {
        local().exec(sql);
      };
      if (scope.getStore()) await execute();
      else await exclusive(execute);
    }
  },
};
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (scope.getStore()) return fn();
  if (cloud) {
    const client = await postgres().connect();
    try {
      await client.query("BEGIN");
      // Serialize prototype read-modify-write operations across all instances.
      await client.query("SELECT pg_advisory_xact_lock(82461720)");
      const result = await scope.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return exclusive(async () => {
    local().exec("BEGIN IMMEDIATE");
    try {
      const result = await scope.run("sqlite", fn);
      local().exec("COMMIT");
      return result;
    } catch (error) {
      local().exec("ROLLBACK");
      throw error;
    }
  });
}
