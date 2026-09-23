// R6b-1: the joint at a column's top, read off the framing the partition placed (I-413, I-414;
// BNBC 2020 §6.4.9.2).
//
// Two halves. The first stages runs and variants by hand, one behaviour at a time: the level above by
// ordinal, the WHOLE citation list, the variant covering the framing's own level, the canon's
// millimetres, and everything a joint stands UNREAD for. The second stages F-RCC6-BNBC from the
// golden's own model (`fixtures/rcc6-bnbc/model.json`, the generator's, AM-01) and derives the oracle
// from the same file: a joint's depth is the deepest member the model frames that column's storey
// with (`storey`, `supports`). What the partition places today is a subset of that framing, so the
// seam's reading is a bound that is never over, and it reproduces the stored read-back of session 8.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LevelSetup, MemberVariantSetup } from "@/core/offers/contract";
import { exact } from "@/core/units/canon";
import type { StoredPlacement, StoredRun } from "@/modules/takeoff/partition";
import { JOINT_STANDINGS, clearCitationsOf, jointPlacementsOf, jointsOf, type JointObject, type JointPlacement, type JointReading, type JointSetup } from "./joints";
import { readingSetupOf } from "./setup";

/** One level of a stack, by id, label and ordinal. Its height is nobody's business here. */
function level(levelId: string, label: string, ordinal: number): LevelSetup {
  return { levelId, label, ordinal, height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null } };
}

/** One variant of a family as the schedules registry states it: a band, a depth and the cells it was read at. */
function variant(depth: number | null, unit: string | null, band: { readonly from: string | null; readonly to: string | null } = { from: null, to: null }, sourceKeys: readonly string[] = ["CELL:1"]): MemberVariantSetup {
  return {
    variantKey: `${band.from ?? ""}-${band.to ?? ""}`,
    bandFrom: band.from,
    bandTo: band.to,
    sectionText: `300x${depth ?? "?"}`,
    sectionWidth: 300,
    sectionDepth: depth,
    sectionUnit: unit,
    sourceKeys,
    dimensions: {},
    rebar: [],
  };
}

const INGEST = "ingest-1";

/** A stack of three storeys and a roof, handed over out of order and labelled so no label sorts right. */
const STACK: readonly LevelSetup[] = [level("L-ROOF", "ROOF", 3), level("L-1F", "1F", 1), level("L-GF", "GF", 0), level("L-2F", "2F", 2)];

const column = (objectKey: string, levelId: string | null, placementKey = "P:COL"): JointObject => ({ objectKey, placementKey, elementType: "column", levelId });
const beam = (objectKey: string, levelId: string | null, placementKey: string, elementType = "beam"): JointObject => ({ objectKey, placementKey, elementType, levelId });

/** The column's placement and outline, and two beams' placements: the one a run cites and the one it does not. */
const PLACEMENTS: Readonly<Record<string, JointPlacement>> = {
  "P:COL": { ingestId: INGEST, memberFamily: "C1", outlineKey: "OUTLINE:A1" },
  "P:COL2": { ingestId: INGEST, memberFamily: "C1", outlineKey: "OUTLINE:A2" },
  "P:B1": { ingestId: INGEST, memberFamily: "B1", outlineKey: "EDGE:B1:a" },
  "P:B2": { ingestId: INGEST, memberFamily: "B2", outlineKey: "EDGE:B2:a" },
  "P:TB": { ingestId: INGEST, memberFamily: "TB1", outlineKey: "EDGE:TB:a" },
};

/** A run's clear as the partition cites it: its two edge lines FIRST, then the supports, then the unit's declaration. */
const cites = (edge: string, ...supports: readonly string[]): readonly string[] => [`EDGE:${edge}:a`, `EDGE:${edge}:b`, ...supports, "DECLARATION"];

function setupOf(over: Partial<JointSetup> = {}): JointSetup {
  return {
    levels: STACK,
    memberTypes: { [INGEST]: { B1: [variant(600, "mm", undefined, ["CELL:B1"])], B2: [variant(450, "mm", undefined, ["CELL:B2"])], TB1: [variant(300, "mm", undefined, ["CELL:TB1"])] } },
    placements: PLACEMENTS,
    citations: { "P:B1": cites("B1", "OUTLINE:A1", "OUTLINE:A2"), "P:B2": cites("B2", "OUTLINE:A1") },
    ...over,
  };
}

/** The one reading a register answers for one column. */
function jointOf(objects: readonly JointObject[], setup: JointSetup, objectKey: string): JointReading {
  const reading = jointsOf(objects, setup)[objectKey];
  if (reading === undefined) throw new Error(`no reading for ${objectKey}`);
  return reading;
}

