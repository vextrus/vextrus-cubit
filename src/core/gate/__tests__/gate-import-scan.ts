// SEAM-GATE's ban, as a committed scan: nothing under `src/modules/**` or `src/app/**` may import
// `src/core/gate`.
//
// "The gate is the sole writer of quantity lines and rail observations (L-MEA-08)" — and a sole
// writer is only sole if nothing else can call it. The worker's measure handler is the one lawful
// caller, which is the composition root ARCH-01 already lets hold both halves.
//
// The ban is TOTAL: a type-only import reaches the gate too, which is why the rail↔gate contract
// lives in `src/core/offers` — a module that has to type a rail imports that and never this
// (riskNotes (2)).
//
// It is a scan rather than an ESLint rule because `scripts/eslint/**` is locked at M2: the same
// mechanism L-CAD-06's view-type spellings and L-FRM-06's conversion factors are banned by, so there
// is one way of banning a spelling in this tree rather than three (B-17).
//
// What is judged is the MODULE SPECIFIER of a statement that reaches another module — the specifier
// of an `import`/`export … from` declaration, of a bare `import "…"`, of a dynamic `import("…")` and
// of a `require("…")` — never a run of characters on a line. So a statement broken across lines is
// caught at the line that spells the module it reaches, and prose or a plain string that names the
// gate without importing it is not a reach and is not reported.
import { readFileSync } from "node:fs";

/** The layered roots the gate is unreachable from (goal, SEAM-GATE). */
export const GATE_IMPORT_BANNED_ROOTS: readonly string[] = Object.freeze(["src/modules", "src/app"]);

/** The module the ban is about, at its layered address. */
const GATE_MODULE = "src/core/gate";

/** A specifier that names the gate outright, whatever it resolves to from where it was written. */
const NAMES_THE_GATE = /(^|\/)core\/gate(\/|$)/u;

/** How this tree spells the source root in an alias (`@/core/gate` is `src/core/gate`). */
const ALIAS = "@/";
const ALIAS_ROOT = "src";

/** One reach at the gate: the file it was found in, the specifier it spelled, and the line. */
export type GateImport = {
  readonly file: string;
  readonly specifier: string;
  readonly line: number;
};

/** One thing a source text is made of, as far as finding a module specifier needs to know. */
type Token =
  | { readonly shape: "word"; readonly text: string; readonly line: number }
  | { readonly shape: "punct"; readonly text: string; readonly line: number }
  | { readonly shape: "string"; readonly text: string; readonly line: number };

/** Is this character one an identifier or keyword is spelled with? */
function isWordChar(char: string): boolean {
  return /[\w$]/u.test(char);
}

/**
 * The text, as words, punctuation and string literals — with comments dropped.
 *
 * A hand-written pass rather than a parser: the tree holds no TypeScript parser it may import here,
 * and what this has to tell apart is exactly what a comment, a string and a keyword are. Every token
 * carries the line it began on, because a finding names the line that spells the module reached.
 */
function tokensOf(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  let line = 1;
  while (at < source.length) {
    const char = source[at] as string;
    if (char === "\n") {
      line += 1;
      at += 1;
      continue;
    }
    if (char === "/" && source[at + 1] === "/") {
      while (at < source.length && source[at] !== "\n") at += 1;
      continue;
    }
    if (char === "/" && source[at + 1] === "*") {
      at += 2;
      while (at < source.length && !(source[at] === "*" && source[at + 1] === "/")) {
        if (source[at] === "\n") line += 1;
        at += 1;
      }
      at += 2;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const began = line;
      const quote = char;
      let text = "";
      at += 1;
      while (at < source.length && source[at] !== quote) {
        if (source[at] === "\\") {
          text += source[at + 1] ?? "";
          at += 2;
          continue;
        }
        if (source[at] === "\n") line += 1;
        text += source[at];
        at += 1;
      }
      at += 1;
      tokens.push({ shape: "string", text, line: began });
      continue;
    }
    if (isWordChar(char)) {
      let text = "";
      while (at < source.length && isWordChar(source[at] as string)) {
        text += source[at];
        at += 1;
      }
      tokens.push({ shape: "word", text, line });
      continue;
    }
    if (/\s/u.test(char)) {
      at += 1;
      continue;
    }
    tokens.push({ shape: "punct", text: char, line });
    at += 1;
  }
  return tokens;
}

/** How far past a keyword a module specifier can stand — a clause, never a whole file. */
const CLAUSE_LIMIT = 256;

/** Punctuation that ends a statement's reach: past one of these there is no specifier to find. */
const CLAUSE_ENDS: readonly string[] = Object.freeze([";", "="]);

/**
 * Every module specifier the text reaches another module by, with the line that spells it.
 *
 * `import` reaches one whether or not it says `from` (a bare `import "…"` and a dynamic
 * `import("…")` both do); `export` reaches one only through `from`, so `export const x = "…"` — a
 * string that merely NAMES a module — is not a reach and is not reported. `import.meta` is not a
 * reach either, and `require("…")` is.
 */
