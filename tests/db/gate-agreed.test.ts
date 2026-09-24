/**
 * The gate's AGREED exit, live (L-QTY-04: "interpreted geometry uncorroborated → declared exclusion +
 * queue item, never a line"; s-takeoff I-685).
 *
 * A campaign staged through shipped seams defers one column read off a scan: the RASTER engine, the
 * trace it names, its outline and every reading INTERPRETED. What this suite proves is the whole way
 * out of that deferral, driven through the door the screen presses and the gate a measure run calls:
 *
 * - the deferral files each interpreted reading in the register's ledger beside its queue item;
 * - a person's reading that disagrees resolves nothing, and the re-run leaves the item queued;
 * - a person restating what the scan was read as, attribute by attribute, resolves the item in the
 *   act's own transaction — the Consequence names the exit — and the re-run publishes exactly one
 *   line, INTERPRETED, carrying the trace, binding the AGREED canonical values;
 * - who agreed it is derived from the resolution and its act, never stamped on the line;
 * - an interpreted offer naming no trace is refused by name, and over-measurement stays a hard block.
 *
 * Every expectation is read from the store (B-19); nothing here writes a table by hand.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CORROBORATE,
  ENTERED,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
  REGISTER_OBSERVATIONS_TABLE,
  actIdOf,
  actsOf,
  closeStage,
  corroboration,
  door,
  field,
  gateSeam,
  previewed,
  productModule,
  rowsOf,
  rowsOfCampaign,
  stageRegisterCampaign,
  subjectsOf,
  takeoffCaller,
  type StagedRegisterCampaign,
  type StoreRow,
} from "../takeoff/register-ui/support/register-ui-stage";
import { SCAN_TRACE } from "../support/raster-trace";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

/** The store an item's AGREED exit is written to, and the codes this suite asks for by name. */
const RESOLUTIONS_TABLE = "queue_item_resolutions";
const INTERPRETED = "INTERPRETED";
const INTERPRETED_UNCORROBORATED = "INTERPRETED_UNCORROBORATED";
const RASTER_IDENTITY_MISSING = "RASTER_IDENTITY_MISSING";
const OFFER_NOT_TO_CONTRACT = "OFFER_NOT_TO_CONTRACT";
const AGREED = "AGREED";

/** The register store's derived read of who agreed what (the per-line actor L-QTY-03 asks for). */
const REGISTER_STORE_MODULE = "src/core/register/store.ts";
const DB_SEAM_MODULE = "src/core/db.ts";
/** The register's reading and the export that is a pure function of it. */
const REGISTER_UI_MODULE = "src/modules/takeoff/register-ui/server.ts";
const REGISTER_JSON_MODULE = "src/modules/takeoff/export/register-json/index.ts";

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedRegisterCampaign> | undefined;
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("gate-agreed"));

/** One interpreted reading as the gate filed it on the item. */
type Filed = { attribute: string; value: string; unit: string; canonical: { value: string; unit: string } };

/** The staged campaign's lines, queue items and resolutions for one object. */
function storedFor(it: StagedRegisterCampaign, objectKey: string): { lines: StoreRow[]; queued: StoreRow[]; resolutions: StoreRow[] } {
  const of = (table: string): StoreRow[] => rowsOfCampaign(table, it.tenantId, it.campaignId).filter((row) => String(field(row, "objectKey", "object_key")) === objectKey);
  const queued = of(QUEUE_ITEMS_TABLE);
  const ids = new Set(queued.map((row) => String(field(row, "queueItemId", "queue_item_id"))));
  const resolutions = rowsOf(RESOLUTIONS_TABLE, it.tenantId).filter((row) => ids.has(String(field(row, "queueItemId", "queue_item_id"))));
  return { lines: of(QUANTITY_LINES_TABLE), queued, resolutions };
}

/** The readings the one queue item of the interpreted object names. */
function filedOn(it: StagedRegisterCampaign): Filed[] {
  const { queued } = storedFor(it, it.queuedObjectKey);
  expect(queued.length, `the interpreted object stands as one queue item: ${JSON.stringify(queued)}`).toBe(1);
  const detail = field(queued[0] as StoreRow, "detail", "detail") as { readings?: Filed[] };
  expect(Array.isArray(detail.readings), `the item names the readings the scan was read as: ${JSON.stringify(detail)}`).toBe(true);
  return detail.readings as Filed[];
}

