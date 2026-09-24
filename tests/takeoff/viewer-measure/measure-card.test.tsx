// @vitest-environment jsdom
/**
 * S6's QS outcome, in the mounted viewer (docs/design/s-measure.md § 2.5, § 3, § 9, I-373, I-377,
 * I-616 … I-619): on S-08 as the product draws it, the QS picks "75 CC blinding under SOG", traces
 * the SOG's own outline (81D) and presses Enter — and the card opens at the closing point: the one
 * ConsequenceDialog over RECORD_MANUAL_MEASUREMENT, anchored, stating what was traced, on the view it
 * stands in, at the level its caption states, under the condition's recipe. Picking note 828 for t
 * re-previews it TRANSCRIBED; X cuts the lift pit out and the card opens again over the outline less
 * it; Confirm records, the outline clears and the cell says so; Escape keeps the outline as a draft.
 *
 * The doors are the route's shapes in memory: what the card SENDS is what is proved here, and what the
 * act makes of it is proved live (`tests/takeoff/manual/record-manual-measurement.test.ts`, the J-000
 * leg `m4-sheet-and-manual-measure`).
 */
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Consequence } from "@/core/acts";
import type { CardDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/measure-card";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { BLINDING, listed, memoryChest } from "../manual/support/chest-doors";
import { spaceOf } from "@/modules/takeoff/measure/card";
import { S08_PIT, S08_SOG, S08_VIEW, s08Paper, s08PaperLayout } from "./support/s08";
import { PIT_KEY, SOG_KEY, click, key, mountMeasure, unmountMeasure, type MeasureMount } from "./support/measure-screen";

afterEach(() => {
  unmountMeasure();
});

const GF = "44444444-4444-4444-8444-444444444444";
const FIRST = "55555555-5555-4555-8555-555555555555";
const NOTE = "DXF_HANDLE:828";
const CONDITION = "00000000-0000-4000-8000-000000000001";
const MODEL_LAYOUT = { name: "model", kind: "model", bbox: null, strays_rejected: 0, viewports: [] };

type StatedPoint = { x: number; y: number; cites: string[] };
type Stated = { input: { viewKey: string; layoutName: string; level: unknown; recipe: { readings: { basis: string; sourceKey: string | null; valueAsWritten: string }[] }; geometry: { geometry: string; outer: StatedPoint[]; cutouts: { role: string; ring: StatedPoint[] }[] } } };

/** A stated ring, against the model ring it was drawn from: carried back through the window to within float noise. */
function expectModel(ring: readonly StatedPoint[], model: readonly (readonly [number, number])[]): void {
  expect(ring.length).toBe(model.length);
  ring.forEach((point, at) => {
    expect(point.x).toBeCloseTo((model[at] as readonly [number, number])[0], 6);
    expect(point.y).toBeCloseTo((model[at] as readonly [number, number])[1], 6);
  });
}

/** What the act's preview answers for a blinding over 81D: the gate's own figure and formula (I-384). */
function previewed(stated: Stated): Consequence {
  const reading = stated.input.recipe.readings[0];
  return {
    actType: "RECORD_MANUAL_MEASUREMENT",
    tenantId: "t",
    projectId: "p",
    rendering: "MEASUREMENT",
    subjects: [{ subjectId: "v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.0123456789abcdef|-125.0,-400125.0@GF", subjectLabel: null, before: [], after: ["REGISTERED"] }],
    measurement: {
      objectKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.0123456789abcdef|-125.0,-400125.0@GF",
      supersedes: null,
      replaces: null,
      recipe: { conditionId: CONDITION, conditionName: BLINDING.name, geometry: "POLYGON", elementClass: "slab", kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area" }], readings: [{ attribute: "t", valueAsWritten: reading?.valueAsWritten ?? "75", unitAsWritten: "mm", basis: (reading?.basis ?? "ENTERED") as "ENTERED", sourceKey: reading?.sourceKey ?? null }] },
      level: { levelId: GF },
      drawingId: "d",
      layoutName: "S-08",
      partitionViewKey: S08_VIEW,
      viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
      calibrationKey: "3f9c0000aaaa",
      factorX: "0.001",
      factorY: "0.001",
      drawnUnit: "mm",
      figureUnit: "m2",
      traced: { geometry: "POLYGON", outer: [], cutouts: [] },
      figure: { measure: "AREA", gross: "328838371.24436192623624929233379", cutouts: [] },
      basis: "MEASURED",
      demoted: 0,
      campaignId: "c",
      offered: [{ kind: "pcc.blinding", arm: "published", ruleId: "pcc.blinding.area", ruleVersion: "1", value: "24.662878", unit: "m3", formula: "count × (A − openings − junctions) × t (count = 1 pcs, A = 328.838371 m2, t = 0.075 m)", coverage: "COMPLETE", quantityBasis: reading?.basis === "TRANSCRIBED" ? "TRANSCRIBED" : "MEASURED" }],
    },
  } as unknown as Consequence;
}

/** The card's doors in memory: the read offers GF (the caption's) and note 828; preview and commit answer as the act would. */
function cardDoors(o: { refuse?: string } = {}): CardDoors & { preview: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> } {
  const read = vi.fn(async () => ({
    read: true as const,
    // S-08 is paper: its points go to the act in model space, through window 2077 (I-620).
    ...spaceOf({ layouts: [s08PaperLayout(), MODEL_LAYOUT] } as never, "S-08"),
    levels: [
      { levelId: FIRST, label: "FDN" },
      { levelId: GF, label: "GF" },
    ],
    levelId: GF,
    notes: [{ attribute: "t", sourceKey: NOTE, text: "75 THK BLINDING UNDER (EXPLODED OUTLINE)", valueAsWritten: "75", unitAsWritten: "mm" }],
  }));
  const preview = vi.fn(async (stated: Stated) => (o.refuse !== undefined ? { previewed: false as const, refusal: o.refuse } : { previewed: true as const, consequence: previewed(stated), consequenceDigest: `digest-${JSON.stringify(stated.input).length}` }));
  const commit = vi.fn(async () => ({ committed: true as const, actId: "66666666-6666-4666-8666-666666666666", objectKey: "k", measure: null }));
  return { read, preview, commit } as never;
}

const one = (testid: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const draft = (mount: MeasureMount): HTMLElement => mount.one(TESTIDS.measure.draft) as HTMLElement;
const cell = (mount: MeasureMount): HTMLElement => mount.one(TESTIDS.viewer.statusMeasure) as HTMLElement;

async function trace(mount: MeasureMount, ring: readonly (readonly [number, number])[]): Promise<void> {
  for (const point of ring) await click(mount, point);
}

/** S-08 on paper, the blinding in the chest, picked by its digit, and the SOG's outline traced and finished. */
async function finishedUnderBlinding(doors: CardDoors): Promise<MeasureMount> {
  const mount = await mountMeasure({ paper: true, chest: memoryChest({ conditions: [listed(BLINDING, CONDITION, 0)] }), card: doors });
  await waitFor(() => expect(one(TESTIDS.measure.chest)?.getAttribute("data-state")).toBe("ready"));
  await key(mount, { key: "1" });
  await trace(mount, s08Paper().sog.points ?? []);
  await key(mount, { key: "Enter" });
  return mount;
}

async function choose(testid: string, label: RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(one(testid) as HTMLElement);
  });
  const option = [...document.querySelectorAll<HTMLElement>("[role=option]")].find((held) => label.test(held.textContent ?? ""));
  expect(option, `the Select offers ${String(label)}`).toBeDefined();
  await act(async () => {
    fireEvent.click(option as HTMLElement);
  });
}

describe("S6: the card where Confirm is the act", () => {
  test("Enter under a picked condition opens the anchored card over what was traced, on its view, at the caption's level, and it states the gate's figure and formula", async () => {
    const doors = cardDoors();
    const mount = await finishedUnderBlinding(doors);
    expect(draft(mount).getAttribute("data-state"), "a finished shape under a condition stands closed, its card open (I-372)").toBe("closed");
    const card = await waitFor(() => {
      const found = one(TESTIDS.consequence.dialog);
      expect(found?.getAttribute("aria-busy"), "the preview has answered").toBeNull();
      return found as HTMLElement;
    });
    expect([card.getAttribute("data-act-type"), card.getAttribute("data-presentation")]).toEqual(["RECORD_MANUAL_MEASUREMENT", "anchored"]);

    expect(doors.read).toHaveBeenCalledWith(expect.objectContaining({ viewKey: S08_VIEW, kinds: ["pcc.blinding"], attributes: ["t"] }));
    const stated = (doors.preview.mock.calls.at(-1)?.[0] as Stated).input;
    expect([stated.viewKey, stated.layoutName, stated.level], "the view the ring stands in, the space its points are stated in — model space, S-08 being paper — and the caption's level (I-375, I-377, I-620)").toEqual([S08_VIEW, "model", { levelId: GF }]);
    expectModel(stated.geometry.outer, S08_SOG);
    expect(stated.geometry.geometry).toBe("POLYGON");
    expect(stated.geometry.outer.map((point) => point.cites), "each point cites the entity it was snapped on (R-TO-040)").toEqual(Array(5).fill([SOG_KEY]));
    expect(stated.recipe.readings.map((reading) => [reading.basis, reading.valueAsWritten, reading.sourceKey]), "t is the condition's until a note is picked").toEqual([["ENTERED", "75", null]]);

    const quantity = one(TESTIDS.consequence.measurementQuantity) as HTMLElement;
    expect([quantity.getAttribute("data-kind"), quantity.getAttribute("data-value"), quantity.getAttribute("data-unit"), quantity.getAttribute("data-coverage")]).toEqual(["pcc.blinding", "24.662878", "m3", "COMPLETE"]);
    expect(quantity.textContent, "the gate's own formula, with its bound variables (L-QTY-03)").toContain("count × (A − openings − junctions) × t");
    expect(one(TESTIDS.consequence.measurementCondition)?.textContent).toContain(BLINDING.name);
    expect(card.textContent, "the one-line scope note names the level (I-390)").toContain(fill(strings.consequence_dialog_measurement_scope, { level: "GF" }));
    expect(one(TESTIDS.consequence.confirm), "Confirm stands once the preview answered").not.toBeNull();
  });

  test("picking note 828 for t re-previews the card with t TRANSCRIBED, citing the note (§ 2.5)", async () => {
    const doors = cardDoors();
    await finishedUnderBlinding(doors);
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
    await choose(TESTIDS.consequence.measurementReadingChoice, /75 THK BLINDING UNDER/);
    await waitFor(() => expect(one(TESTIDS.consequence.measurementReading)?.getAttribute("data-basis")).toBe("TRANSCRIBED"));
    const stated = (doors.preview.mock.calls.at(-1)?.[0] as Stated).input;
    expect(stated.recipe.readings.map((reading) => [reading.basis, reading.valueAsWritten, reading.sourceKey])).toEqual([["TRANSCRIBED", "75", NOTE]]);
    expect(one(TESTIDS.consequence.measurementReading)?.getAttribute("data-source")).toBe(NOTE);
  });

  test("another level picked is the level stated; the preview is asked again", async () => {
    const doors = cardDoors();
    await finishedUnderBlinding(doors);
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
    await choose(TESTIDS.consequence.measurementLevel, /^FDN$/);
    await waitFor(() => expect((doors.preview.mock.calls.at(-1)?.[0] as Stated).input.level).toEqual({ levelId: FIRST }));
  });

  test("X on the card cuts the lift pit out; finishing it opens the card again over the outline less the opening", async () => {
    const doors = cardDoors();
    const mount = await finishedUnderBlinding(doors);
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
    await act(async () => {
      fireEvent.keyDown(window, { key: "x" });
    });
    expect(draft(mount).getAttribute("data-state"), "the card gives way to the cut-out ring").toBe("cutting");
    expect(one(TESTIDS.consequence.dialog)).toBeNull();
    await trace(mount, s08Paper().pit.points ?? []);
    await key(mount, { key: "Enter" });
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
    const stated = (doors.preview.mock.calls.at(-1)?.[0] as Stated).input;
    expect(stated.geometry.cutouts.map((cutout) => [cutout.role, cutout.ring.length]), "the pit, as an opening by default (I-389)").toEqual([["OPENING", 4]]);
    expect((stated.geometry.cutouts[0]?.ring ?? []).map((point) => point.cites)).toEqual(Array(4).fill([PIT_KEY]));
    expectModel(stated.geometry.cutouts[0]?.ring ?? [], S08_PIT);
  });

  test("Confirm commits with the digest shown; the outline clears, the tool stays armed and the cell says it was recorded", async () => {
    const doors = cardDoors();
    const mount = await finishedUnderBlinding(doors);
    const confirm = await waitFor(() => one(TESTIDS.consequence.confirm) as HTMLElement);
    const digest = confirm.getAttribute("data-digest");
    await act(async () => {
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(doors.commit).toHaveBeenCalledTimes(1));
    expect((doors.commit.mock.calls[0]?.[0] as { consequenceDigest: string }).consequenceDigest).toBe(digest);
    await waitFor(() => expect(draft(mount).getAttribute("data-state")).toBe("idle"));
    expect(mount.one(TESTIDS.viewer.toolArea)?.getAttribute("aria-pressed"), "the dialog closing after a commit is no Escape: Area stays armed").toBe("true");
    expect(one(TESTIDS.consequence.dialog)).toBeNull();
    expect(cell(mount).textContent).toContain(strings.measure_status_recorded);
  });

  test("Escape on the card keeps the outline on the sheet as a draft, and says so; Enter opens it again", async () => {
    const doors = cardDoors();
    const mount = await finishedUnderBlinding(doors);
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
    await act(async () => {
      fireEvent.keyDown(one(TESTIDS.consequence.dialog) as HTMLElement, { key: "Escape" });
    });
    await waitFor(() => expect(draft(mount).getAttribute("data-state")).toBe("draft"));
    expect(doors.commit).not.toHaveBeenCalled();
    expect(cell(mount).textContent).toContain(strings.measure_draft_kept);
    await key(mount, { key: "Enter" });
    await waitFor(() => expect(one(TESTIDS.consequence.confirm)).not.toBeNull());
  });

  test("a refused preview renders the registry's refusal in the card and no Confirm (I-41)", async () => {
    const doors = cardDoors({ refuse: "MANUAL_LEVEL_UNSTATED" });
    await finishedUnderBlinding(doors);
    await waitFor(() => expect(one("refusal-state")).not.toBeNull());
    expect(one(TESTIDS.consequence.confirm)).toBeNull();
  });
});
