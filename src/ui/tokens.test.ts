/**
 * inc-003-datum-tokens — public acceptance, AC-1 … AC-4.
 *
 * The founder-final values are read from the law itself (docs/specs/cubit.bible.xml, R-UI-001's
 * table), never re-spelled here. Two reasons, both binding: a colour literal outside
 * `src/ui/tokens.ts` and its generated `src/ui/tokens.css` is unlawful (R-UI-001,
 * cubit/no-colour-literal — this file is not on that allowlist), and a hand-copied table would
 * freeze one reading of the law instead of asserting the law (B-19).
 *
 * Rosters stay open wherever the law leaves them open: a later increment may add tokens, so every
 * assertion is presence, pairing or ordering — never "these keys and no others", except where the
 * spec itself closes the set (three top-level constructs; both themes' key sets equal each other).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";
import unitLaneConfig from "../../vitest.config";
import { darkTokens, emitTokensCss, lightTokens } from "./tokens";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const TOKENS_CSS = "src/ui/tokens.css";
const GLOBALS_CSS = "src/ui/theme/globals.css";
const FONT_DIR = "src/ui/fonts";
const BIBLE = "docs/specs/cubit.bible.xml";
const THIS_TEST = "src/ui/tokens.test.ts";

/* ------------------------------------------------------------------ files */

const at = (path: string): string => join(REPO_ROOT, path);

function readOwned(path: string): string {
  expect(existsSync(at(path)), `${path} is missing — this increment must commit it`).toBe(true);
  return readFileSync(at(path), "utf8");
}

/* -------------------------------------------------------------- css shapes */

type Block = { prelude: string; body: string };
type Decl = { name: string; value: string };

/** Top-level `<prelude> { <body> }` constructs, in source order; comments removed first. */
function blocks(css: string): Block[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Block[] = [];
  let depth = 0;
  let bodyStart = 0;
  let preludeStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) {
        out.push({ prelude: text.slice(preludeStart, i).trim(), body: "" });
        bodyStart = i + 1;
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const open = out[out.length - 1];
        if (open !== undefined) open.body = text.slice(bodyStart, i);
        preludeStart = i + 1;
      }
    }
  }
  return out;
}

/** Custom-property declarations directly in a block's body, in source order. */
function declarations(body: string): Decl[] {
  const out: Decl[] = [];
  let depth = 0;
  let buf = "";
  const flush = (): void => {
    const colon = buf.indexOf(":");
    const name = colon === -1 ? "" : buf.slice(0, colon).trim();
    if (name.startsWith("--")) out.push({ name, value: buf.slice(colon + 1).trim() });
    buf = "";
  };
  for (const ch of body) {
    if (ch === "{" || ch === "}") {
      depth += ch === "{" ? 1 : -1;
      buf = "";
    } else if (ch === ";" && depth === 0) {
      flush();
    } else if (depth === 0) {
      buf += ch;
    }
  }
  flush();
  return out;
}

/**
 * The one comparison used for every value: CSS is insensitive to the spacing around commas, to a
 * run of whitespace and to the quote character, and pinning those would fail a lawful build for a
 * formatting choice the law never made. Hex case is preserved — AC-2 pins it.
 */
