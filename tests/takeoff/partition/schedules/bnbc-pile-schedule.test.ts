// @vitest-environment node
/**
 * FND-1's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01) and put through the partition's pure stages — views, conventions, grid, schedules,
 * registry, placement — exactly as the rebuild runs them (R-TO-030). No database, no store, no model.
 *
 * What the drawing states, and what is graded here:
 *   · S-05's PILE SCHEDULE is titled on the sheet's PAPER beneath its window (`200A`); its one row is
 *     `P | 500 | 21336 | 4-20Ø + 3-20Ø | 10Ø @ 75/150 | 89` under `MARK | DIA (mm) | LENGTH (mm) |
 *     MAIN BARS | SPIRAL | NOS`. I-313 reads it top-down from its own model texts.
 *   · The row's mark is the bare prefix `P`, and S-04 numbers its 89 ⌀500 piles `P1`…`P89`. I-314
 *     types each numbered pile `P` — the sole pile row, NOS 89 = the 89 placed, ⌀500 = every ring.
 *   · I-315 reads the diameter and the length in the head's `(mm)`, cited to their cells.
 *   · S-06's PILE CAP SCHEDULE (`202D`) still defers: its header is one MTEXT the header reader
 *     cannot read yet (FND-2), and the footer that does read as a mark header has nothing under it.
 *
 * AND WHAT MAY NOT MOVE — pinned as the sha-256 of what the stages answered on the tree before FND-1
 * (HEAD 689b5d76), so a change that moves any of them fails here by name and re-baselines in its own
 * commit, naming its proof:
 *   · the five tables BNBC read before: 17DF, 18A0 (ROOF BEAM SCHEDULE), 1D2B (LINTEL & SUNSHADE),
 *     1E3D (BAR BENDING SCHEDULE), 9C6 (COLUMN SCHEDULE);
 *   · every family BNBC registered before, and every placement it placed — with only the 89 piles'
 *     `memberFamily` owed a change;
 *   · F-RCC6's whole placement-stage output — placements, runs, tables and families — byte for byte
 *     (the session-7 integrator's harness composition, whose digest is the brief's `a3c0c6e0…`).
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { BNBC_DXF, RCC6_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** The captions the two foundation schedules are titled by, on the sheets' paper (I-290). */
const PILE_SCHEDULE = "DXF_HANDLE:200A";
const PILE_CAP_SCHEDULE_VIEW = "SCHEDULE:DXF_HANDLE:202D";

/** The pile schedule's cells, by the handle the drawing gave each (S-05). */
const DIA_CELL = "DXF_HANDLE:4EE";
const LENGTH_CELL = "DXF_HANDLE:4EF";
const NOS_CELL = "DXF_HANDLE:4F2";

/** What the stages answered for each read table on the tree before FND-1 (HEAD 689b5d76). */
const TABLES_BEFORE: Readonly<Record<string, string>> = Object.freeze({
  "DXF_HANDLE:17DF": "b72b54922bb38d9e08816569d505efcb296688f49f99059b14a9bc4094a93c96",
  "DXF_HANDLE:18A0": "43510de74fdf9cc90b5f59c1cde54028d4177d9315dca38fc370235ad188d429",
  "DXF_HANDLE:1D2B": "2aaa1cdb09750c46a7ea99aa980ebaf334b4abd740b5ace5670d87201e96b2e1",
  "DXF_HANDLE:1E3D": "0503833681d0720e2edc88da71776d6ab3b2e827d9170a6fc73ad55015179815",
  "DXF_HANDLE:9C6": "5888f25349609245f1b98bfdaa320f2c15165556c315deaf27515bfee10d8436",
});

/** BNBC's registered families and placements before FND-1, with the piles' family then null. */
const BNBC_FAMILIES_BEFORE = "199bf88b1440a6aacec00775f7047ee7d9bc374f6c1e0c7a8157641390a1a3f6";
const BNBC_PLACEMENTS_BEFORE = "2cd2ce7b7b43f6bee2530fd9d687315cd90ad97458f27d69ada44b925cf67d43";

/** F-RCC6's `{ placements, runs, tables, families }` before FND-1 — the integrator's harness digest. */
const RCC6_STAGES_BEFORE = "a3c0c6e0f692e49074b9c1276dbc955f248bd5287740c6babc1275c08018a703";

const sha = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

let bnbcRead: Promise<StagesRead> | undefined;
let rcc6Read: Promise<StagesRead> | undefined;

/** Each drawing is read ONCE for the whole suite — lazily, so a refusal fails the case that needed it. */
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));
const rcc6 = (): Promise<StagesRead> => (rcc6Read ??= stagesOver(RCC6_DXF));

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

