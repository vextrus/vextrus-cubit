/**
 * AC-2 — the fix is forward-only, and J-000 is still J-000.
 *
 * Greening a journey by editing what grades the journey is not a fix. J-000's specs, its
 * `.e2e.ts` leg, its baselines and the shared page objects and e2e support every journey stands on
 * are another node's grading surface, pinned at the pre-fix merge. This file reads the branch's own
 * history and working tree and refuses any MOVE of that ground, in the two grades the ground has:
 * J-000's own assets are byte-frozen, and in the shared homes every MEMBER the pin tracked is frozen
 * — a rewrite, a reorder, a rename or a deletion is the move, while a pure addition is not, because
 * a locator a later increment's own screen needs has one lawful home and that home is this one
 * (R-UI-031, B-17, B-19).
 *
 * The roster of frozen assets is DERIVED from what the pre-fix merge actually tracked, not listed
 * here — a J-000 asset the Bible's "extended per milestone" adds later is carried by the same rule
 * without an edit. Derivation cuts the other way too, and that is the whole of the freeze: what the
 * pin did not track is not frozen ground. A directory listing is not a roster (C-05, B-19), so a
 * later increment's own new page object or support file — its lawful work, under its own name — is
 * no trespass here; it can only reach a locked journey through an edit of an asset the pin DID
 * track, and that edit is what the two readings below convict.
 *
 * The three tests the interfaces line names are asserted as a floor on top of it: they must still
 * exist and must still be reachable by the runner's `--journey J-000` grep, because a journey the
 * gate cannot collect is green by omission (V-E2E).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIX_END,
  FIX_MARKER,
  PRE_FIX,
  REPO_ROOT,
  blobAt,
  changedSincePreFix,
  filesAt,
  objectIdAt,
  objectIdInTree,
  withoutComments,
} from "./support/history";

/**
 * The three J-000 tests `pnpm e2e --journey J-000` runs, as this increment's interfaces line spells
 * them. A floor on the derived freeze below, never a ceiling on what J-000 may hold.
 */
const NAMED_J000_TESTS = [
  "tests/e2e/journeys/j-000-golden-path.spec.ts",
  "tests/e2e/journeys/j-000-smoke.spec.ts",
  "tests/e2e/j-000-golden-path.e2e.ts",
] as const;

/** How the journey runner selects a journey: Playwright's title grep, on the journey's own id. */
const JOURNEY_ID = "J-000";

/**
 * J-000's OWN grading surface: anything under `tests/` that names J-000 — its specs, its `.e2e.ts`
 * leg, every snapshot and baseline whose path carries the id. Frozen to the byte: this increment
 * claims it did not touch what grades J-000, and nothing of it may move at all.
 */
function isJ000Asset(path: string): boolean {
  return path.startsWith("tests/") && path.includes("j-000");
}

/**
 * The shared homes every journey leans on — the page objects and the e2e support. What is frozen
 * here is the GROUND, and the ground is the members the pin tracked: J-000 calls them by name, so a
 * rewrite, a rename or a deletion of one is what would move the journey under its own baseline.
 *
 * A pure ADDITION to one of these files is not that. A screen the Bible schedules for a later
 * increment reaches its only visible door through the page object of the screen that holds it
 * (R-UI-031: "a screen reachable only by typed URL is a failing acceptance criterion"), and B-19
 * puts that locator in the one home its Design Decision closes, never in a second copy beside the
 * new journey. Convicting the insertion would encode "the S-Home page object has no project door" —
 * a fact of the pre-fix date — as a timeless invariant against the very increment scheduled to build
 * that door, and a red no lawful actor may clear is a defect of the plan (B-19, B-20).
 *
 * So this grade is judged on its pinned members, not on its byte count: the file must still stand
 * under its pinned name, and every line the pin tracked must still be there, in order.
 */
function isSharedJourneyHome(path: string): boolean {
  return path.startsWith("tests/e2e/pages/") || path.startsWith("tests/e2e/support/");
}

/**
 * Frozen ground, either grade.
 *
 * A classifier, never a roster: it is only ever asked about paths `filesAt(PRE_FIX, …)` answered
 * with, so it says which pre-existing assets are frozen and never that a directory is closed. A
 * later increment's own new page object or support file — its lawful work, under its own name — is
 * no trespass: the pin never tracked it, so it is not read here at all.
 */
