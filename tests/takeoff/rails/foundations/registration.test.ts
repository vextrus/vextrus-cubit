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
  refusalRegister,
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

/**
 * `whole` with `part` struck out of it in order — `null` when `part` does not stand in `whole` as an
 * ordered subsequence at all.
 *
 * A composed kind carries each reader's observations in that reader's own order, whatever other
 * readers of the same kind stand around them; what is left over is the other readers' (L-MEA-08).
 */
function withoutSubsequence<T>(whole: readonly T[], part: readonly T[]): T[] | null {
  const rest: T[] = [];
  let at = 0;
  for (const one of whole) {
    if (at < part.length && JSON.stringify(one) === JSON.stringify(part[at])) {
      at += 1;
      continue;
    }
    rest.push(one);
  }
  return at === part.length ? rest : null;
}

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
    const columnBatch = columnRail(input);
    const foundationBatch = foundationRail(input);
    const apart: RailBatchShape = {
      offers: [...columnBatch.offers, ...foundationBatch.offers],
      observations: [...columnBatch.observations, ...foundationBatch.observations],
    };
    const composed = law.composeRails(columnRail, foundationRail)(input);
    expect(composed.offers, "`composeRails` concatenates the rails' offers in argument order and computes nothing of its own").toEqual(apart.offers);
    expect(composed.observations, "and their observations with them").toEqual(apart.observations);

    const rails = await railsRoster();
    const kindRail = rails[RCC_CONCRETE];
    expect(typeof kindRail, "the barrel measures rcc.concrete").toBe("function");
    const whole = (kindRail as RailShape)(input);

    // What the roster's own rail is graded on is WHERE this shard's reader stands in the kind's batch,
    // never how many class readers the kind has today: `bears` names more of them every leaf the Bible
    // schedules, and a kind's batch pinned to an extent would un-land the next one (B-19, B-20).
    expect(
      whole.offers.slice(0, columnBatch.offers.length),
      "the column reader's offers stand FIRST in the kind's batch and unchanged — composing this shard's reader in adds no column line and takes none away (L-MEA-08)",
    ).toEqual(columnBatch.offers);
    expect(
      whole.offers.slice(-foundationBatch.offers.length),
      "and this shard's reader is composed LAST, its offers standing at the end in argument order (AC-1)",
    ).toEqual(foundationBatch.offers);

    const withoutColumn = withoutSubsequence(whole.observations, columnBatch.observations);
    expect(withoutColumn, "the column reader's observations stand in the kind's batch, in its own order").not.toBeNull();
    const others = withoutSubsequence(withoutColumn ?? [], foundationBatch.observations);
    expect(others, "and this shard's stand in it too, in its own order — a composition reports what its readers reported").not.toBeNull();
    const refusals = await refusalRegister();
    for (const observation of others ?? []) {
      expect(
        refusals[observation.code],
        `\`${observation.code}\` is a REGISTERED code of the closed taxonomy — every observation the kind's rail carries is a reader's own, and the composition mints none of its own (Q-07, L-MEA-08)`,
      ).toBeTruthy();
    }
    expect(
      whole.offers.filter((offer) => offer.class === FOOTING).length,
      `the composed rail reads the footing of the corpus — a composition that said nothing about a foundation would prove nothing (it answered ${JSON.stringify(whole.offers.map((one) => one.class))})`,
    ).toBeGreaterThan(0);

    // The frame area's roster line is where "this kind is measured by this very function" is claimed,
    // and it still holds: this shard's reader is composed INTO that function. What the barrel owes is
    // completeness rather than identity — a second area answers `rcc.concrete` now (a plate is
    // concreted as surely as a footing is), so the roster's rail is the areas COMPOSED, and over a
    // corpus only this area's classes stand in, that composition answers exactly this area's own
    // batch. A barrel that dropped an area fails here just as loudly (AM-11, settled reading).
    const frame = await productModule<{ FRAME_RAILS: Record<string, RailShape> }>(FRAME_ROSTER_MODULE);
    const declared = frame.FRAME_RAILS[RCC_CONCRETE];
    expect(typeof declared, `${FRAME_ROSTER_MODULE} declares the rail this kind's readers are composed into (AM-11)`).toBe("function");
    expect(
      (declared as RailShape)(input),
      "and the barrel's rail answers that declaration whole over this corpus — the areas it composes are its own, and none of them is lost (AM-11, L-MEA-08)",
    ).toEqual(whole);
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

  test("AC-1: BEARS gains exactly the nine rows this shard measures, and the six cells of its own grid stay empty", async () => {
    const bears = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
    const owed = OWED_BEARS.map((row) => `${row.class}|${row.kind}`).sort();
    const carried = bears.BEARS.map((row) => `${row.class}|${row.kind}`);

    // `BEARS` is an APPEND like the kinds roster above: R-TO-032 schedules formwork and rebar/BBS for
    // these very classes, and this leaf defers them, so the equality is scoped to the GRID this leaf
    // owns — its three classes crossed with its five kinds — never to a class-wide or kind-wide sweep
    // that would read a later leaf's lawful row as a defect (B-19, B-20).
    const grid = bears.BEARS.filter(
      (row) => [FOOTING, PILE_CAP, PILE].includes(row.class) && [RCC_CONCRETE, PILING_BORED, PILING_BORING, EARTHWORK_EXCAVATION, PCC_BLINDING].includes(row.kind),
    )
      .map((row) => `${row.class}|${row.kind}`)
      .sort();
    expect(
      grid,
      "over its own three classes and five kinds the relation names exactly the nine this shard measures — so the six cells that stay empty stay empty by RULE: a pile bears no rect-plan pit and no blinding (L-FRM-04 measures both from a rect plan), and a footing and a cap are not bored and are not counted as piles (AM-06 §2)",
    ).toEqual(owed);

    for (const row of owed) {
      expect(carried, `\`${row}\` stands in the relation — the nine rows this leaf lands are never quietly dropped by a later append (AM-11)`).toContain(row);
    }
    expect(
      carried.length,
      `the relation holds no (class, kind) twice — it is assembled by enumeration, and a repeated pair would bill one cell of one class twice (AM-11, L-MEA-08); it carried ${JSON.stringify(carried.filter((pair, at) => carried.indexOf(pair) !== at))}`,
    ).toBe(new Set(carried).size);
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
