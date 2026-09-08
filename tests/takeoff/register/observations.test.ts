/**
 * AC-5 — a human change is an appended observation with declared precedence, and nothing overwrites
 * (L-REG-03, R-TO-051, L-ACT-01).
 *
 * Two readings of one storey height are appended to one register object: a transcription of what a
 * drawing says, and a person's entry that overrules it. What is judged is that BOTH readings are
 * still there afterwards, byte for byte, that the standing is DERIVED from them at the declared
 * precedence rather than stored, and that the store itself cannot be made to forget one — the
 * privileges the app role holds on the observation ledger are compared against the ones it holds on
 * the act log, the tree's most consequential record, rather than transcribed here (B-19).
 *
 * The canonical reading is graded against `src/core/units`' own answer as well as the literal the
 * criterion names, so a door that re-spelled the foot factor rather than asking the canon fails
 * (B-17).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACT_LOG,
  AGREED,
  CANONICAL_LENGTH_UNIT,
  COLUMN_C1,
  ENTERED,
  FIRST_UNIT,
  FIRST_VALUE,
  REGISTER_OBSERVATIONS,
  SECOND_UNIT,
  SECOND_VALUE,
  STOREY_HEIGHT,
  TRANSCRIBED,
  actRows,
  canonicalOf,
  closeStage,
  field,
  observation,
  observationIdOf,
  privilegesOf,
  registerSeam,
  saidBy,
  stageSetRevision,
  type AppendAnswer,
  type RegisterSeam,
  type StagedRevision,
  type StoreRow,
} from "./support/register-stage";

const BUDGET_MS = 300_000;

/** The app role, as the live suite's own fixtures name it. */
const ROLE_APP = "cubit_app";

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
  objectKey: string;
  actId: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("observations");
    const registered = await register.registerSighting(revision.scope, COLUMN_C1);
    expect(registered.registered, `the column this file records readings about registered: ${JSON.stringify(registered)}`).toBe(true);
    const objectKey = String(field(registered, "objectKey", "object_key"));
    // The pin that made this revision is a committed act, so a reading may cite an act id that is
    // really in the log — the act TYPE that records an observation is a later leaf (out of scope).
    const actId = pinActOf(revision);
    return { register, revision, objectKey, actId };
  })());
}

/** The act the staged revision was pinned by — a real row of the log for a reading to cite. */
function pinActOf(revision: StagedRevision): string {
  const acts = actRows(revision.person.tenantId, revision.projectId);
  expect(acts.length, "the pin that made this revision stands in the act log, so a reading has an act to cite (L-ACT-01)").toBeGreaterThan(0);
  return (acts[acts.length - 1] as { actId: string }).actId;
}

/** The two appends this file makes, each made once however many cases read them. */
let firstAppend: Promise<AppendAnswer> | undefined;
let secondAppend: Promise<AppendAnswer> | undefined;

function transcribed(): Promise<AppendAnswer> {
  return (firstAppend ??= (async () => {
    const { register, revision, objectKey } = await staged();
    return register.appendObservation(
      revision.scope,
      observation({ objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, basis: TRANSCRIBED, sourceKey: "S-101:t:12", precedence: 1, actId: null }),
    );
  })());
}

function entered(): Promise<AppendAnswer> {
  return (secondAppend ??= (async () => {
    await transcribed();
    const { register, revision, objectKey, actId } = await staged();
    return register.appendObservation(
      revision.scope,
      observation({ objectKey, valueAsWritten: SECOND_VALUE, unitAsWritten: SECOND_UNIT, basis: ENTERED, sourceKey: "S-101:t:12", precedence: 2, actId }),
    );
  })());
}

/** The observations the store holds for the staged object's storey height, in append order. */
async function readings(): Promise<StoreRow[]> {
  const { register, revision, objectKey } = await staged();
  return register.observationsOf(revision.scope, objectKey, STOREY_HEIGHT);
}

afterAll(async () => {
  await closeStage();
});

