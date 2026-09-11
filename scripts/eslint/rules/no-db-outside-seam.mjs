// SEAM-TENANT: forTenant(ctx) / runAsSystem(reason) are the only database handles. Driver and
// schema imports are banned outside the seam, and the private-API escape — the ORM's internal
// schema object — is banned everywhere, allowlisted only inside the seam itself.
import { relative } from "node:path";
import { propertyName, specifierVisitors } from "../lib/specifiers.mjs";

/**
 * The one lawful home of the database seam (SEAM-TENANT), read as a path relative to the checkout
 * root: the barrel `src/core/db.ts` and the product modules one directory level beneath it. The
 * seam is a directory rather than a file because the tables, the pools, the scoped surface and the
 * job storage are each their own module — but the allowlist stays exact, and being rooted is part
 * of exact. `src/core/db-beside.ts`, `src/core/dbx/pools.ts`, anything nested under
 * `src/core/db/` (a `__tests__/` directory included) and any deeper tree that merely repeats the
 * segment are all outside it.
 */
const SEAM_HOME = /^src\/core\/db(?:\.ts|\/[^/]+\.ts)$/;

/**
 * The half of that home that declares TABLES rather than holds handles (AM-11 cut the schema into
 * one module per area). A table declaration has no business opening a connection: the pools are
 * `pools.ts`'s, the handles `seam.ts`'s, the queue storage `jobs.ts`'s — and a `schema-<area>.ts`
 * that imported `postgres` would be a second door into the database standing inside the seam's own
 * directory, where the ban that exists to stop exactly that had stopped looking. Widening the
 * allowlist to a directory was right for the modules; it was never meant to hand 31 table files the
 * driver as well. So these files keep the ORM they declare their tables with and lose the rest.
 */
const SEAM_TABLES = /^src\/core\/db\/schema(?:-[a-z0-9-]+)?\.ts$/;

/**
 * A test is never in the allowlist. A `__tests__/` directory is already outside the one-level home
 * above; a co-located `<name>.test.ts` is not, and it is this tree's dominant shape for a unit test
 * beside a `src/core/` module, so it is named here. The seam's own suites reach the store through
 * the seam like every other caller, and a test importing the driver would be the very bypass the
 * ban exists for.
 */
const SEAM_TESTS = /\.(?:test|spec)\.[cm]?tsx?$/;

/** What opens a connection. Nothing outside the seam may hold one, and no table file may either. */
const CONNECTIONS = /^(?:pg|pg-native|pg-pool|postgres|postgres-js|node-postgres|@neondatabase\/|@vercel\/postgres|@electric-sql\/pglite|knex|kysely|typeorm|prisma|@prisma\/)/;

/** Drivers and ORM entry points: a handle may only be made inside the seam. */
// One anchored group: the alternation must not leave `pg|…` unanchored, or any RELATIVE path that
// merely contains "pg" (scripts/lib/pg-suites.mjs) reads as a driver (v22 integrator, P1 rebase red).
const DRIVERS = new RegExp(`^(?:drizzle-orm|${CONNECTIONS.source.slice(4)}`);

/** The schema module: importing tables directly walks around the seam's typed surface. */
const SCHEMA = /(?:^|\/)db\/schema(?:\/|$)|(?:^|\/)schema\.sql$/;

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "database driver and schema imports live only in the tenant seam (SEAM-TENANT)" },
    schema: [],
    messages: {
      driver: "'{{specifier}}' is a database driver — only the seam (src/core/db.ts and src/core/db/) may hold one; reach the database through forTenant(ctx) or runAsSystem(reason) (SEAM-TENANT)",
      schema: "'{{specifier}}' imports the schema directly — the seam exports the one lawful typed read/write surface (SEAM-TENANT)",
      internal: "the ORM's internal schema object is a private-API escape — it is allowlisted only inside the seam (src/core/db.ts and src/core/db/) (SEAM-TENANT)",
    },
  },
  create(context) {
    const filename = relative(context.cwd, context.filename).replace(/\\/g, "/");
    const inSeam = SEAM_HOME.test(filename) && !SEAM_TESTS.test(filename);
    // A table file is inside the seam and still bound: it may name the ORM it declares tables with,
    // and it may not open a connection. Everything else in the seam keeps the whole allowlist.
    const declaresTables = inSeam && SEAM_TABLES.test(filename);
    if (inSeam && !declaresTables) return {};
    const banned = declaresTables ? CONNECTIONS : DRIVERS;
    const sourceCode = context.sourceCode;
    return {
      ...specifierVisitors(context, ({ value, node }) => {
        if (banned.test(value)) context.report({ node, messageId: "driver", data: { specifier: value } });
        else if (!declaresTables && SCHEMA.test(value)) context.report({ node, messageId: "schema", data: { specifier: value } });
      }),
      MemberExpression: (node) => {
        if (!declaresTables && propertyName(node, sourceCode) === "_") context.report({ node, messageId: "internal" });
      },
    };
  },
};
