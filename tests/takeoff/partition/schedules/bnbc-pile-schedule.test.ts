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
import type { DeclaredDimensionUnit } from "@/core/rulesets/methods/conventions/resolve";
import type { MemberFamily } from "@/modules/takeoff/partition/schedules/registry";
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
  // TEST_AMENDED (R0 Rev C, K11 + D-S26, W-27): S-26's PC3 rows (1DC1..1DE4) regenerate at the
  // drawn 2" cap cover and T-BBS-TOTAL's printed sum is re-seeded (1E40: 490.081 → 500.938); every
  // other cell reads as it did. Rev B's bytes: 0503833681d0720e2edc88da71776d6ab3b2e827d9170a6fc73ad55015179815.
  "DXF_HANDLE:1E3D": "665de6198111a9bc452ab085b9d53eabbd889caae26b357c026faea4b3af279a",
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

/**
 * TEST_AMENDED (R0 Rev C): what Rev C adds is set aside and graded by name, so every byte Rev B's
 * families and placements stood on is still held to the digests above, unmoved.
 *   · W-47: the three SLAB PANEL SCHEDULEs (S-19 `26CF`, S-20 `26D1`, S-21 `26D3`) register 43 slab
 *     families — 13, 12 and 18 — appended after the families before them.
 *   · W-44: F1's mark (`22AA`) in its own ring `638` on S-06 places one footing.
 *   · W-49: the stair-roof layout (`2157`) is gridded, and places its two C4 stubs (`2382`, `2385`).
 */
const REV_C_SCHEDULES: Readonly<Record<string, number>> = Object.freeze({ "DXF_HANDLE:26CF": 13, "DXF_HANDLE:26D1": 12, "DXF_HANDLE:26D3": 18 });
const REV_C_PLACEMENTS: readonly string[] = Object.freeze([
  "footing F1 DXF_HANDLE:638 DXF_HANDLE:22AA",
  "column C4 DXF_HANDLE:2382 DXF_HANDLE:2384",
  "column C4 DXF_HANDLE:2385 DXF_HANDLE:2387",
]);
const REV_C_PLACEMENT_VIEWS: readonly string[] = Object.freeze(["v:LAYOUT_PLAN:DXF_HANDLE:202C", "v:LAYOUT_PLAN:DXF_HANDLE:2157"]);
const revCPlacement = (row: { readonly viewKey: string; readonly elementType: string; readonly mark: string; readonly outlineKey: string; readonly markKey: string }): boolean =>
  REV_C_PLACEMENT_VIEWS.includes(row.viewKey) && REV_C_PLACEMENTS.includes(`${row.elementType} ${row.mark} ${row.outlineKey} ${row.markKey}`);

/** The schedule the pile-cap families are registered from, since FND-2 (S-06's paper caption). */
const PILE_CAP_SCHEDULE = "DXF_HANDLE:202D";

/**
 * TEST_AMENDED (FRM-2, I-343/I-344): the beam slice adds two things this ratchet's filters took in, each
 * on purpose and each graded in tests/takeoff/partition/placement/bnbc-beam-sections.test.ts rather
 * than re-pinned blind here. S-16's and S-17's long-section sheets register 106 beam families (I-343),
 * keyed by the two sheets' own views; and the beam layouts now place their beams (I-344). So what may
 * not move is every family bar P, the caps' and the strips' — the same bytes as before — and every
 * placement that is neither a pile cap nor a beam: the 89 piles and the 27 columns, unchanged.
 */
const STRIP_SHEETS: readonly string[] = Object.freeze(["DXF_HANDLE:218E", "DXF_HANDLE:2173"]);
/**
 * TEST_AMENDED (GB-READ, s-schedules I-673): S-09's five long sections `GB1 LONG SECTION` …
 * `GB5 LONG SECTION` label their strips with a grade-beam mark and its section, and a grade beam now
 * names a class — so each registers its family (GB1 300x600 … GB5 300x750). Set aside by name, like
 * the other strip sheets; every family registered before still reads its own bytes.
 */
