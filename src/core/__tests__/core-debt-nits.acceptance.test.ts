/**
 * Public acceptance for AC-6: the nits are corrected and nothing else moves.
 *
 * Four of the five rows here are facts about a module's TEXT — a stale comment, a `readonly`
 * modifier, a filter stated beside RLS, a durability claim — so four of them are graded by reading
 * the source with its comments removed (or, where the row IS about a comment, by reading the
 * comments). That is the only way a comment can be graded at all; B-05's answer to "prose is not
 * enforcement" is a check, and this file is it.
 *
 * `RefusalEntry`'s readonly-ness is graded twice on purpose: once at COMPILE time, which is what the
 * criterion asks for and what `pnpm verify` runs, and once as a check the acceptance lane can also
 * report — a conditional type is invisible to a runner that does not typecheck.
 *
 * B-19: nothing here freezes a roster, a message or a count. No refusal code, message, remedy,
 * severity or surface is transcribed — `src/core/errors/taxonomy.test.ts` owns the registry's
 * contract and stays green, unedited, beside this file.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, codeOf, commentsOf, sourceOf } from "./support/read-source";

const CONSEQUENCE_MODULE = "src/core/acts/consequence.ts";
const PARTICIPATION_MODULE = "src/core/acts/participation.ts";
const ACTS_BARREL = "src/core/acts/index.ts";
const REASON_MODULE = "src/core/db/reason.ts";
const ERRORS_MODULE = "src/core/errors.ts";
const STORAGE_MODULE = "src/core/storage/index.ts";

/* ------------------------------------------------------------------ *
 * The compile-time half of AC-6: `RefusalEntry`'s fields are readonly.
 * ------------------------------------------------------------------ */

/** The taxonomy's surface as tsc reads it — a type position, erased before the transform sees it. */
type Errors = typeof import("../errors");

/** The registered entry's own type, read off the module rather than transcribed here. */
type RegisteredEntry = import("../errors").RefusalEntry;

/** Type identity, the one comparison that can see a `readonly` modifier at all. */
type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

/**
 * True iff EVERY field of `T` is already readonly: adding the modifier to all of them changes
 * nothing. A mutable field makes the two mapped types different types, and `const … : false = true`
 * is the compile error AC-6 asks for.
 */
type EveryFieldReadonly<T> = IfEquals<{ readonly [K in keyof T]: T[K] }, { [K in keyof T]: T[K] }, true, false>;

/** AC-6: an entry read out of REFUSALS cannot be reassigned through the type. */
export type RefusalEntryIsReadonly = EveryFieldReadonly<RegisteredEntry>;
export const refusalEntryIsReadonly: RefusalEntryIsReadonly = true;

/* ------------------------------------------------------------------ *
 * The runtime half.
 * ------------------------------------------------------------------ */

/** A consequence subject, as `movesNothing` reads one. */
type Consequence = typeof import("../acts/consequence");
type MovesNothing = Consequence["movesNothing"];
type Judged = Parameters<MovesNothing>[0];