describe("a BOUNDED joint: the deepest framing placed on the level above that cites the column", () => {
  const objects = [column("COL@GF", "L-GF"), beam("B1@1F", "L-1F", "P:B1"), beam("B2@1F", "L-1F", "P:B2")];

  it("reads D_lo off the deepest citing member, as its schedule wrote it and in the canon's millimetres", () => {
    expect(jointOf(objects, setupOf(), "COL@GF")).toEqual({
      standing: "BOUNDED",
      levelId: "L-1F",
      depthMm: "600",
      deepest: { objectKey: "B1@1F", placementKey: "P:B1", family: "B1", depth: { value: "600", unit: "mm", basis: "TRANSCRIBED", source: "CELL:B1" }, depthMm: "600" },
      framing: [
        { objectKey: "B1@1F", placementKey: "P:B1", family: "B1", depth: { value: "600", unit: "mm", basis: "TRANSCRIBED", source: "CELL:B1" }, depthMm: "600" },
        { objectKey: "B2@1F", placementKey: "P:B2", family: "B2", depth: { value: "450", unit: "mm", basis: "TRANSCRIBED", source: "CELL:B2" }, depthMm: "450" },
      ],
      depthUnread: [],
    });
  });

  it("carries RESOLVED nowhere: the roster holds BOUNDED and UNREAD alone, because the store holds no framing census", () => {
    expect(JOINT_STANDINGS).toEqual(["BOUNDED", "UNREAD"]);
  });

  it("takes a tie beam as framing, and a member of another class citing the column as none", () => {
    const tied = [column("COL@GF", "L-GF"), beam("TB@1F", "L-1F", "P:TB", "tie_beam")];
    expect(jointOf(tied, setupOf({ citations: { "P:TB": cites("TB", "OUTLINE:A1") } }), "COL@GF")).toMatchObject({ standing: "BOUNDED", depthMm: "300" });
    // A slab or another column standing on the level above is no member a layout plan draws as a pair of
    // edge lines, whatever a citation list says of it.
    const slab = [column("COL@GF", "L-GF"), beam("S@1F", "L-1F", "P:B1", "slab"), column("COL@1F", "L-1F", "P:B1")];
    expect(jointOf(slab, setupOf(), "COL@GF")).toMatchObject({ standing: "UNREAD", unread: "FRAMING" });
  });

  it("gives a tie to the first member in object-key order, however the register arrived", () => {
    const equal = setupOf({ memberTypes: { [INGEST]: { B1: [variant(450, "mm", undefined, ["CELL:B1"])], B2: [variant(450, "mm", undefined, ["CELL:B2"])] } } });
    const forward = [column("COL@GF", "L-GF"), beam("A-beam", "L-1F", "P:B2"), beam("Z-beam", "L-1F", "P:B1")];
    expect(jointOf(forward, equal, "COL@GF")).toMatchObject({ deepest: { objectKey: "A-beam" } });
    expect(jointOf([...forward].reverse(), equal, "COL@GF")).toMatchObject({ deepest: { objectKey: "A-beam" } });
  });

  it("compares depths as the canon's millimetres, never as written: 24 in is deeper than 600 mm", () => {
    const inches = setupOf({ memberTypes: { [INGEST]: { B1: [variant(600, "mm", undefined, ["CELL:B1"])], B2: [variant(24, "in", undefined, ["CELL:B2"])] } } });
    expect(jointOf(objects, inches, "COL@GF")).toMatchObject({
      standing: "BOUNDED",
      depthMm: "609.6",
      deepest: { objectKey: "B2@1F", depth: { value: "24", unit: "in", basis: "TRANSCRIBED", source: "CELL:B2" }, depthMm: "609.6" },
    });
  });

  it("keeps the bound where one citing member's depth is unread, and lists that member with its code", () => {
    const unbanded = setupOf({ memberTypes: { [INGEST]: { B1: [variant(600, null)], B2: [variant(450, "mm", undefined, ["CELL:B2"])] } } });
    expect(jointOf(objects, unbanded, "COL@GF")).toMatchObject({
      standing: "BOUNDED",
      depthMm: "450",
      framing: [{ objectKey: "B2@1F" }],
      depthUnread: [{ objectKey: "B1@1F", placementKey: "P:B1", code: "SECTION_UNIT_UNSTATED" }],
    });
  });
});

