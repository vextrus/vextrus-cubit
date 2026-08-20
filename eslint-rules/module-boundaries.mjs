/**
 * cubit/module-boundaries — a module's insides are its own. Only its declared
 * surface crosses the line, and composition happens through the router
 * (AS-A1: appRouter mounts `src/modules/<name>/router.ts`, nothing deeper).
 */

const SURFACE = new Set(['router', 'index', 'types', 'contract']);
const MODULE_PATH = /(?:^|\/)modules\/([a-z0-9-]+)(?:\/(.*))?$/;

function moduleOf(filename) {
  const match = MODULE_PATH.exec(filename.replace(/\\/g, '/').replace(/\.[tj]sx?$/, ''));
  return match?.[1] ?? null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Modules are reached through their declared surface only (AS-A1).' },
    schema: [],
    messages: {
      deep:
        'Import reaches inside module `{{module}}` (`{{source}}`) — cross the line at its declared surface (' +
        [...SURFACE].join(', ') +
        ').',
    },
  },

  create(context) {
    const own = moduleOf(context.filename ?? '');

    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        const match = MODULE_PATH.exec(source.replace(/\.[tj]sx?$/, ''));
        if (match === null) return;

        const target = match[1];
        const rest = match[2] ?? '';
        if (target === own) return; // a module may read its own insides
        if (rest === '' || SURFACE.has(rest)) return;

        context.report({ node, messageId: 'deep', data: { module: target, source } });
      },
    };
  },
};
