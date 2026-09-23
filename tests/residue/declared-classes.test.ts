/**
 * The drawings DECLARE what they show (s-coverage I-479, I-481; L-QTY-05's second
 * and third channels read at the grain of a caption).
 *
 * Walk-0 (register-trace, BLOCKS_DEMO): the coverage grid of F-RCC6-BNBC knew only the four classes
 * the partition placed — Beam, Column, Pile, Pile cap — while the set carries sheets for grade beams
 * and slab-on-grade, slabs, the stair, the lift core, the tanks and the lintels. The captions below
 * are F-RCC6-BNBC's own, as its stored partition reads them (54 views, read back from gate 2's J-000
 * project), so what is judged is what the declared axis makes of the demo's real set.
 */
import { describe, expect, test } from "vitest";
import { VIEW_TYPE_SPELLINGS } from "@/core/errors/transport-vocabulary";
import { classDeclarationsOf, classesDeclaredBy, unclassedDeclarationsOf, unclassedDeclaredBy, type ManifestView } from "@/core/residue/declared";

/**
 * The declared readers take the view classes they name from the vocabulary's one home BY POSITION —
 * core may not spell a view class (L-CAD-06's literal ban) — so a class inserted into that roster
 * would shift what they bind without a type error. This is the tripwire: the positions they read.
 */
test("the view classes the declared readers bind by position stand where they read them", () => {
  expect({ schedule: VIEW_TYPE_SPELLINGS[1], legend: VIEW_TYPE_SPELLINGS[7], title: VIEW_TYPE_SPELLINGS[8], unassigned: VIEW_TYPE_SPELLINGS[10] }, "channels/declared.ts and declared.ts destructure these by position — move the bindings with the roster").toEqual({
    schedule: "SCHEDULE",
    legend: "LEGEND_NOTES",
    title: "TITLE",
    unassigned: "UNASSIGNED",
  });
});

/** F-RCC6-BNBC's captions by the class the partition's grammar read them as (L-CAD-06). */
const BNBC: readonly (readonly [string, string])[] = [
  ["DETAIL", "1ST FLOOR SLAB REINFORCEMENT PLAN  SCALE 1:100"],
  ["DETAIL", "PARAPET DETAIL  SCALE 1:20"],
  ["DETAIL", "TYPICAL SLAB REINFORCEMENT PLAN"],
  ["DETAIL", "TYPICAL STIRRUP HOOK DETAIL  SCALE 1:20"],
  ["LAYOUT_PLAN", "1ST FLOOR BEAM LAYOUT  SCALE 1:100"],
  ["LAYOUT_PLAN", "COLUMN LAYOUT PLAN  SCALE 1:100"],
  ["LAYOUT_PLAN", "GRADE BEAM LAYOUT & GF SLAB ON GRADE  SCALE 1:100"],
  ["LAYOUT_PLAN", "LIFT CORE PLAN  SCALE 1:50"],
  ["LAYOUT_PLAN", "PILE CAP LAYOUT  SCALE 1:100"],
  ["LAYOUT_PLAN", "PILE LAYOUT PLAN  SCALE 1:100"],
  ["LAYOUT_PLAN", "ROOF BEAM LAYOUT (AT ROOF LEVEL)"],
  ["LAYOUT_PLAN", "STAIR ROOF BEAM LAYOUT  SCALE 1:100"],
  ["LAYOUT_PLAN", "TYPICAL FLOOR BEAM LAYOUT"],
  ["LONG_SECTION_STRIP", "GB1 LONG SECTION  SCALE 1:50"],
  ["MEMBER_SECTION", "C1 SECTION  SCALE 1:20 (DRAWN x5, DIMLFAC 0.2)"],
  ["MEMBER_SECTION", "LIFT PIT SECTION  SCALE 1:50"],
  ["MEMBER_SECTION", "PC1 SECTION  SCALE 1:25"],
  ["MEMBER_SECTION", "PILE SECTION  SCALE 1:20"],
  ["MEMBER_SECTION", "SECTION A-A"],
  ["SCHEDULE", "BAR BENDING SCHEDULE (SAMPLE)"],
  ["SCHEDULE", "COLUMN SCHEDULE"],
  ["SCHEDULE", "LINTEL & SUNSHADE SCHEDULE"],
  ["SCHEDULE", "PILE CAP SCHEDULE  SCALE 1:50"],
  ["SCHEDULE", "PILE SCHEDULE  SCALE 1:50"],
  ["SCHEDULE", "ROOF BEAM SCHEDULE (1 OF 2)"],
  ["STAIR_PLAN", "ROOF & STAIR ROOF PLAN  SCALE 1:100"],
  ["STAIR_PLAN", "STAIR PLAN AT 1ST FLOOR (TYPICAL)  SCALE 1:50"],
  ["STAIR_PLAN", "STAIR PLAN AT GROUND FLOOR  SCALE 1:50"],
  ["STAIR_SECTION", "STAIR SECTION  SCALE 1:20"],
  ["UNASSIGNED", ""],
  ["UNTYPED", "1ST FLOOR BEAM DETAILS  SCALE 1:50"],
  ["UNTYPED", "BAR SHAPE CODES  SCALE 1:25"],
  ["UNTYPED", "F1 ISOLATED FOOTING (RAMP WALL)  SCALE 1:25"],
  ["UNTYPED", "OVERHEAD WATER TANK  SCALE 1:50"],
  ["UNTYPED", "PILE CURTAILMENT & SPIRAL ZONES  SCALE 1:100"],
  ["UNTYPED", "SEPTIC TANK  SCALE 1:50"],
  ["UNTYPED", "TYPICAL SLAB BAR CRANK  SCALE 1:20"],
  ["UNTYPED", "UNDERGROUND WATER RESERVOIR  SCALE 1:50"],
];

