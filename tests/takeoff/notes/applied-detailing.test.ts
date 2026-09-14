/**
 * AC-4 — the applied-detailing door answers the campaign's values off the agreed readings, and mints
 * no rule-set edition (AM-03(h), L-BD-02, J-032).
 *
 * A note re-versions what a campaign APPLIES, never what a rule-set edition says: the count of
 * editions is read before and after the transcriptions and must not move. The door is a read — it
 * opens no act — and the standing beneath it is the pure `noteStanding`, graded here on the rows the
 * act itself wrote.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AGREED,
  FC,
  FY,
  HOOK,
  HOOK_MIN,
  LAP,
  NONE,
  RULESET_EDITIONS_TABLE,
  TRANSCRIBE_SHEET_NOTES,
} from "./support/bnbc-notes";
import { notesLaw } from "./support/notes-doors";
import {
  actsOfType,
  asProposed,
  closeStage,
  notesDoor,
  performAct,
  readingFacts,
  readingRows,
  reading,
  rowCount,
  stageNotes,
  transcription,
  type StagedNotes,
} from "./support/notes-stage";

const BUDGET_MS = 300_000;

/** The figure the minimum hook is read at, and its unit (AC-2's commit, which AC-4 stands on). */
const EDITED_HOOK_MIN = "100";
const MM = "mm";

type Ground = {
  staged: StagedNotes;
  proposals: Record<string, Record<string, unknown>>;
  /** The rule-set editions the workspace held before a single note was read. */
  editionsBefore: number;
};

let ground: Promise<Ground> | undefined;

function staged(): Promise<Ground> {
  return (ground ??= (async () => {
    const door = await notesDoor();
    const stage = await stageNotes("applied");
    const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
    const proposals = Object.fromEntries(door.proposeNotes(texts).map((proposal) => [String(proposal["kind"]), proposal]));
    return { staged: stage, proposals, editionsBefore: rowCount(RULESET_EDITIONS_TABLE, stage.tenantId) };
  })());
}

let transcribed: Promise<void> | undefined;

/** AC-2's commit, once: the grade and the lap as proposed, the minimum hook read at 100 mm. */
function theCommit(): Promise<void> {
  return (transcribed ??= (async () => {
    const { staged: stage, proposals } = await staged();
    await performAct(
      stage.measurer.actor,
      transcription(stage, [
        asProposed(proposals[FY] as Record<string, unknown>),
        asProposed(proposals[LAP] as Record<string, unknown>),
        reading(HOOK_MIN, String((proposals[HOOK_MIN] as Record<string, unknown>)["sourceKey"]), EDITED_HOOK_MIN, MM),
      ]),
    );
  })());
}

/** The stored readings of one kind, in the shape `noteStanding` is handed them. */
function readingsOfKind(tenantId: string, kind: string): Record<string, unknown>[] {
  return readingRows(tenantId)
    .map(readingFacts)
    .filter((row) => row.kind === kind) as unknown as Record<string, unknown>[];
}

afterAll(async () => {
  await closeStage();
});

describe("AC-4: the door answers what the campaign applies, and a note mints no edition", () => {
  test(
    "AC-4: the values the revision applies are the agreed readings, with their source keys and nothing else",
    async () => {
      const { staged: stage, proposals } = await staged();
      await theCommit();
      const door = await notesDoor();

      const applied = await door.appliedDetailingValuesOf({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId });
      // The keys the answer lists, in the order the law's own roster of kinds stands in (AC-4).
      const law = await notesLaw();
      const keysInKindOrder = [FY, LAP, HOOK_MIN]
        .sort((left, right) => law.NOTE_KINDS.indexOf(left) - law.NOTE_KINDS.indexOf(right))
        .map((kind) => String((proposals[kind] as Record<string, unknown>)["sourceKey"]));

      expect(applied, "the grade, the lap and the hook's minimum — as they were read, with their units").toEqual({
        fy: { value: 500, unit: "MPa" },
        lapMultiplier: 50,
        hookExtension: { multiplier: null, minimumMm: 100 },
        sourceKeys: keysInKindOrder,
        suspended: [],
      });
      expect(Object.keys(applied), "nothing transcribed a concrete strength, so the answer carries no `fc` at all (L-MEA-01)").not.toContain("fc");
    },
    BUDGET_MS,
  );

  test(
    "AC-4: reading the 135° hook as proposed fills the multiplier beside the minimum it already had",
    async () => {
      const { staged: stage, proposals } = await staged();
      await theCommit();
      const door = await notesDoor();

      await performAct(stage.measurer.actor, transcription(stage, [asProposed(proposals[HOOK] as Record<string, unknown>)]));
      const applied = await door.appliedDetailingValuesOf({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId });
      expect(applied["hookExtension"], "the two halves of a hook stand as two readings and answer as one value").toEqual({ multiplier: 10, minimumMm: 100 });
      expect(applied["fy"], "and the grade stands where it stood").toEqual({ value: 500, unit: "MPa" });
    },
    BUDGET_MS,
  );

  test(
    "AC-4: a revision nobody has read a note on applies nothing — never a default",
    async () => {
      const door = await notesDoor();
      const unread = await stageNotes("unread");
      const applied = await door.appliedDetailingValuesOf({ tenantId: unread.tenantId, projectId: unread.projectId, setRevisionId: unread.setRevisionId });
      expect(applied, "no note read, no figure applied, and the absence stated as the absence it is").toEqual({ sourceKeys: [], suspended: [] });
    },
    BUDGET_MS,
  );

  test(
    "AC-4: the door is a read — it opens no act, and no rule-set edition is minted by a note",
    async () => {
      const { staged: stage, editionsBefore } = await staged();
      await theCommit();
      const door = await notesDoor();

      const actsBefore = actsOfType(stage.tenantId, stage.projectId, TRANSCRIBE_SHEET_NOTES).length;
      await door.appliedDetailingValuesOf({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId });
      expect(actsOfType(stage.tenantId, stage.projectId, TRANSCRIBE_SHEET_NOTES).length, "a read writes no act (L-ACT-01)").toBe(actsBefore);
      expect(rowCount(RULESET_EDITIONS_TABLE, stage.tenantId), "a note re-versions the campaign's applied values, never an edition (AM-03(h))").toBe(editionsBefore);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: the standing beneath the door is the pure one — agreed where the readings agree, none where nobody read",
    async () => {
      const { staged: stage } = await staged();
      await theCommit();
      const door = await notesDoor();

      const fy = door.noteStanding(readingsOfKind(stage.tenantId, FY));
      expect(fy.standing, "one reading of the grade, uncontested").toBe(AGREED);
      expect(String(fy.canonical), "standing at the figure it was read at").toBe("500");
      expect(fy.code ?? null, "and nothing is refused about a figure everybody agrees on").toBeNull();

      const lap = door.noteStanding(readingsOfKind(stage.tenantId, LAP));
      expect(lap.standing, "and the lap the same").toBe(AGREED);
      expect(String(lap.canonical), "at the multiplier the note states").toBe("50");

      const fc = door.noteStanding(readingsOfKind(stage.tenantId, FC));
      expect(fc.standing, "the concrete strength nobody read stands at nothing").toBe(NONE);
      expect(fc.canonical ?? null, "so it carries no figure at all (L-MEA-01)").toBeNull();
    },
    BUDGET_MS,
  );
});
