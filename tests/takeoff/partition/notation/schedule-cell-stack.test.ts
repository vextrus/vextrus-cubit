/**
 * A schedule cell carrying a stacked fraction, read the whole way the product reads one (Interpretation
 * I-458, T-NOT-FTIN-STACK): a ties cell an office types into an MTEXT, `10%%C @ 5½" c/c` with the
 * half inch stacked, cut into its lines by the reconstruction and read into a member's ties by the
 * registry. Core's stripper once deleted the stack, so the cell read five inches: every tie of every
 * column under it counted at 5" where the drawing says 5½" — one tie in eleven that was never drawn.
 *
 * The table is drawn HERE at the shape a column schedule takes, never read out of a fixture (B-19).
 * Nothing here opens a store, a clock or a model.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { parseZonedSpacing } from "@/modules/takeoff/partition/notation";
import { reconstructSchedules, type ScheduleTable } from "@/modules/takeoff/partition/schedules/reconstruct";
import { registerMemberTypes, type MemberFamily } from "@/modules/takeoff/partition/schedules/registry";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";

const VIEW_KEY = "SCHEDULE:1";

/** One text of the drawing: what it says, where it stands, and whether it is an MTEXT. */
function text(key: string, said: string, x: number, y: number, type: "TEXT" | "MTEXT" = "TEXT"): Record<string, unknown> {
  return { key, type, space: "Model", layer: "S-ANNO", colour: { rgb: [0, 0, 0], source: "explicit" }, text: said, height: 1, points: [[x, y]] };
}

/** The ties cell as the office draws it: aligned, the half inch stacked in a smaller height group. */
const STACKED_TIES = "\\A1;10%%C @ 5{\\H0.7x;\\S1/2;}\" c/c";

const CAPTION = text("e:1", "COLUMN SCHEDULE", 0, 100);
const DRAWN = [
  CAPTION,
  text("e:2", "MARK", 0, 90),
  text("e:3", "SIZE", 100, 90),
  text("e:4", "MAIN BARS", 200, 90),
  text("e:5", "TIES", 300, 90),
  text("e:6", "C1", 0, 80),
  text("e:7", "12\"x18\"", 100, 80),
  text("e:8", "8-16%%C", 200, 80),
  text("e:9", STACKED_TIES, 300, 80, "MTEXT"),
];

/** The one table the drawn schedule reconstructs to, read through the shipped stage. */
function reconstructed(): ScheduleTable {
  const answer = reconstructSchedules({
    graph: { entities: DRAWN } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: "e:1" } as PartitionedView],
    assignments: new Map(DRAWN.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
  expect(answer.tables.length, "the drawn schedule reconstructs to one table").toBe(1);
  return answer.tables[0] as ScheduleTable;
}

/** The one family the registry minted for a mark. */
function familyOf(tables: readonly ScheduleTable[], mark: string): MemberFamily {
  const held = registerMemberTypes(tables).families.filter((family) => family.family === mark);
  expect(held.length, `one family stands for ${mark}`).toBe(1);
  return held[0] as MemberFamily;
}

describe("I-458: a stacked fraction in a schedule cell is the number the drawing states", () => {
  test("the reconstruction keeps the half inch in the cell's line, citing the MTEXT it was read from", () => {
    const cell = reconstructed().cells.find((one) => one.sourceKeys.includes("e:9"));
    expect(cell?.text, "the codes that say how the cell is drawn go; the stack stays as ` 1/2`, and the `%%C` stays as the drawing wrote it").toBe("10%%C @ 5 1/2\" c/c");
  });

  test("the registry reads the column's ties at 5½\" centres, never at 5\"", () => {
    const variant = familyOf([reconstructed()], "C1").variants[0];
    const ties = variant?.zones.find((zone) => zone.zone === "ties");
    expect(
      { spacing: ties?.spacing, unit: ties?.spacingUnit, bar: ties?.spacingBar, keys: ties?.sourceKeys },
      "5.5 in, in the unit the cell wrote, off the 10 mm bar, cited to the MTEXT — 5 would count a tie in eleven the drawing never drew",
    ).toEqual({ spacing: 5.5, unit: "in", bar: 10, keys: ["e:9"] });
    expect(variant?.sectionWidth, "and the section beside it still reads").toBe(12);
  });

  test("a cell stored with its codes still on is read through the same stripper by the registry", () => {
    const table: ScheduleTable = {
      viewKey: VIEW_KEY,
      scheduleKey: "e:1",
      title: "COLUMN SCHEDULE",
      pitch: 10,
      columns: [0, 100],
      cells: [
        { rowIndex: 0, columnIndex: 0, text: "MARK", sourceKeys: ["h:0"] },
        { rowIndex: 0, columnIndex: 1, text: "TIES", sourceKeys: ["h:1"] },
        { rowIndex: 1, columnIndex: 0, text: "{\\fArial|b0|i0|c0|p34;C-2}", sourceKeys: ["r:0"] },
        { rowIndex: 1, columnIndex: 1, text: STACKED_TIES, sourceKeys: ["r:1"] },
      ],
      unplaced: [],
    };
    const family = familyOf([table], "C2");
    expect(family.markText, "the mark cell is kept verbatim beside the family it names (L-CAD-03)").toBe("{\\fArial|b0|i0|c0|p34;C-2}");
    expect(family.variants[0]?.zones.find((zone) => zone.zone === "ties")?.spacing, "and the ties read 5½\"").toBe(5.5);
  });

  test("a two-zone ties cell with a stacked half inch at the ends reads 4½\" and 6\", the fraction's bar never a zone's", () => {
    const zoned = "\\A1;10%%C @ 4{\\H0.7x;\\S1/2;}\"/6\" c/c";
    expect(parseZonedSpacing(zoned), "the stack's bar is no zone separator: read at it, the cell was three parts and read nothing").toEqual([
      { zone: "ties-end", bar: 10, spacing: 4.5, unit: "in" },
      { zone: "ties-mid", bar: 10, spacing: 6, unit: "in" },
    ]);
    const table: ScheduleTable = {
      viewKey: VIEW_KEY,
      scheduleKey: "e:1",
      title: "COLUMN SCHEDULE",
      pitch: 10,
      columns: [0, 100],
      cells: [
        { rowIndex: 0, columnIndex: 0, text: "MARK", sourceKeys: ["h:0"] },
        { rowIndex: 0, columnIndex: 1, text: "GF TO 2ND", sourceKeys: ["h:1"] },
        { rowIndex: 1, columnIndex: 0, text: "C3", sourceKeys: ["r:0"] },
        { rowIndex: 1, columnIndex: 1, text: `12"X18"+8-16%%C+${zoned}`, sourceKeys: ["r:1"] },
      ],
      unplaced: [],
    };
    const zones = familyOf([table], "C3").variants[0]?.zones ?? [];
    expect(
      zones.map((zone) => [zone.zone, zone.spacing, zone.spacingUnit]),
      "a band's cell stacking the section, the bars and the ties: the registry holds a row per zone, each at the centres the cell states",
    ).toEqual([
      ["main", null, null],
      ["ties-end", 4.5, "in"],
      ["ties-mid", 6, "in"],
    ]);
  });

  test("the canonical two-zone call still splits at its slash", () => {
    expect(parseZonedSpacing("10%%C@100/150 (TIES)")?.map((zone) => zone.spacing)).toEqual([100, 150]);
    expect(parseZonedSpacing("10%%C @ 6\"/4 1/2\" c/c")?.map((zone) => zone.spacing), "and a mixed number in the middle zone reads whole").toEqual([6, 4.5]);
  });
});