const GRADE_BEAM_STRIPS: Readonly<Record<string, string>> = Object.freeze({
  "DXF_HANDLE:208E": "GB1",
  "DXF_HANDLE:208F": "GB2",
  "DXF_HANDLE:2090": "GB3",
  "DXF_HANDLE:2091": "GB4",
  "DXF_HANDLE:2092": "GB5",
});
const FRAMED: readonly string[] = Object.freeze(["beam", "tie_beam"]);

/**
 * TEST_AMENDED (R6-U, I-412): a rebar zone's spacing is now read in the unit the drawing declares,
 * nearest statement first — the cell's own mark, the head of its column, then the declaration, which
 * the zone then cites beside its cell (the reading I-302 gives a section). Neither drawing writes a
 * unit in a ties cell or over a ties column, so every tie-type zone of both moves `null` → `mm`, and
 * nothing else does. What may not move is therefore the families with that ONE reading taken back:
 * each zone whose last citation is the declaration is returned to the unitless zone citing only its
 * cell that it stood as before — and the zones taken back are counted by kind, so the reading moved
 * exactly the zones it was asked to, and any other byte that moves still fails here by name.
 */
function declaredSpacingUndone(families: readonly MemberFamily[], declared: DeclaredDimensionUnit): { families: MemberFamily[]; undone: Record<string, number> } {
  const undone: Record<string, number> = {};
  const back = families.map((family) => ({
    ...family,
    variants: family.variants.map((variant) => ({
      ...variant,
      zones: variant.zones.map((zone) => {
        const cited = zone.sourceKeys[zone.sourceKeys.length - 1];
        if (zone.spacing === null || cited !== declared.sourceKey || zone.spacingUnit !== declared.unit) return zone;
        undone[zone.zone] = (undone[zone.zone] ?? 0) + 1;
        return { ...zone, spacingUnit: null, sourceKeys: zone.sourceKeys.slice(0, -1) };
      }),
    })),
  }));
  return { families: back, undone };
}

/** The declarations each drawing states its unit in, as the conventions stage resolves them (I-302). */
const BNBC_DECLARED: DeclaredDimensionUnit = Object.freeze({ unit: "mm", sourceKey: "DXF_HANDLE:1F3E" });
const RCC6_DECLARED: DeclaredDimensionUnit = Object.freeze({ unit: "mm", sourceKey: "DXF_HANDLE:671" });

/** F-RCC6's `{ placements, runs, tables, families }` before FND-1 — the integrator's harness digest. */
const RCC6_STAGES_BEFORE = "a3c0c6e0f692e49074b9c1276dbc955f248bd5287740c6babc1275c08018a703";

/**
 * TEST_AMENDED (FRM4-AD, I-612): F-RCC6's foundation plan letters its tie beams on the perimeter
 * spans and draws the 28 interior spans end to end with them, unlettered; the chain rule names each by
 * the mark of the span it continues. What it adds is set aside BY NAME — the interior spans' first edge
 * lines — so every byte F-RCC6 read before is still held to the digest above, unmoved.
 */
