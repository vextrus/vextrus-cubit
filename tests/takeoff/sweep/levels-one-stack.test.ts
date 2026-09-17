/**
 * AC-2(a) and AC-2(b): ONE level stack over every section of the artifact, and a storey height that
 * is a distance rather than a subtraction of two numbers written in different units
 * (debt-src-modules-xd2op2, debt-src-modules-6gdmv2, debt-src-modules-11zdesk, L-MEA-07, L-REG-01).
 *
 * Every expectation is read off the marks this case draws: the labels they say, the elevations they
 * stand at, which view each was drawn in, and which of them the dedupe leaves standing. A drawing
 * with other marks owes another stack (B-19).
 */
import { describe, expect, test } from "vitest";
import { MODULE, VIEW, graphOf, handle, productModule, text, view, type Entity } from "./support/sweep-stage";

/** One level of the proposal, as the stage answers one. */
type ProposedLevel = { viewKey: string; label: string; ordinal: number; elevation: number; heightAsWritten: string | null; heightUnit: string | null; markKey: string };

type Proposal = { views: number; levels: readonly ProposedLevel[] };

type Proposer = (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string> }) => Proposal;

/** One level mark of a section: the view it was drawn in, and the words the draughtsman wrote. */
type Mark = { viewKey: string; said: string; label: string };

const SECTION_A = "SECTION:A";
const SECTION_B = "SECTION:B";

async function proposer(): Promise<Proposer> {
  const door = await productModule<Record<string, unknown>>(MODULE.propose);
  expect(typeof door["proposeLevelStack"], `${MODULE.propose} publishes \`proposeLevelStack\``).toBe("function");
  return door["proposeLevelStack"] as Proposer;
}

/** The stack the drawn marks propose, with the key each mark was drawn under. */
async function stackOf(marks: readonly Mark[], types: Readonly<Record<string, string>>): Promise<{ stack: Proposal; keyOf: (said: string) => string }> {
  const entities: Entity[] = [];
  const assignments = new Map<string, string>();
  const keys = new Map<string, string>();
  marks.forEach((mark, index) => {
    const entity = text(handle(0x40 + index), mark.said, [0, 100 - index]);
    entities.push(entity);
    assignments.set(entity.key, mark.viewKey);
    keys.set(mark.said, entity.key);
  });

  const propose = await proposer();
  const stack = propose({
    graph: graphOf(entities),
    views: Object.entries(types).map(([viewKey, type]) => view({ viewKey, type, caption: "SECTION", anchorKey: null })),
    assignments,
  });
  return { stack, keyOf: (said: string) => keys.get(said) ?? "" };
}

