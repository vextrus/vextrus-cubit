/**
 * The strings a Dhaka set writes that the grammar could not read — one case per finding of the P3
 * adversary pass over the fixture's own corpus (3,102 drawn strings of F-RCC6-BNBC). Each was RED
 * before the row that reads it was added to the GRAMMAR table, and each names what the product loses
 * while it stays RED: a member that never reaches a bill (L-QTY-04), or a phantom one that does.
 *
 * Nothing here opens a store, a clock or a model: the grammar is total over strings.
 */
import { describe, expect, test } from "vitest";
import { readNotation } from "@/modules/takeoff/partition/notation/grammar";

const reading = (said: string): string => {
  const read = readNotation(said);
  return read.ok ? `${read.kind}:${JSON.stringify(read.parsed)}` : `UNREAD(${read.token})`;
};

describe("N1 — the storey-keyed mark roster (135 of the corpus's 714 mark strings)", () => {
  test.each(["1B12", "2B7", "1CB3", "1EB2", "SB-R4"])("%s is a member mark, not an unread cell", (said) => {
    const read = readNotation(said);
    expect(read.ok, `"${said}" is the whole first-floor beam roster — unread, it is a member that never reaches a bill`).toBe(true);
    expect(read.ok && read.kind).toBe("mark");
  });

  test("the storey digit is read as the level the mark names, not as part of the class", () => {
    const read = readNotation("1B12");
    expect(read.ok && read.parsed).toStrictEqual({ family: "B", number: 12, level: "1", variant: null, part: null });
  });

  test.each(["MRR", "FL", "SOG", "RAMP"])("%s is the mark this set writes as a word", (said) => {
    expect(reading(said)).toContain("mark");
  });
});

describe("N5 — a sheet number and a detail bubble are never members", () => {
  test.each(["S-00", "S-03", "S-26", "A1", "A2", "3/S-03"])("%s reads as a reference", (said) => {
    const read = readNotation(said);
    expect(read.ok && read.kind, `"${said}" minted a phantom member on every sheet of the set while F-MARK read it`).toBe("reference");
  });

  test("the slab mark and the sheet number are told apart by the set's own spelling", () => {
    expect(reading("S3")).toContain("mark");
    expect(reading("S-03")).toContain("reference");
  });
});

describe("N7 — an ambiguous designator is settled by evidence, not by the order of the table", () => {
  test("T16 is a 16 mm bar because T is not a member class on this set's roster", () => {
    const read = readNotation("T16");
    expect(read.ok && read.kind).toBe("bar_diameter");
    expect(read.ok && read.parsed).toStrictEqual({ diameterMm: 16, designation: "T16" });
  });

  test("a mark class and a bar designator are disjoint — were they not, the reading would turn on table order", () => {
    const read = readNotation("TG1");
    expect(read.ok && read.kind, "TG is a mark class and TG1 is a transfer girder, not a 1 mm bar").toBe("mark");
  });
});

describe("N2 — a two-zone tie spacing (33 corpus strings: every column tie call)", () => {
  test("both pitches are read, and the diameter is not lost with them", () => {
    const read = readNotation("10%%C@100/150 (TIES)");
    expect(read.ok, "the whole string was refused for want of a form for `100/150`, and the 10Ø went with it").toBe(true);
    expect(read.ok && read.parsed).toStrictEqual({
      bar: { diameterMm: 10, designation: "10Ø" },
      spacingMm: 100,
      zones: [{ zone: "end", spacingMm: 100 }, { zone: "mid", spacingMm: 150 }],
      legs: null,
    });
  });

  test("a one-pitch call still states no zones — the reading says what the cell said", () => {
    const read = readNotation("Ø16@150 c/c");
    expect(read.ok && (read.parsed as { zones: unknown }).zones).toBe(null);
  });
});

describe("N3 — a cover note names what it covers (all four notes on the fixture do)", () => {
  test.each([
    ["25mm clear cover (beams)", 25, "BEAMS"],
    ["40mm clear cover (columns)", 40, "COLUMNS"],
    ["20mm clear cover (slabs)", 20, "SLABS"],
    ['2" clear cover (pile caps)', 50.8, "PILE CAPS"],
  ])("%s is a cover of that scope", (said, mm, scope) => {
    const read = readNotation(String(said));
    expect(read.ok, "the COVER form was anchored at the end, so every scoped note — which is every real one — was refused").toBe(true);
    expect(read.ok && read.parsed).toStrictEqual({ mm, scope });
  });

  test("a note that states no scope states none, rather than borrowing one", () => {
    expect(readNotation("CLEAR COVER = 40 MM").ok && (readNotation("CLEAR COVER = 40 MM") as { parsed: { scope: unknown } }).parsed.scope).toBe(null);
  });
});

describe("N4 — a level mark carries its millimetre whether or not it was written with an `=`", () => {
  test.each([
    [`EL +11'-0"`, 3352.8],
    [`E.G.L (-1'-6")`, -457.2],
    ["+3.353", 3353],
  ])("%s is a dimension", (said, mm) => {
    const read = readNotation(String(said));
    expect(read.ok, `"${said}" is one of the four level marks of the fixture the LABELLED form's "=" refused`).toBe(true);
    expect(read.ok && read.kind).toBe("dimension_ft_in");
    expect(read.ok && (read.parsed as { mm: number }).mm).toBe(mm);
  });

  test("a bare integer is still no dimension — a cell that states no unit states no length", () => {
    expect(reading("300")).toContain("UNREAD");
  });
});

describe("a curtailment stated as a part of the span (106 corpus strings)", () => {
  test.each([
    ["L/4", { of: "L", numerator: 1, denominator: 4 }],
    ["Ln/3", { of: "LN", numerator: 1, denominator: 3 }],
    ["0.25L", { of: "L", numerator: 0.25, denominator: 1 }],
  ])("%s is a span fraction, exactly", (said, parsed) => {
    const read = readNotation(String(said));
    expect(read.ok && read.parsed).toStrictEqual(parsed);
  });

  test("a bare L states no part of anything", () => {
    expect(reading("L")).toContain("UNREAD");
  });
});

describe("N6 — a compound cell keeps every call it states, or refuses the cell", () => {
  test("2-12Ø T&B + 8Ø @ 150 reads BOTH groups", () => {
    const read = readNotation("2-12%%C T&B + 8%%C @ 150");
    expect(read.ok).toBe(true);
    const parts = read.ok ? (read.parsed as { parts: { kind: string; parsed: { diameterMm?: number; bar?: { diameterMm: number } } }[] }).parts : [];
    expect(parts.map((part) => part.kind)).toStrictEqual(["bar_group", "spacing"]);
    expect(JSON.stringify(parts), "F-SPACING kept bars[last] and dropped `2-12Ø T&B` in silence").toContain("12");
  });

  test.each(["3T16 + 2Y16", "4-20%%C + 3-20%%C", "2-20%%C st. + 1-20%%C ext."])("%s states two groups and reads two", (said) => {
    const read = readNotation(said);
    expect(read.ok).toBe(true);
    expect(read.ok && (read.parsed as { parts: unknown[] }).parts).toHaveLength(2);
  });

  test("a cell one of whose parts no form reads is REFUSED whole — never read as the part that happened to fit", () => {
    const read = readNotation("2(A+B) + 2C - 2.5r - 5d");
    expect(read.ok, "a shape-code formula is not two bar groups").toBe(false);
  });
})
