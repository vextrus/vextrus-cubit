/**
 * BOQ-1 — where nothing was measured, the draft says so and why; it never prints a zero, and it
 * closes on what it left out (L-QTY-02, L-QTY-04, L-QTY-07, R-UI-020; s-boq I-450, I-451).
 *
 * Three faces of one draft are graded over one reading of the kind the F-RCC6-BNBC campaign
 * publishes — column rebar whose every line is PARTIAL (the lap note contested, the tie zone
 * unstated), a pile-cap blinding measured for one cap of two, and column concrete measured whole:
 *   1. the EMISSION states no item figure over nothing, the omitted codes on the lines that state no
 *      figure, and the measurement statement whole;
 *   2. the PRESENTER (what the PDF template is handed) writes `Not measured` and the reasons in words
 *      where the old page wrote `0.000`, and qualifies a partly measured item's figure;
 *   3. the WORKBOOK writes the same words in the Quantity cell, and adds a `Not measured` sheet only
 *      where the draft left anything out.
 *
 * TEST_AMENDED (session 8, BOQ-SHAPE, s-boq I-528/b): the figures a draft states moved from the
 * group and the section foot to the ITEM — one description at one band, its members' register sum
 * rounded once — and no quantity is added across descriptions, so a section carries no foot at all.
 * What each case guards is unchanged: nothing is stated over nothing, and every omission says why.
 *
 * Nothing here opens a database and nothing measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { BOQ_DRAFT_KIND } from "@/core/documents/kinds/boq-draft";
import { REFUSALS } from "@/core/errors";
import { boqDraftPayloadOf, type BoqReading, type BoqReadingLine } from "@/modules/takeoff/boq/emission";
import { numberItems } from "@/modules/takeoff/boq/numbering";
import { boqWorkbookSpecOf, type BoqExportReading } from "@/modules/takeoff/export/boq-xlsx";

/** The storeys the lines stand on: the foundation below the plinth, the ground floor at it. */
const LEVELS = [
  { levelId: "l-fdn", ordinal: -1, label: "FDN" },
  { levelId: "l-gf", ordinal: 0, label: "GF" },
];

const REBAR_REASONS = ["NOTE_READING_CONTESTED", "REBAR_TIE_ZONE_UNSTATED"];

/** One published line, as the register hands it over. */
function line(overrides: Partial<BoqReadingLine> & Pick<BoqReadingLine, "lineId" | "objectKey" | "class" | "kind" | "unit">): BoqReadingLine {
  return {
    levelId: "l-fdn",
    value: null,
    quantityBasis: "DERIVED",
    selectionBasis: "TRANSCRIBED",
    coverage: "PARTIAL_DECLARED",
    ...overrides,
  };
}

/** The reading: column concrete whole, column rebar not at all, pile-cap blinding for one cap of two. */
function reading(o: { notMeasured?: BoqReading["notMeasured"] } = {}): BoqReading {
  return {
    project: "Bashundhara G+6",
    campaignId: "c-1",
    setRevisionId: "r-1",
    levels: LEVELS,
    coverageComplete: (o.notMeasured ?? []).length === 0,
    notMeasured: o.notMeasured,
    lines: [
      line({ lineId: "ln-c1", objectKey: "column/FDN/C1", class: "column", kind: "rcc.concrete", unit: "m3", value: "0.4064", coverage: "COMPLETE" }),
      // The store states each code per COMPONENT (the lap, the ties…), so a line may name a code twice.
      line({ lineId: "ln-r1", objectKey: "column/FDN/C1", class: "column", kind: "rcc.rebar", unit: "kg", omitted: [...REBAR_REASONS, "REBAR_TIE_ZONE_UNSTATED"] }),
      line({ lineId: "ln-r2", objectKey: "column/FDN/C2", class: "column", kind: "rcc.rebar", unit: "kg", omitted: REBAR_REASONS }),
      line({ lineId: "ln-b1", objectKey: "pile_cap/FDN/PC1", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, value: "0.39125", coverage: "COMPLETE" }),
      line({ lineId: "ln-b2", objectKey: "pile_cap/FDN/PC2", class: "pile_cap", kind: "pcc.blinding", unit: "m3", levelId: null, omitted: ["BLINDING_PLAN_DEFERRED", "BLINDING_PLAN_DEFERRED"] }),
    ],
  };
}