/** The scan's own reading of one attribute of the interpreted object, as the ledger holds it. */
function scanReadingOf(it: StagedRegisterCampaign, attribute: string): StoreRow {
  const rows = rowsOf(REGISTER_OBSERVATIONS_TABLE, it.tenantId).filter(
    (row) =>
      String(field(row, "objectKey", "object_key")) === it.queuedObjectKey &&
      String(field(row, "attribute", "attribute")) === attribute &&
      String(field(row, "basis", "basis")) === INTERPRETED,
  );
  expect(rows.length, `the ledger holds the scan's reading of ${attribute} exactly once: ${JSON.stringify(rows)}`).toBe(1);
  return rows[0] as StoreRow;
}

/** Preview and commit one CORROBORATE through the takeoff lane; answers the Consequence's subjects and the act. */
async function corroborate(it: StagedRegisterCampaign, attribute: string, valueAsWritten: string, unitAsWritten: string, precedence: number) {
  const caller = await takeoffCaller(it.person);
  const input = corroboration({ projectId: it.projectId, objectKey: it.queuedObjectKey, attribute, valueAsWritten, unitAsWritten, precedence, sourceKey: it.sourceKeys[it.queuedObjectKey] as string });
  const shown = previewed(await door(caller, "previewCorroborate")({ input }), "takeoff.previewCorroborate");
  const committed = await door(caller, "commitCorroborate")({ input, consequenceDigest: shown.consequenceDigest });
  return { subjects: subjectsOf(shown.consequence), actId: actIdOf(committed, "takeoff.commitCorroborate") };
}

/** The measure run over the campaign: the same batch re-offered to the gate. */
async function remeasure(it: StagedRegisterCampaign, offers: readonly unknown[] = it.batch) {
  const gate = await gateSeam();
  return gate.evaluateOffers(it.gateScope, { offers: offers as Parameters<typeof gate.evaluateOffers>[1]["offers"], observations: [] });
}

/** The staged batch's interpreted offer — the last one, as the stage hands it to the gate. */
function interpretedOf(it: StagedRegisterCampaign): Record<string, unknown> {
  const offer = it.batch[it.batch.length - 1] as unknown as Record<string, unknown>;
  expect((offer["register"] as { objectKey: string }).objectKey, "the batch's last offer is the interpreted object's").toBe(it.queuedObjectKey);
  return offer;
}

