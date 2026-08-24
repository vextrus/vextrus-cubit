// The boundary law, mechanical (B-18). This config carries the ARCH-01 import-direction matrix and
// the Q-08 NEVERs as rules, each with a committed bad/good fixture twin under tests/lint-fixtures.
// The corpus is excluded from `eslint .` of the product tree — its payload IS the flagged
// construct (Q-08) — and is linted programmatically by tests/toolchain instead.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, posix, resolve, sep } from "node:path";
import globals from "globals";
import tseslint from "typescript-eslint";

// ---------------------------------------------------------------------------------------------
// ARCH-01: which layer may reach which. The relation is a DAG, so a cycle at layer grain cannot be
// expressed here at all; cycles at file grain are caught by cubit/no-import-cycle below.
// ---------------------------------------------------------------------------------------------
const MAY_IMPORT = {
  core: ["core"],
  modules: ["core", "modules"],
  server: ["core", "modules", "server"],
  app: ["core", "modules", "server", "ui", "app"],
  ui: ["core", "ui"],
  worker: ["core", "modules", "worker"],
};

const LAYER = /(?:^|\/)src\/(core|modules|server|app|ui|worker)(?:\/|$)/;

/** The layer a path belongs to — and, inside src/modules, which module owns it. */
function locate(path) {
  const found = LAYER.exec(path);
  if (!found) return null;
  const layer = found[1];
  if (layer !== "modules") return { layer, module: null };
  const rest = path.slice(found.index + found[0].length);
  return { layer, module: rest.split("/")[0] || null };
}

/** The in-tree path an import specifier names, or null when it names a package. */
function targetOf(specifier, fromFile) {
  if (specifier.startsWith(".")) return posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  if (specifier.startsWith("src/")) return specifier;
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  return null;
}

const toPosix = (path) => path.split(sep).join("/");

const layerImports = {
  meta: {
    type: "problem",
    docs: { description: "ARCH-01: a layer imports only what the matrix lets it reach" },
    schema: [],
    messages: {
      forbidden: "ARCH-01: src/{{from}} must not import src/{{to}} ({{specifier}}).",
      crossModule: "ARCH-01: module {{from}} must not import module {{to}} ({{specifier}}) — modules reach core and their own module only.",
    },
  },
  create(context) {
    const file = toPosix(context.filename ?? context.getFilename());
    const here = locate(file);
    if (!here) return {};

    const check = (node, specifier) => {
      if (typeof specifier !== "string") return;
      const target = targetOf(specifier, file);
      const there = target && locate(target);
      if (!there) return;
      if (!MAY_IMPORT[here.layer].includes(there.layer)) {
        context.report({ node, messageId: "forbidden", data: { from: here.layer, to: there.layer, specifier } });
        return;
      }
      if (here.layer === "modules" && there.layer === "modules" && here.module !== there.module) {
        context.report({ node, messageId: "crossModule", data: { from: here.module, to: there.module, specifier } });
      }
    };

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => node.source.type === "Literal" && check(node, node.source.value),
    };
  },
};

// ---------------------------------------------------------------------------------------------
// ARCH-01, file grain: an import that comes back round to the file it started from.
// ---------------------------------------------------------------------------------------------
const SUFFIXES = ["", ".ts", ".tsx", ".mts", ".cts", ".d.ts", "/index.ts", "/index.tsx", "/index.mts"];
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
const MAX_DEPTH = 24;

// The tree this config governs — a scratch copy carries its own config, so each copy resolves
// against itself. `src/…` and `@/…` specifiers are in-tree names too, so a cycle is a cycle no
// matter which of the three forms targetOf accepts it was written in (ARCH-01).
const TREE_ROOT = import.meta.dirname;

/** The file an in-tree specifier names, trying the extensions TypeScript would try. */
function resolveInTree(fromFile, specifier) {
  const inTree = targetOf(specifier, toPosix(fromFile));
  if (inTree === null) return null;
  const base = specifier.startsWith(".") ? resolve(dirname(fromFile), specifier) : resolve(TREE_ROOT, inTree);
  const bases = [base, base.replace(/\.([cm]?)js$/, ".$1ts")];
  for (const candidate of bases) {
    for (const suffix of SUFFIXES) {
      const path = candidate + suffix;
      if (existsSync(path) && statSync(path).isFile()) return path;
    }
  }
  return null;
}

