/**
 * AC-1 — the key grammars are content-derived, with zero minted ids (L-REG-04).
 *
 * Everything here is observed by driving the product: the grammars are computed over the staged
 * corpus, twice, and what is judged is the key multiset they answer — never how a key is spelled.
 * The second pass is made a hostile one on purpose: the module registry is reset so the identity
 * core is loaded fresh, the clock is moved an hour forward, and `randomUUID` is watched on both
 * channels a module could reach it through. A grammar that minted anything, or that read a clock,
 * answers a different multiset the second time.
 *
 * No expectation is transcribed: the two passes are compared against each other, and the
 * quantisation cases state the rule's own literals (0.1 drawing unit) and nudge a lattice-aligned
 * placement by the two distances that decide it (B-19).
 */
import { describe, expect, test, vi } from "vitest";
import {
  COLUMN_C1,
  KEY_CORPUS,
  LATTICE_PROBE,
  QUANTISE_EPSILON,
  QUANTISE_STEP,
  corpusKeys,
  identitySeam,
  keysOfSighting,
} from "./support/register-stage";

/** An hour, in milliseconds — how far the clock is moved between the two derivations (AC-1). */
const ONE_HOUR_MS = 60 * 60 * 1000;

/** A fixed instant the first pass is taken at, so "an hour later" is a fact and not a coin toss. */
const FIRST_PASS_AT = Date.UTC(2026, 0, 1, 0, 0, 0);

/** What one derivation answered, and how often a uuid was minted while it ran. */
type Pass = { keys: string[]; minted: number };

/**
 * Count every call to `randomUUID` a module could make while `body` runs — through the global
 * WebCrypto object and through the `node:crypto` builtin, the two channels a module has.
 *
 * The global is wrapped with an own property that shadows `Crypto.prototype.randomUUID` and is
 * deleted afterwards, so the platform object is left exactly as it was found.
 */
async function watchingRandomUuid<T>(body: () => Promise<T>): Promise<{ answer: T; minted: number }> {
  let minted = 0;
  const holder = globalThis.crypto as unknown as { randomUUID: () => string };
  const original = holder.randomUUID.bind(globalThis.crypto);
  Object.defineProperty(holder, "randomUUID", {
    configurable: true,
    writable: true,
    value: (): string => {
      minted += 1;
      return original();
    },
  });
  vi.doMock("node:crypto", async () => {
    const actual = (await vi.importActual("node:crypto")) as Record<string, unknown>;
    const mint = actual["randomUUID"] as () => string;
    return { ...actual, default: actual, randomUUID: (): string => (minted += 1, mint()) };
  });
  try {
    return { answer: await body(), minted };
  } finally {
    delete (holder as Partial<{ randomUUID: () => string }>).randomUUID;
    vi.doUnmock("node:crypto");
  }
}

/** One derivation of every key the corpus carries, from an identity core loaded fresh. */
async function pass(at: number): Promise<Pass> {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  try {
    const watched = await watchingRandomUuid(async () => {
      const identity = await identitySeam();
      return corpusKeys(identity);
    });
    return { keys: watched.answer, minted: watched.minted };
  } finally {
    vi.useRealTimers();
    vi.resetModules();
  }
}

describe("AC-1: keys are content-derived, with zero minted ids", () => {
  test("AC-1: an identical re-derivation an hour later reproduces the identical key multiset, minting nothing", async () => {
    const first = await pass(FIRST_PASS_AT);
    const second = await pass(FIRST_PASS_AT + ONE_HOUR_MS);

    // The corpus really produced keys — an empty multiset would agree with itself and prove nothing.
    const owed = KEY_CORPUS.reduce((total, sighting) => total + 3 + sighting.bars.length, 0);
    expect(first.keys.length, "every sighting of the corpus derives a view key, a placement key, an instance key and one key per bar (L-REG-04)").toBe(owed);
    for (const key of first.keys) expect(typeof key === "string" && key.length > 0, `every derived key is a string: ${JSON.stringify(key)}`).toBe(true);

    expect(second.keys, "the same contents derive the same keys an hour later, from a module loaded fresh — a minted id, a clock or a sequence would move them (L-REG-04)").toEqual(first.keys);
    expect(first.minted + second.minted, "the identity core minted no uuid at all: a content-derived key has no id in it (L-REG-04)").toBe(0);

    // The multiset is not agreeing with itself by being one key repeated: the corpus stages six
    // sightings that differ in identity, and each stands on its own instance row key.
    const identity = await identitySeam();
    const instances = new Set(KEY_CORPUS.map((sighting) => keysOfSighting(identity, sighting)[2]));
    expect(instances.size, "each staged sighting stands on its own instance key — no two of the corpus collide").toBe(KEY_CORPUS.length);
  });

  test("AC-1: quantisation is to 0.1 drawing unit, and never answers a negative zero", async () => {
    const identity = await identitySeam();
    expect(identity.quantise(1000.04), "1000.04 is on the 1000.0 lattice point").toBe("1000.0");
    expect(identity.quantise(250.96), "250.96 rounds up to the 251.0 lattice point").toBe("251.0");
    expect(identity.quantise(-0.04), "a value just below zero quantises to zero, spelled once").toBe("0.0");
    expect(identity.quantise(-0.04).startsWith("-"), "`-0.0` is not a lattice point: two spellings of zero are two keys (L-REG-04)").toBe(false);
    // COLUMN_C1 stands off the lattice on both axes, so its own key says the quantiser ran at all.
    expect(identity.quantise(COLUMN_C1.x), "the staged column's x quantises onto the lattice").toBe("1000.0");
    expect(identity.quantise(COLUMN_C1.y), "and so does its y").toBe("251.0");
  });

  test("AC-1: two placements within 0.1 drawing unit share a placement key, and two a step apart do not", async () => {
    const identity = await identitySeam();
    const at = (dx: number, dy: number): string => identity.placementKey({ ...LATTICE_PROBE, x: LATTICE_PROBE.x + dx, y: LATTICE_PROBE.y + dy });
    const here = at(0, 0);

    expect(at(QUANTISE_EPSILON, 0), `a placement ${QUANTISE_EPSILON} along x is the same lattice point, so it is the same placement`).toBe(here);
    expect(at(0, QUANTISE_EPSILON), `and ${QUANTISE_EPSILON} along y is too`).toBe(here);
    expect(at(QUANTISE_STEP, 0), `a placement ${QUANTISE_STEP} along x is the next lattice point, so it is another placement`).not.toBe(here);
    expect(at(0, QUANTISE_STEP), `and ${QUANTISE_STEP} along y is too`).not.toBe(here);
  });
});