describe("the WHOLE clear citation list, never its first atom", () => {
  const runs: readonly StoredRun[] = [
    { placementKey: "P:B1", clear: { value: "4222.0", unit: "mm", basis: "MEASURED", sourceKeys: cites("B1", "OUTLINE:A1", "OUTLINE:A2") }, sides: [null, null] },
    { placementKey: "P:B2", clear: null, sides: [null, null] },
    { placementKey: "P:B3", clear: { value: "1.0", unit: "mm", basis: "MEASURED", sourceKeys: [] }, sides: [null, null] },
  ];

  it("carries every key the partition stored, edge lines first, and leaves out a run whose clear nobody read", () => {
    expect(clearCitationsOf(runs)).toEqual({ "P:B1": ["EDGE:B1:a", "EDGE:B1:b", "OUTLINE:A1", "OUTLINE:A2", "DECLARATION"] });
  });

  it("finds the column only because the list is whole: the rails' setup keeps the first key, an edge line", () => {
    const first = runs[0];
    if (first === undefined) throw new Error("staged run missing");
    expect(readingSetupOf(first.clear)?.source, "what `RunSetup.clear` cites names no column").toBe("EDGE:B1:a");
    const objects = [column("COL@GF", "L-GF"), column("COL2@GF", "L-GF", "P:COL2"), beam("B1@1F", "L-1F", "P:B1")];
    const readings = jointsOf(objects, setupOf({ citations: clearCitationsOf(runs) }));
    expect(readings["COL@GF"], "A1, cited third").toMatchObject({ standing: "BOUNDED", depthMm: "600" });
    expect(readings["COL2@GF"], "A2, cited fourth").toMatchObject({ standing: "BOUNDED", depthMm: "600" });
  });

  it("maps a stored placement to the outline the placement stage wrote, its family and its record", () => {
    const stored: StoredPlacement = {
      tenantId: "t",
      projectId: "p",
      drawingId: "d",
      ingestId: INGEST,
      placementKey: "v:LAYOUT_PLAN:DXF_HANDLE:20B6|C1|0.0,0.0",
      viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:20B6",
      mark: "C1",
      markText: "C1",
      elementType: "column",
      x: 0,
      y: 0,
      gridLetter: "A",
      gridNumeral: "1",
      outlineKey: "DXF_HANDLE:984",
      markKey: "DXF_HANDLE:A01",
      noteKey: null,
      noteText: null,
      noteFromLabel: null,
      noteToLabel: null,
      noteShape: null,
      memberFamily: "C1",
      createdAt: new Date(0),
    };
    expect(jointPlacementsOf([stored])).toEqual({ "v:LAYOUT_PLAN:DXF_HANDLE:20B6|C1|0.0,0.0": { ingestId: INGEST, memberFamily: "C1", outlineKey: "DXF_HANDLE:984" } });
  });
});

describe("the level above, by ordinal, and the variant covering the framing's own level", () => {
  it("reads the next level up the stack by ORDINAL, never by label or by the order the stack arrived in", () => {
    // `10F` sorts before `2F` by its letters; the ordinal puts it where it stands.
    const stack = [level("L-10F", "10F", 3), level("L-1F", "1F", 1), level("L-2F", "2F", 2), level("L-GF", "GF", 0)];
    const objects = [column("COL@1F", "L-1F"), beam("B1@10F", "L-10F", "P:B1"), beam("B2@2F", "L-2F", "P:B2")];
    expect(jointOf(objects, setupOf({ levels: stack }), "COL@1F")).toMatchObject({ standing: "BOUNDED", levelId: "L-2F", depthMm: "450", framing: [{ objectKey: "B2@2F" }] });
  });

  it("does not read the framing at the column's own level (its foot) nor two levels up as its top", () => {
    const objects = [column("COL@1F", "L-1F"), beam("B1@1F", "L-1F", "P:B1"), beam("B2@ROOF", "L-ROOF", "P:B2")];
    expect(jointOf(objects, setupOf(), "COL@1F")).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L-2F", depthUnread: [] });
  });

  it("reads the depth the schedule states at the FRAMING's level, through the notation's reading of its band", () => {
    // Bands as the BNBC schedules write them: "1ST" alone, and "2ND TO 6TH", against a stack that says "1F".
    const storeys = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"].map((label, ordinal) => level(`L-${label}`, label, ordinal));
    const banded = setupOf({
      levels: storeys,
      memberTypes: { [INGEST]: { B1: [variant(450, "mm", { from: "1ST", to: "1ST" }, ["CELL:1ST"]), variant(600, "mm", { from: "2ND", to: "6TH" }, ["CELL:2ND"])] } },
      citations: { "P:B1": cites("B1", "OUTLINE:A1") },
    });
    const objects = [column("COL@GF", "L-GF"), column("COL@1F", "L-1F"), beam("B1@1F", "L-1F", "P:B1"), beam("B1@2F", "L-2F", "P:B1")];
    const readings = jointsOf(objects, banded);
    expect(readings["COL@GF"], "GF's top meets the 1ST band").toMatchObject({ standing: "BOUNDED", depthMm: "450", deepest: { depth: { source: "CELL:1ST" } } });
    expect(readings["COL@1F"], "1F's top meets the 2ND–6TH band, not its own storey's").toMatchObject({ standing: "BOUNDED", depthMm: "600", deepest: { depth: { source: "CELL:2ND" } } });
  });
});

