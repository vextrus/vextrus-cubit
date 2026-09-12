// AM-09 §1: "src/ui/testids.ts is the single source of every test id … A literal test id string
// anywhere else is a defect; a page object may hold selectors but never invent an id."
//
// WHY A LITERAL IS THE DEFECT. An id spelled in a component is a name with no declaration. Two
// files that each spell one have no way of disagreeing out loud: a rename in one is green in the
// other, and the journey that addressed the old id fails somewhere far from the edit. The registry
// is where an id is DECLARED, so a rename is a typed change with every caller named — and C-05's
// freeze (routes, testids, procedures, fixtures, stdout lines, env vars named before code exists)
// is satisfied by naming the registry keys an increment adds, which cannot be done for a key that
// does not exist.
//
// WHAT IS FLAGGED, AND WHERE THE LINE IS DRAWN. In product source every `data-testid="…"` literal
// is a defect: it either names an id the registry already holds (read the key) or it publishes one
// the registry does not (add the key). In a unit test a literal is flagged only when the product
// PUBLISHES that id — because the registry's own sentence is "every test id the product publishes",
// and a throwaway probe a test renders on its own fixture (`data-testid="cb"` on a Checkbox under
// test) is not an id the product publishes, has no caller to disagree with, and dies with the file.
// A test that addresses a REAL screen's id is exactly the case AM-09 §1 is about, and it is an
// error here.
//
// The ban home is an exact allowlist — the registry and its own acceptance — as R-UI-001's colour
// ban is. A dynamic value (`data-testid="${offending}"`) is not a literal and is left alone.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The only files a test-id literal may be spelled in (AM-09 §1). */
const ALLOWED = [
  "src/ui/testids.ts",
  // The registry's own acceptance: it quotes the ids to hold the registry to them, and a law's
  // test that may not spell the law has stopped testing it.
  "src/ui/testids.test.ts",
  // The rule itself: a ban that may not name what it bans cannot say what it is for.
  "scripts/eslint/rules/no-literal-testid.mjs",
];

const REGISTRY = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "src/ui/testids.ts");

/**
 * Every id the product publishes, read from the registry source, with the key that declares it.
 * @type {Map<string, string> | null}
 */
let published = null;

/** @returns {string} the registry's source, or "" when it cannot be read. */
function readRegistry() {
  try {
    return readFileSync(REGISTRY, "utf8");
  } catch {
    return "";
  }
}

/** @returns {Map<string, string>} id → `TESTIDS.<group>.<key>`, read once per lint run. */
function registry() {
  if (published !== null) return published;
  /** @type {Map<string, string>} */
  const found = new Map();
  published = found;
  const source = readRegistry();
  let group = null;
  for (const line of source.split("\n")) {
    const opens = /^\s{2}([A-Za-z0-9_]+):\s*\{\s*$/.exec(line);
    if (opens) {
      group = opens[1] ?? null;
      continue;
    }
    const entry = /^\s{4}([A-Za-z0-9_]+):\s*"([^"]+)",\s*$/.exec(line);
    if (entry && group !== null) found.set(entry[2] ?? "", `TESTIDS.${group}.${entry[1] ?? ""}`);
  }
  return found;
}

/** A `data-testid="…"` spelling, wherever it sits: a JSX attribute, a selector, a page object. */
const LITERAL = /data-testid="([^"]*)"/g;

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "test ids are declared in src/ui/testids.ts, never spelled as literals (AM-09 §1)" },
    schema: [],
    messages: {
      registered:
        '"{{id}}" is declared in the registry — spell it {{key}} (`data-testid={{{key}}}`, `{...testId({{key}})}` or `testIdSelector({{key}})`). A literal is a name with no declaration, and a rename cannot find it (AM-09 §1)',
      unregistered:
        '"{{id}}" is a test id the registry does not declare — add it to src/ui/testids.ts and read the key here. C-05 freezes the testids an increment adds, which cannot be done for a key that does not exist (AM-09 §1)',
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (ALLOWED.some((allowed) => filename.endsWith(allowed))) return {};
    const isTest = /\.test\.tsx?$/.test(filename) || filename.includes("/__tests__/");
    const text = context.sourceCode.getText();
    const ids = registry();
    return {
      Program: (node) => {
        LITERAL.lastIndex = 0;
        let match = LITERAL.exec(text);
        while (match !== null) {
          const id = match[1] ?? "";
          const key = ids.get(id);
          // A dynamic value is not a literal id, and a test's own throwaway probe is not an id the
          // product publishes — neither is the defect this rule is for.
          if (!id.includes("${") && (key !== undefined || !isTest)) {
            const before = text.slice(0, match.index);
            context.report({
              node,
              loc: { line: before.split("\n").length, column: match.index - (before.lastIndexOf("\n") + 1) },
              messageId: key === undefined ? "unregistered" : "registered",
              data: { id, key: key ?? "" },
            });
          }
          match = LITERAL.exec(text);
        }
      },
    };
  },
};
