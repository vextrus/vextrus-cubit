// @vitest-environment jsdom
/**
 * AC-3: the members surface's R-UI-050 matrix is mechanical, not aspirational (B-19), and every
 * sentence on it comes from a table (R-SPINE-060).
 *
 * Nothing here is a transcription of what the tree holds today. The route joins the required roster
 * by existing (`routesOnDisk`); the codes the screen owes are read out of the committed Design
 * Decision and intersected with the closed register; the copy expected of the route's own table is
 * parsed from the Decision's §3, which is where C-13 says the copy is authored; and the register's
 * own message and remedy are read from `src/core/errors` rather than respelled here.
 *
 * jsdom, because the completeness of a declared state is a mount rather than a reading.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { STATE_NAMES, missingStates, screenStates } from "../../src/ui/screen-states";
import { REFUSAL_ENTRIES } from "../../src/ui/screen-states/refusal-entries";
import { routesOnDisk } from "../../src/ui/screen-states/route-scan";
import { strings } from "../../src/ui/strings";
import { screenStates as sharedStateCopy } from "../../src/ui/strings/screen-states";
import { hasPerceivableContent, mountState, unmountAll } from "../screen-states/support/matrix-contract";
import { MEMBERS_MODULES, MEMBERS_ROUTE_DIR, MEMBERS_ROUTE_KEY, REFUSAL_REMEDY_TESTID, REFUSAL_STATE_TESTID, byTestId, readText, refusalCodesIn } from "./support/members-page";

// The lane's root, which is the checkout — a test file's `import.meta.url` is not a file URL under
// jsdom, so the path this file resolves against is the runner's own (the matrix suite's precedent).
const REPO_ROOT = process.cwd();
const DECISION = join(REPO_ROOT, "docs", "design", "s-settings.md");

/** R-UI-050's seven as the shell's route-local matrices key them (the PARTICIPANTS_STATES shape). */
const SHELL_STATE_NAMES = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"] as const;

/** The whitespace-collapsed form every comparison is made in. */
const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

/** One registered refusal, as anything that renders one must render it. */
interface Entry {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

const register = REFUSALS as unknown as Record<string, Entry | undefined>;
const declaredEntries = REFUSAL_ENTRIES as unknown as Record<string, Entry | undefined>;

const decisionText = (): string => {
  expect(existsSync(DECISION), "docs/design/s-settings.md is the Decision this screen is built against (C-13)").toBe(true);
  return readFileSync(DECISION, "utf8");
};

/** Every `key` **copy** pair the Decision commits for a table, keyed by the table's own prefix. */
function committedCopy(prefix: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = new RegExp("`(" + prefix + "[a-z0-9_]+)`[ \\n]+\\*\\*([\\s\\S]+?)\\*\\*", "g");
  const text = decisionText();
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const key = match[1];
    const copy = match[2];
    if (key !== undefined && copy !== undefined) found.set(key, norm(copy));
  }
  return found;
}