const norm = (value: string): string =>
  value.replace(/"/g, "'").replace(/\s*,\s*/g, ",").replace(/\s+/g, " ").trim();

function stylesheet(): { root: Block; dark: Block; media: Block; all: Block[] } {
  const all = blocks(readOwned(TOKENS_CSS));
  expect(
    all.map((b) => b.prelude),
    `${TOKENS_CSS} must hold exactly three top-level constructs: :root, [data-theme="dark"] and one reduced-motion @media (AC-1)`,
  ).toHaveLength(3);
  const [root, dark, media] = all as [Block, Block, Block];
  expect(root.prelude, "the first top-level construct carries the light theme on :root (AC-1)").toBe(":root");
  expect(
    /^\[data-theme=['"]dark['"]\]$/.test(dark.prelude),
    `the second top-level construct carries the dark theme on [data-theme="dark"] — found ${JSON.stringify(dark.prelude)} (AC-1)`,
  ).toBe(true);
  expect(
    /^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/.test(media.prelude),
    `the third top-level construct is one @media (prefers-reduced-motion: reduce) — found ${JSON.stringify(media.prelude)} (AC-1)`,
  ).toBe(true);
  return { root, dark, media, all };
}

/* ------------------------------------------------- R-UI-001's founder table */

const GRAPHITE = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000] as const;
const BEAM = [100, 300, 500, 600, 700] as const;
const ACT = ["surface", "500", "600"] as const;
const SEMANTIC = ["success", "warn", "danger", "info"] as const;
const BASIS = ["measured", "transcribed", "derived", "imported", "entered", "interpreted", "defaulted"] as const;
const ELEMENT = ["wall", "column", "beam", "slab", "footing", "opening", "rebar", "generic"] as const;
const CANVAS = ["paper", "grid", "ink", "selection", "hover", "pulse", "measure", "snap"] as const;
const FONT = ["ui", "mono", "doc"] as const;
const SHADOW = [1, 2, 3, 4] as const;
const TEXT = [12, 13, 14, 16, 20, 24, 32] as const;
const RADIUS = [2, 4, 8, 12] as const;

/** The keys R-UI-001 spells as a light/dark pair — the ones this file must read from the law. */
const LAW_KEYS: string[] = [
  ...GRAPHITE.map((s) => `--graphite-${s}`),
  ...BEAM.map((s) => `--beam-${s}`),
  ...ACT.map((s) => `--act-${s}`),
  ...SEMANTIC.flatMap((s) => [`--${s}`, `--${s}-surface`]),
  ...BASIS.map((s) => `--basis-${s}`),
  ...ELEMENT.map((s) => `--element-${s}`),
  ...CANVAS.map((s) => `--canvas-${s}`),
  ...FONT.map((s) => `--font-${s}`),
  ...SHADOW.map((s) => `--shadow-${s}`),
];

/** R-UI-001's table, parsed out of the Bible: `{ light, dark }` keyed by custom-property name. */
function founderTable(): { light: Record<string, string>; dark: Record<string, string> } {
  const xml = readOwned(BIBLE);
  const clause = /<requirement id="R-UI-001"[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>/.exec(xml);
  expect(clause?.[1], `R-UI-001's founder-final value table is not readable in ${BIBLE}`).toBeTruthy();
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const put = (key: string, l: string, d: string): void => {
    light[key] = l.trim();
    dark[key] = d.trim();
  };
  const rows = new Map<string, string>();
  for (const line of (clause?.[1] ?? "").split("\n")) {
    const row = /^(\w+)\s{2,}(.+)$/.exec(line.trimEnd());
    if (row !== null) rows.set(row[1] as string, row[2] as string);
  }
  // The act row carries a trailing prose note ("500 = fills, …"); no other row does, and a blind
  // strip would eat the shadow row's closing colour function.
  const items = (label: string, dropTrailingNote = false): string[] => {
    const payload = rows.get(label);
    expect(payload, `R-UI-001 has no "${label}" row — the founder table in ${BIBLE} has moved`).toBeTruthy();
    return (dropTrailingNote ? (payload ?? "").replace(/\s*\([^)]*=[^)]*\)\s*$/, "") : (payload ?? ""))
      .split("·")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  for (const [label, prefix] of [
    ["graphite", "--graphite-"],
    ["beam", "--beam-"],
    ["act", "--act-"],
    ["basis", "--basis-"],
    ["element", "--element-"],
    ["canvas", "--canvas-"],
  ] as const) {
    for (const item of items(label, label === "act")) {
      const pair = /^(\S+)\s+(\S+)\/(\S+)$/.exec(item);
      if (pair !== null) put(`${prefix}${pair[1]}`, pair[2] as string, pair[3] as string);
    }
  }
  for (const item of items("semantic")) {
    const pair = /^(\w+)\s+(\S+)\/(\S+)\s+on\s+(?:surface\s+)?(\S+)\/(\S+)$/.exec(item);
    if (pair !== null) {
      put(`--${pair[1]}`, pair[2] as string, pair[3] as string);
      put(`--${pair[1]}-surface`, pair[4] as string, pair[5] as string);
    }
  }
  for (const item of items("shadow")) {
    const pair = /^(\d+):\s*(.+?)\s+\/\s+(.+)$/.exec(item);
    if (pair !== null) put(`--shadow-${pair[1]}`, pair[2] as string, pair[3] as string);
  }
  for (const item of items("font")) {
    const pair = /^(ui|mono|doc)\s+(.+)$/.exec(item);
    if (pair !== null) put(`--font-${pair[1]}`, pair[2] as string, pair[2] as string);
  }

  // A silent parse miss would make every value assertion vacuous — fail loudly instead.
  expect(
    LAW_KEYS.filter((key) => light[key] === undefined || dark[key] === undefined),
    `this test failed to read these keys out of R-UI-001 in ${BIBLE} — the acceptance parser needs repair, not the product`,
  ).toEqual([]);
  return { light, dark };
}

/** The theme-invariant values R-UI-001 states as one number each (no colour literal involved). */
function scalarTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let n = 1; n <= 12; n += 1) out[`--space-${n}`] = `${n * 4}px`;
  for (const r of RADIUS) out[`--radius-${r}`] = `${r}px`;
  out["--hairline"] = "1px solid var(--graphite-200)";
  for (const t of TEXT) out[`--text-${t}`] = `${t}px`;
  out["--leading-ui"] = "1.45";
  out["--weight-heading"] = "600";
  out["--weight-body"] = "400";
  out["--weight-body-medium"] = "500";
  out["--motion-state"] = "160ms";
  out["--motion-panel"] = "240ms";
  out["--motion-flyto"] = "320ms";
  out["--motion-reticle"] = "120ms";
  out["--ease"] = "cubic-bezier(0.2,0,0,1)";
  out["--ease-flyto"] = "cubic-bezier(0.45,0.05,0.25,1)";
  out["--z-base"] = "0";
  out["--z-sticky"] = "100";
  out["--z-overlay"] = "200";
  out["--z-toast"] = "300";
  out["--row-comfortable"] = "36px";
  out["--row-compact"] = "28px";
  return out;
}

