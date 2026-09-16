/**
 * AC-4 — the SITE-fact ledger: entered, append-only, read through one door (L-MEA-06, L-QTY-04,
 * AM-06 §1, Q-07).
 *
 * A SITE fact is a fact no drawing carries, so it is ENTERED and never derived: the ledger holds the
 * value and the unit AS WRITTEN beside the canonical metres the canon carries them to, the note that
 * says where it came from, and the act that entered it. This grades that through the product's own
 * doors — `siteFactWrite` makes a write, `writeSiteFact` appends it, `siteFactsOf` reads it — and
 * never off the table.
 *
 * The table's own belts (RLS, the grants and the append-only triggers) are graded by the migration
 * suite beside this one, tests/takeoff/site-facts/site-facts-migration.test.ts; what is graded here
 * is the LEDGER's behaviour:
 * latest-wins per fact, an absent fact as an absent key, and the three refusals a malformed entry
 * earns by name.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BLINDING_PROJECTION,
  BLINDING_THICKNESS,
  DEPTH_EXTRA,
  GROUND_LEVEL,
  MILLIMETRE,
  SCHEMA_FOUNDATIONS_MODULE,
  SITE_FACTS_TABLE,
  SITE_FACT_SOURCE_UNSTATED,
  SITE_FACT_UNKNOWN,
  TRANSPORT_VOCABULARY_MODULE,
  UNIT_UNMAPPED,
  WATER_TABLE,
  WORKING_ALLOWANCE,
  canon,
  closeStage,
  enterSiteFact,
  inTenantTx,
  productModule,
  refusalCodeOf,
  said,
  siteFactsDoor,
  siteFactsLaw,
  siteFactsStore,
  stageFoundationsCampaign,
  type FoundationsStage,
  type StandingSiteFactShape,
} from "../rails/foundations/support/foundations-stage";

/** The two readings of the same fact this criterion enters, oldest first (L-MEA-06). */
const FIRST_GROUND_LEVEL = { value: "-150", unit: MILLIMETRE, note: "S-01 general notes, first transcription" };
const SECOND_GROUND_LEVEL = { value: "-152.4", unit: MILLIMETRE, note: "S-04 pile layout: EGL restated at the pile cut-off" };

/** A unit the canon carries no LENGTH factor for — a site fact is a length, and nothing else is one. */
const NOT_A_LENGTH = "kg";

let stage: FoundationsStage;
let scope: { tenantId: string; projectId: string };

let staging: Promise<void> | undefined;

