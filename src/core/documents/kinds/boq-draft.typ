// The `boq-draft` kind's document: a campaign's published lines as the owner ruled a bill is shaped
// — one item per description, rounded once from the register's sum; the member lines behind each
// item in a Details of measurement appendix; and a page that says what the draft leaves out
// (R-TO-053, A-BOQ-PDF, AM-05, AM-14, L-QTY-04; s-boq I-528, I-451).
//
// WHAT IT DOES NOT SAY. It is never called by the name the law reserves for the signed thing; it
// carries no surveyor, no credential and no certificate, because nothing here has been signed; and
// it states no figure for the project, for a section or for a group — a quantity subtotal that
// crossed descriptions would add unlike things, and a figure that hid what it did not cover is the
// failure this product is built against (L-QTY-04, L-QTY-07, I-529).
//
// WHAT IT SAYS WHERE NOTHING WAS MEASURED. Never a zero: an item or a member line with no figure
// reads `Not measured`, a partly measured item says how much of it the figure covers and why, and
// the draft closes on what it did not measure at all (I-450, I-451).
//
// Everything it does say arrives as DATA. The payload is read with `json()`, every figure was
// written by `src/core/documents/figures.ts` at its kind's stated precision, and every item number
// was derived by the one numbering both this page and the screen read (AM-14 §2, I-269). Nothing is
// computed here and nothing is spliced into markup (L-FMT-03).
#import "/base/frame.typ": document-frame, figure-cell, head-cell, id-cell, ink, mono-face, quiet, rule, unit-cell

#let payload = json("payload.json")

// The bill's own columns: what an item is takes the room, the numbers take what they need.
#let columns = (18mm, 1fr, 18mm, 26mm, 12mm)

// The measurement sheet's columns: where a member is found, how many, what was multiplied, what it
// came to, on what basis and off which sheet.
#let detail-columns = (14mm, 12mm, 16mm, 9mm, 1fr, 22mm, 10mm, 19mm, 13mm)

/// A heading over a block of rows. The rule under it is the frame's, like every other colour on this
/// page: a kind spells none of its own. It sticks to what follows it, so no section is headed at one
/// page's foot and begun on the next.
#let block-heading(words) = block(width: 100%, inset: (x: 2mm, y: 1.8mm), sticky: true)[
  #text(size: 10.5pt, weight: "semibold", fill: ink)[#words]
  #v(1.2mm)
  #line(length: 100%, stroke: 0.6pt + rule)
]

/// Where no figure stands the cell says so in words, in the body face and the quiet ink: a zero there
/// would be a quantity nobody measured (L-QTY-04, I-450). The words arrive written; nothing here
/// decides them.
#let not-measured-cell(words, size: 9pt) = align(right, text(size: size, fill: quiet)[#words])

/// A part's own heading inside a block, set on the table cells' own inset so it lines up above them.
#let part-heading(words) = block(inset: (x: 2mm), above: 2mm, below: 3mm)[
  #text(size: 9.5pt, weight: "semibold", fill: ink)[#words]
]

/// A group's row: the trade heading its items stand under, across the row. It states no figure — a
/// group may hold several descriptions, and no quantity is added across them (I-529).
///
/// It is the table's SECOND-level header, so the heading is never left alone at a page's foot with
/// its first item on the next page (the pinned Typst moves a header no row follows), and a group
/// whose items run onto the next page opens that page under its heading again, below the column
/// heads, until the next group's heading replaces it.
#let group-row(group) = (
  table.header(
    level: 2,
    table.cell(colspan: 5, inset: (x: 2mm, top: 2.6mm, bottom: 1.2mm))[
      #text(size: 9pt, weight: "semibold", fill: quiet)[#upper(group.heading)]
    ],
  ),
)

/// One item: its number, its full description — qualified, where not every member line behind it
/// states a figure, by how many did and why — the storey it is priced at, its figure and its unit.
#let item-row(item) = (
  id-cell(item.item),
  [
    #text(size: 9.5pt)[#item.description]
    #if item.qualifier != "" [
      #linebreak()
      #text(size: 8.5pt, fill: quiet)[(#item.qualifier)]
    ]
  ],
  if item.levelIsWord { text(size: 9pt, fill: quiet)[#item.level] } else { id-cell(item.level) },
  if item.notMeasured != "" { not-measured-cell(item.notMeasured) } else { figure-cell(item.quantity) },
  unit-cell(item.unit),
)

/// The front page's project block: every fact in words, the label quiet and the value in the body face
/// (I-530). Nothing here is an identifier.
#let project-block(rows) = grid(
  columns: (30mm, 1fr),
  column-gutter: 4mm,
  row-gutter: 2.2mm,
  ..rows
    .map(row => (text(size: 9pt, fill: quiet)[#row.label], text(size: 9.5pt, fill: ink)[#row.value]))
    .flatten(),
)

/// The checking record a draft circulates with: one blank box per check, each with the two things a
/// checker writes by hand. It names nobody and signs nothing (AM-05 (2), I-531).
#let checking-block(labels, fields) = grid(
  columns: labels.map(_ => 1fr),
  column-gutter: 6mm,
  ..labels.map(label => block(width: 100%, inset: (x: 3mm, y: 2.4mm), stroke: 0.6pt + rule, radius: 1mm)[
    #text(size: 8.5pt, weight: "semibold", fill: quiet)[#upper(label)]
    #v(2mm)
    #for field in fields [
      #text(size: 8.5pt, fill: quiet)[#field]
      #v(5mm)
      #line(length: 100%, stroke: 0.4pt + rule)
      #v(1.6mm)
    ]
  ]),
)

/// The drawing register: each sheet the bill was measured on, by the number and title its title block
/// states and the revision it marks (I-689). The rows arrive written; nothing here decides them.
#let register-block(register) = [
  #part-heading(register.heading)
  #table(
    columns: (22mm, 1fr, 24mm),
    align: (left, left, left),
    stroke: none,
    inset: (x: 2mm, y: 1.2mm),
    row-gutter: 0pt,
    table.header(..register.heads.map(head => head-cell(head))),
    table.hline(stroke: 0.6pt + rule),
    ..register.rows
      .map(row => (
        text(size: 9pt, font: mono-face)[#row.sheet],
        text(size: 9pt)[#row.title],
        if row.revisionIsWord { text(size: 8.5pt, fill: quiet)[#row.revision] } else { text(size: 9pt, font: mono-face)[#row.revision] },
      ))
      .flatten(),
  )
]

/// The measurement notes a draft opens on (I-691): numbered, in the order the kind wrote them,
/// with the bases this draft's figures rest on listed under the note that introduces them.
#let notes-block(notes) = [
  #part-heading(notes.heading)
  #block(inset: (x: 2mm))[
    #set text(size: 9pt, fill: ink)
    #set enum(numbering: "1.", spacing: 2.2mm, indent: 0mm, body-indent: 2.5mm)
    #enum(..notes.items.map(note => [
      #note.text
      #if note.bases.len() > 0 [
        #v(1mm)
        #grid(
          columns: (24mm, 1fr),
          column-gutter: 3mm,
          row-gutter: 1.4mm,
          ..note.bases.map(one => (text(size: 8.5pt, weight: "semibold")[#one.basis], text(size: 8.5pt, fill: quiet)[#one.meaning])).flatten(),
        )
      ]
    ]))
  ]
]

