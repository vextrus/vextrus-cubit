// @vitest-environment node
/**
 * GB-READ on F-RCC6-BNBC (s-schedules I-673, I-674): S-08 GRADE BEAM LAYOUT & GF SLAB ON
 * GRADE letters every grade-beam span Rev C draws (TIE-1), and S-09's long sections state each mark's
 * section. The marks now name the spans: each square span is placed as a tie beam in the FOUNDATION
 * slot, typed by its S-09 family, and its run is cut at the faces of the caps S-06 places at its ends
 * — the golden model's own clear, span by span, never over it (L-QTY-06).
 *
 * What S-08 still leaves unnamed is its four slanted spans (GB4 across the chamfer, GB5 to the ramp),
 * which wait for a run read along its own direction (FRM4-E).
 *
 * PURE, in the unit lane: the drawing read by the shipped `cad/` CLI and put through the stages.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isFoundationClass } from "@/core/catalogue/level-basis";
import type { Offer, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { memberFamiliesSetupOf, readingSetupOf } from "@/modules/takeoff/measure/setup";
import { tieBeamConcreteRail, tieBeamFormworkRail } from "@/modules/takeoff/rails/frame/index";
import { goldenCellRows } from "../../../golden/support/golden-fixture";
import { BNBC_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** S-08's grade-beam layout, and S-06's pile-cap layout — by the address a placement names each by. */
const GRADE_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:2073";
const PILE_CAPS = "v:LAYOUT_PLAN:DXF_HANDLE:202C";
/** S-01's general note: "ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES" (I-302). */
const DECLARATION = "DXF_HANDLE:1F3E";

/** One grade beam of the golden's model (`fixtures/rcc6-bnbc/model.json`), as the model authors it. */
type ModelBeam = { readonly id: string; readonly mark: string; readonly p0: readonly [string, string]; readonly p1: readonly [string, string]; readonly clear: string; readonly b: string; readonly depth: string };

const MODEL: readonly ModelBeam[] = (JSON.parse(readFileSync(join(process.cwd(), "fixtures/rcc6-bnbc/model.json"), "utf8")) as { members: (ModelBeam & { class: string })[] }).members.filter(
  (member) => member.class === "TIE_BEAM",
);
const square = (beam: ModelBeam): boolean => beam.p0[0] === beam.p1[0] || beam.p0[1] === beam.p1[1];

let bnbcRead: Promise<StagesRead> | undefined;
/** The drawing is read ONCE for the whole suite — lazily, so a refusal fails the case that needed it. */
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));

/**
 * Every placement, run and unnamed pair of every OTHER plan, as the stages read them at 2ee453e4 —
 * before a grade-beam mark named a class and before a tie beam's end could be carried by another
 * plan's cap (302 placements, 157 runs, the beam layouts' 11 slanted pairs).
 */
const OTHERS_BEFORE = "e10ac92c2f96f649cff34581d2b74b5277d792d5b390ae40100c831b4aa01dc6";
const sha = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * The tie-beam rails over what the stages read of S-08 — mechanics only, as `support/cap-rail.ts`
 * runs the cap rails: the placements, runs and families carried into the setup through the measure
 * setup's OWN mappings (`readingSetupOf`, `memberFamiliesSetupOf`), one MEASURED register row per
 * placed span in the FOUNDATION slot (no level), and one affirmed calibration for the view.
 */
function tieBeamOffersOver(read: StagesRead, rail: typeof tieBeamConcreteRail, kind: string): Offer[] {
  const INGEST = "gb-ingest";
  const beams = read.placed.placements.filter((row) => row.viewKey === GRADE_BEAMS);
  const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
  const setup = {
    placements: Object.fromEntries(
      beams.map((row) => [
        row.placementKey,
        { drawingId: "gb-drawing", ingestId: INGEST, viewKey: row.viewKey, memberFamily: row.memberFamily, engine: "VECTOR", sourceEntity: row.placementKey, outline: null, noteShape: null, noteKey: null },
      ]),
    ),
    memberTypes: { [INGEST]: memberFamiliesSetupOf(read.registered.families) },
    levels: [],
    calibrations: { [INGEST]: { [GRADE_BEAMS]: "gb-calibration" } },
    grades: {},
    plans: {},
    runs: Object.fromEntries(
      beams.flatMap((row) => {
        const run = runs.get(row.placementKey);
        return run === undefined ? [] : [[row.placementKey, { clear: readingSetupOf(run.clear), sides: [readingSetupOf(run.sides[0]), readingSetupOf(run.sides[1])] }]];
      }),
    ),
    lintels: {},
    walls: {},
    surfaces: {},
    siteFacts: {},
    edition: { digest: "0".repeat(64), parameters: SEED_EDITION_CONTENT.parameters },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: false, sourceKeys: [] },
  } as unknown as RailSetup;
  const objects = beams.map(
    (row) => ({ objectKey: `object|${row.placementKey}`, placementKey: row.placementKey, elementType: row.elementType, levelId: null, levelLabel: null, standing: "MEASURED", setRevisionId: "gb-revision" }) as unknown as RegisterObjectRow,
  );
  const batch = rail({ campaignId: "gb-campaign", setRevisionId: "gb-revision", kind, objects, setup } as Parameters<typeof rail>[0]);
  expect(batch.observations, "no span is refused: each has its section, its run and its view's scale").toEqual([]);
  return [...batch.offers];
}

