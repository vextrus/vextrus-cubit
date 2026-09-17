/**
 * AC-1(a): a text the drawing really carries, standing beyond every column's reach, is ANSWERED —
 * never silently discarded (debt-src-modules-197zgz5, L-CAD-08, L-QTY-04).
 *
 * The table is drawn here, so what the reconstruction owes is read off the drawing rather than
 * transcribed: the strays are the texts this case drew outside every column, in the order the page is
 * read in, and the table that draws none owes an empty answer (B-19).
 */
import { describe, expect, test } from "vitest";
import { MODULE, VIEW, assignedTo, graphOf, handle, productModule, text, view, type Entity } from "./support/sweep-stage";

/** One entity of the reconstructed table's answer. */
type UnplacedText = { key: string; text: string };

/** One reconstructed table, as far as this case reads one. */
type Table = { viewKey: string; cells: { text: string; sourceKeys: string[] }[]; unplaced: readonly UnplacedText[] };

/** What the reconstruction answers for one artifact. */
type Reconstructed = { views: number; tables: Table[]; deferrals: readonly { viewKey: string; reason: string }[] };

type Reconstructor = (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string> }) => Reconstructed;

const VIEW_KEY = "SCHEDULE:1";

/** The caption the table is anchored on, and the header, rows and strays beneath it. */
const CAPTION: Entity = text(handle(1), "COLUMN SCHEDULE", [0, 100], { height: 5 });

/** The header band: a mark column and two more, 100 apart, so a column's reach is 50 either side. */
const HEADER: Entity[] = [text(handle(2), "MARK", [0, 90]), text(handle(3), "SIZE", [100, 90]), text(handle(4), "MAIN BARS", [200, 90])];

/** Two rows beneath it, each cell standing under its own column. */
const ROWS: Entity[] = [
  text(handle(5), "C1", [0, 80]),
  text(handle(6), '300x450', [100, 80]),
  text(handle(7), "8-16Ø", [200, 80]),
  text(handle(8), "C2", [0, 70]),
  text(handle(9), '250x400', [100, 70]),
  text(handle(10), "6-16Ø", [200, 70]),
];

/**
 * The two texts drawn beyond every column: a revision note out in the margin of the first row, and a
 * second standing left of the mark column on the row beneath it. Neither is a cell of anything — the
 * nearest column is six reaches away — and both are things the drawing SAYS.
 */
const STRAYS: Entity[] = [text(handle(11), "REV B — SEE NOTE 4", [500, 80]), text(handle(12), "(TYP)", [-200, 70])];

/** The same table drawn with nothing in its margins. */
const TIDY_VIEW_KEY = "SCHEDULE:2";

function tidy(): Entity[] {
  return [CAPTION, ...HEADER, ...ROWS].map((entity, index) => ({ ...entity, key: handle(100 + index) }));
}

async function reconstructor(): Promise<Reconstructor> {
  const door = await productModule<Record<string, unknown>>(MODULE.reconstruct);
  expect(typeof door["reconstructSchedules"], `${MODULE.reconstruct} publishes \`reconstructSchedules\``).toBe("function");
  return door["reconstructSchedules"] as Reconstructor;
}

/** What one drawn schedule reconstructs to, with the view it was drawn in. */
async function tableOf(entities: readonly Entity[], viewKey: string, anchor: string): Promise<Table> {
  const reconstruct = await reconstructor();
  const answer = reconstruct({
    graph: graphOf(entities),
    views: [view({ viewKey, type: VIEW.SCHEDULE, caption: "COLUMN SCHEDULE", anchorKey: anchor })],
    assignments: assignedTo(viewKey, entities),
  });
  expect(answer.tables.length, `the drawn schedule reconstructs to one table; it answered ${answer.tables.length} and deferred ${answer.deferrals.map((one) => one.reason).join(", ")}`).toBe(1);
  return answer.tables[0] as Table;
}

describe("AC-1: a schedule's unreachable texts are answered rather than dropped", () => {
  test("AC-1: a text beyond every column's reach stands in `unplaced`, in reading order, and in no cell", async () => {
    const table = await tableOf([CAPTION, ...HEADER, ...ROWS, ...STRAYS], VIEW_KEY, CAPTION.key);

    const cited = new Set(table.cells.flatMap((cell) => cell.sourceKeys));
    for (const stray of STRAYS) {
      expect(cited.has(stray.key), `the text "${stray.text ?? ""}" stands beyond every column's reach, so no cell of the table was read from it (L-CAD-08)`).toBe(false);
    }

    expect(Array.isArray(table.unplaced), "the table answers `unplaced` — the texts of the view beyond every column's reach (interfaces)").toBe(true);
    expect(
      [...table.unplaced].map((one) => ({ key: one.key, text: one.text })),
      "and what the drawing said there is answered, each text with the key it was read from, down the page and then across (L-QTY-04: a reading the drawing carries is never discarded in silence)",
    ).toEqual(STRAYS.map((stray) => ({ key: stray.key, text: stray.text ?? "" })));
  });

  test("AC-1: a schedule whose every text lands in a column answers `unplaced: []`", async () => {
    const drawn = tidy();
    const table = await tableOf(drawn, TIDY_VIEW_KEY, drawn[0]?.key ?? "");
    expect(table.unplaced, "a table that drew nothing in its margins has nothing to answer there — an empty list, never an absence a reader has to guess at (R-UI-050)").toEqual([]);
    expect(
      new Set(table.cells.flatMap((cell) => cell.sourceKeys)).size,
      "and every text beneath the caption really did land in a cell, so this case is about a table that placed them all",
    ).toBe(drawn.length - 1);
  });
});
