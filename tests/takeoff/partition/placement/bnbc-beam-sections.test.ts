// @vitest-environment node
/**
 * FRM-2's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01) and put through the partition's pure stages exactly as the rebuild runs them (R-TO-030).
 * No database, no store, no model.
 *
 * What the drawing states, and what is graded here:
 *   · I-343 — S-17 details the typical floors' 53 beams as strips, each labelled with its mark and, on
 *     the same baseline, its section (`B1` · `300x600`), under the sheet's title `TYPICAL FLOOR BEAM
 *     LONG SECTIONS (2ND TO 6TH FLOOR)`; S-16 does the same for the first floor's 53 (`1B1` · `300x600`,
 *     `1ST FLOOR BEAM LONG SECTIONS - …`). Each label is a member type, banded by its sheet, in the
 *     millimetres S-01 declares. T-SCHED-CONTD: `B9 … CONTD. ON S-18` is one member, counted once.
 *   · I-344 — S-13, S-14 and S-15 draw their beams as edge-line pairs 250, 300 and 400 apart, wider than
 *     the edition's pairing band (195.1). A pair is admitted where its gap IS the width its naming
 *     mark's schedule states, named by the label it stands nearest; a mark standing ON a pair names no
 *     other one; a slanted pair waits for its own run. What that places is graded against the golden
 *     model's own roster, member for member: the right mark, where the model puts it.
 *   · No beam line can be COMPLETE: no beam layout states a slab thickness, and a run binds `t` only
 *     where both of its sides read one (SLAB_THICKNESS_UNSTATED) — every line stands PARTIAL_DECLARED.
 *
 * AND WHAT MAY NOT MOVE — F-RCC6's whole stage output (`a3c0c6e0…`), BNBC's tables, the families its
 * schedules registered, and its piles, columns and caps: pinned in
 * tests/takeoff/partition/schedules/bnbc-pile-schedule.test.ts (TEST_AMENDED there to set the strips'
 * families and the beams aside) and bnbc-pile-caps.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { PlacementRow, RunRow } from "@/modules/takeoff/partition/placement/rows";
import { BNBC_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** The two long-section sheets, by the view each is keyed under (S-17, S-16). */
const TYPICAL_STRIPS = "DXF_HANDLE:218E";
const FIRST_FLOOR_STRIPS = "DXF_HANDLE:2173";
/** The titles each sheet states its floors in. */
const TYPICAL_TITLE = "DXF_HANDLE:1718";
const FIRST_FLOOR_TITLE = "DXF_HANDLE:13F7";
/** S-01's general note: "ALL DIMENSIONS ARE IN MILLIMETRES …" (I-302). */
const DECLARATION = "DXF_HANDLE:1F3E";

/** The three beam layouts, the level each is drawn for, and the golden model's level of it. */
const LAYOUTS = Object.freeze([
  { view: "F31", level: "2F", placed: 25 },
  { view: "2116", level: "1F", placed: 23 },
  { view: "10C1", level: "ROOF", placed: 24 },
] as const);

/** The marks each strip sheet labels — the golden model's typical-floor and first-floor rosters. */
const numbered = (prefix: string, count: number): string[] => Array.from({ length: count }, (_unused, at) => `${prefix}${at + 1}`);
const TYPICAL_MARKS = [...numbered("B", 46), ...numbered("CB", 4), "EB1", "EB2", "LB1"];
const FIRST_FLOOR_MARKS = [...numbered("1B", 44), ...numbered("1CB", 4), "1EB1", "1EB2", "PB4", "PB5", "TG1"];

/** One member of the golden model (`fixtures/rcc6-bnbc/model.json`, the generator's own, AM-01). */
type ModelMember = { readonly id: string; readonly class: string; readonly mark: string; readonly level: string; readonly p0: readonly string[]; readonly p1: readonly string[] };
const MODEL = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "rcc6-bnbc", "model.json"), "utf8")) as { members: ModelMember[] };

let bnbcRead: Promise<StagesRead> | undefined;
/** The drawing is read ONCE for the whole suite — lazily, so a refusal fails the case that needed it. */
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** The beams one layout placed. */
const beamsOn = (read: StagesRead, view: string): PlacementRow[] => read.placed.placements.filter((row) => row.viewKey === `v:LAYOUT_PLAN:DXF_HANDLE:${view}` && row.elementType === "beam");

/**
 * Where a placed member stands against the golden model's frame: the model sets out every member from
 * grid A1, x along the numerals and y along the letters, so a placement is read back off the SAME
 * view's own A and 1 axes, whichever way each stands (I-340).
 */
