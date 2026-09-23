// @vitest-environment node
/**
 * FND-1's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01) and put through the partition's pure stages — views, conventions, grid, schedules,
 * registry, placement — exactly as the rebuild runs them (R-TO-030). No database, no store, no model.
 *
 * What the drawing states, and what is graded here:
 *   · S-05's PILE SCHEDULE is titled on the sheet's PAPER beneath its window (`200A`); its one row is
 *     `P | 500 | 21336 | 4-20Ø + 3-20Ø | 10Ø @ 75/150 | 89` under `MARK | DIA (mm) | LENGTH (mm) |
 *     MAIN BARS | SPIRAL | NOS`. I-320 reads it top-down from its own model texts.
 *   · The row's mark is the bare prefix `P`, and S-04 numbers its 89 ⌀500 piles `P1`…`P89`. I-321
 *     types each numbered pile `P` — the sole pile row, NOS 89 = the 89 placed, ⌀500 = every ring.
 *   · I-322 reads the diameter and the length in the head's `(mm)`, cited to their cells.
 *   · S-06's PILE CAP SCHEDULE (`202D`) deferred here until FND-2: its header is one MTEXT the header
 *     reader could not read. FND-2 reads it (I-330), and this file now holds only that it reads.
 *
 * AND WHAT MAY NOT MOVE — pinned as the sha-256 of what the stages answered on the tree before FND-1
 * (HEAD 689b5d76), so a change that moves any of them fails here by name and re-baselines in its own
 * commit, naming its proof:
 *   · the five tables BNBC read before: 17DF, 18A0 (ROOF BEAM SCHEDULE), 1D2B (LINTEL & SUNSHADE),
 *     1E3D (BAR BENDING SCHEDULE), 9C6 (COLUMN SCHEDULE);
 *   · every family BNBC registered before, and every placement it placed — with only the 89 piles'
 *     `memberFamily` owed a change (re-pinned by FND-2 bar the pile caps it re-reads; see below);
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

/**
 * TEST_AMENDED (FND-2, I-330..I-333): the cap slice changes three things this ratchet pinned, each on
 * purpose and each accounted for here rather than re-pinned blind.
 *
 *   · 202D now READS (I-330): its header is MTEXT 639's second paragraph and its columns the rows'
 *     own alignment — so the case that held it deferred now holds it read (the rows themselves are
 *     graded in tests/takeoff/partition/placement/bnbc-pile-caps.test.ts).
 *   · The families: FND-1's pin (`199bf88b…`, every family bar P, pre-FND-1) held the two sectionless
 *     families S-26's BAR BENDING SCHEDULE minted, PC3 and S3; a bar schedule now registers none
 *     (I-331), and 202D registers PC1..PC5. So what may not move is every family bar P and bar the
 *     cap schedule's, pinned as it stood at e6db2f42 with the bar schedule's two taken away.
 *   · The placements: S-06 placed one pile cap per pile CIRCLE (89) and now places one per cap
 *     OUTLINE (26, I-333). So what may not move is every placement that is not a pile cap — the 89
 *     piles (typed P, FND-1) and the 27 columns — pinned as they stood at e6db2f42.
 */
const BNBC_FAMILIES_BAR_P_AND_CAPS_BEFORE = "7927658743d186ded9042d64728a08b3e0a24288f48958eae8eaeb9eb93e85e5";
const BNBC_PLACEMENTS_BAR_CAPS_BEFORE = "8742a15d0e8e0734cfa65e28d539397e883542d7e5b59d5dd453877a12eb5871";

