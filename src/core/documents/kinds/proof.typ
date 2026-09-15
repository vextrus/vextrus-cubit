// The `proof` kind's document: the seam's own yardstick (R-SPINE-040).
//
// It is deliberately small. What it exists to demonstrate is not a layout but the seam's guarantees:
// the payload arrives as DATA and is read with `json()`, every string is set as content rather than
// spliced into markup, figures arrive already formatted at the kind's stated precision, units stand
// in their own column, and nothing anywhere asks the renderer what day it is.
#import "/base/frame.typ": document-frame, figure-cell, head-cell, id-cell, rule, unit-cell

// The payload, read as DATA. This is the whole of what this document knows.
//
// `json()` answers strings, numbers and arrays — never markup. A title of `#text(red)[x] *y* <z> \`
// or `#import "/main.typ"` therefore SETS those characters and does not run them: the renderer never
// sees them as source, because nothing built source around them (L-FMT-03). That property is the
// reason the payload crosses as a file at all rather than as an argument.
#let payload = json("/payload.json")

#document-frame(title: payload.title, subtitle: payload.project)[
  #table(
    columns: (auto, 1fr, auto, auto),
    align: (left, left, right, left),
    stroke: none,
    inset: (x: 2mm, y: 1.6mm),
    row-gutter: 0pt,
    table.header(
      head-cell("Ref"),
      head-cell("Description"),
      head-cell("Quantity"),
      head-cell("Unit"),
    ),
    // The rule is the frame's, like every other colour on the page: a kind spells none of its own.
    table.hline(stroke: 0.6pt + rule),
    ..payload.lines.map(line => (
      id-cell(line.ref),
      [#line.description],
      // Already grouped and already at this kind's precision: the template prints the figure it was
      // given and never re-formats one (L-FMT-02, `src/core/documents/figures.ts`).
      figure-cell(line.quantity),
      // The unit renders from the enum, separately from its quantity (L-FMT-02).
      unit-cell(line.unit),
    )).flatten(),
  )
]
