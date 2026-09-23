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
 *   · I-460 — the beams running up the sheet are lettered ON their own axes, turned along them
 *     (T-TEXT-ROTATED). EntityGraph v3 states each text's world rotation (I-415), and a mark turned to
 *     run along the one pair it stands on names that pair: S-14 +27 (B25–B46, CB1–4, LB1), S-13 +27
 *     (1B23–1B44, 1CB1–4, LB1), S-15 +22 (RB25–RB46). TG1, lettered `D74` at 0° inside its own pair
 *     and `D75` turned across it, stays unplaced. Every clear is graded against the golden model's own
 *     clear: none is over, and each under is recorded for FRM-4 (I-344's list, re-graded).
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

/**
 * The three beam layouts, the level each is drawn for, the golden model's level of it, how many beams
 * it places — and how many of those its labels BESIDE them name (I-344), the rest being named by the
 * turned mark each stands on (I-460).
 *
 * TEST_AMENDED (FRM-3, I-460): 25, 23 and 24 before EntityGraph v3 stated a text's rotation —
 * exactly the beside-named counts below, which do not move.
 */
const LAYOUTS = Object.freeze([
  { view: "F31", level: "2F", placed: 52, beside: 25 },
  { view: "2116", level: "1F", placed: 50, beside: 23 },
  { view: "10C1", level: "ROOF", placed: 46, beside: 24 },
] as const);

/** The members each layout letters on their own axes, turned along them — the golden's vertical beams, cantilevers and landing beam. */
const numberedFrom = (prefix: string, from: number, to: number): string[] => Array.from({ length: to - from + 1 }, (_unused, at) => `${prefix}${from + at}`);
const TURNED: Readonly<Record<string, readonly string[]>> = Object.freeze({
  F31: [...numberedFrom("B", 25, 46), ...numberedFrom("CB", 1, 4), "LB1"],
  "2116": [...numberedFrom("1B", 23, 44), ...numberedFrom("1CB", 1, 4), "LB1"],
  "10C1": numberedFrom("RB", 25, 46),
});

/**
 * What each placed beam's clear reads against the golden model's own, where it is not the golden's
 * figure — every one UNDER, and each owed to FRM-4 (I-344's list, re-graded over all 148 runs):
 *   · CB1/CB2 and their 1F twins, −125: each is cut at EB1's face where EB1 is cut at theirs, so the
 *     corner between them has no owning member (L-MEA-09) — the golden runs the cantilever to its tip.
 *   · B34/B37 and 1B32, −125: cut at the face of the beam crossing their end where the golden cuts at
 *     the lift core's wall, which is not yet a placed support (WLS-1).
 *   · 1B34 −25 and 1B35 −150: they end on TG1, which stays unplaced, and are cut at the B4 column's face.
 *   · The roof's runs, −50 to −275: cut at the faces of the columns S-10 draws, where the golden cuts at
 *     the roof storey's own (support faces per storey).
 */
const UNDER: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  F31: { B34: -125, B37: -125, CB1: -125, CB2: -125 },
  "2116": { "1B32": -125, "1B34": -25, "1B35": -150, "1CB1": -125, "1CB2": -125 },
  "10C1": {
    RB1: -100, RB5: -100, RB6: -200, RB7: -100, RB8: -50, RB9: -50, RB10: -200, RB11: -200, RB12: -75, RB13: -50, RB14: -75, RB15: -200,
    RB16: -200, RB17: -75, RB18: -75, RB19: -200, RB24: -100, RB25: -100, RB29: -275, RB30: -150, RB31: -150, RB32: -275, RB33: -275,
    RB34: -200, RB35: -225, RB36: -200, RB37: -125, RB38: -225, RB39: -275, RB40: -150, RB41: -150, RB42: -275, RB43: -100, RB46: -100,
  },
});

