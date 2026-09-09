/**
 * AC-5 — the gate, driven once over three offers and one observation (SEAM-GATE, L-MEA-08,
 * L-QTY-03, L-QTY-04).
 *
 * One batch carries the three answers the gate owes: an offer whose geometry was measured publishes
 * a line; the same offer with INTERPRETED geometry is a declared exclusion with a queue item and
 * never a line (L-QTY-04); an offer binding a unit the canon has no factor for is REFUSED, and the
 * refusal is returned rather than thrown so the other two still land (goal).
 *
 * Nothing about the published line is transcribed. The metres are the canon's own
 * (`convert(…, 'ft', 'm')`), the unit is the canon's canonical unit for the method's dimension, the
 * formula is what the registry's own `renderFormula` renders from the normalised bindings, and the
 * edition digest is the campaign's own — so a canon, a method or a pin that moves moves the
 * expectation with it (B-19).
 *
 * The workspace is staged as riskNotes (1) settles it: the tenant-scope template cites
 * `member.volume@1` before the first project exists, so the project's pin — a verbatim fork —
 * cites it too.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  INTERPRETED,
  INTERPRETED_UNCORROBORATED,
  MEMBER_VOLUME,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
  RAIL_OBSERVATIONS_TABLE,
  UNIT_UNMAPPED,
  bears,
  bindingsIn,
  campaignsSeam,
  closeStage,
  field,
  gateSeam,
  measure,
  methodsRegistry,
  offer,
  offersContract,
  oneRow,
  refusals,
  rowsOfCampaign,
  saidBy,
  stageCampaign,
  storeCounts,
  unitsSeam,
  type MeasureShape,
  type OfferShape,
  type RailObservationShape,
  type StagedCampaign,
} from "./support/gate-stage";

/** The unit A, B and C are read in — a foot, which the canon maps and which is not canonical. */
const READ_IN = "ft";

/** A unit the canon has no factor for at all (AC-5). */
const UNMAPPED_UNIT = "furlong";

/** The three readings A binds, chosen so their product in metres is an exact decimal. */
const READINGS: Readonly<Record<string, string>> = { b: "1.5", d: "2.5", L: "10" };

/** The calibration reference A's readings are affirmed against (L-QTY-03). */
const CALIBRATION = "CAL:S-101:grid-A";

let staged: Promise<StagedCampaign> | undefined;
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("evaluate", { objects: 3 }));

afterAll(async () => {
  await closeStage();
});

/** What one run of the gate over this batch left behind, computed once and read by every case. */
type Run = {
  it: StagedCampaign;
  verdict: { published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] };
  offers: { a: OfferShape; b: OfferShape; c: OfferShape };
  observation: RailObservationShape;
  method: {
    implementation: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof methodsRegistry>>["implementationOf"]>>>;
    variables: readonly { name: string; dimension: string }[];
  };
  countsAfterFirst: Record<string, number>;
};

let running: Promise<Run> | undefined;

/** The batch, evaluated once. Memoised so idempotency is judged by a second call, not a second setup. */
const run = (): Promise<Run> =>
  (running ??= (async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const contract = await offersContract();
    const catalogue = await bears();
    const registry = await methodsRegistry();

    const implementation = registry.implementationOf(MEMBER_VOLUME);
    expect(implementation, `the registry maps ${registry.methodKey(MEMBER_VOLUME)} to an implementation — the gate resolves the offer's method through it (goal)`).toBeTruthy();
    const method = implementation as NonNullable<typeof implementation>;
    expect(method.variables.length, "the method declares the variables its formula names").toBeGreaterThan(0);

    const bearsRow = catalogue.rows[0] as { class: string; kind: string };
    const geometryType = String(contract.GEOMETRY_TYPES[0]);
    const common = { setRevisionId: it.setRevisionId, kind: bearsRow.kind, class: bearsRow.class, geometryType };
    const readings = bindingsIn(READ_IN, READINGS, CALIBRATION);

    const a = offer({ ...common, objectKey: String(it.objectKeys[0]), bindings: readings, calibration: CALIBRATION });
    const b = offer({ ...common, objectKey: String(it.objectKeys[1]), bindings: readings, calibration: CALIBRATION, basis: INTERPRETED });
    const cBindings: Record<string, MeasureShape> = { ...readings, L: measure(READINGS["L"] as string, UNMAPPED_UNIT, { calibration: CALIBRATION }) };
    const c = offer({ ...common, objectKey: String(it.objectKeys[2]), bindings: cBindings, calibration: CALIBRATION });

    const observation: RailObservationShape = {
      class: bearsRow.class,
      kind: bearsRow.kind,
      code: INTERPRETED_UNCORROBORATED,
      objectKey: String(it.objectKeys[1]),
      detail: { why: "the outline was traced, not read" },
    };

    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [a, b, c], observations: [observation] });
    return { it, verdict, offers: { a, b, c }, observation, method: { implementation: method, variables: method.variables }, countsAfterFirst: storeCounts(it.tenantId) };
  })());