const STATEMENT = [
  { class: "slab", kind: "rcc.concrete", levels: "GF–6F", cause: "NOT_ESTABLISHED" },
  { class: null, kind: "piling.boring", levels: "", cause: "NO_BEARER_SIGHTED" },
] as const;

/** The only section this reading fills. */
function substructure(payload: ReturnType<typeof boqDraftPayloadOf>) {
  const section = payload.sections.find((held) => held.bill === "SUBSTRUCTURE");
  expect(section, "the reading's lines all stand in Substructure").toBeDefined();
  return section as NonNullable<typeof section>;
}

/** The one item of a (class, kind) group — this reading states one description per group. */
function itemOf(payload: ReturnType<typeof boqDraftPayloadOf>, klass: string, kind: string) {
  const group = substructure(payload).groups.find((held) => held.class === klass && held.kind === kind);
  expect(group, `the draft groups ${klass} × ${kind}`).toBeDefined();
  expect(group?.items.length, `${klass} × ${kind} states one description, so one item`).toBe(1);
  return (group as NonNullable<typeof group>).items[0] as NonNullable<NonNullable<typeof group>["items"][number]>;
}

describe("I-450: the emission states no figure over nothing", () => {
  test("an item none of whose lines states a figure states none — never `0.000`", () => {
    const payload = boqDraftPayloadOf(reading());
    expect(itemOf(payload, "column", "rcc.rebar").quantity, "Column · Rebar measured nothing, so it states nothing — not 0.000 kg").toBeNull();
    expect(itemOf(payload, "column", "rcc.concrete").quantity, "an item measured whole keeps its figure").toBe("0.406");
    expect(itemOf(payload, "pile_cap", "pcc.blinding").quantity, "a partly measured item sums what was measured").toBe("0.391");
  });

  test("a section states no foot at all — a quantity added across descriptions is the volume of nothing", () => {
    const payload = boqDraftPayloadOf(reading());
    expect("subtotals" in substructure(payload), "no section foot, in any unit (I-529)").toBe(false);
  });

  test("a line with no figure carries the codes it gave, once each; a line with one carries none", () => {
    const payload = boqDraftPayloadOf(reading());
    const lines = substructure(payload).groups.flatMap((group) => group.items.flatMap((item) => item.lines));
    const byId = new Map(lines.map((held) => [held.lineId, held]));
    expect(byId.get("ln-r1")?.omitted, "the rebar line's reasons, in the order it gave them, each once").toEqual(REBAR_REASONS);
    expect(byId.get("ln-b2")?.omitted, "the blinding's one reason, once").toEqual(["BLINDING_PLAN_DEFERRED"]);
    expect("omitted" in (byId.get("ln-c1") ?? {}), "a measured line carries no omission key at all").toBe(false);
    expect("omitted" in (byId.get("ln-b1") ?? {}), "nor does the measured cap of a partly measured item").toBe(false);
  });

  test("the measurement statement is carried whole, and the payload still parses", () => {
    const payload = boqDraftPayloadOf(reading({ notMeasured: STATEMENT }));
    expect(payload.notMeasured, "every statement row stands on the draft, as the residue stated it").toEqual(STATEMENT);
    expect(payload.coverage, "a draft that leaves anything out is INCOMPLETE").toBe("INCOMPLETE");
    expect(BOQ_DRAFT_KIND.payloadSchema.safeParse(payload).success, "the kind's strict schema reads what the emission writes").toBe(true);
  });
});