describe("FND-1 on F-RCC6-BNBC: the pile schedule is read, and the piles are typed by it", () => {
  test("I-313: S-05's paper-titled PILE SCHEDULE reads — its header, and its one row", async () => {
    const { reconstructed } = await bnbc();
    const table = reconstructed.tables.find((one) => one.scheduleKey === PILE_SCHEDULE);
    expect(table, `the view titled ${PILE_SCHEDULE} yields a table; the deferrals read ${JSON.stringify(reconstructed.deferrals)}`).toBeDefined();
    expect(table?.title, "titled by its paper caption").toBe("PILE SCHEDULE  SCALE 1:50");
    const row = (index: number): string[] => (table?.cells ?? []).filter((cell) => cell.rowIndex === index).map((cell) => cell.text);
    expect(row(0), "the header band — the note above it is no row").toEqual(["MARK", "DIA (mm)", "LENGTH (mm)", "MAIN BARS", "SPIRAL", "NOS"]);
    expect(row(1), "and the one row beneath it, verbatim").toEqual(["P", "500", "21336", "4-20%%C + 3-20%%C", "10%%C @ 75/150", "89"]);
    expect(row(2), "and nothing else").toEqual([]);
  }, BUDGET_MS);

  test("I-314, I-315: the row registers the family P, its diameter and length in millimetres cited to their cells, and its NOS as corroboration", async () => {
    const { registered } = await bnbc();
    const family = registered.families.find((one) => one.family === "P");
    expect(family?.scheduleKey, "the family P, from the pile schedule").toBe(PILE_SCHEDULE);
    expect(family?.variants.map((variant) => variant.dimensions), "⌀500 and 21336, as the schedule wrote them (AM-06 §2)").toEqual([
      [
        { dimension: "dia", text: "500", value: 500, unit: "mm", sourceKeys: [DIA_CELL] },
        { dimension: "length", text: "21336", value: 21336, unit: "mm", sourceKeys: [LENGTH_CELL] },
      ],
    ]);
    expect(family?.corroboration, "the NOS the plans are checked against — read, never billed").toEqual({ placed: 89, text: "89", sourceKeys: [NOS_CELL] });
  }, BUDGET_MS);

  test("I-314: all 89 piles of S-04 are typed P, each keeping its own number", async () => {
    const { placed } = await bnbc();
    const piles = placed.placements.filter((row) => row.elementType === "pile");
    expect(piles.length, "S-04 places its 89 ⌀500 piles").toBe(89);
    expect(new Set(piles.map((row) => row.memberFamily)), "every one of them typed by the bare prefix").toEqual(new Set(["P"]));
    expect(new Set(piles.map((row) => row.mark)), "and each keeps its own number as its mark — P1 to P89, none twice").toEqual(new Set(Array.from({ length: 89 }, (_unused, at) => `P${at + 1}`)));
  }, BUDGET_MS);

  test("S-06's PILE CAP SCHEDULE still defers — its MTEXT header is FND-2's", async () => {
    const { reconstructed } = await bnbc();
    expect(reconstructed.deferrals, "202D reads no table: the footer that reads as a mark header has nothing beneath it").toContainEqual({ viewKey: PILE_CAP_SCHEDULE_VIEW, reason: "SCHEDULE_NONE_RECONSTRUCTED" });
  }, BUDGET_MS);
});

describe("FND-1 moves nothing it was not asked to", () => {
  test("the five tables BNBC read before read byte for byte as they did", async () => {
    const { reconstructed } = await bnbc();
    const now = Object.fromEntries(Object.keys(TABLES_BEFORE).map((key) => [key, sha(reconstructed.tables.find((table) => table.scheduleKey === key) ?? null)]));
    expect(now, "each read table's own bytes, before and after").toEqual(TABLES_BEFORE);
  }, BUDGET_MS);

  test("every family and every placement BNBC stood on before stands byte for byte, bar the piles' family", async () => {
    const { registered, placed } = await bnbc();
    expect(sha(registered.families.filter((family) => family.family !== "P")), "the families registered before, P aside").toBe(BNBC_FAMILIES_BEFORE);
    expect(
      sha(placed.placements.map((row) => (row.elementType === "pile" ? { ...row, memberFamily: null } : row))),
      "the placements, key for key and point for point, with only the piles' family owed a change",
    ).toBe(BNBC_PLACEMENTS_BEFORE);
  }, BUDGET_MS);

  test("F-RCC6's whole placement-stage output is byte-identical", async () => {
    const { reconstructed, registered, placed } = await rcc6();
    expect(sha({ placements: placed.placements, runs: placed.runs, tables: reconstructed.tables, families: registered.families }), "the byte-frozen corpus reads exactly as it did (AM-01)").toBe(RCC6_STAGES_BEFORE);
  }, BUDGET_MS);
});