describe("an UNREAD joint names what was not read, and none of its names says the joint is unframed", () => {
  it("LEVEL: the column tops the stack, stands on no level, or on a level the stack no longer holds", () => {
    const objects = [column("COL@ROOF", "L-ROOF"), column("COL@slot", null), column("COL@gone", "L-REPUDIATED")];
    const readings = jointsOf(objects, setupOf());
    for (const key of ["COL@ROOF", "COL@slot", "COL@gone"]) expect(readings[key], key).toEqual({ standing: "UNREAD", unread: "LEVEL", levelId: null, depthUnread: [] });
  });

  it("OUTLINE: the setup holds no placement for the column, or none with an outline", () => {
    const objects = [column("COL@GF", "L-GF", "P:NONE"), column("COL2@GF", "L-GF", "P:COL2"), beam("B1@1F", "L-1F", "P:B1")];
    const placements = { ...PLACEMENTS, "P:COL2": { ingestId: INGEST, memberFamily: "C1", outlineKey: null } };
    const readings = jointsOf(objects, setupOf({ placements }));
    expect(readings["COL@GF"]).toEqual({ standing: "UNREAD", unread: "OUTLINE", levelId: "L-1F", depthUnread: [] });
    expect(readings["COL2@GF"]).toEqual({ standing: "UNREAD", unread: "OUTLINE", levelId: "L-1F", depthUnread: [] });
  });

  it("FRAMING: framing stands on the level above and none of it cites the column, or its run was never read", () => {
    const objects = [column("COL@GF", "L-GF", "P:COL2"), beam("B2@1F", "L-1F", "P:B2"), beam("TB@1F", "L-1F", "P:TB", "tie_beam")];
    expect(jointOf(objects, setupOf(), "COL@GF")).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L-1F", depthUnread: [] });
  });

  it("DEPTH: every citing member's depth refuses under the frame rail's own code, and nothing throws", () => {
    const refusing: Readonly<Record<string, { readonly placement?: JointPlacement; readonly variants?: readonly MemberVariantSetup[]; readonly code: string }>> = {
      "no family": { placement: { ingestId: INGEST, memberFamily: null, outlineKey: "EDGE:X:a" }, code: "MEMBER_TYPE_UNKNOWN" },
      "a family two schedules name (I-331)": { variants: [], code: "MEMBER_TYPE_UNKNOWN" },
      "no band covering its level": { variants: [variant(600, "mm", { from: "2F", to: "2F" })], code: "SECTION_BAND_UNCOVERED" },
      "no unit": { variants: [variant(600, null)], code: "SECTION_UNIT_UNSTATED" },
      "no depth": { variants: [variant(null, "mm")], code: "SECTION_UNIT_UNSTATED" },
      "no cell cited": { variants: [variant(600, "mm", undefined, [])], code: "SECTION_UNIT_UNSTATED" },
      "a cell cited as nothing": { variants: [variant(600, "mm", undefined, [""])], code: "SECTION_UNIT_UNSTATED" },
      "a unit the canon does not name": { variants: [variant(600, "furlong")], code: "UNIT_UNMAPPED" },
      "a unit that is no length": { variants: [variant(600, "kg")], code: "DIMENSION_MISMATCH" },
    };
    for (const [why, staged] of Object.entries(refusing)) {
      const placements: Record<string, JointPlacement> = { ...PLACEMENTS, "P:X": staged.placement ?? { ingestId: INGEST, memberFamily: "X1", outlineKey: "EDGE:X:a" } };
      const setup = setupOf({ placements, memberTypes: { [INGEST]: { X1: staged.variants ?? [] } }, citations: { "P:X": cites("X", "OUTLINE:A1") } });
      const reading = jointOf([column("COL@GF", "L-GF"), beam("X@1F", "L-1F", "P:X")], setup, "COL@GF");
      expect(reading, why).toEqual({ standing: "UNREAD", unread: "DEPTH", levelId: "L-1F", depthUnread: [{ objectKey: "X@1F", placementKey: "P:X", code: staged.code }] });
    }
  });
});

