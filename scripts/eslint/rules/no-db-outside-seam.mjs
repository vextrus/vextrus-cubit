// SEAM-TENANT: forTenant(ctx) / runAsSystem(reason) are the only database handles. Driver and
// schema imports are banned outside src/core/db.ts, and the private-API escape — the ORM's
// internal schema object — is banned everywhere, allowlisted only inside the seam itself.
import { propertyName, specifierVisitors } from "../lib/specifiers.mjs";

/** The one lawful home of the database seam (SEAM-TENANT). */
const ALLOWED = "src/core/db.ts";

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
      driver: "'{{specifier}}' is a database driver — only src/core/db.ts may hold one; reach the database through forTenant(ctx) or runAsSystem(reason) (SEAM-TENANT)",
      schema: "'{{specifier}}' imports the schema directly — the seam exports the one lawful typed read/write surface (SEAM-TENANT)",
      internal: "the ORM's internal schema object is a private-API escape — it is allowlisted only inside src/core/db.ts (SEAM-TENANT)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (filename.endsWith(ALLOWED)) return {};
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