describe("L-QTY-04's AGREED exit, live (s-takeoff I-685)", () => {
  test("an INTERPRETED offer queues, and its readings are filed in the register's ledger at basis INTERPRETED", async () => {
    const it = await staged();
    const held = storedFor(it, it.queuedObjectKey);
    expect(held.lines.length, "the interpreted outline is never a line while nobody has agreed it").toBe(0);
    expect(String(field(held.queued[0] as StoreRow, "cause", "cause"))).toBe(INTERPRETED_UNCORROBORATED);
    expect(held.resolutions.length, "and nothing has resolved it").toBe(0);

    const filed = filedOn(it);
    expect(filed.length, "every determining reading the scan was read for is named").toBeGreaterThan(0);
    for (const reading of filed) {
      const row = scanReadingOf(it, reading.attribute);
      expect(field(row, "actId", "act_id"), "the scan's own reading is nobody's act (L-ACT-01)").toBeNull();
      expect(String(field(row, "canonicalValue", "canonical_value")), `${reading.attribute} is filed at the canon's figure`).toBe(reading.canonical.value);
    }
    expect((field(held.queued[0] as StoreRow, "detail", "detail") as { raster?: unknown }).raster, "and the item names the trace").toEqual(SCAN_TRACE);

    // The register shows the scan's readings, and does not call them agreed: nobody has spoken yet.
    const reader = await productModule<{ registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>> }>(REGISTER_UI_MODULE);
    const view = await reader.registerViewOf({ tenantId: it.tenantId, projectId: it.projectId });
    const object = (view["objects"] as { objectKey: string; corroboration: string; attributes: { attribute: string }[] }[]).find((held) => held.objectKey === it.queuedObjectKey);
    expect(object?.attributes.map((attribute) => attribute.attribute).sort(), "every filed reading is an attribute on the register").toEqual(filed.map((reading) => reading.attribute).sort());
    expect(object?.corroboration, "and a scan's reading alone agrees nothing").not.toBe(AGREED);

    const again = await remeasure(it);
    expect(again.queued, "a re-run of the same batch defers it again").toBe(1);
    for (const reading of filed) scanReadingOf(it, reading.attribute);
  }, BUDGET_MS);

  test("a reading that disagrees resolves nothing, and the re-run leaves the item queued", async () => {
    const it = await staged();
    const [first] = filedOn(it);
    const scan = scanReadingOf(it, (first as Filed).attribute);
    const other = `${String(field(scan, "valueAsWritten", "value_as_written"))}1`;

    const disagreed = await corroborate(it, (first as Filed).attribute, other, String(field(scan, "unitAsWritten", "unit_as_written")), 0);
    expect(disagreed.subjects.length, "the Consequence names the reading and no exit").toBe(1);

    const verdict = await remeasure(it);
    expect(verdict.queued, `the interpreted offer is deferred again: ${JSON.stringify(verdict)}`).toBe(1);
    const held = storedFor(it, it.queuedObjectKey);
    expect(held.lines.length, "no line").toBe(0);
    expect(held.resolutions.length, "and no resolution").toBe(0);
  }, BUDGET_MS);

  test("a person restating every reading resolves the item in the act's own transaction, and the re-run publishes exactly one line with the trace", async () => {
    const it = await staged();
    const filed = filedOn(it);
    let resolvingAct: string | null = null;
    for (const [at, reading] of filed.entries()) {
      const scan = scanReadingOf(it, reading.attribute);
      // Above the disagreement the previous case left standing: a restatement at a higher precedence.
      const agreed = await corroborate(it, reading.attribute, String(field(scan, "valueAsWritten", "value_as_written")), String(field(scan, "unitAsWritten", "unit_as_written")), 1);
      const exits = agreed.subjects.filter((subject) => subject.after.includes(AGREED) && subject.subjectId !== it.queuedObjectKey);
      if (at < filed.length - 1) {
        expect(exits.length, `agreeing ${reading.attribute} while another reading waits resolves nothing yet`).toBe(0);
        expect(storedFor(it, it.queuedObjectKey).resolutions.length).toBe(0);
      } else {
        expect(exits.length, "the last agreement's Consequence names the item's AGREED exit").toBe(1);
        expect(exits[0]?.before, "from the cause it was deferred for").toEqual([INTERPRETED_UNCORROBORATED]);
        resolvingAct = agreed.actId;
      }
    }

    const resolved = storedFor(it, it.queuedObjectKey).resolutions;
    expect(resolved.length, "one resolution row").toBe(1);
    expect(String(field(resolved[0] as StoreRow, "actId", "act_id")), "written by the act that agreed the last reading (L-ACT-01)").toBe(resolvingAct);
    expect(actsOf(it.tenantId, CORROBORATE).some((act) => String(field(act, "actId", "act_id")) === resolvingAct)).toBe(true);

    const verdict = await remeasure(it);
    expect(JSON.stringify(verdict.refusals ?? []), "the re-run refuses nothing").toBe("[]");
    const held = storedFor(it, it.queuedObjectKey);
    expect(held.lines.length, "exactly one line for the interpreted object").toBe(1);
    const line = held.lines[0] as StoreRow;
    expect(String(field(line, "quantityBasis", "quantity_basis")), "INTERPRETED, never relabelled MEASURED (L-QTY-01)").toBe(INTERPRETED);
    expect(field(line, "raster", "raster"), "carrying the trace it was read off (L-QTY-03)").toEqual(SCAN_TRACE);
    expect(String(field(line, "engine", "engine"))).toBe("RASTER");
    expect(Object.keys(line), "who agreed it is derived, never stamped on the line (L-QTY-03)").not.toContain("agreed_by");
    const bound = field(line, "bindings", "bindings") as Record<string, { canonical: { value: string; unit: string } }>;
    for (const reading of filed) expect(bound[reading.attribute]?.canonical, `${reading.attribute} binds the AGREED canonical value`).toEqual(reading.canonical);
    expect(held.queued.length, "the deferral stays on record beside the line").toBe(1);

    const again = await remeasure(it);
    expect(JSON.stringify(again.refusals ?? []), "a second re-run is the natural key's re-run").toBe("[]");
    expect(storedFor(it, it.queuedObjectKey).lines.length, "and writes nothing more").toBe(1);
  }, BUDGET_MS);

  test("who agreed it is read off the resolution and its act", async () => {
    const it = await staged();
    const store = await productModule<{
      agreementsOfCampaignIn: (tx: unknown, tenantId: string, campaignId: string) => Promise<{ objectKey: string; actId: string; actorId: string }[]>;
    }>(REGISTER_STORE_MODULE);
    const db = await productModule<{ forTenant: (scope: { tenantId: string }) => { transaction: <T>(work: (tx: unknown) => Promise<T>) => Promise<T> } }>(DB_SEAM_MODULE);
    const agreements = await db.forTenant({ tenantId: it.tenantId }).transaction((tx) => store.agreementsOfCampaignIn(tx, it.tenantId, it.campaignId));
    const mine = agreements.filter((agreement) => agreement.objectKey === it.queuedObjectKey);
    expect(mine.length, `one agreement for the interpreted object: ${JSON.stringify(agreements)}`).toBe(1);
    const act = actsOf(it.tenantId, CORROBORATE).find((row) => String(field(row, "actId", "act_id")) === mine[0]?.actId);
    expect(act, "the act the resolution names stands in the log").toBeTruthy();
    expect(mine[0]?.actorId, "and its actor is who agreed the line").toBe(String(field(act as StoreRow, "actorId", "actor_id")));
    const readings = rowsOf(REGISTER_OBSERVATIONS_TABLE, it.tenantId).filter((row) => String(field(row, "actId", "act_id")) === mine[0]?.actId);
    expect(readings.map((row) => String(field(row, "basis", "basis"))), "the act appended the person's ENTERED restatement").toEqual([ENTERED]);
  }, BUDGET_MS);

  test("the register's reading and its JSON export carry the line's trace and who agreed it, and list the deferral no longer", async () => {
    const it = await staged();
    const reader = await productModule<{ registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>> }>(REGISTER_UI_MODULE);
    const json = await productModule<{ registerJsonOf: (view: unknown) => Record<string, unknown> }>(REGISTER_JSON_MODULE);
    const view = await reader.registerViewOf({ tenantId: it.tenantId, projectId: it.projectId });
    const lines = (view["lines"] as { objectKey: string; raster: unknown; agreedBy: { actId: string; actorId: string } | null }[]).filter((line) => line.objectKey === it.queuedObjectKey);
    expect(lines.length, "the agreed line is on the register").toBe(1);
    expect(lines[0]?.raster, "with its trace").toEqual(SCAN_TRACE);
    const resolution = storedFor(it, it.queuedObjectKey).resolutions[0] as StoreRow;
    expect(lines[0]?.agreedBy?.actId, "and the act that agreed it").toBe(String(field(resolution, "actId", "act_id")));
    const refusals = view["refusals"] as { code: string; objectKey: string }[];
    expect(
      refusals.filter((refusal) => refusal.objectKey === it.queuedObjectKey && refusal.code === INTERPRETED_UNCORROBORATED),
      "a deferral whose AGREED line published is the line now, not a sighting that produced none",
    ).toEqual([]);
    const exported = (json.registerJsonOf(view)["lines"] as { objectKey: string; raster: unknown; agreedBy: unknown }[]).find((line) => line.objectKey === it.queuedObjectKey);
    expect([exported?.raster, exported?.agreedBy], "the JSON export carries both").toEqual([lines[0]?.raster, lines[0]?.agreedBy]);
  }, BUDGET_MS);

  test("an interpreted offer naming no trace is refused by name, never a CHECK abort", async () => {
    const it = await staged();
    const { raster: dropped, ...untraced } = interpretedOf(it);
    void dropped;
    const before = storedFor(it, it.queuedObjectKey);
    const verdict = await remeasure(it, [untraced]);
    expect(verdict.refusals.map((refusal) => refusal.code), `the gate answers by name: ${JSON.stringify(verdict)}`).toEqual([RASTER_IDENTITY_MISSING]);
    const after = storedFor(it, it.queuedObjectKey);
    expect([after.lines.length, after.queued.length], "and writes nothing").toEqual([before.lines.length, before.queued.length]);
  }, BUDGET_MS);

  test("over-measurement stays a hard block: the agreed object offered twice in a batch, or again under another claim", async () => {
    const it = await staged();
    const offer = interpretedOf(it);
    const twice = await remeasure(it, [offer, offer]);
    expect(
      twice.refusals.map((refusal) => refusal.code),
      `two offers for one object and kind are both refused: ${JSON.stringify(twice)}`,
    ).toEqual([OFFER_NOT_TO_CONTRACT, OFFER_NOT_TO_CONTRACT]);

    const measured = it.batch[0] as unknown as Record<string, unknown>;
    const elsewhere = { ...measured, register: offer["register"] };
    const collided = await remeasure(it, [elsewhere]);
    expect(collided.refusals.map((refusal) => refusal.code), "a second claim over the agreed line's key is refused").toEqual([OFFER_NOT_TO_CONTRACT]);
    expect(storedFor(it, it.queuedObjectKey).lines.length, "and the one line stands alone").toBe(1);
  }, BUDGET_MS);
});