/** R-UI-001's emission order, as the prefixes each named group owns. */
const EMISSION_ORDER: readonly (readonly [string, readonly string[]])[] = [
  ["graphite", ["--graphite-"]],
  ["beam", ["--beam-"]],
  ["act", ["--act-"]],
  ["semantic", ["--success", "--warn", "--danger", "--info"]],
  ["basis", ["--basis-"]],
  ["element", ["--element-"]],
  ["canvas", ["--canvas-"]],
  ["space", ["--space-"]],
  ["radius", ["--radius-"]],
  ["hairline", ["--hairline"]],
  ["font", ["--font-"]],
  ["text", ["--text-"]],
  ["leading", ["--leading"]],
  ["weight", ["--weight-"]],
  ["motion", ["--motion-", "--ease"]],
  ["z", ["--z-"]],
  ["breakpoint", ["--breakpoint-"]],
  ["row", ["--row-"]],
  ["shadow", ["--shadow-"]],
];

/** Which group a key belongs to; -1 for a key R-UI-001 does not name (a later increment's). */
const groupOf = (key: string): number =>
  EMISSION_ORDER.findIndex(([, prefixes]) => prefixes.some((prefix) => key.startsWith(prefix)));

function assertEmissionOrder(keys: readonly string[], where: string): void {
  const seen = keys.map((key) => ({ key, group: groupOf(key) })).filter((k) => k.group !== -1);
  const outOfOrder = seen
    .map((entry, i) => ({ entry, previous: seen[i - 1] }))
    .filter((step) => step.previous !== undefined && step.previous.group > step.entry.group)
    .map((step) => `${step.previous?.key} (${EMISSION_ORDER[step.previous?.group ?? 0]?.[0]}) before ${step.entry.key} (${EMISSION_ORDER[step.entry.group]?.[0]})`);
  expect(outOfOrder, `${where} must emit the groups in R-UI-001's emission order (AC-1)`).toEqual([]);
}

/* ------------------------------------------------------------------- AC-1 */

