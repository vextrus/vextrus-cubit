/**
 * AC-7 — the notes door governs the campaign: what a drawing says about detailing re-presents the
 * rebar lines, and mints no rule-set edition (AM-03(h), inc-303's door, L-MEA-06, L-QTY-02).
 *
 * The campaign is real: a workspace, a project pinned to an edition citing the five rebar pairs, a
 * general-notes sheet ingested by the shipped pipeline and held by the pinned revision, a level with
 * an authored storey height, two registered columns, and the campaign measured by `runMeasureJob`
 * with the shipped roster and the real gate.
 *
 * Four states are driven, in order: one campaign with nothing transcribed and then the same campaign
 * with a LAP of 50d and an fy of 500 MPa read off the sheet; a second campaign that reads the same
 * two notes BEFORE it measures, so the note reaches the published line itself; and a third whose
 * only note is an fy of 550 MPa the edition holds no row for. What is graded is that the SETUP's
 * detailing is the door's answer and nothing else, that the note moves the offer, the bar and the
 * bill without minting an edition, and that a grade with no row defers by name rather than scaled.
 *
 * WHERE THE NOTE LANDS, AND WHERE IT DOES NOT. AM-03(h) has the note override the applied value
 * "within the campaign" and "re-present the lines"; L-REG-04 says what re-presenting is mechanically
 * — "the semantic invalidates; it never keys" — and hangs the semantic on the DERIVED ROW, which for
 * this criterion is `bar_rows`, keyed (member, role, diameter, sequence), a key no lap enters. The
 * published line is a different animal: it stands under `quantity_lines_one_per_object_kind` and the
 * app role holds no UPDATE and no DELETE on it, so a re-offer over a line already standing is
 * refused `OFFER_NOT_TO_CONTRACT` — the residue AM-03(h) leaves to whoever owns the lines store.
 * That state is asserted AS state here (read off the catalogue's grants, not off an absence), and
 * the note's own force on a line is graded on a campaign that reads it before it measures.
 */
import { afterAll, describe, expect, test } from "vitest";
import { editionCounts, type EditionCounts } from "../../notes/support/notes-stage";
import {
  DERIVED,
  DETAILING_ROW_NOT_IN_EDITION,
  MEASURE_SETUP_MODULE,
  OFFER_NOT_TO_CONTRACT,
  PARTIAL_DECLARED,
  QUANTITY_LINES_TABLE,
  RCC_REBAR,
  REBAR_TIE_ZONE_UNSTATED,
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
  privilegesOf,
  railSetupOf,
  railSetupWatchingTheDoor,
  said,
  stageRebarCampaign,
  transcribeNotes,
  type BarRowShape,
  type DetailingSetupShape,
  type DoorCall,
  type MeasuredCampaign,
  type OfferShape,
  type RebarStage,
  type StagedRebarMember,
  type StoreRow,
} from "./support/rebar-stage";

const BUDGET_MS = 1_800_000;

/** The level the staged columns stand on, and the storey run authored for it. */
const LEVEL = { label: "GF", heightMm: "3352.8" };

/** The main-bar group every staged column's schedule states, and the tie zone beside it. */
const MAINS = { n: 8, diameterMm: 16 };
const TIES = { diameterMm: 10, spacingMm: 100 };

/** The lap the sheet's general note states, in bar diameters (AM-03(h): "a 50d general note"). */
const LAP_MULTIPLIER = 50;

/** The grade that note states — the row the applied edition does hold (AM-03(f)). */
const NOTED_FY_MPA = 500;

/** Two columns of one mark: 400 × 400, eight 16 mm mains, 10 mm ties at 100 c/c. */
function columns(): StagedRebarMember[] {
  return [1, 2].map((at) => ({
    id: `COL:A${at}@GF`,
    class: "column",
    mark: "C1",
    level: LEVEL.label,
    section: { b: 400, d: 400 },
    mains: { ...MAINS },
    ties: { ...TIES },
  }));
}

/** The kinds this criterion reads off the fixture's own general notes (inc-303's five). */
const FY = "FY";
const LAP = "LAP";

/** The two readings a campaign measured under the note is staged with. */
const NOTED_READINGS = [
  { kind: LAP, valueAsWritten: String(LAP_MULTIPLIER), unitAsWritten: "d" },
  { kind: FY, valueAsWritten: String(NOTED_FY_MPA), unitAsWritten: "MPa" },
];

/** One published line, as this criterion compares one across two runs of the job. */
type LineRead = { key: string; value: string };

