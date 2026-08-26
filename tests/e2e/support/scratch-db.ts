// The journey lane's database (V-E2E, AS-01): one scratch database on the cluster DATABASE_URL
// names, owned by the migrate role and served to the product as the app role, so a journey runs
// against the same grants and policies production does.
//
// Nothing here imports a driver: that ban binds every file of the tree, so the cluster is spoken to
// through psql, and the schema is applied by the tree's own migration lane rather than by any second
// idea of what the schema is (ARCH-02, B-19). The roles themselves are the machine's — `pnpm
// checkup`'s db-roles lane is what proves they exist — so this only makes the database.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BOOTSTRAP_URL, ROLE_APP, ROLE_MIGRATE } from "../../../db/__tests__/support/fixtures";
import { ident, lit, psql, run } from "../../../db/__tests__/support/live-sql";

/**
 * The journeys' database, named rather than randomised: the web server is started from the config
 * and the schema is applied from the global setup, and two processes can only agree on a name they
 * both derive. Provisioning is additive for the same reason — the server may already hold a
 * connection to it, and a journey brings its own identities rather than leaning on the last run's.
 */
const E2E_DATABASE = "cubit_e2e";

/** Local development passwords for the two live roles, as the database harness sets them. */
const PASSWORD: Record<string, string> = { [ROLE_MIGRATE]: ROLE_MIGRATE, [ROLE_APP]: ROLE_APP };

/** The same server as the bootstrap URL, addressed as `role` against the journeys' database. */
function urlAs(role: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = role;
  url.password = PASSWORD[role] ?? role;
  url.pathname = `/${E2E_DATABASE}`;
  return url.toString();
}

/** What the product is served with while the journeys run: the app role, as in production. */
export function e2eDatabaseUrl(): string {
  return urlAs(ROLE_APP);
}

/** The journeys' database, made if the cluster has not got it, and migrated to the committed head. */
export function provisionE2eDatabase(): string {
  const known = psql(BOOTSTRAP_URL, `select 1 from pg_database where datname = ${lit(E2E_DATABASE)};`);
  if (!known.ok) {
    throw new Error(`the journey lane cannot reach Postgres at ${BOOTSTRAP_URL} — start the cluster, or point DATABASE_URL at one.\n\n${known.stderr.slice(-800)}`);
  }
  if (known.rows.length === 0) run(BOOTSTRAP_URL, `create database ${ident(E2E_DATABASE)} owner ${ident(ROLE_MIGRATE)};`);

  const root = process.cwd();
  const migrated = spawnSync(process.execPath, [join(root, "scripts", "db-migrate.mjs")], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: urlAs(ROLE_MIGRATE) },
    encoding: "utf8",
    timeout: 180_000,
  });
  if (migrated.status !== 0) {
    throw new Error(`the committed migrations did not apply to ${E2E_DATABASE}:\n${`${migrated.stdout ?? ""}${migrated.stderr ?? ""}`.slice(-1600)}`);
  }
  return e2eDatabaseUrl();
}