describe("AC-1: one TS source, one generated stylesheet", () => {
  test("AC-1: tokens.ts exports lightTokens, darkTokens and emitTokensCss as plain named exports", () => {
    for (const [name, table] of [["lightTokens", lightTokens], ["darkTokens", darkTokens]] as const) {
      expect(typeof table, `${name} must be an object of custom-property name → value`).toBe("object");
      const entries = Object.entries(table);
      expect(entries.length, `${name} carries no tokens`).toBeGreaterThan(0);
      expect(
        entries.filter(([, value]) => typeof value !== "string").map(([key]) => key),
        `${name} must map every key to a string value`,
      ).toEqual([]);
    }
    expect(typeof emitTokensCss, "emitTokensCss must be a function").toBe("function");
    expect(emitTokensCss().length, "emitTokensCss() returned an empty stylesheet").toBeGreaterThan(0);
  });

  test("AC-1: the committed src/ui/tokens.css is char-for-char emitTokensCss()", () => {
    expect(readOwned(TOKENS_CSS)).toBe(emitTokensCss());
  });

  test("AC-1: the stylesheet is exactly :root, [data-theme=\"dark\"] and one reduced-motion @media, in that order", () => {
    stylesheet();
  });

  test("AC-1: both theme blocks emit R-UI-001's groups in emission order", () => {
    const { root, dark } = stylesheet();
    assertEmissionOrder(declarations(root.body).map((d) => d.name), "the :root block");
    assertEmissionOrder(declarations(dark.body).map((d) => d.name), "the [data-theme=\"dark\"] block");
    assertEmissionOrder(Object.keys(lightTokens), "lightTokens");
    assertEmissionOrder(Object.keys(darkTokens), "darkTokens");
  });

  test("AC-1: every declaration in the stylesheet carries the value tokens.ts exports", () => {
    const { root, dark } = stylesheet();
    for (const [where, block, table] of [
      [":root", root, lightTokens],
      ['[data-theme="dark"]', dark, darkTokens],
    ] as const) {
      const drift = declarations(block.body)
        .filter((d) => norm(d.value) !== norm(table[d.name] ?? ""))
        .map((d) => `${where} ${d.name}: ${d.value} — the TS source says ${String(table[d.name])}`);
      expect(drift, "the stylesheet is generated from tokens.ts, so every value must be the exported one (AC-1)").toEqual([]);
    }
  });

  test("AC-1: pnpm verify's unit lane collects src/ui/tokens.test.ts", () => {
    const lane = unitLaneConfig as { test?: { include?: string[]; exclude?: string[] } };
    const include = lane.test?.include ?? [];
    const exclude = lane.test?.exclude ?? [];
    expect(
      include.some((pattern) => globMatches(pattern, THIS_TEST)),
      `vitest.config.ts's include ${JSON.stringify(include)} does not collect ${THIS_TEST} — pnpm verify's unit lane would never run the drift test (AC-1)`,
    ).toBe(true);
    expect(
      exclude.filter((pattern) => globMatches(pattern, THIS_TEST)),
      `vitest.config.ts excludes ${THIS_TEST} from the unit lane (AC-1)`,
    ).toEqual([]);
  });
});

