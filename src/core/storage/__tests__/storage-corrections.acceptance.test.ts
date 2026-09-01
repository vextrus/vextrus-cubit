/**
 * Public acceptance for AC-4 (SEAM-STORAGE, R-SPINE-021, Q-12): the storage seam is corrected where
 * it lives — `verify` judges its own argument before it judges far-side input, a URL carried behind
 * an uppercase scheme is the same URL, the tenant shape is asked of the tenancy seam rather than
 * re-spelled here, and the staging copy has an address a test can pre-empt.
 *
 * Everything behavioural runs over a scratch root under $TMPDIR and an injected clock: the seam
 * reads no environment and holds no singleton, which is what makes that possible.
 *
 * Two of this increment's rows are about WHERE an answer comes from and WHAT HAPPENS on a path the
 * filesystem does not normally take, so neither can be graded by reading the module's text — a
 * second copy of a UUID regex answers identically to the seam's own until the day the two disagree,
 * and a cleanup failure that is discarded looks exactly like one that never happened. Both are
 * graded by substituting the thing underneath and watching what the seam does:
 *
 *   - `src/core/db.ts`'s `isUuid` is replaced with a recording stand-in, so "storage asks the
 *     tenancy seam" becomes "the seam's answer changes what storage does";
 *   - `node:fs/promises`'s `link` and `unlink` are replaced with ones that can be made to fail, so
 *     the cleanup-failure path and the not-EEXIST link path actually RUN.
 *
 * Both substitutions pass everything else through untouched, and both are self-validated before
 * they grade anything.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const STORAGE_MODULE = "src/core/storage/index.ts";

/**
 * The tenancy seam's answer to "can a uuid column hold this?", made observable and steerable. When
 * `answer` is null the real export decides, so every other test in this file runs against the seam
 * exactly as it ships.
 */
const tenancySeam = vi.hoisted(() => ({ asked: [] as string[], answer: null as null | ((value: string) => boolean) }));

vi.mock("../../db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const real = actual["isUuid"] as (value: string) => boolean;
  return {
    ...actual,
    isUuid: (value: string): boolean => {
      tenancySeam.asked.push(value);
      return tenancySeam.answer === null ? real(value) : tenancySeam.answer(value);
    },
  };
});

/**
 * The volume underneath the seam. `linkFailure` is the answer `link` gives; `unlinkFailure` is the
 * answer `unlink` gives for the paths its `match` claims. Null means "the real filesystem answers".
 */