function modelFrameOf(read: StagesRead, view: string): (row: PlacementRow) => readonly [number, number] {
  const axes = (read.evidence.grid?.axes ?? []).filter((axis) => axis.viewKey === `LAYOUT_PLAN:DXF_HANDLE:${view}`);
  const origin = (direction: "x" | "y"): number => {
    const axis = axes.find((one) => one.axis === direction && ((one.family === "letter" && one.label === "A") || (one.family === "numeral" && one.label === "1")));
    if (axis === undefined) throw new Error(`${view} states no A or 1 axis standing across ${direction}`);
    return axis.position;
  };
  const [x, y] = [origin("x"), origin("y")];
  return (row) => [row.x - x, row.y - y];
}

/** The model member of one mark on one level whose midpoint the placement stands on, to the millimetre. */
function modelMemberAt(level: string, mark: string, at: readonly [number, number]): ModelMember | undefined {
  return MODEL.members.find((member) => {
    if (member.class !== "BEAM" || member.level !== level || member.mark !== mark) return false;
    const mid = [(Number(member.p0[0]) + Number(member.p1[0])) / 2, (Number(member.p0[1]) + Number(member.p1[1])) / 2];
    return Math.hypot((mid[0] as number) - at[0], (mid[1] as number) - at[1]) <= 1;
  });
}

describe("I-343: the long-section sheets state their beams' sections", () => {
  test("S-17 registers its 53 typical beams, S-16 the first floor's 53 — one family per strip label, each once", async () => {
    const { registered } = await bnbc();
    const of = (sheet: string): string[] => registered.families.filter((family) => family.scheduleKey === sheet).map((family) => family.family);
    expect(new Set(of(TYPICAL_STRIPS)), "S-17's labels, every one").toEqual(new Set(TYPICAL_MARKS));
    expect(of(TYPICAL_STRIPS).length, "and none twice").toBe(TYPICAL_MARKS.length);
    expect(new Set(of(FIRST_FLOOR_STRIPS)), "S-16's labels, every one").toEqual(new Set(FIRST_FLOOR_MARKS));
    expect(of(FIRST_FLOOR_STRIPS).length, "and none twice").toBe(FIRST_FLOOR_MARKS.length);
    expect(registered.families.filter((family) => family.family === "B9").length, "T-SCHED-CONTD: B9 continues on S-18 and is one member type").toBe(1);
  }, BUDGET_MS);

  test("each strip's one variant is its label's section, over the floors its sheet's title states, cited to the label, the title and S-01", async () => {
    const { registered } = await bnbc();
    const variantOf = (sheet: string, family: string) => registered.families.find((one) => one.scheduleKey === sheet && one.family === family)?.variants;
    expect(variantOf(TYPICAL_STRIPS, "B1"), "S-17's B1").toEqual([
      {
        variantKey: "2ND-6TH",
        bandText: "TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)",
        bandFrom: "2ND",
        bandTo: "6TH",
        sectionText: "300x600",
        sectionWidth: 300,
        sectionDepth: 600,
        sectionUnit: "mm",
        sourceKeys: ["DXF_HANDLE:1406", TYPICAL_TITLE, DECLARATION],
        zones: [],
      },
    ]);
    const sections = (sheet: string, marks: readonly string[]) => marks.map((mark) => variantOf(sheet, mark)?.map((variant) => [variant.sectionWidth, variant.sectionDepth, variant.bandFrom, variant.bandTo]));
    expect(sections(TYPICAL_STRIPS, ["B6", "CB1", "EB1", "EB2", "LB1"]), "a tee beam, a cantilever, the two edge beams and the landing beam, as S-17 labels them").toEqual([
      [[250, 450, "2ND", "6TH"]],
      [[250, 450, "2ND", "6TH"]],
      [[250, 300, "2ND", "6TH"]],
      [[250, 450, "2ND", "6TH"]],
      [[250, 375, "2ND", "6TH"]],
    ]);
    expect(sections(FIRST_FLOOR_STRIPS, ["1B1", "TG1", "PB4", "1EB1"]), "the first floor's, over the first floor alone").toEqual([
      [[300, 600, "1ST", "1ST"]],
      [[400, 900, "1ST", "1ST"]],
      [[300, 600, "1ST", "1ST"]],
      [[250, 300, "1ST", "1ST"]],
    ]);
    expect(variantOf(FIRST_FLOOR_STRIPS, "TG1")?.[0]?.sourceKeys, "cited to its own label, S-16's title and S-01").toEqual(["DXF_HANDLE:10E5", FIRST_FLOOR_TITLE, DECLARATION]);
  }, BUDGET_MS);
});

