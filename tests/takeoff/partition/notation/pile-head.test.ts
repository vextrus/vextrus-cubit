/**
 * The pile head's height into the cap, read off a set's own notes (I-544, I-597): the clause a
 * pile cap's owned sentence binds as `e`, read by the notation in the unit the drawing wrote or
 * declared, and never read where the words state only the bars, only a minimum, another member, or
 * no unit at all.
 */
import { describe, expect, test } from "vitest";
import { pileHeadClausesOf, pileHeadOf, type ViewText } from "@/modules/takeoff/partition/notation/pile-head";

const text = (sourceKey: string, said: string): ViewText => ({ sourceKey, text: said });

/** F-RCC6-BNBC Rev C's S-05 note, as the two TEXT entities the PILE CURTAILMENT & SPIRAL ZONES view carries. */
const S05 = [text("K-1", 'MAIN BARS EXTENDED 3" INTO THE CAP'), text("K-2", "AND 40d (800) ABOVE THE CUT-OFF")];

describe("the head's own clause states e", () => {
  test.each([
    ["PILE HEAD TO BE EMBEDDED 75mm INTO THE PILE CAP", "75", "mm"],
    ['PILES SHALL PROJECT 3" INTO CAP', "3", "in"],
    ["HEAD OF PILE EMBEDDED 0'-3\" INTO THE CAP", "3", "in"],
    ["pile head shall be embedded 75 MM into pile cap.", "75", "mm"],
  ])("%s → %s %s, RESOLVED", (said, value, unit) => {
    const [read] = pileHeadClausesOf([text("K", said)], null);
    expect(read).toMatchObject({ stated: true, standing: "RESOLVED", value, unit, sourceKeys: ["K"] });
  });

  test("a bare figure is in the unit the drawing declares, and in none where it declares none", () => {
    expect(pileHeadClausesOf([text("K", "PILE HEADS EMBEDDED 75 INTO THE CAP")], "mm")[0]).toMatchObject({ stated: true, value: "75", unit: "mm" });
    expect(pileHeadClausesOf([text("K", "PILE HEADS EMBEDDED 75 INTO THE CAP")], null)[0]).toMatchObject({ stated: false, reason: "UNIT_UNSTATED" });
  });

  test("a maximum is a bound the cap is deducted at (BOUNDED); a minimum is no reading — deducting at it would read over", () => {
    expect(pileHeadClausesOf([text("K", "PILE HEAD EMBEDDED NOT MORE THAN 100mm INTO THE CAP")], null)[0]).toMatchObject({ stated: true, standing: "BOUNDED", value: "100", unit: "mm" });
    expect(pileHeadClausesOf([text("K", "PILE HEAD EMBEDDED MIN 75mm INTO THE CAP")], null)[0]).toMatchObject({ stated: false, reason: "MINIMUM_ONLY" });
    expect(pileHeadClausesOf([text("K", "PILES TO PROJECT NOT LESS THAN 3\" INTO PILE CAP")], null)[0]).toMatchObject({ stated: false, reason: "MINIMUM_ONLY" });
  });

  test.each([
    ["PILE HEAD EMBEDDED 75mm (MIN) INTO THE CAP"],
    ["PILE HEAD EMBEDDED 75mm (MIN.) INTO THE CAP"],
    ["PILE HEAD EMBEDDED 75mm MINIMUM INTO THE CAP"],
    ["PILE HEAD EMBEDDED 75mm MIN. INTO THE CAP"],
    ["PILE HEAD EMBEDDED 75mm INTO THE CAP (MIN)"],
    ["PILE HEAD EMBEDDED 75mm INTO THE CAP MINIMUM"],
    ['PILE HEAD EMBEDDED 3" (75mm MINIMUM) INTO THE PILE CAP'],
  ])("a minimum written after the figure or the cap is still a minimum: %s → MINIMUM_ONLY", (said) => {
    expect(pileHeadClausesOf([text("K", said)], "mm")).toMatchObject([{ stated: false, reason: "MINIMUM_ONLY", sourceKey: "K" }]);
  });

  test.each([
    ["PILE HEAD EMBEDDED 100mm (MAX) INTO THE CAP"],
    ["PILE HEAD EMBEDDED 100mm MAXIMUM INTO THE CAP"],
    ["PILE HEAD EMBEDDED 100mm INTO THE CAP (MAX.)"],
  ])("a maximum written after the figure or the cap bounds it: %s → BOUNDED", (said) => {
    expect(pileHeadClausesOf([text("K", said)], "mm")).toMatchObject([{ stated: true, standing: "BOUNDED", value: "100", unit: "mm" }]);
  });

  test("a bracket that states no bound is an aside: the figure is read outright", () => {
    expect(pileHeadClausesOf([text("K", 'PILE HEAD EMBEDDED 3" (75) INTO THE CAP')], "mm")).toMatchObject([{ stated: true, standing: "RESOLVED", value: "3", unit: "in" }]);
  });
});

