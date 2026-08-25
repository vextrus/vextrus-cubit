// The mechanics the live seam suite runs on. Raw SQL is spoken through psql, never through a
// driver import: SEAM-TENANT bans driver and schema imports everywhere outside src/core/db.ts and
// the suite is bound by that ban like the rest of the tree (cubit/no-db-outside-seam). Everything
// here derives from the migrated database — nothing is transcribed from the tree (B-19).
import { spawnSync } from "node:child_process";
import { AUDIT_REASON, GUC_SYSTEM_REASON, SEEDED_TENANTS, SEED_REASON, TENANT_COLUMN, TENANTS_TABLE } from "./fixtures";

/** A column separator no catalogue value can contain. */
const SEP = "\u0001";

/** What one psql invocation answered. One invocation is one session, so GUCs set in it hold. */
export type SqlResult = { ok: boolean; rows: string[][]; stderr: string; sqlstate: string | null };

/** A base table of the migrated database, already spelled for interpolation. */
export type TableRef = { schema: string; table: string; sql: string };

/** A column of such a table, as the catalogue describes it. */
export type ColumnRef = { name: string; dataType: string; udtName: string };

/** An identifier, quoted so a catalogue name can never be read as syntax. */
export function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** A string literal, quoted the same way. */
export function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** A script that opens by putting the given GUCs on the session it runs in. */
export function withSession(gucs: Record<string, string>, script: string): string {
  const sets = Object.entries(gucs).map(([name, value]) => `set ${name} = ${lit(value)};`);
  return [...sets, script].join("\n");
}

/**
 * Run a script as one session. VERBOSITY verbose puts the SQLSTATE in front of every error message,
 * which is how a refusal is told apart from a mistake.
 */
export function psql(url: string, script: string): SqlResult {
  const result = spawnSync("psql", [url, "-X", "-q", "-A", "-t", "-F", SEP, "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: `\\set VERBOSITY verbose\n${script}\n`,
    encoding: "utf8",
    timeout: 120_000,
  });
  const stderr = `${result.stderr ?? ""}${result.error === undefined ? "" : `\n${String(result.error)}`}`;
  const rows = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.split(SEP));
  // psql prefixes each diagnostic with its source position, so the state is matched in the line
  // rather than at the start of it.
  return { ok: result.status === 0, rows, stderr, sqlstate: /\bERROR:\s+([0-9A-Z]{5}):/.exec(stderr)?.[1] ?? null };
}

/** The same, refusing to continue when the script did not run — a broken probe is not a finding. */
export function run(url: string, script: string): string[][] {
  const result = psql(url, script);
  if (!result.ok) throw new Error(`psql refused this script (SQLSTATE ${result.sqlstate ?? "none"}):\n${script}\n\n${result.stderr.slice(-1200)}`);
  return result.rows;
}

/** The first field of the first row. */
export function scalar(url: string, script: string): string {
  const value = run(url, script)[0]?.[0];
  if (value === undefined) throw new Error(`no value came back from:\n${script}`);
  return value;
}

/** The first field of the first row, as a number. */
export function count(url: string, script: string): number {
  return Number(scalar(url, script));
}

/** Is this Postgres boolean output true? */
export function isTrue(value: string): boolean {
  return value === "t" || value === "true";
}

/**
 * Every base table of the migrated database that carries a tenant_id column — the denominator the
 * live suite is driven by, so a table added by a later increment is covered the moment it lands
 * (B-19). Read as the owner, whose catalogue view hides nothing.
 */
export function deriveTenantScopedTables(url: string): TableRef[] {
  const rows = run(
    url,
    `select c.table_schema, c.table_name
       from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.column_name = ${lit(TENANT_COLUMN)}
        and t.table_type = 'BASE TABLE'
        and c.table_schema not in ('pg_catalog', 'information_schema')
      order by 1, 2;`,
  );
  return rows.map((row) => {
    const schema = row[0];
    const table = row[1];
    if (schema === undefined || table === undefined) throw new Error(`unreadable catalogue row: ${row.join(" ")}`);
    return { schema, table, sql: `${ident(schema)}.${ident(table)}` };
  });
}

/** How a table is named for a human, and for comparison against the harness's enumeration. */
export function qualified(table: TableRef): string {
  return `${table.schema}.${table.table}`;
}

/**
 * The columns a row of this table cannot be built without: NOT NULL, no default, not generated and
 * not an identity — minus tenant_id, which the caller always supplies itself.
 */