async function loadModule<T>(relative: string, why: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — ${why}`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/**
 * A type alias's declared object body, read by matching braces so every member is graded however
 * the declaration is laid out — and `Readonly<{ … }>` recognised as the other lawful spelling of
 * the same fact.
 */
function declaredShapeOf(code: string, name: string): { found: boolean; body: string; wrappedReadonly: boolean } {
  const declared = new RegExp(`export\\s+type\\s+${name}\\s*=\\s*`).exec(code);
  if (declared === null) return { found: false, body: "", wrappedReadonly: false };
  const after = code.slice(declared.index + declared[0].length);
  const wrappedReadonly = /^Readonly\s*</.test(after);
  const opened = after.indexOf("{");
  if (opened < 0) return { found: true, body: "", wrappedReadonly };
  let depth = 0;
  for (let at = opened; at < after.length; at += 1) {
    if (after[at] === "{") depth += 1;
    else if (after[at] === "}") {
      depth -= 1;
      if (depth === 0) return { found: true, body: after.slice(opened + 1, at), wrappedReadonly };
    }
  }
  return { found: true, body: after.slice(opened + 1), wrappedReadonly };
}

/**
 * The declared fields of a type alias that do NOT carry `readonly`, trimmed. Either spelling of the
 * fact answers the same way: fields that each state the modifier, or a shape wrapped in `Readonly<>`.
 */
function mutableFieldsOf(code: string, name: string): string[] {
  const declaration = declaredShapeOf(code, name);
  if (!declaration.found || declaration.wrappedReadonly) return [];
  return declaration.body
    .split("\n")
    .filter((line) => /^\s*(?:readonly\s+)?[A-Za-z_$][\w$]*\??\s*:/.test(line))
    .filter((line) => !/^\s*readonly\s/.test(line))
    .map((line) => line.trim());
}

/** One act judging one subject, moving it from `before` to `after`. */
function consequenceOver(before: readonly string[], after: readonly string[]): Judged {
  return {
    actType: "ASSIGN_PARTICIPANT_ROLE",
    tenantId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
    rendering: "SUBJECTS",
    subjects: [{ subjectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3303", before, after }],
  } as Judged;
}

describe("AC-6: movesNothing judges a subject by content, not by position", () => {
  test("AC-6: the same roles in a different order move nothing", async () => {
    const { movesNothing } = await loadModule<Consequence>(CONSEQUENCE_MODULE, "L-ACT-02's consequence has one home (ARCH-02)");
    expect(
      movesNothing(consequenceOver(["MEASURER", "REVIEWER"], ["REVIEWER", "MEASURER"])),
      "an act that ends a subject holding exactly what it held records nothing, however the two readings happen to be ordered (L-ACT-01)",
    ).toBe(true);
    expect(movesNothing(consequenceOver(["LEAD", "MEASURER", "REVIEWER"], ["REVIEWER", "LEAD", "MEASURER"])), "order is a property of how a reading was built, never of what it says").toBe(true);
    expect(movesNothing(consequenceOver([], [])), "a subject that held nothing and holds nothing moved nothing").toBe(true);
    expect(movesNothing(consequenceOver(["MEASURER"], ["MEASURER"])), "the reading this seam already made must stay true").toBe(true);
  });

  test("AC-6: an act that really moves something is still not nothing", async () => {
    const { movesNothing } = await loadModule<Consequence>(CONSEQUENCE_MODULE, "L-ACT-02's consequence has one home (ARCH-02)");
    expect(movesNothing(consequenceOver(["MEASURER"], ["MEASURER", "REVIEWER"])), "a role granted is a move").toBe(false);
    expect(movesNothing(consequenceOver(["MEASURER", "REVIEWER"], ["MEASURER"])), "a role withdrawn is a move").toBe(false);
    expect(movesNothing(consequenceOver(["MEASURER"], ["REVIEWER"])), "one role swapped for another is a move").toBe(false);
    expect(movesNothing(consequenceOver([], ["MEASURER"])), "a first grant is a move").toBe(false);
  });
});

describe("AC-6: db/reason.ts no longer says the fault seam is unbuilt", () => {
  test("AC-6: the recorder hook's comment states something true about ARCH-03's seam", async () => {
    const source = sourceOf(REASON_MODULE, "SEAM-TENANT records a system reason through this hook");
    expect(
      /not\s+built\s+yet|is\s+not\s+built|isn't\s+built/i.test(source),
      `${REASON_MODULE} must stop saying ARCH-03's fault seam is unbuilt — src/core/faults/report.ts is in the tree, and prose that contradicts the tree is worse than no prose (B-05)`,
    ).toBe(false);
    // Whatever seam the comment now names must be a file that is actually there: a corrected comment
    // pointing at nothing would be the same defect wearing a different sentence.
    for (const named of source.match(/src\/[A-Za-z0-9_.\-/]+\.tsx?/g) ?? []) {
      expect(existsSync(join(REPO_ROOT, named)), `${REASON_MODULE} names ${named}, which is not in the checkout`).toBe(true);
    }
  });
});