describe("AC-5: competing observations append with declared precedence, and nothing overwrites", () => {
  test(
    "AC-5: a transcribed reading is appended whole, carried to canonical through the unit canon",
    async () => {
      const answer = await transcribed();
      expect(answer.appended, `the reading was appended: ${JSON.stringify(answer)}`).toBe(true);
      const observationId = observationIdOf(answer);

      const rows = await readings();
      expect(rows.length, "one reading has been recorded so far").toBe(1);
      const row = rows[0] as StoreRow;
      expect(saidBy(row), "the stored row is the one the append answered for").toContain(observationId);
      expect(field(row, "valueAsWritten", "value_as_written"), "the row keeps what the drawing says, as written").toBe(FIRST_VALUE);
      expect(field(row, "unitAsWritten", "unit_as_written"), "and the unit as it was written").toBe(FIRST_UNIT);
      expect(field(row, "canonicalValue", "canonical_value"), `and carries its derivation: ${FIRST_VALUE} ${FIRST_UNIT} in the canonical unit (L-REG-01)`).toBe("3.048");
      expect(field(row, "canonicalUnit", "canonical_unit"), "which is the canonical unit of a length").toBe(CANONICAL_LENGTH_UNIT);
      expect(String(field(row, "canonicalValue", "canonical_value")), "the canonical value is the one src/core/units answers — the factor is never re-spelled (B-17)").toBe(await canonicalOf(FIRST_VALUE, FIRST_UNIT));
    },
    BUDGET_MS,
  );

  test(
    "AC-5: a competing reading at a higher precedence is appended after it, and the earlier row is untouched",
    async () => {
      const before = await readings();
      expect(before.length, "the transcribed reading stands before the second is appended").toBe(1);
      const wasFirst = structuredClone(before[0]) as StoreRow;

      const answer = await entered();
      expect(answer.appended, `the competing reading was appended: ${JSON.stringify(answer)}`).toBe(true);

      const rows = await readings();
      expect(rows.length, "the ledger holds two readings — a change adds a reading, it does not replace one (R-TO-051)").toBe(2);
      expect(rows[0], "and the first reading is exactly what it was: nothing overwrites (L-ACT-01)").toEqual(wasFirst);
      expect(saidBy(rows[1] as StoreRow), "the second row is the one the second append answered for, and it stands after the first").toContain(observationIdOf(answer));
      expect(field(rows[1] as StoreRow, "valueAsWritten", "value_as_written"), "carrying its own as-written reading").toBe(SECOND_VALUE);
      expect(String(field(rows[1] as StoreRow, "actId", "act_id")), "and the act that authored it (R-TO-051)").toBe((await staged()).actId);
    },
    BUDGET_MS,
  );

  test(
    "AC-5: the standing is derived at the declared precedence, and says what it overruled",
    async () => {
      await entered();
      const { register, revision, objectKey } = await staged();
      const standing = await register.attributeStanding(revision.scope, objectKey, STOREY_HEIGHT);

      expect(field(standing, "standing", "standing"), "two readings that agree on nothing but precedence stand at the declared one — AGREED, not resolved by a matcher").toBe(AGREED);
      expect(field(standing, "canonicalValue", "canonical_value"), "the standing reading is the one at the highest declared precedence").toBe(SECOND_VALUE);
      expect(field(standing, "canonicalUnit", "canonical_unit"), "in the canonical unit").toBe(CANONICAL_LENGTH_UNIT);
      expect(String(field(standing, "precedence", "precedence")), "at the precedence it was declared at").toBe("2");

      const overruled = field(standing, "overruled", "overruled");
      expect(Array.isArray(overruled), `the standing says what it overruled, as a list: ${JSON.stringify(standing)}`).toBe(true);
      const listed = overruled as StoreRow[];
      expect(listed.length, "the one earlier reading is overruled, not erased").toBe(1);
      expect(saidBy(listed[0] as StoreRow), "and it is the precedence-1 reading, named as itself").toContain(observationIdOf(await transcribed()));
      expect(saidBy(listed[0] as StoreRow), "still carrying what it read").toContain("3.048");

      // Deriving the standing changed nothing: the ledger is read, never rewritten.
      expect((await readings()).length, "reading a standing appends nothing and removes nothing").toBe(2);
    },
    BUDGET_MS,
  );

  test(
    "AC-5: the observation ledger is as append-only as the act log — the app role may add and read, and nothing else",
    async () => {
      await staged();
      const log = privilegesOf(ACT_LOG, ROLE_APP);
      expect(log.length, `public.${ACT_LOG} is the ledger this one is compared against — with no privileges there is nothing to compare`).toBeGreaterThan(0);
      expect(
        privilegesOf(REGISTER_OBSERVATIONS, ROLE_APP),
        `${REGISTER_OBSERVATIONS} grants ${ROLE_APP} exactly what ${ACT_LOG} grants it — the privilege set is compared against the tree's own ledger, never transcribed (B-19)`,
      ).toEqual(log);
      // And what that set is, read as the retention property it encodes rather than as a roster.
      for (const taken of ["UPDATE", "DELETE"]) {
        expect(log, `${ROLE_APP} cannot ${taken} an act, so it cannot ${taken} a reading either — nothing overwrites (R-TO-051, L-ACT-01)`).not.toContain(taken);
      }
    },
    BUDGET_MS,
  );
});
