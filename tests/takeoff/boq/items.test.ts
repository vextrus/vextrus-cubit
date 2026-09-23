/**
 * BOQ-SHAPE — the draft in the shape the owner ruled (session 8, Q3; s-boq I-528, I-529):
 * one ITEM per description at one level band, its figure the register's own sum of its member lines
 * rounded ONCE; the member lines behind it as its details of measurement; and no quantity added
 * across descriptions.
 *
 * The rounding proof runs on the F-RCC6-BNBC campaign's own 208 column-concrete figures, as the
 * register published them (J-000's read-back, session 8): their exact sum is 93.892896…, which a
 * document rounds once to 93.893 — where a sum of the lines each rounded first came to 93.904, a
 * page that disagreed with the Trace in the second decimal. Nothing here opens a database and
 * nothing measures time (AM-10 §3).
 */
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { BOQ_DRAFT_KIND } from "@/core/documents/kinds/boq-draft";
import { editionSourceOf } from "@/core/identity";
import { boqDraftPayloadOf, itemQuantityOf, type BoqReading, type BoqReadingLine } from "@/modules/takeoff/boq/emission";
import { dimensionsOf, itemDescriptionOf } from "@/modules/takeoff/boq/items";
import { numberItems } from "@/modules/takeoff/boq/numbering";

/**
 * The 208 column-concrete figures of the BNBC campaign, as `(value, how many lines state it)` — read
 * back from the register (`quantity_lines`, class `column`, kind `rcc.concrete`, every line COMPLETE).
 */
const BNBC_COLUMN_CONCRETE: readonly (readonly [string, number])[] = [
  ["0.09144", 7],
  ["0.09695269088243460913211406", 1],
  ["0.097536", 3],
  ["0.109728", 8],
  ["0.164592", 7],
  ["0.27432", 6],
  ["0.32004", 14],
  ["0.36576", 30],
  ["0.37338", 6],
  ["0.41148", 6],
  ["0.4572", 30],
  ["0.48006", 14],
  ["0.48768", 6],
  ["0.50292", 7],
  ["0.53323979985339035022662733", 1],
  ["0.536448", 3],
  ["0.54864", 16],
  ["0.603504", 8],
  ["0.6096", 14],
  ["0.82296", 14],
  ["0.905256", 7],
];

/** Every one of the 208 figures, one per line. */
const FIGURES: readonly string[] = BNBC_COLUMN_CONCRETE.flatMap(([value, count]) => Array.from({ length: count }, () => value));

/** The stack the readings stand on: a foundation level below the plinth, the ground floor, one above. */
const LEVELS = [
  { levelId: "l-fdn", ordinal: -1, label: "FDN" },
  { levelId: "l-gf", ordinal: 0, label: "GF" },
  { levelId: "l-1f", ordinal: 1, label: "1F" },
];

/** One published line, as the register hands it over. */
function line(overrides: Partial<BoqReadingLine> & Pick<BoqReadingLine, "lineId" | "objectKey" | "class" | "kind" | "unit">): BoqReadingLine {
  return { levelId: "l-gf", value: "1.000", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: "COMPLETE", ...overrides };
}

function reading(lines: readonly BoqReadingLine[]): BoqReading {
  return { project: "Bashundhara G+6", campaignId: "c-1", setRevisionId: "r-1", levels: LEVELS, lines, coverageComplete: true };
}

/** Every item a payload states, with its group's class and kind beside it. */
function itemsOf(payload: ReturnType<typeof boqDraftPayloadOf>) {
  return payload.sections.flatMap((section) => section.groups.flatMap((group) => group.items.map((item) => ({ bill: section.bill, class: group.class, kind: group.kind, item }))));
}

