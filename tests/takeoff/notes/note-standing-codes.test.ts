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
import { noteReadingKey, noteStanding } from "../../../src/core/notes/standing";
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

  test("a sheet whose words state no figure proposes none, and NOTES_NONE_PROPOSED is what says so", () => {
    expect(proposeNotes(BNBC_SILENT_NOTES), "the grammar reads a figure only where a note states one").toEqual([]);
    const entry = REFUSALS["NOTES_NONE_PROPOSED"];
    expect(entry?.severity, "the silence is stated, and stated as information rather than as a fault").toBe("info");
    expect(entry?.surface, "in place, on the panel where the figure would have stood").toBe("inline");
  });
});
