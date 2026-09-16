/**
 * AC-7 — the notes door governs the campaign: what a drawing says about detailing re-presents the
 * rebar lines, and mints no rule-set edition (AM-03(h), inc-303's door, L-MEA-06, L-QTY-02).
 *
 * The campaign is real: a workspace, a project pinned to an edition citing the five rebar pairs, a
 * general-notes sheet ingested by the shipped pipeline and held by the pinned revision, a level with
 * an authored storey height, two registered columns, and the campaign measured by `runMeasureJob`
 * with the shipped roster and the real gate.
 *
 * Three states are driven over one campaign, in order: nothing transcribed, then a LAP of 50d and an
 * fy of 500 MPa read off the sheet, and — on a second campaign — an fy of 550 MPa the edition holds
 * no row for. What is graded is that the SETUP's detailing is the door's answer and nothing else,
 * that the note moves the bar and the bill without minting an edition, and that a grade with no row
 * defers by name rather than being scaled.
 */
import { afterAll, describe, expect, test } from "vitest";
import { editionCounts, type EditionCounts } from "../../notes/support/notes-stage";
import {
  DERIVED,
  DETAILING_ROW_NOT_IN_EDITION,
  MEASURE_SETUP_MODULE,
  PARTIAL_DECLARED,
  RCC_REBAR,
  TRANSCRIBED,
  barRowsOf,
  bbsThroughDoor,
  bindingsOf,
  closeStage,
  detailingEdition,
  detailingLookups,
  linesOf,
  measure,
  omittedOf,
  railSetupOf,
  railSetupWatchingTheDoor,
  said,
  stageRebarCampaign,
  transcribeNotes,
  type BarRowShape,
  type DetailingSetupShape,
  type DoorCall,
  type MeasuredCampaign,
  type RebarStage,
  type StagedRebarMember,
} from "./support/rebar-stage";

const BUDGET_MS = 1_800_000;

/** The level the staged columns stand on, and the storey run authored for it. */
const LEVEL = { label: "GF", heightMm: "3352.8" };

/** Two columns of one mark: 400 × 400, eight 16 mm mains, 10 mm ties at 100 c/c. */
function columns(): StagedRebarMember[] {
  return [1, 2].map((at) => ({
    id: `COL:A${at}@GF`,
    class: "column",
    mark: "C1",
    level: LEVEL.label,
    section: { b: 400, d: 400 },
    mains: { n: 8, diameterMm: 16 },
    ties: { diameterMm: 10, spacingMm: 100 },
  }));
}

/** The kinds this criterion reads off the fixture's own general notes (inc-303's five). */
const FY = "FY";
const LAP = "LAP";

type Ground = {
  stage: RebarStage;
  unread: { setup: Awaited<ReturnType<typeof railSetupOf>>; measured: MeasuredCampaign; rows: BarRowShape[]; lines: { key: string; value: string; semantic: string }[] };
  editionsBefore: EditionCounts;
};

let ground: Promise<Ground> | undefined;
let after: Promise<{ measured: MeasuredCampaign; rows: BarRowShape[]; lines: { key: string; value: string; semantic: string }[]; editionsAfter: EditionCounts; bbs: Awaited<ReturnType<typeof bbsThroughDoor>> }> | undefined;
let contested: Promise<{ stage: RebarStage; measured: MeasuredCampaign }> | undefined;

/** One published line, as this criterion compares one across two runs of the job. */
function linesRead(stage: RebarStage): { key: string; value: string; semantic: string }[] {
  return linesOf(stage)
    .map((row) => ({ key: `${said(row, "objectKey", "object_key")}|${said(row, "kind", "kind")}`, value: said(row, "value", "value"), semantic: said(row, "semantic", "semantic") }))
    .sort((left, right) => (left.key < right.key ? -1 : 1));
}

/** The campaign before a single note is read — measured once, and read by three cases. */
const staged = (): Promise<Ground> =>
  (ground ??= (async () => {
    const stage = await stageRebarCampaign("notes", columns(), { levels: [LEVEL], detailing: "door" });
    const editionsBefore = editionCounts(stage.tenantId);
    const setup = await railSetupOf(stage);
    const measured = await measure(stage);
    const rows = await barRowsOf(measured.input);
    return { stage, unread: { setup, measured, rows, lines: linesRead(stage) }, editionsBefore };
  })());

