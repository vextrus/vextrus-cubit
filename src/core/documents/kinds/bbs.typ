// The `bbs` kind's document: a campaign's bill of bars, by member and bar mark, with the shape each
// bar is bent to DRAWN beside its code (R-TO-054, A-BBS-PDF, AM-01, AM-03, AM-05).
//
// THE SKETCHES ARE DRAWN, NEVER IMAGED. Every BS 8666 shape this tree details in is answered by a
// few strokes of the page's own ink — no raster, no SVG, no library file: a schedule is read at a
// glance by the shape of the bar, and a picture pasted in would be a second answer to what a shape
// code means. The dispatch below holds one branch per code of `SHAPE_CODES`, and the code itself is
// printed beside its sketch because a BS 8666 code is the domain's own name for the shape (I-bbs-6).
//
// WHAT IT DOES NOT SAY. Nothing here is signed, so the frame prints `DRAFT — UNSIGNED` on every leaf
// and the document names no surveyor, no credential and no certificate (AM-05). It states no figure
// it was not given: every number arrives already written by `src/core/documents/figures.ts` at this
// kind's stated precision, and this template computes and re-formats nothing (L-FMT-02, L-FMT-03).
#import "/base/frame.typ": document-frame, figure-cell, head-cell, id-cell, ink, mono-face, quiet, rule

#let payload = json("payload.json")

// The schedule is read ACROSS: what the bar is, how it is cut, how many of it, what it weighs. The
// dimensions column takes the slack because a leg list is the only cell whose length is not known.
#let columns = (17mm, 12mm, 19mm, 10mm, 1fr, 18mm, 14mm, 16mm, 9mm, 16mm)

// The ink a sketch is drawn in: the page's own, like every other colour here — a kind spells none.
#let wire = 0.6pt + ink

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

/// A member's heading: where it stands, what it is, and what it is marked — the group every bar
/// beneath it belongs to (R-TO-054).
#let member-heading(member) = block(width: 100%, inset: (x: 2mm, y: 1.6mm))[
  #text(size: 9.5pt, weight: "semibold", fill: ink)[#member.mark]
  #h(3mm)
  #text(size: 8.5pt, fill: quiet)[#member.class]
  #h(3mm)
  #text(size: 8.5pt, fill: quiet)[#member.level]
  #h(3mm)
  #text(size: 8pt, font: mono-face, fill: quiet)[#member.objectKey]
  #v(1mm)
  #line(length: 100%, stroke: 0.6pt + rule)
]

/// One line of the schedule: a bar, or the LAP component standing beneath the bar it belongs to.
///
/// A lap's own line states the component by name and carries the lap's OWN mass (AM-03(a)): it is
/// never a percentage of the bar above it and never a column of that bar's row, which is what lets a
/// reader read net-of-laps and gross-of-laps off the same page (L-BD-02).
#let schedule-row(line) = (
  id-cell(if line.component == "LAP" { "LAP" } else { line.barMark }),
  text(size: 8.5pt, fill: quiet)[#line.role],
  shape-cell(line.shape),
  figure-cell(line.diameter),
  text(size: 8.5pt)[#line.dimensions.join(",  ")],
  figure-cell(line.cuttingRaw),
  figure-cell(line.cuttingRounded),
  figure-cell(line.cuttingIs),
  figure-cell(line.bars),
  figure-cell(line.kg),
)

#document-frame(
  title: payload.title,
  subtitle: payload.project,
  facts: (
    (label: "Campaign", value: payload.campaignId),
    (label: "Pinned revision", value: payload.setRevisionId),
    (label: "Stock bar", value: payload.stockMm),
    (label: "Rounded to", value: payload.roundingMm),
  ),
  draft-every-page: true,
)[
  #for member in payload.members [
    #member-heading(member)
    #table(
      columns: columns,
      align: (left, left, center, right, left, right, right, right, right, right),
      stroke: none,
      inset: (x: 1.6mm, y: 1.2mm),
      row-gutter: 0pt,
      table.header(
        head-cell("Bar mark"),
        head-cell("Role"),
        head-cell("Shape"),
        head-cell("Dia"),
        head-cell("Dimensions"),
        head-cell("Cutting"),
        head-cell("Rounded"),
        head-cell("IS add."),
        head-cell("Bars"),
        head-cell("Mass"),
      ),
      table.hline(stroke: 0.6pt + rule),
      ..member.lines.map(line => schedule-row(line)).flatten(),
    )
    #v(3mm)
  ]

  // The cutting stock: what a site cuts from a stock bar, per diameter. INFORMATIONAL — it is not a
  // quantity anybody is billed for, and the sentence beneath it says so (AM-03(e)).
  #block(width: 100%, inset: (x: 2mm, y: 1.8mm))[
    #text(size: 10.5pt, weight: "semibold", fill: ink)[Cutting stock by diameter]
    #v(1.2mm)
    #line(length: 100%, stroke: 0.6pt + rule)
  ]
  #table(
    columns: (20mm, 30mm, 26mm, 22mm, 1fr),
    align: (right, right, right, right, right),
    stroke: none,
    inset: (x: 2mm, y: 1.4mm),
    row-gutter: 0pt,
    table.header(
      head-cell("Diameter"),
      head-cell("Mass"),
      head-cell("Stock bars"),
      head-cell("Pieces"),
      head-cell("Offcut"),
    ),
    table.hline(stroke: 0.6pt + rule),
    ..payload.stock
      .map(one => (figure-cell(one.diameter), figure-cell(one.kg), figure-cell(one.stockBars), figure-cell(one.pieces), figure-cell(one.offcut)))
      .flatten(),
    table.hline(stroke: 0.6pt + rule),
    text(size: 9pt, weight: "semibold", fill: ink)[Total mass],
    figure-cell(payload.grandTotalKg),
    [],
    [],
    [],
  )
  #v(2mm)
  #text(size: 8.5pt, fill: quiet)[Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and are never billed.]
]