describe("AC-6: RefusalEntry's fields are readonly", () => {
  test("AC-6: every field of the RefusalEntry declaration carries readonly", async () => {
    // The scan is graded before it grades anything: a shape spelled the way this row asks must read
    // as readonly, and one spelled the way it stands today must not. A scan that cannot tell the two
    // apart would pass whatever the tree said, which is the hollow check B-05 is aimed at.
    expect(mutableFieldsOf("export type Probe = {\n  readonly one: string;\n  readonly two: { nested: string };\n};\n", "Probe"), "the scan reads a readonly shape as readonly").toEqual([]);
    expect(mutableFieldsOf("export type Probe = {\n  readonly one: string;\n  two: string;\n};\n", "Probe"), "…and finds the field that is not").toEqual(["two: string;"]);
    expect(mutableFieldsOf("export type Probe = Readonly<{\n  one: string;\n};>\n", "Probe"), "…and reads the wrapped spelling as the same fact").toEqual([]);

    const code = codeOf(ERRORS_MODULE, "R-SPINE-062's closed taxonomy has one home (ARCH-02)");
    expect(declaredShapeOf(code, "RefusalEntry").found, `${ERRORS_MODULE} must declare RefusalEntry`).toBe(true);
    expect(
      mutableFieldsOf(code, "RefusalEntry"),
      "every field of RefusalEntry must be readonly — an entry read out of REFUSALS is the registered answer, never a mutated one (R-SPINE-062)",
    ).toEqual([]);
    // The registry itself is untouched by this row: it was frozen entry by entry before and stays so.
    const { REFUSALS, refusalOf } = await loadModule<Errors>(ERRORS_MODULE, "the taxonomy is closed and this is its one home");
    for (const [code_, entry] of Object.entries(REFUSALS)) {
      expect(Object.isFrozen(entry), `REFUSALS.${code_} stays frozen — the readonly modifier is the type's half of the same fact`).toBe(true);
      expect(refusalOf(entry.code), `refusalOf must answer with the registered entry for ${code_}`).toBe(entry);
    }
  });
});

describe("AC-6: the participation read states its tenant filter beside RLS", () => {
  test("AC-6: the filter is stated in the query, and no exported signature moves", async () => {
    const code = codeOf(PARTICIPATION_MODULE, "L-ACT-03's permission check lives in the act seam");
    expect(
      /\btenantId\b/.test(code),
      `${PARTICIPATION_MODULE} must state its tenant filter explicitly beside row-level security — a read whose only tenant predicate is the policy's is a read that says nothing about what it means (SEAM-TENANT, R-SPINE-004)`,
    ).toBe(true);

    // "…without changing any exported signature": src/modules/spine/participants/roster.ts calls
    // these, and that file is not this increment's ground, so the arity each one takes is part of
    // the row rather than an implementation detail.
    const participation = await loadModule<typeof import("../acts/participation")>(PARTICIPATION_MODULE, "the act seam's one permission read");
    const arities: readonly [string, number][] = [
      ["effectiveGrants", 3],
      ["rolesGranted", 3],
      ["permissionsHeld", 3],
      ["holdersOf", 3],
      ["requirePermission", 4],
    ];
    const held = participation as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>;
    for (const [name, arity] of arities) {
      const fn = held[name];
      expect(typeof fn, `${PARTICIPATION_MODULE} exports ${name}`).toBe("function");
      expect(fn?.length, `${name} keeps the signature its callers outside this increment already hold`).toBe(arity);
    }

    const barrel = await loadModule<Record<string, unknown>>(ACTS_BARREL, "SEAM-ACT's barrel is the sole entry point other modules import");
    for (const [name] of arities) {
      if (name === "requirePermission") continue; // the guard is the seam's own, not part of the barrel's published surface
      expect(typeof barrel[name], `the acts barrel keeps exporting ${name} — a caller outside src/core reads it from there`).toBe("function");
    }
  });
});

describe("AC-6: storage's retention claim is honest", () => {
  test("AC-6: the stored object is flushed before put resolves, or the comment says durability belongs to the volume", async () => {
    const code = codeOf(STORAGE_MODULE, "SEAM-STORAGE has one home");
    const comments = commentsOf(STORAGE_MODULE, "SEAM-STORAGE has one home");
    const flushes = /fsync|datasync|\.sync\(|flush/i.test(code);
    const saysWhereDurabilityLives = /durab/i.test(comments) && /volume|disk|kernel|file\s?system|operating system/i.test(comments);
    expect(
      flushes || saysWhereDurabilityLives,
      "R-SPINE-021 keeps every revision forever, and a write that has not been flushed is a claim the module cannot keep on its own: either put flushes before it resolves, or the comment says plainly that durability belongs to the volume (B-05)",
    ).toBe(true);
  });
});
