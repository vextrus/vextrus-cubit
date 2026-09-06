// SEAM-TENANT: forTenant(ctx) / runAsSystem(reason) are the only database handles. Driver and
// schema imports are banned outside the seam, and the private-API escape — the ORM's internal
// schema object — is banned everywhere, allowlisted only inside the seam itself.
import { propertyName, specifierVisitors } from "../lib/specifiers.mjs";

/**
 * The one lawful home of the database seam (SEAM-TENANT): the barrel `src/core/db.ts` and the
 * product modules beside it under `src/core/db/`. The seam is a directory rather than a file
 * because the tables, the pools, the scoped surface and the job storage are each their own module
 * — but the allowlist is still exact, so `src/core/db-beside.ts` and `src/core/dbx/` are outside it.
 */
const SEAM_HOME = /(?:^|\/)src\/core\/db(?:\.ts$|\/)/;

/**
 * The seam's own tests are NOT in the allowlist. They reach the store through the seam like every
 * other caller, and a test importing the driver would be the very bypass the ban exists for.
 */
const SEAM_TESTS = /(?:^|\/)src\/core\/db\/(?:.*\/)?__tests__\//;

/** Drivers and ORM entry points: a handle may only be made inside the seam. */
const DRIVERS = /^(?:drizzle-orm|pg|pg-native|pg-pool|postgres|postgres-js|node-postgres|@neondatabase\/|@vercel\/postgres|@electric-sql\/pglite|knex|kysely|typeorm|prisma|@prisma\/)/;

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
    const filename = context.filename.replace(/\\/g, "/");
    if (SEAM_HOME.test(filename) && !SEAM_TESTS.test(filename)) return {};
    const sourceCode = context.sourceCode;
    return {
      ...specifierVisitors(context, ({ value, node }) => {
        if (DRIVERS.test(value)) context.report({ node, messageId: "driver", data: { specifier: value } });
        else if (SCHEMA.test(value)) context.report({ node, messageId: "schema", data: { specifier: value } });
      }),
      MemberExpression: (node) => {
        if (propertyName(node, sourceCode) === "_") context.report({ node, messageId: "internal" });
      },
    };
  },
};