describe("I-528: an item is the register's sum of its members, rounded once", () => {
  test("the BNBC column concrete rounds once to 93.893 — not the 93.904 a sum of rounded lines comes to", () => {
    expect(FIGURES.length, "the campaign's 208 column-concrete lines").toBe(208);
    const roundedFirst = FIGURES.reduce((sum, value) => sum.plus(new Decimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_EVEN)), new Decimal(0));
    expect(roundedFirst.toFixed(3), "the old page's arithmetic: every line rounded, then added").toBe("93.904");
    expect(itemQuantityOf(FIGURES, "rcc.concrete"), "the register's exact sum, rounded ONCE — the figure the Trace ties to").toBe("93.893");
  });

  test("the emission states one item over 208 members at one band, carrying 93.893 and all 208 lines behind it", () => {
    // Every member on the ground floor of a section with no floor rate would be one item; here they
    // stand on one storey of the superstructure, which is one band.
    const lines = FIGURES.map((value, at) => line({ lineId: `l-${at}`, objectKey: `C${at}@GF`, class: "column", kind: "rcc.concrete", unit: "m3", value }));
    const payload = boqDraftPayloadOf(reading(lines));
    const items = itemsOf(payload);
    expect(items.length, "one description at one band is one item").toBe(1);
    expect(items[0]?.item.quantity, "its figure is the members' register sum, rounded once").toBe("93.893");
    expect(items[0]?.item.lines.length, "and all 208 member lines stand behind it as its details of measurement").toBe(208);
    expect(BOQ_DRAFT_KIND.payloadSchema.safeParse(payload).success, "the kind's strict schema reads what the emission writes").toBe(true);
  });

  test("an item none of whose members states a figure states none; a partly measured one sums what was measured", () => {
    expect(itemQuantityOf([null, null], "rcc.rebar"), "the sum of nothing is not a zero anybody measured (L-QTY-04)").toBeNull();
    expect(itemQuantityOf(["0.39125", null], "pcc.blinding"), "the measured member's figure, rounded once").toBe("0.391");
  });
});

describe("I-528: the level band is the storey where PWD's floor rate applies", () => {
  const lines = [
    // Column concrete on two storeys above the plinth: one item per floor.
    line({ lineId: "c-gf-1", objectKey: "C1@GF", class: "column", kind: "rcc.concrete", unit: "m3", levelId: "l-gf", value: "0.4572" }),
    line({ lineId: "c-gf-2", objectKey: "C2@GF", class: "column", kind: "rcc.concrete", unit: "m3", levelId: "l-gf", value: "0.4572" }),
    line({ lineId: "c-1f-1", objectKey: "C1@1F", class: "column", kind: "rcc.concrete", unit: "m3", levelId: "l-1f", value: "0.36576" }),
    // A pile cap on a sub-plinth storey and one on the foundation slot: below the plinth there is no
    // floor rate, so both are one item.
    line({ lineId: "p-1", objectKey: "PC1@FDN", class: "pile_cap", kind: "rcc.concrete", unit: "m3", levelId: "l-fdn", value: "2.590" }),
    line({ lineId: "p-2", objectKey: "PC2@FOUNDATION", class: "pile_cap", kind: "rcc.concrete", unit: "m3", levelId: null, slot: "FOUNDATION", value: "4.225" }),
  ];

  test("above the plinth an item is per storey; below it the item is one band whatever storey its members stand on", () => {
    const items = itemsOf(boqDraftPayloadOf(reading(lines)));
    const columns = items.filter((held) => held.class === "column");
    expect(columns.map((held) => [held.bill, held.item.level, held.item.quantity]), "column concrete is priced floor by floor above the plinth").toEqual([
      ["SUPERSTRUCTURE", "GF", "0.914"],
      ["SUPERSTRUCTURE", "1F", "0.366"],
    ]);
    const caps = items.filter((held) => held.class === "pile_cap");
    expect(caps.length, "the substructure's caps are one item").toBe(1);
    expect(caps[0]?.item.quantity, "summed across the storey and the slot their members stand in").toBe("6.815");
    expect(caps[0]?.item.level, "its Level cell names the storey its members stand on").toBe("FDN");
  });

  test("items are numbered up the building, one number per item and none per member line", () => {
    const payload = boqDraftPayloadOf(reading(lines));
    const numbers = numberItems(payload.sections);
    const items = itemsOf(payload);
    expect(numbers.size, "one number per item").toBe(items.length);
    const columns = items.filter((held) => held.class === "column").map((held) => numbers.get(held.item.key));
    expect(columns, "GF before 1F inside one group").toEqual(["2.1.1", "2.1.2"]);
    for (const held of items) for (const member of held.item.lines) expect(numbers.has(member.lineId), `${member.lineId} is a member line and carries no number`).toBe(false);
  });
});