describe("I-344: a pair wider than the band is a member where its gap is its mark's stated width", () => {
  test.each(LAYOUTS)("$view ($level) places $placed beams, each typed by its own mark's family", async ({ view, placed }) => {
    const read = await bnbc();
    const beams = beamsOn(read, view);
    expect(beams.length, `${view} places the beams whose labels stand beside them`).toBe(placed);
    expect(beams.filter((row) => row.memberFamily !== row.mark).map((row) => row.mark), "every one typed by its own mark's family").toEqual([]);
  }, BUDGET_MS);

  test.each(LAYOUTS)("$view ($level): every beam stands where the golden model puts the member of its mark — none named by a neighbour's", async ({ view, level }) => {
    const read = await bnbc();
    const frame = modelFrameOf(read, view);
    const misplaced = beamsOn(read, view).filter((row) => modelMemberAt(level, row.mark, frame(row)) === undefined);
    expect(misplaced.map((row) => `${row.mark}@(${frame(row).join(",")})`), "no placement stands anywhere but on the model's member of its own mark").toEqual([]);
  }, BUDGET_MS);

  test("each placed pair is as wide as its family states — the width the pair was admitted by", async () => {
    const read = await bnbc();
    const at = new Map(read.graph.entities.map((entity) => [entity.key, entity.points ?? []]));
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    const widthOf = (family: string | null) => read.registered.families.find((one) => one.family === family)?.variants[0]?.sectionWidth;
    const disagreeing = LAYOUTS.flatMap(({ view }) =>
      beamsOn(read, view).flatMap((row) => {
        const [left, right] = (runs.get(row.placementKey)?.clear?.sourceKeys ?? []).map((key) => at.get(key)?.[0]);
        const gap = left === undefined || right === undefined ? NaN : Math.hypot((right[0] ?? 0) - (left[0] ?? 0), (right[1] ?? 0) - (left[1] ?? 0));
        return Math.abs(gap - (widthOf(row.memberFamily) ?? NaN)) <= 0.5 ? [] : [`${row.mark}: ${gap} vs ${widthOf(row.memberFamily)}`];
      }),
    );
    expect(disagreeing, "the gap between a placed pair's edge lines is its family's b").toEqual([]);
  }, BUDGET_MS);

  test("what is NOT placed, and why: the slanted members, and the two S-14 lettered on their own axes", async () => {
    const read = await bnbc();
    const marks = (view: string): string[] => beamsOn(read, view).map((row) => row.mark);
    // A slanted pair waits for its run to be read along its own direction (D13): measured along its
    // dominant axis PB4 is its projection, and probed off the plate at both sides a COMPLETE line 15 %
    // over the golden's (L-QTY-06).
    expect(marks("2116").filter((mark) => ["PB4", "PB5", "1EB2"].includes(mark)), "S-13's porch beams and its 45° edge beam").toEqual([]);
    expect(marks("F31").filter((mark) => mark === "EB2"), "S-14's 45° edge beam").toEqual([]);
    expect(marks("10C1").filter((mark) => mark === "REB2"), "S-15's 45° roof-edge beam").toEqual([]);
    // T-TEXT-ROTATED: LB1 and B31 each lettered ON their own axis, 1219 apart — each named the other
    // (250 × 375 billed 250 × 450, and back) until a mark on a pair named no other pair.
    expect(marks("F31").filter((mark) => ["LB1", "B31"].includes(mark)), "S-14's landing beam and B31").toEqual([]);
  }, BUDGET_MS);
});

describe("the runs the new members measure", () => {
  test("every placed beam's clear is read off the plan in S-01's millimetres — never the roof schedule's SPAN (mm)", async () => {
    const read = await bnbc();
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    const cells = new Set(read.reconstructed.tables.flatMap((table) => table.cells.flatMap((cell) => cell.sourceKeys)));
    const beams = LAYOUTS.flatMap(({ view }) => beamsOn(read, view));
    const clears = beams.map((row) => runs.get(row.placementKey)?.clear ?? null);
    expect(clears.filter((clear) => clear === null).length, "every placed beam has a clear").toBe(0);
    expect(new Set(clears.map((clear) => clear?.unit)), "in the declared unit").toEqual(new Set(["mm"]));
    expect(clears.every((clear) => clear?.sourceKeys.includes(DECLARATION)), "citing the declaration (I-340)").toBe(true);
    expect(clears.flatMap((clear) => clear?.sourceKeys ?? []).filter((key) => cells.has(key)), "and no schedule cell — a SPAN is centre to centre").toEqual([]);
    const rb1 = beamsOn(read, "10C1").find((row) => row.mark === "RB1");
    expect(runs.get(rb1?.placementKey ?? "")?.clear?.value, "RB1: 4572 c/c on the roof schedule, 4222 between S-10's column faces").toBe("4222.0");
  }, BUDGET_MS);

  test("no beam line can be COMPLETE: every run leaves at least one side unread, so no slab thickness is ever bound", async () => {
    const read = await bnbc();
    const runs = LAYOUTS.flatMap(({ view }) => beamsOn(read, view)).map((row) => (read.placed.runs ?? []).find((run) => run.placementKey === row.placementKey)) as RunRow[];
    expect(runs.filter((run) => run.sides.every((side) => side !== null)).length, "a run reading both sides would bind t (concrete) and both faces (formwork)").toBe(0);
  }, BUDGET_MS);
});
