/**
 * AC-1(b) and AC-1(c): which unbanded column a schedule states its sections in, and what a row with
 * no cell in it still owes (debt-src-modules-181lf06, debt-src-modules-1rxkjyt, R-TO-031, L-QTY-02).
 *
 * Three tables are drawn: one whose only unbanded columns are a count and a remark, one that states
 * its sections under `SIZE`, and one whose `SIZE` cell is blank on a row that still states rebar. The
 * expectations are read off what was drawn, so a table drawn differently owes different variants.
 */
import { describe, expect, test } from "vitest";
import { MODULE, VIEW, assignedTo, graphOf, handle, productModule, text, view, type Entity } from "./support/sweep-stage";

/** One rebar zone beneath a variant, as the registry records one. */
type Zone = { zone: string; text: string };

/** One variant of a family: the band it heads, the section it carries, and the rebar beneath it. */
type Variant = { variantKey: string; sectionText: string; sectionWidth: number | null; sectionDepth: number | null; sectionUnit: string | null; zones: Zone[] };

/** One mark family of one schedule. */
type Family = { family: string; markText: string; rowIndex: number; variants: Variant[] };

type Registered = { families: Family[]; deferrals: readonly { viewKey: string; reason: string }[] };

type Reconstructor = (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string> }) => { tables: readonly unknown[] };
type Registrar = (tables: readonly unknown[]) => Registered;

/** A schedule drawn from its header row and its data rows, one text per cell (`null` draws none). */
function schedule(label: string, headers: readonly string[], rows: readonly (readonly (string | null)[])[], salt: number): { entities: Entity[]; anchor: Entity; viewKey: string } {
  const anchor = text(handle(salt), label, [0, 100], { height: 5 });
  const entities: Entity[] = [anchor];
  let ordinal = salt + 1;
  headers.forEach((header, column) => {
    entities.push(text(handle(ordinal), header, [column * 100, 90]));
    ordinal += 1;
  });
  rows.forEach((row, index) => {
    row.forEach((cell, column) => {
      if (cell === null) return;
      entities.push(text(handle(ordinal), cell, [column * 100, 80 - index * 10]));
      ordinal += 1;
    });
  });
  return { entities, anchor, viewKey: `SCHEDULE:${salt}` };
}

/** The families one drawn schedule registers, folded through the two stages the criterion names. */
async function familiesOf(drawn: { entities: Entity[]; anchor: Entity; viewKey: string }): Promise<Registered> {
  const reconstructDoor = await productModule<Record<string, unknown>>(MODULE.reconstruct);
  const registryDoor = await productModule<Record<string, unknown>>(MODULE.registry);
  expect(typeof reconstructDoor["reconstructSchedules"], `${MODULE.reconstruct} publishes \`reconstructSchedules\``).toBe("function");
  expect(typeof registryDoor["registerMemberTypes"], `${MODULE.registry} publishes \`registerMemberTypes\``).toBe("function");
  const reconstruct = reconstructDoor["reconstructSchedules"] as Reconstructor;
  const register = registryDoor["registerMemberTypes"] as Registrar;

  const tables = reconstruct({
    graph: graphOf(drawn.entities),
    views: [view({ viewKey: drawn.viewKey, type: VIEW.SCHEDULE, caption: "SCHEDULE", anchorKey: drawn.anchor.key })],
    assignments: assignedTo(drawn.viewKey, drawn.entities),
  }).tables;
  expect(tables.length, "the drawn schedule reconstructs to one table — with none, this case grades nothing").toBe(1);
  return register(tables);
}

/** The one family a drawn schedule minted for a mark. */
function familyOf(registered: Registered, mark: string): Family {
  const held = registered.families.filter((family) => family.family === mark);
  expect(held.length, `one family stands for ${mark}; the registry minted ${registered.families.map((family) => family.family).join(", ") || "none"}`).toBe(1);
  return held[0] as Family;
}

const REMARK = "SEE ARCH DETAIL";
const COUNT = "4 NOS";
const MAIN = "8-16Ø";

describe("AC-1: the unbanded section column is one a section really reads in", () => {
  test("AC-1: a schedule whose unbanded columns are a count and a remark states its sections in neither", async () => {
    const drawn = schedule("BEAM SCHEDULE", ["MARK", "NOS", "REMARKS", "MAIN BARS"], [["B1", COUNT, REMARK, MAIN]], 0x100);
    const family = familyOf(await familiesOf(drawn), "B1");

    expect(family.variants.length, "the row still registers exactly one variant: its rebar is the drawing's and is never dropped for want of a section (L-QTY-02)").toBe(1);
    const variant = family.variants[0] as Variant;
    expect(
      { width: variant.sectionWidth, depth: variant.sectionDepth, unit: variant.sectionUnit },
      "and it carries NO section: no cell of either unbanded column ever reads as one, so the schedule states none rather than the leftmost column being taken for one (L-QTY-01: never a guess)",
    ).toEqual({ width: null, depth: null, unit: null });
    expect(
      [REMARK, COUNT].filter((said) => variant.sectionText === said),
      `and no remark or count text reaches the variant's section — it reads "${variant.sectionText}"`,
    ).toEqual([]);
    expect(variant.zones.map((zone) => zone.text), "while the rebar the row states stands beneath it, cell for cell").toEqual([MAIN]);

    // The same schedule with the same remark column, drawn with a SIZE column that DOES read as a
    // section: the column is still chosen, so what the case above grades is the reading rather than
    // the fallback being switched off (B-19).
    const stated = schedule("BEAM SCHEDULE", ["MARK", "SIZE", "REMARKS", "MAIN BARS"], [["B1", "300x450", REMARK, MAIN]], 0x200);
    const chosen = familyOf(await familiesOf(stated), "B1").variants[0] as Variant;
    expect(
      { width: chosen.sectionWidth, depth: chosen.sectionDepth, text: chosen.sectionText },
      "a column one of whose cells reads as a section is the section column, whatever stands to the right of it",
    ).toEqual({ width: 300, depth: 450, text: "300x450" });
  });

  test("AC-1: a row with no cell at all in the section column keeps its rebar under one section-less variant", async () => {
    const drawn = schedule("BEAM SCHEDULE", ["MARK", "SIZE", "MAIN BARS"], [["B1", "300x450", MAIN], ["B2", null, "6-20Ø"]], 0x300);
    const registered = await familiesOf(drawn);

    const stated = familyOf(registered, "B1").variants[0] as Variant;
    expect({ width: stated.sectionWidth, depth: stated.sectionDepth }, "the row that states a section carries it — with none, this case is not about the row that states none").toEqual({ width: 300, depth: 450 });

    const blank = familyOf(registered, "B2");
    expect(blank.variants.length, "the row whose section cell was never drawn registers ONE variant — dropping it would drop the row's rebar with it (R-TO-031, L-QTY-02)").toBe(1);
    const variant = blank.variants[0] as Variant;
    expect(
      { width: variant.sectionWidth, depth: variant.sectionDepth, unit: variant.sectionUnit },
      "whose section is null in all three parts: the drawing stated no section there, and a null is what an unread figure is (L-QTY-01)",
    ).toEqual({ width: null, depth: null, unit: null });
    expect(variant.zones.map((zone) => zone.text), "and the zones the row's own rebar cells state stand beneath it, intact").toEqual(["6-20Ø"]);
  });
});
