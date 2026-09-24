/**
 * I-619 — the Trace's sixth scheme: an `act:` key a line cites is read through to the entities the hand
 * measurement that act recorded was traced on. A blinding line's t, ENTERED at the card, is cited at
 * the act that recorded it (s-measure I-384); without this reading it named no entity and the Trace
 * fell silent on it. Pure: what the store answers (`actSourcesOf`) is handed in as the map it builds.
 */
import { describe, expect, test } from "vitest";
import { actSourceOf } from "@/core/identity";
import { tracedLineOf, tracedSourcesOf } from "@/modules/takeoff/trace";

const ACT = "66666666-6666-4666-8666-666666666666";
const SOG = "DXF_HANDLE:81D";
const PIT = "DXF_HANDLE:830";

/** A stored trace as the act judged it: 81D's five points, the lift pit's four, one free point. */
const TRACED = {
  geometry: "POLYGON",
  outer: [
    { x: "0", y: "0", basis: "MEASURED", sources: [SOG] },
    { x: "1", y: "0", basis: "MEASURED", sources: [SOG] },
    { x: "1", y: "1", basis: "ENTERED", sources: [] },
  ],
  cutouts: [{ role: "OPENING", ring: [{ x: "0.2", y: "0.2", basis: "MEASURED", sources: [PIT] }] }],
};

/** A blinding line: A cites the outline it was traced on, t the act a person entered it at. */
const LINE = {
  viewKey: "",
  bindings: {
    A: { value: "328.838", unit: "m2", basis: "MEASURED", source: SOG },
    t: { value: "75", unit: "mm", basis: "ENTERED", source: actSourceOf(ACT) },
  },
};

describe("I-619: the Trace reads an act: key through to its hand measurement's ring", () => {
  test("a stored trace's source keys, every ring, each once, in the order drawn", () => {
    expect(tracedSourcesOf(TRACED)).toEqual([SOG, PIT]);
    expect(tracedSourcesOf({ geometry: "POLYLINE", run: [{ sources: [PIT] }, { sources: [SOG, PIT] }] })).toEqual([PIT, SOG]);
    expect(tracedSourcesOf(null), "a trace nobody can read names nothing").toEqual([]);
  });

  test("with the act's ring known, the line's entities are the ring's; without it, the act names none", () => {
    const acts = new Map([[actSourceOf(ACT), tracedSourcesOf(TRACED)]]);
    expect(tracedLineOf(LINE, null, acts).entities).toEqual([SOG, PIT]);
    expect(tracedLineOf(LINE, null).entities, "an act is on no sheet until it is read through").toEqual([SOG]);
  });
});
