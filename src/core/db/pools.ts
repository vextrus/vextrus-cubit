// SEAM-TENANT: the connections every scoped handle is issued on. One pool per database the seam is
// pointed at, built on first use, so importing the seam neither reads nor needs a live server. The
// driver is held here because the seam's directory is its one lawful home — nothing above the seam
// opens a connection of its own (ARCH-02).
import postgres from "postgres";
import { envValue } from "../env";

/** How many connections one process holds, and how long an idle one is kept (in seconds). */
const POOL = { max: 10, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * One pool per database the seam is pointed at, built on first use — so importing the seam neither
 * reads nor needs a live server, and a process told to reach a different database reaches it rather
 * than answering out of a pool built for the last one.
 */
const pools = new Map<string, postgres.Sql>();

/**
 * End every pool the seam built and forget it, so a process that touched the seam can exit. The
 * registry is emptied as well as ended: a later scoped call builds a fresh pool rather than handing
 * out an ended one, and closing pools that were never built closes nothing.
 */
export async function closePools(): Promise<void> {
  const built = [...pools.values()];
  pools.clear();
  await Promise.all(built.map(async (sql) => await sql.end()));
}

/** The pool this process reaches DATABASE_URL through. The seam's own — the barrel hands out no pool. */
export function connection(): postgres.Sql {
  const url = databaseUrl();
  const existing = pools.get(url);
  if (existing !== undefined) return existing;
  const sql = postgres(url, { max: POOL.max, idle_timeout: POOL.idleTimeout, connect_timeout: POOL.connectTimeout });
  pools.set(url, sql);
  return sql;
}

function databaseUrl(): string {
  const url = envValue("DATABASE_URL");
  if (url === undefined) {
    throw new Error("DATABASE_URL is not set — the seam has no database to reach (SEAM-TENANT)");
  }
  return url;
}
