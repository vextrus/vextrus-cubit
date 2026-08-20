/**
 * cubit/db-seam-only — SEAM-TENANT: `forTenant(ctx)` and `runAsSystem(reason)`
 * are the only database handles. Driver and schema imports are lint-banned
 * outside `src/core/db.ts`; RLS and composite tenant FKs are the backstop.
 */

const DRIVERS = new Set(['pg', 'pg-pool', 'pg-native', 'postgres', 'node-postgres']);
const SCHEMA = /(^|\/)db\/schema(\/|$)/;

function classify(source) {
  if (DRIVERS.has(source)) return 'driver';
  if (source === 'drizzle-orm' || source.startsWith('drizzle-orm/')) return 'driver';
  if (SCHEMA.test(source)) return 'schema';
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'The database is reached only through src/core/db.ts (SEAM-TENANT).' },
    schema: [],
    messages: {
      driver:
        'Driver import `{{source}}` outside the seam — use forTenant(ctx) / runAsSystem(reason) from src/core/db.ts.',
      schema:
        'Schema import `{{source}}` outside the seam — src/core/db.ts is the only module that knows the schema.',
    },
  },

  create(context) {
    const check = (node, source) => {
      const kind = classify(source);
      if (kind === null) return;
      context.report({ node, messageId: kind, data: { source } });
    };

    return {
      ImportDeclaration(node) {
        check(node, String(node.source.value));
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node, node.source.value);
        }
      },
    };
  },
};
