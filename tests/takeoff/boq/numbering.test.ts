/**
 * AC-3 — S.G.I item numbers are DERIVED at emission and stored nowhere, and a payload figure is the
 * register's reading rounded to the document's precision (AM-14 §2, L-MEA-05, L-QTY-04).
 *
 * An item number that were stored would be a second home for a fact the catalogue order and the
 * level stack already decide, and a draft renumbered by one inserted line would then contradict
 * itself. So the suite asks the seam two things: that nothing can carry a number into it, and that
 * the number it derives is a function of the payload alone — the same payload twice, the same map;
 * a line added, the same identities.
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import {
  BOQ_KIND_MODULE,
  COMPLETE,
  DOCUMENTS_MODULE,
  PARTIAL_DECLARED,
  QUANTITY_LINES_SCHEMA_MODULE,
  SIX_BILLS,
  TAXONOMY_VERSION,
  catalogue,
  compareCanonical,
  elementTypes,
  emissionModule,
  kinds,
  numberingModule,
  productModule,
  type EmissionModule,
  type NumberingModule,
  type PayloadSectionShape,
  type PayloadShape,
  type ReadingShape,
  type WorkItemShape,
} from "./support/boq-stage";
import { syntheticDraftPayload } from "./support/synthetic-draft";

/** The shape of an item number: three 1-based ordinals, no padding, no zero, no gap (AM-14 §2). */
const SGI = /^[1-9]\d*\.[1-9]\d*\.[1-9]\d*$/u;

let numbering!: NumberingModule;
let emission!: EmissionModule;
let classes!: readonly string[];
let kindRoster!: readonly string[];
let items!: Readonly<Record<string, WorkItemShape>>;
let canonical!: (a: string, b: string) => number;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let loading: Promise<void> | undefined;
const ready = (): Promise<void> =>
  (loading ??= (async () => {
    numbering = await numberingModule();
    emission = await emissionModule();
    classes = await elementTypes();
    kindRoster = await kinds();
    items = await catalogue();
    canonical = await compareCanonical();
  })());

/** The two-level stack the readings below stand on. */
const TWO_LEVELS = [
  { levelId: "lvl-fdn", ordinal: -1, label: "FDN" },
  { levelId: "lvl-gf", ordinal: 0, label: "GF" },
];

/** One published line of a reading, as the register hands one over. */
function line(lineId: string, objectKey: string, klass: string, kind: string, levelId: string, value: string | null, unit: string): ReadingShape["lines"][number] {
  return { lineId, objectKey, class: klass, kind, levelId, value, unit, quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: value === null ? PARTIAL_DECLARED : COMPLETE };
}

/** A reading of one campaign over a stack and a set of published lines. */
function readingOf(levels: ReadingShape["levels"], lines: ReadingShape["lines"]): ReadingShape {
  return {
    project: "Sattva Court",
    campaignId: "33333333-3333-4333-8333-333333333333",
    setRevisionId: "44444444-4444-4444-8444-444444444444",
    levels,
    lines,
    coverageComplete: false,
  };
}

/** The group ordinal a section owes each of its groups: `ELEMENT_TYPES` then `KINDS`, present only. */
function expectedGroupOrdinals(section: PayloadSectionShape): Map<string, number> {
  const order = [...section.groups]
    .map((group) => ({ key: `${group.class}:${group.kind}`, klass: classes.indexOf(group.class), kind: kindRoster.indexOf(group.kind) }))
    .sort((a, b) => a.klass - b.klass || a.kind - b.kind);
  return new Map(order.map((entry, index) => [entry.key, index + 1]));
}