describe("I-529: no quantity subtotal crosses descriptions", () => {
  test("a group and a section state no quantity of their own, and the schema refuses one handed in", () => {
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "a", objectKey: "PC1", class: "pile_cap", kind: "rcc.concrete", unit: "m3", levelId: "l-fdn", value: "2.590" }),
        line({ lineId: "b", objectKey: "P1", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.189" }),
      ]),
    );
    const section = payload.sections[0] as NonNullable<(typeof payload.sections)[number]>;
    expect("subtotals" in section, "a section carries no quantity foot: its groups hold unlike descriptions").toBe(false);
    for (const group of section.groups) expect("subtotals" in group, "a group carries no quantity either").toBe(false);

    const stale = { ...payload, sections: payload.sections.map((held) => ({ ...held, subtotals: [{ unit: "m3", value: "6.779" }] })) };
    expect(BOQ_DRAFT_KIND.payloadSchema.safeParse(stale).success, "a payload that carries a foot across descriptions is refused whole").toBe(false);
  });

  test("the document prints no foot: no 'Measured-scope subtotal', and every figure on it is an item's", () => {
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "a", objectKey: "PC1", class: "pile_cap", kind: "rcc.concrete", unit: "m3", levelId: "l-fdn", value: "2.590" }),
        line({ lineId: "b", objectKey: "P1", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.189" }),
      ]),
    );
    const page = BOQ_DRAFT_KIND.present(payload) as { sections: { groups: Record<string, unknown>[] }[] } & Record<string, unknown>;
    expect(JSON.stringify(page), "the label of a foot across descriptions is gone").not.toContain("Measured-scope subtotal");
    for (const group of page.sections.flatMap((section) => section.groups)) {
      expect(Object.keys(group).sort(), "a group row carries its heading and its items, and no figure").toEqual(["heading", "items"]);
    }
  });
});

describe("I-530: the front page states the project in words, and the issue day only on an issue", () => {
  const front = { client: "Padma Homes Ltd.", site: null, drawingSet: "Golden Path Set, revision 1, pinned 23 Sep 2026", drawings: ["rcc6-bnbc.dxf"], issued: null };
  const rowsOf = (payload: unknown) => (BOQ_DRAFT_KIND.present(payload) as { front: { rows: { label: string; value: string }[] }; footer: string });

  test("an unissued reading names no issue day; an issue names its day on the front page and in every foot", () => {
    const base = { ...reading([line({ lineId: "a", objectKey: "C1", class: "column", kind: "rcc.concrete", unit: "m3" })]), front };
    const read = rowsOf(boqDraftPayloadOf(base));
    expect(read.front.rows.map((row) => row.label), "a reading is not an issue: no Issued row").not.toContain("Issued");
    expect(read.front.rows.find((row) => row.label === "Site")?.value, "a question the project holds no answer to says so").toBe("Not stated");
    expect(read.front.rows.find((row) => row.label === "Sections")?.value, "the taxonomy by its edition, in words — never its id").toMatch(/^By the taxonomy of \d{2} [A-Z][a-z]{2} \d{4}$/u);
    expect(read.footer, "the foot names the project and the draft").toBe("Bashundhara G+6 · Draft BOQ — unpriced");

    const issued = rowsOf(boqDraftPayloadOf({ ...base, front: { ...front, issued: "24 Sep 2026" } }));
    expect(issued.front.rows.find((row) => row.label === "Issued")?.value, "the issue states its day").toBe("24 Sep 2026");
    expect(issued.footer, "and every page's foot carries it").toBe("Bashundhara G+6 · Draft BOQ — unpriced · issued 24 Sep 2026");
    for (const row of issued.front.rows) expect(row.value, `${row.label} is words, never an id`).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
  });
});

