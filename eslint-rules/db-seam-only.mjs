/**
 * SEAM-TENANT — `forTenant(ctx)` / `runAsSystem(reason)` are the only database
 * handles, and they live in `src/core/db.ts`. A driver or schema import
 * anywhere else is a handle nobody scoped to a tenant, so it is an error.
 */
import { isSeamFile, staticSpecifier } from './seam.mjs';

const SEAM = 'src/core/db.ts';

const DRIVERS = ['pg', 'pg-pool', 'pg-boss', 'postgres', 'drizzle-orm', 'drizzle-kit'];

/** The schema module, however the importer chose to spell the path. */
const SCHEMA = /(^|\/)db\/schema(\/|$)/;

/** @param {string} specifier */
function isBannedModule(specifier) {
  if (DRIVERS.some((driver) => specifier === driver || specifier.startsWith(`${driver}/`))) {
    return true;
  }
  return SCHEMA.test(specifier.replace(/^(@\/|\.\.?\/)+/, '/'));
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid database driver and db/schema imports outside ${SEAM} (SEAM-TENANT)`,
    },
    schema: [],
    messages: {
      seam:
        'SEAM-TENANT: "{{specifier}}" is a database handle. Only {{seam}} imports it — use forTenant(ctx) or runAsSystem(reason).',
    },
  },
  create(context) {
    if (isSeamFile(context, SEAM)) {
      return {};
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @param {unknown} value
     */
    const check = (node, value) => {
      if (typeof value === 'string' && isBannedModule(value)) {
        context.report({ node, messageId: 'seam', data: { specifier: value, seam: SEAM } });
      }
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          check(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        check(node, staticSpecifier(node.source));
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node, staticSpecifier(node.arguments[0]));
        }
      },
    };
  },
};

export default rule;