/** Just enough glob to answer "does this include pattern collect that path?". */
function globMatches(pattern: string, path: string): boolean {
  const source = pattern
    .split("/")
    .map((segment) =>
      segment === "**"
        ? "§§"
        : segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"),
    )
    .join("/")
    .replace(/§§\//g, "(?:[^/]+/)*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${source}$`).test(path);
}

/* ------------------------------------------------------------------- AC-2 */

describe("AC-2: the founder-final values, verbatim", () => {
  test("AC-2: every light/dark pair R-UI-001 states is emitted under its contracted name", () => {
    const law = founderTable();
    const wrong: string[] = [];
    for (const key of LAW_KEYS) {
      for (const [theme, table, expected] of [
        ["light", lightTokens, law.light],
        ["dark", darkTokens, law.dark],
      ] as const) {
        const actual = table[key];
        if (actual === undefined) wrong.push(`${theme} ${key} is missing`);
        else if (norm(actual) !== norm(expected[key] ?? "")) wrong.push(`${theme} ${key} = ${actual}, R-UI-001 says ${String(expected[key])}`);
      }
    }
    expect(wrong, "R-UI-001's values are founder-final law (AC-2)").toEqual([]);
  });

  test("AC-2: the scalar tokens carry R-UI-001's values in both themes", () => {
    const wrong: string[] = [];
    for (const [key, expected] of Object.entries(scalarTokens())) {
      for (const [theme, table] of [["light", lightTokens], ["dark", darkTokens]] as const) {
        const actual = table[key];
        if (actual === undefined) wrong.push(`${theme} ${key} is missing`);
        else if (norm(actual) !== norm(expected)) wrong.push(`${theme} ${key} = ${actual}, R-UI-001 says ${expected}`);
      }
    }
    expect(wrong, "spacing, radii, type, motion, z and row heights are stated once and hold in both themes (AC-2)").toEqual([]);
  });

  test("AC-2: the breakpoints are sm 640, md 960, lg 1280, xl 1680", () => {
    const wrong: string[] = [];
    for (const [name, width] of [["sm", 640], ["md", 960], ["lg", 1280], ["xl", 1680]] as const) {
      for (const [theme, table] of [["light", lightTokens], ["dark", darkTokens]] as const) {
        const actual = table[`--breakpoint-${name}`];
        // R-UI-001 states the number without a unit, so px or unitless both satisfy the law.
        if (actual === undefined || !new RegExp(`^${width}(px)?$`).test(norm(actual))) {
          wrong.push(`${theme} --breakpoint-${name} = ${String(actual)}, R-UI-001 says ${width}`);
        }
      }
    }
    expect(wrong, "the breakpoint scale is founder-final (AC-2)").toEqual([]);
  });
});

/* ------------------------------------------------------------------- AC-3 */

describe("AC-3: identical key sets on both themes", () => {
  test("AC-3: Object.keys(lightTokens) equals Object.keys(darkTokens), order included", () => {
    expect(Object.keys(darkTokens)).toEqual(Object.keys(lightTokens));
  });

  test("AC-3: every exported key is a custom property", () => {
    expect(Object.keys(lightTokens).filter((key) => !key.startsWith("--"))).toEqual([]);
  });

  test("AC-3: every key is declared exactly once in :root and exactly once in [data-theme=\"dark\"]", () => {
    const { root, dark } = stylesheet();
    const expected = [...Object.keys(lightTokens)].sort();
    for (const [where, block] of [[":root", root], ['[data-theme="dark"]', dark]] as const) {
      const names = declarations(block.body).map((d) => d.name);
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
      expect(duplicates, `${where} declares a token twice`).toEqual([]);
      expect([...names].sort(), `${where} must declare exactly the exported token vocabulary — theme-invariant tokens repeated verbatim (AC-3)`).toEqual(expected);
    }
  });
});

/* ------------------------------------------------------------------- AC-4 */

/** Every stylesheet this increment owns. */
function ownedStylesheets(): string[] {
  const root = at("src/ui");
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => entry.endsWith(".css"))
    .map((entry) => `src/ui/${entry}`);
}

function fontFaces(): { prelude: string; decls: Decl[]; raw: string }[] {
  const css = readOwned(GLOBALS_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  return blocks(css)
    .filter((block) => /^@font-face$/i.test(block.prelude))
    .map((block) => ({
      prelude: block.prelude,
      raw: block.body,
      decls: block.body
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.includes(":"))
        .map((part) => ({ name: part.slice(0, part.indexOf(":")).trim().toLowerCase(), value: part.slice(part.indexOf(":") + 1).trim() })),
    }));
}

const declOf = (face: { decls: Decl[] }, name: string): string | undefined => face.decls.find((d) => d.name === name)?.value;