/** The registered codes the Decision names as reachable on this screen, read out of its §2. */
function codesTheDecisionNames(): string[] {
  const text = decisionText();
  const from = text.indexOf("## 2. States");
  const to = text.indexOf("## 3. Copy");
  expect(from >= 0 && to > from, "the Decision rules its states in a section of their own (C-13)").toBe(true);
  const named = text.slice(from, to).match(/\b[A-Z][A-Z_]{5,}\b/g) ?? [];
  return [...new Set(named)].filter((name) => register[name] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The route's own tables, which do not exist until the Builder writes them. */
async function routeModule(relative: string): Promise<Record<string, unknown>> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as Record<string, unknown>;
}

const membersStrings = async (): Promise<Record<string, string>> => {
  const table = (await routeModule(MEMBERS_MODULES.strings))["membersStrings"];
  expect(typeof table, `${MEMBERS_MODULES.strings} exports membersStrings (the increment's declared interface)`).toBe("object");
  const held: Record<string, string> = {};
  for (const [key, value] of Object.entries(table as Record<string, unknown>)) if (typeof value === "string") held[key] = value;
  return held;
};

afterEach(() => {
  unmountAll();
});

describe("AC-3: the route joins the matrix by existing", () => {
  test("AC-3: the tree-derived route roster holds the members screen", () => {
    expect(routesOnDisk(), `the members screen is a page.tsx at ${MEMBERS_ROUTE_DIR}, so the app router's own roster holds ${MEMBERS_ROUTE_KEY}`).toContain(MEMBERS_ROUTE_KEY);
  });

  test("AC-3: the members screen owes no state", () => {
    expect(missingStates([MEMBERS_ROUTE_KEY]), `${MEMBERS_ROUTE_KEY} declares all seven of R-UI-050's states in src/ui/screen-states/matrix.tsx`).toEqual([]);
  });

  test("AC-3: every declared state mounts and puts something perceivable on the page", () => {
    const declaration = screenStates[MEMBERS_ROUTE_KEY];
    expect(declaration, `${MEMBERS_ROUTE_KEY} is declared in the matrix the suite reflects over`).toBeDefined();
    if (declaration === undefined) return;
    for (const state of STATE_NAMES) {
      const { root } = mountState(declaration[state].render());
      expect(root, `${MEMBERS_ROUTE_KEY}'s ${state} state mounts a root`).not.toBeNull();
      if (root === null) continue;
      expect(root.getAttribute("data-state"), `the mounted ${state} state files itself under its own name`).toBe(state);
      expect(hasPerceivableContent(root), `${MEMBERS_ROUTE_KEY}'s ${state} state renders something a person can perceive (R-UI-050)`).toBe(true);
      unmountAll();
    }
  });
});

describe("AC-3: the refusal vocabulary is the register's own", () => {
  test("AC-3: the mounted refusal state carries a registered code beside a non-empty remedy", () => {
    const declaration = screenStates[MEMBERS_ROUTE_KEY];
    expect(declaration, `${MEMBERS_ROUTE_KEY} is declared`).toBeDefined();
    if (declaration === undefined) return;
    const { container } = mountState(declaration.refusal.render());
    const codes = refusalCodesIn(container);
    expect(codes.length, "the refusal state renders at least one refusal, machine-readably (R-UI-050: code + remedy)").toBeGreaterThan(0);
    for (const code of codes) {
      expect(register[code], `${code} is a code src/core/errors exports — the taxonomy is closed (R-SPINE-062)`).toBeDefined();
    }
    for (const rendered of byTestId(container, REFUSAL_STATE_TESTID)) {
      const code = rendered.getAttribute("data-code") ?? "";
      const entry = register[code];
      expect(entry, `${code} is registered`).toBeDefined();
      const remedy = readText(byTestId(rendered, REFUSAL_REMEDY_TESTID)[0] ?? null);
      expect(remedy.length, `the ${code} refusal renders a remedy, not a code alone (R-UI-050, R-UI-020)`).toBeGreaterThan(0);
      expect(remedy, `the ${code} refusal renders the register's own remedy, verbatim`).toBe(norm(entry?.remedy ?? ""));
    }
  });

  test("AC-3: REFUSAL_ENTRIES gains each code the Decision names, byte-identical to the register", () => {
    const named = codesTheDecisionNames();
    expect(named.length, "the Decision names the registered refusals reachable on this screen (§2)").toBeGreaterThan(0);
    for (const code of named) {
      const declared = declaredEntries[code];
      expect(declared, `src/ui/screen-states/refusal-entries.ts declares ${code} — the Decision names it reachable on this screen`).toBeDefined();
      expect(declared, `${code}'s entry is byte-identical to src/core/errors' own (Q-07, B-17)`).toEqual(register[code]);
    }
  });

  test("AC-3: every code the Decision names has its consumer among the declared states", () => {
    const declaration = screenStates[MEMBERS_ROUTE_KEY];
    expect(declaration, `${MEMBERS_ROUTE_KEY} is declared`).toBeDefined();
    if (declaration === undefined) return;
    const rendered = new Set<string>();
    for (const state of STATE_NAMES) {
      const { container } = mountState(declaration[state].render());
      for (const code of refusalCodesIn(container)) rendered.add(code);
      unmountAll();
    }
    const missing = codesTheDecisionNames().filter((code) => !rendered.has(code));
    expect(missing, "a refusal the Decision rules reachable on this screen is on exhibit in its declared states (R-UI-050, I-62)").toEqual([]);
  });
});

describe("AC-3: the route declares its own states, and says where each lives", () => {
  test("AC-3: MEMBERS_STATES declares all seven cells, and each names something that exists", async () => {
    const declared = (await routeModule(MEMBERS_MODULES.states))["MEMBERS_STATES"];
    expect(typeof declared, `${MEMBERS_MODULES.states} exports MEMBERS_STATES (the increment's declared interface)`).toBe("object");
    const cells = declared as Record<string, Record<string, unknown> | undefined>;
    const decision = decisionText();
    for (const state of SHELL_STATE_NAMES) {
      const cell = cells[state];
      expect(cell, `MEMBERS_STATES declares the ${state} cell — a missing state is a failing test (R-UI-050)`).toBeDefined();
      if (cell === undefined) continue;
      const kind = cell["declared"];
      expect(["rendered", "delegated", "impossible"], `the ${state} cell says one of the three things a cell may say`).toContain(kind);
      if (kind === "rendered") {
        const by = String(cell["by"] ?? "");
        expect(existsSync(join(REPO_ROOT, by)), `the ${state} cell renders in ${by}, which exists`).toBe(true);
        const testId = cell["testId"];
        expect(testId === null || typeof testId === "string", `the ${state} cell names a testid or states it has none`).toBe(true);
        if (typeof testId === "string") {
          expect(decision.includes(testId), `${testId} is a testid the Decision fixes (C-05)`).toBe(true);
        }
      } else if (kind === "delegated") {
        const to = String(cell["to"] ?? "");
        expect(existsSync(join(REPO_ROOT, to)), `the ${state} cell is handed to ${to}, which exists`).toBe(true);
        expect(norm(String(cell["why"] ?? "")).length, `the ${state} cell says why it is handed over`).toBeGreaterThan(0);
      } else {
        expect(norm(String(cell["why"] ?? "")).length, `an impossible ${state} cell is a claim with a reason attached`).toBeGreaterThan(0);
      }
    }
  });
});

describe("AC-3: every sentence comes from a table, by key", () => {
  test("AC-3: membersStrings holds the Decision's copy verbatim, under members_ keys", async () => {
    const table = await membersStrings();
    const keys = Object.keys(table);
    expect(keys.length, "the route table holds the screen's copy").toBeGreaterThan(0);
    expect(
      keys.filter((key) => !key.startsWith("members_")),
      "every key of the route table is a members_ key (the increment's declared interface)",
    ).toEqual([]);
    const committed = committedCopy("members_");
    expect(committed.size, "the Decision commits the route table's copy (C-13 §3)").toBeGreaterThan(0);
    for (const [key, copy] of committed) {
      expect(table[key], `membersStrings.${key} renders the Decision's committed copy verbatim (C-13: copy is design)`).toBe(copy);
    }
  });

  test("AC-3: the shared mirror carries the Decision's matrix copy, and the mirror cannot drift", async () => {
    const table = await membersStrings();
    const shared = sharedStateCopy as unknown as Record<string, string | undefined>;
    const committed = committedCopy("state_");
    expect(committed.size, "the Decision commits the sentences the matrix says for this screen (§3)").toBeGreaterThan(0);
    for (const [key, copy] of committed) {
      expect(shared[key], `src/ui/strings/screen-states.ts holds ${key} as the Decision commits it`).toBe(copy);
      const mirrored = `members_${key.slice("state_members_".length)}`;
      if (key.startsWith("state_members_") && table[mirrored] !== undefined) {
        expect(shared[key], `${key} mirrors ${mirrored} byte for byte — re-wording one without the other is the drift C-13 forbids`).toBe(table[mirrored]);
      }
    }
  });

  test("AC-3: the declared states say only sentences a table publishes", async () => {
    const declaration = screenStates[MEMBERS_ROUTE_KEY];
    expect(declaration, `${MEMBERS_ROUTE_KEY} is declared`).toBeDefined();
    if (declaration === undefined) return;
    const table = await membersStrings();
    const published = new Set<string>();
    for (const value of Object.values(strings)) published.add(norm(value));
    for (const value of Object.values(table)) published.add(norm(value));
    for (const entry of Object.values(register)) {
      if (entry === undefined) continue;
      published.add(norm(entry.message));
      published.add(norm(entry.remedy));
    }
    for (const state of STATE_NAMES) {
      const { container } = mountState(declaration[state].render());
      const runs = [...container.querySelectorAll("*")]
        .flatMap((element) => [...element.childNodes])
        .filter((node) => node.nodeType === 3)
        .map((node) => norm(node.textContent ?? ""))
        .filter((text) => /\p{L}/u.test(text));
      for (const run of runs) {
        expect(published.has(run), `"${run}" is rendered by the ${state} state but is published by no string table (R-SPINE-060)`).toBe(true);
      }
      unmountAll();
    }
  });

  test("AC-3: the route's own components spell no user-facing string in JSX", () => {
    const directory = join(REPO_ROOT, MEMBERS_ROUTE_DIR);
    expect(existsSync(directory), `${MEMBERS_ROUTE_DIR} is the members surface's route directory`).toBe(true);
    const files = readdirSync(directory).filter((name) => name.endsWith(".tsx"));
    expect(files.length, `${MEMBERS_ROUTE_DIR} holds the screen's components`).toBeGreaterThan(0);

    /** The attributes a person reads — an accessible name is copy, so it comes from the table. */
    const NAMING_ATTRIBUTES = new Set(["aria-label", "aria-description", "aria-placeholder", "title", "placeholder", "alt"]);
    const offences: string[] = [];

    for (const name of files) {
      const file = join(directory, name);
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node) && norm(node.text).length > 0) offences.push(`${name}: literal text in JSX — "${norm(node.text)}"`);
        if (ts.isJsxAttribute(node) && node.initializer !== undefined && ts.isStringLiteralLike(node.initializer)) {
          const attribute = node.name.getText(source);
          if (NAMING_ATTRIBUTES.has(attribute)) offences.push(`${name}: ${attribute}="${node.initializer.text}" is copy spelled in JSX`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(offences, "no string literals in JSX except test ids and codes — every sentence comes from the table by key (R-SPINE-060)").toEqual([]);
  });
});