describe("AC-5: one batch, three answers — published, queued and refused", () => {
  test("AC-5: the verdict sums to the offers handed in, and the refusal is returned rather than thrown", async () => {
    const { verdict, offers } = await run();
    expect(
      { published: verdict.published, queued: verdict.queued, refused: verdict.refused },
      "one measured offer publishes, one interpreted offer is queued, one offer in an unmapped unit is refused",
    ).toEqual({ published: 1, queued: 1, refused: 1 });
    expect(verdict.published + verdict.queued + verdict.refused, "and the three arms account for every offer handed in (goal)").toBe(3);
    expect(
      [...verdict.refusals],
      `the refusal names the offer it is about and the code it answers with — a refusal is RETURNED, never thrown (goal)`,
    ).toEqual([{ objectKey: offers.c.register.objectKey, code: UNIT_UNMAPPED }]);
    expect((await refusals())[UNIT_UNMAPPED], `${UNIT_UNMAPPED} is registered in the closed taxonomy (Q-07)`).toBeTruthy();
  });

  test("AC-5: the published line carries the canon's own metres, in the canonical unit of the method's dimension", async () => {
    const { it, offers, method } = await run();
    const canon = await unitsSeam();
    const row = oneRow(
      rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId).filter((held) => String(field(held, "objectKey", "object_key")) === offers.a.register.objectKey),
      "the measured offer published exactly one quantity line",
    );

    // Every reading carried through the product's one canon, and multiplied as exact decimals —
    // never a number typed here (B-07, B-19).
    let expected = canon.exact("1");
    for (const variable of method.variables) {
      const reading = offers.a.bindings[variable.name] as MeasureShape;
      const carried = canon.convert(reading.value, reading.unit, canon.CANONICAL_UNIT[variable.dimension] as string);
      expect(carried.ok, `the canon carries ${reading.value} ${reading.unit} to the canonical unit of ${variable.dimension}: ${JSON.stringify(carried)}`).toBe(true);
      expected = expected.mul(canon.exact(String(carried.value)));
    }

    expect(
      canon.exact(String(field(row, "value", "value"))).eq(expected),
      `the line's SI value is the product of the canon-converted bindings at full precision — it says ${String(field(row, "value", "value"))}, the canon says ${expected.toString()} (L-QTY-03)`,
    ).toBe(true);
    expect(String(field(row, "unit", "unit")), `the line is stated in the canonical unit of the method's dimension (${method.implementation.dimension})`).toBe(
      canon.CANONICAL_UNIT[method.implementation.dimension],
    );
  });

  test("AC-5: the line cites the rule, its version and the edition the campaign is measured under", async () => {
    const { it, offers } = await run();
    const campaigns = await campaignsSeam();
    const row = oneRow(
      rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId).filter((held) => String(field(held, "objectKey", "object_key")) === offers.a.register.objectKey),
      "the measured offer published exactly one quantity line",
    );

    expect(String(field(row, "ruleId", "rule_id")), "the line names the rule it was derived by (L-QTY-03)").toBe(MEMBER_VOLUME.ruleId);
    expect(String(field(row, "ruleVersion", "rule_version")), "and the version of it in force (L-QTY-03)").toBe(MEMBER_VOLUME.version);

    const campaignRow = await campaigns.campaignOf(it.scope, it.campaignId);
    expect(campaignRow, "the campaign the line belongs to stands in the store").not.toBeNull();
    expect(
      String(field(row, "editionDigest", "edition_digest")),
      "the line is stamped with the campaign's own edition digest — a line states the edition it was measured under (L-MEA-01)",
    ).toBe(String(field(campaignRow as Record<string, unknown>, "editionDigest", "edition_digest")));
  });

  test("AC-5: the formula is what the registry renders from the normalised bindings, and names every variable", async () => {
    const { it, offers, method } = await run();
    const gate = await gateSeam();
    const row = oneRow(
      rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId).filter((held) => String(field(held, "objectKey", "object_key")) === offers.a.register.objectKey),
      "the measured offer published exactly one quantity line",
    );

    // The bindings, normalised through the gate's own `normaliseMeasure` — the same door the gate
    // reaches them by, so nothing here re-implements the carrying (B-17).
    const normalised: Record<string, { value: string; unit: string }> = {};
    for (const variable of method.variables) {
      const answer = gate.normaliseMeasure(offers.a.bindings[variable.name] as MeasureShape, variable.dimension);
      expect(answer.ok, `the gate normalises ${variable.name}: ${JSON.stringify(answer)}`).toBe(true);
      const carried = answer as { ok: true; value: string; unit: string };
      normalised[variable.name] = { value: carried.value, unit: carried.unit };
    }

    const rendered = gate.renderFormula(method.implementation, normalised);
    expect(
      String(field(row, "formula", "formula")),
      "the human-auditable formula string is rendered from the same rule as the value, through the registry method's one template (L-QTY-03)",
    ).toBe(rendered);
    for (const variable of method.variables) {
      expect(String(field(row, "formula", "formula")), `the formula names the declared variable ${variable.name} (L-QTY-03: named variables)`).toContain(variable.name);
    }
  });

  test("AC-5: the line keeps every raw reading beside its canonical value, and the calibration it was affirmed against", async () => {
    const { it, offers, method } = await run();
    const canon = await unitsSeam();
    const row = oneRow(
      rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId).filter((held) => String(field(held, "objectKey", "object_key")) === offers.a.register.objectKey),
      "the measured offer published exactly one quantity line",
    );

    const said = saidBy(field(row, "bindings", "bindings"));
    for (const variable of method.variables) {
      const reading = offers.a.bindings[variable.name] as MeasureShape;
      expect(said, `the line keeps ${variable.name}'s raw reading ${reading.value} as written (L-QTY-03: what the drawing said)`).toContain(reading.value);
      expect(said, `and the unit it was written in (${reading.unit})`).toContain(reading.unit);
      const carried = canon.convert(reading.value, reading.unit, canon.CANONICAL_UNIT[variable.dimension] as string);
      expect(
        said.some((spelling) => spelling.trim() !== "" && Number.isFinite(Number(spelling)) && canon.exact(spelling).eq(canon.exact(String(carried.value)))),
        `and its canonical value beside it — the line said ${JSON.stringify(said)}, the canon says ${String(carried.value)}`,
      ).toBe(true);
    }

    expect(
      saidBy(field(row, "calibrationKeys", "calibration_keys")),
      "the line carries the affirmed calibration references its readings stand on (L-QTY-03)",
    ).toContain(CALIBRATION);
  });

  test("AC-5: the interpreted offer is a queue item and never a line, and the observation is recorded", async () => {
    const { it, offers, observation } = await run();

    const lines = rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId);
    expect(
      lines.map((row) => String(field(row, "objectKey", "object_key"))),
      "interpreted geometry uncorroborated reaches no bill as a line (L-QTY-04)",
    ).not.toContain(offers.b.register.objectKey);
    expect(lines.length, "one offer of the batch published, and only one").toBe(1);

    const queued = oneRow(
      rowsOfCampaign(QUEUE_ITEMS_TABLE, it.tenantId, it.campaignId).filter((row) => String(field(row, "objectKey", "object_key")) === offers.b.register.objectKey),
      "the interpreted offer left exactly one queue item",
    );
    expect(String(field(queued, "cause", "cause")), "the queue item states the registered reason it was deferred for (L-QTY-04, riskNotes (3))").toBe(INTERPRETED_UNCORROBORATED);

    const recorded = oneRow(rowsOfCampaign(RAIL_OBSERVATIONS_TABLE, it.tenantId, it.campaignId), "the batch's one observation was recorded exactly once");
    expect(
      [String(field(recorded, "class", "class")), String(field(recorded, "kind", "kind")), String(field(recorded, "code", "code"))],
      "the observation is recorded as the rail reported it — class, kind and code (L-MEA-08)",
    ).toEqual([observation.class, observation.kind, observation.code]);
  });

  test("AC-5: a second identical call writes nothing further — the gate is idempotent on natural keys", async () => {
    const { it, verdict, offers, observation, countsAfterFirst } = await run();
    const gate = await gateSeam();

    const again = await gate.evaluateOffers(it.gateScope, { offers: [offers.a, offers.b, offers.c], observations: [observation] });
    expect(
      { published: again.published, queued: again.queued, refused: again.refused },
      "the same batch is judged the same way twice — a re-run reports what it found, it does not refuse it",
    ).toEqual({ published: verdict.published, queued: verdict.queued, refused: verdict.refused });
    expect(
      storeCounts(it.tenantId),
      "and nothing further was written: a line, an observation and a queue item are each keyed on the fact they record (goal)",
    ).toEqual(countsAfterFirst);
  });
});
