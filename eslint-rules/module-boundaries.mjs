/**
 * cubit/module-boundaries — a module's insides are its own. Only its declared
 * surface crosses the line, and composition happens through the router
 * (AS-A1: appRouter mounts `src/modules/<name>/router.ts`, nothing deeper).
 */

const SURFACE = new Set(['router', 'index', 'types', 'contract']);
const MODULE_PATH = /(?:^|\/)modules\/([a-z0-9-]+)(?:\/(.*))?$/;

function normalise(pathish) {
  return pathish.replace(/\\/g, '/').replace(/\.[tj]sx?$/, '');
}

function moduleOf(filename) {
  const match = MODULE_PATH.exec(normalise(filename));
  return match?.[1] ?? null;
}

/**
 * The specifier as a path. `@/modules/takeoff/…` already reads as one; a
 * relative specifier does not — `../takeoff/internal/partition` names a sibling
 * module without ever spelling the word `modules`, which is exactly how a reach
 * across the line gets written once modules have bodies. It is resolved against
 * the importing file so the rule sees the same path the loader will.
 */
function resolveSpecifier(source, filename) {
  if (!source.startsWith('.')) return normalise(source);

  const from = normalise(filename).split('/').slice(0, -1);
  for (const step of normalise(source).split('/')) {
    if (step === '' || step === '.') continue;
    if (step === '..') from.pop();
    else from.push(step);
  }
  return from.join('/');
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
        const match = MODULE_PATH.exec(resolveSpecifier(source, context.filename ?? ''));
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
