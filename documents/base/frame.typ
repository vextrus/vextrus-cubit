// The page every document of this product is set on (R-SPINE-040, L-FMT-03).
//
// One frame, imported by every kind: the page size and margins, the faces, the running footer, the
// light lockup and the quiet watermark. A kind supplies its own body and nothing about the paper.
//
// NO CLOCK. Nothing here asks the renderer what day it is: the template language's today-function
// appears in no `.typ` of this product, and a scan of the template source says so (R-SPINE-040). A
// document that read the clock would not render to the same bytes twice, and byte-determinism is
// what the golden PDF is a yardstick for. What a document says about WHEN is a field of its payload,
// supplied by the caller who issued it.
//
// NO COLOUR-ONLY SIGNALS (L-FMT-03). The draft banner says "DRAFT — UNSIGNED" in words; the tint
// behind it carries nothing the words do not.

// The faces, by the family names the vendored files provide (src/core/documents/fonts.ts). They are
// found through `--font-path src/ui/fonts` with the machine's own fonts and the renderer's built-in
// ones both excluded, so these names resolve to the vendored bytes or to nothing at all.
#let body-face = "Spline Sans"
#let mono-face = "Spline Sans Mono"

// Ink, rule, paper and tint. Stated once here so a kind never spells a colour.
#let ink = rgb("#1b1b1f")
#let quiet = rgb("#6b6b76")
#let rule = rgb("#d8d8de")
#let draft-tint = rgb("#f4f2ea")
#let page-fill = rgb("#ffffff")

/// The no-spark mark, set quietly. The spark never stands beside a draft (the Design Decision), so
/// every document of this product uses the no-spark mark and this is the only place it is named.
#let mark(height: 9mm) = image("/base/mark.svg", height: height)

/// The watermark: the same mark, large and very faint, behind everything the page says. It marks the
/// paper as this product's without competing with a single word on it.
///
/// It is veiled rather than faded because the renderer gives an image no opacity of its own: the mark
/// is drawn at size and then covered by the page's own colour at a high alpha, which composites to
/// the same quiet grey wherever it is rendered — and, being a fill, is as deterministic as the mark.
///
/// It is placed in the BODY rather than set as the page's `background`. A page background is emitted
/// as a marked-content artifact carrying the page box as an array, and that array stands in the
/// content stream ahead of the first text-showing operator — where it defeats the text extraction
/// V-DOCS reads a document back with (tests/docs/support/pdf-text.ts), costing the first run on the
/// page its font map. A watermark is not worth an unreadable title.
#let watermark() = place(
  center + horizon,
  float: false,
  box(width: 110mm, height: 110mm)[
    #mark(height: 110mm)
    #place(top + left, rect(width: 100%, height: 100%, fill: page-fill.transparentize(12%)))
  ],
)

/// The lockup: the mark beside the product's name, in the light form a white page asks for.
#let lockup() = box(baseline: 30%)[
  #grid(
    columns: (auto, auto),
    column-gutter: 2.5mm,
    align: horizon,
    mark(height: 7mm),
    text(size: 12pt, weight: "semibold", fill: ink)[Vextrus Cubit],
  )
]

/// The banner an unsigned document carries. IN WORDS: L-FMT-03 forbids signalling by colour alone,
/// so the sentence is the signal and the tint is only paper.
#let draft-unsigned-banner() = block(
  width: 100%,
  inset: (x: 4mm, y: 2.5mm),
  radius: 1mm,
  fill: draft-tint,
  stroke: 0.5pt + rule,
)[
  #text(size: 10pt, weight: "semibold", fill: ink)[DRAFT — UNSIGNED]
  #linebreak()
  #text(size: 8.5pt, fill: quiet)[This document has not been issued. It states no approved quantity and carries no signature.]
]

/// The page frame. `title` and `subtitle` are DATA the caller read out of its payload — they are set
/// as content, never spliced into markup, because nothing in this product builds a template out of a
/// payload (L-FMT-03).
#let document-frame(title: "", subtitle: "", body) = {
  set document(title: title, author: "Vextrus Cubit")
  set page(
    paper: "a4",
    fill: page-fill,
    margin: (top: 22mm, bottom: 20mm, x: 18mm),
    footer: context [
      #set text(size: 8pt, fill: quiet, font: body-face)
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        [Vextrus Cubit],
        [#counter(page).display("1") / #counter(page).final().first()],
      )
    ],
  )
  set text(font: body-face, size: 10pt, fill: ink, lang: "en")
  set par(justify: false, leading: 0.62em)

  watermark()
  grid(
    columns: (1fr, auto),
    align: (left + horizon, right + horizon),
    [
      #text(size: 16pt, weight: "semibold")[#title]
      #if subtitle != "" [
        #linebreak()
        #text(size: 10pt, fill: quiet)[#subtitle]
      ]
    ],
    lockup(),
  )
  v(3mm)
  line(length: 100%, stroke: 0.6pt + rule)
  v(4mm)
  draft-unsigned-banner()
  v(5mm)
  body
}

/// A figure column's cell: the mono face, right-aligned, tabular. A figure arrives ALREADY formatted
/// — grouped and at its kind's precision — because formatting is `src/core/documents/figures.ts`'s
/// and a template that re-formatted one would be a second answer to how this product writes a number.
#let figure-cell(value) = align(right, text(font: mono-face, size: 9.5pt)[#value])

/// An identifier's cell: the mono face, left-aligned, so references line up down the column.
#let id-cell(value) = align(left, text(font: mono-face, size: 9.5pt)[#value])

/// A unit's cell. The unit is rendered from the enum and SEPARATELY from its quantity (L-FMT-02), so
/// it is its own column and never part of the figure beside it.
#let unit-cell(value) = align(left, text(size: 9.5pt, fill: quiet)[#value])

/// A table header cell.
#let head-cell(value) = text(size: 8.5pt, weight: "semibold", fill: quiet)[#upper(value)]