#document-frame(
  title: payload.title,
  subtitle: payload.project,
  draft-every-page: true,
  footer-note: payload.footer,
  watermarked: false,
  issued: payload.issuedOn,
)[
  #project-block(payload.front.rows)
  #v(5mm)
  #if payload.front.register.rows.len() > 0 [
    #register-block(payload.front.register)
    #v(4mm)
  ]
  #notes-block(payload.front.notes)
  #v(5mm)
  #checking-block(payload.front.checking, payload.front.fields)
  #pagebreak()

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
      ..section.groups.map(group => (group-row(group), ..group.items.map(item => item-row(item)))).flatten(),
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
          [
            #text(size: 9.5pt)[#line.description]
            #if line.reasons != "" [ #text(size: 8.5pt, fill: quiet)[(#line.reasons)]]
          ],
          id-cell(line.level),
          if line.notMeasured != "" { not-measured-cell(line.notMeasured) } else { figure-cell(line.quantity) },
          unit-cell(line.unit),
        ))
        .flatten(),
    )
  ]

  // What the draft leaves out, on a page of its own (L-QTY-07, I-451): the scope no line was
  // published for, over which levels and why, and each reason an item above states no figure, in the
  // registry's own sentence. Nothing here is a count and nothing here is signed (AM-05).
  #let left-out = payload.notMeasured
  #if left-out.scope.len() > 0 or left-out.reasons.len() > 0 [
    #pagebreak()
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

  // The measurement sheet behind the items: each item by its number, and the member lines it was
  // summed from — where each is found, how many, what was multiplied, what it came to on its own and
  // on what basis (I-528). No figure here is a sum of any other on the page.
  #if payload.details.items.len() > 0 [
    #pagebreak()
    #block-heading[#payload.details.heading]
    #for item in payload.details.items [
      // The item's heading is part of its member table's header: it is never left at a page's foot
      // with its members on the next, and a member list that runs onto the next page opens that page
      // under the item's number and description again, not under bare column heads.
      #table(
        columns: detail-columns,
        align: (left, left, left, right, left, right, left, left, left),
        stroke: none,
        inset: (x: 1.6mm, y: 1.1mm),
        row-gutter: 0pt,
        table.header(
          table.cell(colspan: 9, align: left, inset: (x: 2mm, top: 0.6mm, bottom: 1.6mm))[
            #text(size: 9pt, weight: "semibold", font: mono-face, fill: ink)[#item.item]
            #h(2mm)
            #text(size: 9pt, fill: ink)[#item.description]
            #if item.level != "" [ #text(size: 8.5pt, fill: quiet)[· #item.level]]
          ],
          head-cell("Mark"),
          head-cell("Grid"),
          head-cell("Level"),
          head-cell("Nos"),
          head-cell("Dimensions"),
          head-cell("Quantity"),
          head-cell("Unit"),
          head-cell("Basis"),
          head-cell("Sheet"),
        ),
        table.hline(stroke: 0.4pt + rule),
        ..item.rows
          .map(row => (
            text(size: 8.5pt, font: mono-face)[#row.mark],
            text(size: 8.5pt, font: mono-face)[#row.grid],
            if row.levelIsWord { text(size: 8pt, fill: quiet)[#row.level] } else { text(size: 8.5pt, font: mono-face)[#row.level] },
            align(right, text(size: 8.5pt, font: mono-face)[#row.nos]),
            text(size: 8pt, fill: quiet)[#row.dimensions],
            if row.notMeasured != "" { not-measured-cell(row.notMeasured, size: 8pt) } else { align(right, text(size: 8.5pt, font: mono-face)[#row.quantity]) },
            text(size: 8pt, fill: quiet)[#row.unit],
            text(size: 8pt, fill: quiet)[#row.basis],
            text(size: 8.5pt, font: mono-face)[#row.sheet],
          ))
          .flatten(),
      )
    ]
  ]
]
