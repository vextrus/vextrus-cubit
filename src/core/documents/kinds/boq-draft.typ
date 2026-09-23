// The `boq-draft` kind's document: a campaign's published lines, grouped into L-BD-08's sections and
// priced by nobody (R-TO-053, A-BOQ-PDF, AM-05, AM-14, L-QTY-04).
//
// WHAT IT DOES NOT SAY. It is never called by the name the law reserves for the signed thing; it
// carries no surveyor, no credential and no certificate, because nothing here has been signed; and
// it states no figure for the project — under incomplete coverage the only lawful foot is the
// measured-scope subtotal each section states over what was measured (L-QTY-04, L-QTY-07). A figure
// that hid what it did not cover is the failure this product is built against.
//
// WHAT IT SAYS WHERE NOTHING WAS MEASURED. Never a zero: a line, a group or a foot with no figure
// reads `Not measured`, a line says why beside its description, a partly measured group says how
// much of it the figure covers, and the document closes on what it did not measure at all
// (I-450, I-451).
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

/// Where no figure stands the cell says so in words, in the body face and the quiet ink: a zero there
/// would be a quantity nobody measured (L-QTY-04, I-450). The words arrive written; nothing here
/// decides them.
#let not-measured-cell(words) = align(right, text(size: 9pt, fill: quiet)[#words])

/// A part's own heading inside a block, set on the table cells' own inset so it lines up above them.
#let part-heading(words) = block(inset: (x: 2mm), above: 2mm, below: 3mm)[
  #text(size: 9.5pt, weight: "semibold", fill: ink)[#words]
]

/// A group's row: the item it describes, and the figure it carries — or the words that say none of its
/// lines states one. Where not every line does, the qualification stands under the description, on
/// the same row as the figure it qualifies (I-450).
#let group-row(group) = (
  [],
  [
    #text(size: 9.5pt, weight: "semibold", fill: ink)[#group.description]
    #if group.qualifier != "" [
      #linebreak()
      #text(size: 8.5pt, fill: quiet)[(#group.qualifier)]
    ]
  ],
  [],
  if group.notMeasured != "" { not-measured-cell(group.notMeasured) } else { figure-cell(group.figure) },
  unit-cell(group.unit),
)

/// What a line is, and — where it states no figure — why, on the same row: the reasons stand in the
/// quiet ink beside the description, where the wide column holds them (I-450).
#let described(words, reasons) = [
  #text(size: 9.5pt)[#words]
  #if reasons != "" [ #text(size: 8.5pt, fill: quiet)[(#reasons)]]
]

/// One line of the draft: its item number, what it is, where it stands, how much, in what. A line
/// that states no figure says `Not measured` in its Quantity cell and why beside its description.
#let line-row(line) = (
  id-cell(line.item),
  described(line.description, line.reasons),
  id-cell(line.level),
  if line.notMeasured != "" { not-measured-cell(line.notMeasured) } else { figure-cell(line.quantity) },
  unit-cell(line.unit),
)

/// A section's foot: one row per unit, under the one label incomplete coverage allows (L-QTY-07) —
/// the figure over what was measured, or the words where nothing in that unit was.
#let subtotal-rows(label, subtotals) = {
  subtotals
    .map(subtotal => (
      [],
      text(size: 9.5pt, weight: "semibold", fill: ink)[#label],
      [],
      if subtotal.notMeasured != "" { not-measured-cell(subtotal.notMeasured) } else { figure-cell(subtotal.value) },
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
          described(line.description, line.reasons),
          id-cell(line.level),
          if line.notMeasured != "" { not-measured-cell(line.notMeasured) } else { figure-cell(line.quantity) },
          unit-cell(line.unit),
        ))
        .flatten(),
    )
  ]

  // What the draft leaves out, stated where it closes (L-QTY-07, I-451): the scope no line was
  // published for, over which levels and why, and each reason a line above states no figure, in the
  // registry's own sentence. Nothing here is a count and nothing here is signed (AM-05).
  #let left-out = payload.notMeasured
  #if left-out.scope.len() > 0 or left-out.reasons.len() > 0 [
    #v(2mm)
    #block-heading[#left-out.heading]
    #if left-out.scope.len() > 0 [
      #part-heading(left-out.scopeHeading)
      #table(
        columns: (1fr, 26mm, 1.4fr),
        align: (left, left, left),
        stroke: none,
        inset: (x: 2mm, y: 1.4mm),
        row-gutter: 0pt,
        table.header(head-cell("Description"), head-cell("Levels"), head-cell("Why")),
        table.hline(stroke: 0.6pt + rule),
        ..left-out.scope
          .map(row => (
            text(size: 9.5pt)[#row.about],
            id-cell(row.levels),
            text(size: 9pt, fill: quiet)[#row.why],
          ))
          .flatten(),
      )
      #v(3mm)
    ]
    #if left-out.reasons.len() > 0 [
      #part-heading(left-out.reasonsHeading)
      #table(
        columns: (1fr, 1.4fr),
        align: (left, left),
        stroke: none,
        inset: (x: 2mm, y: 1.4mm),
        row-gutter: 0pt,
        table.header(head-cell("Reason"), head-cell("What it means")),
        table.hline(stroke: 0.6pt + rule),
        ..left-out.reasons
          .map(row => (
            text(size: 9.5pt)[#row.reason],
            text(size: 9pt, fill: quiet)[#row.meaning],
          ))
          .flatten(),
      )
    ]
  ]
]
