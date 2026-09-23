/**
 * R-UI-042's gesture grammar (s-measure I-372, I-499) as the pure machine answers it: every row of
 * the table a hand or a keyboard can reach, driven through `step` alone — no DOM, no camera.
 *
 * The rings are S-08's own (F-RCC6-BNBC, `fixtures/rcc6-bnbc/rcc6-bnbc.dxf`): the SOG outline, POLYLINE
 * 81D, and the lift pit, LWPOLYLINE 830, at the decimal spellings the DXF carries — the ring J-000's
 * manual leg traces (I-393).
 */
import { describe, expect, test } from "vitest";
import { NO_DRAFT, anchorOf, busy, step, type GestureContext, type GestureInput, type MeasureDraft, type MeasurePoint, type MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { S08_PIT, S08_SOG } from "./support/s08";

const measured = (at: readonly [number, number], key = "DXF_HANDLE:81D"): MeasurePoint => ({ at, basis: "MEASURED", sourceKeys: [key] });
const free = (at: readonly [number, number]): MeasurePoint => ({ at, basis: "ENTERED", sourceKeys: [] });

function context(tool: MeasureTool, o: { rectangle?: boolean; card?: boolean } = {}): GestureContext {
  return { tool, rectangle: o.rectangle ?? false, card: o.card ?? false, corner: (at) => free(at) };
}

/** Drive a run of inputs from nothing, answering the last step and every note on the way. */
function drive(inputs: readonly GestureInput[], ctx: GestureContext, from: MeasureDraft = NO_DRAFT): { draft: MeasureDraft; notes: (string | null)[] } {
  let draft = from;
  const notes: (string | null)[] = [];
  for (const input of inputs) {
    const next = step(draft, input, ctx);
    draft = next.draft;
    notes.push(next.note?.kind ?? null);
  }
  return { draft, notes };
}

const trace = (ring: readonly (readonly [number, number])[]): GestureInput[] => ring.map((at) => ({ kind: "point", point: measured(at) }));

describe("I-372: Enter and the double-click finish a shape with enough points", () => {
  test("Area: five endpoints of 81D and Enter close the ring; with no card it stands as a draft", () => {
    const { draft, notes } = drive([...trace(S08_SOG), { kind: "finish" }], context("area"));
    expect(draft.phase, "no card opens in a tool with no condition, so the finished outline is a draft (I-497)").toBe("draft");
    expect(draft.outer.map((point) => point.at)).toEqual(S08_SOG);
    expect(notes).toEqual(["placed", "placed", "placed", "placed", "placed", "finished"]);
  });

  test("with a card to open, the same Enter opens it, and Enter on the draft re-opens it", () => {
    const ctx = context("area", { card: true });
    const closed = drive([...trace(S08_SOG), { kind: "finish" }], ctx).draft;
    expect(closed.phase).toBe("closed");
    const kept = step(closed, { kind: "escape" }, ctx);
    expect([kept.draft.phase, kept.note?.kind], "Esc closes the card and keeps the outline, committing nothing").toEqual(["draft", "kept"]);
    expect(step(kept.draft, { kind: "finish" }, ctx).draft.phase, "Enter re-opens the card").toBe("closed");
  });

  test.each([
    { tool: "linear" as const, needs: 2 },
    { tool: "area" as const, needs: 3 },
    { tool: "count" as const, needs: 1 },
  ])("$tool finishes at $needs points and says how many it needs before then", ({ tool, needs }) => {
    const ctx = context(tool);
    const short = drive([...trace(S08_SOG.slice(0, needs - 1)), { kind: "finish" }], ctx);
    // With nothing placed there is nothing in progress, and Enter there is the table's "—".
    expect(short.notes.at(-1), `${tool} with ${needs - 1} points is not finished`).toBe(needs - 1 === 0 ? null : "too-few");
    expect(short.draft.phase).toBe(needs - 1 === 0 ? "idle" : "drawing");
    expect(drive([...trace(S08_SOG.slice(0, needs)), { kind: "finish" }], ctx).draft.phase).toBe("draft");
  });

  test("an outline that encloses nothing is not finished, and says so", () => {
    const collinear: (readonly [number, number])[] = [
      [0, 0],
      [10, 0],
      [20, 0],
    ];
    const { draft, notes } = drive([...trace(collinear), { kind: "finish" }], context("area"));
    expect([draft.phase, notes.at(-1)]).toEqual(["drawing", "degenerate"]);
  });
});

describe("I-372: Backspace removes the last point, and re-opens a finished shape", () => {
  test("drawing: the last point goes; the first point's going leaves nothing in progress", () => {
    const ctx = context("area");
    const two = drive(trace(S08_SOG.slice(0, 2)), ctx).draft;
    const one = step(two, { kind: "undo" }, ctx);
    expect(one.draft.outer.map((point) => point.at)).toEqual([S08_SOG[0]]);
    expect(step(one.draft, { kind: "undo" }, ctx).draft).toEqual(NO_DRAFT);
  });

  test("a draft re-opens for editing: the closing edge goes, and the next point extends the outline", () => {
    const ctx = context("area");
    const draft = drive([...trace(S08_SOG), { kind: "finish" }], ctx).draft;
    const reopened = step(draft, { kind: "undo" }, ctx);
    expect([reopened.draft.phase, reopened.note?.kind]).toEqual(["drawing", "reopened"]);
    expect(reopened.draft.outer).toHaveLength(5);
  });

  test("with a cut-out standing, the last ring closed is the first re-opened (I-499)", () => {
    const ctx = context("area");
    const cut = drive([...trace(S08_SOG), { kind: "finish" }, { kind: "cutout" }, ...trace(S08_PIT), { kind: "finish" }], ctx).draft;
    expect(cut.cutouts).toHaveLength(1);
    const reopened = step(cut, { kind: "undo" }, ctx).draft;
    expect([reopened.phase, reopened.cutouts.length, reopened.cutting.length]).toEqual(["cutting", 0, 4]);
  });
});

describe("I-372: Escape discards, closes the card, or leaves the tool", () => {
  test("drawing: the shape is discarded and said to be", () => {
    const { draft, notes } = drive([...trace(S08_SOG.slice(0, 3)), { kind: "escape" }], context("area"));
    expect([draft, notes.at(-1)]).toEqual([NO_DRAFT, "discarded"]);
  });

  test("a draft is discarded by a second Escape; with nothing in progress Escape leaves the tool", () => {
    const ctx = context("area");
    const draft = drive([...trace(S08_SOG), { kind: "finish" }], ctx).draft;
    const gone = step(draft, { kind: "escape" }, ctx);
    expect([gone.draft, gone.note?.kind]).toEqual([NO_DRAFT, "discarded"]);
    expect(step(NO_DRAFT, { kind: "escape" }, ctx).note?.kind, "the host returns to Select on this note").toBe("leave");
  });

  test("Escape inside a cut-out costs the cut-out, never the outline (I-499)", () => {
    const ctx = context("area");
    const cutting = drive([...trace(S08_SOG), { kind: "finish" }, { kind: "cutout" }, ...trace(S08_PIT.slice(0, 2))], ctx).draft;
    const back = step(cutting, { kind: "escape" }, ctx);
    expect([back.draft.phase, back.draft.outer.length, back.draft.cutting.length, back.note?.kind]).toEqual(["draft", 5, 0, "cutout-discarded"]);
  });
});

describe("I-372: the cut-out ring (X)", () => {
  test("the lift pit 830 is cut out of 81D and filed as a cut-out", () => {
    const { draft, notes } = drive([...trace(S08_SOG), { kind: "finish" }, { kind: "cutout" }, ...trace(S08_PIT), { kind: "finish" }], context("area"));
    expect(draft.phase).toBe("draft");
    expect(draft.cutouts.map((ring) => ring.map((point) => point.at))).toEqual([S08_PIT]);
    expect(notes.slice(-6)).toEqual(["cutout-started", "placed", "placed", "placed", "placed", "cutout-finished"]);
  });

  test("a ring reaching outside the outline is not closed, and the status can name why", () => {
    const outside = S08_PIT.map(([x, y]) => [x - 15000, y] as const);
    const { draft, notes } = drive([...trace(S08_SOG), { kind: "finish" }, { kind: "cutout" }, ...trace(outside), { kind: "finish" }], context("area"));
    expect([draft.phase, draft.cutouts.length, notes.at(-1)]).toEqual(["cutting", 0, "cutout-outside"]);
  });

  test("a second cut-out over the first is refused; one beside it is filed", () => {
    const ctx = context("area");
    const first = drive([...trace(S08_SOG), { kind: "finish" }, { kind: "cutout" }, ...trace(S08_PIT), { kind: "finish" }], ctx).draft;
    const over = drive([{ kind: "cutout" }, ...trace(S08_PIT), { kind: "finish" }], ctx, first);
    expect(over.notes.at(-1), "the pit again shares all its area with the pit").toBe("cutout-outside");
    const beside = S08_PIT.map(([x, y]) => [x - 5000, y] as const);
    expect(drive([{ kind: "cutout" }, ...trace(beside), { kind: "finish" }], ctx, first).draft.cutouts).toHaveLength(2);
  });

  test("X is Area's alone, and only on a finished outline", () => {
    expect(step(drive(trace(S08_SOG.slice(0, 3)), context("area")).draft, { kind: "cutout" }, context("area")).note).toBeNull();
    expect(step(drive([...trace(S08_SOG.slice(0, 2)), { kind: "finish" }], context("linear")).draft, { kind: "cutout" }, context("linear")).note).toBeNull();
  });
});

describe("the rows the table leaves unwritten (I-499)", () => {
  test("a tool key mid-shape never costs the outline: it is refused with 'finish first'", () => {
    const drawing = drive(trace(S08_SOG.slice(0, 3)), context("area")).draft;
    const pressed = step(drawing, { kind: "tool" }, context("area"));
    expect([pressed.draft, pressed.note?.kind]).toEqual([drawing, "finish-first"]);
    expect(busy(drawing)).toBe(true);
    expect(step(NO_DRAFT, { kind: "tool" }, context("area")).note, "with nothing in progress a tool key is free").toBeNull();
  });

  test("a click on a finished draft places nothing", () => {
    const draft = drive([...trace(S08_SOG), { kind: "finish" }], context("area")).draft;
    const clicked = step(draft, { kind: "point", point: measured([0, 0]) }, context("area"));
    expect([clicked.draft, clicked.note?.kind]).toEqual([draft, "finish-first"]);
  });

  test("a point where the last one stands adds nothing — a count never counts one symbol twice", () => {
    const counted = drive([...trace([S08_PIT[0] as readonly [number, number], S08_PIT[0] as readonly [number, number]])], context("count"));
    expect([counted.draft.outer.length, counted.notes]).toEqual([1, ["placed", "repeated"]]);
  });

  test("a count never counts one symbol twice, however many clicks ago it was counted: A, B, A counts two", () => {
    const [a, b] = S08_PIT as [readonly [number, number], readonly [number, number]];
    const counted = drive(trace([a, b, a]), context("count"));
    expect([counted.draft.outer.length, counted.notes], "the third click stands where the first was counted").toEqual([2, ["placed", "placed", "repeated"]]);
  });

  test("a path may come back to a point it passed: a run's third point may stand on its first", () => {
    const [a, b] = S08_PIT as [readonly [number, number], readonly [number, number]];
    const run = drive(trace([a, b, a]), context("linear"));
    expect([run.draft.outer.length, run.notes], "a Linear run back along an edge is two lengths, both measured").toEqual([3, ["placed", "placed", "placed"]]);
  });

  test("Rectangle: the second corner finishes the ring, and its derived corners are asked of the drawing (I-500)", () => {
    const asked: (readonly [number, number])[] = [];
    const ctx: GestureContext = { tool: "area", rectangle: true, card: false, corner: (at) => (asked.push(at), measured(at, "DXF_HANDLE:830")) };
    const [a, , c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];
    const { draft, notes } = drive([...trace([a, c])], ctx);
    expect([draft.phase, notes]).toEqual(["draft", ["placed", "finished"]]);
    expect(draft.outer.map((point) => point.at)).toEqual([a, [c[0], a[1]], c, [a[0], c[1]]]);
    expect(asked, "the two corners nobody clicked").toEqual([
      [c[0], a[1]],
      [a[0], c[1]],
    ]);
  });

  test("the constraint's anchor is the last point of the ring being drawn, and nothing for a count", () => {
    const drawing = drive(trace(S08_SOG.slice(0, 2)), context("area")).draft;
    expect(anchorOf(drawing, "area")).toEqual(S08_SOG[1]);
    expect(anchorOf(drawing, "count")).toBeNull();
    expect(anchorOf(NO_DRAFT, "area")).toBeNull();
  });
});
