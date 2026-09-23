// @vitest-environment node
/**
 * S-Ask's answers, end to end over the F-RCC6-BNBC read-back (docs/design/s-ask.md I-398, I-399,
 * I-401, I-404, §6): a question in, the facts of its answer out.
 *
 * - a figure's face equals the register footer's face for the same rows — one figure, two faces;
 * - no figure adds two kinds, and a line whose object a person struck is never summed;
 * - GF's standing height states `3.353` as the levels grid does, and its two readings are figures —
 *   `132` in and `3.353` m, each with its unit and its source key, neither a quote;
 * - every quoted value stands in its cited entity's normalised words, and a note reading that does not
 *   is stated as a figure;
 * - a figure whose members stand on one (drawing, layout) names that one place, selecting them all;
 * - the grammar routes, the person routes a chosen reading, and a follow-up is read against the
 *   previous answer — with no model called on any of these paths.
 */
import { describe, expect, test } from "vitest";
import { placesForUnit } from "@/core/documents/kinds/boq-draft-law";
import { REFUSALS } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { exact } from "@/core/units/canon";
import { answerStatement } from "@/modules/takeoff/ask/answer";
import type { AskAnswer, AskFigure, AskPlace, AskReading, AskStatementFacts } from "@/modules/takeoff/ask/law";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { subtotalsByUnit } from "@/ui/primitives/data/data-table";
import { READ_BACK, linesOf, objectsOf, readBackSources } from "./support/readback";

const SOURCES = readBackSources();

/** A figure's face, through the format seam at its places. */
function face(figure: AskFigure | null | undefined): string {
  if (figure === null || figure === undefined) return expect.fail("no figure was stated");
  return formatUserFigure(statedAt(figure.value, figure.places));
}

/** The answer to one question, which must be an answer. */
function answered(question: string, sources = SOURCES, extra: { reading?: AskReading; previous?: AskReading } = {}): Extract<AskAnswer, { outcome: "ANSWERED" }> {
  const answer = answerStatement({ question, ...extra }, sources);
  if (answer.outcome !== "ANSWERED") return expect.fail(`"${question}" must be answered, and it was ${JSON.stringify(answer)}`);
  return answer;
}

/** One intent's statement. */
function statementOf<I extends AskStatementFacts["intent"]>(answer: Extract<AskAnswer, { outcome: "ANSWERED" }>, intent: I): Extract<AskStatementFacts, { intent: I }> {
  expect(answer.facts.statement.intent).toBe(intent);
  return answer.facts.statement as Extract<AskStatementFacts, { intent: I }>;
}

describe("one figure, two faces: Ask and the register footer state the same rows alike (I-398)", () => {
  test("column concrete's face is the footer's face over the same lines", () => {
    const answer = answered("What is the column concrete?");
    const figure = statementOf(answer, "QUANTITY").figure;
    // The register's footer: the table's own exact addition per unit, stated at the widest places of the
    // kinds adding into that unit (register-ui `placesOfTotal`, s-takeoff I-reg-2).
    const rows = linesOf().filter((line) => line.class === "column" && line.kind === "rcc.concrete");
    const [subtotal] = subtotalsByUnit(rows, (row) => row.value, (row) => row.unit);
    const footer = formatUserFigure(statedAt(subtotal?.value ?? "", placesForUnit(rows, subtotal?.unit ?? "")));
    expect(face(figure)).toBe(footer);
    expect(face(figure)).toBe("93.893");
    expect(answer.routedBy, "the grammar read it: no model was asked").toBe("GRAMMAR");
  });

  test("no figure adds two kinds: blinding is stated apart from concrete, and every trade is its own kind's", () => {
    const answer = answered("What is the total concrete for the building?");
    const soFar = statementOf(answer, "MEASURED_SO_FAR");
    expect(soFar.trades.map((trade) => trade.kind), "concrete asked, concrete answered").toEqual(["rcc.concrete"]);
    const concrete = linesOf().filter((line) => line.kind === "rcc.concrete" && line.coverage === "COMPLETE");
    const [subtotal] = subtotalsByUnit(concrete, (row) => row.value, (row) => row.unit);
    expect(face(soFar.trades[0]?.figure), "reinforced concrete alone").toBe(formatUserFigure(statedAt(subtotal?.value ?? "", 3)));
    expect(face(soFar.apart?.figure), "blinding on its own row").toBe("4.692");
    expect(face(soFar.trades[0]?.figure)).not.toBe(face({ value: "600.215", unit: "m3", kind: null, places: 3, at: [] }));
  });
});