describe("the bars' clause states e only with their run above the cut-off beside it", () => {
  test("S-05's two lines: 3 in, RESOLVED, cited to the bars' clause and then the cut-off's", () => {
    const read = pileHeadClausesOf(S05, "mm");
    expect(read).toEqual([{ stated: true, standing: "RESOLVED", value: "3", unit: "in", sourceKeys: ["K-1", "K-2"], clause: 'MAIN BARS EXTENDED 3" INTO THE CAP' }]);
  });

  test("the two clauses in one MTEXT, a paragraph apart, read the same and cite the one entity", () => {
    const read = pileHeadClausesOf([text("M", 'MAIN BARS EXTENDED 3" INTO THE CAP\\PAND 40d (800) ABOVE THE CUT-OFF')], "mm");
    expect(read).toMatchObject([{ stated: true, value: "3", unit: "in", sourceKeys: ["M"] }]);
  });

  test("the bars' clause alone states where the bars end, never the concrete: BARS_ONLY", () => {
    expect(pileHeadClausesOf([S05[0] as ViewText], "mm")).toMatchObject([{ stated: false, reason: "BARS_ONLY", sourceKey: "K-1" }]);
    // a cut-off stated with no run above it is no run of the bars
    expect(pileHeadClausesOf([S05[0] as ViewText, text("K-3", "CURTAILED AT 12000 FROM CUT-OFF")], "mm")).toMatchObject([{ stated: false, reason: "BARS_ONLY" }]);
  });

  test("another member's bars into the cap are never the pile's head, cut-off or none", () => {
    for (const said of [
      'COLUMN BARS EXTENDED 3" INTO THE CAP',
      "STARTER BARS EXTENDED 600 INTO PILE CAP",
      "WALL REINFORCEMENT EMBEDDED 75mm INTO THE CAP",
      "DOWEL BARS EXTENDED 600 INTO THE PILE CAP",
      'PILE CAP BARS EXTENDED 3" INTO THE CAP',
    ]) {
      expect(pileHeadClausesOf([text("K", said), S05[1] as ViewText], "mm"), said).toMatchObject([{ stated: false, reason: "NOT_THE_PILE" }]);
    }
  });

  test("a multiple of the bar into the cap is no length: nothing is read", () => {
    expect(pileHeadClausesOf([text("K", "MAIN BARS EXTENDED 40d INTO THE CAP"), S05[1] as ViewText], "mm")).toEqual([]);
  });
});

describe("one height for the revision", () => {
  test("every statement agreeing — in whichever unit — is one height, the first cited", () => {
    const one = pileHeadClausesOf(S05, "mm");
    const other = pileHeadClausesOf([text("G", "PILE HEAD TO BE EMBEDDED 76.2mm INTO THE PILE CAP")], "mm");
    expect(pileHeadOf([...one, ...other])).toMatchObject({ value: "3", unit: "in", sourceKeys: ["K-1", "K-2"] });
  });

  test("two statements disagreeing are no height (L-REG-03), and a decline never outvotes a statement", () => {
    const one = pileHeadClausesOf(S05, "mm");
    const other = pileHeadClausesOf([text("G", "PILE HEAD TO BE EMBEDDED 75mm INTO THE PILE CAP")], "mm");
    expect(pileHeadOf([...one, ...other])).toBeNull();
    expect(pileHeadOf([...one, ...pileHeadClausesOf([text("B", 'COLUMN BARS EXTENDED 9" INTO THE CAP')], "mm")])).toMatchObject({ value: "3" });
    expect(pileHeadOf([])).toBeNull();
  });
});
