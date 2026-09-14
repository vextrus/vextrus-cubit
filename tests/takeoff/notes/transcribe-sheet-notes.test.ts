/**
 * AC-2 — TRANSCRIBE_SHEET_NOTES is L-ACT-02's pair, and the SEAM judges accepted-as-proposed against
 * edited (R-TO-034, L-ACT-01, L-ACT-02, L-QTY-01).
 *
 * Live: a sheet whose text entities are F-RCC6-BNBC's general notes is staged through the shipped
 * ingest pipeline, and the act is driven exactly as a surface drives it — preview, then commit with
 * the digest the preview answered. Every figure the store must hold is asked of the product's own
 * grammar rather than transcribed here (B-19): what `50d` reads as is the grammar's answer, and this
 * suite checks the act keeps it.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACCEPTED,
  ACTS_MODULE,
  ACT_CHANGES_NOTHING,
  CONSEQUENCES_NOT_CARRIED,
  EDITED,
  FY,
  HOOK_MIN,
  LAP,
  MEASURE,
  NOTES_READINGS_TABLE,
  NOTE_SOURCE_NOT_ON_SHEET,
  REQUEST_MALFORMED,
  TRANSCRIBED,
  TRANSCRIBE_ACT_MODULE,
  TRANSCRIBE_SHEET_NOTES,
} from "./support/bnbc-notes";
import { productModule } from "./support/notes-doors";
import {
  actsLaw,
  actsOfType,
  actsSeam,
  asProposed,
  closeStage,
  effectsOf,
  movedTo,
  notesDoor,
  performAct,
  previewOf,
  readingFacts,
  readingRows,
  reading,
  refusalOfPerforming,
  refusalOfPreviewing,
  rejection,
  codeOf,
  schedulesCaller,
  schedulesRefusals,
  stageNotes,
  subjectsOf,
  transcribeRendering,
  transcription,
  type ProposedReading,
  type StagedNotes,
} from "./support/notes-stage";

const BUDGET_MS = 300_000;

/** The figure the walk edits the minimum hook to, and the unit it keeps (AC-2). */
const EDITED_HOOK_MIN = "100";
const MM = "mm";

/** A source key of the DXF-handle scheme that stands on no sheet of this project (AC-2). */
const FOREIGN_KEY = "DXF_HANDLE:0DEAD";

type Ground = { staged: StagedNotes; proposals: Record<string, Record<string, unknown>> };

let ground: Promise<Ground> | undefined;

/** The sheet, its people, and what the product's own grammar proposes off it — staged once. */
function staged(): Promise<Ground> {
  return (ground ??= (async () => {
    const door = await notesDoor();
    const stage = await stageNotes("transcribe");
    const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
    expect(texts.length, `the staged sheet's texts are read back through the one read the grammar uses: ${JSON.stringify(texts)}`).toBeGreaterThan(0);
    const proposals = Object.fromEntries(door.proposeNotes(texts).map((proposal) => [String(proposal["kind"]), proposal]));
    for (const kind of [FY, LAP, HOOK_MIN]) {
      expect(proposals[kind], `the staged sheet proposes a ${kind} reading: ${JSON.stringify(Object.keys(proposals))}`).toBeTruthy();
    }
    return { staged: stage, proposals };
  })());
}

/** The three readings AC-2 commits: the grade and the lap as proposed, the minimum hook edited. */
async function theThreeReadings(): Promise<ProposedReading[]> {
  const { proposals } = await staged();
  const hookMin = proposals[HOOK_MIN] as Record<string, unknown>;
  return [
    asProposed(proposals[FY] as Record<string, unknown>),
    asProposed(proposals[LAP] as Record<string, unknown>),
    // The claim a client makes about its own verdict rides along and is ignored: the seam judges it.
    reading(HOOK_MIN, String(hookMin["sourceKey"]), EDITED_HOOK_MIN, MM, { acceptance: ACCEPTED }),
  ];
}

let committed: Promise<{ actId: string }> | undefined;

/** The one commit every later case reads the store after. */
function theCommit(): Promise<{ actId: string }> {
  return (committed ??= (async () => {
    const { staged: stage } = await staged();
    const performed = await performAct(stage.measurer.actor, transcription(stage, await theThreeReadings()));
    return { actId: performed.actId };
  })());
}

afterAll(async () => {
  await closeStage();
});

