/**
 * AC-1 — the FOUNDATIONS shard, registered: four kinds in the closed catalogue, one rail each, the
 * foundation concrete reader composed into the kind that already had one, and the nine `bears` rows
 * (R-TO-032, L-MEA-04, L-MEA-08, AM-11).
 *
 * The composition is graded by what it DOES, never by identity against a function built here: ONE
 * RAIL PER KIND is the law, so `rcc.concrete` is answered by one function whose batch is the two
 * class readers' batches concatenated in argument order (riskNotes (1)). That is `composeRails`'s
 * whole meaning, and it is asked of the roster the measure job actually runs.
 *
 * Nothing is transcribed: the kinds, the classes and the emitted tables are read from the product's
 * own consts and emitter, and the committed tables are compared with what the emitter renders (B-19).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  BEARS_MODULE,
  CATALOGUE_DIR,
  CATALOGUE_EMIT_MODULE,
  CATALOGUE_MAPS_MODULE,
  CATALOGUE_MODULE,
  COLUMN_RAIL_MODULE,
  EARTHWORK_EXCAVATION,
  FOOTING,
  FOUNDATIONS_ROSTER_LINES,
  FRAME_ROSTER_MODULE,
  KINDS_MODULE,
  KIND_LAW_MODULE,
  PCC_BLINDING,
  PILE,
  PILE_CAP,
  PILING_BORED,
  PILING_BORING,
  PRISM_RECT,
  RAILS_LAW_MODULE,
  RCC_CONCRETE,
  REPO_ROOT,
  foundationsRailDoor,
  foundationsRoster,
  outline,
  placement,
  productModule,
  railInput,
  railsRoster,
  reading,
  registerRow,
  variant,
  type RailBatchShape,
  type RailInputShape,
  type RailShape,
} from "./support/foundations-contract";

/** The discipline and the algebra every kind of this shard stands in (AC-1, interfaces). */
const STRUCTURAL = "STRUCTURAL";
const MEMBER_ALGEBRA = "member";

/** What the catalogue says each new kind is measured in, and to how many places (interfaces). */
const CATALOGUE_ENTRIES: readonly { kind: string; dimension: string; unit: string; precision: number }[] = [
  { kind: PILING_BORED, dimension: "COUNT", unit: "pcs", precision: 0 },
  { kind: PILING_BORING, dimension: "LENGTH", unit: "m", precision: 3 },
  { kind: EARTHWORK_EXCAVATION, dimension: "VOLUME", unit: "m3", precision: 3 },
  { kind: PCC_BLINDING, dimension: "VOLUME", unit: "m3", precision: 3 },
];

/** The nine rows the `bears` relation gains — the classes this shard measures, and what each bears. */
const OWED_BEARS: readonly { class: string; kind: string }[] = [
  { class: FOOTING, kind: RCC_CONCRETE },
  { class: PILE_CAP, kind: RCC_CONCRETE },
  { class: PILE, kind: RCC_CONCRETE },
  { class: PILE, kind: PILING_BORED },
  { class: PILE, kind: PILING_BORING },
  { class: FOOTING, kind: EARTHWORK_EXCAVATION },
  { class: PILE_CAP, kind: EARTHWORK_EXCAVATION },
  { class: FOOTING, kind: PCC_BLINDING },
  { class: PILE_CAP, kind: PCC_BLINDING },
];

/**
 * The four kinds the closed catalogue GAINS (interfaces).
 *
 * The spec's `KINDS` line spells the roster as it stood a leaf ago — before `rcc.formwork` landed
 * with the frame (inc-306) — so what this leaf lands is read as the APPEND it is: the four below join
 * whatever the product already measures, and nothing already measured is dropped. A roster typed out
 * whole here would un-land another leaf's kind (B-19, B-20).
 */
const OWED_KINDS: readonly string[] = [PILING_BORED, PILING_BORING, EARTHWORK_EXCAVATION, PCC_BLINDING];