/** The same campaign after the sheet's LAP and fy have been read off it. */
const transcribed = (): Promise<Awaited<NonNullable<typeof after>>> =>
  (after ??= (async () => {
    const { stage } = await staged();
    await transcribeNotes(stage, [
      { kind: LAP, valueAsWritten: "50", unitAsWritten: "d" },
      { kind: FY, valueAsWritten: "500", unitAsWritten: "MPa" },
    ]);
    const measured = await measure(stage);
    const rows = await barRowsOf(measured.input);
    return { measured, rows, lines: linesRead(stage), editionsAfter: editionCounts(stage.tenantId), bbs: await bbsThroughDoor(stage) };
  })());

/** A second campaign, whose only note is a grade the applied edition holds no row for. */
const unrowed = (): Promise<{ stage: RebarStage; measured: MeasuredCampaign }> =>
  (contested ??= (async () => {
    const stage = await stageRebarCampaign("fy550", columns(), { levels: [LEVEL], detailing: "door" });
    await transcribeNotes(stage, [{ kind: FY, valueAsWritten: "550", unitAsWritten: "MPa" }]);
    return { stage, measured: await measure(stage) };
  })());

afterAll(async () => {
  await closeStage();
});

/** The MAIN bar rows of a measured campaign — the verticals whose lap a note moves. */
function mains(rows: readonly BarRowShape[]): BarRowShape[] {
  return rows.filter((row) => row.role === "MAIN");
}

/**
 * The two sides of the seam, read as FIGURES.
 *
 * The door answers a value it has and leaves out one it has not; the setup spells the same thing
 * with a null in the empty place, and carries its figures as the decimal strings a setup is made of.
 * Comparing them term by term is what "the setup is the door's answer" means here — the spelling is
 * the seam's business, and a value the door never said has nowhere to come from.
 */
type FigureSaid = { value: number; unit: string } | null;
type DetailingSaid = {
  fy: FigureSaid;
  fc: FigureSaid;
  lapMultiplier: number | null;
  hookExtension: { multiplier: number | null; minimumMm: number | null } | null;
  suspended: string[];
  sourceKeys: string[];
};

function figureSaid(held: unknown): FigureSaid {
  if (held === undefined || held === null) return null;
  const one = held as { value: unknown; unit: unknown };
  return { value: Number(one.value), unit: String(one.unit) };
}

function halfSaid(held: unknown): number | null {
  return held === undefined || held === null ? null : Number(held);
}

function asDoorSaid(answered: Record<string, unknown>): DetailingSaid {
  const hook = answered["hookExtension"] as { multiplier?: unknown; minimumMm?: unknown } | null | undefined;
  return {
    fy: figureSaid(answered["fy"]),
    fc: figureSaid(answered["fc"]),
    lapMultiplier: halfSaid(answered["lapMultiplier"]),
    hookExtension: hook === undefined || hook === null ? null : { multiplier: halfSaid(hook.multiplier), minimumMm: halfSaid(hook.minimumMm) },
    suspended: [...((answered["suspended"] ?? []) as unknown[])].map(String).sort(),
    sourceKeys: [...((answered["sourceKeys"] ?? []) as unknown[])].map(String).sort(),
  };
}

function asSetupSays(carried: DetailingSetupShape): DetailingSaid {
  return asDoorSaid(carried as unknown as Record<string, unknown>);
}

