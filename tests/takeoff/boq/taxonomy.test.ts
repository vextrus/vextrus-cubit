/**
 * AC-1 — the six-bill taxonomy and its most-specific-first resolver, graded over F-RCC6-BNBC
 * (L-BD-08, AM-14, AM-16, docs/decisions/bill-taxonomy.md).
 *
 * The yardstick is the fixture, not a roster this file invented: every row of the BNBC golden whose
 * class and kind the product's own `ELEMENT_TYPES`/`KINDS` hold — after the golden→product spelling
 * map the stage declares — is put to `resolveBill` against a stack built from the fixture's own
 * level labels, and the answer is compared with the bill the decision table names for that class.
 * A fixture that grows a member grows the expectation with it (B-19); nothing here freezes a count.
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { goldenRows } from "../../golden/support/golden-fixture";
import {
  GOLDEN_CLASS,
  GOLDEN_KIND,
  LOCATION,
  SIX_BILLS,
  TAXONOMY_VERSION,
  UNCLASSIFIED,
  elementTypes,
  inTree,
  kinds,
  resolverModule,
  stackOf,
  taxonomyModule,
  type BillResolutionShape,
  type LevelShape,
  type PlinthBoundaryShape,
  type ResolverModule,
  type TaxonomyModule,
} from "./support/boq-stage";
import { readFileSync } from "node:fs";

/** The bills the decision table names for a class that is not cut at the plinth (AC-1's own list). */
const FIXED_BILL: Readonly<Record<string, string>> = Object.freeze({
  pile: "SUBSTRUCTURE",
  pile_cap: "SUBSTRUCTURE",
  footing: "SUBSTRUCTURE",
  tie_beam: "SUBSTRUCTURE",
  beam: "SUPERSTRUCTURE",
  slab: "SUPERSTRUCTURE",
  stair: "SUPERSTRUCTURE",
  lintel: "SUPERSTRUCTURE",
  brick_wall: "SUPERSTRUCTURE",
});

/** The two classes the plinth cuts: below the ground floor they are Substructure, at or above it not. */
const CUT_AT_THE_PLINTH: readonly string[] = Object.freeze(["column", "shear_wall"]);

/** The rows a decision reaches through (L-BD-08's own three), never `NONE` for a mapped pair. */
const DECIDING_ROWS: readonly string[] = Object.freeze(["OVERRIDE", "GROUP", "DIVISION"]);

let taxonomy!: TaxonomyModule;
let resolver!: ResolverModule;
let classes!: readonly string[];
let kindRoster!: readonly string[];
let stack!: LevelShape[];
let boundary!: PlinthBoundaryShape;

/** One graded row: the golden row, spelled the product's way, with the level it stands on. */
type Graded = { class: string; kind: string; label: string; ordinal: number; expected: string };

let graded: Graded[] = [];

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let loading: Promise<void> | undefined;
const ready = (): Promise<void> => (loading ??= load());

async function load(): Promise<void> {
  taxonomy = await taxonomyModule();
  resolver = await resolverModule();
  classes = await elementTypes();
  kindRoster = await kinds();

  const rows = goldenRows("rcc6-bnbc");
  // The fixture's own model records each storey's elevation; the stack is built from it so that a
  // fixture which gains a floor gains an ordinal rather than breaking this suite (test contract:
  // fixtures/rcc6-bnbc/model.json).
  const model = JSON.parse(readFileSync(inTree("fixtures/rcc6-bnbc/model.json"), "utf8")) as { levels?: Record<string, string> };
  const labels = [...new Set(rows.map((row) => row.level))];
  stack = stackOf(labels, model.levels ?? {});
  const ordinalOf = new Map(stack.map((level) => [level.label, level.ordinal]));
  expect(ordinalOf.get("GF"), "the stack AC-1 builds stands the ground floor at ordinal 0").toBe(0);

  boundary = resolver.plinthBoundaryOf(stack);

  graded = rows.flatMap((row) => {
    const klass = GOLDEN_CLASS[row.class];
    const kind = GOLDEN_KIND[row.kind];
    if (klass === undefined || kind === undefined) return [];
    if (!classes.includes(klass) || !kindRoster.includes(kind)) return [];
    const ordinal = ordinalOf.get(row.level);
    if (ordinal === undefined) return [];
    const expected = CUT_AT_THE_PLINTH.includes(klass) ? (ordinal < 0 ? "SUBSTRUCTURE" : "SUPERSTRUCTURE") : (FIXED_BILL[klass] as string);
    return [{ class: klass, kind, label: row.level, ordinal, expected }];
  });
}

