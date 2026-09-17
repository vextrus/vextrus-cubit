/**
 * AC-3: THE FACES ARE VENDORED, PINNED BY HASH AND EMBEDDED, AND COVERAGE IS THE FACE'S OWN
 * (L-FMT-02, L-FMT-03, B-24, AM-08).
 *
 * Every artefact a document needs is in this tree (B-24), so the three static instances stand under
 * src/ui/fonts with their OFL text beside them; the render pins each by the sha256 of its bytes and
 * embeds it, which is what makes the same payload render to the same bytes anywhere; and the
 * repertoire a document is judged against is the FACE's own cmap, not a static range table — a code
 * point the tree admits elsewhere but no vendored face maps refuses by name rather than printing a
 * blank box.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { pdfFontNames } from "./support/pdf-text";
import { inTree } from "./support/product";
import { documentsIndex, fontsModule, typstModule, type RenderDeps, type RenderedDocument, type StagedRender } from "./support/seam";

const FONTS_DIR = "src/ui/fonts";
const PAYLOAD = "tests/docs/proof/payload.json";
const LICENCE_TEXT = "SIL Open Font License";
/** U+0995 BENGALI LETTER KA: inside the ranges src/core/format.ts admits, mapped by no vendored face. */
const UNCOVERED = "ক";

const ctx = { requestId: "ac-3-request", actor: "acceptance" };

// white-box: AC-3 — this reads the lane's committed FIXTURE (tests/docs/proof/payload.json), which
// is the input the criterion names, not product source: the payload is what the seam is handed.
const payload = (): Record<string, unknown> => JSON.parse(readFileSync(inTree(PAYLOAD), "utf8")) as Record<string, unknown>;

let rendering: Promise<RenderedDocument> | undefined;
const rendered = (): Promise<RenderedDocument> =>
  (rendering ??= (async () => {
    const { renderDocument } = await documentsIndex();
    return renderDocument("proof", payload(), ctx);
  })());

describe("AC-3: the document's faces", () => {
  it("AC-3: the three static faces are vendored with their licences beside them", async () => {
    const { DOCUMENT_FONT_FILES, DOCUMENT_FONT_LICENCES } = await fontsModule();
    expect([...DOCUMENT_FONT_FILES], "the faces a document sets: two sans weights and the mono figures' face").toEqual([
      "spline-sans-regular.ttf",
      "spline-sans-semibold.ttf",
      "spline-sans-mono-regular.ttf",
    ]);

    for (const file of DOCUMENT_FONT_FILES) {
      expect(existsSync(inTree(`${FONTS_DIR}/${file}`)), `${file} is vendored in this tree — a pointer outside it is a broken pointer (B-24)`).toBe(true);
      const licence = DOCUMENT_FONT_LICENCES[file];
      expect(licence, `${file} names the licence text that stands beside it`).toBeTruthy();
      // white-box: AC-3 — "its licence file beside (both containing `SIL Open Font License`)" is a
      // property of that text and of nothing a render can do; an embedded face carries its licence
      // because the file says so (L-FMT-03, B-24).
      const text = existsSync(inTree(`${FONTS_DIR}/${licence}`)) ? readFileSync(inTree(`${FONTS_DIR}/${licence}`), "utf8") : "";
      expect(text, `${licence} is the OFL text the embedded face is licensed under (L-FMT-03)`).toContain(LICENCE_TEXT);
    }
  });

  it("AC-3: the render pins every embedded face by the sha256 of its own bytes", async () => {
    const { DOCUMENT_FONT_FILES, documentFonts } = await fontsModule();
    const faces = await documentFonts();
    const document = await rendered();

    expect(Object.keys(document.fontHashes).sort(), "the document carries a hash for each face it embeds, and for no other").toEqual([...DOCUMENT_FONT_FILES].sort());
    for (const file of DOCUMENT_FONT_FILES) {
      // white-box: AC-3 — the criterion IS the bytes: "fontHashes maps each file name to the sha256
      // of that file's bytes". These are vendored binaries, read to be hashed, never read as text.
      const bytes = readFileSync(inTree(`${FONTS_DIR}/${file}`));
      const digest = createHash("sha256").update(bytes).digest("hex");
      expect(document.fontHashes[file], `${file} is pinned by the sha256 of the bytes that were embedded (L-FMT-03, AM-08)`).toBe(digest);
      expect(faces.find((face) => face.file === file)?.sha256, `documentFonts() computes ${file}'s hash from the same bytes`).toBe(digest);
    }
  });

  it("AC-3: the PDF embeds the vendored faces and no other", async () => {
    const document = await rendered();
    const names = pdfFontNames(document.pdf);
    expect(names, "a document that embedded nothing would render as somebody else's fonts elsewhere (L-FMT-03)").not.toEqual([]);
    for (const name of names) {
      expect(name, `${name} is one of the vendored Spline Sans instances`).toContain("SplineSans");
    }
  });

  it("AC-3: the subprocess is told to use those faces and nothing the machine happens to hold", async () => {
    const { TYPST_ARGS } = await typstModule();
    const args = [...TYPST_ARGS];
    expect(args, "the machine's own font directories are not the document's (B-24)").toContain("--ignore-system-fonts");
    expect(args, "the faces come from the tree").toContain("--font-path");
    expect(args, "the document carries no creation time, or the same payload would not render to the same bytes").toContain("--creation-timestamp");
    expect(args, "and that time is zero").toContain("0");
  });

  it("AC-3: a code point no vendored face maps is refused by name, before the renderer", async () => {
    const { renderDocument } = await documentsIndex();
    const compiled: StagedRender[] = [];
    const deps: RenderDeps = {
      compile: async (staged) => {
        compiled.push(staged);
        return new Uint8Array();
      },
    };
    const given = payload();
    const asked = { ...given, title: `${String(given["title"])} ${UNCOVERED}` };

    const failure = await renderDocument("proof", asked, ctx, deps).then(
      (answered) => answered as unknown,
      (thrown: unknown) => thrown,
    );

    expect(refusalCodeOf(failure), "a document never renders a character as a blank box (L-FMT-02)").toBe("CHARACTER_NOT_COVERED");
    expect(String((failure as { message?: unknown }).message), "the refusal names the code point the faces do not map").toContain("U+0995");
    expect(compiled, "the coverage question is answered before the subprocess is reached, and no PDF is made").toEqual([]);
  });
});
