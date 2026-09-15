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
  BNBC_GENERAL_NOTES,
  BNBC_PILE_NOTE,
  CONSEQUENCES_NOT_CARRIED,
  EDITED,
  FC,
  FY,
  HOOK_MIN,
  LAP,
  MEASURE,
  NOTES_READINGS_TABLE,
  NOTE_READING_CONTESTED,
  NOTE_SOURCE_NOT_ON_SHEET,
  REQUEST_MALFORMED,
  SUSPENDED,
  TRANSCRIBED,
  TRANSCRIBE_ACT_MODULE,
  TRANSCRIBE_SHEET_NOTES,
} from "./support/bnbc-notes";
import { productModule } from "./support/notes-doors";
import {
  NOTES_LINE_KEY,
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
  stageSheetOutsideRevision,
  subjectsOf,
  transcribeRendering,
  transcription,
  type ProposedReading,
  type StagedNotes,
  type StagedSheet,
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

/* ------------------------------------------------------------ the spelling, and the figure under it */

/** A unit no general note of this fixture states the lap in — a multiple of the bar is not a length. */
const OTHER_UNIT = "mm";

/** The two kinds whose sentence is written one way and canonicalises to another (AC-1: `500 MPa`, `50d`). */
const RESPELT_KINDS: readonly string[] = [FY, LAP];

/** The reading a proposal is, offered in the grammar's OWN canonical spelling of it, under its unit. */
function asCanonical(proposal: Record<string, unknown>): ProposedReading {
  return reading(String(proposal["kind"]), String(proposal["sourceKey"]), String(proposal["canonical"]), String(proposal["unitAsWritten"]));
}

let respelt: Promise<Ground> | undefined;

/**
 * A sheet of its own, on which nothing has been read yet — the ground for what the seam judges BY.
 *
 * The screen's proposal field holds the canonical (AC-6), so what a person hands back for a row they
 * never touched is the bare figure, not the sentence's own words. A seam that compared the words
 * would call every untouched row EDITED, and would write a row for a re-reading that moved nothing.
 */
function respeltGround(): Promise<Ground> {
  return (respelt ??= (async () => {
    const door = await notesDoor();
    const stage = await stageNotes("spelling");
    const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
    const proposals = Object.fromEntries(door.proposeNotes(texts).map((proposal) => [String(proposal["kind"]), proposal]));
    for (const kind of RESPELT_KINDS) {
      const proposal = proposals[kind] as Record<string, unknown> | undefined;
      expect(proposal, `the staged sheet proposes a ${kind} reading: ${JSON.stringify(Object.keys(proposals))}`).toBeTruthy();
      expect(
        String((proposal as Record<string, unknown>)["canonical"]),
        `and the drawing's words for the ${kind} are not already the figure the grammar reads out of them, so offering the figure really is another spelling: ${JSON.stringify(proposal)}`,
      ).not.toBe(String((proposal as Record<string, unknown>)["valueAsWritten"]));
    }
    return { staged: stage, proposals };
  })());
}

let respeltCommit: Promise<{ actId: string }> | undefined;

/** The grade and the lap, handed back at the very figure the grammar canonicalised them to. */
function theRespeltCommit(): Promise<{ actId: string }> {
  return (respeltCommit ??= (async () => {
    const { staged: stage, proposals } = await respeltGround();
    const readings = RESPELT_KINDS.map((kind) => asCanonical(proposals[kind] as Record<string, unknown>));
    const performed = await performAct(stage.measurer.actor, transcription(stage, readings));
    return { actId: performed.actId };
  })());
}

let otherUnit: Promise<{ staged: StagedNotes; sheet: StagedSheet; lap: Record<string, unknown> }> | undefined;

/**
 * A SECOND sheet of the same project, carrying the same notes: a reading made here stands under a key
 * of its own (a reading is keyed by its sheet), so what it is judged as owes nothing to the readings
 * standing on the first one.
 */
function otherUnitGround(): Promise<{ staged: StagedNotes; sheet: StagedSheet; lap: Record<string, unknown> }> {
  return (otherUnit ??= (async () => {
    const door = await notesDoor();
    const { staged: stage } = await respeltGround();
    const sheet = await stageSheetOutsideRevision(stage, "unit");
    const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: sheet.drawingId }, sheet.layoutName);
    const lap = door.proposeNotes(texts).find((proposal) => String(proposal["kind"]) === LAP);
    expect(lap, "the second sheet states the lap too — it is the same notes block").toBeTruthy();
    return { staged: stage, sheet, lap: lap as Record<string, unknown> };
  })());
}

type TwoTexts = { staged: StagedNotes; strengths: Record<string, unknown>[] };

let bothStrengths: Promise<TwoTexts> | undefined;

