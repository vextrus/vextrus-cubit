/**
 * The semantic alias layer (Design Direction 00 §4): the names every component consumes, and the
 * lint that keeps the primitive ramps out of them.
 *
 * What is worth proving is not that the names exist — it is the three properties the layer was
 * introduced for: an alias names a token that exists rather than a literal or a typo; both themes
 * carry the same alias keys, so consumer code never branches on the theme; and the light rendering
 * is unchanged by the migration, because 579 call sites were rewritten under committed baselines.
 * The last one is checked by resolving each alias's `var()` chain and comparing the hex it lands on
 * with the primitive the call site used to spell.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";
import { darkTokens, lightTokens } from "./tokens";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const GLOBALS = readFileSync(resolve(REPO_ROOT, "src/ui/theme/globals.css"), "utf8");

/** The alias prefixes §4.1 introduces; `--cov-` and `--glass-` are §4.3 and §1. */
const ALIAS = /^--(?:surface|ink|line|accent|state|cov|glass|act$)/;

const aliases = (table: Record<string, string>): string[] => Object.keys(table).filter((key) => ALIAS.test(key));

/** Follow `var(--a)` → `var(--b)` → `#hex` inside one theme; the value an alias actually paints. */
function resolveValue(table: Record<string, string>, key: string, seen: string[] = []): string {
  expect(seen, `${key} resolves in a cycle: ${seen.join(" → ")}`).not.toContain(key);
  const value = table[key];
  expect(value, `${key} is not emitted`).toBeDefined();
  const named = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value ?? "");
  return named === null ? (value ?? "") : resolveValue(table, named[1] as string, [...seen, key]);
}

describe("the semantic alias layer", () => {
  test("§4: both themes carry the identical alias key set, so no consumer branches on the theme", () => {
    expect(aliases(lightTokens).length, "the alias group is emitted at all").toBeGreaterThan(30);
    expect(aliases(darkTokens)).toEqual(aliases(lightTokens));
  });

  test("§4: every alias names a token that exists, and resolves to a value — never a literal, never a dangling name", () => {
    for (const table of [lightTokens, darkTokens]) {
      for (const key of aliases(table)) {
        const value = table[key] as string;
        const isVar = /^var\(--[a-z0-9-]+\)$/.test(value);
        const isScalar = /^(?:[0-9.]+(?:px)?)$/.test(value);
        expect(isVar || isScalar, `${key} is "${value}" — an alias is a var() onto a primitive, or a scalar`).toBe(true);
        expect(resolveValue(table, key), `${key} resolves to nothing`).not.toBe("");
      }
    }
  });

  test("§4 rule 1: the migration changed no light value — each alias lands on the primitive its call sites used to spell", () => {
    // The pairs the 579 rewritten call sites went through, in the direction they were rewritten.
    // A mismatch here is a changed pixel under a committed baseline, which is the whole risk.
    const pairs: readonly (readonly [string, string])[] = [
      ["--surface-app", "--graphite-0"], ["--surface-panel", "--graphite-50"],
      ["--surface-sunken", "--graphite-100"], ["--surface-hover", "--graphite-100"],
      ["--surface-active", "--graphite-200"], ["--surface-inverse", "--graphite-900"],
      ["--ink", "--graphite-900"], ["--ink-secondary", "--graphite-700"], ["--ink-muted", "--graphite-600"],
      ["--ink-disabled", "--graphite-500"], ["--ink-code", "--graphite-800"], ["--ink-inverse", "--graphite-0"],
      ["--line", "--graphite-200"], ["--line-strong", "--graphite-300"], ["--line-heavy", "--graphite-400"],
      ["--line-accent", "--beam-500"], ["--accent", "--beam-500"], ["--accent-hover", "--beam-600"],
      ["--accent-active", "--beam-700"], ["--accent-subtle", "--beam-100"], ["--accent-muted", "--beam-300"],
      ["--ink-link", "--beam-600"],
    ];
    for (const [alias, primitive] of pairs) {
      expect(resolveValue(lightTokens, alias), `${alias} must paint what ${primitive} painted (light is baselined)`).toBe(
        lightTokens[primitive],
      );
    }
  });

  test("§4.2: density is one switch at the root, and both densities carry the same keys on the 4-pt grid", () => {
    const block = (selector: string): Record<string, string> => {
      const at = GLOBALS.indexOf(selector);
      expect(at, `globals.css carries a ${selector} block`).toBeGreaterThan(-1);
      const body = GLOBALS.slice(GLOBALS.indexOf("{", at) + 1, GLOBALS.indexOf("}", at));
      return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] as string, (m[2] as string).trim()]));
    };
    const compact = block('[data-density="compact"]');
    const comfortable = block('[data-density="comfortable"]');
    expect(Object.keys(comfortable).sort(), "one density switches the whole set, not a subset").toEqual(
      Object.keys(compact).sort(),
    );
    for (const name of ["--row-h", "--control-h", "--cell-px", "--text-body"]) {
      expect(compact[name], `${name} is switched by density`).toBeDefined();
    }
    for (const table of [compact, comfortable]) {
      for (const [name, value] of Object.entries(table)) {
        const px = /^([0-9]+)px$/.exec(value);
        if (px !== null) expect(Number(px[1]) % 4, `${name}: ${value} is off the 4-pt grid`).toBe(0);
      }
    }
    // The chrome geometry §1 states in numbers — one home, so a template never restates one.
    for (const name of ["--rail-w", "--topbar-h", "--toolbar-h", "--status-h", "--inspector-w", "--icon-md"]) {
      expect(GLOBALS.includes(`${name}:`), `${name} has one home (Design Direction 00 §4.2)`).toBe(true);
    }
  });

  test("§4 rule 3: cubit/no-primitive-token refuses a ramp in a component and admits it in the token source", async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    // Spelled in two halves so this file does not itself hold the shape the rule bans — the last
    // test below lints the whole tree, and a probe baked in whole would be its first offence.
    const probe = `const a = \`color: var(${"--graphite"}-600)\`;\nexport default a;\n`;
    const offending = await eslint.lintText(probe, {
      filePath: resolve(REPO_ROOT, "src/ui/probe.tsx"),
    });
    const ids = (offending[0]?.messages ?? []).map((m) => m.ruleId);
    expect(ids, "a component spelling a ramp position is refused").toContain("cubit/no-primitive-token");

    const source = await eslint.lintText(`--ink: var(${"--graphite"}-900);\n`, {
      filePath: resolve(REPO_ROOT, "src/ui/tokens.css"),
    });
    expect(
      (source[0]?.messages ?? []).map((m) => m.ruleId),
      "the token source is where a ramp is spelled — the rule may not refuse it there",
    ).not.toContain("cubit/no-primitive-token");
  });

  test("§4 rule 3: no file under src/ spells a primitive ramp outside the token source", async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const results = await eslint.lintFiles(["src/**/*.css", "src/**/*.tsx", "src/**/*.ts"]);
    const offences = results.flatMap((r) =>
      r.messages.filter((m) => m.ruleId === "cubit/no-primitive-token").map((m) => `${r.filePath}:${m.line}`),
    );
    expect(offences, "the migration is complete").toEqual([]);
  }, 120_000);
});
