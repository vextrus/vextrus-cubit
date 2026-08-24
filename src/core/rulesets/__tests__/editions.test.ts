/**
 * inc-012 AC-1 — the edition digest and the `IS1200_IN @ 2026.08` seed (L-MEA-01, B-07).
 *
 * L-MEA-01 makes an edition "keyed by a digest over its parameter values × the (rule id,
 * version) pairs of methods in force", and the Increment Spec fixes the one encoding that
 * phrase admits: sha-256, lowercase hex, over the UTF-8 JSON of
 *
 *     { methods: [[ruleId, version], …] sorted by ruleId then version,
 *       parameters: { key: value, … } keys sorted ascending }
 *
 * so this file recomputes that canonical form with `node:crypto` and compares. The point is
 * not that the implementation agrees with itself — it is that two trees, two forks and two
 * insertion orders agree with each other, which is what makes a digest a pin.
 *
 * B-07: every parameter value is an exact decimal *string*, at rest and at the seam. A value
 * that ever became a number would round `0.08` and nobody would see it happen, so the
 * assertions below are about the strings themselves, never about arithmetic on them.
 *
 * The modules are loaded by an absolute path assembled at run time. A literal
 * `import '../editions'` is resolved while this file is transformed, so on the day the module
 * does not exist vite would fail the whole file and vitest would report "0 test" — no failing
 * assertion at all. Assembled at run time, a missing module is one named failure per test.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The vitest root is the repository root (vitest.config.ts includes `src/**` from it). */
const REPO = process.cwd();

const EDITIONS_MODULE = 'src/core/rulesets/editions';
const SEED_MODULE = 'src/core/rulesets/seed';

/** The seed's key, as L-MEA-01 names it: `IS1200_IN @ 2026.08`. */
const SEED_NAME = 'IS1200_IN';
const SEED_VERSION = '2026.08';

/**
 * L-MEA-01's seventeen parameter values, verbatim from the test contract, in its own order.
 *
 * Frozen as a list of pairs rather than an object literal so that "the seed carries exactly
 * these, and in no case a float" can be asserted over the pairs themselves.
 */
const SEED_PARAMETERS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['openingDeductionMinM2', '0.1'],
  ['memberEndNoDeductMaxCm2', '500'],
  ['embeddedDuctNoDeductMaxCm2', '100'],
  ['finishOpeningDeductionMinM2', '0.1'],
  ['finishMinOutlineArea', '0.2'],
  ['finishMaxOutlineArea', '20000'],
  ['scaleVerificationTolerance', '0.01'],
  ['scaleAnisotropyTolerance', '0.01'],
  ['earthworkWorkingAllowance', '1.5'],
  ['earthworkDepthExtra', '0.5'],
  ['blindingProjection', '3'],
  ['blindingThickness', '3'],
  ['placementContainmentMerge', '0.08'],
  ['placementNearAnchor', '0.9'],
  ['placementFootprintMin', '0.6'],
  ['placementFootprintMax', '2.5'],
  ['placementHumanSnap', '0.5'],
] as const);

/** An exact decimal string: digits, optionally a single fractional part. Never `1e-1`. */
const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;

/** A digest, as the contract spells it: lowercase hex, sha-256 wide. */
const HEX64 = /^[0-9a-f]{64}$/;

type Method = { readonly ruleId: string; readonly version: number };
type EditionDigest = (
  parameters: Readonly<Record<string, string>>,
  methods: readonly Method[],
) => string;

interface Seed {
  readonly name: unknown;
  readonly version: unknown;
  readonly methods: unknown;
  readonly parameters: unknown;
}

/* ────────────────────────────── the tree, loaded at run time ────────────────────────── */

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = join(REPO, ...relative.split('/'));
  const candidates = [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

async function digestFn(): Promise<EditionDigest> {
  const module = await importProduct(EDITIONS_MODULE);
  const exported = module['editionDigest'];
  expect(
    typeof exported,
    `${EDITIONS_MODULE} exports no editionDigest function (AC-1)`,
  ).toBe('function');
  return exported as EditionDigest;
}

async function seed(): Promise<Seed> {
  const module = await importProduct(SEED_MODULE);
  const exported = module['IS1200_SEED'];
  expect(exported, `${SEED_MODULE} exports no IS1200_SEED (AC-1)`).toBeDefined();
  return exported as Seed;
}

/* ─────────────────────── the canonical serialization, recomputed ────────────────────── */

/** The contract's canonical form, built here so the digest is checked against a second reading. */
function canonical(
  parameters: Readonly<Record<string, string>>,
  methods: readonly Method[],
): string {
  const pairs = [...methods]
    .map((method): readonly [string, number] => [method.ruleId, method.version])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1));
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(parameters).sort()) {
    const value = parameters[key];
    if (value !== undefined) sorted[key] = value;
  }
  return JSON.stringify({ methods: pairs, parameters: sorted });
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The seed's parameters as the object shape `editionDigest` takes, in contract order. */
function seedParameters(): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const [id, value] of SEED_PARAMETERS) parameters[id] = value;
  return parameters;
}

/** The same parameters, inserted in the opposite order — a different object, one digest. */
function reversedParameters(): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const [id, value] of [...SEED_PARAMETERS].reverse()) parameters[id] = value;
  return parameters;
}

/** Methods that are neither sorted nor grouped, so "sorted by ruleId then version" bites. */
const UNSORTED_METHODS: readonly Method[] = Object.freeze([
  { ruleId: 'wall.opening.deduct', version: 2 },
  { ruleId: 'beam.length.longSection', version: 1 },
  { ruleId: 'wall.opening.deduct', version: 1 },
]);

/* ═════════════════════════════════════ AC-1 ═════════════════════════════════════════ */

