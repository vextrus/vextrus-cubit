/**
 * The closed item-description roster, graded against the law it restates (L-BD-01, L-BD-04, AM-16,
 * AM-12, L-MEA-04).
 *
 * A description is the METHOD OF MEASUREMENT (L-BD-01), so a row that stood here on nobody's
 * authority would be a convention this product invented for a bill somebody prices. Two things are
 * graded, and neither is transcribed (B-19):
 *
 *   1. EVERY ROW CITES A CLAUSE, AND THE CLAUSE SAYS WHAT THE ROW SAYS. The cited id is read out of
 *      `docs/specs/cubit.bible.xml` itself, and the clause's own text must carry the axis value the
 *      row qualifies by — so a row that invented a thickness, a band or a grade fails here against
 *      the Bible rather than passing on a reviewer's memory (AM-12).
 *   2. MORE THAN ONE CANDIDATE ONLY WHERE THE LAW DIVIDES THE KIND. The sweep is over every
 *      class × kind the rosters hold, and the pairs that answer two or more are asserted to be
 *      exactly the pairs whose rows cite a dividing clause; every other pair answers the work-item
 *      catalogue's one sentence, which is a selection with nothing to select and is never asked.
 *
 * The pairs the M3 rails actually publish are read off the BNBC golden (F-RCC6-BNBC, AM-01), which
 * is the yardstick for what this product measures — so a pair the rails publish and the `bears`
 * relation never named still has to answer a description here.
 *
 * Nothing here opens a database (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { ITEM_DESCRIPTIONS, NO_MATCH, candidateItemsFor, itemDescriptionOf } from "@/core/catalogue/item-descriptions";
import { goldenRows } from "../golden/support/golden-fixture";
import { GOLDEN_CLASS, GOLDEN_KIND, inTree } from "../takeoff/boq/support/boq-stage";

/** The Bible itself, read once: the authority every row of the roster is graded against. */
const BIBLE = readFileSync(inTree("docs/specs/cubit.bible.xml"), "utf8");

/** Every class × kind pair, whether or not anything bears it — `candidateItemsFor` is total. */
const EVERY_PAIR: readonly { klass: ElementType; kind: Kind }[] = ELEMENT_TYPES.flatMap((klass) => KINDS.map((kind) => ({ klass, kind })));

/**
 * The clause a row cites, as the Bible spells it: an `<law id="…">` or an `<amendment … id="…">`,
 * with the text that follows it up to the element's end. A clause the Bible does not spell has no
 * text at all, which is how a citation of nothing fails.
 */
function clauseText(id: string): string {
  const opened = BIBLE.indexOf(`id="${id}"`);
  if (opened < 0) return "";
  const closed = BIBLE.indexOf("</", opened);
  return closed < 0 ? BIBLE.slice(opened) : BIBLE.slice(opened, closed);
}

/** The digits an axis value turns on — `250 mm nominal…` → `250`, `not exceeding 1.5 m deep` → `1.5`. */
function figuresIn(qualifier: string): string[] {
  return qualifier.match(/[0-9]+(?:\.[0-9]+)?/gu) ?? [];
}

/** The (class, kind) pairs the M3 rails publish, read off the BNBC golden in the product's spelling. */
function publishedPairs(): { klass: ElementType; kind: Kind }[] {
  const seen = new Map<string, { klass: ElementType; kind: Kind }>();
  for (const row of goldenRows("rcc6-bnbc")) {
    const klass = GOLDEN_CLASS[row.class];
    const kind = GOLDEN_KIND[row.kind];
    if (klass === undefined || kind === undefined) continue;
    if (!(ELEMENT_TYPES as readonly string[]).includes(klass) || !(KINDS as readonly string[]).includes(kind)) continue;
    seen.set(`${klass} ${kind}`, { klass: klass as ElementType, kind: kind as Kind });
  }
  return [...seen.values()];
}

