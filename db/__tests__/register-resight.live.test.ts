/**
 * AC-6(c) — a rebuild of the same revision is recognised, not merely refused.
 *
 * Re-registering an identity is refused DUPLICATE_IDENTITY and kept as evidence, which is right: a
 * second sighting of one physical scope must not be counted twice. But the answer says nothing about
 * WHETHER the second sighting said anything new (debt-src-modules-8e27jn), so a rebuild of a set
 * revision that changed nothing is indistinguishable from a genuine second drawing of the same
 * column with different content. The recognition is exposed — `semanticUnchanged` — and the refusal
 * and its evidence row are unchanged either way.
 */
import { afterAll, expect, test } from "vitest";
import {
  COLUMN_C1,
  COLUMN_C1_REGRADED,
  DUPLICATE_IDENTITY,
  closeStage,
  field,
  registerSeam,
  stageSetRevision,
  type RegisterAnswer,
  type RegisterSeam,
  type StagedRevision,
} from "../../tests/takeoff/register/support/register-stage";

const BUDGET_MS = 600_000;

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
  objectKey: string;
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("resight");
    const registered = await register.registerSighting(revision.scope, COLUMN_C1);
    expect(registered.registered, `the first sighting registered: ${JSON.stringify(registered)}`).toBe(true);
    return { register, revision, objectKey: String(field(registered, "objectKey", "object_key")) };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** What every refused re-sighting answers, whatever it recognised. */
function expectRefused(answer: RegisterAnswer, objectKey: string): void {
  expect(answer.registered, "a second sighting of one scope is not registered a second time").toBe(false);
  expect(answer.refusal, "and it is refused by the registered code").toBe(DUPLICATE_IDENTITY);
  expect(field(answer, "objectKey", "object_key"), "naming the object it would have been").toBe(objectKey);
}

test(
  "AC-6(c): a re-sighting saying exactly what the first said is recognised as unchanged",
  async () => {
    const stage = await staged();
    const before = await stage.register.refusedSightingsOf(stage.revision.scope);

    const answer = await stage.register.registerSighting(stage.revision.scope, COLUMN_C1);

    expectRefused(answer, stage.objectKey);
    expect(answer["semanticUnchanged"], "a rebuild that derived the same column again said nothing new").toBe(true);
    const after = await stage.register.refusedSightingsOf(stage.revision.scope);
    expect(after.length, "and the sighting is still kept as evidence — the answer is richer, not different").toBe(before.length + 1);
  },
  BUDGET_MS,
);

test(
  "AC-6(c): a re-sighting whose content changed is recognised as changed",
  async () => {
    const stage = await staged();
    const before = await stage.register.refusedSightingsOf(stage.revision.scope);

    const answer = await stage.register.registerSighting(stage.revision.scope, { ...COLUMN_C1, content: COLUMN_C1_REGRADED });

    expectRefused(answer, stage.objectKey);
    expect(answer["semanticUnchanged"], "the same scope, sighted saying something else — that is a difference somebody must look at").toBe(false);
    const after = await stage.register.refusedSightingsOf(stage.revision.scope);
    expect(after.length, "kept as evidence exactly as the unchanged one was").toBe(before.length + 1);
  },
  BUDGET_MS,
);
