// @vitest-environment node
/**
 * FND-OWN, the relation: which piles each pile cap of F-RCC6-BNBC stands on, read the way the measure
 * setup reads it (I-547) — S-04's 89 pile placements laid over S-06's cap plan through the grid
 * both draw, and each cap's own ring asked which pile centres it holds. No database, no store.
 *
 * What the drawing states, and what is graded:
 *   · S-06's PILE CAP SCHEDULE prints a PILES column — 2, 3, 4, 5, 9 for PC1..PC5 — which no method
 *     binds (I-322). It is the drawing's own statement of what this relation must find, so it is the
 *     yardstick here, read off the stage's reconstructed table rather than typed.
 *   · Every one of the 89 piles stands under exactly one cap: the pile rail bills all 89, and a pile no
 *     cap held would leave its head billed in a cap twice over, one held twice would take it out twice.
 *   · The PC1 turned 45° (`5FB`) holds its two piles by its ring — its bounding box would be the
 *     wrong question — and a chamfered PC2 holds three.
 * And what refuses: two plans whose grids are no one frame — shifted on one axis label, or sharing
 * too few labels to tell — lay no cap over any pile, so no cap has an entry at all (L-QTY-01), and the
 * rails keep each such cap's row naming `CAP_PILES_UNREAD` (./cap-junctions-rails.test.ts).
 *
 * And over the WHOLE revision (FND-OWN review, I-547): a pile layout on one drawing and a cap
 * layout on another are laid over one another by the grid both draw, with each drawing's view keys and
 * handles kept apart — two files routinely spell one handle — and each cap's ring read out of its own
 * drawing.
 */
import { describe, expect, test } from "vitest";
import { capJunctionSetupOf, pilesHeldOf, pilesHeldOverRevision, ringsOf, type DrawingReading } from "@/modules/takeoff/measure/cap-junctions";
import { viewAddressOf } from "@/core/views";
import { BUDGET_MS, bnbc, capsOf, heldOver, pilesOf } from "./support/cap-junctions-stage";

/** The caption the pile-cap schedule is titled by (S-06), and the column this relation answers. */
const PILE_CAP_SCHEDULE = "DXF_HANDLE:202D";
const PILES_HEADER = "PILES";

/** The PC1 turned 45° under C6 at E1, and one chamfered PC2 (S-06's rings, I-333). */
const TURNED_PC1 = "DXF_HANDLE:5FB";
const CHAMFERED_PC2 = "DXF_HANDLE:5AF";