function isFrozenGround(path: string): boolean {
  return isJ000Asset(path) || isSharedJourneyHome(path);
}

/** Every frozen asset as the pre-fix merge tracked it — the roster, derived from the pin itself. */
function frozenAtPin(): string[] {
  return filesAt(PRE_FIX, "tests/").filter(isFrozenGround);
}

/** J-000's own assets at the pin: the byte-frozen grade. */
function j000AtPin(): string[] {
  return frozenAtPin().filter(isJ000Asset);
}

/** The shared homes at the pin: the members-frozen grade. */
function sharedHomesAtPin(): string[] {
  return frozenAtPin().filter((path) => isSharedJourneyHome(path) && !isJ000Asset(path));
}

/** What a path holds as text at the far end of the interval — the working file while it is open. */
function textAtFixEnd(path: string): string | null {
  if (FIX_END !== "HEAD") return blobAt(FIX_END, path);
  const absolute = join(REPO_ROOT, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/**
 * The lines the pin tracked that are no longer there, in order — empty exactly when the far end is
 * the pinned content with insertions and nothing else. Matching greedily at the earliest position
 * still ahead of the last match is what makes this an order-preserving reading: a member moved
 * above one it followed at the pin is a rewrite, and shows up here as missing.
 */
function pinnedLinesGone(pinned: string, now: string): string[] {
  const nowLines = now.split("\n");
  const gone: string[] = [];
  let cursor = 0;
  for (const line of pinned.split("\n")) {
    const at = nowLines.indexOf(line, cursor);
    if (at === -1) {
      gone.push(line);
      continue;
    }
    cursor = at + 1;
  }
  return gone;
}

/**
 * What a path holds at the far end of the interval. While the interval is still open at the working
 * checkout — which is how the gate sees this branch — the content under judgement is the content on
 * disk, so an uncommitted rewrite of a frozen asset under its own name is read too.
 */
function contentAtFixEnd(path: string): string | null {
  return FIX_END === "HEAD" ? objectIdInTree(path) : objectIdAt(FIX_END, path);
}

describe("AC-2: J-000 is repaired forward, never by editing what grades J-000", () => {
  it("AC-2: the commit that closes this increment's interval is one that carries this increment", () => {
    // The interval's far end is chosen as the oldest mainline commit containing HEAD, which is the
    // landing under a merge and under a fast-forward alike. This is the guard on that choice: a
    // FIX_END that does not even track this increment's own acceptance file would be some other
    // node's commit, and every reading below would then be asking about the wrong range.
    expect(
      objectIdAt(FIX_END, FIX_MARKER),
      `${FIX_END} was taken as the end of this increment's interval, but it does not track ${FIX_MARKER} — it is not a commit this increment landed in, and PRE_FIX..FIX_END is not this increment's range`,
    ).not.toBeNull();
  });

  it("AC-2: the branch modifies, renames or deletes no J-000 asset, and renames or deletes no PRE_FIX-tracked shared page object or e2e support file", () => {
    // The conviction set is the pin's own roster, not the change list filtered by location: an
    // ADDITION under a frozen directory is a path the pin never tracked, changes no J-000 asset and
    // is somebody's lawful work — it is not read here at all.
    const frozen = frozenAtPin();
    expect(frozen.length, `no frozen J-000 or shared-journey asset was found at ${PRE_FIX} — the reading below would prove nothing`).toBeGreaterThan(0);

    // Two ways a pinned asset moves under a NAME reading. A modification is named in the change
    // list. A rename or a deletion is not: a name-only diff collapses a rename onto its destination,
    // so the source side shows up as the pinned path no longer being there at the far end.
    //
    // Both convict a J-000 asset. Only the second convicts a shared home: whether an edit to one of
    // those moved the ground is a question about the members the pin tracked, and that is the
    // content reading below — the name alone cannot tell an insertion from a rewrite.
    const touched = new Set(changedSincePreFix());
    const trespass = frozen.filter((path) => contentAtFixEnd(path) === null || (isJ000Asset(path) && touched.has(path)));
    expect(
      trespass,
      `these paths are J-000's grading surface or the shared homes every journey stood on at ${PRE_FIX}, and this branch has moved them — the repair lives inside inc-010b's merged src footprint instead:\n  ${trespass.join("\n  ")}`,
    ).toEqual([]);
  });

  it("AC-2: every J-000 asset the pre-fix merge tracked is byte-identical at the end of this fix", () => {
    // Derived, so the freeze covers whatever J-000 was made of at the pin rather than a list that
    // would age. `changedSincePreFix` reads names; this reads content, and catches a same-name
    // rewrite the name reading alone would let through.
    //
    // Both ends of the reading are the interval's own: the pin and `FIX_END`. J-000 is "extended per
    // milestone", so a later milestone may lawfully rewrite these files — what this increment claims
    // is that IT did not, and that claim is settled once the hotfix lands.
    const frozen = j000AtPin();
    expect(frozen.length, `no frozen J-000 asset was found at ${PRE_FIX} — the reading below would prove nothing`).toBeGreaterThan(0);

    // `contentAtFixEnd` reads the far end exactly as `changedSincePreFix` reads it, so the name scan
    // and the content scan cover one interval and not two.
    const moved = frozen.filter((path) => contentAtFixEnd(path) !== objectIdAt(PRE_FIX, path));
    expect(moved, `these are byte-frozen at ${PRE_FIX} and ${FIX_END} holds a different content (or has deleted them):\n  ${moved.join("\n  ")}`).toEqual([]);
  });

  it("AC-2: every member the pin tracked in a shared page object or e2e support file is still there, in order", () => {
    // The shared homes' grade (above): additions only. A journey J-000 walks calls these files by
    // name, so what may not move is what the pin tracked — every line of it, in the order it stood
    // in. An increment that adds a locator for the screen it ships leaves all of that standing; one
    // that rewrites, reorders or removes a member does not, and this is the reading that tells them
    // apart. The far end is the interval's own, so a later milestone's lawful rewrite is outside it.
    const shared = sharedHomesAtPin();
    expect(shared.length, `no shared page object or e2e support file was tracked at ${PRE_FIX} — the reading below would prove nothing`).toBeGreaterThan(0);

    const rewritten: string[] = [];
    for (const path of shared) {
      const pinned = blobAt(PRE_FIX, path);
      if (pinned === null) continue;
      const now = textAtFixEnd(path);
      const gone = now === null ? pinned.split("\n") : pinnedLinesGone(pinned, now);
      if (gone.length > 0) rewritten.push(`${path} — ${gone.length} line(s) the pin tracked are gone, the first being: ${(gone[0] ?? "").trim()}`);
    }
    expect(
      rewritten,
      `a member the pin tracked was rewritten or removed in the shared homes every journey stands on — J-000 calls these by name, and an edit that is not purely additive moves the ground under it:\n  ${rewritten.join("\n  ")}`,
    ).toEqual([]);
  });

  it("AC-2: the three J-000 tests the interfaces line names are still present and still collected", () => {
    for (const path of NAMED_J000_TESTS) {
      const absolute = join(REPO_ROOT, path);
      expect(existsSync(absolute), `${path} is one of the three tests \`pnpm e2e --journey ${JOURNEY_ID}\` runs, and the checkout has not got it`).toBe(true);

      // The runner turns `--journey J-000` into Playwright's `--grep J-000`, which matches a test's
      // full title. A file whose titles stopped naming the journey would still be committed and
      // still be green — by never running.
      const bare = withoutComments(readFileSync(absolute, "utf8"));
      const titles = [...bare.matchAll(/\b(?:test|it)\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
      const describes = [...bare.matchAll(/\bdescribe\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
      const reachable = [...titles, ...describes].some((title) => title.includes(JOURNEY_ID));
      expect(reachable, `no test title in ${path} names ${JOURNEY_ID}, so the runner's grep cannot reach it and the journey is green by omission`).toBe(true);
    }
  });

  it("AC-2: the journey runner still takes exactly one journey, so the criterion's invocations are the lawful ones", () => {
    // AC-2 and AC-3 are each stated as a single `--journey` invocation. That is a property of the
    // runner, and the acceptance would be describing a command that does not exist if it changed.
    const runner = readFileSync(join(REPO_ROOT, "scripts", "e2e.mjs"), "utf8");
    const bare = withoutComments(runner);
    expect(bare.includes("--journey"), "scripts/e2e.mjs no longer reads a --journey flag").toBe(true);
    expect(bare.includes("--grep"), "scripts/e2e.mjs no longer turns the journey into Playwright's title grep").toBe(true);
  });
});