describe("a struck object is never counted and its lines never summed (I-173, I-399)", () => {
  test("striking one C3 on 5F takes it out of the count and its concrete out of the figure", () => {
    const target = objectsOf().find((object) => object.mark === "C3" && object.level === "5F");
    if (target === undefined) return expect.fail("the read-back holds a C3 on 5F");
    const line = linesOf().find((one) => one.objectKey === target.objectKey && one.kind === "rcc.concrete");
    const struck = readBackSources({
      objects: objectsOf().map((object) => (object.objectKey === target.objectKey ? { ...object, corroboration: "REPUDIATED" } : object)),
      lines: linesOf().map((one) => (one.objectKey === target.objectKey ? { ...one, repudiated: true } : one)),
    });
    const count = statementOf(answered("How many C3 columns are on 5F?", struck), "COUNT");
    expect(count.count.value).toBe("5");
    expect(count.struck, "the struck one is said, not hidden").toBe(1);

    const before = statementOf(answered("What is the column concrete?"), "QUANTITY");
    const after = statementOf(answered("What is the column concrete?", struck), "QUANTITY");
    expect(after.lines).toBe(before.lines - 1);
    expect(exact(after.figure?.value ?? "0").plus(exact(line?.value ?? "0")).equals(exact(before.figure?.value ?? "0")), "the figure fell by exactly the struck line's value").toBe(true);
  });
});

describe("storey heights are figures, never quotes (I-401)", () => {
  test("GF: 3.353 m standing, read as 132 in at 1D90 and 3.353 m at 1D4C, each with the mark it was read from", () => {
    const heights = statementOf(answered("What is the ground floor's floor-to-floor height?"), "LEVEL_HEIGHT");
    const gf = heights.heights[0];
    expect(heights.heights.map((height) => height.level)).toEqual(["GF"]);
    expect(face(gf?.figure)).toBe("3.353");
    expect(gf?.figure?.value, "the exact metres stay on the figure").toBe(READ_BACK.levels.find((level) => level.label === "GF")?.readings[0]?.canonicalMetres);
    for (const reading of gf?.readings ?? []) {
      expect(reading.quote, "a storey height is never a quote").toBeNull();
      expect(reading.figure?.unit).not.toBeNull();
      expect(reading.sourceKey).toMatch(/^DXF_HANDLE:/u);
    }
    expect(gf?.readings.map((one) => [face(one.figure), one.figure?.unit, one.clause])).toEqual([
      ["132", "in", "P.L= +0'-0\""],
      ["3.353", "m", "1F EL +3.353"],
    ]);
  });
});

describe("a quote is the drawing's own characters, or it is a figure (I-401)", () => {
  test("every quoted note value stands in its cited entity's normalised words", () => {
    const note = statementOf(answered("What do the general notes state?"), "NOTE");
    const readings = note.groups.flatMap((group) => group.readings);
    expect(readings.length).toBe(READ_BACK.notes.length);
    for (const reading of readings) {
      if (reading.quote === null) continue;
      expect(reading.clause, `${String(reading.sourceKey)}'s words`).not.toBeNull();
      expect(reading.clause?.includes(reading.quote), `"${reading.quote}" stands in "${String(reading.clause)}"`).toBe(true);
    }
    expect(readings.filter((one) => one.quote !== null).length, "on F-RCC6-BNBC every reading is written as the drawing wrote it").toBe(readings.length);
  });

  test("a reading that respells its value is stated as a figure, never quoted", () => {
    const respelled = READ_BACK.notes.map((one) => (one.kind === "HOOK_MIN" ? { ...one, valueAsWritten: "75mm" } : one));
    const note = statementOf(answered("What is the minimum hook?", readBackSources({ notes: respelled })), "NOTE");
    const hook = note.groups.find((group) => group.noteKind === "HOOK_MIN")?.readings[0];
    expect(hook?.quote, "'75mm' is not in 'min 75 mm'").toBeNull();
    expect(hook?.figure).toMatchObject({ value: "75", unit: "mm", places: 0 });
  });
});