describe("a citation is read inside its own drawing: a handle is unique in one drawing and nowhere else", () => {
  // Two drawings of one campaign, each placed off its own record. Drawing A's column was placed off the
  // outline DXF_HANDLE:984 and B2 frames it at 450. In drawing B, the handle 984 is TG9's first edge
  // line, a 900 girder registered on the same level: its run cites 984 as its own.
  const A = "ingest-A";
  const B = "ingest-B";
  const HANDLE = "DXF_HANDLE:984";
  const crossed: JointSetup = {
    levels: STACK,
    memberTypes: { [A]: { B2: [variant(450, "mm", undefined, ["CELL:A:B2"])] }, [B]: { TG9: [variant(900, "mm", undefined, ["CELL:B:TG9"])] } },
    placements: {
      "A:COL": { ingestId: A, memberFamily: "C1", outlineKey: HANDLE },
      "A:B2": { ingestId: A, memberFamily: "B2", outlineKey: "DXF_HANDLE:A20" },
      "B:TG9": { ingestId: B, memberFamily: "TG9", outlineKey: HANDLE },
    },
    citations: { "A:B2": ["DXF_HANDLE:A20", "DXF_HANDLE:A21", HANDLE, "DECLARATION"], "B:TG9": [HANDLE, "DXF_HANDLE:985", "DXF_HANDLE:9F0", "DECLARATION"] },
  };
  const objects = [column("COL@GF", "L-GF", "A:COL"), beam("B2@1F", "L-1F", "A:B2"), beam("TG9@1F", "L-1F", "B:TG9")];

  it("bounds A's column off its own drawing's B2 at 450, never off drawing B's 900 girder citing the same handle", () => {
    expect(jointOf(objects, crossed, "COL@GF")).toEqual({
      standing: "BOUNDED",
      levelId: "L-1F",
      depthMm: "450",
      deepest: { objectKey: "B2@1F", placementKey: "A:B2", family: "B2", depth: { value: "450", unit: "mm", basis: "TRANSCRIBED", source: "CELL:A:B2" }, depthMm: "450" },
      framing: [{ objectKey: "B2@1F", placementKey: "A:B2", family: "B2", depth: { value: "450", unit: "mm", basis: "TRANSCRIBED", source: "CELL:A:B2" }, depthMm: "450" }],
      depthUnread: [],
    });
  });

  it("reads a column framed only by another drawing's citation as FRAMING unread, with no bound and no member listed", () => {
    const foreignOnly = [column("COL@GF", "L-GF", "A:COL"), beam("TG9@1F", "L-1F", "B:TG9")];
    expect(jointOf(foreignOnly, crossed, "COL@GF")).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L-1F", depthUnread: [] });
    // Even where the foreign member's depth would refuse, it is no member of this joint to list.
    const refusing = { ...crossed, memberTypes: { ...crossed.memberTypes, [B]: {} } };
    expect(jointOf(foreignOnly, refusing, "COL@GF")).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L-1F", depthUnread: [] });
  });

  it("reads each drawing's column off its own drawing's framing, whichever drawing the register named first", () => {
    const both: JointSetup = {
      ...crossed,
      placements: { ...crossed.placements, "B:COL": { ingestId: B, memberFamily: "C1", outlineKey: "DXF_HANDLE:9F0" } },
    };
    const rows = [...objects, column("COLB@GF", "L-GF", "B:COL")];
    for (const register of [rows, [...rows].reverse()]) {
      const readings = jointsOf(register, both);
      expect(readings["COL@GF"]).toMatchObject({ standing: "BOUNDED", depthMm: "450", framing: [{ objectKey: "B2@1F" }] });
      expect(readings["COLB@GF"]).toMatchObject({ standing: "BOUNDED", depthMm: "900", framing: [{ objectKey: "TG9@1F" }] });
    }
  });

  it("reads no citation of a member the setup holds no placement for: it names no drawing, so it frames nothing", () => {
    const unheld = [column("COL@GF", "L-GF"), beam("X@1F", "L-1F", "P:X")];
    const setup = setupOf({ memberTypes: { [INGEST]: { X1: [variant(900, "mm")] } }, citations: { "P:X": cites("X", "OUTLINE:A1") } });
    expect(jointOf(unheld, setup, "COL@GF")).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L-1F", depthUnread: [] });
  });
});