describe("I-528: a description a rate book accepts, from what the register states", () => {
  test("the member, the pile diameter and the blinding thickness stand in the description, and split items where they differ", () => {
    const diameter = (value: string) => ({ diameter: { value, unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:4EE" } });
    const thickness = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" }, basis: "TRANSCRIBED", source: "DXF_HANDLE:5A1" };
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "p500a", objectKey: "P1", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: diameter("500") }),
        line({ lineId: "p500b", objectKey: "P2", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: diameter("500") }),
        line({ lineId: "p600", objectKey: "P3", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "6.03261", selectors: diameter("600") }),
        line({ lineId: "b1", objectKey: "PC1", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: thickness } }),
      ]),
    );
    const items = itemsOf(payload);
    const piles = items.filter((held) => held.class === "pile").map((held) => held.item.description);
    const sentence = WORK_ITEM_CATALOGUE["rcc.concrete"].description;
    expect(piles, "one item per diameter, each naming its member and its diameter").toEqual([`${sentence} — piles, diameter 500 mm`, `${sentence} — piles, diameter 600 mm`]);
    const blinding = items.find((held) => held.kind === "pcc.blinding")?.item.description;
    expect(blinding, "the blinding names its member and its thickness, as written").toBe(`${WORK_ITEM_CATALOGUE["pcc.blinding"].description} — pile caps, thickness 3 in`);
    expect(itemDescriptionOf("Formwork", "pile_cap", []), "a description with nothing stated still names its member").toBe("Formwork — pile caps");
  });

  test("one thickness written two ways is one item — members are one item by what the canon makes of them", () => {
    const drawn = { basis: "TRANSCRIBED", source: "DXF_HANDLE:5A1" };
    const inches = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" }, ...drawn };
    const millimetres = { value: "76.2", unit: "mm", canonical: { value: "0.0762", unit: "m" }, ...drawn };
    const thicker = { value: "100", unit: "mm", canonical: { value: "0.1", unit: "m" }, ...drawn };
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "b1", objectKey: "PC1", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: inches } }),
        line({ lineId: "b2", objectKey: "PC2", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: millimetres } }),
        line({ lineId: "b3", objectKey: "PC3", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.5134", variables: { t: thicker } }),
      ]),
    );
    const blinding = itemsOf(payload).map((held) => [held.item.lines.map((member) => member.lineId), held.item.quantity]);
    expect(blinding, "3 in and 76.2 mm are one thickness, so one item (0.7825 rounded half-even once); 100 mm is another").toEqual([
      [["b1", "b2"], "0.782"],
      [["b3"], "0.513"],
    ]);
  });

  test("one diameter written two ways is one item — a selector is keyed by what the canon makes of it, and a word by its spelling", () => {
    const diameter = (value: string, unit: string) => ({ diameter: { value, unit, basis: "TRANSCRIBED", source: "DXF_HANDLE:4EE" } });
    const grade = (value: string) => ({ grade: { value, unit: "", basis: "TRANSCRIBED", source: "DXF_HANDLE:4EF" } });
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "mm", objectKey: "P1", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: diameter("500", "mm") }),
        line({ lineId: "m", objectKey: "P2", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: diameter("0.5", "m") }),
        line({ lineId: "M", objectKey: "P3", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: diameter("0.50", "M") }),
        line({ lineId: "600", objectKey: "P4", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "6.03261", selectors: diameter("600", "mm") }),
        line({ lineId: "c30", objectKey: "P5", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: grade("C30") }),
        line({ lineId: "c35", objectKey: "P6", class: "pile", kind: "rcc.concrete", unit: "m3", levelId: null, value: "4.18931", selectors: grade("C35") }),
      ]),
    );
    const members = itemsOf(payload).map((held) => held.item.lines.map((member) => member.lineId).sort().join(","));
    expect(members.sort(), "500 mm, 0.5 m and 0.50 M are one diameter; 600 mm another; two grades two items").toEqual(["600", "M,m,mm", "c30", "c35"]);
  });

  test("a thickness the drawings do not state is said with where it came from — the BNBC blinding's rule-set default is never printed as drawn (I-533)", () => {
    const sentence = WORK_ITEM_CATALOGUE["pcc.blinding"].description;
    // What the BNBC campaign's 26 blinding lines carry (db_read, J-000's project): `t` = 3 in, DERIVED,
    // cited at the pinned edition's parameter — the rule set's default, not a figure any sheet states.
    const defaulted = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" }, basis: "DERIVED", source: editionSourceOf("b43500d12e5ec01b68d2139aa35089d3", "blindingThickness") };
    const transcribed = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" }, basis: "TRANSCRIBED", source: "DXF_HANDLE:5A1" };
    const interpreted = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" }, basis: "INTERPRETED", source: "DXF_HANDLE:5A2" };
    const unsaid = { value: "3", unit: "in", canonical: { value: "0.0762", unit: "m" } };
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "d1", objectKey: "PC1", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: defaulted } }),
        line({ lineId: "d2", objectKey: "PC2", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: defaulted } }),
        line({ lineId: "t1", objectKey: "PC3", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: transcribed } }),
        line({ lineId: "i1", objectKey: "PC4", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: interpreted } }),
        line({ lineId: "u1", objectKey: "PC5", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", variables: { t: unsaid } }),
      ]),
    );
    const described = new Map(itemsOf(payload).map((held) => [held.item.lines.map((member) => member.lineId).join(","), held.item.description]));
    expect(described.get("d1,d2"), "the rule set's default says so, and the two members it covers are one item").toBe(`${sentence} — pile caps, thickness 3 in (rule-set default, not on the drawings)`);
    expect(described.get("t1"), "a thickness a sheet states is stated bare — and is its own item beside the default").toBe(`${sentence} — pile caps, thickness 3 in`);
    expect(described.get("i1"), "any other basis is said in words").toBe(`${sentence} — pile caps, thickness 3 in (interpreted, not on the drawings)`);
    expect(described.get("u1"), "a reading that names no basis is not taken to be drawn").toBe(`${sentence} — pile caps, thickness 3 in (not on the drawings)`);
    expect(described.size, "four descriptions, four items: nothing drawn is merged with what is not").toBe(4);
  });

  test("a member line's details say what the formula multiplied, in its order, and what the drawing did not state", () => {
    const variables = {
      count: { value: "1", unit: "pcs", canonical: { value: "1", unit: "pcs" } },
      L: { value: "2000", unit: "mm", canonical: { value: "2", unit: "m" } },
      B: { value: "1000", unit: "mm", canonical: { value: "1", unit: "m" } },
      D: { value: "1295", unit: "mm", canonical: { value: "1.295", unit: "m" } },
    };
    expect(dimensionsOf("V = count × L × B × D (count = 1 pcs, …)", variables, []), "L, B, D in the formula's order; the count is the Nos column's").toBe("L 2 m · B 1 m · D 1.295 m");
    expect(dimensionsOf("V = count × b × (D − t) × clear", { b: variables.B, D: variables.D, clear: { value: "4.2672", unit: "m", canonical: { value: "4.2672", unit: "m" } } }, ["t"]), "an unstated variable says so").toBe(
      "b 1 m · D 1.295 m · t not stated · clear 4.2672 m",
    );

    const payload = boqDraftPayloadOf(
      reading([line({ lineId: "cap", objectKey: "PC1", class: "pile_cap", kind: "rcc.concrete", unit: "m3", levelId: "l-fdn", value: "2.590", mark: "PC1", grid: "A/1", sheet: "S-06", formula: "V = count × L × B × D", variables })]),
    );
    const member = itemsOf(payload)[0]?.item.lines[0];
    expect(member, "the member line carries its details").toMatchObject({ mark: "PC1", grid: "A/1", nos: "1", dimensions: "L 2 m · B 1 m · D 1.295 m", sheet: "S-06", quantity: "2.590" });
  });

  test("an item's bases are the weakest of its members', and it is COMPLETE only where every member is", () => {
    const payload = boqDraftPayloadOf(
      reading([
        line({ lineId: "a", objectKey: "PC1", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED" }),
        line({ lineId: "b", objectKey: "PC2", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: null, coverage: "PARTIAL_DECLARED", quantityBasis: "DERIVED", selectionBasis: "DEFAULTED", omitted: ["BLINDING_PLAN_DEFERRED"] }),
      ]),
    );
    const item = itemsOf(payload)[0]?.item;
    expect(item?.coverage, "a partly declared member leaves the item partly declared").toBe("PARTIAL_DECLARED");
    expect([item?.quantityBasis, item?.selectionBasis], "weakest wins, per roll-up (L-QTY-01)").toEqual(["DERIVED", "DEFAULTED"]);
    expect(item?.quantity, "the figure is over what was measured").toBe("0.391");
  });
});
