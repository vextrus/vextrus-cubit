/**
 * Acceptance support for inc-004 — the Datum core primitive set (R-UI-010/012/002, B-17, Q-11).
 *
 * The primitives are observed through what the increment declares: the barrel's export names, the
 * seven `data-testid`s of the test contract, the `data-variant`/`data-loading`/`data-basis`/
 * `aria-*` hooks the Design Decision fixes (docs/design/primitives-core.md §7), and — for the
 * criteria that are themselves claims about authored CSS and about a single home — the text of the
 * stylesheets under `src/ui/primitives/core/`. jsdom lays nothing out, so geometry (7 px dot,
 * 2 px stroke, 8 px arms, 4 px offset) is read as authored text, exactly as the increment's risk
 * notes rule.
 *
 * NOTE FOR THE BUILDER: product modules are loaded here by absolute path, so the `@/*` tsconfig
 * alias is never resolved for the specifiers *inside* them either — this tree's vitest configs
 * install no path-alias plugin. Keep imports between src/ files relative.
 *
 * NOTE FOR THE BUILDER: `axe-core` and `@testing-library/user-event` are declared dependencies of
 * this increment and are loaded lazily below — until they are installed these suites fail with
 * `MISSING TEST DEPENDENCY`, which is a dependency map that is not yet complete, not a defect in
 * the primitives.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout these tests run against. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The declared homes (increment interfaces + Design Decision §1). */
export const CORE_DIR = "src/ui/primitives/core";
export const BARREL = `${CORE_DIR}/index.ts`;
export const BASIS_MODULE = `${CORE_DIR}/basis.ts`;
export const RETICLE_CSS = `${CORE_DIR}/reticle.css`;
export const TOKENS_CSS = "src/ui/tokens.css";

/** The reticle's single class name (interfaces line). */
export const RETICLE_CLASS = "cx-reticle";

/**
 * The barrel's declared surface for THIS increment (interfaces: "exports exactly"). A later
 * increment that adds a primitive to this barrel changes the declared interface and re-baselines
 * this list with it (B-20) — which is why the roster is asserted here, in the public set the
 * Builder can read, and never inside a hidden one.
 */
export const CORE_EXPORTS = [
  "Badge",
  "BasisChip",
  "Button",
  "Chip",
  "CoverageChip",
  "Input",
  "Kbd",
  "Skeleton",
  "Textarea",
  "Tooltip",
  "UnitBadge",
] as const;

/** Button's declared variants; `primary` is the default (interfaces line). */
export const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "danger", "act"] as const;
export const DEFAULT_VARIANT = "primary";

/** R-UI-002's basis palette, in the clause's own order. Seven, because the clause fixes seven. */
export const BASES = [
  "MEASURED",
  "TRANSCRIBED",
  "DERIVED",
  "IMPORTED",
  "ENTERED",
  "INTERPRETED",
  "DEFAULTED",
] as const;

/** R-UI-002's glyph table, verbatim from the clause — the law the single home must agree with. */
export const BASIS_GLYPH_LAW: Readonly<Record<string, string>> = {
  MEASURED: "\u25C6",
  TRANSCRIBED: "\u25A3",
  DERIVED: "\u0192",
  IMPORTED: "\u21E9",
  ENTERED: "\u270E",
  INTERPRETED: "\u25A6",
  DEFAULTED: "\u25CB",
};

/** The seven ids of the closed test contract (C-05, Design Decision §7). */
export const TESTIDS = {
  actDot: "act-dot",
  basisChip: "basis-chip",
  basisGlyph: "basis-glyph",
  coverageChip: "coverage-chip",
  unitBadge: "unit-badge",
  tooltipContent: "tooltip-content",
  skeleton: "skeleton",
} as const;

/** The Design Decision §4 sample copy — the composition acceptance renders. */
export const COPY = {
  primary: "Save changes",
  secondary: "Cancel",
  ghost: "Duplicate",
  danger: "Delete line",
  act: "Issue certificate",
  inputLabel: "Project name",
  inputPlaceholder: "e.g. Riverside Tower",
  textareaLabel: "Notes",
  textareaPlaceholder: "Anything the estimator should know",
  badge: "Draft",
  chip: "Layer S-COL",
  unit: "SQM",
  kbd: "K",
  tooltip: "Snap to grid \u2014 S",
  tooltipTrigger: "Snap",
} as const;

export const COVERAGE_SAMPLE = 0.82;

/* ------------------------------------------------------------------ product loading */

/**
 * Import a product module by repo-relative path, asserting it exists first so a module the Builder
 * has not written yet fails as an assertion naming the file, never as an unreadable resolution
 * error. (Same contract as the held-out frame's `productModule`, so both sets read alike.)
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${relative} is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** The barrel, as a bag of named exports. */
export const loadBarrel = (): Promise<Record<string, unknown>> => productModule<Record<string, unknown>>(BARREL);

