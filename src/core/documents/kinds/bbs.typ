// The `bbs` kind's document: a campaign's bill of bars, each mark stated once per floor with its
// number of members, the shape each bar is bent to DRAWN beside its code (R-TO-054, A-BBS-PDF, AM-01,
// AM-03, AM-05; s-bbs I-534, I-535, I-536).
//
// THE SKETCHES ARE DRAWN, NEVER IMAGED. Every BS 8666 shape this tree details in is answered by a
// few strokes of the page's own ink — no raster, no SVG, no library file: a schedule is read at a
// glance by the shape of the bar, and a picture pasted in would be a second answer to what a shape
// code means. The dispatch below holds one branch per code of `SHAPE_CODES`, and the code itself is
// printed beside its sketch because a BS 8666 code is the domain's own name for the shape (I-bbs-6).
//
// ONE TABLE, READ ACROSS, ITS WIDTHS TAKEN FROM WHAT IT HOLDS (I-535). The whole schedule is one
// table on a landscape leaf, its column band repeated at the head of every page, each entry a
// subheader across it. Every column but the legs is `auto` — as wide as the widest thing it holds,
// header or figure — so no figure is ever set into a column narrower than itself and printed over its
// neighbour; the legs take what is left. Headers are set as written, units in lower case.
//
// WHAT IT DOES NOT SAY. Nothing here is signed, so the frame prints `DRAFT — UNSIGNED` on every leaf
// and the document names no surveyor, no credential and no certificate (AM-05); the sign-off box is
// ruled paper for the site's own hand. It prints no id, key or enum word (R-UI-082), and it states no
// figure it was not given: every number and every word arrives already written by the kind's
// presenter, and this template computes and re-formats nothing (L-FMT-02, L-FMT-03).
#import "/base/frame.typ": document-frame, id-cell, ink, mono-face, particulars-block, quiet, rule, sign-off-block

#let payload = json("payload.json")

// The ink a sketch is drawn in: the page's own, like every other colour here — a kind spells none.
#let wire = 0.6pt + ink

/// A column heading, as written: a schedule's headers carry their units in the case the units are
/// spelled in, so `(mm)` is never shouted as `(MM)` (L-FMT-01).
#let head(value) = text(size: 7.5pt, weight: "semibold", fill: quiet)[#value]