describe("the register the seam answers for", () => {
  it("answers every column row and no other, the same way whatever order the rows and citations arrived in", () => {
    const objects = [
      column("COL@GF", "L-GF"),
      column("COL@ROOF", "L-ROOF"),
      beam("B1@1F", "L-1F", "P:B1"),
      beam("B2@1F", "L-1F", "P:B2"),
      { objectKey: "SW@GF", placementKey: "P:SW", elementType: "shear_wall", levelId: "L-GF" },
    ];
    const setup = setupOf();
    const forward = jointsOf(objects, setup);
    expect(Object.keys(forward).sort()).toEqual(["COL@GF", "COL@ROOF"]);
    const reversed = setupOf({ citations: Object.fromEntries(Object.entries(setup.citations).reverse()), levels: [...STACK].reverse() });
    expect(jointsOf([...objects].reverse(), reversed)).toEqual(forward);
  });
});

// ---------------------------------------------------------------------------------------------------
// F-RCC6-BNBC, staged from the golden's model, with the oracle derived from the same file.

/** One member of the golden model, as far as the joint reads one. */
type ModelMember = {
  readonly id: string;
  readonly class: string;
  readonly mark: string;
  readonly level: string;
  readonly storey?: string;
  readonly stack?: string;
  readonly axis?: string;
  readonly type?: string;
  readonly depth?: string;
  readonly depth2?: string;
  readonly supports?: readonly (readonly [string, string])[];
};

type Model = { readonly storeys: Readonly<Record<string, string>>; readonly members: readonly ModelMember[] };

const MODEL = JSON.parse(readFileSync("fixtures/rcc6-bnbc/model.json", "utf8")) as Model;

/** The model's classes, as the register's catalogue spells them. */
const REGISTER_CLASS: Readonly<Record<string, string>> = { COLUMN: "column", BEAM: "beam", TIE_BEAM: "tie_beam" };

/**
 * The stack the product registers for F-RCC6-BNBC: the model's storeys, FDN beneath GF and ROOF on top.
 * The stair-room roof (`SRR`) is no level of it until LEV-2, so what stands there is on no level.
 */
const BNBC_STACK: readonly LevelSetup[] = Object.keys(MODEL.storeys).map((label, at) => level(`L:${label}`, label, at - Object.keys(MODEL.storeys).indexOf("GF")));
const onStack = (label: string): string | null => (BNBC_STACK.some((one) => one.label === label) ? `L:${label}` : null);

const COLUMNS = MODEL.members.filter((member) => member.class === "COLUMN");
const FRAMING = MODEL.members.filter((member) => member.class === "BEAM" || member.class === "TIE_BEAM");

/** The depth a framing member has at the end one support carries: `depth` at its start, `depth2` at its end. */
const depthAt = (member: ModelMember, end: number): string => (end === 0 ? member.depth : member.depth2) ?? "";

/**
 * The oracle: the deepest member the model frames each column's STOREY with, by the model's own
 * `storey` and `supports` — never the seam's level-above rule, which is what is being judged.
 */
function oracle(): ReadonlyMap<string, string> {
  const deepest = new Map<string, string>();
  for (const member of FRAMING) {
    (member.supports ?? []).forEach(([kind, stack], end) => {
      if (kind !== "COLUMN" || member.storey === undefined) return;
      const key = `${stack}@${member.storey}`;
      const held = deepest.get(key);
      if (held === undefined || exact(depthAt(member, end)).gt(exact(held))) deepest.set(key, depthAt(member, end));
    });
  }
  return deepest;
}

/** What the partition places on F-RCC6-BNBC today: the straight axis-x members, less TG1 (FRM-3). */
const placedToday = (member: ModelMember): boolean => member.axis === "x" && member.type !== "TG";

/**
 * The register, placements, variants and runs of F-RCC6-BNBC for the framing the predicate places.
 * One column placement per grid stack, as S-10 places it once for every storey; one family per mark,
 * banded over the levels the mark stands on (each of BNBC's marks has one depth throughout); and each
 * run's citations in the partition's order: its edge lines, then each column it was cut at.
 */