/** A corpus a concrete rail has something to say about: one column, one footing, read off one plan. */
function concreteCorpus(): RailInputShape {
  const columnPlacement = "PLACEMENT:S-02:C1:1000:2000";
  const footingPlacement = "PLACEMENT:S-04:F1:3000:4000";
  return railInput({
    kind: RCC_CONCRETE,
    objects: [
      registerRow({ placementKey: columnPlacement, elementType: "column", mark: "C1" }),
      registerRow({ placementKey: footingPlacement, elementType: FOOTING, mark: "F1" }),
    ],
    placements: {
      [columnPlacement]: placement({ memberFamily: "C1", sourceEntity: columnPlacement }),
      [footingPlacement]: placement({
        memberFamily: "F1",
        sourceEntity: footingPlacement,
        outline: outline({ type: PRISM_RECT, area: reading("2250000", "mm2"), length: reading("1500", "mm"), breadth: reading("1500", "mm") }),
      }),
    },
    memberTypes: {
      "33333333-3333-4333-8333-333333333333": {
        C1: [variant({ variantKey: "C1", width: 300, depth: 450 })],
        F1: [variant({ variantKey: "F1", width: 1500, depth: 1500, dimensions: { depth: reading("450", "mm"), top: reading("-609.6", "mm") } })],
      },
    },
  });
}

