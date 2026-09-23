/**
 * L-CAD-08's "row-cluster by y with BAND-FIRST clustering", on the schedule F-RCC6-BNBC actually
 * draws: S-11's COLUMN SCHEDULE stacks THREE lines of text per mark per band — the section over the
 * bars over the ties — with the mark written once, level with the third of them, under four merged
 * band headers (T-SCHED-MERGED, T-NOT-RANGE-GF3).
 *
 * Read band for band that is three rows per mark, two of which name no member at all: C1's row then
 * carries the TIES string as its section, every variant of every column reads as sectionless with no
 * rebar zones under it, and the column rail can publish no line from a drawing that states every
 * column it has. The reading this suite grades is that a ROW is delimited by its MARK CELLS — the
 * lines between one mark and the next are that mark's, joined per column in reading order by the
 * sign two texts of one cell are joined with, each cell citing every text it was read from — and
 * that the general notes stacked under the table are NOT folded into the last mark's row.
 *
 * The sheet is drawn here at the generator's own numbers (`fixtures/gen/rcc6_bnbc/emit/sheets/cols.py`
 * s11: col_w 4200, row_h 2600, w_mark 2000, the mark at row_h/2, the three lines at 500/900/1300
 * below the row's top), never read out of the fixture: what is graded is a drawing drawn this way,
 * and a fixture is not a test's input (B-19). The one number that is this rig's and not the sheet's
 * is the caption's height — 800 rather than 400 — because a caption's reach is thirty of its own
 * heights and this sheet carries no second caption for the real reach to be measured against.
 *
 * Nothing here opens a database, a model or a clock: three pure functions over one artifact, reached
 * through the stage's own doors so a module that moved is a red here rather than a silence.
 */
import { describe, expect, test } from "vitest";
import { reconstructDoor, registryDoor, type FamilyRow, type ReconstructedTable, type VariantRow } from "../support/schedules-stage";
import { viewsResultOf } from "../support/conventions-stage";

/** S-11's own geometry (cols.py s11). */
const COL_W = 4200;
const ROW_H = 2600;
const W_MARK = 2000;
const MARK_X = 400;

/** The four band headers the office writes, in its own spelling (BAND_HEADERS, T-NOT-RANGE-GF3). */
const HEADERS: readonly string[] = ["GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR"];

/** Three of the seven marks the sheet schedules, with the bands each carries. */
const MARKS: readonly string[] = ["C1", "C2", "C7"];
const SECTIONS: Readonly<Record<string, readonly string[]>> = {
  C1: ["400x400", "350x350", "300x300", "300x300"],
  C2: ["300x600", "300x500", "300x400", "300x400"],
  C7: ["450x450", "450x450", "450x450", "450x450"],
};
const BARS: Readonly<Record<string, readonly string[]>> = {
  C1: ["8-16%%C", "8-16%%C", "8-16%%C", "8-16%%C"],
  C2: ["10-20%%C", "8-20%%C", "8-16%%C", "8-16%%C"],
  C7: ["8-20%%C", "8-20%%C", "8-20%%C", "8-20%%C"],
};
const TIES: Readonly<Record<string, string>> = {
  C1: "10%%C@100/150 (TIES)",
  C2: "10%%C@100/150 (TIES)",
  C7: "10%%C@100/100 (TIES)",
};

/** The two notes the sheet stacks under the table — on the sheet, and in no row of the schedule. */
const NOTES: readonly string[] = ["ALL COLUMNS f'c = 3500 psi, fy = 500 MPa, 40 mm CLEAR COVER", "THE MILLIMETRE CELL GOVERNS"];

/** One drawn text of the artifact, in the shape the mirror validates (L-CAD-05). */
type Drawn = { key: string; type: string; space: string; layer: string; colour: unknown; text: string; height: number; points: number[][] };