/** A binding's value in metres, from the millimetres S-01 declares. */
const metres = (offer: Offer, variable: string): number => {
  const bound = offer.bindings[variable];
  if (bound?.unit !== "mm") throw new Error(`${variable} is read in millimetres, not ${String(bound?.unit)}`);
  return Number(bound.value) / 1000;
};

/** The golden's figure for one TIE_BEAM cell at FDN, summed over its components. */
const goldenOf = (kind: string): number => goldenCellRows("rcc6-bnbc", { class: "TIE_BEAM", kind, level: "FDN" }).reduce((sum, row) => sum + Number(row.quantity), 0);

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** Where S-08 stands grid 1 and grid A, so a model point is found on the plan it is drawn on. */
function originOf(read: StagesRead): readonly [number, number] {
  const axes = (read.evidence.grid?.axes ?? []).filter((axis) => axis.viewKey === "LAYOUT_PLAN:DXF_HANDLE:2073");
  const one = axes.find((axis) => axis.label === "1");
  const a = axes.find((axis) => axis.label === "A");
  if (one === undefined || a === undefined) throw new Error("S-08 is georeferenced on grids 1 and A");
  return [one.position, a.position];
}

describe("GB-READ: S-08's grade-beam marks name the grade beams they are lettered on", () => {
  test("S-09's five long sections register GB1–GB5 at the model's sections", async () => {
    const read = await bnbc();
    const sections = Object.fromEntries(
      read.registered.families.filter((family) => /^GB\d$/.test(family.family)).map((family) => [family.family, family.variants.map((variant) => `${String(variant.sectionWidth)}x${String(variant.sectionDepth)} ${variant.sectionUnit ?? ""}`)]),
    );
    const modelled = Object.fromEntries(MODEL.map((beam) => [beam.mark, [`${beam.b}x${beam.depth} mm`]]));
    expect(sections).toEqual(modelled);
  }, BUDGET_MS);

  test("every square span is placed as a tie beam of its mark, in the FOUNDATION slot's class, typed by its family", async () => {
    const read = await bnbc();
    const placed = read.placed.placements.filter((row) => row.viewKey === GRADE_BEAMS);
    // Red before: none — `GB` named no class, and all 47 were drawn and disclosed as unnamed.
    expect(placed.length, "the model's 43 square spans (47 less the four slanted)").toBe(MODEL.filter(square).length);
    expect(placed.every((row) => row.elementType === "tie_beam" && isFoundationClass(row.elementType)), "each a tie beam, standing under the building").toBe(true);
    expect(placed.every((row) => row.memberFamily === row.mark), "each typed by its own S-09 family").toBe(true);
    const byMark = (rows: readonly { mark: string }[]): Record<string, number> => rows.reduce<Record<string, number>>((tally, row) => ({ ...tally, [row.mark]: (tally[row.mark] ?? 0) + 1 }), {});
    expect(byMark(placed), "GB1 16, GB2 12, GB3 13, and GB4's two square spans").toEqual(byMark(MODEL.filter(square)));
  }, BUDGET_MS);

  test("each run is the model's own clear between the cap faces — never over — and cites the caps S-06 places", async () => {
    const read = await bnbc();
    const [x0, y0] = originOf(read);
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    const caps = new Set(read.placed.placements.filter((row) => row.viewKey === PILE_CAPS && row.elementType === "pile_cap").map((row) => row.outlineKey));
    const read43 = read.placed.placements
      .filter((row) => row.viewKey === GRADE_BEAMS)
      .map((row) => {
        const model = MODEL.find((beam) => Math.abs((Number(beam.p0[0]) + Number(beam.p1[0])) / 2 + x0 - row.x) < 0.1 && Math.abs((Number(beam.p0[1]) + Number(beam.p1[1])) / 2 + y0 - row.y) < 0.1);
        const clear = runs.get(row.placementKey)?.clear;
        return { id: model?.id ?? `unmatched ${row.placementKey}`, mark: row.mark, clear: clear?.value ?? null, model: model === undefined ? null : Number(model.clear).toFixed(1), cited: clear?.sourceKeys ?? [] };
      })
      .sort((left, right) => (left.id < right.id ? -1 : 1));
    // Red before I-674: GB1-1 read 4222.0, cut at the columns a storey up (+67 %); PC5's far
    // side (GB2-7, GB2-11, GB3-8, GB3-9) ran on to the next face it met.
    expect(read43.map((one) => `${one.id} ${String(one.clear)}`)).toEqual(read43.map((one) => `${one.id} ${String(one.model)}`));
    for (const one of read43) {
      const ends = one.cited.slice(2).filter((key) => key !== DECLARATION);
      // GB4-1 and GB4-4 end at the chamfer's joint on the slanted GB4 spans, which carry nothing.
      expect(ends.length, `${one.id} is cut at its caps`).toBe(one.mark === "GB4" ? 1 : 2);
      expect(ends.every((key) => caps.has(key)), `${one.id} cites only the outlines of caps S-06 places: ${ends.join(" ")}`).toBe(true);
    }
  }, BUDGET_MS);

  test("what S-08 still draws and nobody names is its four slanted spans, each once", async () => {
    const read = await bnbc();
    const left = (read.placed.unnamed ?? []).filter((pair) => pair.viewKey === GRADE_BEAMS);
    expect(left.length).toBe(MODEL.filter((beam) => !square(beam)).length);
    expect(left.every((pair) => pair.from[0] !== pair.to[0] && pair.from[1] !== pair.to[1]), "every one slanted").toBe(true);
    expect(new Set(left.map((pair) => pair.edgeKeys.join(" "))).size, "and none twice").toBe(left.length);
  }, BUDGET_MS);

  test("every other plan's placements, runs and unnamed pairs read exactly as they did", async () => {
    const read = await bnbc();
    const graded = new Set(read.placed.placements.filter((row) => row.viewKey === GRADE_BEAMS).map((row) => row.placementKey));
    const placements = read.placed.placements.filter((row) => !graded.has(row.placementKey));
    const runs = (read.placed.runs ?? []).filter((run) => !graded.has(run.placementKey));
    const unnamed = (read.placed.unnamed ?? []).filter((pair) => pair.viewKey !== GRADE_BEAMS);
    expect([placements.length, runs.length, unnamed.length]).toEqual([302, 157, 11]);
    expect(sha({ placements, runs, unnamed }), "the columns, piles, caps, F1 and the four beam layouts' beams, key for key and run for run").toBe(OTHERS_BEFORE);
  }, BUDGET_MS);

  test("the tie-beam rails offer every span COMPLETE, and what they bind stands under the golden's TIE_BEAM cells, never over", async () => {
    const read = await bnbc();
    const concrete = tieBeamOffersOver(read, tieBeamConcreteRail, "rcc.concrete");
    const formwork = tieBeamOffersOver(read, tieBeamFormworkRail, "rcc.formwork");
    expect([concrete.length, formwork.length], "one concrete and one formwork offer a span").toEqual([43, 43]);
    expect([...concrete, ...formwork].every((offer) => offer.coverage === "COMPLETE" && offer.omitted.length === 0), "each COMPLETE: a tie beam adjoins no slab").toBe(true);
    // The methods' own algebra over the bindings (L-MEA-09, L-FRM-03): b · D · clear, and (2·D + b) · clear.
    const volume = concrete.reduce((sum, offer) => sum + metres(offer, "b") * metres(offer, "D") * metres(offer, "clear"), 0);
    const area = formwork.reduce((sum, offer) => sum + (2 * metres(offer, "D") + metres(offer, "b")) * metres(offer, "clear"), 0);
    // The model's 43 square spans: 13.749 m³ and 129.138 m². The golden's 47: 14.619 m³, and 107.929 + 28.637 m².
    expect(volume.toFixed(3)).toBe("13.749");
    expect(area.toFixed(3)).toBe("129.138");
    expect(volume, "concrete never over the golden's cell").toBeLessThanOrEqual(goldenOf("RCC_CONCRETE"));
    expect(area, "formwork never over the golden's sides and soffit").toBeLessThanOrEqual(goldenOf("FORMWORK"));
  }, BUDGET_MS);
});