describe("AC-1: the foundations shard is registered — kinds, rails, bears and the emitted tables", () => {
  test("AC-1: FOUNDATIONS_RAILS keys the four kinds, each by the very rail its home publishes", async () => {
    const roster = await foundationsRoster();
    const door = await foundationsRailDoor();
    expect(Object.keys(roster).sort(), "the area's roster keys exactly the four kinds this shard measures (AM-11, L-MEA-08)").toEqual(Object.keys(FOUNDATIONS_ROSTER_LINES).sort());
    for (const [kind, rail] of Object.entries(FOUNDATIONS_ROSTER_LINES)) {
      expect(roster[kind], `${kind} is measured by \`${rail}\` itself — a wrapper would be a second implementation (ARCH-02)`).toBe(
        (door as unknown as Record<string, unknown>)[rail],
      );
    }
  });

  test("AC-1: the barrel hands out those very functions, and answers the five kinds the catalogue closes over", async () => {
    const rails = await railsRoster();
    const roster = await foundationsRoster();
    const kinds = await productModule<{ KINDS: readonly string[]; isKind: (value: unknown) => boolean }>(KINDS_MODULE);
    for (const kind of OWED_KINDS) {
      expect([...kinds.KINDS], `the closed catalogue holds \`${kind}\` — a kind exists because this roster names it (L-MEA-04)`).toContain(kind);
      expect(kinds.isKind(kind), "and its guard admits it — the closed list and its guard are one statement").toBe(true);
    }
    expect(new Set(kinds.KINDS).size, "the roster names each kind once").toBe(kinds.KINDS.length);
    expect(
      [...kinds.KINDS].sort(),
      `the barrel measures every kind the catalogue closes over — a kind with no rail is a kind nothing measures (L-MEA-08); it answers ${JSON.stringify(Object.keys(rails).sort())}`,
    ).toEqual(Object.keys(rails).sort());
    for (const [kind, rail] of Object.entries(roster)) {
      expect(rails[kind], `the barrel answers ${kind} with the area's own rail (AM-11: the barrel enumerates and never re-declares)`).toBe(rail);
    }
  });

  test("AC-1: rcc.concrete is ONE rail whose batch is the column reader's and this shard's, in that order", async () => {
    const law = await productModule<{ composeRails: (...rails: readonly RailShape[]) => RailShape }>(RAILS_LAW_MODULE);
    expect(typeof law.composeRails, `${RAILS_LAW_MODULE} publishes \`composeRails\` — how one kind's several class readers are joined (riskNotes (1))`).toBe("function");

    const column = await productModule<Record<string, unknown>>(COLUMN_RAIL_MODULE);
    const door = await foundationsRailDoor();
    const columnRail = column["columnConcreteRail"] as RailShape;
    const foundationRail = door.foundationConcreteRail;

    const input = concreteCorpus();
    const apart: RailBatchShape = {
      offers: [...columnRail(input).offers, ...foundationRail(input).offers],
      observations: [...columnRail(input).observations, ...foundationRail(input).observations],
    };
    const composed = law.composeRails(columnRail, foundationRail)(input);
    expect(composed.offers, "`composeRails` concatenates the rails' offers in argument order and computes nothing of its own").toEqual(apart.offers);
    expect(composed.observations, "and their observations with them").toEqual(apart.observations);

    const rails = await railsRoster();
    const kindRail = rails[RCC_CONCRETE];
    expect(typeof kindRail, "the barrel measures rcc.concrete").toBe("function");
    const whole = (kindRail as RailShape)(input);
    expect(whole.offers, "the ONE rcc.concrete rail the roster holds is that composition — the frame's roster line carries it (AC-1)").toEqual(apart.offers);
    expect(whole.observations, "observations included").toEqual(apart.observations);
    expect(
      whole.offers.filter((offer) => offer.class === FOOTING).length,
      `the composed rail reads the footing of the corpus — a composition that said nothing about a foundation would prove nothing (it answered ${JSON.stringify(whole.offers.map((one) => one.class))})`,
    ).toBeGreaterThan(0);

    const frame = await productModule<{ FRAME_RAILS: Record<string, RailShape> }>(FRAME_ROSTER_MODULE);
    expect(frame.FRAME_RAILS[RCC_CONCRETE], "and the frame's own roster line is the function the barrel hands out (AM-11)").toBe(kindRail);
  });

  test("AC-1: each new kind offends no vocabulary, and the catalogue says what it is measured in", async () => {
    const law = await productModule<{ offendingTokens: (name: string) => readonly { token: string; vocabulary: string }[] }>(KIND_LAW_MODULE);
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { dimension: string; canonicalUnit: string; documentPrecision: number }> }>(CATALOGUE_MODULE);
    const maps = await productModule<{ KIND_DISCIPLINE: Record<string, string>; KIND_ALGEBRA: Record<string, string> }>(CATALOGUE_MAPS_MODULE);

    for (const entry of CATALOGUE_ENTRIES) {
      expect(law.offendingTokens(entry.kind), `\`${entry.kind}\` names a trade and material only — no dimension, unit, element class, role or book word (L-MEA-04)`).toEqual([]);
      const item = catalogue.WORK_ITEM_CATALOGUE[entry.kind];
      expect(item, `the catalogue states what a ${entry.kind} quantity is`).toBeTruthy();
      expect(item?.dimension, `${entry.kind} is a ${entry.dimension} (interfaces)`).toBe(entry.dimension);
      expect(item?.canonicalUnit, `measured in ${entry.unit} — the canonical unit of its dimension (B-17)`).toBe(entry.unit);
      expect(item?.documentPrecision, `documented to ${String(entry.precision)} places (interfaces)`).toBe(entry.precision);
      expect(maps.KIND_DISCIPLINE[entry.kind], `the structural set is authoritative for ${entry.kind} (L-MEA-04)`).toBe(STRUCTURAL);
      expect(maps.KIND_ALGEBRA[entry.kind], `and it is a member quantity — section × run, never a face and never a network (L-MEA-08)`).toBe(MEMBER_ALGEBRA);
    }
  });

  test("AC-1: BEARS gains exactly the nine rows this shard measures, and nothing else about these classes", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
    const owed = OWED_BEARS.map((row) => `${row.class}|${row.kind}`).sort();
    const held = bears.BEARS.filter(
      (row) => [FOOTING, PILE_CAP, PILE].includes(row.class) || [PILING_BORED, PILING_BORING, EARTHWORK_EXCAVATION, PCC_BLINDING].includes(row.kind),
    )
      .map((row) => `${row.class}|${row.kind}`)
      .sort();
    expect(held, "the relation names what a footing, a pile cap and a pile lawfully bear — no more, and none of the new kinds borne by anything else (L-MEA-04)").toEqual(owed);
  });

  test("AC-1: the committed catalogue tables are what the emitter renders from those consts", async () => {
    const emitter = await productModule<{ emittedTables: () => Record<string, string>; CATALOGUE_FILES: readonly string[] }>(CATALOGUE_EMIT_MODULE);
    const rendered = emitter.emittedTables();
    for (const file of emitter.CATALOGUE_FILES) {
      const committed = readFileSync(join(REPO_ROOT, CATALOGUE_DIR, file), "utf8");
      expect(
        committed,
        `${CATALOGUE_DIR}/${file} is what \`emittedTables()\` renders — re-emit it in a \`baseline:\` commit (\`pnpm tsx tests/catalogue/emit-catalogue.ts\`, L-MEA-04)`,
      ).toBe(rendered[file]);
    }
  });
});