/** The sheet, drawn once: the caption, the header band, three stacked mark rows, two notes beneath. */
function sheet(): { graph: unknown; keys: Map<string, string> } {
  let ordinal = 0;
  const entities: Drawn[] = [];
  const keys = new Map<string, string>();
  const at = (name: string, text: string, x: number, y: number, height: number): void => {
    const key = `DXF_HANDLE:${(ordinal += 1).toString(16).toUpperCase()}`;
    keys.set(name, key);
    entities.push({ key, type: "TEXT", space: "Model", layer: "S-TEXT", colour: { rgb: [0, 0, 0], source: "bylayer" }, text, height, points: [[x, y]] });
  };

  at("caption", "COLUMN SCHEDULE", 0, 2200, 800);
  at("mark-header", "MARK", MARK_X, 300, 260);
  HEADERS.forEach((header, band) => at(`header:${band}`, header, W_MARK + band * COL_W + COL_W / 2, 300, 260));
  MARKS.forEach((mark, row) => {
    const y = -row * ROW_H;
    at(`mark:${mark}`, mark, MARK_X, y - ROW_H / 2, 300);
    HEADERS.forEach((_header, band) => {
      const x = W_MARK + band * COL_W + 1300;
      at(`section:${mark}:${band}`, SECTIONS[mark]?.[band] ?? "", x, y - 500, 240);
      at(`bars:${mark}:${band}`, BARS[mark]?.[band] ?? "", x, y - 900, 240);
      at(`ties:${mark}:${band}`, TIES[mark] ?? "", x, y - 1300, 240);
    });
  });
  const under = -ROW_H * MARKS.length - 900;
  NOTES.forEach((note, index) => at(`note:${index}`, note, 0, under - index * 600, 240));

  return {
    graph: {
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 4, unit: "mm", unmapped: false },
      layouts: [{ name: "Model", kind: "model", bbox: { min: [-1000, -12000], max: [20000, 3000] }, strays_rejected: 0 }],
      dropped_layouts: [],
      entities,
      derived: [],
      block_attributes: [],
      counters: [],
    },
    keys,
  };
}

/**
 * The unit the drawing's general notes declare, as the conventions stage resolves it (I-302): F-RCC6-
 * BNBC's S-01 clause 4, `ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES`, on the
 * notes sheet's paper — never on this schedule's sheet, which is why it is handed in rather than drawn.
 */
const DECLARED = { dimensionUnit: { unit: "mm", sourceKey: "DXF_HANDLE:1F3E" } } as const;

/** The one table the sheet reconstructs to, and the registry folded out of it (under a declaration, if one is handed in). */
async function readingOf(conventions?: typeof DECLARED): Promise<{ table: ReconstructedTable; families: FamilyRow[]; keys: Map<string, string> }> {
  const { graph, keys } = sheet();
  const partitioned = await viewsResultOf(graph);
  const { reconstructSchedules } = await reconstructDoor();
  const { registerMemberTypes } = await registryDoor();
  const reconstructed = reconstructSchedules({
    graph,
    views: partitioned.views,
    assignments: (partitioned as unknown as { assignments: ReadonlyMap<string, string> }).assignments,
  });
  expect(reconstructed.tables.length, "the drawn sheet carries one schedule, anchored on its caption").toBe(1);
  expect(reconstructed.deferrals, "which reconstructed, and therefore defers nothing").toEqual([]);
  const registered = registerMemberTypes(reconstructed.tables, conventions);
  expect(registered.deferrals, "and contributed member types, so it defers nothing there either").toEqual([]);
  return { table: reconstructed.tables[0] as ReconstructedTable, families: registered.families, keys };
}

/** One row of the reconstructed table, by column. */
function rowOf(table: ReconstructedTable, rowIndex: number): Map<number, { text: string; sourceKeys: string[] }> {
  return new Map(table.cells.filter((cell) => cell.rowIndex === rowIndex).map((cell) => [cell.columnIndex, { text: cell.text, sourceKeys: cell.sourceKeys }]));
}

/** One variant of a family, by the band it is keyed under. */
function variantOf(family: FamilyRow | undefined, variantKey: string): VariantRow | undefined {
  return family?.variants.find((variant) => variant.variantKey === variantKey);
}