const RCC6_TIE_BEAMS = "v:LAYOUT_PLAN:DXF_HANDLE:241";
const RCC6_CHAINED_TIE_BEAMS: readonly string[] = Object.freeze(
  ["1C6", "1C8", "1CA", "1CC", "1D0", "1D2", "1D4", "1D6", "1DA", "1DC", "1DE", "1E0", "1E4", "1E6", "1E8", "1EA", "20C", "20E", "210", "216", "218", "21A", "220", "222", "224", "22A", "22C", "22E"].map(
    (handle) => `DXF_HANDLE:${handle}`,
  ),
);

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

  test("every family and every placement BNBC stood on before stands byte for byte, bar what FND-2 re-read and R6-U's spacing unit (TEST_AMENDED)", async () => {
    const { registered, placed, evidence } = await bnbc();
    expect(evidence.declaredUnit, "S-01 clause 4 declares millimetres (I-302)").toEqual(BNBC_DECLARED);
    const added: Record<string, number> = {};
    for (const family of registered.families) if (family.scheduleKey in REV_C_SCHEDULES) added[family.scheduleKey] = (added[family.scheduleKey] ?? 0) + 1;
    expect(added, "Rev C's three slab panel schedules register their 43 families (W-47)").toEqual(REV_C_SCHEDULES);
    const graded = registered.families.filter((family) => family.scheduleKey in GRADE_BEAM_STRIPS);
    expect(Object.fromEntries(graded.map((family) => [family.scheduleKey, family.family])), "S-09's five grade-beam long sections, one family each").toEqual(GRADE_BEAM_STRIPS);
    const pinned = declaredSpacingUndone(
      registered.families.filter(
        (family) =>
          family.family !== "P" &&
          family.scheduleKey !== PILE_CAP_SCHEDULE &&
          !STRIP_SHEETS.includes(family.scheduleKey) &&
          !(family.scheduleKey in GRADE_BEAM_STRIPS) &&
          !(family.scheduleKey in REV_C_SCHEDULES),
      ),
      BNBC_DECLARED,
    );
    expect(
      pinned.undone,
      "R6-U moved S-11's 28 end-zone and 28 mid-zone tie spacings and the beam schedules' 51 (17DF's 26, 18A0's 25) into S-01's millimetres, and no other zone (I-412)",
    ).toEqual({ "ties-end": 28, "ties-mid": 28, ties: 51 });
    expect(
      sha(pinned.families),
      "the families registered before, P, the cap schedule's and the long-section sheets' aside — which is FND-1's roster less the two a bar schedule minted",
    ).toBe(BNBC_FAMILIES_BAR_P_AND_CAPS_BEFORE);
    const unframed = placed.placements.filter((row) => row.elementType !== "pile_cap" && !FRAMED.includes(row.elementType));
    expect(
      unframed.filter(revCPlacement).map((row) => `${row.elementType} ${row.mark} ${row.outlineKey} ${row.markKey}`),
      "Rev C's F1 footing (W-44) and the stair roof's two C4 stubs (W-49), and nothing else new",
    ).toEqual(REV_C_PLACEMENTS);
    expect(
      sha(unframed.filter((row) => !revCPlacement(row))),
      "every placement that is neither a pile cap nor a beam — the 89 piles and the 27 columns — key for key and point for point",
    ).toBe(BNBC_PLACEMENTS_BAR_CAPS_BEFORE);
  }, BUDGET_MS);

  test("F-RCC6's whole placement-stage output is byte-identical, bar R6-U's spacing unit (TEST_AMENDED)", async () => {
    const { reconstructed, registered, placed, evidence } = await rcc6();
    expect(evidence.declaredUnit, "F-RCC6's sheet line `ALL DIMENSIONS IN mm` (I-302)").toEqual(RCC6_DECLARED);
    const pinned = declaredSpacingUndone(registered.families, RCC6_DECLARED);
    expect(pinned.undone, "R6-U moved the twelve `T8 @ 150`-shaped tie spacings of its column and beam schedules into millimetres, and no other zone (I-412)").toEqual({ ties: 12 });
    const chained = placed.placements.filter((row) => row.viewKey === RCC6_TIE_BEAMS && row.elementType === "tie_beam" && RCC6_CHAINED_TIE_BEAMS.includes(row.outlineKey));
    expect(chained.map((row) => row.outlineKey).sort(), "the 28 interior tie-beam spans the chain names (I-612), and no others").toEqual([...RCC6_CHAINED_TIE_BEAMS].sort());
    const added = new Set(chained.map((row) => row.placementKey));
    expect(
      sha({ placements: placed.placements.filter((row) => !added.has(row.placementKey)), runs: (placed.runs ?? []).filter((run) => !added.has(run.placementKey)), tables: reconstructed.tables, families: pinned.families }),
      "the byte-frozen corpus reads exactly as it did (AM-01), the chained spans aside",
    ).toBe(RCC6_STAGES_BEFORE);
  }, BUDGET_MS);
});
