/**
 * cubit/db-seam-only — SEAM-TENANT: "`forTenant(ctx)` / `runAsSystem(reason)` — the only
 * database handles; driver and schema imports lint-banned outside `src/core/db.ts`".
 *
 * A second import of the driver is a second way to reach the rows, and a handle that skips
 * the seam skips the tenant scope with it.
 */
import { isFile } from './paths.mjs';
import { moduleSpecifierVisitors } from './specifiers.mjs';

const SEAM = 'src/core/db.ts';

/** The driver and the query builder that binds to it. */
const DRIVER_PACKAGES = ['pg', 'pg-native', 'postgres', 'drizzle-orm', 'drizzle-kit', 'pg-boss'];

function isDriver(specifier) {
  return DRIVER_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

/** The schema, however the importer spells the path to it. */
function isSchema(specifier) {
  const normalised = specifier.replace(/^@\//, '').replace(/^(?:\.\.\/)+/, '').replace(/^\.\//, '');
  return normalised === 'db/schema' || normalised.startsWith('db/schema/');
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'SEAM-TENANT: the driver and the schema are imported at one seam; everything else takes a scoped handle.',
    },
    schema: [],
    messages: {
      driver:
        'SEAM-TENANT: {{specifier}} is the database driver — take a handle from forTenant(ctx) or runAsSystem(reason) in {{seam}}.',
      schema:
        'SEAM-TENANT: {{specifier}} is the schema — it is imported by {{seam}}, which is what scopes a query to its tenant.',
    },
  },
  create(context) {
    if (isFile(context, SEAM)) return {};
    return moduleSpecifierVisitors((specifier, node) => {
      if (specifier === null) return;
      if (isDriver(specifier)) {
        context.report({ node, messageId: 'driver', data: { specifier, seam: SEAM } });
        return;
      }
      if (isSchema(specifier)) {
        context.report({ node, messageId: 'schema', data: { specifier, seam: SEAM } });
      }
    });
  },
};
