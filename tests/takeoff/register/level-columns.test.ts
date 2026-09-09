/**
 * AC-6(d) — one reading of which form a level is stated in.
 *
 * `levelSegment` branches on the three forms a level can be stated in and validates the slot;
 * `levelColumns` branches on the same three forms and validates nothing
 * (debt-src-modules-1iqtgz), so an unlawful slot can be written into a register row's columns while
 * the key derived from the same value refuses it. The discrimination has one home —
 * `levelFormOf` — and both callers branch on its answer, so an unlawful slot is refused wherever it
 * arrives and before any row is written.
 */
import { afterAll, expect, test } from "vitest";
import {
  FOUNDATION,
  LEVEL_GF_ID,
  COLUMN_C1,
  closeStage,
  productModule,
  registerSeam,
  stageSetRevision,
} from "./support/register-stage";

const BUDGET_MS = 300_000;

const KEYS_MODULE = "src/core/identity/keys.ts";

/** The law an unlawful level slot is refused under, as the identity module's own error cites it. */
const SLOT_LAW = "L-REG-04";

/** A slot no lawful-null vocabulary holds. */
const UNLAWFUL_SLOT = "BASEMENT";

type LevelRef = { levelId: string } | { slot: string } | { unregistered: string };

/** The identity module's readings of a level, or a loud absence naming what it owes. */
async function keys(): Promise<{ levelFormOf: (level: LevelRef) => string; levelSegment: (level: LevelRef) => string }> {
  const module = await productModule<Record<string, unknown>>(KEYS_MODULE);
  for (const call of ["levelFormOf", "levelSegment"]) {
    expect(typeof module[call], `${KEYS_MODULE} publishes ${call} — the one home of the level-form discrimination (B-17)`).toBe("function");
  }
  return module as unknown as { levelFormOf: (level: LevelRef) => string; levelSegment: (level: LevelRef) => string };
}

afterAll(async () => {
  await closeStage();
}, 120_000);

test("AC-6(d): the three forms a level is stated in are named by one reading", async () => {
  const { levelFormOf } = await keys();

  expect(levelFormOf({ levelId: LEVEL_GF_ID }), "a level the model holds is stated by its surrogate").toBe("surrogate");
  expect(levelFormOf({ slot: FOUNDATION }), "a lawful null is stated by its slot").toBe("slot");
  expect(levelFormOf({ unregistered: "GF" }), "a level nobody has registered is stated by the label the drawing wrote").toBe("unregistered");
});

test("AC-6(d): an unlawful slot is refused by that reading, with the identity module's own error", async () => {
  const { levelFormOf, levelSegment } = await keys();

  expect(() => levelFormOf({ slot: UNLAWFUL_SLOT }), "the form reading carries levelSegment's validation, so both refuse the same values").toThrow(SLOT_LAW);
  expect(() => levelSegment({ slot: UNLAWFUL_SLOT }), "and the segment still refuses it, by the same law").toThrow(SLOT_LAW);
});

test(
  "AC-6(d): a sighting stating an unlawful slot is refused before any row is written",
  async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("level-columns");
    const before = await register.registerObjectsOf(revision.scope);

    await expect(
      register.registerSighting(revision.scope, { ...COLUMN_C1, level: { slot: UNLAWFUL_SLOT } }),
      "the columns a row would be written from are judged by the same reading its key is derived from",
    ).rejects.toThrow(SLOT_LAW);

    const after = await register.registerObjectsOf(revision.scope);
    expect(after.length, "nothing was registered from a sighting stating a level nobody can hold").toBe(before.length);
  },
  BUDGET_MS,
);
