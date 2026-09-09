/**
 * BREAKER — what the gate writes when two runs meet, and what it admits into a line
 * (SEAM-GATE, L-QTY-03, L-QTY-04).
 *
 * The gate's cross-batch guards are all READ-then-WRITE inside one transaction: it reads what the
 * campaign's stores already hold for the batch's objects, judges against that reading, and then
 * inserts `onConflictDoNothing`. Nothing serialises two runs of one campaign against each other, so
 * every guard the file states in prose — "an object is a published line or a declared exclusion,
 * never both", "a DIFFERENT reading of the same object is seen for what it is rather than
 * disappearing into the natural key" — holds only while one run is alone. Two runs of one campaign
 * are ordinary: the measure key deduplicates a request only while one still stands queued, so a
 * second ask after a worker has taken the first runs beside it.
 *
 * Beside the races, two readings the gate carries into a line without judging them: a `basis` no
 * closed roster admits, and a negative length.
 *
 * Every case drives the shipped door (`evaluateOffers`) over a campaign staged through the product's
 * own seams, and reads the four stores back. Nothing here restates an acceptance criterion: these
 * are the answers the criteria do not reach.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  INTERPRETED,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
  bears,
  bindingsIn,
  closeStage,
  field,
  gateSeam,
  measure,
  offer,
  offersContract,
  rowsOfCampaign,
  saidBy,
  stageCampaign,
  type OfferShape,
  type StagedCampaign,
  type VerdictShape,
} from "./support/gate-stage";

/** The calibration reference a sound offer's readings stand on (L-QTY-03). */
const CALIBRATION = "CAL:S-101:grid-A";

/** The reference a SECOND run of the same object affirms instead — another scale bar, same object. */
const RECALIBRATED = "CAL:S-101:grid-B";

/** The readings a sound offer binds, in the canon's own unit so the arithmetic is not the subject. */
const SOUND: Readonly<Record<string, string>> = { b: "1", d: "2", L: "3" };

/** How many objects each race is run over: one race per object, so no round pollutes the next. */
const ROUNDS = 6;

/** The objects the two races and the three single-offer cases need, each registered once. */
const OBJECTS = ROUNDS * 2 + 3;

let staged: Promise<StagedCampaign> | undefined;
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("integrity-breaker", { objects: OBJECTS }));

afterAll(async () => {
  await closeStage();
});

/** The class, kind and geometry type an offer of this catalogue carries — never spelled here (B-19). */
let shape: { kind: string; class: string; geometryType: string } | undefined;
async function common(): Promise<{ kind: string; class: string; geometryType: string }> {
  if (shape === undefined) {
    const row = (await bears()).rows[0] as { class: string; kind: string };
    const contract = await offersContract();
    shape = { kind: row.kind, class: row.class, geometryType: String(contract.GEOMETRY_TYPES[0]) };
  }
  return shape;
}

/** One offer over the campaign's own register object, sound unless a case says otherwise. */
async function offerOver(
  it: StagedCampaign,
  at: number,
  options: { basis?: string; calibration?: string; readings?: Readonly<Record<string, string>>; bindings?: Record<string, ReturnType<typeof measure>> } = {},
): Promise<OfferShape> {
  const held = await common();
  const calibration = options.calibration ?? CALIBRATION;
  return offer({
    objectKey: String(it.objectKeys[at]),
    setRevisionId: it.setRevisionId,
    ...held,
    calibration,
    ...(options.basis === undefined ? {} : { basis: options.basis }),
    bindings: options.bindings ?? bindingsIn("m", options.readings ?? SOUND, calibration),
  });
}

/** The lines and the queue items one object of the campaign stands under right now. */
function storedFor(it: StagedCampaign, objectKey: string): { lines: Record<string, unknown>[]; queued: Record<string, unknown>[] } {
  const of = (table: string): Record<string, unknown>[] =>
    rowsOfCampaign(table, it.tenantId, it.campaignId).filter((row) => String(field(row, "objectKey", "object_key")) === objectKey);
  return { lines: of(QUANTITY_LINES_TABLE), queued: of(QUEUE_ITEMS_TABLE) };
}