type Ground = {
  stage: RebarStage;
  unread: { setup: Awaited<ReturnType<typeof railSetupOf>>; measured: MeasuredCampaign; rows: BarRowShape[]; lines: LineRead[] };
  editionsBefore: EditionCounts;
};

let ground: Promise<Ground> | undefined;
let after: Promise<{ measured: MeasuredCampaign; rows: BarRowShape[]; lines: LineRead[]; editionsAfter: EditionCounts; bbs: Awaited<ReturnType<typeof bbsThroughDoor>> }> | undefined;
let beforehand: Promise<{ stage: RebarStage; measured: MeasuredCampaign }> | undefined;
let contested: Promise<{ stage: RebarStage; measured: MeasuredCampaign }> | undefined;

/** The published lines of a campaign, by the key the gate holds one under and the figure it carries. */
function linesRead(stage: RebarStage): LineRead[] {
  return linesOf(stage)
    .map((row) => ({ key: `${said(row, "objectKey", "object_key")}|${said(row, "kind", "kind")}`, value: said(row, "value", "value") }))
    .sort((left, right) => (left.key < right.key ? -1 : 1));
}

/** The one `rcc.rebar` line a campaign published for the member it staged at this index. */
function lineForMember(stage: RebarStage, at: number): StoreRow {
  const objectKey = String((stage.objects[at] as Record<string, unknown>)["objectKey"]);
  const held = linesOf(stage).filter((row) => said(row, "objectKey", "object_key") === objectKey);
  expect(held.length, `the campaign published exactly one ${RCC_REBAR} line for ${objectKey} (riskNotes (1))`).toBe(1);
  return held[0] as StoreRow;
}

/**
 * What a column's laps bill at once a 50d note has been read, off the edition's own kg/m table.
 *
 * Derived, not typed in: the note's multiplier × the diameter the schedule states is the lap's
 * length verbatim (AM-03(h), riskNotes (3)), each of the eight mains laps once at the floor joint,
 * and "the table bills" (AM-03(b)) — 8 × 0.800 m × 1.579 kg/m. The figure the arithmetic lands is
 * pinned below, so a table that moved would be caught here rather than quietly re-grading the case.
 */
async function notedLapKgPerColumn(): Promise<number> {
  const edition = await detailingEdition();
  const lookups = await detailingLookups();
  const perMetre = Number(lookups.kgPerMetreOf(edition, MAINS.diameterMm));
  const kg = MAINS.n * ((LAP_MULTIPLIER * MAINS.diameterMm) / 1000) * perMetre;
  expect(kg, `${MAINS.n} mains × ${LAP_MULTIPLIER} × ${MAINS.diameterMm} mm × ${perMetre} kg/m = 10.1056 kg of lap a column (AM-03(a)/(b))`).toBeCloseTo(10.1056, 6);
  return kg;
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
    await transcribeNotes(stage, NOTED_READINGS);
    const measured = await measure(stage);
    const rows = await barRowsOf(measured.input);
    return { measured, rows, lines: linesRead(stage), editionsAfter: editionCounts(stage.tenantId), bbs: await bbsThroughDoor(stage) };
  })());

/** The same two columns on a campaign that reads the SAME two notes before it measures at all. */
const noted = (): Promise<{ stage: RebarStage; measured: MeasuredCampaign }> =>
  (beforehand ??= (async () => {
    const stage = await stageRebarCampaign("lap50", columns(), { levels: [LEVEL], detailing: "door" });
    await transcribeNotes(stage, NOTED_READINGS);
    return { stage, measured: await measure(stage) };
  })());

