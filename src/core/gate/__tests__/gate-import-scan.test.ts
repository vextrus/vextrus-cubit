/**
 * AC-2 — SEAM-GATE's ban has ONE home, and the tree says so (the ban, as a committed scan).
 *
 * "The gate is the sole writer of quantity lines and rail observations (L-MEA-08)." A sole writer is
 * only sole if nothing else can call it, so `src/core/gate` is unreachable from `src/modules/**` and
 * `src/app/**` — the worker's own handler is the one lawful caller (goal). The ban is TOTAL: a
 * type-only import reaches the gate too, which is why the rail↔gate contract lives in
 * `src/core/offers`, where a module may type a rail without touching the gate (riskNotes (2)).
 *
 * No M2 node is toolchain-tagged and `scripts/eslint/**` is locked, so the ban is this committed
 * test over the shipped scanner rather than an ESLint rule — the mechanism L-CAD-06's view-type
 * spellings and L-FRM-06's conversion factors are already banned by (B-17: one way of banning a
 * spelling, not three).
 *
 * This is the test the declared corpus `tests/lint-fixtures/no-gate-outside-worker` is excused by in
 * `tests/toolchain/lint-law.test.ts` (ARCH-01, Q-07). The corpus is judged at the layered address
 * each payload names — its virtual path, read from its last `src/` segment, exactly as the lint-law
 * suite reads one — because that is the address the ban is about: the same spellings that are
 * refused from `src/modules/takeoff/bad.ts` are lawful in `src/worker/good.ts`, and the good half
 * proves the judgement is about the ROOT rather than about a run of characters.
 *
 * The corpus declares its own answer and this prover holds no copy of the import grammar: a payload's
 * basename says whether the scan owes findings at it (`bad.*`) or must be silent over it (`good.*`),
 * and a trailing `GATE-IMPORT` marker says at which lines. A scanner that over-reports an unmarked
 * line and one that misses a marked one both fail — which is the whole use of a corpus, and what an
 * expectation recomputed from the scanner's own predicate could never tell.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, test } from "vitest";

/** The repo root — this file sits at `src/core/gate/__tests__/`. */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/** The layered tree the ban governs, and the declared corpus it is proved on (AC-2). */
const SOURCE_ROOT = join(REPO_ROOT, "src");
const CORPUS = "tests/lint-fixtures/no-gate-outside-worker";
const BAD_MODULES = "src/modules/takeoff/bad.ts";
const BAD_APP = "src/app/bad.ts";
const GOOD_WORKER = "src/worker/good.ts";

/**
 * How a corpus payload declares its own status: the basename says whether the payload is one the scan
 * owes findings at (`bad.*`) or one it must be silent over (`good.*`), and a trailing marker says
 * which LINES are owed. The expectation is read out of those declarations — never recomputed from the
 * import grammar, which would only ask the scanner whether it agrees with itself (B-19).
 */
const BAD_PAYLOAD = "bad.";
const GOOD_PAYLOAD = "good.";
const REPORTED = /\/\/[^\n]*\bGATE-IMPORT:\s*reported\b/u;
const LAWFUL = /\/\/[^\n]*\bGATE-IMPORT:\s*lawful\b/u;

/** The scanner this test drives, at the home the test contract names for it. */
const SCANNER = "src/core/gate/__tests__/gate-import-scan.ts";

/** One finding, as the scanner reports one (test contract). */
type Hit = { file: string; specifier: string; line: number };

type Scanner = {
  scanGateImports: (files: readonly string[]) => readonly Hit[];
  GATE_IMPORT_BANNED_ROOTS: readonly string[];
};

/** The scanner, asserted to be in the checkout first so a missing one names itself. */
async function scanner(): Promise<Scanner> {
  const absolute = join(REPO_ROOT, SCANNER);
  expect(existsSync(absolute), `${SCANNER} is missing from the checkout — the product does not provide the gate-import scan yet`).toBe(true);
  const specifier: string = absolute;
  const loaded = (await import(specifier)) as Record<string, unknown>;
  expect(typeof loaded["scanGateImports"], `${SCANNER} publishes \`scanGateImports(files)\` (test contract)`).toBe("function");
  expect(Array.isArray(loaded["GATE_IMPORT_BANNED_ROOTS"]), `${SCANNER} publishes \`GATE_IMPORT_BANNED_ROOTS\` as a list (test contract)`).toBe(true);
  return loaded as unknown as Scanner;
}

/** Every `.ts`/`.tsx` file under a directory, in a stable code-point order. */
function sourcesUnder(directory: string): string[] {
  // white-box: AC-2 — a ban on reaching a module has no runtime observable: a file that imports the
  // gate and one that does not answer every call identically. Only the file LIST is gathered here —
  // enumerated rather than pinned, so a module added tomorrow is governed with no edit (B-19) — and
  // the judgement itself is the shipped scanner's.
  return readdirSync(directory)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return sourcesUnder(path);
      return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    });
}

