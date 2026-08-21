/**
 * Where a seam is, exactly.
 *
 * B-05 — a guardrail must fire on exactly the right condition. Every seam
 * exemption in this plugin names one file in this repository: `src/core/db.ts`,
 * `src/core/units.ts`, `src/core/format.ts`, `src/ui/tokens.ts`. A suffix match
 * on the absolute path names a family instead — `src/features/legacy/src/core/
 * db.ts`, a vendored `packages/x/src/core/units.ts`, any directory a feature
 * chose to call `src/core` — and every one of those would be silently exempt
 * from the rule it is furthest from deserving.
 *
 * So the exemption is decided by the path relative to the project root, and it
 * is an equality, not a suffix.
 */
import path from 'node:path';

/**
 * The linted file's path relative to the project root, in forward slashes. A
 * file outside the root keeps its `../` prefix and therefore matches no seam.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {string}
 */
export function relativeFilename(context) {
  return path.relative(context.cwd, context.filename).replaceAll('\\', '/');
}

/**
 * True only for the one file the seam names.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {string} seam root-relative path of the seam file
 * @returns {boolean}
 */
export function isSeamFile(context, seam) {
  return relativeFilename(context) === seam;
}

/**
 * True only for files inside the one directory the seam names.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {string} seamDir root-relative directory, trailing slash included
 * @returns {boolean}
 */
export function isInsideSeam(context, seamDir) {
  return relativeFilename(context).startsWith(seamDir);
}

/**
 * The module specifier a dynamic `import()` or a `require()` was written with.
 *
 * `import('pg')` and ``import(`pg`)`` are the same import to the loader, but
 * they are a Literal and a TemplateLiteral to the parser: a seam rule that
 * reads only the first spelling misses the second, and the backtick is exactly
 * what a half-finished edit or a formatter leaves behind. A template carrying
 * an interpolation is computed, not static, and has no answer here.
 *
 * The parameter is described structurally rather than as an `estree` node:
 * @types/estree is eslint's own transitive dependency and is not a dependency
 * of this increment, and a guardrail is not worth a new one.
 *
 * @param {{
 *   type: string,
 *   value?: unknown,
 *   expressions?: readonly unknown[],
 *   quasis?: readonly { value: { cooked?: string | null | undefined } }[],
 * } | undefined} node
 * @returns {string | undefined}
 */
export function staticSpecifier(node) {
  if (node === undefined) {
    return undefined;
  }
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : undefined;
  }
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return node.quasis?.[0]?.value.cooked ?? undefined;
  }
  return undefined;
}
