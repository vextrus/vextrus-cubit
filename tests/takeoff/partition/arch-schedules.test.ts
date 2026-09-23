// @vitest-environment node
/**
 * F-ARCH's schedules as a QS reads them (session 8, ARCH-3; s-schedules I-502..h): the
 * architect's set of the Bashundhara G+6 read by the SHIPPED `cad/` CLI and put through the
 * partition's pure stages exactly as the rebuild runs them, and graded against the generator's own
 * model (`fixtures/arch/model.json`) — never against what the product said before.
 *
 * What the drawing states, and what is graded here:
 *   · A-01 and A-02 each carry a DOOR & WINDOW SCHEDULE typed by sub-table (`SL. | MAIN DOOR |
 *     SIZE (W x H) | QUANTITY`), W x H wrapped over two lines of one centred MTEXT, `NN NOS`;
 *     every row the generator places on the group's level is read, its size in the inches it is
 *     lettered in, its floors from the caption, its printed quantity as a cited reading.
 *   · T-OPENING-NOS: the typical schedule prints D-2 as `08 NOS` against nine D2 tags on the typical
 *     plan — a DECLARED disagreement; every other row agrees with its plan.
 *   · A-03's WALL TYPES (T-WALL-TYPES-CAPTION) is a SCHEDULE, and its BW250 and BW125 carry their
 *     thickness, settled by the cell's own restatement; its ROOM FINISH SCHEDULE stands whole, every
 *     cell cited, and defers nothing.
 *
 * AND WHAT MAY NOT MOVE: F-RCC6 and F-RCC6-BNBC read by the same stages, pinned as the sha-256 of
 * what the schedules stage answered on the tree before ARCH-3 (HEAD 9ebdf29a).
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { REFUSALS } from "@/core/errors";
import type { MemberFamily, MemberVariant } from "@/modules/takeoff/partition/schedules/registry";
import { registerMemberTypes } from "@/modules/takeoff/partition/schedules/registry";
import { reconstructSchedules, type ScheduleCell, type ScheduleTable } from "@/modules/takeoff/partition/schedules/reconstruct";
import { normaliseMark } from "@/modules/takeoff/partition/notation";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { OPENING_GROUPS, archModel, archStages, authoredRows, trapKey } from "./support/arch-stages";
import { BNBC_DXF, RCC6_DXF, stagesOver, type StagesRead } from "./support/bnbc-stages";

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** Millimetres to the inch, exactly — the unit the architect letters every size in (DECISIONS.md A-02). */
const MM_PER_INCH = 25.4;

const sha = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** The table a SCHEDULE view of this caption yielded — the paper caption titles it, with its scale. */
function tableTitled(read: StagesRead, caption: string): ScheduleTable {
  const table = read.reconstructed.tables.find((one) => one.title.startsWith(`${caption}  SCALE`));
  if (table === undefined) throw new Error(`no table is titled ${caption}; the deferrals read ${JSON.stringify(read.reconstructed.deferrals)}`);
  return table;
}

/** The cells of one band of a table, by column. */
function rowOf(table: ScheduleTable, rowIndex: number): ScheduleCell[] {
  return table.cells.filter((cell) => cell.rowIndex === rowIndex).sort((left, right) => left.columnIndex - right.columnIndex);
}

/** The family a schedule registered for a mark. */
function familyOf(read: StagesRead, table: ScheduleTable, mark: string): MemberFamily | undefined {
  return read.registered.families.find((family) => family.scheduleKey === table.scheduleKey && family.family === mark);
}

/** The one variant a family carries. */
function onlyVariant(family: MemberFamily | undefined): MemberVariant {
  expect(family?.variants.length, `${family?.family ?? "the family"} carries one variant — its schedule's one run of floors`).toBe(1);
  return family?.variants[0] as MemberVariant;
}

