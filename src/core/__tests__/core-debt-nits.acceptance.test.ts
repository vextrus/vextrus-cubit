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

/**
 * A module's comments as the paragraphs they were written in: each `/* … *\/` block is one, and each
 * run of adjacent `//` lines is one. A sentence is graded against the paragraph it stands in, so a
 * claim in one comment cannot be answered by an unrelated word in another.
 */
function commentParagraphsOf(source: string): string[] {
  const blocks = source.match(/\/\*[\s\S]*?\*\//g) ?? [];
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "\n");
  const runs: string[] = [];
  let run: string[] = [];
  for (const line of withoutBlocks.split("\n")) {
    if (line.trimStart().startsWith("//")) run.push(line.trim());
    else if (run.length > 0) {
      runs.push(run.join(" "));
      run = [];
    }
  }
  if (run.length > 0) runs.push(run.join(" "));
  return [...blocks, ...runs];
}

/**
 * Every argument list handed to a `.where( … )`, balanced by parentheses so a nested `and(eq(…))`
 * comes back whole. This is how "the filter is stated in the query" is told apart from "the name
 * appears somewhere in the file": a local nobody passes to the query builder is not a filter.
 */
function wherePredicatesOf(code: string): string[] {
  const predicates: string[] = [];
  const opens = /\.where\s*\(/g;
  for (let hit = opens.exec(code); hit !== null; hit = opens.exec(code)) {
    const from = hit.index + hit[0].length;
    let depth = 1;
    let at = from;
    for (; at < code.length && depth > 0; at += 1) {
      if (code[at] === "(") depth += 1;
      else if (code[at] === ")") depth -= 1;
    }
    predicates.push(code.slice(from, Math.max(from, at - 1)));
  }
  return predicates;
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
    // The paragraph reader is graded before it grades anything: adjacent `//` lines are one
    // paragraph, a blank line ends it, and a block comment is its own.
    expect(commentParagraphsOf("// one\n// two\n\n// far away\nconst x = 1;\n"), "adjacent // lines are one paragraph, and a blank line ends it").toEqual([
      "// one // two",
      "// far away",
    ]);
    expect(commentParagraphsOf("/** a block */\n// a line\n"), "a block comment is its own paragraph").toEqual(["/** a block */", "// a line"]);

    const source = sourceOf(REASON_MODULE, "SEAM-TENANT records a system reason through this hook");
    expect(
      /not\s+built\s+yet|is\s+not\s+built|isn't\s+built/i.test(source),
      `${REASON_MODULE} must stop saying ARCH-03's fault seam is unbuilt — src/core/faults/report.ts is in the tree, and prose that contradicts the tree is worse than no prose (B-05)`,
    ).toBe(false);

    // Deleting the false claim is only half the row: the criterion asks the comment to STATE one of
    // two things — the seam that exists, or what the hook is still waiting for. A comment that
    // asserts neither leaves the reader exactly where the wrong one did.
    const named = source.match(/src\/[A-Za-z0-9_.\-/]+\.tsx?/g) ?? [];
    // Whatever seam the comment names must be a file that is actually there: a corrected comment
    // pointing at nothing would be the same defect wearing a different sentence.
    for (const path of named) {
      expect(existsSync(join(REPO_ROOT, path)), `${REASON_MODULE} names ${path}, which is not in the checkout`).toBe(true);
    }
    // "Names the seam that exists" means the fault seam, not any file that happens to be mentioned.
    const namesASeamThatExists = named.some((path) => /fault/i.test(path) && existsSync(join(REPO_ROOT, path)));

    // The other lawful spelling: no path, but a plain statement of what the hook is still waiting
    // for. It has to be ONE paragraph that says both halves — the waiting, and that it is ARCH-03's
    // fault seam being waited on. Graded paragraph by paragraph on purpose: this module already says
    // elsewhere that the recorder is "undefined until something is listening", and a fact about a
    // variable's default is not a statement about the seam.
    const paragraphs = commentParagraphsOf(sourceOf(REASON_MODULE, "SEAM-TENANT records a system reason through this hook"));
    const waiting = /\b(waits?|waiting|awaits?|still|not yet|unwired|unpointed|nothing is listening|nobody is listening)\b/i;
    const theSeam = /\b(fault|ARCH-03|report)\b/i;
    const saysWhatItWaitsFor = paragraphs.some((paragraph) => waiting.test(paragraph) && theSeam.test(paragraph));
    expect(
      namesASeamThatExists || saysWhatItWaitsFor,
      `${REASON_MODULE}'s comment must now say something a reader can act on: either it NAMES the seam that exists (a src/… path this checkout holds — src/core/faults/report.ts is the one ARCH-03 built) or it states plainly what the hook is still waiting for. Removing the false sentence and asserting nothing in its place pays the row's cost without paying the row (B-05)`,
    ).toBe(true);
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
    // The predicate reader is graded before it grades anything: a `.where(...)` argument comes back
    // whole however it nests or wraps, and a module with no read yields nothing.
    expect(wherePredicatesOf("q.where(and(eq(t.projectId, p), eq(t.userId, u)));"), "a nested predicate comes back whole").toEqual([
      "and(eq(t.projectId, p), eq(t.userId, u))",
    ]);
    expect(wherePredicatesOf("q\n  .where(\n    inArray(t.grantId, ids.map((g) => g.id)),\n  );"), "a predicate laid out over several lines comes back whole").toEqual([
      "\n    inArray(t.grantId, ids.map((g) => g.id)),\n  ",
    ]);
    expect(wherePredicatesOf("const tenantId = ctx.tenantId;\nq.from(t);"), "a name outside every predicate is not a filter").toEqual([]);

    const code = codeOf(PARTICIPATION_MODULE, "L-ACT-03's permission check lives in the act seam");
    const predicates = wherePredicatesOf(code);
    expect(predicates.length, `${PARTICIPATION_MODULE} reads through the query builder, so it states at least one .where(...) predicate`).toBeGreaterThan(0);

    // The rule, derived from the keys these tables carry rather than from a count of today's reads:
    // a project is identified by (tenant, project), so a predicate that narrows to a project without
    // naming the tenant that owns it is a predicate whose meaning is carried entirely by the policy.
    const projectScoped = predicates.filter((predicate) => /\.projectId\b/.test(predicate));
    expect(projectScoped.length, `${PARTICIPATION_MODULE} narrows its reads to a project`).toBeGreaterThan(0);
    for (const predicate of projectScoped) {
      expect(
        /\.tenantId\b/.test(predicate),
        `${PARTICIPATION_MODULE} must state its tenant filter INSIDE the query's own predicate, beside row-level security — a read narrowed to a project must name the tenant that owns it, because a project is identified by the pair. A name that never reaches the query builder filters nothing, and a read whose only tenant predicate is the policy's says nothing about what it means (SEAM-TENANT, R-SPINE-004). This predicate does not: ${predicate.trim()}`,
      ).toBe(true);
    }

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