function bnbcStaged(placed: (member: ModelMember) => boolean): { readonly objects: readonly JointObject[]; readonly setup: JointSetup } {
  const objects: JointObject[] = [];
  const placements: Record<string, JointPlacement> = {};
  const citations: Record<string, readonly string[]> = {};
  const bands = new Map<string, { from: LevelSetup; to: LevelSetup; depth: string }>();
  for (const member of COLUMNS) {
    const stack = member.stack ?? "";
    objects.push({ objectKey: member.id, placementKey: `COL|${stack}`, elementType: REGISTER_CLASS.COLUMN ?? "", levelId: onStack(member.level) });
    placements[`COL|${stack}`] = { ingestId: INGEST, memberFamily: member.mark, outlineKey: `OUTLINE:${stack}` };
  }
  for (const member of FRAMING.filter(placed)) {
    objects.push({ objectKey: member.id, placementKey: member.id, elementType: REGISTER_CLASS[member.class] ?? "", levelId: onStack(member.level) });
    placements[member.id] = { ingestId: INGEST, memberFamily: member.mark, outlineKey: `EDGE:${member.id}:a` };
    const supports = (member.supports ?? []).filter(([kind]) => kind === "COLUMN").map(([, stack]) => `OUTLINE:${stack}`);
    citations[member.id] = [`EDGE:${member.id}:a`, `EDGE:${member.id}:b`, ...supports, "DECLARATION"];
    const at = BNBC_STACK.find((one) => one.label === member.level);
    if (at === undefined) continue;
    const held = bands.get(member.mark);
    bands.set(member.mark, {
      from: held === undefined || at.ordinal < held.from.ordinal ? at : held.from,
      to: held === undefined || at.ordinal > held.to.ordinal ? at : held.to,
      depth: member.depth ?? "",
    });
  }
  const families: Record<string, readonly MemberVariantSetup[]> = {};
  for (const [mark, band] of bands) families[mark] = [variant(Number(band.depth), "mm", { from: band.from.label, to: band.to.label }, [`CELL:${mark}`])];
  return { objects, setup: { levels: BNBC_STACK, memberTypes: { [INGEST]: families }, placements, citations } };
}

/** Each column's reading beside the model's own storey and stack for it. */
function readingsOf(placed: (member: ModelMember) => boolean): readonly { readonly member: ModelMember; readonly reading: JointReading }[] {
  const { objects, setup } = bnbcStaged(placed);
  const readings = jointsOf(objects, setup);
  return COLUMNS.map((member) => {
    const reading = readings[member.id];
    if (reading === undefined) throw new Error(`no reading for ${member.id}`);
    return { member, reading };
  });
}

describe("F-RCC6-BNBC: every joint the model frames, placed whole", () => {
  const truth = oracle();
  const read = readingsOf(() => true);

  it("the model stages the stack and the register the product holds: FDN to ROOF, 26 columns a storey, two roof stubs", () => {
    expect(BNBC_STACK.map((one) => `${one.label}:${one.ordinal}`)).toEqual(["FDN:-1", "GF:0", "1F:1", "2F:2", "3F:3", "4F:4", "5F:5", "6F:6", "ROOF:7"]);
    expect(COLUMNS.length).toBe(8 * 26 + 2);
  });

  it("where the model frames a column's storey, the seam reads exactly the model's deepest member", () => {
    const bounded = read.filter(({ member }) => truth.has(`${member.stack ?? ""}@${member.level}`) && member.level !== "ROOF");
    expect(bounded.length, "GF–6F: 26 columns a storey, every one framed").toBe(7 * 26);
    // The level the model registers a column's framing on (`level`, against the `storey` it frames): the
    // seam finds it by ordinal, and this is the model saying where it is. Only members a column carries
    // are asked; a landing beam framed on beams stands at its own half level.
    const carried = FRAMING.filter((member) => member.storey !== undefined && (member.supports ?? []).some(([kind]) => kind === "COLUMN"));
    const framedOn = new Map(carried.map((member) => [member.storey, member.level]));
    expect(carried.every((member) => framedOn.get(member.storey) === member.level), "one level frames each storey").toBe(true);
    for (const { member, reading } of bounded) {
      expect(reading, member.id).toMatchObject({ standing: "BOUNDED", levelId: `L:${framedOn.get(member.level) ?? "?"}` });
      if (reading.standing === "BOUNDED") expect(exact(reading.depthMm).eq(exact(truth.get(`${member.stack ?? ""}@${member.level}`) ?? "")), member.id).toBe(true);
    }
  });

  it("the FDN necks are framed by grade beams carried on the caps, which cite no column: the FRAMING is unread, never absent", () => {
    const necks = read.filter(({ member }) => member.level === "FDN");
    expect(necks.length).toBe(26);
    for (const { member, reading } of necks) expect(reading, member.id).toEqual({ standing: "UNREAD", unread: "FRAMING", levelId: "L:GF", depthUnread: [] });
    expect(FRAMING.some((member) => member.storey === "FDN" && (member.supports ?? []).some(([kind]) => kind === "CAP")), "the model does frame the neck").toBe(true);
  });

  it("the roof stubs are framed on the stair-room roof, a level nobody registered: the LEVEL is unread, never absent", () => {
    const stubs = read.filter(({ member }) => member.level === "ROOF");
    expect(stubs.map(({ member }) => member.id).sort()).toEqual(["COL:C2@ROOF", "COL:D2@ROOF"]);
    for (const { member, reading } of stubs) {
      expect(reading, member.id).toEqual({ standing: "UNREAD", unread: "LEVEL", levelId: null, depthUnread: [] });
      expect(truth.get(`${member.stack ?? ""}@ROOF`), `${member.id}: the model frames it`).toBe("375");
    }
  });
});

