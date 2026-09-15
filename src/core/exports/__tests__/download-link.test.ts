// The four answers a download link earns, decided where they are registered (R-SPINE-062, Q-12).
//
// `readSignedExport` is the whole decision: the door above it only gives each answer an HTTP status,
// so this is where the three EXPORT_* refusals are exercised by name — over a real SEAM-STORAGE on a
// scratch directory, with its clock injected, because "expired" is a fact about a clock and a faked
// one would prove nothing about the seam that mints the link.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeStorage, type Storage } from "@/core/storage";
import { buildWorkbook, exportDownloadUrl, readSignedExport, storeExport, storedKindOf, writeCsv } from "@/core/exports";

/** The workspace these artefacts are stored under: a canonical id, as a prefix has to be. */
const TENANT = randomUUID();

/** The lifetime every link in this suite is minted for. */
const LIFETIME_SECONDS = 900;

/** A small artefact, written by the seam itself rather than invented beside it. */
const BYTES = writeCsv({
  name: "Bill",
  freezeHeader: true,
  columns: [{ key: "item", header: "Item", kind: "text" }],
  rows: [["Concrete M25"]],
});

/** A moment the whole suite is judged from, so "expired" is a step this test takes deliberately. */
const MINTED_AT = new Date("2025-04-01T10:00:00.000Z");

/** The seam over a scratch root, signing with a secret of this run's own, at a clock we move. */
function staged(): { storage: Storage; at: (moment: Date) => void } {
  let now = MINTED_AT;
  const storage = makeStorage({
    root: mkdtempSync(join(tmpdir(), "cubit-export-link-")),
    signingSecret: `link-${randomUUID()}`,
    now: () => now,
  });
  return {
    storage,
    at: (moment: Date) => {
      now = moment;
    },
  };
}

/** The fields a presented link carries, read back off the URL a browser was handed. */
function presented(url: string): { tenantId: string; sha256: string; expires: string; signature: string } {
  const parsed = new URL(url, "https://cubit.example");
  return {
    tenantId: parsed.searchParams.get("tenant") ?? "",
    sha256: parsed.pathname.slice(parsed.pathname.lastIndexOf("/") + 1),
    expires: parsed.searchParams.get("expires") ?? "",
    signature: parsed.searchParams.get("signature") ?? "",
  };
}