const volume = vi.hoisted(() => ({
  linkFailure: null as null | Error,
  unlinkFailure: null as null | { readonly error: Error; readonly match: (path: string) => boolean },
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const link = async (from: Parameters<typeof actual.link>[0], to: Parameters<typeof actual.link>[1]): Promise<void> => {
    if (volume.linkFailure !== null) throw volume.linkFailure;
    return actual.link(from, to);
  };
  const unlink = async (target: Parameters<typeof actual.unlink>[0]): Promise<void> => {
    const failing = volume.unlinkFailure;
    if (failing !== null && failing.match(String(target))) throw failing.error;
    return actual.unlink(target);
  };
  return { ...actual, link, unlink, default: { ...actual, link, unlink } };
});

afterEach(() => {
  tenancySeam.asked.length = 0;
  tenancySeam.answer = null;
  volume.linkFailure = null;
  volume.unlinkFailure = null;
});

/** An error the volume raises, carrying the `code` the seam reads it by. */
const volumeError = (code: string, said: string): Error => Object.assign(new Error(said), { code });

/** The seam's surface as tsc reads it — a type position, erased before the transform sees it. */
type StorageSeam = typeof import("../index");

/** The options the seam declares. AC-6's readonly row aside, this is the shape a caller configures. */
type DeclaredOptions = StorageSeam["makeStorage"] extends (options: infer O) => unknown ? O : never;

/**
 * Compile-time half of the cleanup row: `StorageOptions` itself declares the hook, so a caller that
 * passes one is typechecked rather than merely tolerated. `pnpm verify` is the runner for this line.
 */
export const storageOptionsDeclaresCleanupHook: "onCleanupFailure" extends keyof DeclaredOptions ? true : false = true;

/** The options this increment adds to, stated locally so this file typechecks against both trees. */
type SweptOptions = Parameters<StorageSeam["makeStorage"]>[0] & { onCleanupFailure?: (error: unknown) => void };

/** A tenant prefix as the tenancy seam mints one: a canonical lowercase uuid. */
const TENANT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const SECRET = "acceptance-signing-secret";

/** The moment the injected clock stands at, so every expiry in this file is arithmetic. */
const NOW = new Date("2026-09-01T00:00:00.000Z");

const BYTES = new Uint8Array([1, 2, 3, 4, 5]);

const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

async function seam(): Promise<StorageSeam> {
  const abs = join(REPO_ROOT, STORAGE_MODULE);
  expect(existsSync(abs) && statSync(abs).isFile(), `${STORAGE_MODULE} is missing from the checkout — SEAM-STORAGE has one home`).toBe(true);
  // Imported by the same specifier the seam's own neighbours use, so the substituted `node:fs/promises`
  // and `../../db` above are the ones this module is wired to.
  return await import("../index");
}

/** A scratch root and a seam over it, plus whatever the cleanup hook was handed. */
async function staged(): Promise<{ root: string; storage: ReturnType<StorageSeam["makeStorage"]>; cleanupFailures: unknown[] }> {
  const { makeStorage } = await seam();
  const root = await mkdtemp(join(tmpdir(), "cubit-storage-acceptance-"));
  const cleanupFailures: unknown[] = [];
  const options: SweptOptions = {
    root,
    signingSecret: SECRET,
    now: () => NOW,
    onCleanupFailure: (error: unknown) => {
      cleanupFailures.push(error);
    },
  };
  return { root, storage: makeStorage(options), cleanupFailures };
}

describe("AC-4: verify judges its own argument before it judges far-side input", () => {
  test("AC-4: an unusable `at` is a caller error even when the URL is not one this seam minted", async () => {
    const { storage } = await staged();
    // The discriminator: today the URL is parsed first, so an unparseable string answers
    // `{ ok: false, reason: "invalid" }` and the caller's broken clock is never mentioned. `at` is
    // the CALLER's argument — it is validated before any parsing or signature work is done for it.
    expect(() => storage.verify("not-a-signed-url", new Date(Number.NaN)), "verify(url, at) validates `at` before it parses the url").toThrow(TypeError);
    for (const unusable of [new Date(Number.NaN), new Date("nonsense")]) {
      expect(() => storage.verify("", unusable), "an unusable Date is a caller error whatever the url says").toThrow(TypeError);
    }
    // …and a usable `at` over a string this seam did not mint is still simply not vouched for: no
    // shape of far-side input throws.
    expect(storage.verify("not-a-signed-url", NOW), "a string this seam did not mint is not vouched for, and does not throw").toEqual({ ok: false, reason: "invalid" });
  });
});

describe("AC-4: a minted URL is the same URL behind an uppercase scheme", () => {
  test("AC-4: HTTPS:// verifies exactly as https:// and as the bare path", async () => {
    const { storage } = await staged();
    const sha256 = sha256Of(BYTES);
    const minted = storage.sign(TENANT, sha256, { expiresInSeconds: 60 });
    const at = new Date(NOW.getTime() + 30_000);

    const bare = storage.verify(minted, at);
    expect(bare, "the seam vouches for the URL it just minted").toEqual({ ok: true, tenantId: TENANT, sha256 });
    expect(storage.verify(`https://cubit.example${minted}`, at), "an origin the signature does not cover changes nothing").toEqual(bare);
    expect(
      storage.verify(`HTTPS://cubit.example${minted}`, at),
      "a scheme is case-insensitive, so a URL carried behind HTTPS:// is the same URL — refusing it would refuse an artefact this seam minted",
    ).toEqual(bare);
    // The rule holds on the refusing side too: an uppercase carrier does not become a way to make an
    // expired URL read as something other than expired.
    const afterExpiry = new Date(NOW.getTime() + 60_000);
    expect(storage.verify(`HTTPS://cubit.example${minted}`, afterExpiry), "an uppercase carrier is judged at the same moment as a lowercase one").toEqual(
      storage.verify(minted, afterExpiry),
    );
  });
});

describe("AC-4: the tenant shape is asked of the tenancy seam", () => {
  test("AC-4: storage asks isUuid rather than re-spelling a UUID regex, and still refuses a non-canonical id", async () => {
    const { storage } = await staged();
    const sha256 = sha256Of(BYTES);

    // The behaviour the correction must not lose: a prefix comes from the tenancy seam, so anything
    // that is not a canonical LOWERCASE uuid is a caller error, refused before a path is built.
    for (const notATenant of ["", "..", "not-a-uuid", `${TENANT}/..`, TENANT.toUpperCase()]) {
      expect(() => storage.sign(notATenant, sha256, { expiresInSeconds: 60 }), `sign(${JSON.stringify(notATenant)}) must refuse a tenant id the seam did not mint`).toThrow(TypeError);
      await expect(storage.put(notATenant, BYTES), `put(${JSON.stringify(notATenant)}) must refuse a tenant id the seam did not mint`).rejects.toBeInstanceOf(TypeError);
      await expect(storage.get(notATenant, sha256), `get(${JSON.stringify(notATenant)}) must refuse a tenant id the seam did not mint`).rejects.toBeInstanceOf(TypeError);
    }
    expect(() => storage.sign(TENANT, sha256, { expiresInSeconds: 60 }), "a canonical lowercase uuid is a tenant prefix the seam works for").not.toThrow();
    // The seam's own answer is case-insensitive — a uuid column holds an uppercase spelling — so the
    // refusal of `TENANT.toUpperCase()` above is storage's own canonical-form discipline, kept on top
    // of the seam's answer rather than instead of it.
  });

  test("AC-4: the seam's answer is what decides — a stand-in isUuid that says no makes storage refuse", async () => {
    // The substitution is graded before it grades anything: an importer of the tenancy seam must
    // receive the stand-in, or this test would pass against any implementation at all.
    const tenancy = await import("../../db");
    tenancySeam.answer = () => false;
    expect(tenancy.isUuid(TENANT), "the stand-in is what an importer of src/core/db.ts receives").toBe(false);
    expect(tenancySeam.asked, "…and every question put to the seam is recorded").toEqual([TENANT]);
    tenancySeam.asked.length = 0;

    const { storage } = await staged();
    const sha256 = sha256Of(BYTES);
    const why =
      "the tenant-prefix check must ASK the tenancy seam's exported isUuid: with the seam answering that no value is a uuid, storage cannot still accept one — a second copy of the shape spelled inside storage answers identically to the seam's until the day the two disagree, which is the whole row (B-05, ARCH-02)";
    expect(() => storage.sign(TENANT, sha256, { expiresInSeconds: 60 }), why).toThrow(TypeError);
    await expect(storage.put(TENANT, BYTES), why).rejects.toBeInstanceOf(TypeError);
    await expect(storage.get(TENANT, sha256), why).rejects.toBeInstanceOf(TypeError);
    expect(tenancySeam.asked, "…and the value storage judged is the one it put to the seam").toContain(TENANT);

    // And the other direction, so the check is a real call and not a hardcoded refusal: with the
    // seam answering as it ships, the same three doors work.
    tenancySeam.answer = null;
    expect(() => storage.sign(TENANT, sha256, { expiresInSeconds: 60 }), "the seam's real answer admits a tenant prefix the tenancy seam minted").not.toThrow();
  });
});

describe("AC-4: the staging copy has an address a caller can name", () => {
  test("AC-4: the staging copy is written at `<object path>.staging`, and a taken path still stores the bytes", async () => {
    const { root, storage } = await staged();
    const sha256 = sha256Of(BYTES);
    const objectPath = join(root, TENANT, sha256);
    const stagingPath = `${objectPath}.staging`;
    const JUNK = "an earlier run left this behind";

    await mkdir(join(root, TENANT), { recursive: true });
    await writeFile(stagingPath, JUNK, "utf8");

    const stored = await storage.put(TENANT, BYTES);
    expect(stored.sha256, "a put that finds the staging path already taken still answers the address of the bytes").toBe(sha256);
    expect(Array.from((await storage.get(TENANT, sha256)) ?? []), "…and the bytes are actually stored").toEqual(Array.from(BYTES));

    // The staging path is deterministic, which is the whole point of the row: a random suffix is a
    // path no test can pre-empt, so neither the collision nor the cleanup is reachable from one.
    // If the seam staged at this address, what stood there cannot have survived untouched.
    const survivor = existsSync(stagingPath) ? await readFile(stagingPath, "utf8") : null;
    expect(
      survivor,
      `the staging copy must be written at <object path>.staging — the file that stood at ${stagingPath} was left exactly as it was, so the seam staged somewhere else`,
    ).not.toBe(JUNK);
  });
});

describe("AC-4: a cleanup failure is handed to the caller's hook, not discarded", () => {
  test("AC-4: a clean put never calls the hook", async () => {
    const { storage, cleanupFailures } = await staged();

    const first = await storage.put(TENANT, BYTES);
    const second = await storage.put(TENANT, BYTES);
    expect(second.sha256, "identical bytes have one address, and a second put links nothing new (R-SPINE-021)").toBe(first.sha256);
    expect(cleanupFailures, "a clean put leaves nothing to report — the hook is for a staging copy that would not go away").toEqual([]);
  });

  test("AC-4: a staging copy that will not be removed reaches onCleanupFailure, and the put still stores the bytes", async () => {
    const { root, storage, cleanupFailures } = await staged();
    const sha256 = sha256Of(BYTES);
    const settled = join(root, TENANT, sha256);

    // The volume refuses to remove anything that is not the settled address — which is the staging
    // copy, wherever the seam chose to put it. The path this arms on is not assumed: it is stated as
    // "not the object's own address", so the row is graded without naming the staging suffix here.
    const refusal = volumeError("EBUSY", "acceptance: the volume would not remove the staging copy");
    volume.unlinkFailure = { error: refusal, match: (path) => resolve(path) !== resolve(settled) };

    const stored = await storage.put(TENANT, BYTES);
    expect(stored.sha256, "cleanup is not the operation: a staging copy that would not go away must not lose the caller the address of bytes that are stored").toBe(sha256);
    expect(Array.from((await storage.get(TENANT, sha256)) ?? []), "…and the bytes really are at that address").toEqual(Array.from(BYTES));
    expect(
      cleanupFailures,
      "a staging copy that cannot be removed is a fact about the volume, and an operator can only act on what they are told: the answer goes to StorageOptions.onCleanupFailure rather than into a discarding catch (ARCH-03, B-21)",
    ).toContain(refusal);
  });

  test("AC-4: a link failure that is not EEXIST still reaches the caller unchanged", async () => {
    const { storage, cleanupFailures } = await staged();

    // EEXIST is the ordinary answer — the address was already settled — and it is the only one the
    // seam absorbs. Anything else is the volume telling the caller something, and it travels intact.
    const failure = volumeError("EXDEV", "acceptance: the staging copy and its address are on different devices");
    volume.linkFailure = failure;

    await expect(
      storage.put(TENANT, BYTES),
      "a link failure that is not EEXIST is the caller's story to hear, and cleanup never replaces it — the same error object, not a rewrapped one (ARCH-03)",
    ).rejects.toBe(failure);
    expect(cleanupFailures, "the volume removed the staging copy without complaint, so the hook has nothing to report").toEqual([]);
  });
});
