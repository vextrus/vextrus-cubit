/**
 * SEAM-STORAGE (R-SPINE-021): the two answers the volume gives a put whose staging copy is shared
 * with a concurrent put of the same bytes — `link` finding its source already gone, and `unlink`
 * finding the copy already removed. Both are the winner's cleanup seen from the loser's side, and
 * neither is a failure of the put they happen in.
 *
 * A real race chooses its own interleaving, so the arms are driven by substituting the volume: the
 * substitution is graded before it grades anything, and it passes everything else through untouched.
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

/** The answer `link` gives, or null for the real filesystem's. */
const volume = vi.hoisted(() => ({ linkFailure: null as null | Error }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const link = async (from: Parameters<typeof actual.link>[0], to: Parameters<typeof actual.link>[1]): Promise<void> => {
    if (volume.linkFailure !== null) throw volume.linkFailure;
    return actual.link(from, to);
  };
  return { ...actual, link, default: { ...actual, link } };
});

afterEach(() => {
  volume.linkFailure = null;
});

const TENANT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SECRET = "unit-signing-secret";
const NOW = new Date("2026-09-01T00:00:00.000Z");
const BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const SHA256 = createHash("sha256").update(BYTES).digest("hex");

/** An error the volume raises, carrying the `code` the seam reads it by. */
const volumeError = (code: string, said: string): Error => Object.assign(new Error(said), { code });

async function staged(): Promise<{ root: string; storage: ReturnType<typeof import("../index").makeStorage>; cleanupFailures: unknown[] }> {
  const { makeStorage } = await import("../index");
  const root = await mkdtemp(join(tmpdir(), "cubit-storage-link-race-"));
  const cleanupFailures: unknown[] = [];
  return {
    root,
    storage: makeStorage({
      root,
      signingSecret: SECRET,
      now: () => NOW,
      onCleanupFailure: (error: unknown) => {
        cleanupFailures.push(error);
      },
    }),
    cleanupFailures,
  };
}

describe("a put whose staging copy a concurrent put already consumed", () => {
  test("the substituted volume is the one the seam is wired to", async () => {
    const { storage } = await staged();
    volume.linkFailure = volumeError("EXDEV", "unit: the staging copy and its address are on different devices");
    await expect(storage.put(TENANT, BYTES), "the stand-in `link` is what the seam calls, and a failure that is not the race's still reaches the caller").rejects.toBe(
      volume.linkFailure,
    );
  });

  test("ENOENT from link with the address already settled is the race, and the put answers the address", async () => {
    const { storage } = await staged();
    // The winner's whole cycle finished first: the bytes stand at their address and the shared
    // staging copy is gone, so this put's `link` resolves its source and finds nothing there.
    await storage.put(TENANT, BYTES);
    volume.linkFailure = volumeError("ENOENT", "unit: the shared staging copy was linked and removed by a concurrent put");

    const stored = await storage.put(TENANT, BYTES);
    expect(stored.sha256, "the address these bytes have is settled — by this put or by the one that raced it, which is the same address").toBe(SHA256);
    expect(Array.from((await storage.get(TENANT, SHA256)) ?? []), "…and the bytes really are there").toEqual(Array.from(BYTES));
  });

  test("ENOENT from link with nothing at the address is a story the caller hears", async () => {
    const { root, storage } = await staged();
    // Nothing is stored, so ENOENT is not the race: it is the volume saying a path this put needed
    // is not there, and absorbing it would answer an address that holds nothing.
    await rm(join(root, TENANT), { recursive: true, force: true });
    const failure = volumeError("ENOENT", "unit: the volume lost the path");
    volume.linkFailure = failure;
    await expect(storage.put(TENANT, BYTES), "the address is asked about, never assumed").rejects.toBe(failure);
  });

  test("a staging copy already removed is cleanup that happened, not cleanup that failed", async () => {
    const { storage, cleanupFailures } = await staged();
    volume.linkFailure = null;
    await storage.put(TENANT, BYTES);
    await storage.put(TENANT, BYTES);
    expect(cleanupFailures, "the operator's hook is for a copy that would not go away").toEqual([]);
  });
});
