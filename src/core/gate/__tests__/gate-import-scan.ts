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
// is one way of banning a spelling in this tree rather than three (B-17). The scanner reads whole
// LINES: a file that mentions the gate in an `import` or `export` statement's specifier is reaching
// it, whatever the spelling — the alias, a relative climb, or a re-export.
import { readFileSync } from "node:fs";

/** The layered roots the gate is unreachable from (goal, SEAM-GATE). */
export const GATE_IMPORT_BANNED_ROOTS: readonly string[] = Object.freeze(["src/modules", "src/app"]);

/** One reach at the gate: the file it was found in, the specifier it spelled, and the line. */
export type GateImport = {
  readonly file: string;
  readonly specifier: string;
  readonly line: number;
};

/**
 * A line of an `import` or `export` statement whose specifier names `core/gate` — the alias
 * (`@/core/gate`), a relative climb (`../core/gate`, `../../core/gate`) and any file beneath it
 * (`@/core/gate/index`) alike. The whole line is the unit judged, so a statement broken across lines
 * is caught at the line that spells the module it reaches.
 */
const REACHES_THE_GATE = /^\s*(?:import|export)\b[^\n]*["']((?:[^"']*\bcore\/gate)(?:\/[^"']*)?)["']/u;

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
    if (!underBannedRoot(virtualPathOf(file))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (const [at, line] of lines.entries()) {
      const reach = REACHES_THE_GATE.exec(line);
      if (reach !== null) found.push({ file, specifier: reach[1] as string, line: at + 1 });
    }
  }
  return Object.freeze(found);
}
