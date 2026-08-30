/**
 * Public acceptance for L-MEA-04's work-item catalogue and `bears` relation: AC-2.
 *
 * Both are judged as totalities over the tree's own rosters — the catalogue over KINDS, the
 * relation over ELEMENT_TYPES — so a kind or a class a later increment adds is judged the moment it
 * lands and nothing here is a transcription of today's content (B-19). The canonical unit set and
 * the dimension set come from the canon rather than from a list spelled here: L-FRM-06 owns them.
 */
import { describe, expect, test } from "vitest";
import { loadBears, loadCanon, loadCatalogue, loadElementTypes, loadKinds, stringRoster, type CatalogueEntry } from "./support/wire";

describe("AC-2: the catalogue is total over Kind and the relation partitions the element classes", () => {
  test("AC-2: CATALOGUE's key set is exactly KINDS — no missing kind, no stranger", async () => {
    const { KINDS } = await loadKinds();
    const { CATALOGUE } = await loadCatalogue();
    const kinds = [...stringRoster(KINDS, "KINDS")].sort();
    const keys = Object.keys(CATALOGUE).sort();
    expect(keys, "CATALOGUE is total over Kind: every kind carries an entry and no key is not a kind").toEqual(kinds);
  });

  test("AC-2: every entry carries a description, a canonical unit, a dimension and an integer precision, unit and dimension agreeing", async () => {
    const { KINDS } = await loadKinds();
    const { CATALOGUE } = await loadCatalogue();
    const { DIMENSIONS, CANONICAL_UNITS } = await loadCanon();

    const dimensions = new Set(stringRoster(DIMENSIONS, "DIMENSIONS"));
    const canonicalUnits = new Set(Object.values(CANONICAL_UNITS));
    expect(canonicalUnits.size, "CANONICAL_UNITS must name a canonical unit for each dimension").toBe(dimensions.size);

    for (const kind of stringRoster(KINDS, "KINDS")) {
      const entry = CATALOGUE[kind] as CatalogueEntry | undefined;
      expect(entry, `CATALOGUE has no entry for ${kind}`).toBeTypeOf("object");
      if (entry === undefined) continue;

      expect(typeof entry.description, `${kind}.description is a string`).toBe("string");
      expect(entry.description.trim(), `${kind}.description must say what the work item is`).not.toBe("");

      expect(dimensions.has(entry.dimension), `${kind}.dimension "${entry.dimension}" is not one of DIMENSIONS`).toBe(true);
      expect(canonicalUnits.has(entry.unit), `${kind}.unit "${entry.unit}" is not a canonical unit code`).toBe(true);
      expect(entry.unit, `${kind} measures in ${entry.dimension}, whose canonical unit is ${CANONICAL_UNITS[entry.dimension]} — unit and dimension must agree`).toBe(CANONICAL_UNITS[entry.dimension]);

      expect(Number.isInteger(entry.precision), `${kind}.precision is the document rounding precision, an integer; found ${JSON.stringify(entry.precision)}`).toBe(true);
      expect(entry.precision, `${kind}.precision is not negative`).toBeGreaterThanOrEqual(0);
    }
  });

  test("AC-2: BEARS maps element classes to non-empty arrays of kinds", async () => {
    const { KINDS } = await loadKinds();
    const { ELEMENT_TYPES } = await loadElementTypes();
    const { BEARS } = await loadBears();

    const kinds = new Set(stringRoster(KINDS, "KINDS"));
    const classes = new Set(stringRoster(ELEMENT_TYPES, "ELEMENT_TYPES"));
    const keys = Object.keys(BEARS);
    expect(keys.length, "BEARS must relate at least one class to the kinds it bears").toBeGreaterThan(0);

    for (const elementType of keys) {
      expect(classes.has(elementType), `BEARS keys on "${elementType}", which is not an ELEMENT_TYPES member`).toBe(true);
      const borne = BEARS[elementType];
      expect(Array.isArray(borne), `BEARS[${elementType}] is a readonly array of kinds`).toBe(true);
      const list = (borne ?? []) as readonly string[];
      expect(list.length, `BEARS[${elementType}] is non-empty — a class bearing no kind belongs in UNBORNE, never in BEARS`).toBeGreaterThan(0);
      expect(new Set(list).size, `BEARS[${elementType}] names a kind twice: ${list.join(", ")}`).toBe(list.length);
      for (const kind of list) {
        expect(kinds.has(kind), `BEARS[${elementType}] names "${kind}", which is not a kind`).toBe(true);
      }
    }
  });

  test("AC-2: keys(BEARS) and UNBORNE are disjoint and together are exactly ELEMENT_TYPES", async () => {
    const { ELEMENT_TYPES } = await loadElementTypes();
    const { BEARS, UNBORNE } = await loadBears();

    const classes = stringRoster(ELEMENT_TYPES, "ELEMENT_TYPES");
    const bearing = Object.keys(BEARS);
    const unborne = UNBORNE as readonly string[];
    expect(new Set(unborne).size, `UNBORNE names a class twice: ${unborne.join(", ")}`).toBe(unborne.length);

    const overlap = bearing.filter((elementType) => unborne.includes(elementType));
    expect(overlap, `a class cannot both bear a kind and be declared unborne: ${overlap.join(", ")}`).toEqual([]);

    const union = [...bearing, ...unborne].sort();
    expect(union, "every element class is either in BEARS or declared in UNBORNE — a class bearing no kind is declared, never residual").toEqual([...classes].sort());
  });
});
