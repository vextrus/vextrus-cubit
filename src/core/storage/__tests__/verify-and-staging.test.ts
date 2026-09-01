/**
 * SEAM-STORAGE (R-SPINE-021, Q-12) over a scratch root and an injected clock: what `verify` judges
 * and in what order, the address the staging copy is written at, and the four judgements the seam
 * makes about a URL that nothing exercised until now — a padded expiry, a signature with a character
 * appended, the moment an expiry arrives, and a URL minted with another secret.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { makeStorage } from "../index";

const TENANT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SECRET = "unit-signing-secret";
const NOW = new Date("2026-09-01T00:00:00.000Z");
const BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const SHA256 = createHash("sha256").update(BYTES).digest("hex");

async function staged(secret = SECRET): Promise<{ root: string; storage: ReturnType<typeof makeStorage> }> {
  const root = await mkdtemp(join(tmpdir(), "cubit-storage-unit-"));
  return { root, storage: makeStorage({ root, signingSecret: secret, now: () => NOW }) };
}

describe("verify judges its own argument first", () => {
  test("an unusable `at` is a caller error, whatever the URL says", async () => {
    const { storage } = await staged();
    expect(() => storage.verify("not-a-signed-url", new Date(Number.NaN)), "the caller's broken clock is not reported as somebody else's bad URL").toThrow(TypeError);
    expect(storage.verify("not-a-signed-url", NOW), "far-side input never throws — it is simply not vouched for").toEqual({ ok: false, reason: "invalid" });
  });

  test("a URL behind an uppercase scheme is the same URL", async () => {
    const { storage } = await staged();
    const minted = storage.sign(TENANT, SHA256, { expiresInSeconds: 60 });
    const at = new Date(NOW.getTime() + 30_000);
    const vouched = { ok: true, tenantId: TENANT, sha256: SHA256 };
    expect(storage.verify(minted, at)).toEqual(vouched);
    expect(storage.verify(`https://cubit.example${minted}`, at), "an origin the signature does not cover changes nothing").toEqual(vouched);
    expect(storage.verify(`HTTPS://cubit.example${minted}`, at), "a scheme is case-insensitive (RFC 3986)").toEqual(vouched);
  });
});

describe("the judgements a minted URL is put to", () => {
  test("an expiry that has arrived has passed, and a second before it has not", async () => {
    const { storage } = await staged();
    const minted = storage.sign(TENANT, SHA256, { expiresInSeconds: 60 });
    expect(storage.verify(minted, new Date(NOW.getTime() + 59_000)).ok, "a URL is good up to its expiry").toBe(true);
    expect(storage.verify(minted, new Date(NOW.getTime() + 60_000)), "and refused at it").toEqual({ ok: false, reason: "expired" });
  });

  test("a padded expiry is not the text that was signed", async () => {
    const { storage } = await staged();
    const minted = storage.sign(TENANT, SHA256, { expiresInSeconds: 60 });
    const padded = minted.replace(/expires=(\d+)/, (_, expires: string) => `expires=0${expires}`);
    expect(storage.verify(padded, NOW), "one expiry, one spelling — a padded copy reads as the same number and is not the artefact this seam minted").toEqual({ ok: false, reason: "invalid" });
  });

  test("a signature with a character appended is not the signature", async () => {
    const { storage } = await staged();
    const minted = storage.sign(TENANT, SHA256, { expiresInSeconds: 60 });
    expect(storage.verify(`${minted}0`, NOW), "the signature is compared as the text it travels as: hex decoding would drop the unpaired nibble and vouch for a URL nobody signed").toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  test("a URL minted with another secret is not vouched for here", async () => {
    const elsewhere = await staged("a different deployment's secret");
    const here = await staged();
    expect(here.storage.verify(elsewhere.storage.sign(TENANT, SHA256, { expiresInSeconds: 60 }), NOW), "two seams with different secrets are two independent signers").toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("put stages at an address a caller can name", () => {
  test("a staging path already taken still stores the bytes", async () => {
    const { root, storage } = await staged();
    const staging = `${join(root, TENANT, SHA256)}.staging`;
    await mkdir(join(root, TENANT), { recursive: true });
    await writeFile(staging, "an earlier run left this behind", "utf8");

    expect((await storage.put(TENANT, BYTES)).sha256, "the address of the bytes is the digest of the bytes").toBe(SHA256);
    expect(Array.from((await storage.get(TENANT, SHA256)) ?? []), "and the bytes really are stored").toEqual(Array.from(BYTES));
  });

  test("a second put of identical bytes links nothing new and answers the same address", async () => {
    const { root, storage } = await staged();
    const first = await storage.put(TENANT, BYTES);
    const stored = await readFile(join(root, TENANT, first.sha256));
    expect((await storage.put(TENANT, BYTES)).sha256, "identical bytes have one address (R-SPINE-021)").toBe(first.sha256);
    expect(Array.from(await readFile(join(root, TENANT, first.sha256))), "…and an object that exists is never rewritten").toEqual(Array.from(stored));
  });

  test("puts of identical bytes racing at the shared staging address are all clean", async () => {
    // The staging copy's address is derived from the object's own, so every put of the same bytes
    // stages at ONE path: whichever links first settles the address and removes the copy the others
    // are still holding. Nothing went wrong in any of those puts — each answers the address, and the
    // operator's hook is for a staging copy that would not go away, not for one somebody else took.
    const cleanupFailures: unknown[] = [];
    const root = await mkdtemp(join(tmpdir(), "cubit-storage-race-"));
    const storage = makeStorage({
      root,
      signingSecret: SECRET,
      now: () => NOW,
      onCleanupFailure: (error: unknown) => {
        cleanupFailures.push(error);
      },
    });

    // Repeated over fresh bytes each round, because the interleaving that matters — a whole
    // link-and-unlink cycle finishing before another put reaches its own `link` — is the volume's
    // to choose, and one round of it proves nothing about the next.
    for (let round = 0; round < 20; round += 1) {
      const bytes = new Uint8Array([round, 1, 2, 3, 4, 5]);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const raced = await Promise.all([0, 1, 2, 3, 4, 5].map(async () => storage.put(TENANT, bytes)));
      expect(
        raced.map((stored) => stored.sha256),
        "every put of the same bytes answers the one address those bytes have",
      ).toEqual(raced.map(() => sha256));
      expect(Array.from((await storage.get(TENANT, sha256)) ?? []), "…and the bytes are stored").toEqual(Array.from(bytes));
    }
    expect(cleanupFailures, "a clean put never calls the hook, and two clean puts racing at the shared staging address are still two clean puts").toEqual([]);
  });

  test("a tenant id the tenancy seam did not mint never reaches the filesystem", async () => {
    const { storage } = await staged();
    for (const notATenant of ["", "..", "not-a-uuid", TENANT.toUpperCase()]) {
      await expect(storage.put(notATenant, BYTES), `put(${JSON.stringify(notATenant)})`).rejects.toBeInstanceOf(TypeError);
    }
  });
});