/** The R-UI-002 glyph home. */
export const loadBasisModule = (): Promise<{ BASIS_GLYPHS?: Record<string, string> }> =>
  productModule<{ BASIS_GLYPHS?: Record<string, string> }>(BASIS_MODULE);

/* ------------------------------------------------------------------ lazy dependencies */

export interface UserEventLike {
  tab(): Promise<void>;
  keyboard(text: string): Promise<void>;
  click(element: Element): Promise<void>;
}

interface UserEventSetup {
  setup(options?: Record<string, unknown>): UserEventLike;
}

/** `@testing-library/user-event` — Q-11's keyboard gestures; a declared dependency of this increment. */
export async function keyboardUser(criterion: string): Promise<UserEventLike> {
  const specifier = "@testing-library/user-event";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — ${criterion} (${String(cause)})`);
  });
  const bag = mod as { default?: UserEventSetup } & Partial<UserEventSetup>;
  const setup = bag.default?.setup ?? bag.setup;
  expect(typeof setup, `${specifier} exposes no setup()`).toBe("function");
  const owner = bag.default ?? bag;
  return (setup as UserEventSetup["setup"]).call(owner, {});
}

export interface AxeViolation {
  id: string;
  impact?: string | null;
  help?: string;
  nodes?: { html?: string }[];
}

interface AxeLike {
  run(context: unknown, options?: Record<string, unknown>): Promise<{ violations: AxeViolation[] }>;
}

/** `axe-core` — Q-11's zero serious/critical; a declared dependency of this increment. */
export async function axeRunner(criterion: string): Promise<AxeLike> {
  const specifier = "axe-core";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — ${criterion} (${String(cause)})`);
  });
  const bag = mod as { default?: AxeLike } & Partial<AxeLike>;
  const axe = typeof bag.run === "function" ? (bag as AxeLike) : bag.default;
  expect(typeof axe?.run, `${specifier} exposes no run()`).toBe("function");
  return axe as AxeLike;
}

/**
 * Q-11: zero serious/critical on the given subtree. The gate is the clause's own two impacts —
 * widening it to any-impact would be widening the law, narrowing it would be hiding a defect.
 */
export async function seriousOrCritical(root: Element, criterion: string): Promise<AxeViolation[]> {
  const axe = await axeRunner(criterion);
  const results = await axe.run(root, { resultTypes: ["violations"] });
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

export function describeViolations(violations: AxeViolation[]): string {
  return violations.map((v) => `${v.impact ?? "?"}: ${v.id} — ${v.help ?? ""} ${v.nodes?.[0]?.html ?? ""}`).join("\n");
}

/* ------------------------------------------------------------------ keyboard travel */

/**
 * The elements Tab reaches, in order, starting from the document body — Q-11's "keyboard journeys
 * begin on the keyboard". Stops when focus leaves the document or returns to an element already
 * seen, so the walk terminates on its own rather than on a frozen count.
 */
export async function tabOrder(user: UserEventLike, limit = 60): Promise<HTMLElement[]> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  const seen: HTMLElement[] = [];
  for (let step = 0; step < limit; step += 1) {
    await user.tab();
    const now = document.activeElement;
    if (!(now instanceof HTMLElement) || now === document.body) break;
    if (seen.includes(now)) break;
    seen.push(now);
  }
  return seen;
}

/**
 * Tab from the document body until the target holds focus — Q-11's "Tab travel reaches the
 * control", and the only sanctioned way to leave focus somewhere before a keyboard gesture.
 */
export async function tabTo(user: UserEventLike, target: Element, what: string, limit = 60): Promise<void> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  for (let step = 0; step < limit; step += 1) {
    await user.tab();
    if (document.activeElement === target) return;
  }
  expect.fail(`Tab travel never reached ${what} — R-UI-012: every interactive element is keyboard reachable`);
}

/* ------------------------------------------------------------------ source & CSS reading */

export function readRepoFile(relative: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** Every file under a repo-relative directory, repo-relative, or [] when the directory is absent. */
export function filesUnder(relativeDir: string): string[] {
  const abs = join(REPO_ROOT, relativeDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true, encoding: "utf8" })
    .map((name) => `${relativeDir}/${String(name).split("\\").join("/")}`)
    .filter((rel) => statSync(join(REPO_ROOT, rel)).isFile());
}

export const coreFiles = (): string[] => filesUnder(CORE_DIR);

/**
 * The slice's files, asserting the slice exists first. Every scan goes through this: a scan over a
 * directory that is not there yet must fail loudly, never pass over an empty list.
 */