describe("AC-3: the item number is derived on emission and stored nowhere", () => {
  test("AC-3: the payload schema refuses a line that carries a number, and the store has no column for one", async () => {
    await ready();
    const kind = await productModule<{ boqDraftPayloadSchema: { safeParse: (value: unknown) => { success: boolean } } }>(BOQ_KIND_MODULE);
    const schema = kind.boqDraftPayloadSchema;
    expect(typeof schema?.safeParse, `${BOQ_KIND_MODULE} publishes boqDraftPayloadSchema, the one parse of a draft payload`).toBe("function");

    // The clean payload is one the SEAM emitted, so it is a payload of whatever shape the kind's own
    // schema states: the refusals below are then about the extra key and nothing else.
    const clean = emission.boqDraftPayloadOf(readingOf(TWO_LEVELS, [line("l-1", "column/GF/C1", "column", "rcc.concrete", "lvl-gf", "1.000", "m3")]));
    expect(schema.safeParse(clean).success, `the seam's own payload is a payload the kind accepts: ${JSON.stringify(schema.safeParse(clean))}`).toBe(true);

    for (const key of ["item", "itemNumber"]) {
      const carried = JSON.parse(JSON.stringify(clean)) as PayloadShape;
      const line = (carried.sections[0] as PayloadSectionShape).groups[0]?.lines[0] as Record<string, unknown>;
      line[key] = "1.1.1";
      expect(schema.safeParse(carried).success, `a line carrying \`${key}\` is refused: an item number is derived at emission and is never handed in (AM-14 §2)`).toBe(false);
    }

    const schemaModule = await productModule<Record<string, unknown>>(QUANTITY_LINES_SCHEMA_MODULE);
    const table = schemaModule["quantityLines"] as Record<string, { name?: string } | undefined>;
    expect(table, `${QUANTITY_LINES_SCHEMA_MODULE} publishes the quantity_lines table`).toBeTruthy();
    // The table object names its own columns — both the property the product reads them by and the
    // column the store spells them as. Asked of the OBJECT, never of the file's text.
    const columns = Object.keys(table).flatMap((key) => [key, table[key]?.name ?? key]).map((name) => name.toLowerCase());
    expect(columns.length, "the quantity_lines table names its columns").toBeGreaterThan(0);
    for (const forbidden of ["item", "itemnumber", "item_number"]) {
      expect(columns, `quantity_lines has no ${forbidden} column — the number lives nowhere but the emission`).not.toContain(forbidden);
    }
  });

  test("AC-3: S.G.I is the section's ordinal in BILLS, the group's in the catalogue order, the line's in its group", async () => {
    await ready();
    const payload = syntheticDraftPayload(96);
    const map = numbering.numberItems(payload.sections);

    const lineCount = payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines)).length;
    expect(map.size, "one item number per line the payload holds, and not one more").toBe(lineCount);

    for (const section of payload.sections) {
      const sectionOrdinal = SIX_BILLS.indexOf(section.bill) + 1;
      expect(sectionOrdinal, `${section.bill} is one of the six sections`).toBeGreaterThan(0);
      const groupOrdinals = expectedGroupOrdinals(section);

      for (const group of section.groups) {
        const groupOrdinal = groupOrdinals.get(`${group.class}:${group.kind}`) as number;
        const numbers = group.lines.map((line) => map.get(line.lineId));
        for (const number of numbers) {
          expect(number, `every line of ${section.bill} / ${group.class} · ${group.kind} is numbered`).toBeTruthy();
          expect(number as string, `${number} is an S.G.I string: three 1-based ordinals, no padding and no zero`).toMatch(SGI);
        }
        const parts = numbers.map((number) => (number as string).split("."));
        for (const part of parts) {
          expect(Number(part[0]), `S is ${section.bill}'s 1-based ordinal in BILLS — the absolute section number, counted over the six and not over the sections present`).toBe(sectionOrdinal);
          expect(Number(part[1]), `G is the (class, kind) group's 1-based ordinal in ELEMENT_TYPES-then-KINDS order, counting only the groups this section holds`).toBe(groupOrdinal);
        }
        const withinGroup = parts.map((part) => Number(part[2])).sort((a, b) => a - b);
        expect(withinGroup, `I runs 1..n inside ${group.class} · ${group.kind} with no gap and no zero`).toEqual(group.lines.map((_line, index) => index + 1));
      }
    }
  });

  test("AC-3: S is the section's ordinal among the SIX, not its position among the sections present", async () => {
    await ready();
    // A campaign that published nothing into Substructure: the draft holds Superstructure and
    // Finishes and nothing else. Their item numbers still open 2 and 3, because S is what L-BD-08
    // calls the section — a number a reader can quote across two projects — not where it happens to
    // sit in this draft's array.
    const whole = syntheticDraftPayload(96);
    const wanted = ["SUPERSTRUCTURE", "FINISHES"];
    const sections = whole.sections.filter((section) => wanted.includes(section.bill));
    expect(sections.map((section) => section.bill), "the payload under test holds exactly those two sections, in this order").toEqual(wanted);

    const map = numbering.numberItems(sections);
    for (const section of sections) {
      const expected = SIX_BILLS.indexOf(section.bill) + 1;
      for (const group of section.groups) {
        for (const held of group.lines) {
          const S = Number((map.get(held.lineId) as string).split(".")[0]);
          expect(S, `${section.bill} opens ${expected} — its ordinal in BILLS — however few sections stand beside it`).toBe(expected);
        }
      }
    }
  });

  test("AC-3: G follows the catalogue's order, not the order the section happens to hold its groups in", async () => {
    await ready();
    // The groups are handed over in REVERSED catalogue order, so "the position in the array" and
    // "the ordinal in ELEMENT_TYPES-then-KINDS" are opposite answers and only one of them is right.
    const whole = syntheticDraftPayload(96);
    const section = whole.sections[0] as PayloadSectionShape;
    expect(section.groups.length, "the section under test holds several groups, so an order exists to get wrong").toBeGreaterThan(2);

    const catalogueOrder = [...section.groups].sort(
      (a, b) => classes.indexOf(a.class) - classes.indexOf(b.class) || kindRoster.indexOf(a.kind) - kindRoster.indexOf(b.kind),
    );
    const reversed: PayloadSectionShape = { ...section, groups: [...catalogueOrder].reverse() };
    expect(reversed.groups.map((group) => `${group.class}:${group.kind}`), "and it is handed over back to front").not.toEqual(
      catalogueOrder.map((group) => `${group.class}:${group.kind}`),
    );

    const map = numbering.numberItems([reversed]);
    catalogueOrder.forEach((group, index) => {
      const held = group.lines[0] as { lineId: string };
      const G = Number((map.get(held.lineId) as string).split(".")[1]);
      expect(G, `${group.class} · ${group.kind} is group ${index + 1} of this section by ELEMENT_TYPES then KINDS — the array handed it over at position ${reversed.groups.indexOf(group) + 1}`).toBe(
        index + 1,
      );
    });
  });

  test("AC-3: I takes the lower level first, and only then the canonical order of the object key", async () => {
    await ready();
    // Two lines of ONE group on two levels, with the object keys sorting the other way: the lower
    // level's key is last canonically, so a numbering that read the key alone would put the upper
    // storey first. The draft is read down the building.
    //
    // Beams, not columns: a beam is placed by its own override wherever it stands (SUPERSTRUCTURE),
    // so the two storeys land in ONE section and the ordering rule is the only thing left to judge.
    // A column would be cut by the plinth and the pair would be answering a different question.
    const reading = readingOf(TWO_LEVELS, [
      line("l-upper", "beam/GF/A1", "beam", "rcc.concrete", "lvl-gf", "1.000", "m3"),
      line("l-lower", "beam/Z-FDN/Z9", "beam", "rcc.concrete", "lvl-fdn", "2.000", "m3"),
    ]);
    // Read in code units (L-REG-05): `Z` is above `G`, so the lower storey's key really does sort
    // after the upper one's. The premise is checked against the shipped comparator rather than
    // assumed, because the whole force of the case is that level and key disagree.
    expect(canonical("beam/Z-FDN/Z9", "beam/GF/A1"), "the lower storey's key sorts AFTER the upper one's, so level and key disagree").toBe(1);

    // Through the seam that holds the stack: the emission knows each line's level, and the numbering
    // the document and the screen share is run over what it emitted (B-17).
    const payload = emission.boqDraftPayloadOf(reading);
    const map = numbering.numberItems(payload.sections);

    const lower = map.get("l-lower");
    const upper = map.get("l-upper");
    expect(lower, "the line on the foundation level is numbered").toBeTruthy();
    expect(upper, "and so is the one on the ground floor").toBeTruthy();
    expect((lower as string).split(".").slice(0, 2), "both lines stand in one section and one group, so only I may differ between them").toEqual((upper as string).split(".").slice(0, 2));
    expect(Number((lower as string).split(".")[2]), "the lower level takes I = 1: level ordinal ascending FIRST, and the object key only where two lines share a level (AM-14 §2)").toBe(1);
    expect(Number((upper as string).split(".")[2]), "and the storey above it follows").toBe(2);
  });

  test("AC-3: I orders a group by level then by the canonical order of the object key, never by the array's order", async () => {
    await ready();
    const payload = syntheticDraftPayload(12);
    const section = payload.sections[0] as PayloadSectionShape;
    const group = section.groups[0] as PayloadSectionShape["groups"][number];
    // One level for every line of the group, so the level ordinal cannot break the tie and the
    // canonical order of the object key is the rule under test (interfaces: `compareCanonical`).
    const onOneLevel = group.lines.map((line, index) => ({ ...line, level: "GF", objectKey: `column/GF/${["m", "a", "z", "b"][index % 4] as string}-${index}` }));
    const ordered: PayloadSectionShape = { ...section, groups: [{ ...group, lines: onOneLevel }] };
    const shuffled: PayloadSectionShape = { ...section, groups: [{ ...group, lines: [...onOneLevel].reverse() }] };

    const a = numbering.numberItems([ordered]);
    const b = numbering.numberItems([shuffled]);
    expect([...b.entries()].sort(), "the same lines handed over in another order are numbered the same: the order is DERIVED, never the array's").toEqual([...a.entries()].sort());

    const byNumber = [...onOneLevel].sort((one, other) => Number((a.get(one.lineId) as string).split(".")[2]) - Number((a.get(other.lineId) as string).split(".")[2]));
    const byKey = [...onOneLevel].sort((one, other) => canonical(one.objectKey, other.objectKey));
    expect(byNumber.map((line) => line.objectKey), "inside a group on one level, I follows the canonical order of the object key").toEqual(byKey.map((line) => line.objectKey));
  });

  test("AC-3: the same sections answer the same map, and one added line renumbers freely while every identity stands", async () => {
    await ready();
    const payload = syntheticDraftPayload(48);
    const first = numbering.numberItems(payload.sections);
    const second = numbering.numberItems(payload.sections);
    expect([...second.entries()].sort(), "numbering is pure: two calls over one payload answer equal maps").toEqual([...first.entries()].sort());

    const grown = syntheticDraftPayload(49);
    const after = numbering.numberItems(grown.sections);
    for (const lineId of first.keys()) {
      expect(after.has(lineId), `${lineId} is still a line of the draft after one more was measured — a renumbering never drops an identity`).toBe(true);
    }
    expect(after.size, "the added line is numbered too — the map grows by exactly the line, however many numbers moved around it").toBe(first.size + 1);
    for (const number of after.values()) {
      expect(number, "and every number of the grown draft is still an S.G.I string").toMatch(SGI);
    }
  });

  test("AC-3: two renders of one payload digest the same payload", async () => {
    await ready();
    const documents = await productModule<{ renderDocument: (kind: string, payload: unknown, ctx: { requestId: string; actor: string }, deps?: unknown) => Promise<{ payloadDigest: string }> }>(
      DOCUMENTS_MODULE,
    );
    const payload = syntheticDraftPayload(36);
    const ctx = { requestId: "ac-3-request", actor: "acceptance" };
    // The subprocess is injected: what is under test is the payload the render was GIVEN, not the
    // bytes the renderer made of it (AC-4 grades those).
    const deps = { compile: async (): Promise<Uint8Array> => new Uint8Array([0x25, 0x50, 0x44, 0x46]) };

    const one = await documents.renderDocument("boq-draft", payload, ctx, deps);
    const two = await documents.renderDocument("boq-draft", payload, ctx, deps);
    expect(one.payloadDigest, "one payload, one digest: the document states what it was given and the derivation adds nothing of its own").toBe(two.payloadDigest);
    expect(one.payloadDigest.length, "and the digest is a digest").toBeGreaterThan(0);
  });

  test("AC-3: a payload quantity is the reading rounded half-even at the kind's document precision, and the reading is untouched", async () => {
    await ready();
    const levels = [
      { levelId: "lvl-fdn", ordinal: -1, label: "FDN" },
      { levelId: "lvl-gf", ordinal: 0, label: "GF" },
    ];
    // Two figures whose fourth place is exactly a half, so the rule is HALF-EVEN and not half-up:
    // 1.0005 → 1.000 and 1.0015 → 1.002 at three places; 2.005 → 2.00 and 2.015 → 2.02 at two.
    const reading: ReadingShape = {
      project: "Sattva Court",
      campaignId: "33333333-3333-4333-8333-333333333333",
      setRevisionId: "44444444-4444-4444-8444-444444444444",
      levels,
      coverageComplete: false,
      lines: [
        { lineId: "l-1", objectKey: "column/GF/C1", class: "column", kind: "rcc.concrete", levelId: "lvl-gf", value: "1.00050", unit: "m3", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: COMPLETE },
        { lineId: "l-2", objectKey: "column/GF/C2", class: "column", kind: "rcc.concrete", levelId: "lvl-gf", value: "1.00150", unit: "m3", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: COMPLETE },
        { lineId: "l-3", objectKey: "column/GF/C3", class: "column", kind: "rcc.formwork", levelId: "lvl-gf", value: "2.0050", unit: "m2", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: COMPLETE },
        { lineId: "l-4", objectKey: "column/GF/C4", class: "column", kind: "rcc.formwork", levelId: "lvl-gf", value: "2.0150", unit: "m2", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: COMPLETE },
        { lineId: "l-5", objectKey: "column/GF/C5", class: "column", kind: "rcc.concrete", levelId: "lvl-gf", value: null, unit: "m3", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: PARTIAL_DECLARED },
      ],
    };
    const before = JSON.stringify(reading);
    const payload = emission.boqDraftPayloadOf(reading);
    expect(JSON.stringify(reading), "the emission reads the register and never writes back to it — the reading's own `value` fields stand").toBe(before);

    const emitted = new Map(payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines.map((line) => [line.lineId, { line, kind: group.kind }] as const))));
    const expectedHalfEven: Readonly<Record<string, string>> = { "l-1": "1.000", "l-2": "1.002", "l-3": "2.00", "l-4": "2.02" };

    for (const [lineId, expected] of Object.entries(expectedHalfEven)) {
      const held = emitted.get(lineId);
      expect(held, `${lineId} stands in a section of the draft`).toBeTruthy();
      const precision = (items[(held as { kind: string }).kind] as WorkItemShape).documentPrecision;
      expect((held as { line: { quantity: string | null } }).line.quantity, `${lineId} is rounded half-even to ${precision} places — L-MEA-05's decimal habit, never half-up`).toBe(expected);
      expect(((held as { line: { quantity: string | null } }).line.quantity as string).split(".")[1]?.length ?? 0, `${lineId} prints exactly ${precision} places, no more and no fewer`).toBe(precision);
    }

    const declared = emitted.get("l-5");
    expect(declared, "a line that declares what it could not measure is still a line of the draft").toBeTruthy();
    expect((declared as { line: { quantity: string | null } }).line.quantity, "and it states no figure at all — never a zero, which would be a quantity nobody measured (L-QTY-04)").toBeNull();

    expect(payload.taxonomyVersion, "the payload is stamped with the taxonomy it was drafted under").toBe(TAXONOMY_VERSION);
    expect(payload.coverage, "the reading's coverage is carried into the payload").toBe("INCOMPLETE");
  });
});
