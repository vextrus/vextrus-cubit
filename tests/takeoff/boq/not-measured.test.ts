/**
 * BOQ-1 — where nothing was measured, the draft says so and why; it never prints a zero, and it
 * closes on what it left out (L-QTY-02, L-QTY-04, L-QTY-07, R-UI-020; s-boq I-450, I-451).
 *
 * Three faces of one draft are graded over one reading of the kind the F-RCC6-BNBC campaign
 * publishes — column rebar whose every line is PARTIAL (the lap note contested, the tie zone
 * unstated), a pile-cap blinding measured for one cap of two, and column concrete measured whole:
 *   1. the EMISSION carries no subtotal over nothing, the omitted codes on the lines that state no
 *      figure, and the measurement statement whole;
 *   2. the PRESENTER (what the PDF template is handed) writes `Not measured` and the reasons in words
 *      where the old page wrote `0.000`, and qualifies a partly measured group's figure;
 *   3. the WORKBOOK writes the same words in the Quantity cell and the foot, and adds a `Not measured`
 *      sheet only where the draft left anything out.
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

function groupOf(payload: ReturnType<typeof boqDraftPayloadOf>, klass: string, kind: string) {
  const group = substructure(payload).groups.find((held) => held.class === klass && held.kind === kind);
  expect(group, `the draft groups ${klass} × ${kind}`).toBeDefined();
  return group as NonNullable<typeof group>;
}

describe("I-450: the emission states no figure over nothing", () => {
  test("a group none of whose lines states a figure carries no subtotal — never `0.000`", () => {
    const payload = boqDraftPayloadOf(reading());
    expect(groupOf(payload, "column", "rcc.rebar").subtotals, "Column · Rebar measured nothing, so it sums to nothing — not to 0.000 kg").toEqual([]);
    expect(groupOf(payload, "column", "rcc.concrete").subtotals, "a group measured whole keeps its figure").toEqual([{ unit: "m3", value: "0.406" }]);
    expect(groupOf(payload, "pile_cap", "pcc.blinding").subtotals, "a partly measured group sums what was measured").toEqual([{ unit: "m3", value: "0.391" }]);
  });

  test("a section's foot states no unit nothing was measured in", () => {
    const payload = boqDraftPayloadOf(reading());
    const feet = substructure(payload).subtotals;
    expect(feet.map((held) => held.unit), "kg stands on no foot: no line in it states a figure").toEqual(["m3"]);
    expect(feet[0]?.value, "the m3 foot adds what the page shows").toBe("0.797");
  });

  test("a line with no figure carries the codes it gave, once each; a line with one carries none", () => {
    const payload = boqDraftPayloadOf(reading());
    const lines = substructure(payload).groups.flatMap((group) => group.lines);
    const byId = new Map(lines.map((held) => [held.lineId, held]));
    expect(byId.get("ln-r1")?.omitted, "the rebar line's reasons, in the order it gave them, each once").toEqual(REBAR_REASONS);
    expect(byId.get("ln-b2")?.omitted, "the blinding's one reason, once").toEqual(["BLINDING_PLAN_DEFERRED"]);
    expect("omitted" in (byId.get("ln-c1") ?? {}), "a measured line carries no omission key at all").toBe(false);
    expect("omitted" in (byId.get("ln-b1") ?? {}), "nor does the measured cap of a partly measured group").toBe(false);
  });

  test("the measurement statement is carried whole, and the payload still parses", () => {
    const payload = boqDraftPayloadOf(reading({ notMeasured: STATEMENT }));
    expect(payload.notMeasured, "every statement row stands on the draft, as the residue stated it").toEqual(STATEMENT);
    expect(payload.coverage, "a draft that leaves anything out is INCOMPLETE").toBe("INCOMPLETE");
    expect(BOQ_DRAFT_KIND.payloadSchema.safeParse(payload).success, "the kind's strict schema reads what the emission writes").toBe(true);
  });
});

describe("I-450: the page says `Not measured` and why, where it said nothing or a zero", () => {
  const presented = (payload: ReturnType<typeof boqDraftPayloadOf>) =>
    BOQ_DRAFT_KIND.present(payload) as {
      sections: {
        groups: { description: string; figure: string; notMeasured: string; qualifier: string; lines: { item: string; quantity: string; notMeasured: string; reasons: string }[] }[];
        subtotals: { value: string; notMeasured: string; unit: string }[];
      }[];
      notMeasured: { scope: { about: string; levels: string; why: string }[]; reasons: { reason: string; meaning: string }[] };
    };

  test("a group with no figure reads `Not measured`, qualified by how many and why", () => {
    const page = presented(boqDraftPayloadOf(reading()));
    const rebar = page.sections[0]?.groups.find((group) => group.description === "Column · Rebar");
    expect(rebar?.figure, "no figure is written for it").toBe("");
    expect(rebar?.notMeasured, "the words stand where the figure would").toBe("Not measured");
    expect(rebar?.qualifier, "and say none of its lines was measured, and why, in words").toBe("None of 2 measured — note reading contested; rebar tie zone unstated");
    for (const held of rebar?.lines ?? []) {
      expect(held.quantity, `${held.item} writes no figure`).toBe("");
      expect(held.notMeasured, `${held.item} says it was not measured`).toBe("Not measured");
      expect(held.reasons, `${held.item} says why, in words and never a code`).toBe("note reading contested; rebar tie zone unstated");
    }
  });

  test("a partly measured group prints its figure, qualified", () => {
    const page = presented(boqDraftPayloadOf(reading()));
    const blinding = page.sections[0]?.groups.find((group) => group.description === "Pile cap · Blinding");
    expect(blinding?.figure, "the figure over what was measured").toBe("0.391");
    expect(blinding?.notMeasured, "the group is not unmeasured").toBe("");
    expect(blinding?.qualifier, "and how much of it that figure covers").toBe("1 of 2 measured; 1 not measured — blinding plan deferred");
    const concrete = page.sections[0]?.groups.find((group) => group.description === "Column · Concrete");
    expect(concrete?.qualifier, "a group measured whole is not qualified").toBe("");
  });

  test("the foot writes `Not measured` for a unit nothing was measured in, in the groups' own order", () => {
    const page = presented(boqDraftPayloadOf(reading()));
    expect(page.sections[0]?.subtotals, "m3 carries its figure, kg says it was not measured").toEqual([
      { value: "0.797", notMeasured: "", unit: "m3" },
      { value: "", notMeasured: "Not measured", unit: "kg" },
    ]);
  });

  test("a payload that still carries a zero over nothing prints the words, never the zero", () => {
    // What the emission wrote before BOQ-1: a subtotal of `0.000` over a group with no figure.
    const payload = boqDraftPayloadOf(reading());
    const stale = {
      ...payload,
      sections: payload.sections.map((section) => ({
        ...section,
        subtotals: [...section.subtotals, { unit: "kg", value: "0.000" }],
        groups: section.groups.map((group) => (group.kind === "rcc.rebar" ? { ...group, subtotals: [{ unit: "kg", value: "0.000" }] } : group)),
      })),
    };
    const page = presented(stale);
    const rebar = page.sections[0]?.groups.find((group) => group.description === "Column · Rebar");
    expect(rebar?.figure, "whether a group states a figure is read off its LINES").toBe("");
    expect(page.sections[0]?.subtotals.find((held) => held.unit === "kg"), "and so is the foot").toEqual({ value: "", notMeasured: "Not measured", unit: "kg" });
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

describe("I-450/c: the workbook writes the same words, and says what it left out", () => {
  const exportReading = (payload: ReturnType<typeof boqDraftPayloadOf>): BoqExportReading => ({
    view: { campaignId: payload.campaignId, setRevisionId: payload.setRevisionId, taxonomyVersion: payload.taxonomyVersion, coverage: "INCOMPLETE", payload, items: numberItems(payload.sections) },
    evidence: [],
  });

  test("a line with no figure reads `Not measured — <reasons>` in its Quantity cell; the kg foot reads `Not measured`", () => {
    const payload = boqDraftPayloadOf(reading());
    const workbook = boqWorkbookSpecOf(exportReading(payload));
    const sheet = workbook.sheets.find((held) => held.name === "1 Substructure");
    expect(sheet, "the section sheet is written").toBeDefined();
    const rows = sheet?.rows ?? [];
    const quantity = 4;
    const rebar = rows.filter((row) => row[1] === "column:rcc.rebar");
    expect(rebar.length, "both rebar lines stand on the sheet").toBe(2);
    for (const row of rebar) expect(row[quantity], "the Quantity cell says so, in words").toBe("Not measured — note reading contested; rebar tie zone unstated");

    const feet = rows.filter((row) => row[2] === "Measured-scope subtotal");
    const kg = feet.find((row) => row[3] === "kg");
    expect(kg?.[quantity], "the kg foot says Not measured — never a SUMIF that comes to 0.000").toBe("Not measured");
    const m3 = feet.find((row) => row[3] === "m3");
    expect(typeof m3?.[quantity] === "object" && m3?.[quantity] !== null && "formula" in (m3?.[quantity] as object), "the m3 foot stays a live SUMIF").toBe(true);

    const quantities = workbook.sheets.find((held) => held.name === "Quantities");
    const partial = quantities?.rows.find((row) => row[2] === "ln-b2");
    expect(partial?.[8], "the Quantities sheet writes the same words").toBe("Not measured — blinding plan deferred");
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