/**
 * The layered address a path stands at: everything from its last `src/` segment. A corpus payload
 * physically under `tests/lint-fixtures/**` is judged at the address it names, which is the same
 * reading `tests/toolchain/lint-law.test.ts` gives one — and a real source file already IS its own
 * address, so the same function names both.
 */
function virtualOf(path: string): string {
  const posix = path.split(sep).join("/");
  const at = `/${posix}`.lastIndexOf("/src/");
  return at === -1 ? relative(REPO_ROOT, path).split(sep).join("/") : `/${posix}`.slice(at + 1);
}

/** Sorted by code point — `localeCompare` is not available to this tree (L-REG-05). */
function byCodePoint(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Is this layered address under one of the roots the ban names? */
function underBannedRoot(roots: readonly string[], address: string): boolean {
  return roots.some((root) => address === root || address.startsWith(`${root}/`));
}

/** A corpus payload, as the fixture itself declares it. */
type Payload = {
  /** Where the bytes live. */
  readonly path: string;
  /** The layered address the payload is judged at. */
  readonly address: string;
  /** What the basename declares: a payload the scan owes findings at, or one it must be silent over. */
  readonly status: "bad" | "good";
  /** The lines the payload declares as owed, in order. */
  readonly reported: readonly number[];
  /** The lines the payload declares as lawful reaches — the good half's non-vacuity. */
  readonly lawful: readonly number[];
};

/** The basename of a path, whatever separator the platform spells it with. */
function basenameOf(path: string): string {
  const posix = path.split(sep).join("/");
  return posix.slice(posix.lastIndexOf("/") + 1);
}

/** The lines of a text that carry one of the fixture's markers. */
function markedLines(source: string, marker: RegExp): number[] {
  return source
    .split("\n")
    .map((line, at) => ({ line, at: at + 1 }))
    .filter(({ line }) => marker.test(line))
    .map(({ at }) => at);
}

/**
 * The corpus, read as its own declaration.
 *
 * A payload whose basename is neither `bad.*` nor `good.*` declares nothing, and is refused here
 * rather than quietly ignored: whatever the corpus holds tomorrow is governed with no edit (B-19).
 */
function payloadsOf(corpusRoot: string): Payload[] {
  // white-box: AC-2 — a ban on reaching a module has no runtime observable, so the corpus is the
  // subject and its own text is where its status and its owed lines are declared. Only the fixture's
  // declarations are read (basename, marker comments); no import grammar lives in this prover, so the
  // scanner's judgement is compared against the FIXTURE's and never against itself. This is the
  // increment's declared corpus under tests/lint-fixtures/**, never product source.
  return sourcesUnder(corpusRoot).map((path) => {
    const name = basenameOf(path);
    const status = name.startsWith(BAD_PAYLOAD) ? "bad" : name.startsWith(GOOD_PAYLOAD) ? "good" : "undeclared";
    expect(status, `${virtualOf(path)} declares its status in its basename — a payload is \`${BAD_PAYLOAD}*\` or \`${GOOD_PAYLOAD}*\` (AC-2)`).not.toBe(
      "undeclared",
    );
    const source = readFileSync(path, "utf8");
    return {
      path,
      address: virtualOf(path),
      status: status as "bad" | "good",
      reported: markedLines(source, REPORTED),
      lawful: markedLines(source, LAWFUL),
    };
  });
}

describe("AC-2: the gate is unreachable from the module and app layers", () => {
  test("AC-2: the ban names the two roots it is a ban at", async () => {
    const { GATE_IMPORT_BANNED_ROOTS } = await scanner();
    for (const root of ["src/modules", "src/app"]) {
      expect(
        [...GATE_IMPORT_BANNED_ROOTS],
        `${root} is a root the gate is unreachable from — the worker's handler is the one lawful caller (goal, SEAM-GATE)`,
      ).toContain(root);
      expect(existsSync(join(REPO_ROOT, root)), `${root} is really a layer of this tree — a ban over a root that is not there bans nothing`).toBe(true);
    }
  });

  test("AC-2: no file under src/** in a banned root imports the gate", async () => {
    const { scanGateImports, GATE_IMPORT_BANNED_ROOTS } = await scanner();
    const files = sourcesUnder(SOURCE_ROOT);
    expect(files.length, "src/** holds files to scan — an empty scan judges nothing").toBeGreaterThan(0);
    const governed = files.filter((path) => underBannedRoot(GATE_IMPORT_BANNED_ROOTS, virtualOf(path)));
    expect(governed.length, `src/** holds files under ${GATE_IMPORT_BANNED_ROOTS.join(" and ")} — with none the scan governs nothing`).toBeGreaterThan(0);

    const hits = [...scanGateImports(files)].map((hit) => `${virtualOf(hit.file)}:${hit.line} imports ${JSON.stringify(hit.specifier)}`);
    expect(
      hits,
      "SEAM-GATE makes the gate the sole writer of quantity lines and rail observations, and only src/worker may call it. Type a rail through @/core/offers/contract, and reach the gate through the worker's measure handler.",
    ).toEqual([]);
  });

  test("AC-2: the scan fires on every bad payload of the declared corpus and on none of the lawful one", async () => {
    const { scanGateImports, GATE_IMPORT_BANNED_ROOTS } = await scanner();
    const corpusRoot = join(REPO_ROOT, CORPUS);
    expect(existsSync(corpusRoot), `${CORPUS} is the declared payload this scan is proved on`).toBe(true);
    const files = sourcesUnder(corpusRoot);
    const payloads = payloadsOf(corpusRoot);
    const bad = payloads.filter((payload) => payload.status === "bad");
    const good = payloads.filter((payload) => payload.status === "good");

    // The corpus names itself, so an emptied or renamed one fails here rather than passing silently.
    expect(byCodePoint(bad.map((payload) => payload.address)), `${CORPUS} carries a bad payload at each banned root (AC-2)`).toEqual(
      expect.arrayContaining([BAD_MODULES, BAD_APP]),
    );
    expect(byCodePoint(good.map((payload) => payload.address)), `${CORPUS} carries the lawful counterpart the good half is proved on (AC-2)`).toEqual(
      expect.arrayContaining([GOOD_WORKER]),
    );
    for (const payload of bad) {
      expect(underBannedRoot(GATE_IMPORT_BANNED_ROOTS, payload.address), `${payload.address} is a bad payload, so it stands under a banned root`).toBe(true);
      expect(payload.reported.length, `${payload.address} declares the lines the scan owes it — a bad payload that marks none owes nothing`).toBeGreaterThan(0);
    }
    for (const payload of good) {
      expect(underBannedRoot(GATE_IMPORT_BANNED_ROOTS, payload.address), `${payload.address} is a lawful payload, so it stands outside every banned root`).toBe(
        false,
      );
      expect(payload.lawful.length, `${payload.address} really reaches the gate — a lawful payload that reaches it nowhere proves nothing by going unreported`).toBeGreaterThan(
        0,
      );
      expect(payload.reported, `${payload.address} is lawful at its root, so it declares no line the scan owes`).toEqual([]);
    }

    const found = [...scanGateImports(files)];
    expect(
      byCodePoint([...new Set(found.map((hit) => virtualOf(hit.file)))]),
      "every bad payload of the corpus is reported, and nothing the corpus declares good",
    ).toEqual(byCodePoint(bad.map((payload) => payload.address)));
    expect(
      found.map((hit) => virtualOf(hit.file)),
      `${GOOD_WORKER} spells the very same imports at the one lawful root — reporting it would make the ban about the characters rather than the layer`,
    ).not.toContain(GOOD_WORKER);

    for (const payload of bad) {
      const reported = found.filter((hit) => virtualOf(hit.file) === payload.address);
      expect(
        [...new Set(reported.map((hit) => hit.line))].sort((left, right) => left - right),
        `${payload.address} is reported at exactly the lines it declares owed — a type-only import is a reach too (riskNotes (2)), and a line the fixture leaves unmarked is not one`,
      ).toEqual([...payload.reported]);
    }
  });

  test("AC-2: every finding names the line it was found on, and the specifier that line really spells", async () => {
    const { scanGateImports } = await scanner();
    const corpusRoot = join(REPO_ROOT, CORPUS);
    const files = sourcesUnder(corpusRoot);
    const found = [...scanGateImports(files)];
    expect(found.length, "the declared corpus fires the scan — with no finding there is nothing to read").toBeGreaterThan(0);

    for (const hit of found) {
      const path = files.find((file) => virtualOf(file) === virtualOf(hit.file));
      expect(path, `the finding names a file of the corpus it was scanned over (it named ${hit.file})`).toBeTruthy();
      // white-box: AC-2 — the finding is checked against the fixture line it points at, which is the
      // only way to tell a scan that read the imports from one that counted files. The text read is
      // this increment's own declared corpus, never product source.
      const line = readFileSync(path as string, "utf8").split("\n")[hit.line - 1] ?? "";
      expect(line, `the finding at ${virtualOf(hit.file)}:${hit.line} points at a line that really imports ${JSON.stringify(hit.specifier)}`).toContain(hit.specifier);
    }
  });
});
