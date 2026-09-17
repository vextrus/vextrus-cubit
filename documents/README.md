# Documents — the page every issued document is set on

This directory holds the Typst source shared by every document kind: the page frame, the
`draft-unsigned-banner` macro, the lockup and the quiet watermark. A KIND's own template lives beside
its kind file in `src/core/documents/kinds/<kind>.typ`; only what every kind shares is here.

Nothing in this directory is compiled in place. `stageRender` (`src/core/documents/typst.ts`) copies
it into a temporary directory per invocation, lays the canonical `payload.json` beside it, copies the
brand mark in as `base/mark.svg`, and roots the renderer at that directory — so a template reaches the
shared frame at `/base/frame.typ` and its own datum at `payload.json`, the sibling `stageRender` wrote
for it, and both resolve inside the staging tree and reach nothing else on the volume. The directory
is removed in a `finally`, whether the render answered or threw.

## What a template may and may not do

- **Read the payload with `json()`, and set its values as content.** Strings cross as DATA
  (L-FMT-03). A title of `#text(red)[x]` or `#import "/main.typ"` is SET, not run, because nothing in
  this seam builds source around a payload. That property is why the payload crosses as a file.
- **Print figures as they arrive.** A figure is formatted once, in `src/core/documents/figures.ts`,
  grouped lakh/crore and at exactly its kind's stated precision; a template that re-formatted one
  would be a second answer to how this product writes a number (L-FMT-02, B-17).
- **Render a unit from the enum, separately from its quantity** (L-FMT-02). Two columns, never one
  string. Compact `L`/`Cr` never appears on a document.
- **Never ask what day it is.** No template of this product calls the template language's
  today-function, and a scan of the template source says so (R-SPINE-040). A clock in the output is a
  document that does not render to the same bytes twice. What a document says about WHEN is a field
  of its payload.
- **Never signal by colour alone** (L-FMT-03). The draft banner says `DRAFT — UNSIGNED` in words; the
  tint behind it carries nothing the words do not.

## Two things that are load-bearing and easy to undo

**The watermark is the page's `background`, so it marks every leaf.** A bill of quantities runs to
many pages, and a watermark drawn into the body would stop after the first. A background is emitted
as a marked-content artifact carrying the page box as an array, ahead of everything the page says —
which is legible to the reader V-DOCS reads a document back with (`tests/docs/support/pdf-text.ts`)
because that reader walks text objects and tokenises operands in order, so the face in hand is always
the one the `Tf` before the operator selected. A reader that instead scanned the whole stream for the
first `[ … ] TJ` would swallow that `Tf` and hand back the title as raw glyph codes.

**Both font flags are given.** `--ignore-system-fonts` excludes what the box has installed;
`--ignore-embedded-fonts` excludes what the renderer ships inside itself. Without the second, a glyph
the vendored faces lack is set silently in one of Typst's built-in families — a document embedding a
face nobody vendored, licensed or pinned by hash (B-24, L-FMT-03).

## The lane

`pnpm test:docs` (`scripts/docs-test.mjs`, `tests/docs/vitest.config.ts`) is V-DOCS (AM-18). It
renders the committed payloads, asserts byte-identity against the committed golden PDFs, extracts the
text, and checks font coverage. It measures nothing: V-DOCS asserts documents, never durations
(AM-10 §3). A regenerated golden goes in its own `baseline:`-subject commit naming the proof.
