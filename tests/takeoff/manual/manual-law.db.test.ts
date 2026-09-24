/**
 * MANUAL-LAW, live: what the manual act STORES for a trace a QS made with a constraint (V-DB,
 * docs/design/s-measure.md I-499, I-500).
 *
 * The client keeps a Shift or Ortho coordinate at the anchor's own spelling and derives a rectangle's
 * corners from the clicked ones exactly; the act used to put every uncited coordinate back on the
 * 0.1 lattice, so a run was stored out of square and a rectangle as a quadrilateral a lattice step
 * off it, larger by up to 0.05 drawing units per coordinate. Here each is committed through the act
 * seam over a world the shipped doors stood up, and the stored row is read back: the run square, the
 * rectangle whole, and the figure the store holds the one those points enclose.
 *
 * Product modules are loaded by absolute path after the stage has named the scratch world.
 */
import { afterAll, describe, expect, test } from "vitest";
import { actorOf, closeStage, performAct, sql, stageManualWorld, tracing, type ManualWorld } from "./support/manual-stage";

const BUDGET_MS = 600_000;

let staging: Promise<ManualWorld> | undefined;
const staged = (): Promise<ManualWorld> => (staging ??= stageManualWorld("law", 95));

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The outline a committed measurement stores, each point spelled `x,y`, and the figure the store holds for it. */
function storedOf(objectKey: string): { outer: string[]; gross: string } {
  const [traced = "{}", figure = "{}"] = sql(`select traced::text, figure::text from manual_measurements where object_key = '${objectKey}';`)[0] ?? [];
  const outer = (JSON.parse(traced) as { outer?: { x: string; y: string }[] }).outer ?? [];
  return { outer: outer.map((point) => `${point.x},${point.y}`), gross: (JSON.parse(figure) as { gross?: string }).gross ?? "" };
}

/** Commit one outline on the world's plan, and the object key the act recorded it under. */
async function commitOutline(world: ManualWorld, outer: { x: number; y: number; cites: string[] }[]): Promise<string> {
  const { consequence } = await performAct(actorOf(world.person), tracing(world, { geometry: { geometry: "POLYGON", outer, cutouts: [] } }));
  const objectKey = (consequence as { measurement?: { objectKey: string } }).measurement?.objectKey ?? "";
  expect(objectKey, "the act recorded the outline").not.toBe("");
  return objectKey;
}

describe("MANUAL-LAW: the act stores a constrained trace as it was drawn (I-499, I-500)", () => {
  test("an Ortho run from a point on the slab's west edge is stored square", async () => {
    const world = await staged();
    // Snapped on the edge x = 0 at a y no lattice holds; Shift across, Shift down, snapped back on the edge.
    const key = await commitOutline(world, [
      { x: 0, y: -37.123456, cites: [world.slabKey] },
      { x: 25.04, y: -37.123456, cites: [] },
      { x: 25.04, y: -12.37, cites: [] },
      { x: 0, y: -12.37, cites: [world.slabKey] },
    ]);
    const stored = storedOf(key);
    expect(stored.outer, "every copied coordinate the drawn point's own, every truly free one on the lattice").toEqual(["0,-37.123456", "25.0,-37.123456", "25.0,-12.37", "0,-12.37"]);
    expect(stored.gross, "25 mm × 24.753456 mm, exactly").toBe("618.8364");
  }, BUDGET_MS);

  test("a rectangle with one corner snapped on the slab's east edge and one placed by hand is stored as the rectangle", async () => {
    const world = await staged();
    const snappedCorner = { x: 40, y: -44.987654 };
    const hand = { x: 27.03, y: -19.96 };
    // The client's rectangle: first, [second.x, first.y], second, [first.x, second.y] (gesture.ts, I-500).
    const key = await commitOutline(world, [
      { ...snappedCorner, cites: [world.slabKey] },
      { x: hand.x, y: snappedCorner.y, cites: [] },
      { ...hand, cites: [] },
      { x: snappedCorner.x, y: hand.y, cites: [] },
    ]);
    const stored = storedOf(key);
    expect(stored.outer).toEqual(["40,-44.987654", "27.0,-44.987654", "27.0,-20.0", "40,-20.0"]);
    expect(stored.gross, "13 mm × 24.987654 mm, exactly").toBe("324.839502");
  }, BUDGET_MS);
});