describe("the closed item-description roster", () => {
  test("every row cites a clause the Bible spells, and that clause states the axis the row qualifies by", () => {
    expect(ITEM_DESCRIPTIONS.length, "the roster holds rows, or this file grades nothing").toBeGreaterThan(0);
    for (const row of ITEM_DESCRIPTIONS) {
      const text = clauseText(row.clause);
      expect(text, `${row.id} cites ${row.clause}, which the Bible must spell`).not.toBe("");
      for (const figure of figuresIn(row.qualifier)) {
        expect(text, `${row.clause} states ${figure}, which ${row.id} bills by — a value the clause does not state is invented convention (AM-12)`).toContain(figure);
      }
      expect(row.text, `${row.id} carries a description, which is the method of measurement (L-BD-01)`).not.toBe("");
      expect(row.text.includes(row.qualifier.split(" ")[0] ?? ""), `${row.id}'s description names its own axis value`).toBe(true);
    }
  });

  test("ids are unique, are spelled from the pair they stand over, and none is the no-match answer", () => {
    const ids = ITEM_DESCRIPTIONS.map((row) => row.id);
    expect(new Set(ids).size, `two rows share an id: ${ids.join(", ")}`).toBe(ids.length);
    for (const row of ITEM_DESCRIPTIONS) {
      expect(row.id.startsWith(`${row.kind}/${row.class}/`), `${row.id} is spelled from its own class and kind`).toBe(true);
      expect(row.id, "no candidate may be spelled as the no-match answer, which is the caller's own").not.toBe(NO_MATCH);
      expect((ELEMENT_TYPES as readonly string[]).includes(row.class), `${row.id} names a closed element class`).toBe(true);
      expect((KINDS as readonly string[]).includes(row.kind), `${row.id} names a closed kind`).toBe(true);
    }
  });

  test("`candidateItemsFor` is total: every class × kind answers at least one description", () => {
    for (const { klass, kind } of EVERY_PAIR) {
      const candidates = candidateItemsFor(klass, kind);
      expect(candidates.length, `${klass} × ${kind} answers a description a line can be billed under`).toBeGreaterThan(0);
      for (const row of candidates) {
        expect(row.class, `${row.id} is a candidate of the pair it was asked for`).toBe(klass);
        expect(row.kind, `${row.id} is a candidate of the pair it was asked for`).toBe(kind);
      }
    }
  });

  test("every pair the M3 rails publish is billable, and a pair no axis divides answers the catalogue's own sentence", () => {
    const published = publishedPairs();
    expect(published.length, "the BNBC golden publishes pairs, or this file grades nothing").toBeGreaterThan(0);
    for (const { klass, kind } of published) {
      const candidates = candidateItemsFor(klass, kind);
      expect(candidates.length, `${klass} × ${kind} is published by a rail and must be billable`).toBeGreaterThan(0);
      if (candidates.length === 1) {
        expect(candidates[0]?.text, `${klass} × ${kind} carries the work-item catalogue's one description (L-MEA-04)`).toBe(WORK_ITEM_CATALOGUE[kind].description);
      }
    }
  });

  test("a pair answers more than one description only where the law divides its kind, and then every row cites that division", () => {
    const divided = EVERY_PAIR.filter(({ klass, kind }) => candidateItemsFor(klass, kind).length > 1);
    expect(divided.length, "some pair is divided, or the question this roster exists for is never asked").toBeGreaterThan(0);
    for (const { klass, kind } of divided) {
      const candidates = candidateItemsFor(klass, kind);
      const qualifiers = candidates.map((row) => row.qualifier);
      expect(new Set(qualifiers).size, `${klass} × ${kind}'s candidates are told apart by their own axis: ${qualifiers.join(" | ")}`).toBe(candidates.length);
      for (const row of candidates) {
        expect(clauseText(row.clause), `${row.id} divides its kind on ${row.clause}'s authority`).not.toBe("");
      }
    }
    // The divided pairs, named: what the law states as quantity-bearing today, and nothing else.
    // A pair added here is a clause the roster started restating, and is read as such in review.
    expect(divided.map(({ klass, kind }) => `${klass} ${kind}`).sort()).toEqual([
      "brick_wall masonry.brickwork",
      "footing earthwork.excavation",
      "pile_cap earthwork.excavation",
    ]);
  });

  test("a candidate is read back out of its own pair's set, and never out of the whole roster", () => {
    const wall = candidateItemsFor("brick_wall", "masonry.brickwork")[0];
    expect(wall, "brickwork carries candidates").toBeDefined();
    expect(itemDescriptionOf("brick_wall", "masonry.brickwork", wall?.id ?? ""), "a candidate of the pair reads back").toMatchObject({ id: wall?.id });
    expect(itemDescriptionOf("footing", "earthwork.excavation", wall?.id ?? ""), "another pair's candidate reads back as nothing").toBeNull();
    expect(itemDescriptionOf("brick_wall", "masonry.brickwork", NO_MATCH), "the no-match answer is no candidate").toBeNull();
  });
});