describe("BREAKER: two runs of one campaign meeting on one object", () => {
  test("an object never stands as a published line AND a declared exclusion, however the two runs interleave", async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const both: string[] = [];

    for (let round = 0; round < ROUNDS; round += 1) {
      const objectKey = String(it.objectKeys[round]);
      const measured = await offerOver(it, round);
      const interpreted = await offerOver(it, round, { basis: INTERPRETED });
      await Promise.all([
        gate.evaluateOffers(it.gateScope, { offers: [measured], observations: [] }),
        gate.evaluateOffers(it.gateScope, { offers: [interpreted], observations: [] }),
      ]);
      const held = storedFor(it, objectKey);
      if (held.lines.length > 0 && held.queued.length > 0) both.push(`${objectKey}: ${held.lines.length} line(s) and ${held.queued.length} queue item(s)`);
    }

    expect(
      both,
      "interpreted geometry uncorroborated is a declared exclusion + queue item and NEVER a line (L-QTY-04): an object of one kind cannot stand in both stores at once, and two runs of one campaign are ordinary — the measure key deduplicates an ask only while one still stands queued",
    ).toEqual([]);
  });

  test("two runs reading one object differently never both count a line published — one of the two measurements would have vanished", async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const lost: string[] = [];

    for (let round = 0; round < ROUNDS; round += 1) {
      const at = ROUNDS + round;
      const objectKey = String(it.objectKeys[at]);
      const three = await offerOver(it, at, { readings: SOUND });
      const four = await offerOver(it, at, { readings: { ...SOUND, L: "4" } });
      const [first, second] = await Promise.all([
        gate.evaluateOffers(it.gateScope, { offers: [three], observations: [] }),
        gate.evaluateOffers(it.gateScope, { offers: [four], observations: [] }),
      ]);
      const counted = (first as VerdictShape).published + (second as VerdictShape).published;
      const held = storedFor(it, objectKey);
      if (counted > held.lines.length) {
        lost.push(`${objectKey}: the two verdicts counted ${counted} published and the store holds ${held.lines.length} line(s) (values ${JSON.stringify(held.lines.map((row) => String(field(row, "value", "value"))))})`);
      }
    }

    expect(
      lost,
      "two readings of one object under one kind are an over-measurement — a hard block, never a silent default (L-QTY-04): a run told its line published whose line the store does not hold has had a measurement vanish with no refusal and no queue item",
    ).toEqual([]);
  });
});

describe("BREAKER: what the standing line says it was affirmed against", () => {
  test("a second run affirming another calibration reference is not answered with the first run's line", async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const at = ROUNDS * 2;
    const objectKey = String(it.objectKeys[at]);

    const first = (await gate.evaluateOffers(it.gateScope, { offers: [await offerOver(it, at)], observations: [] })) as VerdictShape;
    expect(first.published, `the first run published the object's line: ${JSON.stringify(first)}`).toBe(1);

    const again = await offerOver(it, at, { calibration: RECALIBRATED });
    const second = (await gate.evaluateOffers(it.gateScope, { offers: [again], observations: [] })) as VerdictShape;

    // Either the second reading is answered — it is another statement about one object under one
    // kind — or the store says what that run affirmed. What it may not be is counted published
    // against a line affirming a reference this run never stood on.
    if (second.published > 0) {
      const held = storedFor(it, objectKey);
      const affirmed = held.lines.flatMap((row) => saidBy(field(row, "calibrationKeys", "calibration_keys")));
      expect(
        affirmed,
        `a line always carries "a non-empty set of affirmed calibration references (per measured attribute)" and the set is the offer's own (L-QTY-03): this run affirmed ${RECALIBRATED} and was counted published, while the store holds ${JSON.stringify(affirmed)} — the affirmation it was counted for is not the one recorded`,
      ).toContain(RECALIBRATED);
    }
  });
});

describe("BREAKER: readings the gate carries into a line without judging them", () => {
  test("a reading whose basis no closed roster admits never reaches a line", async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const contract = await offersContract();
    const at = ROUNDS * 2 + 1;
    const objectKey = String(it.objectKeys[at]);
    const unknownBasis = "GUESSED";
    expect(contract.QUANTITY_BASES, "the case's basis is one the contract's roster really excludes").not.toContain(unknownBasis);

    const bindings = {
      b: measure(SOUND["b"] as string, "m", { basis: unknownBasis, calibration: CALIBRATION }),
      d: measure(SOUND["d"] as string, "m", { basis: String(contract.QUANTITY_BASES[0]), calibration: CALIBRATION }),
      L: measure(SOUND["L"] as string, "m", { basis: String(contract.QUANTITY_BASES[0]), calibration: CALIBRATION }),
    };
    const verdict = (await gate.evaluateOffers(it.gateScope, { offers: [await offerOver(it, at, { bindings })], observations: [] })) as VerdictShape;
    expect(verdict.published + verdict.queued + verdict.refused, "the gate answered the offer on exactly one arm").toBe(1);

    const said = storedFor(it, objectKey).lines.flatMap((row) => saidBy(field(row, "bindings", "bindings")));
    expect(
      said,
      `quantity basis is a closed roster (${JSON.stringify(contract.QUANTITY_BASES)}), and a reading spelling a basis outside it is the rail and the gate disagreeing about what an offer IS — one code, OFFER_NOT_TO_CONTRACT (riskNotes (4)). The store recorded the reading verbatim instead: ${JSON.stringify(said)}`,
    ).not.toContain(unknownBasis);
  });

  test("a negative reading never publishes a negative quantity", async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const at = ROUNDS * 2 + 2;
    const objectKey = String(it.objectKeys[at]);

    const verdict = (await gate.evaluateOffers(it.gateScope, { offers: [await offerOver(it, at, { readings: { ...SOUND, b: "-1" } })], observations: [] })) as VerdictShape;
    expect(verdict.published + verdict.queued + verdict.refused, "the gate answered the offer on exactly one arm").toBe(1);

    const values = storedFor(it, objectKey).lines.map((row) => Number(field(row, "value", "value")));
    expect(
      values.filter((value) => value < 0),
      'a breadth of -1 m is an inadmissible reading and an inadmissible reading is a hard block (L-QTY-04); a published line carrying a negative quantity is the one thing the clause forecloses outright — "a disclosure lets a reader add; nothing lets a reader subtract"',
    ).toEqual([]);
  });
});