const DRAWING = "drawing-bnbc";

const views: ManifestView[] = BNBC.map(([type, caption], at) => ({ drawingId: DRAWING, address: `v:${type}:DXF_HANDLE:${at}`, type, caption, anchorKey: `DXF_HANDLE:${at}` }));

describe("I-479: a caption declares the classes it names, by a closed word table", () => {
  test("F-RCC6-BNBC's captions declare every class the set draws a sheet for — not only the four the partition placed", () => {
    const declared = new Set(classDeclarationsOf(views).map((declaration) => declaration.class));
    expect([...declared].sort(), "slabs, the stair, the lift core, the grade beams, the lintels and the ramp's footing stand beside the four placed classes").toEqual([
      "beam",
      "column",
      "footing",
      "lintel",
      "pile",
      "pile_cap",
      "shear_wall",
      "slab",
      "stair",
      "tie_beam",
    ]);
  });

  test("a grade beam is a tie beam, and the slab on grade is a slab — one caption, two classes, and no floor beam", () => {
    expect(classesDeclaredBy("GRADE BEAM LAYOUT & GF SLAB ON GRADE  SCALE 1:100")).toEqual(["tie_beam", "slab"]);
  });

  test("the lift core and the lift pit are the RCC walls a shear wall is; a stair's ROOF is no flight of stairs", () => {
    expect(classesDeclaredBy("LIFT CORE PLAN  SCALE 1:50")).toEqual(["shear_wall"]);
    expect(classesDeclaredBy("LIFT PIT SECTION  SCALE 1:50")).toEqual(["shear_wall"]);
    expect(classesDeclaredBy("STAIR ROOF BEAM LAYOUT  SCALE 1:100"), "the stair room's roof beams are beams").toEqual(["beam"]);
    expect(classesDeclaredBy("STAIR PLAN AT GROUND FLOOR  SCALE 1:50")).toEqual(["stair"]);
  });

  test("a pile cap is never read as a pile, and a mark or a code names nothing", () => {
    expect(classesDeclaredBy("PILE CAP LAYOUT  SCALE 1:100")).toEqual(["pile_cap"]);
    expect(classesDeclaredBy("PC1 SECTION  SCALE 1:25"), "a mark is a family's, and the table reads no mark").toEqual([]);
    expect(classesDeclaredBy("BAR SHAPE CODES  SCALE 1:25")).toEqual([]);
    expect(classesDeclaredBy("SECTION A-A")).toEqual([]);
  });

  test("a title block, a note and a view no caption anchors declare nothing, whatever words they carry", () => {
    const talking: ManifestView[] = [
      { drawingId: DRAWING, address: "v:TITLE:t", type: "TITLE", caption: "STRUCTURAL DRAWINGS — SLAB, BEAM AND COLUMN", anchorKey: "t" },
      { drawingId: DRAWING, address: "v:LEGEND_NOTES:n", type: "LEGEND_NOTES", caption: "GENERAL NOTES FOR SLAB AND STAIR", anchorKey: "n" },
      { drawingId: DRAWING, address: "v:UNASSIGNED:u", type: "UNASSIGNED", caption: "", anchorKey: null },
    ];
    expect(classDeclarationsOf(talking)).toEqual([]);
  });

  test("one caption stored twice (two ingests of one drawing) is one declaration", () => {
    const twice = [views[0] as ManifestView, { ...(views[0] as ManifestView), address: "v:DETAIL:DXF_HANDLE:again" }];
    expect(classDeclarationsOf(twice)).toHaveLength(1);
  });
});

describe("I-481: a member the drawings show that no class is, is named and never dropped", () => {
  test("F-RCC6-BNBC's tanks, reservoir, parapet, sunshade and ramp are named by the caption that shows each", () => {
    const named = unclassedDeclarationsOf(views).map((member) => `${member.word}: ${member.caption}`);
    expect(named.sort()).toEqual([
      "parapet: PARAPET DETAIL  SCALE 1:20",
      "ramp: F1 ISOLATED FOOTING (RAMP WALL)  SCALE 1:25",
      "reservoir: UNDERGROUND WATER RESERVOIR  SCALE 1:50",
      "sunshade: LINTEL & SUNSHADE SCHEDULE",
      "tank: OVERHEAD WATER TANK  SCALE 1:50",
      "tank: SEPTIC TANK  SCALE 1:50",
    ]);
  });

  test("a word outside the table names nothing", () => {
    expect(unclassedDeclaredBy("TYPICAL FLOOR BEAM LAYOUT")).toEqual([]);
  });
});
