/**
 * The two answers a note's standing gives when no figure stands, each named by the registered code it
 * is refused under (R-TO-034, L-REG-03, Q-07).
 *
 * A contest is not settled by pressing again: two people who read one note differently leave the kind
 * SUSPENDED, and the screen says so under `NOTE_READING_CONTESTED`. A sheet whose words state no
 * figure at all is a different absence, and it says so under `NOTES_NONE_PROPOSED` — silence is not a
 * state (R-UI-020).
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import { proposeNotes } from "../../../src/core/notes/grammar";
import { noteReadingKey, noteStanding, noteStandingsByScope } from "../../../src/core/notes/standing";
import { BNBC_SILENT_NOTES } from "./support/bnbc-notes";

/** One stored reading, in the three facts a standing is derived from. */
function reading(actorId: string, canonical: string, unitAsWritten: string) {
  return {
    readingKey: noteReadingKey({ drawingId: "d", layoutName: "S-01", kind: "LAP", actorId, sourceKey: "DXF_HANDLE:1F4C" }),
    canonical,
    unitAsWritten,
    sourceKey: "DXF_HANDLE:1F4C",
  };
}

describe("a note's standing, and the codes its absences are refused under", () => {
  test("two people reading one note differently suspend it under NOTE_READING_CONTESTED", () => {
    const stood = noteStanding([reading("one", "50", "d"), reading("two", "40", "d")]);
    expect(stood.standing, "a disagreement suspends the kind rather than letting the later reading win").toBe("SUSPENDED");
    expect(stood.canonical, "a suspended kind carries no figure — a number beside it is the claim the suspension denies").toBeNull();
    expect(stood.code, "and the absence is named by the code the register holds for it").toBe("NOTE_READING_CONTESTED");
    expect(REFUSALS["NOTE_READING_CONTESTED"]?.remedy ?? "", "which states how a reader settles it").not.toBe("");
  });

  test("the same two people agreeing leave the kind AGREED at the figure they agree on", () => {
    const stood = noteStanding([reading("one", "50", "d"), reading("two", "50", "d")]);
    expect(stood.standing).toBe("AGREED");
    expect(stood.canonical).toBe("50");
    expect(stood.code, "nothing is refused where the readings agree").toBeNull();
  });

  test("I-652: the piles' strength beside everyone else's is two scopes, not a contest", () => {
    const fc = (sourceKey: string, actorId: string, canonical: string, scopeClass: string | null) => ({
      readingKey: noteReadingKey({ drawingId: "d", layoutName: "S-01", kind: "FC", actorId, sourceKey }),
      canonical,
      unitAsWritten: "psi",
      sourceKey,
      scopeClass,
    });
    const readings = [fc("DXF_HANDLE:1F41", "one", "3500", null), fc("DXF_HANDLE:1F42", "one", "3000", "pile"), fc("DXF_HANDLE:1F78", "one", "3500", null)];
    expect(noteStanding(readings).standing, "read unscoped, the three readings disagree — which is what walk-1 saw on S-01").toBe("SUSPENDED");
    const scoped = noteStandingsByScope(readings);
    expect([...scoped.keys()], "one standing per scope, the unscoped first").toEqual([null, "pile"]);
    expect({ standing: scoped.get(null)?.standing, canonical: scoped.get(null)?.canonical }, "every unscoped class stands AGREED at 3500").toEqual({ standing: "AGREED", canonical: "3500" });
    expect({ standing: scoped.get("pile")?.standing, canonical: scoped.get("pile")?.canonical }, "and the piles at their own 3000").toEqual({ standing: "AGREED", canonical: "3000" });

    const differ = noteStandingsByScope([...readings, fc("DXF_HANDLE:1F41", "two", "4000", null)]);
    expect(differ.get(null)?.code, "two unscoped readings that differ still suspend, by the same code").toBe("NOTE_READING_CONTESTED");
    expect(differ.get("pile")?.standing, "and a contest in one scope leaves the other standing").toBe("AGREED");
  });

  test("I-652: a re-reading that scopes a figure supersedes the unscoped reading under its key", () => {
    const key = noteReadingKey({ drawingId: "d", layoutName: "S-01", kind: "FC", actorId: "one", sourceKey: "DXF_HANDLE:1F42" });
    const other = noteReadingKey({ drawingId: "d", layoutName: "S-01", kind: "FC", actorId: "one", sourceKey: "DXF_HANDLE:1F41" });
    const scoped = noteStandingsByScope([
      { readingKey: other, canonical: "3500", unitAsWritten: "psi", scopeClass: null },
      { readingKey: key, canonical: "3000", unitAsWritten: "psi", scopeClass: null },
      { readingKey: key, canonical: "3000", unitAsWritten: "psi", scopeClass: "pile" },
    ]);
    expect(scoped.get(null)?.standing, "the earlier unscoped 3000 no longer contests the 3500 — its key now reads for the piles").toBe("AGREED");
    expect(scoped.get(null)?.superseded.map((reading) => reading.canonical), "and it stands superseded in the scope it left, never erased").toEqual(["3000"]);
    expect(scoped.get("pile")?.canonical).toBe("3000");
  });

  test("a sheet whose words state no figure proposes none, and NOTES_NONE_PROPOSED is what says so", () => {
    expect(proposeNotes(BNBC_SILENT_NOTES), "the grammar reads a figure only where a note states one").toEqual([]);
    expect(REFUSALS["NOTES_NONE_PROPOSED"]?.severity, "the silence is stated, and stated as information rather than as a fault").toBe("info");
    expect(REFUSALS["NOTES_NONE_PROPOSED"]?.surface, "in place, on the panel where the figure would have stood").toBe("inline");
    expect(REFUSALS["NOTES_NONE_PROPOSED"]?.remedy ?? "", "and says what a reader does about it").not.toBe("");
  });
});