describe("AC-2: TRANSCRIBE_SHEET_NOTES previews what it would write, and the seam judges what was read", () => {
  test(
    "AC-2: the act type stands in the law under MEASURE, with its rendering in the map",
    async () => {
      const law = await actsLaw();
      expect([...law.ACT_TYPES], `the act log's closed enum holds ${TRANSCRIBE_SHEET_NOTES} (L-ACT-02)`).toContain(TRANSCRIBE_SHEET_NOTES);
      expect(law.ACT_PERMISSION[TRANSCRIBE_SHEET_NOTES], "and L-ACT-03 cuts it under the permission that measures").toBe(MEASURE);

      const seam = await productModule<{ ACT_MAP: Record<string, unknown> }>(ACTS_MODULE);
      expect(seam.ACT_MAP[TRANSCRIBE_SHEET_NOTES], `${ACTS_MODULE}'s map is total over the enum, and this type renders through ${TRANSCRIBE_ACT_MODULE}`).toBe(
        await transcribeRendering(),
      );
    },
    BUDGET_MS,
  );

  test(
    "AC-2: the preview names one subject per reading, keyed as the notes law keys one, and re-derives no line",
    async () => {
      const { staged: stage, proposals } = await staged();
      const door = await notesDoor();
      const readings = await theThreeReadings();
      const consequence = await previewOf(stage.measurer.actor, transcription(stage, readings));

      expect(consequence.rendering, "a reading is shown as the subjects it moves (L-ACT-02)").toBe("SUBJECTS");
      const subjects = subjectsOf(consequence);
      expect(subjects.length, `one subject per reading offered: ${JSON.stringify(subjects)}`).toBe(readings.length);

      for (const [at, offered] of readings.entries()) {
        const subject = subjects[at] as Record<string, unknown>;
        const key = door.noteReadingKey({
          drawingId: stage.sheet.drawingId,
          layoutName: stage.sheet.layoutName,
          kind: offered.kind,
          actorId: stage.measurer.person.userId,
          sourceKey: offered.sourceKey,
        });
        expect(String(subject["subjectId"]), `the ${offered.kind} subject is keyed by sheet, kind, actor and source`).toBe(key);
        expect(String(subject["subjectLabel"]), "and is labelled by the kind it reads").toBe(offered.kind);
        const moved = movedTo(subject);
        expect(moved.before, `nobody had read ${offered.kind} under that key before`).toEqual([]);
        expect(moved.after.length, "and it would stand at exactly one figure").toBe(1);
      }

      const fy = subjects[0] as Record<string, unknown>;
      expect(movedTo(fy).after, "a reading stands at the canonical figure the grammar read, never at the words around it").toEqual([
        String((proposals[FY] as Record<string, unknown>)["canonical"]),
      ]);
      expect(effectsOf(consequence)["linesRederiving"], "no rebar rail stands yet, so this act names no line as re-deriving (out of scope, inc-309)").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: the commit writes one row per reading, transcribed, cited, and judged against the grammar",
    async () => {
      const { staged: stage, proposals } = await staged();
      const { actId } = await theCommit();

      const rows = readingRows(stage.tenantId).map(readingFacts).filter((row) => row.actId === actId);
      expect(rows.length, `three readings committed, three rows written: ${JSON.stringify(rows)}`).toBe(3);
      expect(
        actsOfType(stage.tenantId, stage.projectId, TRANSCRIBE_SHEET_NOTES).map((act) => act.actId),
        "under one act for one transcription (L-ACT-01)",
      ).toEqual([actId]);

      const byKind = Object.fromEntries(rows.map((row) => [row.kind, row]));
      for (const kind of [FY, LAP, HOOK_MIN]) {
        const row = byKind[kind] as Record<string, string>;
        expect(row, `the store holds the ${kind} reading: ${JSON.stringify(rows.map((one) => one.kind))}`).toBeTruthy();
        expect(row["basis"], "a note reading is read off the drawing's own text (L-QTY-01)").toBe(TRANSCRIBED);
        expect(row["sourceKey"], `and cites the text ${kind} was read from`).toBe(String((proposals[kind] as Record<string, unknown>)["sourceKey"]));
        expect(row["actorId"], "by the person who read it").toBe(stage.measurer.person.userId);
        expect(row["drawingId"], "on the sheet it was read on").toBe(stage.sheet.drawingId);
        expect(row["layoutName"], "and the layout of that sheet").toBe(stage.sheet.layoutName);
      }

      expect((byKind[FY] as Record<string, string>)["acceptance"], "the grade was taken as the grammar proposed it").toBe(ACCEPTED);
      expect((byKind[LAP] as Record<string, string>)["acceptance"], "and so was the lap").toBe(ACCEPTED);
      expect(
        (byKind[HOOK_MIN] as Record<string, string>)["acceptance"],
        "the minimum hook was written at another figure, so it is EDITED however the caller labelled it (AC-2)",
      ).toBe(EDITED);
      expect((byKind[HOOK_MIN] as Record<string, string>)["valueAsWritten"], "at the figure the person read").toBe(EDITED_HOOK_MIN);
      expect((byKind[HOOK_MIN] as Record<string, string>)["unitAsWritten"], "in the unit they kept").toBe(MM);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: a commit carrying a digest the current state does not produce refuses by name and writes nothing",
    async () => {
      const { staged: stage } = await staged();
      await theCommit();
      const acts = await actsSeam();
      const before = readingRows(stage.tenantId).length;

      const input = transcription(stage, [reading(HOOK_MIN, (await theThreeReadings())[2]?.sourceKey as string, "125", MM)]);
      const consequence = await acts.preview(stage.measurer.actor, input);
      const stale = acts.consequenceDigest(consequence);
      // A second reading under the same key moves the state the first digest was taken of.
      await performAct(stage.second.actor, transcription(stage, [reading(HOOK_MIN, (await theThreeReadings())[2]?.sourceKey as string, "150", MM)]));

      const failure = await rejection(acts.commit(stage.measurer.actor, input, stale));
      expect(failure, "a commit whose digest is not the one current state produces is refused (L-ACT-02)").not.toBeNull();
      expect(await codeOf(failure), "by name").toBe(CONSEQUENCES_NOT_CARRIED);
      expect(readingRows(stage.tenantId).length, "and the refusal wrote nothing").toBe(before + 1);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: a reading citing text that is not on the sheet is refused at the preview, under a registered code",
    async () => {
      const { staged: stage } = await staged();
      await theCommit();
      const before = readingRows(stage.tenantId).length;

      const refused = await refusalOfPreviewing(stage.measurer.actor, transcription(stage, [reading(FY, FOREIGN_KEY, "500", "MPa")]));
      expect(refused, "a reading is kept only where its evidence is (L-CAD-03)").toBe(NOTE_SOURCE_NOT_ON_SHEET);
      expect(Object.keys(await schedulesRefusals()), "and the code is registered in the area's own taxonomy (Q-07)").toContain(NOTE_SOURCE_NOT_ON_SHEET);
      expect(readingRows(stage.tenantId).length, "nothing was written").toBe(before);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: reading the same figure again moves nothing, so the seam refuses it and writes no row",
    async () => {
      const { staged: stage, proposals } = await staged();
      await theCommit();
      const before = readingRows(stage.tenantId).length;

      const refused = await refusalOfPerforming(stage.measurer.actor, transcription(stage, [asProposed(proposals[FY] as Record<string, unknown>)]));
      expect(refused, "an act that changes nothing is refused by the seam, never written as a no-op (L-ACT-01)").toBe(ACT_CHANGES_NOTHING);
      expect(readingRows(stage.tenantId).length, "and the store is untouched").toBe(before);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: a reading of a new figure under the same key stands, and the earlier one is superseded",
    async () => {
      const { staged: stage, proposals } = await staged();
      await theCommit();
      const door = await notesDoor();
      const lap = proposals[LAP] as Record<string, unknown>;
      const key = door.noteReadingKey({
        drawingId: stage.sheet.drawingId,
        layoutName: stage.sheet.layoutName,
        kind: LAP,
        actorId: stage.measurer.person.userId,
        sourceKey: String(lap["sourceKey"]),
      });

      await performAct(stage.measurer.actor, transcription(stage, [reading(LAP, String(lap["sourceKey"]), "45", "d")]));
      const mine = readingRows(stage.tenantId)
        .map(readingFacts)
        .filter((row) => row.readingKey === key);
      expect(mine.length, "both readings are kept — superseded, never erased (R-TO-051)").toBe(2);

      const standing = door.noteStanding(mine as unknown as Record<string, unknown>[]);
      expect((standing.current as unknown[]).length, "the later reading under that key is the current one").toBe(1);
      expect((standing.superseded as unknown[]).length, "and the earlier one is reported superseded").toBe(1);
      expect(String((standing.current as Record<string, unknown>[])[0]?.["canonical"]), "the figure that stands is the one read last").toBe("45");
    },
    BUDGET_MS,
  );

  test(
    "AC-2: a statement carrying no reading at all is malformed at the door",
    async () => {
      const { staged: stage } = await staged();
      const caller = await schedulesCaller(stage.measurer.person);
      const failure = await rejection(
        caller.previewTranscribeSheetNotes({
          input: { type: TRANSCRIBE_SHEET_NOTES, projectId: stage.projectId, drawingId: stage.sheet.drawingId, layoutName: stage.sheet.layoutName, readings: [] },
        }),
      );
      expect(failure, "a transcription of nothing is not a statement the door takes").not.toBeNull();
      expect(await codeOf(failure), "a malformed statement is a refusal, never a 500 (the product's law)").toBe(REQUEST_MALFORMED);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: the readings stand in a table of their own, closed to a kind, a basis and a verdict nobody registered",
    async () => {
      const { staged: stage } = await staged();
      await theCommit();
      const rows = readingRows(stage.tenantId).map(readingFacts);
      expect(rows.length, `public.${NOTES_READINGS_TABLE} holds this workspace's readings`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.basis, "every row of the table is transcribed off a drawing").toBe(TRANSCRIBED);
        expect([ACCEPTED, EDITED], `and carries one of the two verdicts: ${JSON.stringify(row)}`).toContain(row.acceptance);
      }
    },
    BUDGET_MS,
  );
});
