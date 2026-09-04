/**
 * AC-2 and AC-6 — CONFIRM_DISCIPLINE, the first act after ASSIGN_PARTICIPANT_ROLE
 * (L-ACT-01, L-ACT-02, L-REG-03, R-TO-004).
 *
 * The act is driven through the shipped seam, never around it: `preview` answers a Consequence, its
 * digest is carried back to `commit`, and what the store then holds is read as the acceptance's own
 * audit read. Every subject the criteria expect is derived from the index the product itself
 * answered for the staged drawing, so a corpus that grows a sheet grows the expectation with it
 * (B-19).
 *
 * The refusal half is exercised by name (`GROUP_NOT_OFFERED`), at the seam and on the wire, with the
 * store counted either side of the attempt: a refusal that wrote a row is not a refusal.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_MODULE,
  CONFIRM_DISCIPLINE,
  CORE_SHEETS_MODULE,
  ERRORS_MODULE,
  GROUP_NOT_OFFERED,
  MEASURE,
  PRINCIPAL,
  SHEETS_MODULE,
  TAKEOFF_ROUTER_MODULE,
  actRows,
  actorOf,
  byCodePoint,
  closeStage,
  disciplineRows,
  grantRole,
  openSheetsStage,
  productModule,
  rejection,
  rowCount,
  stagePerson,
  stageSheets,
  type ActsSeam,
  type ConfirmDisciplineInput,
  type CoreSheetsSeam,
  type ErrorsSeam,
  type OfferedGroupKey,
  type Person,
  type SheetCard,
  type SheetsSeam,
} from "../support/sheets-stage";

/** How long a staged case may take: one real `uv run` cold, plus the acts driven over it. */
const BUDGET_MS = 900_000;

/** The discipline the rcc6 title blocks propose, and the one every group below is keyed on. */
const STRUCTURAL = "STRUCTURAL";

interface Staged {
  sheets: SheetsSeam;
  core: CoreSheetsSeam;
  acts: ActsSeam;
  person: Person;
  projectId: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const sheets = await productModule<SheetsSeam>(SHEETS_MODULE);
    const core = await productModule<CoreSheetsSeam>(CORE_SHEETS_MODULE);
    const acts = await productModule<ActsSeam>(ACTS_MODULE);

