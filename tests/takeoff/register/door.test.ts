/**
 * AC-4 — the double-count guard at the door (L-REG-03).
 *
 * A second measured sighting of one physical scope inside one drawing-set revision is refused at
 * the door and kept as unpriceable evidence in a table no bill can join. Everything below is
 * observed by driving the shipped door against a real pinned set revision — the revision itself is
 * pinned through the product's own act seam — and the store is read back through the door's own
 * readers, plus one catalogue read for the join that must not exist.
 *
 * The guard's SCOPE is graded too: the same sighting under a second pinned revision of the same
 * project registers, because L-REG-03 scopes the refusal to one drawing-set revision and not to the
 * project. Nothing here widens it.
 *
 * Staged lazily and memoised: a throwing hook leaves every case skipped, and a skipped case judges
 * no criterion at all.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COLUMN_C1,
  DUPLICATE_IDENTITY,
  REFUSED_SIGHTINGS,
  REGISTER_OBJECTS,
  anotherSetRevision,
  closeStage,
  field,
  outboundForeignKeys,
  inboundForeignKeys,
  refusals,
  registerSeam,
  rowsSaying,
  stageSetRevision,
  type RegisterAnswer,
  type RegisterSeam,
  type StagedRevision,
} from "./support/register-stage";

const BUDGET_MS = 300_000;

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("door");
    return { register, revision };
  })());
}

/**
 * The two sightings this file makes of one identity inside one revision, each made ONCE however
 * many cases read it — a case that sighted the column again would be a third sighting, and the
 * evidence table counts.
 */
let firstPass: Promise<RegisterAnswer> | undefined;
let secondPass: Promise<RegisterAnswer> | undefined;

function registeredOnce(): Promise<RegisterAnswer> {
  return (firstPass ??= (async () => {
    const { register, revision } = await staged();
    return register.registerSighting(revision.scope, COLUMN_C1);
  })());
}

function refusedOnce(): Promise<RegisterAnswer> {
  return (secondPass ??= (async () => {
    await registeredOnce();
    const { register, revision } = await staged();
    return register.registerSighting(revision.scope, COLUMN_C1);
  })());
}

afterAll(async () => {
  await closeStage();
});

/** The object key one answer stands on, under either spelling the door may use (C-05). */
function objectKeyOf(answer: RegisterAnswer): string {
  const held = field(answer, "objectKey", "object_key");
  expect(typeof held === "string" && held.length > 0, `the door names the register object it answered about: ${JSON.stringify(answer)}`).toBe(true);
  return String(held);
}

/** The refusal one answer carries. */
function refusalOfAnswer(answer: RegisterAnswer): unknown {
  return field(answer, "refusal", "refusal_code");
}

describe("AC-4: a second measured sighting of one identity is refused inside one set revision", () => {
  test(
    "AC-4: the first sighting registers, the second is refused DUPLICATE_IDENTITY on the same object, and the evidence is kept apart",
    async () => {
      const { register, revision } = await staged();

      const first = await registeredOnce();
      expect(first.registered, `the first measured sighting of ${COLUMN_C1.label} registers: ${JSON.stringify(first)}`).toBe(true);
      const objectKey = objectKeyOf(first);

      const second = await refusedOnce();
      expect(second.registered, "the second sighting of the same physical scope does not register — no matcher merges sightings (L-REG-03)").toBe(false);
      expect(refusalOfAnswer(second), "and it is refused by name").toBe(DUPLICATE_IDENTITY);
      expect(objectKeyOf(second), "the refusal names the object already registered — the identity is one identity, sighted twice").toBe(objectKey);

      const objects = await register.registerObjectsOf(revision.scope);
      expect(rowsSaying(objects, objectKey).length, `${REGISTER_OBJECTS} holds exactly one row for that identity — a second row is over-measurement (L-REG-03)`).toBe(1);

      const refused = await register.refusedSightingsOf(revision.scope);
      const kept = rowsSaying(refused, objectKey);
      expect(kept.length, `${REFUSED_SIGHTINGS} keeps exactly one row for the refused sighting — refused is not discarded, it is evidence`).toBe(1);
      expect(refusalOfAnswer(kept[0] as RegisterAnswer), "and the kept row says why it was refused").toBe(DUPLICATE_IDENTITY);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: the guard is per drawing-set revision — the same sighting registers under a second pinned revision of the same project",
    async () => {
      const { register, revision } = await staged();
      const next = await anotherSetRevision(revision);

      const answer = await register.registerSighting(next.scope, COLUMN_C1);
      expect(answer.registered, `the same identity sighted in another revision of the same set registers: L-REG-03 refuses a second sighting INSIDE one drawing-set revision, not across them (${JSON.stringify(answer)})`).toBe(true);
      expect(objectKeyOf(answer), "and it is the same content-derived identity — a key is derived from content, not from the revision it was sighted in (L-REG-04)").toBe(objectKeyOf(await registeredOnce()));

      const objects = await register.registerObjectsOf(next.scope);
      expect(rowsSaying(objects, objectKeyOf(answer)).length, "the new revision holds its own single row for that identity").toBe(1);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: DUPLICATE_IDENTITY is a registered refusal, and the code the door answers is the register's own",
    async () => {
      const registry = await refusals();
      const entry = registry[DUPLICATE_IDENTITY];
      expect(entry, `${DUPLICATE_IDENTITY} is registered in the one refusal register (Q-07, ARCH-02)`).toBeTruthy();
      const held = entry as { code: string; message: string; remedy: string; severity: string; surface: string };
      expect(held.code, "the entry is filed under its own code").toBe(DUPLICATE_IDENTITY);
      for (const part of ["message", "remedy", "severity", "surface"] as const) {
        expect(String(held[part]).length, `the entry says its ${part} — a refusal a person meets is a sentence, not a code (R-SPINE-062)`).toBeGreaterThan(0);
      }

      // The door answers THAT code, read from the register rather than re-spelled here.
      const refused = await refusedOnce();
      expect(refused.registered, "the refused sighting did not register").toBe(false);
      expect(refusalOfAnswer(refused), "the door answers `REFUSALS.DUPLICATE_IDENTITY.code`").toBe(held.code);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: nothing joins the refused sightings — no foreign key reaches that table, and it declares none to the register",
    async () => {
      await staged();

      expect(inboundForeignKeys(REFUSED_SIGHTINGS), `no foreign key points at ${REFUSED_SIGHTINGS}: a bill that could join it is one forgotten WHERE from over-measurement (L-REG-03)`).toEqual([]);
      expect(
        outboundForeignKeys(REFUSED_SIGHTINGS).filter((definition) => definition.includes(REGISTER_OBJECTS)),
        `and ${REFUSED_SIGHTINGS} declares no foreign key to ${REGISTER_OBJECTS} — the evidence stands apart from the record of scope`,
      ).toEqual([]);
    },
    BUDGET_MS,
  );
});