describe("AC-4: the fonts are vendored, never fetched", () => {
  test("AC-4: globals.css declares @font-face for both Spline families at font-weight 400 700", () => {
    const faces = fontFaces();
    expect(faces.length, `${GLOBALS_CSS} declares no @font-face (AC-4)`).toBeGreaterThan(0);
    const families = faces.map((face) => norm(declOf(face, "font-family") ?? "").replace(/'/g, ""));
    for (const family of ["Spline Sans", "Spline Sans Mono"]) {
      expect(families, `${GLOBALS_CSS} must declare @font-face for '${family}' (R-UI-003, AC-4)`).toContain(family);
    }
    const wrongWeight = faces
      .map((face) => ({ family: norm(declOf(face, "font-family") ?? ""), weight: norm(declOf(face, "font-weight") ?? "") }))
      .filter((face) => face.weight !== "400 700")
      .map((face) => `${face.family}: font-weight ${face.weight || "(absent)"}`);
    expect(wrongWeight, "each @font-face declares the variable range font-weight: 400 700 (AC-4)").toEqual([]);
  });

  test("AC-4: every src is a relative url() into src/ui/fonts/, and every vendored woff2 is referenced", () => {
    const vendored = readdirSync(at(FONT_DIR)).filter((file) => file.endsWith(".woff2"));
    expect(vendored.length, `${FONT_DIR} holds no vendored woff2 files`).toBeGreaterThan(0);
    const referenced = new Set<string>();
    const bad: string[] = [];
    for (const face of fontFaces()) {
      const src = declOf(face, "src");
      if (src === undefined) {
        bad.push(`${norm(declOf(face, "font-family") ?? "?")}: no src`);
        continue;
      }
      const urls = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => (m[2] ?? "").trim());
      if (urls.length === 0) bad.push(`${norm(declOf(face, "font-family") ?? "?")}: src declares no url()`);
      for (const url of urls) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//") || url.startsWith("/")) {
          bad.push(`${url} is not a relative url() into ${FONT_DIR} (B-24)`);
          continue;
        }
        const target = resolve(at("src/ui/theme"), url.split("?")[0] ?? url);
        const inside = target.startsWith(`${at(FONT_DIR)}/`);
        if (!inside || !target.endsWith(".woff2")) bad.push(`${url} resolves outside ${FONT_DIR} or is not a .woff2`);
        else if (!existsSync(target)) bad.push(`${url} resolves to a file that does not exist`);
        else referenced.add(target.slice(`${at(FONT_DIR)}/`.length));
      }
    }
    expect(bad, "every face loads from the vendored files in this tree (R-UI-003, B-24, AC-4)").toEqual([]);
    expect(
      vendored.filter((file) => !referenced.has(file)),
      `every vendored woff2 in ${FONT_DIR} must be referenced by a @font-face src (AC-4)`,
    ).toEqual([]);
  });

  test("AC-4: no stylesheet this increment owns fetches over the network", () => {
    const sheets = ownedStylesheets();
    expect(sheets, `this increment owns at least ${TOKENS_CSS} and ${GLOBALS_CSS}`).toContain(GLOBALS_CSS);
    const offences: string[] = [];
    for (const sheet of sheets) {
      const text = readOwned(sheet);
      for (const shape of ["http://", "https://", "//", "data:"]) {
        if (text.includes(shape)) offences.push(`${sheet} contains ${JSON.stringify(shape)}`);
      }
    }
    expect(offences, "a build-time or runtime font fetch is unlawful (R-UI-003, B-24, AC-4)").toEqual([]);
  });

  test("AC-4: the vendored fonts and brand assets are consumed in place, never edited", () => {
    const status = spawnSync("git", ["status", "--porcelain", "--", "src/ui/fonts", "src/ui/brand"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(status.status, `git status failed: ${status.stderr}`).toBe(0);
    expect(status.stdout.trim().split("\n").filter((line) => line.length > 0), "src/ui/fonts and src/ui/brand are consumed in place (AC-4)").toEqual([]);
  });

  test("AC-4: globals.css holds no colour literal — cubit/no-colour-literal stays green", async () => {
    const text = readOwned(GLOBALS_CSS);
    // The tree's own flat config judges the file, at its own path — not a re-spelling of the rule.
    const results = await new ESLint({ cwd: REPO_ROOT }).lintText(text, { filePath: at(GLOBALS_CSS) });
    const colour = results
      .flatMap((result) => result.messages)
      .filter((message) => message.ruleId === "cubit/no-colour-literal")
      .map((message) => `${GLOBALS_CSS}:${message.line} ${message.message}`);
    expect(colour, "a handwritten stylesheet references var(--…) tokens only (R-UI-001, AC-4)").toEqual([]);
  });
});