/** The marks each strip sheet labels — the golden model's typical-floor and first-floor rosters. */
const numbered = (prefix: string, count: number): string[] => Array.from({ length: count }, (_unused, at) => `${prefix}${at + 1}`);
const TYPICAL_MARKS = [...numbered("B", 46), ...numbered("CB", 4), "EB1", "EB2", "LB1"];
const FIRST_FLOOR_MARKS = [...numbered("1B", 44), ...numbered("1CB", 4), "1EB1", "1EB2", "PB4", "PB5", "TG1"];

/** One member of the golden model (`fixtures/rcc6-bnbc/model.json`, the generator's own, AM-01). */
type ModelMember = { readonly id: string; readonly class: string; readonly mark: string; readonly level: string; readonly p0: readonly string[]; readonly p1: readonly string[]; readonly clear: string };
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
  test.each(LAYOUTS)("$view ($level) places $placed beams, each typed by its own mark's family", async ({ view, placed, beside }) => {
    const read = await bnbc();
    const beams = beamsOn(read, view);
    expect(beams.length, `${view} places the beams whose labels stand beside them, and the beams lettered turned on their own axes`).toBe(placed);
    expect(beams.filter((row) => row.memberFamily !== row.mark).map((row) => row.mark), "every one typed by its own mark's family").toEqual([]);
    expect(beams.filter((row) => !TURNED[view]?.includes(row.mark)).length, "the beside-named beams I-344 placed, unmoved").toBe(beside);
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

  test("what is NOT placed, and why: the slanted members, and TG1 — lettered at 0° inside its own pair and turned across it", async () => {
    const read = await bnbc();
    const marks = (view: string): string[] => beamsOn(read, view).map((row) => row.mark);
    // A slanted pair waits for its run to be read along its own direction (D13): measured along its
    // dominant axis PB4 is its projection, and probed off the plate at both sides a COMPLETE line 15 %
    // over the golden's (L-QTY-06).
    expect(marks("2116").filter((mark) => ["PB4", "PB5", "1EB2"].includes(mark)), "S-13's porch beams and its 45° edge beam").toEqual([]);
    expect(marks("F31").filter((mark) => mark === "EB2"), "S-14's 45° edge beam").toEqual([]);
    expect(marks("10C1").filter((mark) => mark === "REB2"), "S-15's 45° roof-edge beam").toEqual([]);
    // TG1 is lettered twice on S-13, both ON its own 400 pair: `D74` at 0° — written the way the sheet
    // reads, which is how F-RCC6's `40B` stands on a pair that is NOT its own — and `D75` turned across
    // it. Neither is a mark running along the pair it stands on, so neither names it (I-460).
    const onS13 = (key: string): boolean => read.evidence.assignments.get(key) === "LAYOUT_PLAN:DXF_HANDLE:2116";
    const lettering = read.graph.entities.filter((entity) => entity.text === "TG1" && onS13(entity.key)).map((entity) => `${entity.key}@${entity.rotation}`);
    expect(lettering.sort(), "S-13 letters TG1 at 0° and at 90°").toEqual(["DXF_HANDLE:D74@0", "DXF_HANDLE:D75@90"]);
    expect(marks("2116").filter((mark) => mark === "TG1"), "S-13's transfer girder").toEqual([]);
  }, BUDGET_MS);

  test("I-460: every beam lettered turned on its own axis is placed, named by that mark — and S-14's LB1 and B31 each by its own", async () => {
    const read = await bnbc();
    const rotationOf = new Map(read.graph.entities.map((entity) => [entity.key, entity.rotation]));
    for (const { view } of LAYOUTS) {
      const turned = beamsOn(read, view).filter((row) => rotationOf.get(row.markKey) !== 0);
      expect(turned.map((row) => row.mark).sort(), `${view}: the members it letters turned`).toEqual([...(TURNED[view] ?? [])].sort());
      expect(new Set(turned.map((row) => rotationOf.get(row.markKey))), `${view}: each by a mark turned up the sheet`).toEqual(new Set([90]));
    }
    // T-TEXT-ROTATED: LB1 and B31 each lettered ON their own axis, 1219 apart — each named the other
    // (250 × 375 billed 250 × 450, and back) while a mark on a pair was read as a label beside another.
    const named = Object.fromEntries(beamsOn(read, "F31").filter((row) => ["LB1", "B31"].includes(row.mark)).map((row) => [row.mark, row.markKey]));
    expect(named, "each named by the mark standing on its own pair").toEqual({ B31: "DXF_HANDLE:F12", LB1: "DXF_HANDLE:F2F" });
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

  test("every clear graded against the golden model's own: none OVER, and every UNDER the one FRM-4 is recorded to cut (I-344's list, re-graded)", async () => {
    const read = await bnbc();
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    for (const { view, level } of LAYOUTS) {
      const frame = modelFrameOf(read, view);
      const graded: Record<string, number> = {};
      for (const row of beamsOn(read, view)) {
        const member = modelMemberAt(level, row.mark, frame(row));
        const clear = runs.get(row.placementKey)?.clear?.value;
        if (member === undefined || clear === undefined) throw new Error(`${view} ${row.mark} stands on no model member, or reads no clear`);
        const off = Math.round((Number(clear) - Number(member.clear)) * 10) / 10;
        if (off !== 0) graded[row.mark] = off;
      }
      expect(Object.entries(graded).filter(([, off]) => off > 0), `${view}: no clear over the golden's — L-QTY-06 never allows it`).toEqual([]);
      expect(graded, `${view}: each under, by how much`).toEqual(UNDER[view]);
    }
  }, BUDGET_MS);

  test("the x-beams FRM-3's members now carry: the 17 clears I-344 recorded OVER are cut at the new members' faces", async () => {
    const read = await bnbc();
    const runs = new Map((read.placed.runs ?? []).map((run) => [run.placementKey, run]));
    const clearOf = (view: string, mark: string): string | undefined => runs.get(beamsOn(read, view).find((row) => row.mark === mark)?.placementKey ?? "")?.clear?.value;
    const recorded: readonly (readonly [string, string])[] = [
      ...["B12", "B13", "B14", "B17", "B18", "EB1"].map((mark) => ["F31", mark] as const),
      ...["1B10", "1B11", "1B12", "1B15", "1B16", "1EB1"].map((mark) => ["2116", mark] as const),
      ...["RB12", "RB13", "RB14", "RB17", "RB18"].map((mark) => ["10C1", mark] as const),
    ];
    // Before: B12's kind read 4042.2 (+125), B13's 2743.2 (+250), EB1 4267.2 (+250, cut at no end),
    // the roof's RB12 kind 4042.2 (+50) and RB13 2743.2 (+200) — each OVER the golden's.
    expect(recorded.map(([view, mark]) => `${mark} ${clearOf(view, mark)}`), "each at the golden's own figure, or under it").toEqual([
      "B12 3917.2", "B13 2493.2", "B14 3917.2", "B17 3917.2", "B18 3917.2", "EB1 4017.2",
      "1B10 3917.2", "1B11 2493.2", "1B12 3917.2", "1B15 3917.2", "1B16 3917.2", "1EB1 4017.2",
      "RB12 3917.2", "RB13 2493.2", "RB14 3917.2", "RB17 3917.2", "RB18 3917.2",
    ]);
  }, BUDGET_MS);

  test("no beam line can be COMPLETE: every run leaves at least one side unread, so no slab thickness is ever bound", async () => {
    const read = await bnbc();
    const runs = LAYOUTS.flatMap(({ view }) => beamsOn(read, view)).map((row) => (read.placed.runs ?? []).find((run) => run.placementKey === row.placementKey)) as RunRow[];
    expect(runs.filter((run) => run.sides.every((side) => side !== null)).length, "a run reading both sides would bind t (concrete) and both faces (formwork)").toBe(0);
  }, BUDGET_MS);
});