describe("AC-2: one artifact states one level stack", () => {
  test("AC-2: two sections state ONE stack — labels deduplicated, ordinals continuous from the foot", async () => {
    // Section A draws the building's storeys; section B redraws two of them and adds a roof. The
    // duplicate labels are what the dedupe is about, and the roof is what makes B contribute.
    const marks: Mark[] = [
      { viewKey: SECTION_A, said: "BASEMENT LVL -3.000 m", label: "BSMT" },
      { viewKey: SECTION_A, said: "GF LVL +0.000 m", label: "GF" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3.000 m", label: "1ST" },
      { viewKey: SECTION_A, said: "ROOF LVL +9.000 m", label: "ROOF" },
      { viewKey: SECTION_B, said: "GROUND FLOOR LVL +0.000 m", label: "GF" },
      { viewKey: SECTION_B, said: "MEZZANINE LVL +6.000 m", label: "MEZZ" },
      { viewKey: SECTION_B, said: "ROOF SLAB LVL +9.000 m", label: "ROOF" },
    ];
    const { stack, keyOf } = await stackOf(marks, { [SECTION_A]: VIEW.MEMBER_SECTION, [SECTION_B]: VIEW.LONG_SECTION_STRIP });

    expect(stack.views, "both sections were examined").toBe(2);
    const byOrdinal = [...stack.levels].sort((left, right) => left.ordinal - right.ordinal);
    const labels = byOrdinal.map((level) => level.label);

    expect(new Set(labels).size, `one level per label the artifact names: a level redrawn on a second section is one level, never two (L-MEA-07); the stack reads ${labels.join(", ")}`).toBe(labels.length);
    expect(
      byOrdinal.map((level) => level.elevation),
      "and the stack is ordered from the foot of the building up, over every section at once",
    ).toEqual([...byOrdinal.map((level) => level.elevation)].sort((left, right) => left - right));
    expect(
      byOrdinal.map((level) => level.ordinal),
      "the ordinals run 0..n−1 without a gap or a restart — a second section restarting them would offer one INSERT_LEVEL naming two ground floors (L-MEA-07: the ordinal is physical)",
    ).toEqual(byOrdinal.map((_level, index) => index));
    expect(
      byOrdinal.map((level) => level.markKey),
      "each level cites the FIRST mark in artifact order that names it — the duplicate on the second section is the same level read twice (L-CAD-03, L-REG-04)",
    ).toEqual([
      keyOf("BASEMENT LVL -3.000 m"),
      keyOf("GF LVL +0.000 m"),
      keyOf("1ST FLOOR LVL +3.000 m"),
      keyOf("MEZZANINE LVL +6.000 m"),
      keyOf("ROOF LVL +9.000 m"),
    ]);

    // A height is stated only where the level above it stands on the SAME section and is that
    // section's own next mark: across two sections nothing was measured, and a mark the dedupe
    // dropped is no neighbour of anything (B-07, L-QTY-01).
    const heights = Object.fromEntries(byOrdinal.map((level) => [level.label, level.heightAsWritten === null ? null : Number(level.heightAsWritten)]));
    expect(
      heights,
      "BSMT and GF state the storey they were drawn over on section A; 1ST's neighbour above stands on the other section, MEZZ's own next mark was the ROOF the dedupe dropped, and ROOF is the top of the building",
    ).toEqual({ BSMT: 3, GF: 3, "1ST": null, MEZZ: null, ROOF: null });
    expect(
      byOrdinal.filter((level) => level.heightAsWritten === null).map((level) => level.heightUnit),
      "and a level stating no height states no unit for one either",
    ).toEqual([null, null, null]);
  });

  test("AC-2: two marks written in different units are differenced in canonical metres, and stated in the lower mark's unit", async () => {
    const marks: Mark[] = [
      { viewKey: SECTION_A, said: "GF LVL +0.000 m", label: "GF" },
      { viewKey: SECTION_A, said: "1ST FLOOR LVL +3000 mm", label: "1ST" },
      { viewKey: SECTION_A, said: "2ND FLOOR LVL +6000 mm", label: "2ND" },
    ];
    const { stack } = await stackOf(marks, { [SECTION_A]: VIEW.MEMBER_SECTION });
    const byOrdinal = [...stack.levels].sort((left, right) => left.ordinal - right.ordinal);

    const ground = byOrdinal[0] as ProposedLevel;
    expect(
      { label: ground.label, height: Number(ground.heightAsWritten), unit: ground.heightUnit },
      "the mark above the ground floor was written in millimetres and the ground floor's in metres: the storey is the distance between them in canonical metres, stated in the unit the LOWER mark itself was written in — a bare subtraction would state three thousand metres (L-MEA-01, B-07, B-17: one converter)",
    ).toEqual({ label: "GF", height: 3, unit: "m" });

    const first = byOrdinal[1] as ProposedLevel;
    expect(
      { label: first.label, height: Number(first.heightAsWritten), unit: first.heightUnit },
      "and a pair written in ONE unit is untouched: the same three metres, in the millimetres both marks state",
    ).toEqual({ label: "1ST", height: 3000, unit: "mm" });
  });
});
