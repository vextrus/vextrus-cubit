// The `boq-draft` kind's document: a campaign's published lines, grouped into L-BD-08's sections and
// priced by nobody (R-TO-053, A-BOQ-PDF, AM-05, AM-14, L-QTY-04).
//
// WHAT IT DOES NOT SAY. It is never called by the name the law reserves for the signed thing; it
// carries no surveyor, no credential and no certificate, because nothing here has been signed; and
// it states no figure for the project — under incomplete coverage the only lawful foot is the
// measured-scope subtotal each section states over what was measured (L-QTY-04, L-QTY-07). A figure
// that hid what it did not cover is the failure this product is built against.
//
// Everything it does say arrives as DATA. The payload is read with `json()`, every figure was
// written by `src/core/documents/figures.ts` at its kind's stated precision, and every item number
// was derived by the one numbering both this page and the screen read (AM-14 §2, I-269). Nothing is
// computed here and nothing is spliced into markup (L-FMT-03).
#import "/base/frame.typ": document-frame, figure-cell, head-cell, id-cell, ink, quiet, rule, unit-cell

#let payload = json("payload.json")

// The seven-tenths rule of a read table: what a thing is takes the room, the numbers take what they
// need. The columns are the screen's own, less the two chips a page cannot wear.
#let columns = (22mm, 1fr, 18mm, 28mm, 14mm)

/// A heading over a block of rows. The rule under it is the frame's, like every other colour on this
/// page: a kind spells none of its own.
#let block-heading(words) = block(width: 100%, inset: (x: 2mm, y: 1.8mm))[
  #text(size: 10.5pt, weight: "semibold", fill: ink)[#words]
  #v(1.2mm)
  #line(length: 100%, stroke: 0.6pt + rule)
]

/// A group's row: the item it describes, and the figures it carries, per unit.
#let group-row(group) = (
  [],
  text(size: 9.5pt, weight: "semibold", fill: ink)[#group.description],
  [],
  figure-cell(group.subtotals.map(subtotal => subtotal.value).join(" ")),
  unit-cell(group.subtotals.map(subtotal => subtotal.unit).join(" ")),
)

/// One line of the draft: its item number, what it is, where it stands, how much, in what.
#let line-row(line) = (
  id-cell(line.item),
  text(size: 9.5pt)[#line.description],
  id-cell(line.level),
  figure-cell(line.quantity),
  unit-cell(line.unit),
)

/// A section's foot: one row per unit, under the one label incomplete coverage allows (L-QTY-07).
#let subtotal-rows(label, subtotals) = {
  subtotals
    .map(subtotal => (
      [],
      text(size: 9.5pt, weight: "semibold", fill: ink)[#label],
      [],
      figure-cell(subtotal.value),
      unit-cell(subtotal.unit),
    ))
    .flatten()
}

#document-frame(
  title: payload.title,
  subtitle: payload.project,
  facts: (
    (label: "Campaign", value: payload.campaignId),
    (label: "Pinned revision", value: payload.setRevisionId),
    (label: "Taxonomy", value: payload.taxonomyVersion),
    (label: "Coverage", value: payload.coverage),
  ),
  draft-every-page: true,
)[
  #for section in payload.sections [
    #block-heading[#section.ordinal #section.label]
    #table(
      columns: columns,
      align: (left, left, left, right, left),
      stroke: none,
      inset: (x: 2mm, y: 1.4mm),
      row-gutter: 0pt,
      table.header(
        head-cell("Item"),
        head-cell("Description"),
        head-cell("Level"),
        head-cell("Quantity"),
        head-cell("Unit"),
      ),
      table.hline(stroke: 0.6pt + rule),
      ..section.groups.map(group => (group-row(group), ..group.lines.map(line => line-row(line)))).flatten(),
      table.hline(stroke: 0.6pt + rule),
      ..subtotal-rows(payload.subtotalLabel, section.subtotals),
    )
    #v(4mm)
  ]

  // Kept, labelled, reason stated, never dropped (L-BD-08). It stands after the six sections, it is
  // not one of them, and it carries no item number: a number would make it a seventh (I-267).
  #if payload.unclassified.lines.len() > 0 [
    #block-heading[#payload.unclassified.label]
    #table(
      columns: columns,
      align: (left, left, left, right, left),
      stroke: none,
      inset: (x: 2mm, y: 1.4mm),
      row-gutter: 0pt,
      table.header(
        head-cell("Reason"),
        head-cell("Description"),
        head-cell("Level"),
        head-cell("Quantity"),
        head-cell("Unit"),
      ),
      table.hline(stroke: 0.6pt + rule),
      ..payload.unclassified.lines
        .map(line => (
          text(size: 9pt, fill: quiet)[#line.reason],
          text(size: 9.5pt)[#line.description],
          id-cell(line.level),
          figure-cell(line.quantity),
          unit-cell(line.unit),
        ))
        .flatten(),
    )
  ]
]