    await openSheetsStage();
    const { person, projectId } = await stagePerson("confirm");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    return { sheets, core, acts, person, projectId };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** One more drawing of the corpus on the staged project, with the index it produced. */
async function freshDrawing(label: string): Promise<{ drawingId: string; ingestId: string; cards: SheetCard[] }> {
  const stage = await staged();
  const { drawing, record } = await stageSheets(stage.person, stage.projectId, label);
  const cards = (await stage.sheets.sheetIndexOf({ tenantId: stage.person.tenantId, projectId: stage.projectId })).filter((card) => card.drawingId === drawing.drawingId);
  expect(cards.length, `the staged drawing ${label} fanned out into cards — an empty index judges nothing`).toBeGreaterThan(0);
  return { drawingId: drawing.drawingId, ingestId: record.ingestId, cards };
}

/** The refusal code a failure carries, whether it arrived bare or wrapped by a transport. */
async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>("src/core/faults/refusal-marker.ts");
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** What one confirmation asks for. */
function confirming(projectId: string, group: OfferedGroupKey): ConfirmDisciplineInput {
  return { type: CONFIRM_DISCIPLINE, projectId, group };
}

describe("AC-2: the act type, its permission and its rendering", () => {
  test("AC-2: CONFIRM_DISCIPLINE joins the act-type enum and moves MEASURE", async () => {
    const stage = await staged();
    expect(stage.acts.ACT_TYPES, "CONFIRM_DISCIPLINE is the act this increment renders (L-ACT-02's map is total over the enum)").toContain(CONFIRM_DISCIPLINE);
    expect(stage.acts.ACT_PERMISSION[CONFIRM_DISCIPLINE], "confirming a discipline is what a measurer does before a sheet may be walked (L-REG-03, L-ACT-03)").toBe(MEASURE);
  }, BUDGET_MS);

  test("AC-2: preview answers a SUBJECTS Consequence naming every unconfirmed sheet the group holds", async () => {
    const stage = await staged();
    const drawing = await freshDrawing("preview");
    const wanted = drawing.cards.filter((card) => card.confirmed === null && card.proposal.discipline === STRUCTURAL);
    expect(wanted.length, "the corpus proposes STRUCTURAL sheets — with none there is no group to preview").toBeGreaterThan(0);

    const consequence = await stage.acts.preview(actorOf(stage.person), confirming(stage.projectId, { kind: "PROPOSED_DISCIPLINE", drawingId: drawing.drawingId, discipline: STRUCTURAL }));
    expect(consequence.rendering, "the Consequence renders through the shipped SUBJECTS arm (L-ACT-02)").toBe("SUBJECTS");
    expect(consequence.actType, "the Consequence names the act it was computed for").toBe(CONFIRM_DISCIPLINE);
    expect(byCodePoint(consequence.subjects.map((subject) => subject.subjectId)), "one subject per unconfirmed sheet of that drawing whose proposal is the group's discipline — membership is the machine's (L-ACT-02)").toEqual(byCodePoint(wanted.map((card) => card.sheetId)));

    const titles = new Map(wanted.map((card) => [card.sheetId, card.proposal.title]));
    for (const subject of consequence.subjects) {
      expect({ before: [...subject.before], after: [...subject.after] }, `the act adds a confirmed discipline to ${subject.subjectId} and overwrites nothing (L-ACT-01: before-images are rejected)`).toStrictEqual({ before: [], after: [STRUCTURAL] });
      expect(subject.subjectLabel, `the subject ${subject.subjectId} is recognisable by the sheet's proposed title`).toBe(titles.get(subject.subjectId));
    }
  }, BUDGET_MS);

  test("AC-2: commit writes the act row and one confirmation per subject in one transaction, and the group is then no longer offered", async () => {
    const stage = await staged();
    const drawing = await freshDrawing("commit");
    const group: OfferedGroupKey = { kind: "PROPOSED_DISCIPLINE", drawingId: drawing.drawingId, discipline: STRUCTURAL };
    const input = confirming(stage.projectId, group);

    const consequence = await stage.acts.preview(actorOf(stage.person), input);
    const subjects = byCodePoint(consequence.subjects.map((subject) => subject.subjectId));
    const before = actRows(stage.person.tenantId, stage.projectId).length;

    const written = await stage.acts.commit(actorOf(stage.person), input, stage.acts.consequenceDigest(consequence));
    const after = actRows(stage.person.tenantId, stage.projectId);
    expect(after.length, "a confirm-all is ONE act with N subjects, recorded at the granularity performed (L-ACT-01)").toBe(before + 1);
    const act = after[after.length - 1];
    expect({ actType: act?.actType, subjects: byCodePoint(act?.subjects ?? []) }, "the act row names the act type and exactly the sheets it moved").toStrictEqual({ actType: CONFIRM_DISCIPLINE, subjects });
    expect(act?.actId, "the seam answers the id of the row it wrote").toBe(written.actId);

    const rows = disciplineRows(stage.person.tenantId, stage.projectId).filter((row) => row.ingestId === drawing.ingestId);
    expect(byCodePoint(rows.map((row) => stage.core.sheetIdOf(row.ingestId, row.layoutName))), "one sheet_disciplines row per subject — the state change and the act row land together or neither (L-ACT-01)").toEqual(subjects);
    for (const row of rows) {
      expect({ discipline: row.discipline, actId: row.actId }, `the confirmation of ${row.layoutName} carries the discipline confirmed and the act that carried it`).toStrictEqual({ discipline: STRUCTURAL, actId: written.actId });
    }

    const cards = (await stage.sheets.sheetIndexOf({ tenantId: stage.person.tenantId, projectId: stage.projectId })).filter((card) => card.drawingId === drawing.drawingId);
    for (const sheetId of subjects) {
      const card = cards.find((entry) => entry.sheetId === sheetId);
      expect(card?.confirmed, `the card for ${sheetId} now reports the confirmed discipline and the act it came from`).toStrictEqual({ discipline: STRUCTURAL, actId: written.actId });
    }

    const groups = await stage.sheets.offeredGroupsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    const still = groups.filter((offered) => offered.key.kind === "PROPOSED_DISCIPLINE" && offered.key.drawingId === drawing.drawingId && offered.key.discipline === STRUCTURAL);
    expect(still, "a group whose every member is confirmed is not offered smaller — it is not offered (L-ACT-02)").toEqual([]);
  }, BUDGET_MS);

  test("AC-2: a SHEET group confirms exactly one sheet the same way", async () => {
    const stage = await staged();
    const drawing = await freshDrawing("one-sheet");
    const card = drawing.cards.find((entry) => entry.confirmed === null);
    expect(card, "the staged drawing carries an unconfirmed sheet to confirm on its own").toBeTruthy();
    const one = card as SheetCard;
    const input = confirming(stage.projectId, { kind: "SHEET", sheetId: one.sheetId, discipline: one.proposal.discipline });

    const consequence = await stage.acts.preview(actorOf(stage.person), input);
    expect(consequence.subjects.map((subject) => subject.subjectId), "a group of one is still a typed key with server-resolved membership").toEqual([one.sheetId]);

    const written = await stage.acts.commit(actorOf(stage.person), input, stage.acts.consequenceDigest(consequence));
    const rows = disciplineRows(stage.person.tenantId, stage.projectId).filter((row) => row.actId === written.actId);
    expect(rows.map((row) => stage.core.sheetIdOf(row.ingestId, row.layoutName)), "one confirmation row, for the one sheet the key named").toEqual([one.sheetId]);
    expect(rows[0]?.discipline, "the confirmation carries the discipline the key named").toBe(one.proposal.discipline);

    const cards = await stage.sheets.sheetIndexOf({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    expect(cards.find((entry) => entry.sheetId === one.sheetId)?.confirmed, "the confirmed sheet reports its discipline and the act it came from").toStrictEqual({ discipline: one.proposal.discipline, actId: written.actId });
  }, BUDGET_MS);
});

describe("AC-6: a group the current state does not offer is refused by name", () => {
  test("AC-6: GROUP_NOT_OFFERED is registered with a message and a remedy", async () => {
    const errors = await productModule<ErrorsSeam>(ERRORS_MODULE);
    const entry = errors.REFUSALS[GROUP_NOT_OFFERED];
    expect(entry, `${GROUP_NOT_OFFERED} is a registered refusal — a code a screen renders is one the register holds (R-UI-020)`).toBeTruthy();
    expect((entry as { code: string }).code, "the entry is keyed by its own code").toBe(GROUP_NOT_OFFERED);
    expect((entry as { message: string }).message.length, "the refusal says in one sentence what was refused").toBeGreaterThan(0);
    expect((entry as { remedy: string }).remedy.length, "the refusal says in one sentence what resolves it").toBeGreaterThan(0);
    expect((entry as { severity: string }).severity, "a refused confirmation is an error the reader is answered with").toBe("error");
    expect((entry as { surface: string }).surface, "it renders in place, beside the door that was pressed (R-UI-020)").toBe("inline");
  }, BUDGET_MS);

  test("AC-6: preview and commit refuse an unoffered group and write nothing", async () => {
    const stage = await staged();
    const drawing = await freshDrawing("refused");
    const card = drawing.cards.find((entry) => entry.confirmed === null) as SheetCard;
    const settled = await stage.acts.preview(actorOf(stage.person), confirming(stage.projectId, { kind: "SHEET", sheetId: card.sheetId, discipline: card.proposal.discipline }));
    await stage.acts.commit(actorOf(stage.person), confirming(stage.projectId, { kind: "SHEET", sheetId: card.sheetId, discipline: card.proposal.discipline }), stage.acts.consequenceDigest(settled));

    const unoffered: { what: string; group: OfferedGroupKey }[] = [
      { what: "a SHEET group for a sheet that is already confirmed", group: { kind: "SHEET", sheetId: card.sheetId, discipline: card.proposal.discipline } },
      { what: "a PROPOSED_DISCIPLINE group whose drawing is not in this project", group: { kind: "PROPOSED_DISCIPLINE", drawingId: randomUUID(), discipline: STRUCTURAL } },
      { what: "a SHEET group for a sheet no current record carries", group: { kind: "SHEET", sheetId: stage.core.sheetIdOf(randomUUID(), "NO SUCH LAYOUT"), discipline: STRUCTURAL } },
    ];

    for (const { what, group } of unoffered) {
      const acts = actRows(stage.person.tenantId, stage.projectId).length;
      const confirmations = rowCount("sheet_disciplines", stage.person.tenantId);
      const input = confirming(stage.projectId, group);

      const refusedPreview = await rejection(stage.acts.preview(actorOf(stage.person), input));
      expect(refusedPreview, `previewing ${what} answered a Consequence for a group the project does not offer`).not.toBeNull();
      expect(await codeOf(refusedPreview), `previewing ${what} refuses ${GROUP_NOT_OFFERED} by name`).toBe(GROUP_NOT_OFFERED);

      const refusedCommit = await rejection(stage.acts.commit(actorOf(stage.person), input, "0".repeat(64)));
      expect(refusedCommit, `committing ${what} was carried out`).not.toBeNull();
      expect(await codeOf(refusedCommit), `committing ${what} refuses ${GROUP_NOT_OFFERED} by name`).toBe(GROUP_NOT_OFFERED);

      expect(actRows(stage.person.tenantId, stage.projectId).length, `${what}: a refusal writes no act row (L-ACT-01)`).toBe(acts);
      expect(rowCount("sheet_disciplines", stage.person.tenantId), `${what}: a refusal writes no confirmation row`).toBe(confirmations);
    }
  }, BUDGET_MS);

  test("AC-6: takeoff.previewConfirmDiscipline carries the same code to the wire", async () => {
    const stage = await staged();
    const router = await productModule<{ takeoffRouter: { createCaller: (ctx: unknown) => Record<string, (input: unknown) => Promise<unknown>> } }>(TAKEOFF_ROUTER_MODULE);
    expect(typeof router.takeoffRouter?.createCaller, `${TAKEOFF_ROUTER_MODULE} publishes the takeoff lane's router`).toBe("function");

    const here = "http://127.0.0.1";
    const caller = router.takeoffRouter.createCaller({
      requestId: randomUUID(),
      actor: "an-account",
      origin: here,
      statedOrigin: null,
      requestOrigin: here,
      deviceLabel: "acceptance",
      client: "an unobserved caller",
      session: { sessionId: randomUUID(), userId: stage.person.userId },
      secureCookies: false,
      cookies: [],
    });

    const call = caller["previewConfirmDiscipline"] as ((input: unknown) => Promise<unknown>) | undefined;
    expect(typeof call, "takeoff.previewConfirmDiscipline is on the wire (the increment's test contract)").toBe("function");
    const asked = call as (input: unknown) => Promise<unknown>;
    const failure = await rejection(asked({ input: confirming(stage.projectId, { kind: "PROPOSED_DISCIPLINE", drawingId: randomUUID(), discipline: STRUCTURAL }) }));
    expect(failure, "the transport answered a Consequence for a group the project does not offer").not.toBeNull();
    expect(await codeOf(failure), `the transport carries ${GROUP_NOT_OFFERED} to its caller rather than swallowing it into a fault (B-21)`).toBe(GROUP_NOT_OFFERED);
  }, BUDGET_MS);
});