describe("L-CAD-08: a schedule that stacks a band's whole statement in one cell", () => {
  test("the rows of the table are its marks, and a mark's three stacked lines are one cell per band", async () => {
    const { table, keys } = await readingOf();

    expect(
      [...new Set(table.cells.map((cell) => cell.rowIndex))].sort((left, right) => left - right),
      "a header, one row per mark, and one row for each note beneath the table — never three rows per mark, two of which name no member",
    ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(table.columns.length, "five columns: the marks and the four bands the merged headers name").toBe(5);
    expect([...rowOf(table, 0).values()].map((cell) => cell.text), "the header band is the table's own, unfolded").toEqual(["MARK", ...HEADERS]);

    const first = rowOf(table, 1);
    expect(first.get(0)?.text, "the mark cell names the member the row stands for").toBe("C1");
    expect(
      first.get(1)?.text,
      "and its GF TO 2ND cell says everything the draughtsman stacked in that cell, in the order the page is read, joined by the sign two texts of one cell are joined with (AC-2)",
    ).toBe("400x400+8-16%%C+10%%C@100/150 (TIES)");
    expect(
      first.get(1)?.sourceKeys,
      "citing every text it was read from — three lines of text are three source keys (L-CAD-03)",
    ).toEqual([keys.get("section:C1:0"), keys.get("bars:C1:0"), keys.get("ties:C1:0")]);
    expect(first.get(4)?.text, "the last band's cell is read the same way").toBe("300x300+8-16%%C+10%%C@100/150 (TIES)");
  });

  test("the general notes stacked under the table are rows of their own, never lines of the last mark", async () => {
    const { table } = await readingOf();

    expect(rowOf(table, 3).get(0)?.text, "the last mark's row is the last mark's").toBe("C7");
    expect(
      rowOf(table, 3).get(1)?.text,
      "and its first band states the section, the bars and the ties that were drawn in it and nothing else",
    ).toBe("450x450+8-20%%C+10%%C@100/100 (TIES)");
    expect(
      [rowOf(table, 4).get(0)?.text, rowOf(table, 5).get(0)?.text],
      "the notes stand 2,200 and further below the last mark, which is past half the 2,600 its marks stand apart: a row's lines are the ones nearest it, and `ALL COLUMNS f'c = 3500 psi` is nobody's section (L-QTY-01)",
    ).toEqual(NOTES);
  });
});

describe("R-TO-031: what the registry reads out of a stacked cell", () => {
  test("every mark carries a variant per band, each with the section, the main bars and the two tie zones its own cell states", async () => {
    const { families } = await readingOf();

    expect(families.map((family) => family.family), "one row per mark family, in the order the table names them").toEqual(["C1", "C2", "C7"]);

    const c1 = families.find((family) => family.family === "C1");
    expect(
      c1?.variants.map((variant) => ({ key: variant.variantKey, from: variant.bandFrom, to: variant.bandTo })),
      "four variants, one per merged band header: a LIST of two consecutive floors is the band between them, and a band whose upper end names a label no level roster places carries that label as the drawing wrote it — where SRR stands on the ladder is the expansion's question (L-CAD-07)",
    ).toEqual([
      { key: "GF-2ND", from: "GF", to: "2ND" },
      { key: "3RD-4TH", from: "3RD", to: "4TH" },
      { key: "5TH-6TH", from: "5TH", to: "6TH" },
      { key: "ROOF-SRR", from: "ROOF", to: "SRR" },
    ]);

    const gf = variantOf(c1, "GF-2ND");
    expect(
      { text: gf?.sectionText, width: gf?.sectionWidth, depth: gf?.sectionDepth, unit: gf?.sectionUnit },
      "the cell is kept verbatim, and the section is the part of it that reads as a pair of sides — no unit, because the schedule wrote none over the column and a number nobody gave a unit to is not a millimetre (L-MEA-01)",
    ).toEqual({ text: "400x400+8-16%%C+10%%C@100/150 (TIES)", width: 400, depth: 400, unit: null });
    expect(
      gf?.zones.map((zone) => ({ zone: zone.zone, text: zone.text, bars: zone.bars, spacing: zone.spacing, bar: zone.spacingBar })),
      "and the band's own rebar stands beneath it: the bars the cell names, and the TWO centres a ties cell states in one breath as the zones they are — the end zones' first, the middle's second (L-FRM-05)",
    ).toEqual([
      { zone: "main", text: "8-16%%C", bars: [{ n: 8, diameterMm: 16 }], spacing: null, bar: null },
      { zone: "ties-end", text: "10%%C@100/150 (TIES)", bars: null, spacing: 100, bar: 10 },
      { zone: "ties-mid", text: "10%%C@100/150 (TIES)", bars: null, spacing: 150, bar: 10 },
    ]);

    const roof = variantOf(c1, "ROOF-SRR");
    expect({ width: roof?.sectionWidth, depth: roof?.sectionDepth }, "every band of the row states its own section, not the first band's").toEqual({ width: 300, depth: 300 });

    const c7 = variantOf(families.find((family) => family.family === "C7"), "5TH-6TH");
    expect(
      c7?.zones.map((zone) => `${zone.zone}=${String(zone.spacing)}`),
      "a column tied at one spacing end and middle still states two zones — the drawing wrote both figures",
    ).toEqual(["main=null", "ties-end=100", "ties-mid=100"]);
  });

  test("every variant and every zone cites the cell it was read from", async () => {
    const { families, keys } = await readingOf();

    for (const family of families) {
      expect(family.sourceKeys.length, `${family.family} cites the mark cell that names it`).toBeGreaterThanOrEqual(1);
      for (const variant of family.variants) {
        expect(variant.sourceKeys.length, `${family.family} ${variant.variantKey} cites the cell it was read from — the store's belt refuses less`).toBe(3);
        for (const zone of variant.zones) {
          expect(zone.sourceKeys, `${family.family} ${variant.variantKey} ${zone.zone} cites the cell the zone was read out of`).toEqual(variant.sourceKeys);
        }
      }
    }
    expect(
      variantOf(families.find((family) => family.family === "C2"), "3RD-4TH")?.sourceKeys,
      "and those keys are the three texts of that band's own cell, in the order the page reads them",
    ).toEqual([keys.get("section:C2:1"), keys.get("bars:C2:1"), keys.get("ties:C2:1")]);
  });

  test("with no declaration handed in, no tie spacing of the sheet has a unit — the numbers are the drawing's, the unit is nobody's", async () => {
    const { families } = await readingOf();

    const ties = families.flatMap((family) => family.variants.flatMap((variant) => variant.zones.filter((zone) => zone.spacing !== null)));
    expect(ties.length, "three marks, four bands, an end zone and a mid zone each").toBe(24);
    expect(new Set(ties.map((zone) => zone.spacingUnit)), "no cell and no band head states a unit (L-MEA-01)").toEqual(new Set([null]));
  });
});

describe("I-412: the stacked ties are read in the unit the drawing declares", () => {
  test("every tie zone of every band stands in the declared millimetres, citing the declaration beside its own cell; the main bars take no unit", async () => {
    const { families, keys } = await readingOf(DECLARED);

    const zones = families.flatMap((family) => family.variants.flatMap((variant) => variant.zones.map((zone) => ({ family: family.family, variant: variant.variantKey, zone }))));
    const ties = zones.filter((one) => one.zone.zone === "ties-end" || one.zone.zone === "ties-mid");
    expect(ties.length, "three marks, four bands, an end zone and a mid zone each").toBe(24);
    for (const { family, variant, zone } of ties) {
      expect(zone.spacingUnit, `${family} ${variant} ${zone.zone}: \`${zone.text}\` states no unit in the cell and none over the band, so S-01's is the one said`).toBe("mm");
      expect(zone.sourceKeys[zone.sourceKeys.length - 1], `${family} ${variant} ${zone.zone} cites the declaration its unit was read off (L-QTY-03)`).toBe(DECLARED.dimensionUnit.sourceKey);
    }
    for (const { family, variant, zone } of zones.filter((one) => one.zone.zone === "main")) {
      expect({ unit: zone.spacingUnit, cites: zone.sourceKeys }, `${family} ${variant}'s main bars state no spacing, so no unit is theirs and no note is cited`).toEqual({
        unit: null,
        cites: variantOf(families.find((one) => one.family === family), variant)?.sourceKeys.slice(0, 3),
      });
    }

    const gf = variantOf(families.find((family) => family.family === "C1"), "GF-2ND");
    expect(
      gf?.zones.map((zone) => ({ zone: zone.zone, spacing: zone.spacing, unit: zone.spacingUnit, cites: zone.sourceKeys })),
      "C1 over GF TO 2ND: the 100 and the 150 of `10Ø@100/150 (TIES)` are millimetres because S-01 says every dimension is, cited beside the band's own three texts",
    ).toEqual([
      { zone: "main", spacing: null, unit: null, cites: [keys.get("section:C1:0"), keys.get("bars:C1:0"), keys.get("ties:C1:0")] },
      { zone: "ties-end", spacing: 100, unit: "mm", cites: [keys.get("section:C1:0"), keys.get("bars:C1:0"), keys.get("ties:C1:0"), DECLARED.dimensionUnit.sourceKey] },
      { zone: "ties-mid", spacing: 150, unit: "mm", cites: [keys.get("section:C1:0"), keys.get("bars:C1:0"), keys.get("ties:C1:0"), DECLARED.dimensionUnit.sourceKey] },
    ]);
  });
});