function specifiersOf(source: string): { specifier: string; line: number }[] {
  const tokens = tokensOf(source);
  const reaches: { specifier: string; line: number }[] = [];

  for (const [at, token] of tokens.entries()) {
    if (token.shape !== "word") continue;
    const keyword = token.text;
    if (keyword !== "import" && keyword !== "export" && keyword !== "require") continue;
    const before = tokens[at - 1];
    if (before?.shape === "punct" && before.text === ".") continue;
    const next = tokens[at + 1];
    // `import.meta` names this module's own metadata; it reaches nothing.
    if (keyword === "import" && next?.shape === "punct" && next.text === ".") continue;
    // A `require` this tree ever spells is a call: anything else of that name is an identifier.
    if (keyword === "require" && !(next?.shape === "punct" && next.text === "(")) continue;

    let saidFrom = false;
    for (let ahead = at + 1; ahead < tokens.length && ahead <= at + CLAUSE_LIMIT; ahead += 1) {
      const candidate = tokens[ahead] as Token;
      if (candidate.shape === "punct" && CLAUSE_ENDS.includes(candidate.text)) break;
      if (candidate.shape === "word" && (candidate.text === "import" || candidate.text === "export")) break;
      if (candidate.shape === "word" && candidate.text === "from") {
        saidFrom = true;
        continue;
      }
      if (candidate.shape !== "string") continue;
      if (keyword === "export" && !saidFrom) break;
      reaches.push({ specifier: candidate.text, line: candidate.line });
      break;
    }
  }
  return reaches;
}

/**
 * The layered address a path stands at: everything from its last `src/` segment. A corpus payload
 * physically under `tests/lint-fixtures/**` is judged at the address it names — the ban is about the
 * ROOT a file stands in, not about where the bytes happen to live — and a real source file already
 * IS its own address, so one reading names both.
 */
function virtualPathOf(path: string): string {
  const posix = path.split("\\").join("/");
  const at = `/${posix}`.lastIndexOf("/src/");
  return at === -1 ? posix : `/${posix}`.slice(at + 1);
}

/** Does this layered address stand under one of the roots the ban names? */
function underBannedRoot(address: string): boolean {
  return GATE_IMPORT_BANNED_ROOTS.some((root) => address === root || address.startsWith(`${root}/`));
}

/** A path with its `.` and `..` segments taken out, so two spellings of one module read the same. */
function flattened(segments: readonly string[]): string {
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      kept.pop();
      continue;
    }
    kept.push(segment);
  }
  return kept.join("/");
}

/**
 * Where a specifier written in one file lands, as a layered address — the alias against the source
 * root, a relative climb against the file's own address. A bare package name lands nowhere in this
 * tree, and answers nothing.
 */
function landsAt(specifier: string, address: string): string | null {
  if (specifier.startsWith(ALIAS)) return flattened([ALIAS_ROOT, ...specifier.slice(ALIAS.length).split("/")]);
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const directory = address.slice(0, Math.max(0, address.lastIndexOf("/")));
    return flattened([...directory.split("/"), ...specifier.split("/")]);
  }
  return null;
}

/**
 * Does this specifier reach the gate?
 *
 * Two readings, because the ban is on the MODULE and a spelling is only evidence of it: a specifier
 * that lands on `src/core/gate` from where it was written reaches it, and so does one that names the
 * module outright (`@/core/gate`, `../../core/gate`, `src/core/gate/index`) however it resolves.
 */
function reachesTheGate(specifier: string, address: string): boolean {
  const landing = landsAt(specifier, address);
  if (landing !== null && (landing === GATE_MODULE || landing.startsWith(`${GATE_MODULE}/`))) return true;
  return NAMES_THE_GATE.test(specifier);
}

/**
 * Every reach at the gate from a file the ban governs.
 *
 * A file outside the banned roots is read and reported on never: the worker's own handler spells the
 * very same imports lawfully, so a scan that fired on the characters rather than on the layer would
 * ban the one caller the seam exists to have.
 */
export function scanGateImports(files: readonly string[]): readonly GateImport[] {
  const found: GateImport[] = [];
  for (const file of files) {
    const address = virtualPathOf(file);
    if (!underBannedRoot(address)) continue;
    // white-box: AC-2 — a ban on reaching a module has no runtime observable: a file that imports the
    // gate and one that does not answer every call identically, so the text is the only subject there
    // is. This is the shipped scanner the criterion drives, and it reads the imports it bans.
    const source = readFileSync(file, "utf8");
    for (const reach of specifiersOf(source)) {
      if (!reachesTheGate(reach.specifier, address)) continue;
      found.push({ file, specifier: reach.specifier, line: reach.line });
    }
  }
  return Object.freeze(found);
}
