// ARCH-01: cycles at file or layer grain are lint errors. The graph is walked on disk from the
// file being linted, following every specifier shape the collector knows (Q-01), and a specifier
// that names a file the tree has not written yet still resolves to the path it would have — so a
// cycle is reported on the import that closes it, not on whichever half happens to exist.
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { resolveInternal } from "../lib/layers.mjs";
import { specifierVisitors } from "../lib/specifiers.mjs";

/** How deep a chain may be followed before the answer stops being useful. */
const MAX_DEPTH = 24;

/** Specifier shapes read from a file the linter never parses. */
const SPECIFIER_IN_TEXT =
  /(?:^|[\s;}])(?:import|export)\s[^;'"]*?from\s*['"`]([^'"`]+)['"`]|(?:^|[^\w$])import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|(?:^|[^\w$])require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|(?:^|[\s;}])import\s*['"`]([^'"`]+)['"`]/g;

/**
 * @param {string} text
 * @returns {string[]}
 */
function specifiersInText(text) {
  /** @type {string[]} */
  const found = [];
  SPECIFIER_IN_TEXT.lastIndex = 0;
  let match = SPECIFIER_IN_TEXT.exec(text);
  while (match !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (value !== undefined) found.push(value);
    match = SPECIFIER_IN_TEXT.exec(text);
  }
  return found;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "no import cycle at file or layer grain (ARCH-01)" },
    schema: [],
    messages: {
      cycle: "this import closes a cycle: {{chain}} — cycles at file or layer grain are lint errors (ARCH-01)",
    },
  },
  create(context) {
    const rootDir = context.cwd;
    const entry = resolve(rootDir, context.filename);
    /** @type {Map<string, string[]>} */
    const edges = new Map();

    /** @param {string} file @returns {string[]} */
    const outgoing = (file) => {
      const cached = edges.get(file);
      if (cached !== undefined) return cached;
      /** @type {string[]} */
      let targets = [];
      if (existsSync(file)) {
        try {
          targets = specifiersInText(readFileSync(file, "utf8"))
            .map((specifier) => resolveInternal(specifier, file, rootDir, existsSync))
            .filter((/** @type {string | null} */ target) => target !== null);
        } catch {
          targets = [];
        }
      }
      edges.set(file, targets);
      return targets;
    };

    /**
     * The chain from `from` back to the entry, or null.
     * @param {string} from
     * @param {Set<string>} seen
     * @returns {string[] | null}
     */
    const pathBack = (from, seen) => {
      if (from === entry) return [from];
      if (seen.has(from) || seen.size > MAX_DEPTH) return null;
      seen.add(from);
      for (const next of outgoing(from)) {
        const tail = pathBack(next, seen);
        if (tail !== null) return [from, ...tail];
      }
      return null;
    };

    return specifierVisitors(context, ({ value, node }) => {
      const target = resolveInternal(value, entry, rootDir, existsSync);
      if (target === null) return;
      const chain = pathBack(target, new Set());
      if (chain === null) return;
      const readable = [entry, ...chain].map((file) => relative(rootDir, file).replace(/\\/g, "/")).join(" → ");
      context.report({ node, messageId: "cycle", data: { chain: readable } });
    });
  },
};