/** The schedule the pile-cap families are registered from, since FND-2 (S-06's paper caption). */
const PILE_CAP_SCHEDULE = "DXF_HANDLE:202D";

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
  test("I-320: S-05's paper-titled PILE SCHEDULE reads — its header, and its one row", async () => {
    const { reconstructed } = await bnbc();
    const table = reconstructed.tables.find((one) => one.scheduleKey === PILE_SCHEDULE);
    expect(table, `the view titled ${PILE_SCHEDULE} yields a table; the deferrals read ${JSON.stringify(reconstructed.deferrals)}`).toBeDefined();
    expect(table?.title, "titled by its paper caption").toBe("PILE SCHEDULE  SCALE 1:50");
    const row = (index: number): string[] => (table?.cells ?? []).filter((cell) => cell.rowIndex === index).map((cell) => cell.text);
    expect(row(0), "the header band — the note above it is no row").toEqual(["MARK", "DIA (mm)", "LENGTH (mm)", "MAIN BARS", "SPIRAL", "NOS"]);
    expect(row(1), "and the one row beneath it, verbatim").toEqual(["P", "500", "21336", "4-20%%C + 3-20%%C", "10%%C @ 75/150", "89"]);
    expect(row(2), "and nothing else").toEqual([]);
  }, BUDGET_MS);

  test("I-321, I-322: the row registers the family P, its diameter and length in millimetres cited to their cells, and its NOS as corroboration", async () => {
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

  test("I-321: all 89 piles of S-04 are typed P, each keeping its own number", async () => {
    const { placed } = await bnbc();
    const piles = placed.placements.filter((row) => row.elementType === "pile");
    expect(piles.length, "S-04 places its 89 ⌀500 piles").toBe(89);
    expect(new Set(piles.map((row) => row.memberFamily)), "every one of them typed by the bare prefix").toEqual(new Set(["P"]));
    expect(new Set(piles.map((row) => row.mark)), "and each keeps its own number as its mark — P1 to P89, none twice").toEqual(new Set(Array.from({ length: 89 }, (_unused, at) => `P${at + 1}`)));
  }, BUDGET_MS);

  test("S-06's PILE CAP SCHEDULE reads since FND-2 — its MTEXT header is split into its lines (TEST_AMENDED, I-330)", async () => {
    const { reconstructed } = await bnbc();
    expect(reconstructed.deferrals, "202D no longer defers").not.toContainEqual({ viewKey: PILE_CAP_SCHEDULE_VIEW, reason: "SCHEDULE_NONE_RECONSTRUCTED" });
    expect(reconstructed.tables.map((table) => table.scheduleKey), "it yields its table, keyed by its paper caption").toContain(PILE_CAP_SCHEDULE);
  }, BUDGET_MS);
});

describe("FND-1 moves nothing it was not asked to", () => {
  test("the five tables BNBC read before read byte for byte as they did", async () => {
    const { reconstructed } = await bnbc();
    const now = Object.fromEntries(Object.keys(TABLES_BEFORE).map((key) => [key, sha(reconstructed.tables.find((table) => table.scheduleKey === key) ?? null)]));
    expect(now, "each read table's own bytes, before and after").toEqual(TABLES_BEFORE);
  }, BUDGET_MS);

  test("every family and every placement BNBC stood on before stands byte for byte, bar what FND-2 re-read (TEST_AMENDED)", async () => {
    const { registered, placed } = await bnbc();
    expect(
      sha(registered.families.filter((family) => family.family !== "P" && family.scheduleKey !== PILE_CAP_SCHEDULE)),
      "the families registered before, P and the cap schedule's aside — which is FND-1's roster less the two a bar schedule minted",
    ).toBe(BNBC_FAMILIES_BAR_P_AND_CAPS_BEFORE);
    expect(
      sha(placed.placements.filter((row) => row.elementType !== "pile_cap")),
      "every placement that is not a pile cap — the 89 piles and the 27 columns — key for key and point for point",
    ).toBe(BNBC_PLACEMENTS_BAR_CAPS_BEFORE);
  }, BUDGET_MS);

  test("F-RCC6's whole placement-stage output is byte-identical", async () => {
    const { reconstructed, registered, placed } = await rcc6();
    expect(sha({ placements: placed.placements, runs: placed.runs, tables: reconstructed.tables, families: registered.families }), "the byte-frozen corpus reads exactly as it did (AM-01)").toBe(RCC6_STAGES_BEFORE);
  }, BUDGET_MS);
});