describe("where a figure's evidence stands (I-404)", () => {
  test("six members on one (drawing, layout) name that one place, selecting every one of them", () => {
    const at = (objectKey: string): AskPlace | null => {
      const object = objectsOf().find((one) => one.objectKey === objectKey);
      if (object === undefined || object.mark !== "C3") return null;
      const handle = object.sourceKey.slice(object.sourceKey.lastIndexOf("|") + 1).replace(/[^0-9]/gu, "").slice(0, 6);
      return { drawingId: "bnbc", layoutName: "S-10 TYPICAL FLOOR PLAN", sheetLabel: "S-10", keys: [`DXF_HANDLE:${handle}A`, `DXF_HANDLE:${handle}B`] };
    };
    const answer = answered("How many C3 columns are on 5F?", readBackSources({ memberAt: at }));
    const count = statementOf(answer, "COUNT");
    expect(count.count.at, "one place").toHaveLength(1);
    expect(count.count.at[0]).toMatchObject({ drawingId: "bnbc", layoutName: "S-10 TYPICAL FLOOR PLAN", sheetLabel: "S-10" });
    expect(new Set(count.count.at[0]?.keys).size, "every key of the six members, each once").toBe(new Set(answer.facts.records.objects.flatMap((record) => record.place?.keys ?? [])).size);
    expect(answer.facts.places).toEqual(count.count.at);
  });

  test("members on two sheets name both places — never one of them", () => {
    let flip = 0;
    const at = (): AskPlace => ({ drawingId: "bnbc", layoutName: flip++ % 2 === 0 ? "S-10" : "S-04", sheetLabel: null, keys: [`DXF_HANDLE:${String(flip)}`] });
    const count = statementOf(answered("How many C3 columns are on 5F?", readBackSources({ memberAt: at })), "COUNT");
    expect(count.count.at.map((place) => place.layoutName)).toEqual(["S-10", "S-04"]);
  });
});

describe("two subjects asked are two answers, never one subject's figure nor every subject's (§1.2, I-494)", () => {
  /** The two readings a compound offers, each answered as the person would choose it. */
  const eachOf = (question: string): Extract<AskAnswer, { outcome: "ANSWERED" }>[] => {
    const clarify = answerStatement({ question }, SOURCES);
    if (clarify.outcome !== "CLARIFY" || clarify.lead !== "COMPOUND") return expect.fail(`"${question}" must be a compound clarify, and it was ${JSON.stringify(clarify)}`);
    return clarify.offered.map((offer) => answered(question, SOURCES, { reading: offer.reading }));
  };
  /** The exact sum of COMPLETE, unstruck lines of these rows. */
  const summed = (keep: (line: ReturnType<typeof linesOf>[number]) => boolean): string =>
    linesOf()
      .filter((line) => keep(line) && line.coverage === "COMPLETE" && !line.repudiated)
      .reduce((total, line) => total.plus(exact(line.value ?? "0")), exact("0"))
      .toString();

  test("the column concrete on 5F and on 6F: each level's own figure, neither the building's", () => {
    const [five, six] = eachOf("What is the column concrete on 5F and 6F?").map((answer) => statementOf(answer, "QUANTITY"));
    expect(exact(five?.figure?.value ?? "").toString()).toBe(summed((line) => line.class === "column" && line.kind === "rcc.concrete" && line.level === "5F"));
    expect(exact(six?.figure?.value ?? "").toString()).toBe(summed((line) => line.class === "column" && line.kind === "rcc.concrete" && line.level === "6F"));
    expect(face(five?.figure)).not.toBe("93.893");
  });

  test("the concrete for columns and pile caps: each class's own, and never the piles' folded in", () => {
    const answers = eachOf("What is the concrete for columns and pile caps?");
    const [columns, caps] = answers.map((answer) => statementOf(answer, "QUANTITY"));
    expect(face(columns?.figure)).toBe("93.893");
    expect(exact(caps?.figure?.value ?? "").toString()).toBe(summed((line) => line.class === "pile_cap" && line.kind === "rcc.concrete"));
    const asked = exact(columns?.figure?.value ?? "0").plus(exact(caps?.figure?.value ?? "0"));
    const everyClass = exact(summed((line) => line.kind === "rcc.concrete"));
    expect(asked.lessThan(everyClass), "the two classes asked come to less than concrete measured so far, which holds the piles").toBe(true);
    for (const answer of answers) expect(answer.routedBy, "a compound's reading is the person's choice").toBe("PERSON");
  });

  test("C3 and C4 counted: each mark's own count", () => {
    const [c3, c4] = eachOf("How many C3 and C4 columns are there?").map((answer) => statementOf(answer, "COUNT"));
    const counted = (mark: string): string => String(objectsOf().filter((object) => object.mark === mark && object.class === "column" && object.corroboration !== "REPUDIATED").length);
    expect(c3?.count.value).toBe(counted("C3"));
    expect(c4?.count.value).toBe(counted("C4"));
  });

  test("columns and pile caps by mark: each class's marks only, never the beams' and the piles'", () => {
    const [columns, caps] = eachOf("How many columns and pile caps of each type?").map((answer) => statementOf(answer, "MARKS"));
    expect(columns?.marks.every((row) => row.class === "column")).toBe(true);
    expect(caps?.marks.map((row) => [row.mark, row.count])).toEqual([
      ["PC1", 4],
      ["PC2", 14],
      ["PC3", 5],
      ["PC4", 2],
      ["PC5", 1],
    ]);
  });

  test("why the beams and the columns are not measured: each class's own lines", () => {
    const [beams, columns] = eachOf("Why are the beams and columns not measured?").map((answer) => statementOf(answer, "WHY_NOT_MEASURED"));
    const partial = (klass: string): number => linesOf().filter((line) => line.class === klass && line.coverage !== "COMPLETE" && !line.repudiated).length;
    expect(beams?.lines).toBe(partial("beam"));
    expect(columns?.lines).toBe(partial("column"));
    const everyClass = linesOf().filter((line) => line.coverage !== "COMPLETE" && !line.repudiated).length;
    expect((beams?.lines ?? 0) + (columns?.lines ?? 0), "the pile caps' PARTIAL lines were not asked about").toBeLessThan(everyClass);
  });

  test("a level the stack does not hold is refused, never answered as the whole building", () => {
    const answer = answerStatement({ question: "What is the column concrete on 9F?" }, SOURCES);
    expect(answer).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_SUBJECT_UNKNOWN.code, held: { subject: "LEVELS" } });
  });
});

