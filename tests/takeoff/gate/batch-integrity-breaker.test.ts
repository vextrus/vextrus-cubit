/**
 * BREAKER — what one batch may leave behind in the four stores (SEAM-GATE, L-QTY-03, L-QTY-04).
 *
 * The gate is the sole writer of `quantity_lines`, `rail_observations` and `queue_items`, and its
 * promise is total: every offer lands on exactly one of three arms, "a refusal is RETURNED with the
 * registered code it answers with, never thrown", and "one bad offer never costs the others their
 * answer" (goal, src/core/gate/evaluate.ts's own opening). A rail hands the gate DATA — `Measure`
 * carries `value` as free text and the contract says so ("the value stays as written") — so the gate
 * is the boundary that judges it, exactly as it already judges `unit` through `isUnit` and `class`
 * through `isElementType` even though the type says `ElementType`.
 *
 * Every case here is driven through the shipped seam over a real campaign staged by the shared
 * stage. Nothing here re-implements a judgement: what a reading is worth is asked of the canon, and
 * what a store holds is read out of the store.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  INTERPRETED,
  MEMBER_VOLUME,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
  bears,
  bindingsIn,
  closeStage,
  field,
  gateSeam,
  methodsRegistry,
  offer,
  offersContract,
  rowsOfCampaign,
  saidBy,
  stageCampaign,
  type OfferShape,
  type RailObservationShape,
  type StagedCampaign,
  type VerdictShape,
} from "./support/gate-stage";

/** The unit every reading below is written in — one the canon maps, so no case turns on the unit. */
const READ_IN = "ft";

/** The calibration reference a well-formed reading stands on (L-QTY-03). */
const CALIBRATION = "CAL:S-101:grid-A";

/** Three readings that publish cleanly — the control every case is a single change away from. */
const SOUND: Readonly<Record<string, string>> = { b: "1.5", d: "2.5", L: "10" };

/** How many register objects the cases below need keys for, one per offer they make. */
const OBJECTS = 12;

let staged: Promise<StagedCampaign> | undefined;
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("breaker", { objects: OBJECTS }));

afterAll(async () => {
  await closeStage();
});

/** What every offer of this file shares: the campaign's revision, and a kind the method measures. */
type Common = { setRevisionId: string; kind: string; class: string; geometryType: string };

let shared: Promise<Common> | undefined;
const common = (): Promise<Common> =>
  (shared ??= (async () => {
    const it = await campaign();
    const contract = await offersContract();
    const catalogue = await bears();
    const registry = await methodsRegistry();
    const implementation = registry.implementationOf(MEMBER_VOLUME);
    expect(implementation, "the registry maps the one method this leaf lands — every case below is measured by it").toBeTruthy();
    const kind = String((implementation as { kind: string }).kind);
    const row = catalogue.rows.find((entry) => entry.kind === kind);
    expect(row, `the catalogue bears the kind ${kind} the method measures — an offer names a (class, kind) the catalogue holds`).toBeTruthy();
    const bearsRow = row as { class: string; kind: string };
    return { setRevisionId: it.setRevisionId, kind: bearsRow.kind, class: bearsRow.class, geometryType: String(contract.GEOMETRY_TYPES[0]) };
  })());

/** One offer over the n-th staged register object, sound unless a case says otherwise. */
async function offerOver(at: number, draft: Partial<Parameters<typeof offer>[0]> = {}): Promise<OfferShape> {
  const it = await campaign();
  const base = await common();
  return offer({
    ...base,
    objectKey: String(it.objectKeys[at]),
    bindings: bindingsIn(READ_IN, SOUND, CALIBRATION),
    calibration: CALIBRATION,
    ...draft,
  });
}

/** Drive the gate and answer what it did — a throw is caught, because a throw is itself the finding. */
async function judge(offers: readonly OfferShape[], observations: readonly RailObservationShape[] = []): Promise<{ verdict: VerdictShape | null; thrown: unknown }> {
  const it = await campaign();
  const gate = await gateSeam();
  try {
    return { verdict: (await gate.evaluateOffers(it.gateScope, { offers, observations })) as VerdictShape, thrown: null };
  } catch (error) {
    return { verdict: null, thrown: error };
  }
}