describe("I-547: each cap holds the piles its ring stands over, by the grid both plans draw", () => {
  test(
    "every cap holds the number of piles S-06's own schedule prints for its type, and all 89 piles are held once",
    async () => {
      const read = await bnbc();
      const caps = capsOf(read);
      const piles = pilesOf(read);
      expect(caps.length, "S-06 places its 26 caps (I-333)").toBe(26);
      expect(piles.length, "S-04 places its 89 piles (I-321)").toBe(89);

      // The schedule's own PILES column, per mark — the drawing's statement of what the plans hold.
      const table = read.reconstructed.tables.find((one) => one.scheduleKey === PILE_CAP_SCHEDULE);
      const header = (table?.cells ?? []).filter((cell) => cell.rowIndex === 0);
      const pilesColumn = header.find((cell) => cell.text.trim() === PILES_HEADER)?.columnIndex;
      const markColumn = header.find((cell) => cell.text.trim() === "MARK")?.columnIndex;
      expect(pilesColumn, "S-06's PILE CAP SCHEDULE heads a PILES column").toBeDefined();
      const printed = new Map<string, number>();
      for (const cell of table?.cells ?? []) {
        if (cell.rowIndex === 0 || cell.columnIndex !== markColumn) continue;
        const count = (table?.cells ?? []).find((one) => one.rowIndex === cell.rowIndex && one.columnIndex === pilesColumn);
        printed.set(cell.text.trim(), Number(count?.text));
      }
      expect([...printed.keys()].sort(), "the schedule prints a PILES figure for each of the five marks").toEqual(["PC1", "PC2", "PC3", "PC4", "PC5"]);

      const held = heldOver(read);
      expect(held.size, "every cap has an entry: S-04 and S-06 draw one grid, so every cap can be laid over every pile").toBe(26);
      for (const cap of caps) {
        const under = held.get(cap.placementKey) ?? [];
        expect(under.length, `${cap.mark} at ${cap.gridLetter ?? "?"}${cap.gridNumeral ?? "?"} (${cap.outlineKey}) holds the ${printed.get(cap.mark)} piles S-06's schedule prints for its type`).toBe(printed.get(cap.mark));
      }

      const holders = new Map<string, number>();
      for (const under of held.values()) for (const pile of under) holders.set(pile, (holders.get(pile) ?? 0) + 1);
      expect(holders.size, "all 89 piles stand under a cap").toBe(89);
      expect([...holders.values()].every((times) => times === 1), "and each under exactly one: a head is owned once, and deducted once").toBe(true);

      const turned = caps.find((cap) => cap.outlineKey === TURNED_PC1);
      const chamfered = caps.find((cap) => cap.outlineKey === CHAMFERED_PC2);
      expect(held.get(turned?.placementKey ?? "")?.length, "the PC1 turned 45° holds its two piles by its own ring, never its 2121 × 2121 box").toBe(2);
      expect(held.get(chamfered?.placementKey ?? "")?.length, "a chamfered PC2 holds its three inside its chamfer").toBe(3);
    },
    BUDGET_MS,
  );

  test(
    "the count is a reading: MEASURED off the two plans, cited to the cap it was taken over, in pieces",
    async () => {
      const read = await bnbc();
      const [first] = [...heldOver(read)];
      const [cap, piles] = first as [string, string[]];
      const junction = capJunctionSetupOf(cap, piles);
      expect(junction.count, "n is the held piles counted, with its provenance (L-QTY-01, L-QTY-03)").toEqual({ value: String(piles.length), unit: "pcs", basis: "MEASURED", source: cap });
      expect(junction.headHeight, "and no reader of the set states the heads' height above the soffit yet: it stands UNBOUNDED").toEqual({ reading: null, standing: "UNBOUNDED" });
      expect(junction.recess, "nor a recess cast into any cap").toBeNull();
    },
    BUDGET_MS,
  );

  test(
    "two plans whose grids are no one frame lay no cap over any pile — shifted on one label, or sharing too few",
    async () => {
      const read = await bnbc();
      const pileView = pilesOf(read)[0]?.viewKey as string;
      // Shift ONE numeral axis of the pile plan by a metre: the two grids no longer stand at one offset.
      let shifted = false;
      const skewed = heldOver(read, (axes) =>
        axes.map((axis) => {
          if (shifted || axis.viewKey !== pileView || axis.axis !== "x") return axis;
          shifted = true;
          return { ...axis, position: axis.position + 1000 };
        }),
      );
      expect(shifted, "the case moved one of the pile plan's axes").toBe(true);
      expect(skewed.size, "no cap is laid over a pile plan whose grid is not its own frame (L-QTY-01)").toBe(0);

      // Keep ONE letter axis on the pile plan: one label cannot tell a translation from a coincidence.
      let kept = false;
      const bare = heldOver(read, (axes) =>
        axes.filter((axis) => {
          if (axis.viewKey !== pileView || axis.axis !== "y") return true;
          if (kept) return false;
          kept = true;
          return true;
        }),
      );
      expect(bare.size, "a frame proven by one label per axis is no frame").toBe(0);
    },
    BUDGET_MS,
  );

  test("no pile or no cap placed, no relation; a cap whose ring was not read has no entry; a ring over no pile holds none", () => {
    const axes = [
      { viewKey: "v:CAPS", family: "numeral", axis: "x", label: "1", position: 0 },
      { viewKey: "v:CAPS", family: "numeral", axis: "x", label: "2", position: 5000 },
      { viewKey: "v:CAPS", family: "letter", axis: "y", label: "A", position: 0 },
      { viewKey: "v:CAPS", family: "letter", axis: "y", label: "B", position: 4000 },
      { viewKey: "v:PILES", family: "numeral", axis: "x", label: "1", position: 100000 },
      { viewKey: "v:PILES", family: "numeral", axis: "x", label: "2", position: 105000 },
      { viewKey: "v:PILES", family: "letter", axis: "y", label: "A", position: 0 },
      { viewKey: "v:PILES", family: "letter", axis: "y", label: "B", position: 4000 },
    ];
    const square = (cx: number, cy: number, half: number) =>
      [
        [cx - half, cy - half],
        [cx + half, cy - half],
        [cx + half, cy + half],
        [cx - half, cy + half],
      ] as const;
    const rings: Record<string, readonly (readonly [number, number])[]> = { R1: square(0, 0, 1000), R2: square(5000, 4000, 1000) };
    const cap = (key: string, outlineKey: string, x: number, y: number) => ({ placementKey: key, elementType: "pile_cap", viewKey: "v:CAPS", x, y, outlineKey });
    const pile = (key: string, x: number, y: number) => ({ placementKey: key, elementType: "pile", viewKey: "v:PILES", x, y, outlineKey: `ring-${key}` });
    const ringOf = (key: string) => rings[key] ?? null;

    expect(pilesHeldOf({ placements: [cap("C1", "R1", 0, 0)], axes, ringOf }).size, "no pile placed: nothing to read").toBe(0);
    expect(pilesHeldOf({ placements: [pile("P1", 100000, 0)], axes, ringOf }).size, "no cap placed: nothing to read").toBe(0);

    const held = pilesHeldOf({
      placements: [cap("C1", "R1", 0, 0), cap("C2", "R2", 5000, 4000), cap("C3", "UNREAD", 9000, 9000), pile("P1", 100000 - 500, 0), pile("P2", 100000 + 500, 0)],
      axes,
      ringOf,
    });
    expect(held.get("C1"), "C1's ring holds the two piles laid under it by the grid (x − 100000 on the numerals)").toEqual(["P1", "P2"]);
    expect(held.get("C2"), "C2's ring holds none — an entry, and an empty one: the plans disagree about it").toEqual([]);
    expect(held.has("C3"), "C3's ring was never read, so nobody knows its piles: no entry").toBe(false);
  });
});