describe("a signed export link is answered with the bytes it names, or with the refusal it earned", () => {
  it("answers the stored bytes to a link this workspace minted", async () => {
    const { storage } = staged();
    const { sha256 } = await storeExport(storage, TENANT, BYTES);
    const link = exportDownloadUrl(storage, { tenantId: TENANT, sha256, kind: "csv", expiresInSeconds: LIFETIME_SECONDS });

    const read = await readSignedExport(storage, presented(link));
    expect(read.ok, "a link the storage seam signed is one it vouches for").toBe(true);
    expect(read.ok ? read.bytes : null, "the answer is the bytes stored at the address the link names").toEqual(BYTES);
  });

  it("refuses EXPORT_URL_INVALID a link this workspace did not issue", async () => {
    const { storage } = staged();
    const { sha256 } = await storeExport(storage, TENANT, BYTES);
    const link = presented(exportDownloadUrl(storage, { tenantId: TENANT, sha256, kind: "csv", expiresInSeconds: LIFETIME_SECONDS }));

    // A signature of the right shape and the wrong value, and an expiry moved after it was signed:
    // both are somebody rewriting a link, and neither may open an artefact (Q-12).
    const forged = { ...link, signature: link.signature.replace(/^./u, (first) => (first === "0" ? "1" : "0")) };
    expect(await readSignedExport(storage, forged)).toEqual({ ok: false, refusal: "EXPORT_URL_INVALID" });
    expect(await readSignedExport(storage, { ...link, expires: String(Number(link.expires) + 60) })).toEqual({
      ok: false,
      refusal: "EXPORT_URL_INVALID",
    });
    // And an address that is not an address at all is refused rather than raised: what a browser
    // presents is far-side input, whatever it says.
    expect(await readSignedExport(storage, { ...link, sha256: "not-an-address" })).toEqual({ ok: false, refusal: "EXPORT_URL_INVALID" });
    expect(await readSignedExport(storage, { ...link, tenantId: "../elsewhere" })).toEqual({ ok: false, refusal: "EXPORT_URL_INVALID" });
  });

  it("refuses EXPORT_URL_EXPIRED a link whose hour has passed", async () => {
    const { storage, at } = staged();
    const { sha256 } = await storeExport(storage, TENANT, BYTES);
    const link = presented(exportDownloadUrl(storage, { tenantId: TENANT, sha256, kind: "csv", expiresInSeconds: LIFETIME_SECONDS }));

    at(new Date(MINTED_AT.getTime() + (LIFETIME_SECONDS - 1) * 1000));
    expect((await readSignedExport(storage, link)).ok, "a second before its expiry the link still opens").toBe(true);

    at(new Date(MINTED_AT.getTime() + (LIFETIME_SECONDS + 1) * 1000));
    expect(await readSignedExport(storage, link), "a signed URL expires (Q-12)").toEqual({ ok: false, refusal: "EXPORT_URL_EXPIRED" });
  });

  it("refuses EXPORT_NOT_FOUND a good link to an address nothing is stored at", async () => {
    const { storage } = staged();
    // The address of bytes this workspace never stored — a real digest, of a real artefact, that
    // simply went nowhere. The link is this seam's own and verifies; there is nothing behind it.
    const unstored = await storeExport(makeStorage({ root: mkdtempSync(join(tmpdir(), "cubit-export-elsewhere-")), signingSecret: "elsewhere" }), TENANT, BYTES);
    const link = exportDownloadUrl(storage, { tenantId: TENANT, sha256: unstored.sha256, kind: "csv", expiresInSeconds: LIFETIME_SECONDS });

    expect(await readSignedExport(storage, presented(link))).toEqual({ ok: false, refusal: "EXPORT_NOT_FOUND" });
  });
});

describe("the kind a link claims is checked against the kind the artefact IS", () => {
  it("reads a workbook the seam built as xlsx, and everything the seam wrote as csv as csv", async () => {
    // Both sides are written by the seam rather than invented here: the rule has to hold for the
    // artefacts this product actually stores, not for a blob shaped like one (R-SPINE-041).
    const workbook = await buildWorkbook({
      sheets: [{ name: "Bill", freezeHeader: true, columns: [{ key: "item", header: "Item", kind: "text" }], rows: [["Concrete M25"]] }],
    });
    expect(storedKindOf(workbook), "an OOXML package is a zip, and a zip is what an .xlsx is").toBe("xlsx");
    expect(storedKindOf(BYTES), "a CSV is text and carries neither end of a zip").toBe("csv");
  });

  it("still reads a bill whose first column header begins PK as csv", () => {
    // "PK" is ASCII and a header sits at the front of a CSV, so the two letters alone would refuse a
    // link this workspace really did mint and leave a lawful artefact undownloadable at its own
    // address (Q-12). What text cannot counterfeit is the control bytes on either end of a zip.
    for (const header of ["PKG", "PKR", "PK"]) {
      const bill = writeCsv({ name: "Bill", freezeHeader: true, columns: [{ key: "item", header, kind: "text" }], rows: [["Concrete M25"]] });
      expect(storedKindOf(bill), `a bill whose first column is ${header} is still a CSV`).toBe("csv");
    }
  });

  it("calls neither half of a zip a package on its own", () => {
    // An entry header with nothing closing behind it is a truncated or forged package, and a closing
    // record with no entry in front of it is not one either: the door serves what it can name.
    expect(storedKindOf(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe("csv");
    expect(storedKindOf(Uint8Array.from([0x69, 0x64, 0x50, 0x4b, 0x05, 0x06]))).toBe("csv");
    expect(storedKindOf(new Uint8Array(0)), "an empty artefact is no package").toBe("csv");
  });
});