/** How a thrown fault reads, for the message a failing case prints. */
function saidOf(thrown: unknown): string {
  return thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
}

/** The quantity lines one object of the campaign holds. */
async function linesFor(objectKey: string): Promise<Record<string, unknown>[]> {
  const it = await campaign();
  return rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId).filter((row) => String(field(row, "objectKey", "object_key")) === objectKey);
}

/** The queue items one object of the campaign holds. */
async function queuedFor(objectKey: string): Promise<Record<string, unknown>[]> {
  const it = await campaign();
  return rowsOfCampaign(QUEUE_ITEMS_TABLE, it.tenantId, it.campaignId).filter((row) => String(field(row, "objectKey", "object_key")) === objectKey);
}

describe("BREAKER: a reading the gate cannot admit", () => {
  test("a binding that is not a number at all is answered, not thrown — and the sound offer beside it still lands", async () => {
    const spoilt = await offerOver(0, { bindings: bindingsIn(READ_IN, { ...SOUND, L: "not-a-number" }, CALIBRATION) });
    const sound = await offerOver(1);

    const { verdict, thrown } = await judge([spoilt, sound]);
    expect(
      thrown,
      `a rail's reading is DATA, and data that does not hold is an answer about the data rather than a fault of the machine — the gate threw instead: ${saidOf(thrown)} (goal: "refusals returned never thrown", ARCH-03)`,
    ).toBeNull();

    const answer = verdict as VerdictShape;
    expect(answer.published + answer.queued + answer.refused, "the three arms still sum to the offers handed in (goal)").toBe(2);
    expect(answer.refusals.map((one) => one.objectKey), "the unreadable offer is refused by name — an inadmissible reading is a hard block (L-QTY-04)").toContain(spoilt.register.objectKey);
    expect((await linesFor(sound.register.objectKey)).length, "and one bad offer never costs the others their answer: the sound offer beside it published (goal)").toBe(1);
    expect((await linesFor(spoilt.register.objectKey)).length, "nothing publishes for the offer whose reading could not be read (L-QTY-04)").toBe(0);
  });

  test("a reading of `NaN` or `Infinity` never becomes a published quantity", async () => {
    const notANumber = await offerOver(2, { bindings: bindingsIn(READ_IN, { ...SOUND, L: "NaN" }, CALIBRATION) });
    const unbounded = await offerOver(3, { bindings: bindingsIn(READ_IN, { ...SOUND, L: "Infinity" }, CALIBRATION) });

    const { verdict, thrown } = await judge([notANumber, unbounded]);
    expect(thrown, `the gate answers this batch rather than failing on it: ${saidOf(thrown)}`).toBeNull();

    for (const one of [notANumber, unbounded]) {
      const written = await linesFor(one.register.objectKey);
      const values = written.map((row) => String(field(row, "value", "value")));
      expect(
        values.filter((value) => !Number.isFinite(Number(value))),
        `a line states "the SI value at full precision (numeric)" — a quantity that is not a finite number is an inadmissible reading and hard-blocks, it does not publish: the store holds ${JSON.stringify(values)} (L-QTY-03, L-QTY-04)`,
      ).toEqual([]);
    }

    const answer = verdict as VerdictShape;
    expect(answer.published + answer.queued + answer.refused, "and every offer still landed on exactly one arm (goal)").toBe(2);
  });
});

