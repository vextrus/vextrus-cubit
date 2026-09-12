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

/** sRGB channel → linear light, as WCAG 2.1 defines it; the ratio the depth tests below measure. */
function channel(byte: number): number {
  const unit = byte / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(colour: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  expect(hex, `"${colour}" is not a six-digit hex colour`).not.toBeNull();
  const digits = (hex as RegExpExecArray)[1] as string;
  const [red, green, blue] = [0, 2, 4].map((at) => channel(Number.parseInt(digits.slice(at, at + 2), 16)));
  return 0.2126 * (red as number) + 0.7152 * (green as number) + 0.0722 * (blue as number);
}

/** The WCAG contrast ratio between two resolved token values. */
function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter as number) + 0.05) / ((darker as number) + 0.05);
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
      ["--surface-inverse", "--graphite-900"],
      ["--ink", "--graphite-900"], ["--ink-secondary", "--graphite-700"], ["--ink-muted", "--graphite-600"],
      ["--ink-disabled", "--graphite-500"], ["--ink-code", "--graphite-800"], ["--ink-inverse", "--graphite-0"],
      ["--line", "--graphite-200"], ["--line-strong", "--graphite-300"], ["--line-heavy", "--graphite-400"],
      ["--line-accent", "--beam-500"], ["--accent", "--beam-500"], ["--accent-hover", "--beam-600"],
      ["--accent-active", "--beam-700"], ["--accent-subtle", "--beam-100"], ["--accent-muted", "--beam-300"],
      ["--ink-link", "--beam-600"], ["--line-quiet", "--graphite-100"],
    ];
    // EVERY pair holds in BOTH tables, and that is not luck: what flips between the themes is the
    // graphite RAMP itself (`--graphite-0` is the page in light and the pit in dark), so an alias
    // that named the right step of the ramp in light names the right step in dark under the same
    // name — `--ink-inverse` is `--graphite-0` in both. The aliases that really do change index
    // (`--surface-raised`, `--surface-overlay`) are NOT on this list, because no call site was
    // rewritten to them from a fixed primitive. So a dark value that moves here is a dark baseline
    // that moved, and the dark baselines are committed too (B-20).
    // Three aliases LEFT this list on 2026-09-12, in the commit that gave the depth model distinct
    // values: `--surface-sunken` (light unchanged, dark moved to the app ground so a well is darker
    // than the panel it is cut into), `--surface-hover` and `--surface-active` (both moved in both
    // themes, because hover painted the same graphite-100 the overlay painted and gave 1.00:1 of
    // feedback in dark). Their new values are asserted below, as properties rather than as origins:
    // an origin is only worth asserting while the origin is the thing under baseline.
    for (const [alias, primitive] of pairs) {
      expect(resolveValue(lightTokens, alias), `${alias} must paint what ${primitive} painted (light is baselined)`).toBe(
        lightTokens[primitive],
      );
      expect(
        resolveValue(darkTokens, alias),
        `${alias} must paint in DARK what ${primitive} painted in dark — the call sites rewritten to it spelled ${primitive} in both themes, and the dark baselines are committed (B-20)`,
      ).toBe(darkTokens[primitive]);
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

  test("§4.1: the depth model is five DIFFERENT values — two meanings are never one colour", () => {
    // The defect this replaces: `--surface-raised`, `--surface-overlay`, `--surface-sunken` and
    // `--surface-hover` all resolved to graphite-100 in dark and raised/overlay resolved to the app
    // ground itself in light. Every menu, combobox popover, dropdown and breadcrumb menu in the
    // product therefore gave ZERO state feedback on hover, and a dialog had no edge. A table that
    // says five things cannot be four values.
    // The four the adversary found collapsed, plus the app ground they must each be told apart
    // FROM. `--surface-panel` is deliberately not on this list: a card is panel MATERIAL lifted by
    // `--shadow-1` and bounded by `--line-raised`, and a card never sits inside a rail or a drawer.
    // What must never collide is a surface with the surface it SITS ON, and that is asserted here
    // and in the two tests below.
    const depth = ["--surface-overlay", "--surface-sunken", "--surface-hover", "--surface-overlay-hover"] as const;
    for (const [theme, table] of [["light", lightTokens], ["dark", darkTokens]] as const) {
      const seen = new Map<string, string>();
      for (const alias of depth) {
        const value = resolveValue(table, alias);
        const already = seen.get(value);
        expect(
          already,
          `${theme}: ${alias} and ${String(already)} are both ${value} — two different meanings, one colour, so the one that sits on the other is invisible (§4.1)`,
        ).toBeUndefined();
        seen.set(value, alias);
      }
    }
  });

  test("§4.1: hover is a MEASURABLE step from the overlay it sits on, in both themes", () => {
    // 1.3:1 is the bar this increment set: below it a hovered menu item is a guess. Light measured
    // 1.06:1 and dark 1.00:1 before the re-point; they measure 1.34 and 1.60 after.
    for (const [theme, table] of [["light", lightTokens], ["dark", darkTokens]] as const) {
      const measured = contrast(resolveValue(table, "--surface-overlay-hover"), resolveValue(table, "--surface-overlay"));
      expect(
        measured,
        `${theme}: a hovered item in a menu or popover measures ${measured.toFixed(2)}:1 against the overlay it sits in`,
      ).toBeGreaterThanOrEqual(1.3);
      const row = contrast(resolveValue(table, "--surface-hover"), resolveValue(table, "--surface-panel"));
      expect(row, `${theme}: a hovered ROW measures ${row.toFixed(2)}:1 against the panel it sits on`).toBeGreaterThanOrEqual(1.15);
      const pressed = contrast(resolveValue(table, "--surface-active"), resolveValue(table, "--surface-hover"));
      expect(pressed, `${theme}: pressed is a step beyond hovered, not the same step back`).toBeGreaterThanOrEqual(1.2);
    }
  });

  test("§4.1 + SC 1.4.11: a surface that floats above the app ground has an edge a reader can see", () => {
    // A card, a menu, a popover and a dialog are each a `--surface-raised`/`--surface-overlay` fill
    // on the app ground. Their fills are one ramp step apart at most — the ramp has no more room at
    // the surface end — so the EDGE is what says where the component begins, and SC 1.4.11 asks 3:1
    // of it. `--line` is the seam between two DOCKED surfaces and measures 1.22:1; `--line-raised`
    // is the boundary of a floating one.
    for (const [theme, table] of [["light", lightTokens], ["dark", darkTokens]] as const) {
      const measured = contrast(resolveValue(table, "--line-raised"), resolveValue(table, "--surface-app"));
      expect(measured, `${theme}: the edge of a floating surface measures ${measured.toFixed(2)}:1 against the app ground`).toBeGreaterThanOrEqual(3);
      for (const floating of ["--surface-raised", "--surface-overlay"] as const) {
        const onFill = contrast(resolveValue(table, floating), resolveValue(table, "--surface-app"));
        const onEdge = contrast(resolveValue(table, "--line-raised"), resolveValue(table, floating));
        expect(
          Math.max(onFill, onEdge),
          `${theme}: ${floating} is ${onFill.toFixed(2)}:1 from the app ground and its edge is ${onEdge.toFixed(2)}:1 from the fill — neither says where it begins`,
        ).toBeGreaterThanOrEqual(3);

      }
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