/**
 * Source with its comments blanked out, quotes and template literals left intact. A commented-out
 * `// import "./sibling";` is not an edge of the program, so the traversal below must not read one
 * as a cycle. Newlines are preserved so nothing else shifts.
 */
function withoutComments(source) {
  let out = "";
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += source[i + 1] ?? "";
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const skipped = source.slice(i, end === -1 ? source.length : end + 2);
      out += skipped.replace(/[^\n]/g, " ");
      i += skipped.length - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function importsOf(file) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const match of withoutComments(source).matchAll(SPECIFIER)) {
    const resolved = resolveInTree(file, match[1]);
    if (resolved) out.push(resolved);
  }
  return out;
}

function reaches(from, goal, seen, depth) {
  if (depth > MAX_DEPTH) return false;
  for (const next of importsOf(from)) {
    if (next === goal) return true;
    if (seen.has(next)) continue;
    seen.add(next);
    if (reaches(next, goal, seen, depth + 1)) return true;
  }
  return false;
}

const noImportCycle = {
  meta: {
    type: "problem",
    docs: { description: "ARCH-01: cycles at file grain are lint errors" },
    schema: [],
    messages: { cycle: "ARCH-01: importing {{specifier}} closes an import cycle back to this file." },
  },
  create(context) {
    const file = resolve(context.filename ?? context.getFilename());
    return {
      ImportDeclaration(node) {
        const target = resolveInTree(file, String(node.source.value));
        if (target && target !== file && reaches(target, file, new Set([file, target]), 0)) {
          context.report({ node, messageId: "cycle", data: { specifier: node.source.value } });
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Q-08 NEVERs that no upstream rule expresses.
// ---------------------------------------------------------------------------------------------
// The comment prefix Q-08 bans, assembled from its halves so this file — which is product tree,
// not declared fixture — carries no literal instance of the construct it forbids.
const SUPPRESSION_PREFIX = ["eslint", "disable"].join("-");

const noRuleSuppression = {
  meta: {
    type: "problem",
    docs: { description: "Q-08: no rule-suppression comment" },
    schema: [],
    messages: { disabled: "Q-08: a `{{prefix}}` comment is never used; fix the code the rule names." },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.value.trimStart().startsWith(SUPPRESSION_PREFIX)) {
            context.report({ loc: comment.loc, messageId: "disabled", data: { prefix: SUPPRESSION_PREFIX } });
          }
        }
      },
    };
  },
};

const TEST_ROOTS = new Set(["describe", "it", "test", "suite", "bench", "context"]);

const noTestSkip = {
  meta: {
    type: "problem",
    docs: { description: "Q-08: no .skip, no .only" },
    schema: [],
    messages: { banned: "Q-08: {{root}}.{{modifier}} never lands — an unrun assertion is not a green one." },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const modifier = node.computed
          ? node.property.type === "Literal" && node.property.value
          : node.property.type === "Identifier" && node.property.name;
        if (modifier !== "skip" && modifier !== "only") return;
        let root = node.object;
        while (root.type === "MemberExpression") root = root.object;
        if (root.type === "Identifier" && TEST_ROOTS.has(root.name)) {
          context.report({ node, messageId: "banned", data: { root: root.name, modifier } });
        }
      },
    };
  },
};

const cubit = {
  meta: { name: "cubit" },
  rules: {
    "layer-imports": layerImports,
    "no-import-cycle": noImportCycle,
    "no-rule-suppression": noRuleSuppression,
    "no-test-skip": noTestSkip,
  },
};

const TS = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next*/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      // The declared Q-08 corpus: deliberate violations, linted only by tests/toolchain.
      "tests/lint-fixtures/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs", ...TS],
    plugins: { cubit },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "cubit/no-rule-suppression": "error",
      "cubit/no-test-skip": "error",
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: TS })),
  {
    files: TS,
    languageOptions: {
      parserOptions: {
        // Anchored to this config's own tree, so linting a scratch copy of the tree in the same
        // process as the tree itself resolves one root per copy instead of guessing between them.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false },
      ],
      "cubit/layer-imports": "error",
      "cubit/no-import-cycle": "error",
    },
  },
);