export function requiredColumns(url: string, table: TableRef): ColumnRef[] {
  const rows = run(
    url,
    `select column_name, data_type, udt_name
       from information_schema.columns
      where table_schema = ${lit(table.schema)}
        and table_name = ${lit(table.table)}
        and column_name <> ${lit(TENANT_COLUMN)}
        and is_nullable = 'NO'
        and column_default is null
        and is_identity = 'NO'
        and is_generated = 'NEVER'
      order by ordinal_position;`,
  );
  return rows.map((row) => {
    const name = row[0];
    const dataType = row[1];
    const udtName = row[2];
    if (name === undefined || dataType === undefined || udtName === undefined) throw new Error(`unreadable column row: ${row.join(" ")}`);
    return { name, dataType, udtName };
  });
}

/**
 * A value of the column's own type, so a probe row can be built for a table this increment has
 * never seen. A type nobody has taught this helper yet fails loudly and says so — an untestable
 * tenant-scoped table is a gap in V-DB's proof, not something to pass over quietly.
 */
export function probeValue(column: ColumnRef): string {
  switch (column.dataType) {
    case "uuid":
      return "gen_random_uuid()";
    case "text":
    case "character varying":
    case "character":
      return lit("verifier-probe");
    case "boolean":
      return "false";
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "real":
    case "double precision":
      return "0";
    case "timestamp with time zone":
    case "timestamp without time zone":
      return "now()";
    case "date":
      return "current_date";
    case "json":
    case "jsonb":
      return `${lit("{}")}::${column.dataType}`;
    case "ARRAY":
      return `${lit("{}")}::${ident(column.udtName)}`;
    case "USER-DEFINED":
      return `(select e.enumlabel::${ident(column.udtName)} from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = ${lit(column.udtName)} order by e.enumsortorder limit 1)`;
    default:
      throw new Error(`no probe value is known for ${column.name} ${column.dataType} (${column.udtName}) — teach db/__tests__/support/live-sql.ts this type so its table stays covered by V-DB`);
  }
}

/**
 * Seed the two-tenant scenario under system scope and read the ids back, so every assertion that
 * names a tenant names the row the database actually holds (B-19).
 */
export function seedTenants(url: string): Record<string, string> {
  const names = SEEDED_TENANTS.map(lit).join(", ");
  run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(TENANTS_TABLE)} (name)
         select v.name from (select unnest(array[${names}]) as name) v
        where not exists (select 1 from ${ident(TENANTS_TABLE)} t where t.name = v.name);`,
    ),
  );
  const rows = run(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `select name, ${ident(TENANT_COLUMN)} from ${ident(TENANTS_TABLE)} where name in (${names}) order by name;`));
  const ids: Record<string, string> = {};
  for (const row of rows) {
    const name = row[0];
    const id = row[1];
    if (name !== undefined && id !== undefined) ids[name] = id;
  }
  for (const name of SEEDED_TENANTS) {
    if (ids[name] === undefined) throw new Error(`the seed did not produce a tenant named ${name}`);
  }
  return ids;
}

/**
 * Give every tenant-scoped table at least one row per tenant, so "exactly alpha's rows and none of
 * beta's" can never pass by both sides being empty.
 */
export function ensureRowsForTenants(url: string, tables: TableRef[], tenantIds: string[]): void {
  for (const table of tables) {
    for (const tenantId of tenantIds) {
      const present = count(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `select count(*) from ${table.sql} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`));
      if (present > 0) continue;
      const columns = requiredColumns(url, table);
      const names = [ident(TENANT_COLUMN), ...columns.map((column) => ident(column.name))].join(", ");
      const values = [`${lit(tenantId)}::uuid`, ...columns.map(probeValue)].join(", ");
      run(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `insert into ${table.sql} (${names}) values (${values});`));
    }
  }
}

/** How many rows a tenant really owns in a table, counted under system scope. */
export function ownedRowCount(url: string, table: TableRef, tenantId: string): number {
  return count(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select count(*) from ${table.sql} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`));
}

/** A digest of every byte of every row a tenant owns, read under system scope. */
export function snapshotTenantRows(url: string, table: TableRef, tenantId: string): string {
  return scalar(
    url,
    withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select md5(coalesce(string_agg(r::text, '|' order by r::text), '')) from ${table.sql} r where r.${ident(TENANT_COLUMN)} = ${lit(tenantId)};`),
  );
}

/** The tenant ids a session can actually see in a table, in whatever role and scope it holds. */
export function visibleTenantIds(url: string, table: TableRef, gucs: Record<string, string>): string[] {
  return run(url, withSession(gucs, `select ${ident(TENANT_COLUMN)}::text from ${table.sql};`)).map((row) => row[0] ?? "");
}