/**
 * A second sheet of the same fixture, whose notes state the concrete strength TWICE — the general
 * figure and the bored piles' own, each in its own sentence. One person reading both makes two
 * readings of one kind, which is the ground for what a reading is keyed BY (AC-2).
 */
function twoStrengths(): Promise<TwoTexts> {
  return (bothStrengths ??= (async () => {
    const door = await notesDoor();
    const stage = await stageNotes("two-texts", [...BNBC_GENERAL_NOTES, BNBC_PILE_NOTE]);
    const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
    const strengths = door.proposeNotes(texts).filter((proposal) => String(proposal["kind"]) === FC);
    expect(strengths.length, `the sheet states the concrete strength in two sentences, so the grammar offers two readings of it: ${JSON.stringify(strengths)}`).toBe(2);
    expect(new Set(strengths.map((one) => String(one["sourceKey"]))).size, "each read off its own text").toBe(2);
    return { staged: stage, strengths };
  })());
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
    "AC-2: a digest taken before the readings under that very key moved is refused by name, and writes nothing",
    async () => {
      const { staged: stage } = await staged();
      await theCommit();
      const acts = await actsSeam();
      const hookMinKey = (await theThreeReadings())[2]?.sourceKey as string;
      const before = readingRows(stage.tenantId).length;

      // The digest is taken over what the minimum hook stands at now: 100 mm, under this actor's key.
      const input = transcription(stage, [reading(HOOK_MIN, hookMinKey, "125", MM)]);
      const consequence = await acts.preview(stage.measurer.actor, input);
      const stale = acts.consequenceDigest(consequence);

      // The SAME person then reads it again at another figure, through a preview of its own: what the
      // stale digest was taken over — the readings standing under that key — has moved beneath it.
      await performAct(stage.measurer.actor, transcription(stage, [reading(HOOK_MIN, hookMinKey, "150", MM)]));
      expect(readingRows(stage.tenantId).length, "the second reading was written").toBe(before + 1);

      const failure = await rejection(acts.commit(stage.measurer.actor, input, stale));
      expect(failure, "a commit whose digest is not the one current state produces is refused (L-ACT-02)").not.toBeNull();
      expect(await codeOf(failure), "by name").toBe(CONSEQUENCES_NOT_CARRIED);
      expect(readingRows(stage.tenantId).length, "and the refusal wrote nothing on top of it").toBe(before + 1);
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
    "AC-2: a reading citing an entity of this very sheet that states no words is refused the same way",
    async () => {
      const { staged: stage } = await staged();
      const door = await notesDoor();
      await theCommit();
      const before = readingRows(stage.tenantId).length;

      // The rule the notes block is underscored with: on this sheet, at a key of this sheet's own
      // scheme, and not a text entity — so there is nothing there for anybody to have read (L-QTY-01).
      const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
      expect(texts.map((one) => one.sourceKey), `the sheet's texts are its TEXT entities, and the rule is not one of them: ${NOTES_LINE_KEY}`).not.toContain(NOTES_LINE_KEY);

      const refused = await refusalOfPreviewing(stage.measurer.actor, transcription(stage, [reading(FY, NOTES_LINE_KEY, "500", "MPa")]));
      expect(refused, "a transcription is a reading of TEXT: an entity that writes nothing cannot be what a figure was read from").toBe(NOTE_SOURCE_NOT_ON_SHEET);
      expect(readingRows(stage.tenantId).length, "and nothing was written").toBe(before);
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
    "AC-2: a reading handed back at the grammar's own canonical figure is ACCEPTED, though the drawing spelled it otherwise",
    async () => {
      const { staged: stage, proposals } = await respeltGround();
      const { actId } = await theRespeltCommit();

      const rows = readingRows(stage.tenantId)
        .map(readingFacts)
        .filter((row) => row.actId === actId);
      expect(rows.length, `two readings committed, two rows written: ${JSON.stringify(rows)}`).toBe(RESPELT_KINDS.length);

      const byKind = Object.fromEntries(rows.map((row) => [row.kind, row]));
      for (const kind of RESPELT_KINDS) {
        const proposal = proposals[kind] as Record<string, unknown>;
        const row = byKind[kind] as Record<string, string> | undefined;
        expect(row, `the store holds the ${kind} reading: ${JSON.stringify(rows.map((one) => one.kind))}`).toBeTruthy();
        const kept = row as Record<string, string>;
        expect(kept["valueAsWritten"], `written as the person handed it over: ${String(proposal["canonical"])}`).toBe(String(proposal["canonical"]));
        expect(kept["unitAsWritten"], "under the unit the grammar read beside it").toBe(String(proposal["unitAsWritten"]));
        expect(kept["canonical"], "and canonicalising to the very figure the grammar proposed").toBe(String(proposal["canonical"]));
        expect(
          kept["acceptance"],
          `nothing about the ${kind} moved off what was proposed — only the words it was offered in did — so the seam takes it AS PROPOSED (AC-2)`,
        ).toBe(ACCEPTED);
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-2: a reading at the proposed figure under another unit is EDITED — a unit is half of what was read",
    async () => {
      const { staged: stage, sheet, lap } = await otherUnitGround();
      expect(String(lap["unitAsWritten"]), `the sheet states the lap as a multiple of the bar, never in ${OTHER_UNIT}`).not.toBe(OTHER_UNIT);

      const offered = reading(LAP, String(lap["sourceKey"]), String(lap["canonical"]), OTHER_UNIT);
      const { actId } = await performAct(stage.measurer.actor, transcription({ projectId: stage.projectId, sheet }, [offered]));
      const rows = readingRows(stage.tenantId)
        .map(readingFacts)
        .filter((row) => row.actId === actId);
      expect(rows.length, `one reading committed, one row written: ${JSON.stringify(rows)}`).toBe(1);

      const row = rows[0] as Record<string, string>;
      expect(row["canonical"], "at the figure the grammar itself read out of the sentence").toBe(String(lap["canonical"]));
      expect(row["unitAsWritten"], `but in the unit the person kept: ${OTHER_UNIT}`).toBe(OTHER_UNIT);
      expect(row["acceptance"], "a figure the grammar proposed, in a unit it did not, is a reading somebody EDITED (AC-2)").toBe(EDITED);
    },
    BUDGET_MS,
  );

  test(
    "AC-2: the drawing's own words over a canonical that already stands move nothing, and are refused",
    async () => {
      const { staged: stage, proposals } = await respeltGround();
      await theRespeltCommit();
      const lap = proposals[LAP] as Record<string, unknown>;
      const before = readingRows(stage.tenantId).length;

      // What stands under this key is the bare figure (`50`); what is offered now is the drawing's own
      // spelling of that very figure (`50d`), in the same unit. Different words, the same reading — and
      // it is the READING that stands, so there is nothing here for an act to carry (L-ACT-01).
      const refused = await refusalOfPerforming(stage.measurer.actor, transcription(stage, [asProposed(lap)]));
      expect(refused, "a reading that leaves the standing figure and its unit exactly where they were changes nothing").toBe(ACT_CHANGES_NOTHING);
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
    "AC-2: one person reading one kind off two different sentences makes two readings, and both stand",
    async () => {
      const { staged: stage, strengths } = await twoStrengths();
      const door = await notesDoor();
      const readings = strengths.map((proposal) => asProposed(proposal));

      const consequence = await previewOf(stage.measurer.actor, transcription(stage, readings));
      const subjects = subjectsOf(consequence);
      expect(subjects.length, `a reading is made OF a text, so two sentences are two subjects: ${JSON.stringify(subjects)}`).toBe(readings.length);
      const subjectIds = subjects.map((subject) => String(subject["subjectId"]));
      expect(new Set(subjectIds).size, "and the two are keyed apart — what a reading is keyed by includes the text it cites").toBe(readings.length);
      for (const [at, offered] of readings.entries()) {
        expect(subjectIds[at], `the ${offered.kind} read from ${offered.sourceKey} is keyed by that sentence`).toBe(
          door.noteReadingKey({
            drawingId: stage.sheet.drawingId,
            layoutName: stage.sheet.layoutName,
            kind: offered.kind,
            actorId: stage.measurer.person.userId,
            sourceKey: offered.sourceKey,
          }),
        );
      }

      const { actId } = await performAct(stage.measurer.actor, transcription(stage, readings));
      const rows = readingRows(stage.tenantId)
        .map(readingFacts)
        .filter((row) => row.actId === actId);
      expect(rows.length, `one row per sentence read: ${JSON.stringify(rows)}`).toBe(readings.length);
      expect(new Set(rows.map((row) => row.readingKey)).size, "stored under two keys — neither reading is the other one made again").toBe(readings.length);
      expect(new Set(rows.map((row) => row.sourceKey)).size, "each citing the sentence it was read from").toBe(readings.length);

      const standing = door.noteStanding(rows as unknown as Record<string, unknown>[]);
      expect((standing.superseded as unknown[]).length, "a reading of another sentence supersedes nothing: they are not the same reading twice").toBe(0);
      expect((standing.current as unknown[]).length, "so both stand as current readings of this sheet's concrete strength").toBe(readings.length);
      expect(standing.standing, "and two current readings that disagree leave the figure suspended (AC-4)").toBe(SUSPENDED);
      expect(standing.code, "under the code a contested reading is refused by").toBe(NOTE_READING_CONTESTED);
      expect(standing.canonical ?? null, "standing at no figure at all — a suspension prints no number (I-253)").toBeNull();
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
