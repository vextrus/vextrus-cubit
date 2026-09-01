/**
 * Public acceptance for AC-4 (SEAM-STORAGE, R-SPINE-021, Q-12): the storage seam is corrected where
 * it lives — `verify` judges its own argument before it judges far-side input, a URL carried behind
 * an uppercase scheme is the same URL, the tenant shape is asked of the tenancy seam rather than
 * re-spelled here, and the staging copy has an address a test can pre-empt.
 *
 * Everything behavioural runs over a scratch root under $TMPDIR and an injected clock: the seam
 * reads no environment and holds no singleton, which is what makes that possible.
 *
 * Two assertions read the module's TEXT, and deliberately: "asks the seam's own `isUuid` rather than
 * re-spelling a UUID regex" and "handed to the hook rather than discarded" are facts about the
 * source, not about a call — a second copy of a regex answers identically until the day the two
 * copies disagree, which is the row being paid down. Both scans read the code with comments removed,
 * so a comment explaining the change cannot fail the check.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { codeOf } from "../../__tests__/support/read-source";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const STORAGE_MODULE = "src/core/storage/index.ts";

/** The seam's surface as tsc reads it — a type position, erased before the transform sees it. */
type StorageSeam = typeof import("../index");

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
  const specifier: string = abs;
  return (await import(specifier)) as StorageSeam;
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

/** The code of the storage module, comments removed — the two text assertions read this. */
const storageCode = (): string => codeOf(STORAGE_MODULE, "SEAM-STORAGE has one home and this acceptance judges what stands in it");

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

    const code = storageCode();
    expect(
      code.includes("isUuid"),
      "the tenant-prefix check asks the tenancy seam's exported isUuid — the shape a uuid column can hold belongs to the seam that defines the columns (ARCH-02)",
    ).toBe(true);
    expect(
      /\{8\}-/.test(code),
      "storage must not re-spell a UUID regex of its own: two copies of one shape answer identically until the day they disagree (B-05, ARCH-02)",
    ).toBe(false);
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
  test("AC-4: StorageOptions carries onCleanupFailure, a clean put never calls it, and no cleanup answer is thrown away", async () => {
    const { storage, cleanupFailures } = await staged();

    const first = await storage.put(TENANT, BYTES);
    const second = await storage.put(TENANT, BYTES);
    expect(second.sha256, "identical bytes have one address, and a second put links nothing new (R-SPINE-021)").toBe(first.sha256);
    expect(cleanupFailures, "a clean put leaves nothing to report — the hook is for a staging copy that would not go away").toEqual([]);

    const code = storageCode();
    expect(code.includes("onCleanupFailure"), "StorageOptions gains an optional onCleanupFailure hook, and the seam reaches for it").toBe(true);
    expect(
      /\.catch\(\s*\([^)]*\)\s*=>\s*(?:undefined|\{\s*\})\s*\)/.test(code),
      "a cleanup answer must reach the hook rather than a discarding catch: a staging copy that cannot be removed is a fact about the volume, and an operator can only act on what they are told (ARCH-03, B-21)",
    ).toBe(false);
  });
});