/** Which list of the taxonomy a deciding row was drawn from (`OVERRIDE` → `overrides`, …). */
function listNameOf(row: string): string {
  return `${row.toLowerCase()}s`;
}

/**
 * The taxonomy row a resolution says decided it, found in the data by its own identifying field:
 * an override by its class (and its kind where the row states one), a group by the whole kind, a
 * division by the kind's chapter prefix. `null` when the data holds no such row — which is the
 * answer that makes "records which row decided" a claim rather than a label.
 */
function rowNamedBy(decidedBy: { row: string; key: string }, line: { class: string; kind: string }): { bill: string } | null {
  const key = decidedBy.key;
  const data = taxonomy.BILL_TAXONOMY;
  if (decidedBy.row === "OVERRIDE") {
    return (
      data.overrides.find(
        (row) => key.includes(row.class) && row.class === line.class && (row.kind === undefined || (row.kind === line.kind && key.includes(row.kind))),
      ) ?? null
    );
  }
  if (decidedBy.row === "GROUP") return data.groups.find((row) => row.group === line.kind && key.includes(row.group)) ?? null;
  if (decidedBy.row === "DIVISION") {
    const chapter = line.kind.split(".")[0] as string;
    return data.divisions.find((row) => row.division === chapter && key.includes(row.division)) ?? null;
  }
  return null;
}