/// The shape, drawn. One branch per code of `SHAPE_CODES` (`src/core/rulesets/methods/rebar/
/// bs8666.ts`): a straight bar, a bar with one bend, a staple with two, a closed link, a spiral, and
/// the two cranked bars the site's own marks spell. A code with no sketch would be a schedule a
/// steel-fixer cannot read (A-BBS-PDF).
#let sketch(code) = box(width: 17mm, height: 7mm, {
  if code == "00" {
    // A straight bar.
    place(dx: 1mm, dy: 3.5mm, line(length: 15mm, stroke: wire))
  } else if code == "11" {
    // One bend: a leg turned up at the far end.
    place(dx: 1mm, dy: 5.5mm, line(length: 14mm, stroke: wire))
    place(dx: 15mm, dy: 1.5mm, line(length: 4mm, angle: 90deg, stroke: wire))
  } else if code == "21" {
    // Two bends: a staple, legs turned up at both ends.
    place(dx: 2mm, dy: 5.5mm, line(length: 13mm, stroke: wire))
    place(dx: 2mm, dy: 1.5mm, line(length: 4mm, angle: 90deg, stroke: wire))
    place(dx: 15mm, dy: 1.5mm, line(length: 4mm, angle: 90deg, stroke: wire))
  } else if code == "51" {
    // A closed link: four sides, drawn as the tie a reader sees on the section.
    place(dx: 3mm, dy: 1.5mm, line(length: 11mm, stroke: wire))
    place(dx: 3mm, dy: 5.5mm, line(length: 11mm, stroke: wire))
    place(dx: 3mm, dy: 1.5mm, line(length: 4mm, angle: 90deg, stroke: wire))
    place(dx: 14mm, dy: 1.5mm, line(length: 4mm, angle: 90deg, stroke: wire))
  } else if code == "SP" {
    // A spiral, seen from the side: the pitch drawn as a run of slopes.
    place(dx: 2mm, dy: 1.5mm, line(length: 4.5mm, angle: 62deg, stroke: wire))
    place(dx: 5mm, dy: 1.5mm, line(length: 4.5mm, angle: 62deg, stroke: wire))
    place(dx: 8mm, dy: 1.5mm, line(length: 4.5mm, angle: 62deg, stroke: wire))
    place(dx: 11mm, dy: 1.5mm, line(length: 4.5mm, angle: 62deg, stroke: wire))
    place(dx: 2mm, dy: 1.5mm, line(length: 12mm, stroke: wire))
    place(dx: 2mm, dy: 5.5mm, line(length: 12mm, stroke: wire))
  } else if code == "CT" {
    // A cranked bar: a run, a slope, and a run at the new level.
    place(dx: 1mm, dy: 5mm, line(length: 6mm, stroke: wire))
    place(dx: 7mm, dy: 5mm, line(length: 4.5mm, angle: -45deg, stroke: wire))
    place(dx: 10mm, dy: 2mm, line(length: 6mm, stroke: wire))
  } else if code == "CRK" {
    // A crank: down and back up again, so the bar returns to the level it left.
    place(dx: 1mm, dy: 2mm, line(length: 4mm, stroke: wire))
    place(dx: 5mm, dy: 2mm, line(length: 4.2mm, angle: 45deg, stroke: wire))
    place(dx: 8mm, dy: 5mm, line(length: 3mm, stroke: wire))
    place(dx: 11mm, dy: 5mm, line(length: 4.2mm, angle: -45deg, stroke: wire))
    place(dx: 14mm, dy: 2mm, line(length: 2mm, stroke: wire))
  }
})

/// The shape cell: the sketch, with the code under it in the mono face. Both, because a sketch says
/// what a bar looks like and the code says which schedule row it is (I-bbs-6).
#let shape-cell(code) = if code == "" { [] } else {
  block(breakable: false)[
    #sketch(code)
    #text(size: 8pt, font: mono-face, fill: quiet)[#code]
  ]
}

/// A figure, in the schedule's size: mono, right-aligned, tabular — and never broken across a line.
#let fig(value) = align(right, box(text(font: mono-face, size: 8.5pt)[#value]))

/// The number of columns the schedule is read across; an entry's heading spans all of them.
#let across = 11

/// An entry's heading: its mark, its class and its floor, in words, with its number of members beside
/// — the group every line beneath it belongs to (R-TO-054, I-534). It is a SUBHEADER of the one table:
/// the column band stands over every entry, an entry that runs onto the next page is headed there
/// again, and a heading is never left alone at the foot of a page with its lines overleaf.
/// An entry whose laps are not stated says, under its heading, that its bars are storey-height runs
/// and not for cutting (I-567): the lengths below are a quantity to weigh, not a cut list.
#let entry-heading(entry) = table.header(
  level: 2,
  table.cell(colspan: across, inset: (x: 1.4mm, top: 2.6mm, bottom: 1.2mm))[
    #grid(
      columns: (1fr, auto),
      align: (left + bottom, right + bottom),
      text(size: 9.5pt, weight: "semibold", fill: ink)[#entry.heading],
      text(size: 8.5pt, fill: quiet)[#entry.members],
    )
    #if entry.run != "" [
      #v(0.6mm)
      #text(size: 8.5pt, style: "italic", fill: quiet)[#entry.run]
    ]
  ],
  table.hline(stroke: 0.4pt + rule),
)