describe("I-547: the relation is read over the whole revision, each drawing's keys its own", () => {
  /** The BNBC read as the setup hands it on, by address — placements, axes, rings — for one drawing. */
  function readingOf(read: Awaited<ReturnType<typeof bnbc>>) {
    const addressOf = new Map(read.evidence.views.map((view) => [view.viewKey, viewAddressOf(view as unknown as Parameters<typeof viewAddressOf>[0])]));
    const axes = (read.evidence.grid?.axes ?? []).map((axis) => ({ viewKey: addressOf.get(axis.viewKey) ?? axis.viewKey, family: axis.family, axis: axis.axis, label: axis.label, position: axis.position }));
    const placements = read.placed.placements.map((row) => ({ placementKey: row.placementKey, elementType: row.elementType, viewKey: row.viewKey, x: row.x, y: row.y, outlineKey: row.outlineKey }));
    return { axes, placements, rings: ringsOf(read.graph) };
  }

  test(
    "S-04's piles on one drawing and S-06's caps on another: every cap still holds the piles its schedule prints — even where both files spell one view key and one handle",
    async () => {
      const read = await bnbc();
      const { axes, placements, rings } = readingOf(read);
      const pileView = pilesOf(read)[0]?.viewKey as string;
      const capView = capsOf(read)[0]?.viewKey as string;
      expect(pileView === capView, "the two plans are two views of the one drawing").toBe(false);

      // The pile layout as its OWN file would state it: the same plan under the very view key the cap
      // file uses for its cap layout — a collision two files can make — and a file whose entities
      // include one under each cap ring's handle that closes some other ring entirely.
      const collide = (key: string) => (key === pileView ? capView : key);
      const elsewhere = [
        [0, 0],
        [1, 0],
        [1, 1],
      ] as const;
      const pilesFile: DrawingReading = {
        drawing: "ingest-piles",
        placements: placements.filter((one) => one.elementType === "pile").map((one) => ({ ...one, viewKey: collide(one.viewKey) })),
        axes: axes.filter((axis) => axis.viewKey === pileView).map((axis) => ({ ...axis, viewKey: collide(axis.viewKey) })),
        ringOf: () => elsewhere,
      };
      const capsFile: DrawingReading = {
        drawing: "ingest-caps",
        placements: placements.filter((one) => one.elementType === "pile_cap"),
        axes: axes.filter((axis) => axis.viewKey === capView),
        ringOf: (key) => rings.get(key) ?? null,
      };

      const oneFile = heldOver(read);
      const twoFiles = pilesHeldOverRevision([pilesFile, capsFile]);
      expect(twoFiles.size, "all 26 caps have their piles read across the two files").toBe(26);
      expect(new Map([...twoFiles].sort()), "and each holds exactly the piles it holds when both plans are one file's").toEqual(new Map([...oneFile].sort()));
      const holders = new Map<string, number>();
      for (const under of twoFiles.values()) for (const pile of under) holders.set(pile, (holders.get(pile) ?? 0) + 1);
      expect([holders.size, [...holders.values()].every((times) => times === 1)], "89 piles, each held once").toEqual([89, true]);

      // Read per drawing, as the setup once did, the cap file holds no pile and the pile file no cap:
      // nobody reads any cap's piles, and every cap would be left to fall back.
      expect(pilesHeldOverRevision([capsFile]).size, "the cap file alone reads no relation").toBe(0);
      expect(pilesHeldOverRevision([pilesFile]).size, "nor the pile file alone").toBe(0);

      // And the keys a drawing spells are its own: read as ONE namespace, the collided view key makes
      // the pile plan and the cap plan one view, laid at no offset, and the counts come out wrong.
      const merged = pilesHeldOf({ placements: [...pilesFile.placements, ...capsFile.placements], axes: [...pilesFile.axes, ...capsFile.axes], ringOf: (key) => rings.get(key) ?? null });
      expect(
        [...merged].some(([cap, under]) => under.length !== (oneFile.get(cap) ?? []).length),
        "one namespace over two files misreads the piles — which is why each drawing's keys are kept apart",
      ).toBe(true);
    },
    BUDGET_MS,
  );

  test("a drawing whose partition georeferenced no plan lays nothing over anything — except a cap over the piles it places on its own view", () => {
    const square = [
      [-1000, -1000],
      [1000, -1000],
      [1000, 1000],
      [-1000, 1000],
    ] as const;
    const cap = { placementKey: "C1", elementType: "pile_cap", viewKey: "v:PLAN", x: 0, y: 0, outlineKey: "R1" };
    const pile = (key: string, viewKey: string, x: number) => ({ placementKey: key, elementType: "pile", viewKey, x, y: 0, outlineKey: `ring-${key}` });
    const ringOf = (key: string) => (key === "R1" ? square : null);

    const oneView = pilesHeldOverRevision([{ drawing: "d", placements: [cap, pile("P1", "v:PLAN", -500), pile("P2", "v:PLAN", 500)], axes: [], ringOf }]);
    expect(oneView.get("C1"), "a view is always its own frame: the cap holds the two piles drawn inside it").toEqual(["P1", "P2"]);

    const twoViews = pilesHeldOverRevision([{ drawing: "d", placements: [cap, pile("P1", "v:PLAN", -500), pile("P2", "v:PILES", 500)], axes: [], ringOf }]);
    expect(twoViews.has("C1"), "a pile on another view with no grid to lay it by leaves the cap unread — never counted short").toBe(false);
  });
});
