/**
 * AC-6(b) — a reading that does not read as a number is refused by name.
 *
 * A `valueAsWritten` the canon cannot convert reaches the door and throws a bare Error
 * (debt-src-modules-1b9l74e): the transport answers a fault id for a drawing that merely said "N/A"
 * in a cell, and nobody is told what to do about it. It is a registered refusal — READING_NOT_NUMERIC
 * — answered from the door with nothing written, and a blank cell is the same answer rather than a
 * zero somebody might measure with.
 *
 * Driven at the shipped door against a real store: what is graded is the answer and what the ledger
 * holds afterwards.
 */
import { afterAll, expect, test } from "vitest";
import {
  ERRORS_MODULE,
  COLUMN_C1,
  STOREY_HEIGHT,
  closeStage,
  field,
  observation,
  productModule,
  registerSeam,
  stageSetRevision,
  type RegisterSeam,
  type StagedRevision,
} from "./support/register-stage";

const BUDGET_MS = 300_000;

/** The code this criterion appends to the register (spec: one new registered code, never a re-reading). */
const READING_NOT_NUMERIC = "READING_NOT_NUMERIC";

/** A registered entry, as the register holds one. */
type RefusalEntry = { code: string; message: string; remedy: string; severity: string; surface: string };

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
  objectKey: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("non-numeric");
    const registered = await register.registerSighting(revision.scope, COLUMN_C1);
    expect(registered.registered, `the column these readings are about registered: ${JSON.stringify(registered)}`).toBe(true);
    return { register, revision, objectKey: String(field(registered, "objectKey", "object_key")) };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The register of refusals, read from its one home so no test re-spells a code (ARCH-02). */
async function registered(): Promise<RefusalEntry | undefined> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntry>> }>(ERRORS_MODULE);
  return errors.REFUSALS[READING_NOT_NUMERIC];
}

test(
  `AC-6(b): ${READING_NOT_NUMERIC} is a registered refusal, spelled once`,
  async () => {
    const entry = await registered();

    expect(entry, `${READING_NOT_NUMERIC} stands in ${ERRORS_MODULE} — the one home of a code (ARCH-02, R-SPINE-062)`).toBeTruthy();
    expect(entry?.code, "an entry names itself").toBe(READING_NOT_NUMERIC);
    expect(entry?.severity, "a reading nobody can carry is an error, not a warning").toBe("error");
    expect(entry?.surface, "it is answered beside the cell that said it").toBe("inline");
    expect((entry?.message ?? "").trim().length, "the entry says what happened").toBeGreaterThan(0);
    expect((entry?.remedy ?? "").trim().length, "and what to do about it").toBeGreaterThan(0);
  },
  BUDGET_MS,
);

test(
  "AC-6(b): a value that does not read as a number is refused, and nothing is written",
  async () => {
    const stage = await staged();
    const entry = await registered();
    const before = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);

    const answer = await stage.register.appendObservation(
      stage.revision.scope,
      observation({ objectKey: stage.objectKey, valueAsWritten: "N/A", unitAsWritten: "m", precedence: 10 }),
    );

    expect(answer.appended, "nothing was appended").toBe(false);
    expect(answer.refusal, "the door answers the registered code rather than throwing").toBe(entry?.code);
    const after = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);
    expect(after.length, "a refused reading leaves the ledger exactly as it found it").toBe(before.length);
  },
  BUDGET_MS,
);

test(
  "AC-6(b): a blank cell is the same answer, and never a zero",
  async () => {
    const stage = await staged();
    const entry = await registered();
    const before = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);

    const answer = await stage.register.appendObservation(
      stage.revision.scope,
      observation({ objectKey: stage.objectKey, valueAsWritten: "   ", unitAsWritten: "m", precedence: 11 }),
    );

    expect(answer.appended, "a cell that said nothing is no reading").toBe(false);
    expect(answer.refusal, "the same registered code — an absent reading is not a different kind of failure").toBe(entry?.code);
    const after = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);
    expect(after.length, "and nothing — least of all a zero — was written down").toBe(before.length);
  },
  BUDGET_MS,
);