describe("routing: the grammar, the person, the follow-up", () => {
  test("a clarify is answered, not guessed; the person's choice is answered PERSON-routed", () => {
    const clarify = answerStatement({ question: "How many C3 columns are on level 5?" }, SOURCES);
    expect(clarify.outcome).toBe("CLARIFY");
    const chosen = clarify.outcome === "CLARIFY" ? clarify.offered[1]?.reading : undefined;
    if (chosen === undefined) return expect.fail("the clarify offers two readings");
    const answer = answered("How many C3 columns are on level 5?", SOURCES, { reading: chosen });
    expect(answer.routedBy).toBe("PERSON");
    expect(answer.reading.level).toBe("4F");
    expect(statementOf(answer, "COUNT").count.value).toBe("6");
  });

  test("a follow-up is read against the previous answer's reading, and says so", () => {
    const first = answered("How many C3 columns are on 5F?");
    const next = answered("and on 6F?", SOURCES, { previous: first.reading });
    expect(next.followUp).toBe(true);
    expect(next.reading).toMatchObject({ intent: "COUNT", mark: "C3", level: "6F" });
  });

  test("a previous reading the project does not hold is not read against", () => {
    const tampered: AskReading = { intent: "COUNT", class: "column", kind: null, mark: "C99", level: "5F", by: null, noteKind: null, discipline: null, unitAsked: null };
    const answer = answerStatement({ question: "and on 6F?", previous: tampered }, SOURCES);
    expect(answer).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_NOT_UNDERSTOOD.code });
  });

  test("the refusals are answers too, by their registered codes", () => {
    expect(answerStatement({ question: "What will the column concrete cost?" }, SOURCES)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_ESTIMATE_NOT_BUILT.code });
    expect(answerStatement({ question: "Is C3 safe?" }, SOURCES)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_JUDGEMENT_NOT_OFFERED.code });
    expect(answerStatement({ question: "What is the slab concrete?" }, SOURCES)).toMatchObject({ outcome: "REFUSED", code: REFUSALS.ASK_NOT_MEASURED.code });
  });
});