describe("AC-7: the notes door governs what the campaign applies, and re-presents its lines", () => {
  test(
    "AC-7: the setup reads the ONE notes door, once, in the campaign's scope — and carries that call's answer",
    async () => {
      const { stage } = await staged();

      // The door is watched at the module namespace the loader imports it through, so what is
      // counted is the call the loader itself makes. A loader that reads the note readings out of
      // the store, or folds a second spelling of the same rows, is seen HERE by the silence — the
      // value it lands may be right and the door still never asked (AM-03(h), goal).
      const beforeNote = await railSetupWatchingTheDoor(stage);
      expect(
        beforeNote.calls.length,
        `${MEASURE_SETUP_MODULE} fills \`setup.detailing\` from \`appliedDetailingValuesOf\` — ONE call per setup, and no other reader of the notes (interfaces): it made ${beforeNote.calls.length}`,
      ).toBe(1);
      const asked = (beforeNote.calls[0] as DoorCall).scope;
      expect(
        { tenantId: asked["tenantId"], projectId: asked["projectId"], setRevisionId: asked["setRevisionId"] },
        "asked in this campaign's own scope: the tenant, the project, and the pinned revision whose sheets carry the notes (L-REG-06)",
      ).toEqual({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId });

      const carried = beforeNote.setup.detailing as DetailingSetupShape;
      expect(carried, "`railSetupOf` carries `setup.detailing` — the seam the rebar rail reads its applied values at (interfaces)").toBeTruthy();
      expect(asSetupSays(carried), "with nothing read, the setup carries that call's own silence — no grade, no strength, no multiplier defaulted into it (L-MEA-01)").toEqual(
        asDoorSaid((beforeNote.calls[0] as DoorCall).answered),
      );
      expect(asSetupSays(carried).fy, "and the unread campaign really is unread, so the case is not comparing two absences of its own making").toBe(null);

      // The same door, once more, over a campaign that now has something to answer WITH.
      const { measured } = await transcribed();
      const afterNote = await railSetupWatchingTheDoor(stage);
      expect(afterNote.calls.length, "the door is read once per setup after the note too — a second reader is a second answer (goal)").toBe(1);
      const call = afterNote.calls[0] as DoorCall;
      expect(call.answered["fy"], "the door itself answers the grade the sheet was read at — the case compares two figures here, not two absences").toBeTruthy();
      expect(Number((call.answered["fy"] as { value: unknown }).value), "and it is the 500 MPa transcribed off the drawing").toBe(500);
      expect(Number(call.answered["lapMultiplier"]), "and the transcribed 50d lap").toBe(50);
      expect(asSetupSays(afterNote.setup.detailing as DetailingSetupShape), "and the setup is THAT call's answer, value for value — the door is where a campaign's applied values come from (AM-03(h))").toEqual(
        asDoorSaid(call.answered),
      );
      expect(asSetupSays(measured.input.setup.detailing), "the setup the measure job handed the rail carries the same answer — the campaign was measured under what the door said (L-MEA-01)").toEqual(
        asDoorSaid(call.answered),
      );
    },
    BUDGET_MS,
  );

  test(
    "AC-7: with nothing transcribed the lap is the edition's own Class B, bound DERIVED",
    async () => {
      const { stage, unread } = await staged();
      expect(unread.measured.verdict.refused, `every offer published (the gate refused ${JSON.stringify(unread.measured.verdict.refusals)})`).toBe(0);
      expect(unread.lines.length, "the campaign published one rebar line per column (riskNotes (1): one line per (object, kind))").toBe(stage.members.length);

      for (const line of linesOf(stage)) {
        const bound = bindingsOf(line)["lap"];
        expect(bound, `the ${RCC_REBAR} line binds \`lap\` beside \`net\` — a lap is a component of its own, never a percentage (AM-03(a))`).toBeTruthy();
        expect(String(bound?.basis), "read off a clause of the applied edition, which is a DERIVED reading (L-MEA-06)").toBe(DERIVED);
      }

      const edition = await detailingEdition();
      const lookups = await detailingLookups();
      const rows = mains(unread.rows);
      expect(rows.length, "the campaign's bill carries the verticals of both columns").toBeGreaterThan(0);
      for (const row of rows) {
        const ld = lookups.developmentLengthOf(edition, {
          fyMPa: Number(edition["fyDefaultMPa"]),
          fcPsi: Number(edition["fcDefaultPsi"]),
          diameterMm: row.diameterMm,
          confined: false,
          top: false,
        });
        expect(ld.ok, `ℓd stands at the edition's own defaults — fy 420, f'c 3000 psi (riskNotes (3)): ${JSON.stringify(ld)}`).toBe(true);
        const classB = lookups.lapLengthOf(edition, { diameterMm: row.diameterMm, ldMm: Number(ld.mm), class: "B" });
        expect(Number(row.lapMm), `${row.barMark} laps at Class B — 1.3 ℓd, floored at 300 mm — where no note states a lap`).toBeCloseTo(classB, 3);
        expect(row.editionDigest, "and every bar row cites the edition it was derived under (L-MEA-01)").toBe(unread.setup.edition.digest);
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-7: a transcribed 50d lap moves the bar, the bill and the line — and mints no edition",
    async () => {
      const { stage, unread, editionsBefore } = await staged();
      const { measured, rows, lines, editionsAfter, bbs } = await transcribed();
      expect(measured.verdict.refused, `every offer published after the note (the gate refused ${JSON.stringify(measured.verdict.refusals)})`).toBe(0);

      // The same line, re-presented: one line per (object, kind) still, under the same keys.
      expect(lines.map((line) => line.key), "the campaign publishes the same line keys — a note re-presents a line, it does not open a new one (riskNotes (1))").toEqual(
        unread.lines.map((line) => line.key),
      );
      const moved = lines.filter((line, at) => line.semantic !== (unread.lines[at] as { semantic: string }).semantic);
      expect(moved.length, "and every one of them carries a new semantic — what the line says has changed (L-REG-04)").toBe(lines.length);

      for (const line of linesOf(stage)) {
        const bound = bindingsOf(line)["lap"];
        expect(String(bound?.basis), "the lap is now read off the drawing's own note (L-QTY-01: TRANSCRIBED outranks DERIVED)").toBe(TRANSCRIBED);
      }

      for (const row of mains(rows)) {
        expect(Number(row.lapMm), `${row.barMark} laps at 50 × ${row.diameterMm} mm — the note's multiplier, verbatim (AM-03(h))`).toBeCloseTo(50 * row.diameterMm, 3);
      }
      const before = mains(unread.rows);
      expect(mains(rows).map((row) => row.barKey).sort(), "the bill carries the same content-keyed bars (L-REG-04)").toEqual(before.map((row) => row.barKey).sort());
      expect(mains(rows).some((row) => Number(row.kgLap) !== Number((before.find((one) => one.barKey === row.barKey) as BarRowShape).kgLap)), "and their lap mass has moved").toBe(true);

      // The bill, read back through the one door inc-310 will consume (goal).
      const readBack = bbs.rows.filter((row) => row.role === "MAIN");
      expect(readBack.length, "`bbsOf` answers the campaign's bar rows — the door the BBS screen reads (goal)").toBe(mains(rows).length);
      for (const row of readBack) expect(Number(row.lapMm), `${row.barMark} carries the transcribed lap through the door too`).toBeCloseTo(50 * row.diameterMm, 3);

      expect(editionsAfter, "a general note re-versions what the campaign APPLIES and mints no rule-set edition (AM-03(h))").toEqual(editionsBefore);
    },
    BUDGET_MS,
  );

  test(
    "AC-7: a grade the edition holds no row for omits the lap by name, never scaled",
    async () => {
      const { stage, measured } = await unrowed();
      expect(measured.verdict.refused, `the gate refused nothing — an unread row is a disclosure, not a refusal (${JSON.stringify(measured.verdict.refusals)})`).toBe(0);
      const lines = linesOf(stage);
      expect(lines.length, "the campaign still publishes a line per column, with the part it could not derive left out (L-QTY-02)").toBe(stage.members.length);
      for (const line of lines) {
        expect(said(line, "coverage", "coverage"), "a line missing a declared component is PARTIAL_DECLARED, never quietly complete").toBe(PARTIAL_DECLARED);
        expect(
          omittedOf(line).filter((one) => one.variable === "lap").map((one) => one.code),
          `fy 550 MPa has no row in the applied edition, so the lap is omitted under ${DETAILING_ROW_NOT_IN_EDITION} rather than scaled from a row that does (AM-03(f))`,
        ).toEqual([DETAILING_ROW_NOT_IN_EDITION]);
        expect(bindingsOf(line)["lap"], "and no lap is bound at all").toBeUndefined();
        expect(bindingsOf(line)["net"], "while the net the schedule states still is — a column's bars were read (L-QTY-02)").toBeTruthy();
      }
    },
    BUDGET_MS,
  );
});