describe("I-450: the page says `Not measured` and why, where it said nothing or a zero", () => {
  type PresentedItem = { item: string; description: string; quantity: string; notMeasured: string; qualifier: string };
  type PresentedDetail = { quantity: string; notMeasured: string; reasons: string };
  const presented = (payload: unknown) =>
    BOQ_DRAFT_KIND.present(payload) as {
      sections: { groups: { heading: string; items: PresentedItem[] }[] }[];
      details: { items: { item: string; rows: PresentedDetail[] }[] };
      notMeasured: { scope: { about: string; levels: string; why: string }[]; reasons: { reason: string; meaning: string }[] };
    };
  const itemUnder = (page: ReturnType<typeof presented>, heading: string): PresentedItem | undefined => page.sections[0]?.groups.find((group) => group.heading === heading)?.items[0];

  test("an item with no figure reads `Not measured`, qualified by how many and why", () => {
    const page = presented(boqDraftPayloadOf(reading()));
    const rebar = itemUnder(page, "Column · Rebar");
    expect(rebar?.quantity, "no figure is written for it").toBe("");
    expect(rebar?.notMeasured, "the words stand where the figure would").toBe("Not measured");
    expect(rebar?.qualifier, "and say none of its lines was measured, and why, in words").toBe("None of 2 measured — note reading contested; rebar tie zone unstated");
    const details = page.details.items.find((held) => held.item === rebar?.item);
    expect(details?.rows.length, "its two member lines stand in the details of measurement").toBe(2);
    for (const row of details?.rows ?? []) {
      expect(row.quantity, "a member line with no figure writes none").toBe("");
      expect(row.notMeasured, "and says it was not measured").toBe("Not measured");
      expect(row.reasons, "and why, in words and never a code").toBe("note reading contested; rebar tie zone unstated");
    }
  });

  test("a partly measured item prints its figure, qualified", () => {
    const page = presented(boqDraftPayloadOf(reading()));
    const blinding = itemUnder(page, "Pile cap · Blinding");
    expect(blinding?.quantity, "the figure over what was measured").toBe("0.391");
    expect(blinding?.notMeasured, "the item is not unmeasured").toBe("");
    expect(blinding?.qualifier, "and how much of it that figure covers").toBe("1 of 2 measured; 1 not measured — blinding plan deferred");
    expect(itemUnder(page, "Column · Concrete")?.qualifier, "an item measured whole is not qualified").toBe("");
  });

  test("a payload that still carries a zero over nothing prints the words, never the zero", () => {
    // What a stale emission could hand over: a figure of `0.000` on an item none of whose lines
    // states one. Whether an item states a figure is read off its LINES (I-450(d)).
    const payload = boqDraftPayloadOf(reading());
    const stale = {
      ...payload,
      sections: payload.sections.map((section) => ({
        ...section,
        groups: section.groups.map((group) => (group.kind === "rcc.rebar" ? { ...group, items: group.items.map((item) => ({ ...item, quantity: "0.000" })) } : group)),
      })),
    };
    const rebar = itemUnder(presented(stale), "Column · Rebar");
    expect(rebar?.quantity, "no figure over nothing, whatever the payload said").toBe("");
    expect(rebar?.notMeasured, "and the words instead").toBe("Not measured");
  });

  test("the closing block states the scope and each reason in the registry's own sentence", () => {
    const page = presented(boqDraftPayloadOf(reading({ notMeasured: STATEMENT })));
    expect(page.notMeasured.scope, "the statement's rows, in words").toEqual([
      { about: "Slab · Concrete", levels: "GF–6F", why: REFUSALS.NOT_ESTABLISHED.message },
      { about: "Boring", levels: "", why: REFUSALS.NO_BEARER_SIGHTED.message },
    ]);
    expect(page.notMeasured.reasons, "each reason a line gave, once, beside the registry's sentence").toEqual([
      { reason: "Note reading contested", meaning: REFUSALS.NOTE_READING_CONTESTED.message },
      { reason: "Rebar tie zone unstated", meaning: REFUSALS.REBAR_TIE_ZONE_UNSTATED.message },
      { reason: "Blinding plan deferred", meaning: REFUSALS.BLINDING_PLAN_DEFERRED.message },
    ]);
  });
});

/** A cell of the written sheets as a spreadsheet would hold it: text, a formula, or nothing. */
type Cell = string | null | { readonly formula: string };

/** What a formula comes to: a number, text, or the error a spreadsheet shows. */
type Value = number | string | { readonly error: "#VALUE!" };

/**
 * The spreadsheet's own reading of the few formulas the workbook writes — IF, AND, ISNUMBER, `=`,
 * `*`, a cell, a range and SUM — so a case can ask what Excel would show once a person typed a rate.
 * A cell holding a decimal is a number (the export seam writes a number column's figure as one);
 * any other text is text, and text multiplied is `#VALUE!`, as it is in Excel.
 */
