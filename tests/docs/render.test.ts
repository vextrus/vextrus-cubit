/**
 * AC-2 (first half): BYTE-DETERMINISM. The committed proof payload renders through the pinned
 * renderer to the same bytes twice in one process and to the same bytes as the committed golden
 * PDF, under the pin package.json states — and the document says what it was given
 * (R-SPINE-040, L-FMT-03, AM-08).
 *
 * The golden is the yardstick a regeneration has to earn: a render that differs from it is either
 * a renderer that moved or a document that changed, and both are facts this lane exists to state.
 * Nothing here measures time (AM-10 §3, this increment's out-of-scope list).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pdfText } from "./support/pdf-text";
import { inTree, squashed } from "./support/product";
import { documentsIndex, type RenderedDocument } from "./support/seam";
import { filesUnder, withoutComments } from "./support/tree-source";

const PAYLOAD = "tests/docs/proof/payload.json";
const GOLDEN = "tests/docs/proof/golden.pdf";
/** Where the seam's own modules live — its suites judge it and are not it. */
const SEAM_ROOT = "src/core/documents";

/** What package.json pins the renderer at today (C-06's toolchain block, AM-08's two halves). */
const pinned = (): { version?: string; sha256?: string } => {
  // white-box: AC-2 — the criterion names the manifest as the SOURCE of the pin ("read from
  // package.json's `cubit.tools.typst`, never a literal in the seam"), so the expected pin is read
  // from it here rather than spelled: a literal in this test would freeze today's pin (B-19).
  const manifest = JSON.parse(readFileSync(inTree("package.json"), "utf8")) as { cubit?: { tools?: { typst?: { version?: string; sha256?: string } } } };
  return manifest.cubit?.tools?.typst ?? {};
};

const ctx = { requestId: "ac-2-request", actor: "acceptance" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** The committed payload, as the lane's fixture holds it. */
// white-box: AC-2 — this reads the lane's committed FIXTURE (tests/docs/proof/payload.json), which
// is the input the criterion names ("for the committed tests/docs/proof/payload.json"), not product
// source: it is what the seam is handed, and what the golden was rendered from.
const payload = (): unknown => JSON.parse(readFileSync(inTree(PAYLOAD), "utf8")) as unknown;

/**
 * The two renders, made once and awaited by every case. Lazy rather than a hook: a hook that
 * throws — because the seam is not written yet — leaves every case SKIPPED, and a skipped case
 * judges nothing (the pattern tests/server/exports-door.live.test.ts records).
 */
let rendering: Promise<{ first: RenderedDocument; second: RenderedDocument }> | undefined;
const rendered = (): Promise<{ first: RenderedDocument; second: RenderedDocument }> =>
  (rendering ??= (async () => {
    const { renderDocument } = await documentsIndex();
    return { first: await renderDocument("proof", payload(), ctx), second: await renderDocument("proof", payload(), ctx) };
  })());

describe("AC-2: byte-determinism", () => {
  it("AC-2: the same payload renders the same bytes twice in one process", async () => {
    const { first, second } = await rendered();
    expect(first.pdf.byteLength, "a render answers a PDF").toBeGreaterThan(0);
    expect(Buffer.from(second.pdf).equals(Buffer.from(first.pdf)), "the same payload and the same pin render byte-identically (R-SPINE-040)").toBe(true);
    expect(first.sha256, "the answer carries the sha256 of the bytes it answers").toBe(sha256(first.pdf));
    expect(second.payloadDigest, "the same payload digests the same both times").toBe(first.payloadDigest);
  });

  it("AC-2: the render is byte-identical to the committed golden PDF", async () => {
    const { first } = await rendered();
    expect(existsSync(inTree(GOLDEN)), `${GOLDEN} is committed, byte-frozen, in its own baseline: commit naming this proof`).toBe(true);
    // white-box: AC-2 — the criterion IS these bytes ("byte-identical to the committed golden
    // tests/docs/proof/golden.pdf, sha256 compared"): a golden is a committed artefact read to be
    // hashed, never source read as text, and it is the only witness that determinism holds ACROSS
    // processes rather than within one.
    const golden = new Uint8Array(readFileSync(inTree(GOLDEN)));
    expect(first.sha256, `the golden is what this payload renders to under the stated pin — regenerate it in a baseline: commit or the renderer moved`).toBe(sha256(golden));
  });

  it("AC-2: the renderer pin is the one package.json states, version and digest", async () => {
    const { first } = await rendered();
    const pin = pinned();
    expect(pin.version, "package.json pins the renderer's version (C-06, AM-08)").toBeTruthy();
    expect(pin.sha256, "package.json pins the renderer's sha256 (AM-08)").toBeTruthy();
    expect(first.rendererPin, "the pin travels with the document, as both halves of what the manifest pins").toBe(`typst ${pin.version} ${pin.sha256}`);
  });

  it("AC-2: the pin is READ from the manifest, never copied into the seam", () => {
    const pin = pinned();
    // The two values are read from the manifest as it stands NOW, so a lawful pin move under
    // AM-08/C-06 moves what this looks for with it — what is refused is a SECOND home for them.
    const digest = String(pin.sha256);
    const version = String(pin.version);
    expect(digest, "the manifest states a sha256 to be refused a second spelling of").toMatch(/^[0-9a-f]{64}$/u);

    // The seam's own modules; its suites judge the seam and may quote a pin as a fixture.
    // white-box: AC-2 — "never a literal in the seam" is a claim about every module of the seam, so
    // the seam's modules are what is enumerated here; each one's code is read below, with comments
    // blanked. No call can show a constant that answers exactly as a read does until the pin moves.
    const seam = filesUnder(SEAM_ROOT, [".ts"]).filter((file) => !file.includes("__tests__") && !file.endsWith(".test.ts"));
    expect(seam, "the document seam is in the tree").not.toEqual([]);

    // white-box: AC-2 — "read from package.json's `cubit.tools.typst` (version and sha256), never a
    // literal in the seam" is a property of the seam's SOURCE: a copied constant answers every
    // render exactly as a read does, and the two only part company on the day the pin moves — when
    // a copy stamps every document with a pin the machine no longer runs. Comments are blanked, so
    // recording the digest in prose (docs/toolchain/typst.md's recipe) is not a copy of it.
    const copies = seam.filter((file) => withoutComments(file).includes(digest));
    expect(copies, `the pinned digest is spelled in package.json and read from there — not in ${copies.join(", ")}`).toEqual([]);

    const restated = seam.filter((file) => withoutComments(file).includes(version));
    expect(restated, `and neither is the pinned version — ${restated.join(", ")} spells ${version} instead of reading it`).toEqual([]);
  });

  it("AC-2: the document says what the payload gave it, and says it is a draft", async () => {
    const { first } = await rendered();
    const text = squashed(pdfText(first.pdf));
    const given = payload() as { title: string; lines: { quantity: string }[] };
    expect(text, "the title is set on the page").toContain(given.title);
    expect(text, "the figure the payload carries is on the page").toContain(String(given.lines[0]?.quantity));
    expect(text, "an unsigned document says so in words, never by colour alone (L-FMT-03)").toContain("DRAFT — UNSIGNED");
  });
});