/** A further campaign, whose only note is a grade the applied edition holds no row for. */
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
      const lapKg = await notedLapKgPerColumn();

      // (i) THE OVERRIDE, on the rail's own surface: what the campaign now applies is what the note
      // says, member for member — the lap transcribed at 50 × d beside a net still derived from the
      // schedule's own bar group, the grade the sheet was read at selecting the line, and the ties
      // still owed to a typical detail nobody has read (AM-03(h), L-QTY-01, L-QTY-02).
      const offers = measured.offers.map((one) => one as unknown as OfferShape);
      expect(offers.length, `the rail offered one ${RCC_REBAR} line per column under the note (L-MEA-08)`).toBe(stage.members.length);
      for (const offer of offers) {
        const lap = offer.bindings["lap"];
        expect(String(lap?.basis), "the lap is read off the drawing's own note (L-QTY-01: TRANSCRIBED outranks DERIVED)").toBe(TRANSCRIBED);
        expect(Number(lap?.value), `and it bills at ${lapKg} kg — ${LAP_MULTIPLIER} × ${MAINS.diameterMm} mm of lap on each of ${MAINS.n} mains, off the kg/m table (AM-03(b))`).toBeCloseTo(lapKg, 6);
        expect(String(offer.bindings["net"]?.basis), "beside a net still derived from the schedule's bar group — a note about laps moves the lap (AM-03(a))").toBe(DERIVED);
        const fy = offer.selectors["fy"];
        expect({ value: Number(fy?.value), unit: String(fy?.unit), basis: String(fy?.basis) }, "the line is selected by the grade the sheet was read at (AM-03(h))").toEqual({
          value: NOTED_FY_MPA,
          unit: "MPa",
          basis: TRANSCRIBED,
        });
        expect(offer.bindings["ties"], "the confinement steel is still not bound — its zone length is a typical detail nobody has read (scope)").toBeUndefined();
        expect(
          offer.omitted.filter((one) => one.variable === "ties").map((one) => one.code),
          `so \`ties\` stays omitted under ${REBAR_TIE_ZONE_UNSTATED} (L-QTY-02)`,
        ).toEqual([REBAR_TIE_ZONE_UNSTATED]);
        expect(offer.coverage, "and the offer is PARTIAL_DECLARED, never quietly complete (L-QTY-02)").toBe(PARTIAL_DECLARED);
      }

      // (ii) THE LINE, as the landed lines store leaves it. The line is keyed one per (object, kind)
      // and the app role holds no UPDATE and no DELETE on it, so a re-offer over a line already
      // standing cannot re-present it — it is refused. That is read here as STATE: the grants are
      // asked for, and the branch the store is actually in is the branch that is graded. The day the
      // increment that owns the lines store grants the rewrite AM-03(h) asks for, this flips to the
      // published reading with nothing weakened.
      expect(lines.map((line) => line.key), "the campaign holds the same line keys — a note re-presents a line, it never opens a second one (riskNotes (1))").toEqual(
        unread.lines.map((line) => line.key),
      );
      const grants = privilegesOf(QUANTITY_LINES_TABLE);
      expect(grants.length, `the catalogue reports what \`cubit_app\` holds on ${QUANTITY_LINES_TABLE}`).toBeGreaterThan(0);
      const standing = stage.members.map((_, at) => said(lineForMember(stage, at), "objectKey", "object_key"));
      if (grants.includes("UPDATE") || grants.includes("DELETE")) {
        expect(measured.verdict.refused, `the lines store admits a rewrite (${JSON.stringify(grants)}), so the re-offer publishes: ${JSON.stringify(measured.verdict.refusals)}`).toBe(0);
        for (const [at] of stage.members.entries()) {
          const bound = bindingsOf(lineForMember(stage, at))["lap"];
          expect(String(bound?.basis), "and the re-presented line carries the note's own lap (AM-03(h))").toBe(TRANSCRIBED);
          expect(Number(bound?.value), "at the transcribed 50 × d mass").toBeCloseTo(lapKg, 6);
        }
      } else {
        expect(
          [...measured.verdict.refusals].map((one) => `${one.objectKey}|${one.code}`).sort(),
          `\`cubit_app\` holds ${JSON.stringify(grants)} on ${QUANTITY_LINES_TABLE} — no UPDATE and no DELETE — so a second offer over a line already standing under \`quantity_lines_one_per_object_kind\` is refused ${OFFER_NOT_TO_CONTRACT}, the residue AM-03(h) leaves to whoever owns the lines store`,
        ).toEqual(standing.map((objectKey) => `${objectKey}|${OFFER_NOT_TO_CONTRACT}`).sort());
        expect(lines, "and the standing lines are untouched — a line is a record (L-QTY-03)").toEqual(unread.lines);
        for (const [at] of stage.members.entries()) {
          expect(String(bindingsOf(lineForMember(stage, at))["lap"]?.basis), "the line the campaign already published still carries the lap it was published with").toBe(DERIVED);
        }
      }

      // (iii) THE DERIVED ROWS, which is where L-REG-04 hangs the semantic: the bar key is member +
      // role + diameter + sequence, a key no lap enters, so the note moves every semantic and not one
      // key. "The semantic invalidates; it never keys."
      const before = mains(unread.rows);
      const after = mains(rows);
      expect(after.map((row) => row.barKey).sort(), "the bill carries the same content-keyed bars (L-REG-04)").toEqual(before.map((row) => row.barKey).sort());
      const semanticBefore = new Map(before.map((row) => [row.barKey, row.semantic]));
      for (const row of after) {
        expect(typeof row.semantic === "string" && row.semantic.length > 0, `${row.barMark} carries an order-normalised semantic of its own content (L-REG-04): ${JSON.stringify(row.semantic)}`).toBe(true);
        expect(row.semantic, `${row.barMark} re-presents for disposition — its content moved under the note (L-REG-04)`).not.toBe(semanticBefore.get(row.barKey));
        expect(Number(row.lapMm), `${row.barMark} laps at ${LAP_MULTIPLIER} × ${row.diameterMm} mm — the note's multiplier, verbatim (AM-03(h))`).toBeCloseTo(LAP_MULTIPLIER * row.diameterMm, 3);
      }
      expect(after.some((row) => Number(row.kgLap) !== Number((before.find((one) => one.barKey === row.barKey) as BarRowShape).kgLap)), "and their lap mass has moved").toBe(true);
      for (const objectKey of new Set(after.map((row) => row.objectKey))) {
        const kgLap = after.filter((row) => row.objectKey === objectKey).reduce((running, row) => running + Number(row.kgLap), 0);
        expect(kgLap, `${objectKey}'s mains carry ${lapKg} kg of lap between them — the same figure the line's \`lap\` is taken from (L-QTY-03)`).toBeCloseTo(lapKg, 6);
      }

      // The bill, read back through the one door inc-310 will consume (goal).
      const readBack = bbs.rows.filter((row) => row.role === "MAIN");
      expect(readBack.length, "`bbsOf` answers the campaign's bar rows — the door the BBS screen reads (goal)").toBe(after.length);
      for (const row of readBack) expect(Number(row.lapMm), `${row.barMark} carries the transcribed lap through the door too`).toBeCloseTo(LAP_MULTIPLIER * row.diameterMm, 3);
      expect(
        readBack.map((row) => row.semantic).sort(),
        "and the door answers the rewritten rows themselves — `bar_rows` was rewritten for the campaign (AC-7)",
      ).toEqual(after.map((row) => row.semantic).sort());

      expect(editionsAfter, "a general note re-versions what the campaign APPLIES and mints no rule-set edition (AM-03(h))").toEqual(editionsBefore);
    },
    BUDGET_MS,
  );

  test(
    "AC-7: a campaign that reads the note before it measures publishes the lap TRANSCRIBED at 50 × d",
    async () => {
      const { stage: unreadStage, unread } = await staged();
      const { stage, measured } = await noted();
      const lapKg = await notedLapKgPerColumn();
      expect(measured.verdict.refused, `every offer published (the gate refused ${JSON.stringify(measured.verdict.refusals)})`).toBe(0);
      expect(linesOf(stage).length, "one rebar line per column, as ever (riskNotes (1))").toBe(stage.members.length);

      // The two campaigns are the same two columns over the same sheet, and differ in one thing: the
      // 50d note this one had read before the job ran. Column for column, that is the whole distance
      // between a lap the edition's Class B clause derived and a lap the drawing states (AM-03(h)).
      for (const [at, member] of stage.members.entries()) {
        const bound = bindingsOf(lineForMember(stage, at))["lap"];
        expect(String(bound?.basis), `${member.id}'s lap is the drawing's own note (L-QTY-01: TRANSCRIBED outranks DERIVED)`).toBe(TRANSCRIBED);
        expect(Number(bound?.value), `and bills at ${lapKg} kg — ${LAP_MULTIPLIER} × ${MAINS.diameterMm} mm on each of ${MAINS.n} mains (AM-03(b))`).toBeCloseTo(lapKg, 6);
        expect(String(bindingsOf(lineForMember(stage, at))["net"]?.basis), "beside the net the schedule's bar group derived (AM-03(a))").toBe(DERIVED);

        const derived = bindingsOf(lineForMember(unreadStage, at))["lap"];
        expect(String(derived?.basis), `where the unread campaign's line for the same member bound its lap from the edition's Class B clause (riskNotes (3))`).toBe(DERIVED);
        expect(Math.abs(Number(derived?.value) - lapKg) > 0.001, `and at a different mass — 1.3 ℓd is not ${LAP_MULTIPLIER} × d: it bound ${String(derived?.value)} kg`).toBe(true);
      }
      expect(unread.lines.length, "and the unread campaign it is compared against really published its lines").toBe(unreadStage.members.length);
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