describe('AC-1 / L-MEA-01 — editionDigest is a canonical digest, not a hash of whatever arrived', () => {
  it('is the lowercase 64-hex sha-256 of the contract’s canonical serialization', async () => {
    const editionDigest = await digestFn();
    const parameters = seedParameters();

    const digest = editionDigest(parameters, []);
    expect(digest, `editionDigest returned ${JSON.stringify(digest)}`).toMatch(HEX64);
    expect(
      digest,
      'the digest is not the sha-256 of the canonical JSON the test contract fixes',
    ).toBe(sha256(canonical(parameters, [])));
  });

  it('L-MEA-01: the same values in a different insertion order digest identically', async () => {
    const editionDigest = await digestFn();

    expect(
      editionDigest(reversedParameters(), []),
      'a parameter set built in the opposite order digested differently — the keys are not sorted',
    ).toBe(editionDigest(seedParameters(), []));

    const reversedMethods = [...UNSORTED_METHODS].reverse();
    expect(
      editionDigest(seedParameters(), reversedMethods),
      'the same methods in another order digested differently — the pairs are not sorted',
    ).toBe(editionDigest(seedParameters(), UNSORTED_METHODS));
  });

  it('L-MEA-01: the (rule id, version) pairs are sorted by ruleId then version', async () => {
    const editionDigest = await digestFn();
    const parameters = seedParameters();

    expect(
      editionDigest(parameters, UNSORTED_METHODS),
      'methods in force are not serialized as (ruleId, version) pairs sorted by ruleId then version',
    ).toBe(sha256(canonical(parameters, UNSORTED_METHODS)));
  });

  it('L-MEA-01: changing any single parameter value changes the digest', async () => {
    const editionDigest = await digestFn();
    const pinned = editionDigest(seedParameters(), []);

    for (const [id] of SEED_PARAMETERS) {
      const moved = seedParameters();
      // A value nothing else in the seed carries, so no two edits can collide.
      moved[id] = '7.25';
      expect(
        editionDigest(moved, []),
        `moving ${id} left the digest unchanged — the parameter is outside the digest`,
      ).not.toBe(pinned);
    }
  });

  it('L-MEA-01: a version bump moves the digest, and so does a new method in force', async () => {
    const editionDigest = await digestFn();
    const parameters = seedParameters();
    const base = editionDigest(parameters, UNSORTED_METHODS);

    const bumped = UNSORTED_METHODS.map((method) =>
      method.ruleId === 'beam.length.longSection' ? { ruleId: method.ruleId, version: 2 } : method,
    );
    expect(
      editionDigest(parameters, bumped),
      'bumping a method version left the digest unchanged — "a version bump moves every edition citing it"',
    ).not.toBe(base);

    expect(
      editionDigest(parameters, [...UNSORTED_METHODS, { ruleId: 'slab.beam.junction', version: 1 }]),
      'adding a method in force left the digest unchanged',
    ).not.toBe(base);

    expect(
      editionDigest(parameters, []),
      'an edition with no methods in force digests the same as one with three',
    ).not.toBe(base);
  });

  it('is deterministic across calls, so a fork can be verified by recomputation', async () => {
    const editionDigest = await digestFn();
    expect(editionDigest(seedParameters(), UNSORTED_METHODS)).toBe(
      editionDigest(reversedParameters(), [...UNSORTED_METHODS].reverse()),
    );
  });
});

describe('AC-1 / L-MEA-01, B-07 — IS1200_SEED is the platform seed the Bible names', () => {
  it('carries name IS1200_IN, version 2026.08 and no methods in force (M0)', async () => {
    const found = await seed();
    expect(found.name, 'IS1200_SEED.name').toBe(SEED_NAME);
    expect(found.version, 'IS1200_SEED.version').toBe(SEED_VERSION);
    expect(Array.isArray(found.methods), 'IS1200_SEED.methods is not an array').toBe(true);
    expect(found.methods, 'no method is in force in M0, so methods is []').toEqual([]);
  });

  it('carries exactly L-MEA-01’s seventeen parameters, by id and by value', async () => {
    const found = await seed();
    expect(typeof found.parameters, 'IS1200_SEED.parameters is not an object').toBe('object');
    const parameters = found.parameters as Record<string, unknown>;

    for (const [id, value] of SEED_PARAMETERS) {
      expect(parameters[id], `IS1200_SEED is missing ${id} or pins it to another value`).toBe(value);
    }
    // Exactly the seventeen: an eighteenth value would be a parameter nothing in the tree
    // decided, and L-MEA-01 mints a new edition for a changed set rather than growing this one.
    expect(
      Object.keys(parameters).sort(),
      'IS1200_SEED carries a parameter L-MEA-01 does not name for this seed',
    ).toEqual(SEED_PARAMETERS.map(([id]) => id).sort());
  });

  it('B-07: every pinned value is an exact decimal string — no float reaches the seam', async () => {
    const found = await seed();
    const parameters = found.parameters as Record<string, unknown>;

    for (const [id] of SEED_PARAMETERS) {
      const value = parameters[id];
      expect(typeof value, `${id} is stored as ${typeof value}, not as a decimal string (B-07)`).toBe(
        'string',
      );
      expect(String(value), `${id} is not an exact decimal string`).toMatch(DECIMAL);
    }
  });

  it('digests to the digest its own values imply', async () => {
    const editionDigest = await digestFn();
    const found = await seed();
    const parameters = found.parameters as Record<string, string>;
    const methods = found.methods as readonly Method[];

    expect(
      editionDigest(parameters, methods),
      'the seed does not digest to the canonical digest of its own parameters and methods',
    ).toBe(sha256(canonical(parameters, methods)));
  });
});