describe("AC-1: the six bills are swappable data, resolved most-specific-first", () => {
  test("AC-1: BILLS is L-BD-08's six sections in L-BD-08's order, and holds no seventh", async () => {
    await ready();
    expect([...taxonomy.BILLS], "the six sections of L-BD-08 (L244), in the clause's own order — AM-16 restored Electrical and Plumbing and took Masonry and Provisional sums out").toEqual([
      ...SIX_BILLS,
    ]);
    expect([...taxonomy.BILL_TAXONOMY.bills], "the taxonomy data publishes the same six, in the same order — one roster, never two").toEqual([...SIX_BILLS]);
    expect(taxonomy.BILLS, "a provisional sum is a labelled line inside the bill it provides for, never a seventh bill (AM-16)").not.toContain(taxonomy.PROVISIONAL_SUM);
    expect(taxonomy.BILLS, "`UNCLASSIFIED` is the resolver's own answer, never a section of the taxonomy").not.toContain(UNCLASSIFIED);
    expect(taxonomy.BILLS.length, "six, and a seventh member is a change to L-BD-08 rather than to this data").toBe(6);
  });

  test("AC-1: the taxonomy stamps a non-empty version every document carries", async () => {
    await ready();
    expect(typeof taxonomy.BILL_TAXONOMY.version, "the version is a string a document can be stamped with").toBe("string");
    expect(taxonomy.BILL_TAXONOMY.version.length, "and it is not empty — an unstamped document states no taxonomy (L-BD-08)").toBeGreaterThan(0);
    expect(taxonomy.BILL_TAXONOMY.version, "this increment's taxonomy id, as the decision records it").toBe(TAXONOMY_VERSION);
  });

  test("AC-1: every F-RCC6-BNBC row the rosters hold resolves to the bill the decision table names", async () => {
    await ready();
    expect(graded.length, "the BNBC golden bears rows this product's rosters hold — a suite that graded nothing would prove nothing").toBeGreaterThan(0);

    const answers = graded.map((row) => ({ row, answer: resolver.resolveBill({ class: row.class, kind: row.kind, levelOrdinal: row.ordinal }, boundary) }));

    for (const { row, answer } of answers) {
      const what = `${row.class} × ${row.kind} on ${row.label} (ordinal ${row.ordinal})`;
      expect(answer.bill, `${what} bills to ${row.expected} — docs/decisions/bill-taxonomy.md's mapping table`).toBe(row.expected);
      expect(answer.bill, `${what} is placed by a row; nothing the rosters hold falls through to UNCLASSIFIED (AM-14: an unmapped class is a defect of the data)`).not.toBe(UNCLASSIFIED);
      expect(answer.reason, `${what} is classified, so it carries no unclassified reason`).toBeNull();
      expect(DECIDING_ROWS, `${what} records WHICH row decided it (L-BD-08), and ${answer.decidedBy.row} is not one of the three`).toContain(answer.decidedBy.row);
      expect(answer.taxonomyVersion, `${what} carries the version the resolution was made under`).toBe(taxonomy.BILL_TAXONOMY.version);

      // "The resolver records WHICH ROW decided" (L-BD-08) is a claim about the DATA, not a label:
      // the key it reports is looked up in the taxonomy's own list for the row it names, and the row
      // found there must be the one that produced this answer.
      const deciding = rowNamedBy(answer.decidedBy, row);
      expect(deciding, `${what}: decidedBy ${answer.decidedBy.row}:${answer.decidedBy.key} names a row BILL_TAXONOMY.${listNameOf(answer.decidedBy.row)} does not hold`).not.toBeNull();
      expect([row.expected, LOCATION], `${what}: the row that is recorded as deciding targets the bill that was answered (or the location cut that chose it)`).toContain(
        (deciding as { bill: string }).bill,
      );
    }
  });

  test("AC-1: the resolver READS the taxonomy — an injected table moves the answer, most specific first", async () => {
    await ready();
    // L-BD-08's "swappable data" is only true if swapping it swaps the answer. The table below
    // contradicts the shipped one at every level: a beam is sent to FINISHES by an override, its
    // kind is sent to PLUMBING by a group, and the whole `rcc` chapter to EXTERNAL by a division —
    // so each answer names which of the three reached the pair first.
    const injected = {
      version: "bill-taxonomy/injected",
      bills: [...SIX_BILLS],
      overrides: [{ class: "beam", bill: "FINISHES" }],
      groups: [{ group: "rcc.concrete", bill: "PLUMBING" }],
      divisions: [{ division: "rcc", bill: "EXTERNAL" }],
    };

    const overridden = resolver.resolveBill({ class: "beam", kind: "rcc.concrete", levelOrdinal: 0 }, boundary, injected);
    expect(overridden.bill, "an element-type override is the most specific row, and it takes the pair before the group or the division can").toBe("FINISHES");
    expect(overridden.decidedBy.row, "and the resolution says an override decided it").toBe("OVERRIDE");
    expect(overridden.taxonomyVersion, "the stamp is the taxonomy that was READ, never a constant beside the resolver").toBe(injected.version);

    const byGroup = resolver.resolveBill({ class: "slab", kind: "rcc.concrete", levelOrdinal: 0 }, boundary, injected);
    expect(byGroup.bill, "with no override for the class, the kind's own group row decides — before the chapter it belongs to").toBe("PLUMBING");
    expect(byGroup.decidedBy.row, "and the resolution says a group decided it").toBe("GROUP");

    const byDivision = resolver.resolveBill({ class: "slab", kind: "rcc.formwork", levelOrdinal: 0 }, boundary, injected);
    expect(byDivision.bill, "with neither an override nor a group, the kind's chapter decides").toBe("EXTERNAL");
    expect(byDivision.decidedBy.row, "and the resolution says a division decided it").toBe("DIVISION");

    const unreached = resolver.resolveBill({ class: "slab", kind: "masonry.brickwork", levelOrdinal: 0 }, boundary, injected);
    expect(unreached.bill, "and a pair this table reaches by no row at all is kept as UNCLASSIFIED, however the shipped table would have placed it").toBe(UNCLASSIFIED);
    expect(unreached.reason, "with the reason stated").toBe("NO_TAXONOMY_ROW");

    const located = resolver.resolveBill({ class: "beam", kind: "rcc.concrete", levelOrdinal: -5 }, boundary, {
      ...injected,
      overrides: [{ class: "beam", bill: LOCATION }],
    });
    expect(located.bill, "a row whose target is the location cut sends the line to the side of the plinth it stands on — the cut is data, never a class the resolver knows by name").toBe(
      "SUBSTRUCTURE",
    );
    expect(located.location, "and records which side").toBe("AT_OR_BELOW_PLINTH");
  });

  test("AC-1: the classes the plinth cuts read their side of it off the level stack", async () => {
    await ready();
    const cut = graded.filter((row) => CUT_AT_THE_PLINTH.includes(row.class));
    expect(cut.length, "the BNBC fixture bears columns and shear walls on both sides of the ground floor").toBeGreaterThan(0);
    expect(
      cut.some((row) => row.ordinal < 0),
      "and at least one of them stands below the ground floor, so the location cut is exercised",
    ).toBe(true);

    for (const row of cut) {
      const answer = resolver.resolveBill({ class: row.class, kind: row.kind, levelOrdinal: row.ordinal }, boundary);
      const where = `${row.class} on ${row.label}`;
      expect(answer.bill, `${where}: at or below the plinth is Substructure, above it Superstructure (AM-14 §1)`).toBe(row.expected);
      expect(answer.location, `${where} records which side of the plinth it was read on`).toBe(row.ordinal <= boundary.ordinal ? "AT_OR_BELOW_PLINTH" : "ABOVE_PLINTH");
    }

    const locationRows = [...taxonomy.BILL_TAXONOMY.overrides, ...taxonomy.BILL_TAXONOMY.groups, ...taxonomy.BILL_TAXONOMY.divisions].filter((row) => row.bill === LOCATION);
    expect(locationRows.length, "the location cut is a ROW TARGET in the data, not a conditional in the resolver (L-BD-08: swappable data)").toBeGreaterThan(0);
  });

  test("AC-1: a finished surface bills to Finishes through its kind's own row", async () => {
    await ready();
    for (const kind of ["finish.plaster", "finish.paint"]) {
      expect(kindRoster, `${kind} is a kind of this product's roster`).toContain(kind);
      const answer: BillResolutionShape = resolver.resolveBill({ class: "surface", kind, levelOrdinal: 0 }, boundary);
      expect(answer.bill, `surface × ${kind} bills to Finishes — the one surface-trade bill (docs/decisions/bill-taxonomy.md)`).toBe("FINISHES");
      expect(DECIDING_ROWS, `surface × ${kind} names the row that decided it`).toContain(answer.decidedBy.row);
      const deciding = rowNamedBy(answer.decidedBy, { class: "surface", kind });
      expect(deciding, `surface × ${kind}: decidedBy ${answer.decidedBy.row}:${answer.decidedBy.key} names a row BILL_TAXONOMY.${listNameOf(answer.decidedBy.row)} does not hold`).not.toBeNull();
      expect((deciding as { bill: string }).bill, `and that row is the one that sends a finished surface to Finishes`).toBe("FINISHES");
    }
  });

  test("AC-1: the data names no project, and reaches every class and kind the rosters hold", async () => {
    await ready();
    const rows = [...taxonomy.BILL_TAXONOMY.overrides, ...taxonomy.BILL_TAXONOMY.groups, ...taxonomy.BILL_TAXONOMY.divisions];
    const targets = [...SIX_BILLS, LOCATION];
    for (const row of rows) {
      expect(targets, `every row targets one of the six bills or the location cut, and ${JSON.stringify(row)} does not`).toContain(row.bill);
    }

    // "No project-name conditionals" (L-BD-08), asked of the DATA the resolver reads rather than of
    // anybody's source: the fixture's own project name appears in no key of the taxonomy.
    const spelled = JSON.stringify(rows).toLowerCase();
    for (const name of ["sattva", "rcc6", "bnbc"]) {
      expect(spelled.includes(name), `no row of the taxonomy names a project (${name}) — L-BD-08`).toBe(false);
    }
  });
});