describe("F-RCC6-BNBC: the framing the partition places today, a bound that is never over", () => {
  const truth = oracle();
  const read = readingsOf(placedToday);
  const at = (stack: string, storey: string): JointReading | undefined => read.find(({ member }) => member.stack === stack && member.level === storey)?.reading;

  it("never reads a joint deeper than the model frames it", () => {
    for (const { member, reading } of read) {
      if (reading.standing !== "BOUNDED") continue;
      const deepest = truth.get(`${member.stack ?? ""}@${member.level}`);
      expect(deepest, `${member.id}: a bound where the model frames nothing`).toBeDefined();
      expect(exact(reading.depthMm).lte(exact(deepest ?? "0")), `${member.id}: ${reading.depthMm} over ${deepest ?? "?"}`).toBe(true);
    }
  });

  it("reproduces the stored read-back: A1's top at GF is bounded by 1B1 at 600 on 1F", () => {
    expect(at("A1", "GF")).toMatchObject({ standing: "BOUNDED", levelId: "L:1F", depthMm: "600", deepest: { objectKey: "1B1@1F", family: "1B1" } });
  });

  it("reproduces the stored read-back storey by storey: 24 bounded at GF, 25 from 1F to 6F, C6 and C7 unplaced", () => {
    const counts = new Map<string, { bounded: number; unplaced: string[] }>();
    for (const { member, reading } of read) {
      const held = counts.get(member.level) ?? { bounded: 0, unplaced: [] };
      if (reading.standing === "BOUNDED") held.bounded += 1;
      else if (reading.unread === "FRAMING") held.unplaced.push(member.mark);
      counts.set(member.level, held);
    }
    const sorted = (storey: string): { bounded: number; unplaced: string[] } | undefined => {
      const held = counts.get(storey);
      return held === undefined ? undefined : { bounded: held.bounded, unplaced: [...held.unplaced].sort() };
    };
    expect(sorted("FDN")?.bounded, "no neck is bounded").toBe(0);
    expect(sorted("FDN")?.unplaced.length, "every neck is unplaced").toBe(26);
    expect(sorted("GF")).toEqual({ bounded: 24, unplaced: ["C6", "C7"] });
    for (const storey of ["1F", "2F", "3F", "4F", "5F", "6F"]) expect(sorted(storey), storey).toEqual({ bounded: 25, unplaced: ["C6"] });
  });

  it("reads each mark's bound as the read-back does: C1 and C2 600, C3–C5 450 to 5F, every column 400 under the roof", () => {
    const byMark = new Map<string, Set<string>>();
    for (const { member, reading } of read) {
      if (reading.standing !== "BOUNDED") continue;
      const key = `${member.level === "6F" ? "6F" : "GF–5F"} ${member.mark}`;
      byMark.set(key, (byMark.get(key) ?? new Set()).add(reading.depthMm));
    }
    expect(Object.fromEntries([...byMark].map(([key, depths]) => [key, [...depths]]))).toEqual({
      "GF–5F C1": ["600"],
      "GF–5F C2": ["600"],
      "GF–5F C3": ["450"],
      "GF–5F C4": ["450"],
      "GF–5F C5": ["450"],
      "6F C1": ["400"],
      "6F C2": ["400"],
      "6F C3": ["400"],
      "6F C4": ["400"],
      "6F C5": ["400"],
    });
  });

  it("measures less where the placed framing is shallower than the joint, and says so by standing: B3 at GF reads 450 under TG1's 900", () => {
    expect(truth.get("B3@GF")).toBe("900");
    expect(at("B3", "GF")).toMatchObject({ standing: "BOUNDED", depthMm: "450" });
  });
});
