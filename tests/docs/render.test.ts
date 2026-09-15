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

const PAYLOAD = "tests/docs/proof/payload.json";
const GOLDEN = "tests/docs/proof/golden.pdf";

const ctx = { requestId: "ac-2-request", actor: "acceptance" };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** The committed payload, as the lane's fixture holds it. */
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
    const golden = new Uint8Array(readFileSync(inTree(GOLDEN)));
    expect(first.sha256, `the golden is what this payload renders to under the stated pin — regenerate it in a baseline: commit or the renderer moved`).toBe(sha256(golden));
  });

  it("AC-2: the renderer pin is the one package.json states, version and digest", async () => {
    const { first } = await rendered();
    const manifest = JSON.parse(readFileSync(inTree("package.json"), "utf8")) as { cubit?: { tools?: { typst?: { version?: string; sha256?: string } } } };
    const pinned = manifest.cubit?.tools?.typst;
    expect(pinned?.version, "package.json pins the renderer's version (C-06, AM-08)").toBeTruthy();
    expect(pinned?.sha256, "package.json pins the renderer's sha256 (AM-08)").toBeTruthy();
    expect(first.rendererPin, "the pin travels with the document, read from the manifest and never spelled in the seam").toBe(`typst ${pinned?.version} ${pinned?.sha256}`);
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