function evaluate(formula: string, cellAt: (ref: string) => Cell): Value {
  const tokens = formula.match(/'[^']*'![A-Z]+\d+:[A-Z]+\d+|[A-Z]+\d+:[A-Z]+\d+|"[^"]*"|[A-Z]+\(|[A-Z]+\d+|\d+(?:\.\d+)?|[(),=*]/gu) ?? [];
  let at = 0;
  const valueOf = (ref: string): Value => {
    const cell = cellAt(ref);
    if (cell === null) return "";
    if (typeof cell === "object") return evaluate(cell.formula, cellAt);
    return /^-?\d+(\.\d+)?$/u.test(cell) ? Number(cell) : cell;
  };
  const cellsOf = (range: string): Value[] => {
    const [sheet, span] = range.includes("!") ? [range.slice(0, range.indexOf("!") + 1), range.slice(range.indexOf("!") + 1)] : ["", range];
    const [from, to] = span.split(":") as [string, string];
    const column = from.replace(/\d+/u, "");
    const out: Value[] = [];
    for (let row = Number(from.replace(/[A-Z]+/u, "")); row <= Number(to.replace(/[A-Z]+/u, "")); row += 1) out.push(valueOf(`${sheet}${column}${String(row)}`));
    return out;
  };
  const isError = (value: Value): boolean => typeof value === "object";
  const args = (): string[][] => {
    const groups: string[][] = [[]];
    let depth = 0;
    while (at < tokens.length) {
      const token = tokens[at++] as string;
      if (token.endsWith("(") || token === "(") depth += 1;
      if (token === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
      if (token === "," && depth === 0) groups.push([]);
      else (groups.at(-1) as string[]).push(token);
    }
    return groups;
  };
  const sub = (part: string[]): Value => evaluate(part.join(""), cellAt);
  const token = tokens[at++] as string;
  let left: Value;
  if (token === "IF(") {
    const [cond, yes, no] = args() as [string[], string[], string[]];
    const test = sub(cond);
    left = isError(test) ? test : test === 1 || test === "TRUE" ? sub(yes) : sub(no);
  } else if (token === "AND(") {
    const all = args().map(sub);
    left = all.find(isError) ?? (all.every((one) => one === 1) ? 1 : 0);
  } else if (token === "ISNUMBER(") {
    left = typeof sub((args() as [string[]])[0]) === "number" ? 1 : 0;
  } else if (token === "SUM(") {
    const values = cellsOf(((args() as [string[]])[0])[0] as string);
    left = values.find(isError) ?? values.reduce<number>((held, one) => held + (typeof one === "number" ? one : 0), 0);
  } else if (token.startsWith('"')) left = token.slice(1, -1);
  else if (/^\d/u.test(token)) left = Number(token);
  else left = valueOf(token);
  while (at < tokens.length) {
    const operator = tokens[at++] as string;
    const right = sub(tokens.slice(at));
    at = tokens.length;
    if (operator === "=") left = left === right ? 1 : 0;
    else if (operator === "*") left = typeof left === "number" && typeof right === "number" ? left * right : left === "" && typeof right === "number" ? 0 : { error: "#VALUE!" };
  }
  return left;
}

describe("I-450/c: the workbook writes the same words, and says what it left out", () => {
  const exportReading = (payload: ReturnType<typeof boqDraftPayloadOf>): BoqExportReading => ({
    view: { campaignId: payload.campaignId, setRevisionId: payload.setRevisionId, taxonomyVersion: payload.taxonomyVersion, coverage: "INCOMPLETE", payload, items: numberItems(payload.sections) },
    evidence: [],
  });

  // TEST_AMENDED (session 9, BBS-HONEST, s-boq I-570): the words moved out of the Quantity
  // cell into a Remarks column beside it. What the case guards is unchanged — an item with no figure
  // says so and why — and the Quantity cell now holds a number or nothing, so a priced sheet sums.
  test("an item with no figure leaves its Quantity empty and says `Not measured — <reasons>` in Remarks; the sheet states no foot", () => {
    const payload = boqDraftPayloadOf(reading());
    const workbook = boqWorkbookSpecOf(exportReading(payload));
    const sheet = workbook.sheets.find((held) => held.name === "1 Substructure");
    expect(sheet, "the section sheet is written").toBeDefined();
    const rows = sheet?.rows ?? [];
    const quantity = 4;
    const remarks = sheet?.columns.findIndex((held) => held.header === "Remarks") ?? -1;
    expect(remarks, "the section sheet carries a Remarks column, after the Amount so the seven keep their letters").toBe(7);
    const rebar = rows.filter((row) => row[1] === "column:rcc.rebar");
    expect(rebar.length, "the rebar is ONE item on the sheet — its two lines are its details").toBe(1);
    expect(rebar[0]?.[quantity], "the Quantity cell holds no words: a spreadsheet adds this column").toBeNull();
    expect(rebar[0]?.[remarks], "the Remarks cell says so, in words").toBe("Not measured — note reading contested; rebar tie zone unstated");
    expect(rows.find((row) => row[1] === "column:rcc.concrete")?.[remarks], "a measured item has no remark").toBeNull();
    expect(
      rows.some((row) => row[2] === "Measured-scope subtotal"),
      "no foot adds unlike descriptions — the sheet's figures are its items' (I-529)",
    ).toBe(false);
    const blinding = rows.find((row) => row[1] === "pile_cap:pcc.blinding");
    expect(blinding?.[2], "a partly measured item says how much its figure covers").toContain("(1 of 2 measured; 1 not measured — blinding plan deferred)");

    const quantities = workbook.sheets.find((held) => held.name === "Quantities");
    const column = quantities?.columns.findIndex((held) => held.header === "Quantity") ?? -1;
    const reason = quantities?.columns.findIndex((held) => held.header === "Reason") ?? -1;
    const partial = quantities?.rows.find((row) => row[2] === "ln-b2");
    expect(partial?.[column], "the Quantities sheet's Quantity cell holds no words either").toBeNull();
    expect(partial?.[reason], "the Quantities sheet writes the same words for the member line, as its Reason").toBe("Not measured — blinding plan deferred");
  });

  test("a rate typed against an item with no quantity leaves its Amount empty and the section's sum a number (I-570)", () => {
    const payload = boqDraftPayloadOf(reading());
    const workbook = boqWorkbookSpecOf(exportReading(payload));
    const sheet = workbook.sheets.find((held) => held.name === "1 Substructure");
    const summary = workbook.sheets.find((held) => held.name === "Summary");
    expect(sheet !== undefined && summary !== undefined, "the section and the Summary are written").toBe(true);
    // A QS prices EVERY item row — the unmeasured rebar too, as a rate pasted down a column is.
    const priced = new Map<string, Cell>();
    (sheet?.rows ?? []).forEach((row, index) => {
      const at = index + 2;
      priced.set(`E${at}`, row[4] ?? null);
      if (row[0] !== null && row[0] !== "") priced.set(`F${at}`, "1000");
      priced.set(`G${at}`, row[6] ?? null);
    });
    const sum = summary?.rows.find((row) => row[1] === "Substructure")?.[2];
    expect(typeof sum === "object" && sum !== null, "the Summary sums the section's Amounts live").toBe(true);
    const total = evaluate((sum as { formula: string }).formula, (ref) => priced.get(ref.replace(/^'[^']*'!/u, "")) ?? null);
    expect(typeof total, `the section's price stays a number with the unmeasured row priced — it came to ${String(total)}`).toBe("number");
    const rebarRow = (sheet?.rows ?? []).findIndex((row) => row[1] === "column:rcc.rebar") + 2;
    const rebarAmount = evaluate(((sheet?.rows[rebarRow - 2]?.[6] ?? { formula: "" }) as { formula: string }).formula, (ref) => priced.get(ref) ?? null);
    expect(rebarAmount, "and the unmeasured item's own Amount stays empty, never #VALUE!").toBe("");
  });

  test("the `Not measured` sheet stands after Quantities where the draft left anything out, and nowhere else", () => {
    const left = boqWorkbookSpecOf(exportReading(boqDraftPayloadOf(reading({ notMeasured: STATEMENT }))));
    expect(left.sheets.map((held) => held.name), "Summary, the section, Quantities, then what was not measured").toEqual(["Summary", "1 Substructure", "Quantities", "Not measured"]);
    const sheet = left.sheets.at(-1);
    expect(sheet?.columns.map((column) => column.header), "its four columns").toEqual(["Part", "Description", "Levels", "Why"]);
    expect(sheet?.rows[0], "the scope rows first, the cause in the registry's own sentence").toEqual(["Scope no line was published for", "Slab · Concrete", "GF–6F", REFUSALS.NOT_ESTABLISHED.message]);
    expect(sheet?.rows.filter((row) => row[0] === "Why a line states no figure").length, "then each line reason once").toBe(3);

    const whole = boqDraftPayloadOf({ ...reading(), lines: reading().lines.filter((held) => held.value !== null) });
    expect(boqWorkbookSpecOf(exportReading(whole)).sheets.map((held) => held.name), "a draft that left nothing out carries no such sheet").toEqual(["Summary", "1 Substructure", "Quantities"]);
  });
});