/// One line of the schedule: a bar, or the `Lap` line standing beneath the bar it belongs to.
///
/// A lap's own line names the component in words and carries the lap's OWN mass (AM-03(a)): it is
/// never a percentage of the bar above it and never a column of that bar's row, which is what lets a
/// reader read net-of-laps and gross-of-laps off the same page (L-BD-02).
#let schedule-row(line) = (
  if line.component == "LAP" { text(size: 8.5pt, fill: quiet)[Lap] } else { id-cell(line.barMark) },
  text(size: 8.5pt, fill: quiet)[#line.role],
  fig(line.diameter),
  shape-cell(line.shape),
  text(size: 8.5pt)[#line.dimensions],
  fig(line.cuttingRaw),
  fig(line.cuttingRounded),
  fig(line.cuttingIs),
  fig(line.each),
  fig(line.total),
  fig(line.kg),
)

#document-frame(
  title: payload.title,
  subtitle: payload.project,
  draft-every-page: true,
  landscape: true,
  footer-note: payload.runningTitle,
)[
  #particulars-block(payload.particulars)
  #v(5mm)

  #table(
    columns: (auto, auto, auto, auto, 1fr, auto, auto, auto, auto, auto, auto),
    align: (left + horizon, left + horizon, right + horizon, center + horizon, left + horizon, right + horizon, right + horizon, right + horizon, right + horizon, right + horizon, right + horizon),
    stroke: none,
    inset: (x: 1.4mm, y: 1.1mm),
    row-gutter: 0pt,
    table.header(
      head[Bar mark],
      head[Role],
      head[Dia (mm)],
      head[Shape],
      head[Dimensions (mm)],
      head[Cutting length (mm)],
      head[Rounded (mm)],
      head[IS 2502 (mm)],
      head[In each],
      head[Total],
      head[Mass (kg)],
      table.hline(stroke: 0.6pt + rule),
    ),
    ..payload.entries
      .map(entry => (entry-heading(entry), ..entry.lines.map(line => schedule-row(line)).flatten()))
      .flatten(),
  )
  #v(4mm)

  // WHAT THE SCHEDULE DOES NOT HOLD, DECLARED (I-596): a bar bent to a shape the roster does not
  // hold is named here with the registry's own sentence for why, its raw length and mass as its row
  // states them, and nothing drawn; its mass stands in no total, and the total says so.
  #if payload.declared != none [
    #block(breakable: false)[
      #block(width: 100%, inset: (x: 1.4mm, y: 1.8mm))[
        #text(size: 10.5pt, weight: "semibold", fill: ink)[Declared, not scheduled]
        #v(1.2mm)
        #text(size: 8.5pt, fill: quiet)[#payload.declared.reason]
        #v(1.2mm)
        #line(length: 100%, stroke: 0.6pt + rule)
      ]
      #table(
        columns: (auto, auto, auto, auto, auto, auto, auto, auto, 1fr),
        align: (left + horizon, left + horizon, left + horizon, right + horizon, center + horizon, right + horizon, right + horizon, right + horizon, left + horizon),
        stroke: none,
        inset: (x: 1.4mm, y: 1.1mm),
        row-gutter: 0pt,
        table.header(
          head[Bar mark],
          head[Member],
          head[Role],
          head[Dia (mm)],
          head[Shape],
          head[Cutting length (mm)],
          head[Total],
          head[Mass (kg)],
          [],
          table.hline(stroke: 0.6pt + rule),
        ),
        ..payload.declared.rows
          .map(one => (
            id-cell(one.barMark),
            text(size: 8.5pt, fill: ink)[#one.where, #one.members],
            text(size: 8.5pt, fill: quiet)[#one.role],
            fig(one.diameter),
            text(size: 8.5pt, fill: ink)[#one.shape],
            fig(one.cuttingRaw),
            fig(one.total),
            fig(one.kg),
            [],
          ))
          .flatten(),
        table.hline(stroke: 0.6pt + rule),
        table.cell(colspan: 7, align: left + horizon)[#text(size: 9pt, weight: "semibold", fill: ink)[Excluded from the total mass]],
        fig(payload.declared.kg),
        [],
      )
    ]
    #v(4mm)
  ]

  // The cutting stock: what a site cuts from a stock bar, per diameter. INFORMATIONAL — it is not a
  // quantity anybody is billed for, and the sentence beneath it says so (AM-03(e)). A diameter whose
  // bars include storey-height runs keeps its mass and states, across the three packing columns, that
  // its stock was not computed and why (I-567); the sentence beneath names those diameters.
  #block(breakable: false)[
    #block(width: 100%, inset: (x: 1.4mm, y: 1.8mm))[
      #text(size: 10.5pt, weight: "semibold", fill: ink)[Cutting stock by diameter]
      #v(1.2mm)
      #line(length: 100%, stroke: 0.6pt + rule)
    ]
    #table(
      columns: (auto, auto, auto, auto, auto, 1fr),
      align: (right, right, right, right, right, left),
      stroke: none,
      inset: (x: 2mm, y: 1.4mm),
      row-gutter: 0pt,
      table.header(head[Dia (mm)], head[Mass (kg)], head[Stock bars], head[Pieces], head[Offcut (m)], []),
      table.hline(stroke: 0.6pt + rule),
      ..payload.stock
        .map(one => if one.withheld != "" {
          (fig(one.diameter), fig(one.kg), table.cell(colspan: 3, align: left + horizon)[#text(size: 8.5pt, fill: quiet)[#one.withheld]], [])
        } else {
          (fig(one.diameter), fig(one.kg), fig(one.stockBars), fig(one.pieces), fig(one.offcut), [])
        })
        .flatten(),
      table.hline(stroke: 0.6pt + rule),
      text(size: 9pt, weight: "semibold", fill: ink)[Total mass],
      fig(payload.grandTotalKg),
      table.cell(colspan: 4, align: left + horizon)[
        #if payload.totalCovers != "" { text(size: 8.5pt, fill: quiet)[#payload.totalCovers] }
        #if payload.totalCovers != "" and payload.declared != none { text(size: 8.5pt, fill: quiet)[ · ] }
        #if payload.declared != none { text(size: 8.5pt, fill: quiet)[Excludes the #payload.declared.kg kg declared, not scheduled] }
      ],
    )
    #v(2mm)
    #text(size: 8.5pt, fill: quiet)[Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and are never billed.]
    #if payload.stockWithheldNote != "" [
      #v(1.2mm)
      #text(size: 8.5pt, fill: ink)[#payload.stockWithheldNote]
    ]
  ]

  // WHAT IS LEFT OUT, SAID (L-QTY-02, I-536): a schedule over partly declared lines names the
  // components it does not state and why, in the screen's own words, so its total is never taken for
  // the whole of the steel.
  #if payload.leftOut.len() > 0 [
    #v(4mm)
    #block(breakable: false)[
      #text(size: 10.5pt, weight: "semibold", fill: ink)[Left out of this schedule]
      #v(1.2mm)
      #line(length: 100%, stroke: 0.6pt + rule)
      #v(1.2mm)
      #for one in payload.leftOut [
        #grid(
          columns: (32mm, 1fr),
          column-gutter: 3mm,
          text(size: 9pt, weight: "semibold", fill: ink)[#one.what],
          text(size: 9pt, fill: ink)[#one.why],
        )
        #v(1.2mm)
      ]
    ]
  ]

  // WHAT THIS SCHEDULE DOES NOT HOLD (I-569): the reinforcement the campaign published no line
  // for — beam, pile, cap and slab steel — in the draft BOQ's own closing words, so a schedule of
  // column steel is never taken for the building's.
  #if payload.notInSchedule.len() > 0 [
    #v(4mm)
    #block(breakable: false)[
      #text(size: 10.5pt, weight: "semibold", fill: ink)[Not in this schedule]
      #v(1.2mm)
      #line(length: 100%, stroke: 0.6pt + rule)
      #v(1.2mm)
      #for one in payload.notInSchedule [
        #grid(
          columns: (32mm, 20mm, 1fr),
          column-gutter: 3mm,
          text(size: 9pt, weight: "semibold", fill: ink)[#one.what],
          text(size: 9pt, fill: quiet)[#one.levels],
          text(size: 9pt, fill: ink)[#one.why],
        )
        #v(1.2mm)
      ]
    ]
  ]

  #v(6mm)
  #sign-off-block(
    ("Prepared by", "Checked by"),
    note: "Completed by hand. This schedule is a draft: it names no surveyor and certifies no quantity.",
  )
]