export function requireCoreFiles(): string[] {
  const files = coreFiles();
  expect(files, `${CORE_DIR} is missing from the checkout — the product does not provide it yet`).not.toEqual([]);
  return files;
}

export const coreStylesheets = (): string[] => requireCoreFiles().filter((f) => f.endsWith(".css"));
/** The primitives' stylesheet(s): every stylesheet under core/ that is not the reticle's home. */
export const primitiveStylesheets = (): string[] => coreStylesheets().filter((f) => f !== RETICLE_CSS);
export const srcFiles = (): string[] => filesUnder("src");

/**
 * src/ minus the suites that live inside it: a "one home" scan is a claim about the product, and a
 * test that names a token or a glyph in order to judge it is not a second home.
 */
export const productSrcFiles = (): string[] =>
  srcFiles().filter((f) => !/(^|\/)__tests__\//.test(f) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(f));

export interface CssRule {
  selector: string;
  body: string;
}

/** Rule blocks of a stylesheet, at-rules flattened into a `@media … selector` prefix. */
export function cssRules(text: string): CssRule[] {
  const out: CssRule[] = [];
  collectRules(text.replace(/\/\*[\s\S]*?\*\//g, " "), "", out);
  return out;
}

function collectRules(css: string, prefix: string, out: CssRule[]): void {
  let cursor = 0;
  let selectorStart = 0;
  while (cursor < css.length) {
    if (css[cursor] !== "{") {
      cursor += 1;
      continue;
    }
    const selector = css.slice(selectorStart, cursor).trim();
    let depth = 1;
    let end = cursor + 1;
    while (end < css.length && depth > 0) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}") depth -= 1;
      end += 1;
    }
    const body = css.slice(cursor + 1, Math.max(cursor + 1, end - 1));
    const full = prefix === "" ? selector : `${prefix} ${selector}`;
    out.push({ selector: full, body });
    if (body.includes("{")) collectRules(body, full, out);
    cursor = end;
    selectorStart = end;
  }
}

export interface CssDeclaration {
  prop: string;
  value: string;
}

/** The declarations of a leaf rule body. A body that still nests blocks declares nothing itself. */
export function declarations(body: string): CssDeclaration[] {
  if (body.includes("{")) return [];
  const out: CssDeclaration[] = [];
  for (const chunk of body.split(";")) {
    const at = chunk.indexOf(":");
    if (at < 0) continue;
    const prop = chunk.slice(0, at).trim().toLowerCase();
    const value = chunk.slice(at + 1).trim();
    if (prop === "" || value === "") continue;
    out.push({ prop, value });
  }
  return out;
}

/** Every `var(--name)` a text references. */
export function varRefs(text: string): string[] {
  return [...text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1] ?? "");
}

/** Every custom property a text DECLARES (`--name:`), which is how the token roster is derived. */
export function declaredCustomProperties(text: string): string[] {
  return [...text.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[2] ?? "");
}

/** The committed token roster, derived from the generated stylesheet rather than declared here. */
export function tokenNames(): Set<string> {
  return new Set(declaredCustomProperties(readRepoFile(TOKENS_CSS)));
}

/**
 * A token whose value is a bare colour literal is a PALETTE colour: `--graphite-0`, `--act-500`,
 * `--basis-measured`. Composite tokens (`--hairline`, `--shadow-1`) are not, so "this rule may use
 * only the act colours" does not accidentally ban the shadow the Design Decision gives act's hover.
 */
export function paletteColourTokens(): Set<string> {
  const text = readRepoFile(TOKENS_CSS);
  const palette = new Set<string>();
  for (const match of text.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1] ?? "";
    const value = (match[2] ?? "").trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) palette.add(name);
  }
  return palette;
}

/** Colour-bearing CSS properties — the ones whose values R-UI-001 requires to be token reads. */
export const COLOUR_PROPERTIES = [
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline",
  "outline-color",
  "fill",
  "stroke",
  "box-shadow",
  "text-decoration-color",
  "caret-color",
  "accent-color",
];

/** Values a colour-bearing declaration may carry without naming a token: they name no colour. */
export const COLOURLESS_VALUES = ["none", "inherit", "initial", "unset", "revert", "currentcolor", "0"];

/** The colour-literal shapes R-UI-001 bans, built at runtime so this file spells none of them. */
export function colourLiteralHits(text: string): string[] {
  const functions = ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color-mix"];
  const shapes: RegExp[] = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\b0x[0-9a-fA-F]{6,8}\b/g,
    new RegExp(String.raw`\b(?:${functions.join("|")})\s*\(`, "g"),
  ];
  const hits: string[] = [];
  for (const shape of shapes) for (const m of text.matchAll(shape)) hits.push(m[0]);
  return hits;
}