describe("BREAKER: two offers over one object", () => {
  test("an object is never both a published line and a declared exclusion", async () => {
    const it = await campaign();
    const objectKey = String(it.objectKeys[4]);
    const measured = await offerOver(4);
    const interpreted = await offerOver(4, { basis: INTERPRETED });

    const { thrown } = await judge([measured, interpreted]);
    expect(thrown, `the gate answers this batch rather than failing on it: ${saidOf(thrown)}`).toBeNull();

    const lines = await linesFor(objectKey);
    const queued = await queuedFor(objectKey);
    expect(
      { lines: lines.length, queued: queued.length },
      "interpreted geometry uncorroborated is a declared exclusion + queue item and NEVER a line — one object of one kind cannot stand in both stores at once (L-QTY-04, and the schema's own \"the two tables cannot both hold it\")",
    ).not.toEqual({ lines: 1, queued: 1 });
  });

  test("an offer counted published left a line behind — a second reading of the same object is never silently swallowed", async () => {
    const it = await campaign();
    const objectKey = String(it.objectKeys[5]);
    const first = await offerOver(5);
    const second = await offerOver(5, { bindings: bindingsIn(READ_IN, { ...SOUND, L: "99" }, CALIBRATION) });

    const { verdict, thrown } = await judge([first, second]);
    expect(thrown, `the gate answers this batch rather than failing on it: ${saidOf(thrown)}`).toBeNull();

    const answer = verdict as VerdictShape;
    const lines = await linesFor(objectKey);
    expect(
      answer.published,
      `two readings of one object under one kind are an over-measurement — a hard block, never a silent default: the verdict claimed ${answer.published} published and the store holds ${lines.length} line(s) for ${objectKey}, so a measurement vanished with no refusal and no queue item (L-QTY-04)`,
    ).toBeLessThanOrEqual(lines.length);
  });
});

describe("BREAKER: what a published line must carry", () => {
  test("a measured offer affirming no calibration reference does not publish", async () => {
    const it = await campaign();
    const objectKey = String(it.objectKeys[6]);
    const bare = await offerOver(6, { bindings: bindingsIn(READ_IN, SOUND), calibration: undefined });

    const { thrown } = await judge([bare]);
    expect(thrown, `the gate answers this offer rather than failing on it: ${saidOf(thrown)}`).toBeNull();

    for (const row of await linesFor(objectKey)) {
      expect(
        saidBy(field(row, "calibrationKeys", "calibration_keys")).length,
        "a line always carries \"a non-empty set of affirmed calibration references (per measured attribute)\"; a mandatory publishable attribute that is missing is a hard block and nothing publishes (L-QTY-03, L-QTY-04)",
      ).toBeGreaterThan(0);
    }
  });
});

describe("BREAKER: provenance to a register row", () => {
  test("an offer over an object key no register row of the campaign's revision holds does not publish", async () => {
    const it = await campaign();
    const base = await common();
    const ghost = "v:PLAN:GHOST|X9|0.0,0.0@nowhere";
    expect(it.objectKeys, "the key this case offers is one the register never registered on this revision").not.toContain(ghost);

    const fabricated = offer({ ...base, objectKey: ghost, bindings: bindingsIn(READ_IN, SOUND, CALIBRATION), calibration: CALIBRATION });
    const { thrown } = await judge([fabricated]);
    expect(thrown, `the gate answers this offer rather than failing on it: ${saidOf(thrown)}`).toBeNull();

    expect(
      (await linesFor(ghost)).length,
      "a line always carries \"provenance to a register row as a reference\"; where the gate cannot establish that an object belongs to the class and drawing it measures under it severs the object from bill reach, rather than publishing a quantity for an object nothing registered (L-QTY-03, L-QTY-04)",
    ).toBe(0);
  });
});

describe("BREAKER: an observation the closed rosters do not admit", () => {
  test("a malformed observation is answered, and does not cost the batch's sound offers their lines", async () => {
    const sound = await offerOver(7);
    const observation: RailObservationShape = { class: "not-an-element-type", kind: (await common()).kind, code: "SOMETHING_SEEN" };

    const { thrown } = await judge([sound], [observation]);
    expect(
      thrown,
      `the gate judges an offer's class through the catalogue's own roster before writing it; an observation is the same rail's data and is written unjudged, so the store's CHECK fails the whole transaction: ${saidOf(thrown)} (goal: one bad offer never costs the others their answer)`,
    ).toBeNull();
    expect((await linesFor(sound.register.objectKey)).length, "and the sound offer of the same batch still published its line (goal)").toBe(1);
  });
});
