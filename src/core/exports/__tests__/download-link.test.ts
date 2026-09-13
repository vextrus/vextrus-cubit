// What a signed download link is worth, asked of the seam that decides it (R-SPINE-041, Q-12).
//
// The three EXPORT_* refusals are registered by this area (`@/core/errors/exports`) and answered by
// `readSignedExport`, so they are exercised by name here — beside the code that decides them, over a
// real local storage on a scratch root, with no database and no door in the way (Q-07).
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readSignedExport, type SignedLink } from "@/core/exports";
import { makeStorage, type Storage } from "@/core/storage";

/** The scratch roots this file wrote under, taken away when it is done with them. */
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/** A signing secret nobody shares, so "this installation signed it" has teeth. */
const secret = (): string => `export-link-secret-${randomUUID()}`;

/** A local storage over a private root, with its clock injected so an expiry can be walked past. */
async function storageOver(options: { signingSecret: string; now?: () => Date }): Promise<Storage> {
  const root = await mkdtemp(join(tmpdir(), "cubit-exports-"));
  roots.push(root);
  return makeStorage({ root, signingSecret: options.signingSecret, ...(options.now === undefined ? {} : { now: options.now }) });
}

/** The parts of a minted link, read off the URL the storage seam signed rather than re-derived. */
function partsOf(storage: Storage, tenantId: string, sha256: string, expiresInSeconds: number): SignedLink {
  const signed = new URL(storage.sign(tenantId, sha256, { expiresInSeconds }), "http://exports.invalid");
  return {
    tenantId,
    sha256,
    expires: signed.searchParams.get("expires") ?? "",
    signature: signed.searchParams.get("signature") ?? "",
  };
}

const BYTES = new TextEncoder().encode("Item,Quantity\r\nConcrete M25,12345.678\r\n");

describe("the export seam answers a signed link with the bytes, or with its own refusal", () => {
  it("serves the stored bytes for a link this installation signed", async () => {
    const storage = await storageOver({ signingSecret: secret() });
    const tenantId = randomUUID();
    const { sha256 } = await storage.put(tenantId, BYTES);

    const read = await readSignedExport(storage, partsOf(storage, tenantId, sha256, 900));
    expect(read.ok, "a live, correctly signed link is answered with the artefact").toBe(true);
    expect(read.ok ? read.bytes : null, "the bytes are the stored bytes, unchanged").toEqual(BYTES);
  });

  it("refuses a tampered signature as EXPORT_URL_INVALID", async () => {
    const storage = await storageOver({ signingSecret: secret() });
    const tenantId = randomUUID();
    const { sha256 } = await storage.put(tenantId, BYTES);
    const minted = partsOf(storage, tenantId, sha256, 900);

    // One digit of the signature turned: nothing else about the link changes, so what is refused is
    // the signature and not the address.
    const tampered: SignedLink = { ...minted, signature: `${minted.signature.slice(0, -1)}${minted.signature.endsWith("0") ? "1" : "0"}` };
    const read = await readSignedExport(storage, tampered);
    expect(read.ok ? "served" : read.refusal, "a link this installation did not sign is a forgery").toBe("EXPORT_URL_INVALID");
  });

  it("refuses a link whose hour has passed as EXPORT_URL_EXPIRED", async () => {
    const signingSecret = secret();
    const minted = new Date("2026-01-01T00:00:00.000Z");
    const storage = await storageOver({ signingSecret, now: () => minted });
    const tenantId = randomUUID();
    const { sha256 } = await storage.put(tenantId, BYTES);
    const link = partsOf(storage, tenantId, sha256, 900);

    // The same installation, the same secret and the same link — read a second past its expiry. An
    // expiry is a link that WAS good, which is a different fact from a forgery.
    const later = await storageOver({ signingSecret, now: () => new Date(minted.getTime() + 901_000) });
    const read = await readSignedExport(later, link);
    expect(read.ok ? "served" : read.refusal, "a link past its expiry is expired, not invalid").toBe("EXPORT_URL_EXPIRED");
  });

  it("refuses a correctly signed address nothing is stored at as EXPORT_NOT_FOUND", async () => {
    const storage = await storageOver({ signingSecret: secret() });
    const tenantId = randomUUID();
    const nothing = "0".repeat(64);

    const read = await readSignedExport(storage, partsOf(storage, tenantId, nothing, 900));
    expect(read.ok ? "served" : read.refusal, "a live link to an address this workspace stored nothing at").toBe("EXPORT_NOT_FOUND");
  });
});