/**
 * The staged project, opened once and awaited by every case.
 *
 * Lazy rather than a hook on purpose: a module the Builder has not written yet must fail the CASE
 * that needed it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    stage = await stageFoundationsCampaign("site-facts", []);
    scope = { tenantId: stage.tenantId, projectId: stage.projectId };
  })());

afterAll(async () => {
  await closeStage();
});

describe("AC-4: the SITE-fact ledger is entered, appended and read at one door", () => {
  test("AC-4: a write carries the value and the unit as written, beside the metres the canon makes of them", async () => {
    await staged();
    const [law, { convert, exact, factorOf }] = await Promise.all([siteFactsLaw(), canon()]);
    const write = law.siteFactWrite({
      fact: WORKING_ALLOWANCE,
      valueAsWritten: "457.2",
      unitAsWritten: MILLIMETRE,
      sourceNote: "S-01 general notes: working space to each face",
    });
    expect(write.valueAsWritten, "the value stands as it was written (L-QTY-03: the raw reading beside the SI value)").toBe("457.2");
    expect(write.unitAsWritten, "and the unit with it").toBe(MILLIMETRE);
    const carried = convert("457.2", MILLIMETRE, "m");
    expect(carried.ok, "the canon carries a millimetre to metres").toBe(true);
    expect(write.canonicalMetres, "and the write carries that very figure, from the one canon (B-17)").toBe(carried.value);
    expect(
      write.factor,
      `the factor recorded beside it is the CANON's own for ${MILLIMETRE} — what a unit is worth is stated in one place, and a write that records anything else has carried the reading by something nobody can read back (B-17)`,
    ).toBe(factorOf(MILLIMETRE));
    expect(
      exact(write.valueAsWritten).mul(write.factor).eq(exact(write.canonicalMetres)),
      `and the three hold together: ${write.valueAsWritten} × ${write.factor} is ${write.canonicalMetres} — the canonical value is the reading as written carried by that very factor (L-QTY-03)`,
    ).toBe(true);


    expect([...law.SITE_FACTS].sort(), "the closed enum holds L-MEA-06's six length facts (interfaces)").toEqual(
      [GROUND_LEVEL, WATER_TABLE, WORKING_ALLOWANCE, DEPTH_EXTRA, BLINDING_PROJECTION, BLINDING_THICKNESS].sort(),
    );
    for (const fact of law.SITE_FACTS) expect(law.isSiteFact(fact), `\`isSiteFact\` admits ${fact} — the roster and its guard are one statement`).toBe(true);
    expect(law.isSiteFact("SOIL_BEARING"), "and admits nothing else: a fact outside the enum is not a site fact (L-MEA-06)").toBe(false);
  }, 900_000);

  test("AC-4: two entries of one fact leave the latest standing, and a fact nobody entered is an absent key", async () => {
    await staged();
    const door = await siteFactsDoor();
    await enterSiteFact(scope, stage.actId, {
      fact: GROUND_LEVEL,
      valueAsWritten: FIRST_GROUND_LEVEL.value,
      unitAsWritten: FIRST_GROUND_LEVEL.unit,
      sourceNote: FIRST_GROUND_LEVEL.note,
    });
    await enterSiteFact(scope, stage.actId, {
      fact: GROUND_LEVEL,
      valueAsWritten: SECOND_GROUND_LEVEL.value,
      unitAsWritten: SECOND_GROUND_LEVEL.unit,
      sourceNote: SECOND_GROUND_LEVEL.note,
    });

    const standing = await door.siteFactsOf(scope);
    const held = standing[GROUND_LEVEL] as StandingSiteFactShape | undefined;
    expect(held, "the door answers the ground level that stands").toBeTruthy();
    expect(held?.valueAsWritten, "which is the LATEST entry — a fact is restated by entering it again, never by editing a row (L-ACT-01)").toBe(SECOND_GROUND_LEVEL.value);
    expect(held?.sourceNote, "with the note that entry carried").toBe(SECOND_GROUND_LEVEL.note);
    expect(held?.actId, "and the act that entered it (AM-06 §1: every entry is an act)").toBe(stage.actId);
    expect(Object.keys(standing).includes(WATER_TABLE), "a fact nobody entered is an ABSENT KEY — an absent fact is a named deferral, never a default (AM-06 §1)").toBe(false);

    // Both entries stand in the ledger: the first was superseded, not replaced (append-only).
    const store = await siteFactsStore();
    const rows = await inTenantTx(scope.tenantId, async (tx) => store.siteFactRowsOf(tx, scope));
    const ground = rows.filter((row) => String(row["fact"]) === GROUND_LEVEL);
    expect(ground.length, "the ledger holds both entries of the ground level, oldest first (L-ACT-01)").toBe(2);
    expect(String(ground[0]?.["valueAsWritten"] ?? ground[0]?.["value_as_written"]), "the first entry stands where it was written").toBe(FIRST_GROUND_LEVEL.value);

    // Every appended row carries the factor it was carried by, and it is the canon's own for the unit
    // that row was written in — so the metres a later reader computes from the row are the metres the
    // row already holds. Asked of the ROW and not of the write: what survives the door is what a
    // takeoff is measured from (B-17, L-QTY-03).
    const { exact, factorOf } = await canon();
    for (const row of ground) {
      const unitAsWritten = said(row, "unitAsWritten", "unit_as_written");
      const valueAsWritten = said(row, "valueAsWritten", "value_as_written");
      const factor = said(row, "factor", "factor");
      const canonicalMetres = said(row, "canonicalMetres", "canonical_metres");
      expect(factor, `the ${valueAsWritten} ${unitAsWritten} entry stands beside the canon's own factor for ${unitAsWritten}`).toBe(factorOf(unitAsWritten));
      expect(
        exact(valueAsWritten).mul(factor).eq(exact(canonicalMetres)),
        `and its canonical metres are that reading carried by that factor: ${valueAsWritten} × ${factor} is ${canonicalMetres}`,
      ).toBe(true);
    }
  }, 900_000);

  test("AC-4: a malformed entry is refused by name, and nothing is written", async () => {
    await staged();
    const law = await siteFactsLaw();
    const store = await siteFactsStore();
    const before = await inTenantTx(scope.tenantId, async (tx) => store.siteFactRowsOf(tx, scope));
    expect(
      await refusalCodeOf(() => law.siteFactWrite({ fact: "SOIL_BEARING", valueAsWritten: "150", unitAsWritten: "kn", sourceNote: "a borelog" }), "a fact outside the closed enum"),
      "a fact the enum does not hold is refused by name (L-QTY-04: a closed enum, never prose)",
    ).toBe(SITE_FACT_UNKNOWN);
    expect(
      await refusalCodeOf(() => law.siteFactWrite({ fact: GROUND_LEVEL, valueAsWritten: "-152.4", unitAsWritten: MILLIMETRE, sourceNote: "   " }), "an entry with no source note"),
      "an entry with no source note is refused — every entry says where it came from (AM-06 §1)",
    ).toBe(SITE_FACT_SOURCE_UNSTATED);
    expect(
      await refusalCodeOf(() => law.siteFactWrite({ fact: GROUND_LEVEL, valueAsWritten: "12", unitAsWritten: NOT_A_LENGTH, sourceNote: "S-01" }), "an entry in a unit that is no length"),
      "a unit the canon carries no LENGTH factor for is the canon's own refusal (B-17)",
    ).toBe(UNIT_UNMAPPED);

    const after = await inTenantTx(scope.tenantId, async (tx) => store.siteFactRowsOf(tx, scope));
    expect(after.length, "a refused write leaves the ledger where it stood — the write is made before it is appended (interfaces)").toBe(before.length);
  }, 900_000);

  test("AC-4: the area's schema publishes the table, and Q-07's scan sees the enum's six spellings", async () => {
    await staged();
    const schema = await productModule<{ FOUNDATIONS_TABLES: Record<string, unknown>; siteFacts: unknown }>(SCHEMA_FOUNDATIONS_MODULE);
    expect(schema.FOUNDATIONS_TABLES["siteFacts"], `${SCHEMA_FOUNDATIONS_MODULE} publishes \`siteFacts\` in \`FOUNDATIONS_TABLES\` — the seam enumerates the area (AM-11)`).toBeTruthy();
    expect(schema.siteFacts, "and exports the table itself, which db/schema/foundations.ts re-exports for the drift lane").toBeTruthy();

    const law = await siteFactsLaw();
    const vocabulary = await productModule<{ TRANSPORT_VOCABULARY: readonly { vocabulary: string; codes: readonly string[] }[] }>(TRANSPORT_VOCABULARY_MODULE);
    const declared = new Set(vocabulary.TRANSPORT_VOCABULARY.flatMap((entry) => [...entry.codes]));
    for (const fact of law.SITE_FACTS) {
      expect(
        declared.has(fact),
        `\`${fact}\` is declared as a foreign vocabulary — a refusal-shaped name nobody registered would read to Q-07's scan as an orphan (Q-07)`,
      ).toBe(true);
    }
  }, 900_000);

  test("AC-4: the ledger stands in its own table, named once", async () => {
    await staged();
    const door = await siteFactsDoor();
    expect([...door.SITE_FACTS].sort(), "the module door re-exports the closed enum, so a caller reads one roster (ARCH-02)").toEqual([...(await siteFactsLaw()).SITE_FACTS].sort());
    expect(SITE_FACTS_TABLE, "and the table it reads is the one the migration lands").toBe("site_facts");
  });
});