describe("F-ARCH: the four schedule views read, WALL TYPES included (I-502, I-503)", () => {
  test(
    "each yields a table and none defers — the door schedules, the finish schedule and the wall types",
    async () => {
      const read = await archStages();
      expect(read.reconstructed.views, "A-01, A-02 and A-03 carry four SCHEDULE views — WALL TYPES among them (T-WALL-TYPES-CAPTION)").toBe(4);
      expect(read.reconstructed.deferrals, "every schedule view yields a table").toEqual([]);
      const titles = read.reconstructed.tables.map((table) => table.title.replace(/ {2}SCALE 1:\d+$/u, "")).sort();
      expect(titles).toEqual(["DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)", "DOOR & WINDOW SCHEDULE (GROUND FLOOR)", "ROOM FINISH SCHEDULE", "WALL TYPES"]);
      const walls = tableTitled(read, "WALL TYPES");
      expect(read.evidence.assignments.get(trapKey("T-WALL-TYPES-CAPTION")), "the WALL TYPES title stands in the view its table was read off").toBe(walls.viewKey);
      expect(read.registered.deferrals, "no view read contributed nothing: the finish schedule is a schedule of rooms (I-509)").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "every cell of every table cites the text it was read from, and that text stands in the table's own view (L-CAD-03)",
    async () => {
      const read = await archStages();
      const texts = new Map(read.graph.entities.map((entity) => [entity.key, entity.text ?? ""]));
      for (const table of read.reconstructed.tables) {
        for (const cell of table.cells) {
          expect(cell.sourceKeys.length, `${table.title} [${cell.rowIndex},${cell.columnIndex}] cites what it says`).toBeGreaterThan(0);
          for (const key of cell.sourceKeys) {
            expect(texts.get(key)?.trim(), `${key} is a text of the drawing`).toBeTruthy();
            expect(read.evidence.assignments.get(key), `${key} stands in ${table.title}'s view`).toBe(table.viewKey);
          }
        }
      }
    },
    BUDGET_MS,
  );
});

describe("F-ARCH: every opening row of the generator's model is read (I-503..f)", () => {
  test(
    "each group's schedule reads exactly the marks its level places, with the size, floors and printed quantity the generator authored — each cited",
    async () => {
      const read = await archStages();
      const model = archModel();
      for (const group of OPENING_GROUPS) {
        const table = tableTitled(read, group.caption);
        const rows = authoredRows(model, group);
        const read_ = read.registered.families.filter((family) => family.scheduleKey === table.scheduleKey);
        expect(read_.map((family) => family.family).sort(), `${group.caption} names every mark its level places, and nothing else`).toEqual(rows.map((row) => row.mark).sort());
        for (const row of rows) {
          const family = familyOf(read, table, row.mark);
          expect(family?.markText, `${row.mark} is spelled as the schedule spells it (T-MARK-SPELLING)`).toBe(row.spelled);
          const variant = onlyVariant(family);
          // The floors are the caption's (I-506), and the caption is cited beside the size cell.
          expect(variant.variantKey, `${row.mark} claims the floors ${group.caption} names`).toBe(group.variant);
          expect(variant.sourceKeys.at(-1), "the caption the floors were read at is cited").toBe(table.scheduleKey);
          // The size: the SIZE (W x H) cell of the mark's own row, wrapped lines run on (I-504).
          const markCell = table.cells.find((cell) => cell.sourceKeys.includes(family?.sourceKeys[0] ?? ""));
          const sizeCell = rowOf(table, markCell?.rowIndex ?? -1)[2];
          expect(variant.sourceKeys[0], `${row.mark}'s size is cited to its own row's size cell`).toBe(sizeCell?.sourceKeys[0]);
          expect(sizeCell?.sourceKeys, "the wrapped size is ONE text, cited once").toHaveLength(1);
          if (row.mark === "LD") {
            // The lift door is lettered in millimetres with no unit anywhere on the sheet: its figures
            // are the authored ones, and it keeps no unit rather than an assumed one (I-506).
            expect([variant.sectionWidth, variant.sectionDepth, variant.sectionUnit]).toEqual([row.widthMm, row.heightMm, null]);
          } else {
            expect(variant.sectionUnit, `${row.mark}'s size is read in the inches it is lettered in`).toBe("in");
            expect(Math.abs((variant.sectionWidth ?? 0) * MM_PER_INCH - row.widthMm), `${row.mark}'s width`).toBeLessThan(1e-6);
            expect(Math.abs((variant.sectionDepth ?? 0) * MM_PER_INCH - row.heightMm), `${row.mark}'s height`).toBeLessThan(1e-6);
          }
          // The printed quantity: a cited reading of the QUANTITY cell, never a member count (I-507).
          const quantityCell = rowOf(table, markCell?.rowIndex ?? -1)[3];
          expect(variant.printed?.printed, `${group.caption} prints ${row.printed} of ${row.mark}`).toBe(row.printed);
          expect(variant.printed?.sourceKeys, "cited to its own cell").toEqual(quantityCell?.sourceKeys);
          expect(variant.printed?.basis, "the basis is stated: one floor, or the note").toBe("per-floor");
        }
      }
    },
    BUDGET_MS,
  );

  test(
    "LD, the lift's landing door, is a family by the roster's word; the sub-table heads and group titles are rows of their own, never lines of a mark's row (I-503, I-505)",
    async () => {
      const read = await archStages();
      const typical = tableTitled(read, "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)");
      expect(familyOf(read, typical, "LD")?.markText).toBe("LD");
      const marks = typical.cells.filter((cell) => cell.columnIndex === 1).map((cell) => cell.text);
      expect(marks.filter((text) => text.includes("+")), "no mark cell carries its sub-table's head (`FIRE DOOR+FD-1`)").toEqual([]);
      expect(rowOf(typical, 0).map((cell) => cell.text), "the header is the first sub-table's, never the group title DOOR").toEqual(["SL.", "MAIN DOOR", "SIZE (W x H)", "QUANTITY"]);
    },
    BUDGET_MS,
  );

  test(
    "T-OPENING-NOS: the typical schedule prints D-2 as 08 against the typical plan's nine D2 tags — DECLARED, the cell and every tag cited; every other row agrees with its plan (I-507)",
    async () => {
      const read = await archStages();
      const model = archModel();
      const texts = new Map(read.graph.entities.map((entity) => [entity.key, entity.text ?? ""]));
      for (const group of OPENING_GROUPS) {
        const table = tableTitled(read, group.caption);
        const plan = read.evidence.views.find((view) => view.type === "LAYOUT_PLAN" && view.caption.startsWith(group.plan));
        for (const row of authoredRows(model, group)) {
          const printed = onlyVariant(familyOf(read, table, row.mark)).printed;
          expect(printed?.planKey, `${row.mark} is checked against ${group.plan}`).toBe(plan?.viewKey);
          expect(printed?.tagKeys.length, `${group.plan} tags every ${row.mark} the generator places`).toBe(row.placed);
          for (const key of printed?.tagKeys ?? []) {
            expect(normaliseMark(texts.get(key) ?? ""), `${key} is a tag of ${row.mark}`).toBe(row.mark);
            expect(read.evidence.assignments.get(key), `${key} stands on ${group.plan}`).toBe(plan?.viewKey);
          }
          const declared = row.printed === row.placed ? null : REFUSALS.OPENING_QUANTITY_DISAGREES.code;
          expect(printed?.refusal ?? null, `${group.caption}: ${row.mark} prints ${row.printed} against ${row.placed} tags`).toBe(declared);
        }
      }
      const typical = tableTitled(read, "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)");
      const d2 = onlyVariant(familyOf(read, typical, "D2")).printed;
      expect(d2?.refusal, "the trap itself").toBe("OPENING_QUANTITY_DISAGREES");
      expect([d2?.text, d2?.printed, d2?.tagKeys.length]).toEqual(["08 NOS", 8, 9]);
      expect(d2?.sourceKeys, "cited to the trap's own cell").toEqual([trapKey("T-OPENING-NOS")]);
      expect(d2?.basisKeys.map((key) => texts.get(key)), "the typical floors' basis is the schedule's own note").toEqual(["NOTE: QUANTITY PER FLOOR."]);
      const ground = tableTitled(read, "DOOR & WINDOW SCHEDULE (GROUND FLOOR)");
      expect(onlyVariant(familyOf(read, ground, "D2")).printed?.basisKeys, "the ground floor's basis is its caption, naming one floor").toEqual([ground.scheduleKey]);
    },
    BUDGET_MS,
  );
});

describe("F-ARCH: the wall types and the room finishes (I-508, I-509)", () => {
  test(
    "BW250 and BW125 carry the thickness the generator authors, in millimetres the cell's own restatement settles; RCC states none and names no family",
    async () => {
      const read = await archStages();
      const walls = tableTitled(read, "WALL TYPES");
      const families = read.registered.families.filter((family) => family.scheduleKey === walls.scheduleKey);
      const authored = archModel().wall_types;
      expect(families.map((family) => family.family)).toEqual(authored.filter((type) => type.t !== null).map((type) => type.mark));
      for (const type of authored) {
        const family = families.find((one) => one.family === type.mark);
        if (type.t === null) {
          expect(family, `${type.mark} points at the structural drawing and names no wall type here`).toBeUndefined();
          continue;
        }
        const thickness = onlyVariant(family).dimensions?.find((one) => one.dimension === "thickness");
        expect([thickness?.value, thickness?.unit], `${type.mark}'s thickness`).toEqual([Number(type.t), "mm"]);
        const cell = walls.cells.find((one) => one.sourceKeys[0] === thickness?.sourceKeys[0]);
        expect(cell?.columnIndex, "cited to its THICKNESS cell").toBe(rowOf(walls, 0).find((head) => head.text === "THICKNESS")?.columnIndex);
      }
      expect(walls.cells.filter((cell) => cell.rowIndex === authored.length).map((cell) => cell.text)[0], "RCC's row still stands in the table, read and cited").toBe("RCC");
    },
    BUDGET_MS,
  );

  test(
    "the ROOM FINISH SCHEDULE stands whole — every finish type's row, every face, as the generator wrote it — and names no member type",
    async () => {
      const read = await archStages();
      const finishes = tableTitled(read, "ROOM FINISH SCHEDULE");
      expect(rowOf(finishes, 0).map((cell) => cell.text)).toEqual(["ROOM", "FLOOR", "SKIRTING", "WALL", "DADO", "CEILING"]);
      const authored = Object.values(archModel().finish_types);
      authored.forEach((type, at) => {
        const said = rowOf(finishes, at + 1).map((cell) => cell.text);
        expect([said[0], said[1], said[3], said[5]], `the ${type.rooms} row`).toEqual([type.rooms, type.floor, type.wall ?? "-", type.ceiling ?? "-"]);
        expect(said[4], `the ${type.rooms} dado`).toBe(type.dado_spec ?? "-");
      });
      expect(finishes.cells.filter((cell) => cell.rowIndex > authored.length), "nothing beneath the last room group is read as a row").toEqual([]);
      expect(read.registered.families.filter((family) => family.scheduleKey === finishes.scheduleKey), "a schedule of rooms names no member type").toEqual([]);
    },
    BUDGET_MS,
  );
});

describe("an MTEXT stands where its attachment puts it (I-504)", () => {
  /**
   * A one-row sub-table, drawn the way F-ARCH draws a cell: each MTEXT centred in its cell. With a
   * single mark there is no row spacing to claim a stray line by (`rowsByMark` reads it band for
   * band), so where the wrapped size's second line stands decides whether the size is one cell.
   */
  function oneRow(sizeAttachment: number): Parameters<typeof reconstructSchedules>[0] {
    const at = (key: string, text: string, x: number, y: number, attachment: number | null, height = 120) => ({
      key: `DXF_HANDLE:${key}`,
      type: attachment === null ? "TEXT" : "MTEXT",
      space: "model",
      layer: "A-SCHED-TEXT",
      colour: { rgb: [0, 0, 0], source: "bylayer" },
      text,
      height,
      points: [[x, y]],
      ...(attachment === null ? {} : { attachment }),
    });
    const entities = [
      at("C0", "DOOR SCHEDULE", 0, 400, null, 180),
      at("H1", "SL.", 350, -760, 5),
      at("H2", "MAIN DOOR", 1450, -760, 5),
      at("H3", "SIZE (W x H)", 3150, -760, 5),
      at("H4", "QUANTITY", 4850, -760, 5),
      at("R1", "01.", 350, -1280, 5),
      at("R2", "D-1", 1450, -1280, 5),
      at("R3", "4'-0\"\\PX 7'-0\"", 3150, -1280, sizeAttachment),
      at("R4", "02 NOS", 4850, -1280, 5),
    ];
    const view = { viewKey: "SCHEDULE:DXF_HANDLE:C0", type: VIEW_TYPE.SCHEDULE, reason: null, caption: "DOOR SCHEDULE", anchorKey: "DXF_HANDLE:C0" };
    return {
      graph: { layouts: [{ name: "model", kind: "model", bbox: null, strays_rejected: 0 }], entities } as unknown as EntityGraph,
      views: [view],
      assignments: new Map(entities.map((entity) => [entity.key, view.viewKey])),
    };
  }

  test("a size wrapped in a cell-centred MTEXT is one cell, cited once; hung from its insertion its second line fell into a band of its own", () => {
    const [centred] = reconstructSchedules(oneRow(5)).tables;
    expect(centred?.cells.filter((cell) => cell.rowIndex === 1).map((cell) => cell.text)).toEqual(["01.", "D-1", "4'-0\" X 7'-0\"", "02 NOS"]);
    expect(centred?.cells.find((cell) => cell.rowIndex === 1 && cell.columnIndex === 2)?.sourceKeys).toEqual(["DXF_HANDLE:R3"]);
    expect(Math.max(...(centred?.cells ?? []).map((cell) => cell.rowIndex)), "the row is one band").toBe(1);
    const [hung] = reconstructSchedules(oneRow(1)).tables;
    expect(hung?.cells.filter((cell) => cell.rowIndex === 2).map((cell) => cell.text), "a top-attached block hangs from its insertion, as every block did before").toEqual(["X 7'-0\""]);
  });
});

describe("lines of one text: one statement wrapped, or statements stacked (I-504, AC-2)", () => {
  /**
   * A two-row column schedule whose C1 rebar cell is ONE MTEXT — the way a structural draughtsman
   * stacks a second group of bars under the first — and whose C2 cell is a plain text. Before the
   * lines of one text were run on, a stacked `4-20Ø` over `2-16Ø` was joined by the sign and read as
   * both groups; run on with a space it read as nothing, and C1 had no main bars.
   */
  function columnSchedule(rebar: string): Parameters<typeof reconstructSchedules>[0] {
    const at = (key: string, text: string, x: number, y: number, attachment: number | null, height = 120) => ({
      key: `DXF_HANDLE:${key}`,
      type: attachment === null ? "TEXT" : "MTEXT",
      space: "model",
      layer: "S-SCHED-TEXT",
      colour: { rgb: [0, 0, 0], source: "bylayer" },
      text,
      height,
      points: [[x, y]],
      ...(attachment === null ? {} : { attachment }),
    });
    const entities = [
      at("C0", "COLUMN SCHEDULE", 0, 400, null, 180),
      at("H1", "MARK", 350, -760, null),
      at("H2", "SIZE", 1450, -760, null),
      at("H3", "MAIN BARS", 3150, -760, null),
      at("H4", "TIES", 4850, -760, null),
      at("R1", "C1", 350, -1280, null),
      at("R2", "300x500", 1450, -1280, null),
      at("R3", rebar, 3150, -1280, 5),
      at("R4", "10%%C@150", 4850, -1280, null),
      at("S1", "C2", 350, -1800, null),
      at("S2", "300x300", 1450, -1800, null),
      at("S3", "4-16%%C", 3150, -1800, null),
      at("S4", "10%%C@150", 4850, -1800, null),
    ];
    const view = { viewKey: "SCHEDULE:DXF_HANDLE:C0", type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: "DXF_HANDLE:C0" };
    return {
      graph: { layouts: [{ name: "model", kind: "model", bbox: null, strays_rejected: 0 }], entities } as unknown as EntityGraph,
      views: [view],
      assignments: new Map(entities.map((entity) => [entity.key, view.viewKey])),
    };
  }

  function mainOfC1(rebar: string): { text: string | undefined; bars: unknown } {
    const { tables } = reconstructSchedules(columnSchedule(rebar));
    const c1 = registerMemberTypes(tables).families.find((family) => family.family === "C1");
    const main = onlyVariant(c1).zones?.find((zone) => zone.zone === "main");
    return { text: main?.text, bars: main?.bars };
  }

  test("two groups of bars stacked in one MTEXT are two statements, joined by the sign and read as both, the text cited once", () => {
    expect(mainOfC1("4-20%%C\\P2-16%%C")).toEqual({ text: "4-20%%C+2-16%%C", bars: [{ n: 4, diameterMm: 20 }, { n: 2, diameterMm: 16 }] });
    const { tables } = reconstructSchedules(columnSchedule("4-20%%C\\P2-16%%C"));
    expect(tables[0]?.cells.find((cell) => cell.rowIndex === 1 && cell.columnIndex === 2)?.sourceKeys).toEqual(["DXF_HANDLE:R3"]);
  });

  test("a line that says nothing by itself was wrapped: the text runs on, and a cell it leaves unread is refused rather than read in part", () => {
    expect(mainOfC1("4-20%%C\\P(MAIN)")).toEqual({ text: "4-20%%C (MAIN)", bars: null });
  });
});

describe("the reading of an opening schedule where F-ARCH is silent (I-506, I-507)", () => {
  /** A schedule over several floors, drawn as the reconstructor stores one: its header, then its rows. */
  function schedule(title: string, rows: readonly (readonly string[])[], unplaced: readonly string[] = []): ScheduleTable {
    return {
      viewKey: "SCHEDULE:DXF_HANDLE:A1",
      scheduleKey: "DXF_HANDLE:A1",
      title,
      pitch: 520,
      columns: [0, 1, 2, 3, 4],
      cells: rows.flatMap((row, rowIndex) => row.map((text, columnIndex) => ({ rowIndex, columnIndex, text, sourceKeys: [`DXF_HANDLE:${rowIndex}${columnIndex}`] }))),
      unplaced: unplaced.map((text, at) => ({ key: `DXF_HANDLE:N${at}`, text })),
    };
  }
  const HEAD = ["SL.", "WINDOW", "SIZE (W x H)", "SILL HT.", "QUANTITY"];
  const W1 = ["01.", "W-1", "3'-4\" X 4'-0\"", "3'-0\"", "06 NOS"];

  test("a SILL column is read as the sill; a schedule over several floors stating no basis is declared OPENING_QUANTITY_BASIS_UNSTATED", () => {
    const [family] = registerMemberTypes([schedule("DOOR & WINDOW SCHEDULE (2ND TO 4TH FLOOR)", [HEAD, W1])]).families;
    const variant = onlyVariant(family);
    expect(variant.variantKey).toBe("2ND-4TH");
    expect(variant.dimensions).toEqual([{ dimension: "sill", text: "3'-0\"", value: 36, unit: "in", sourceKeys: ["DXF_HANDLE:13"] }]);
    expect(variant.printed?.refusal).toBe("OPENING_QUANTITY_BASIS_UNSTATED");
    expect([variant.printed?.basis, variant.printed?.planKey, variant.printed?.tagKeys]).toEqual([null, null, []]);
  });

  test("a caption naming no floors states no basis either: declared OPENING_QUANTITY_BASIS_UNSTATED, under a message that claims no floors", () => {
    const [family] = registerMemberTypes([schedule("DOOR & WINDOW SCHEDULE", [HEAD, W1])]).families;
    const printed = onlyVariant(family).printed;
    expect([printed?.printed, printed?.basis, printed?.refusal, printed?.planKey]).toEqual([6, null, "OPENING_QUANTITY_BASIS_UNSTATED", null]);
    const message = REFUSALS.OPENING_QUANTITY_BASIS_UNSTATED.message;
    expect(message, "the caption named no floors, so the refusal may not say the schedule covers several").not.toMatch(/several floors|covers/i);
  });

  test("a note stating PER FLOOR states the basis, and with no plan handed in the reading stands unchecked", () => {
    const [family] = registerMemberTypes([schedule("DOOR & WINDOW SCHEDULE (2ND TO 4TH FLOOR)", [HEAD, W1], ["QUANTITY PER FLOOR"])]).families;
    const printed = onlyVariant(family).printed;
    expect([printed?.basis, printed?.basisKeys, printed?.refusal, printed?.planKey]).toEqual(["per-floor", ["DXF_HANDLE:N0"], null, null]);
  });

  test("a caption listing floors keys a variant per run it states (I-409), never the floors between", () => {
    const [family] = registerMemberTypes([schedule("DOOR & WINDOW SCHEDULE (2ND, 4TH & 6TH FLOOR)", [HEAD, W1])]).families;
    expect(family?.variants.map((variant) => variant.variantKey)).toEqual(["2ND-2ND", "4TH-4TH", "6TH-6TH"]);
  });

  test("a schedule headed MARK whose every row names an opening is a schedule of openings: its caption's floors and its printed quantity are read", () => {
    const [family] = registerMemberTypes([schedule("DOOR SCHEDULE (GF TO 6TH FLOOR)", [["MARK", "SIZE", "QTY"], ["D-1", "3'-0\" X 7'-0\"", "06 NOS"]])]).families;
    const variant = onlyVariant(family);
    expect(variant.variantKey, "the caption's floors, never the section column's head").toBe("GF-6TH");
    expect([variant.printed?.text, variant.printed?.printed, variant.printed?.refusal]).toEqual(["06 NOS", 6, "OPENING_QUANTITY_BASIS_UNSTATED"]);
  });

  test("one structural mark among the rows and a MARK-headed table is read as a member schedule", () => {
    const families = registerMemberTypes([schedule("SCHEDULE (GF TO 6TH FLOOR)", [["MARK", "SIZE", "QTY"], ["D-1", "3'-0\" X 7'-0\"", "06 NOS"], ["C1", "300x300", "4"]])]).families;
    expect(families.map((family) => [family.family, family.variants.map((variant) => variant.variantKey), family.variants.some((variant) => variant.printed !== undefined)])).toEqual([
      ["D1", ["SIZE"], false],
      ["C1", ["SIZE"], false],
    ]);
  });

  test("a structural schedule keeps its reading: no caption floors, no printed quantity, no sill", () => {
    const [family] = registerMemberTypes([schedule("COLUMN SCHEDULE (GF TO 6TH FLOOR)", [["MARK", "SIZE", "NOS", "SILL", "QUANTITY"], ["C1", "300x300", "4", "900", "4"]])]).families;
    const variant = onlyVariant(family);
    expect([variant.variantKey, variant.printed, variant.dimensions]).toEqual(["SIZE", undefined, undefined]);
  });
});

/**
 * The schedules stage of both structural fixtures as it stood on the tree before ARCH-3 (HEAD
 * 9ebdf29a): the tables reconstructed, the views that deferred, the families registered (the strips'
 * among them) and the registry's deferrals. ARCH-3 teaches the grammar an architect's words; not one
 * byte a structural drawing was read into may move with them.
 */
const BEFORE: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  [BNBC_DXF]: Object.freeze({
    tables: "a2b170da6d5397dd35773e26f945516df042a8240f8266375cd7c5c139d2e4fb",
    deferrals: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    families: "a31f2d13485688ba31c50d16e4e0146a3273158a7df4103d0fb609254ef681f2",
    registryDeferrals: "6fe9780ac8c224bb5b6e1957bcaf9a9cbeb5f4adee1daf591b08036fc68fbf7e",
  }),
  [RCC6_DXF]: Object.freeze({
    tables: "71609e4ea18acbca5b4490dbaf4c41ba3b3e57a336c701bf91bc418e38f82eb2",
    deferrals: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    families: "abd767522d2196afd1243c87b502e29cb67c09d39757fe29b80e128d69e74e41",
    registryDeferrals: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  }),
});

describe("what may not move: the structural fixtures' schedules, byte for byte", () => {
  test.each([BNBC_DXF, RCC6_DXF])(
    "%s — its tables, deferrals, families and registry deferrals are the bytes they were",
    async (drawing) => {
      const read = await stagesOver(drawing);
      const now = {
        tables: sha(read.reconstructed.tables),
        deferrals: sha(read.reconstructed.deferrals),
        families: sha(read.registered.families),
        registryDeferrals: sha(read.registered.deferrals),
      };
      expect(now).toEqual(BEFORE[drawing]);
    },
    BUDGET_MS,
  );
});
