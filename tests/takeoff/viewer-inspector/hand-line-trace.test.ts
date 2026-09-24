/**
 * The Trace of a hand line in a QS's words (s-measure I-662, walk-2 BD-2): the area a ring
 * traced in the drawing's square millimetres is read in square metres at three places — never
 * `32,88,38,371.244…` mm² — and the variable read off the hand trace says so in words, never as its
 * `act:` key. The exact reading stays on the row's `data-` hooks, which the journeys read.
 *
 * @vitest-environment jsdom
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { stringTable } from "./support/inspector-support";
import { all, aTrace, anEvidence, keyOf, mountInspector, text } from "./support/trace-support";

afterEach(() => cleanup());

const ACT = "act:d30a6f1e-0000-4000-8000-000000000001";
const AREA = "328838371.2443629162090408955";

function handEvidence() {
  return anEvidence({
    objectKey: "~m.b2e1ef5d1e45b81f",
    elementClass: "slab",
    member: { mark: "75 CC blinding under SOG", level: "GF" },
    kind: "pcc.blinding",
    value: "23.1951589143271937113530671625",
    formula: "A × t",
    variables: {
      A: { value: AREA, unit: "mm2", basis: "MEASURED", source: ACT },
      t: { value: "75", unit: "mm", basis: "TRANSCRIBED", source: keyOf(0x1a4) },
    },
    traceKeys: [keyOf(0x1a4)],
    sourceSheets: { [ACT]: "S-08 GRADE BEAM", [keyOf(0x1a4)]: "S-08 GRADE BEAM" },
    sheetLabels: { "S-08 GRADE BEAM": "S-08" },
  });
}

describe("I-662: a hand line's Trace reads in a QS's words", () => {
  test("the traced area is read in m² at three places; the exact mm² reading stays on the row", async () => {
    const root = await mountInspector({ selection: [], trace: aTrace({ evidence: handEvidence() }) });
    const [area, thickness] = all(root, "viewer-inspector-trace-variable");
    const reading = area?.querySelector(".cx-viewer-trace-reading") as HTMLElement;
    expect(text(reading), "328,838,371.244… mm² is 328.838 m²").toContain("328.838");
    expect(text(reading)).not.toContain("371");
    expect(reading.querySelector("[data-value]")?.getAttribute("data-value")).toBe("328.838");
    expect([area?.getAttribute("data-value"), area?.getAttribute("data-unit")], "the row keeps what the line was bound with").toEqual([AREA, "mm2"]);
    expect(text(thickness?.querySelector(".cx-viewer-trace-reading") as HTMLElement), "a thickness in millimetres is its own reading").toContain("75");
  });

  test("a variable read off the hand trace says so in words, beside its sheet — never its act key", async () => {
    const table = await stringTable();
    const root = await mountInspector({ selection: [], trace: aTrace({ evidence: handEvidence() }) });
    const [area, thickness] = all(root, "viewer-inspector-trace-variable");
    const source = area?.querySelector(".cx-viewer-trace-source") as HTMLElement;
    expect(text(source)).toContain(table.trace_source_hand as string);
    expect(text(source)).toContain("S-08");
    expect(text(source), "the act's key is an identity no QS reads").not.toContain("act:");
    expect(area?.getAttribute("data-source"), "and it stays on the row's hook").toBe(ACT);
    expect(text(thickness?.querySelector(".cx-viewer-trace-source") as HTMLElement), "a drawing key keeps its identifier chip").not.toContain(table.trace_source_hand as string);
  });
});
