/**
 * The gallery's string table (R-SPINE-060, AM-03 (2)).
 *
 * Every word a reader meets on /design is decided in docs/design/s-design.md §6 and quoted
 * here verbatim: "Copy is design: product voice is decided in the Design Decision, never
 * improvised by a builder; a copy defect is a defect."
 *
 * Two kinds of key live here, and the split is the document's own. `design.*` is the page
 * speaking — its title, its lede, its group headings, its empty state. `design.sample.*` is
 * the copy a *specimen* carries: the label on the sample input, the words on the sample
 * button. A specimen's copy is still copy — a reader reads it — so it is decided in §6 like
 * everything else, rather than invented at the point of use.
 *
 * What is deliberately absent: marks, quantities, identifiers and glyphs (`C-01`, `96.510`,
 * `RPT-3F82C1`, `estimate.sign`, `S-201 Column layout`, `⌘`) are sample *data*, not copy;
 * they live beside the entry that renders them in registry.tsx. So do the patterns' own
 * sentences (PATTERNS_STRINGS) and a refusal's message and remedy (the REFUSALS register) —
 * this table never restates either.
 */
export const DESIGN_STRINGS = Object.freeze({
  /** The document title (§1). */
  'design.docTitle': 'Datum gallery',
  /** The page's `<h1>`: the design system's name, not a sentence about it. */
  'design.title': 'Datum',
  /** Under the title: what this page is and what it is for (§2). */
  'design.lede':
    'Every Datum component in every state it defines, with sample data, in both themes. What this page shows is what ships.',
  /** The theme switch's `<nav>` name. */
  'design.theme.label': 'Theme',
  /** The two themes, as links (§2). */
  'design.theme.light': 'Light',
  'design.theme.dark': 'Dark',
  /** The three group headings — one per barrel (§2). */
  'design.group.primitives': 'Primitives',
  'design.group.patterns': 'Patterns',
  'design.group.data': 'Data',
  /** §5: a registry with no entries renders EmptyState rather than a blank page (R-UI-020). */
  'design.empty.title': 'The gallery has no entries.',
  'design.empty.teach': 'Register each component in the gallery registry to render it here.',

  /* The specimens' own copy (§3, §6). */

  'design.sample.save': 'Save estimate',
  'design.sample.duplicate': 'Duplicate',
  'design.sample.dismiss': 'Dismiss',
  'design.sample.deleteRow': 'Delete row',
  'design.sample.close': 'Close',
  'design.sample.projectName': 'Project name',
  'design.sample.untitledProject': 'Untitled project',
  'design.sample.storeyHeight': 'Storey height (m)',
  'design.sample.storeyHeightMsg': 'Enter a number in metres.',
  'design.sample.notes': 'Notes',
  'design.sample.notesValue': 'North wing columns re-measured after revision B.',
  'design.sample.concreteVolume': 'Concrete volume',
  'design.sample.includeOpenings': 'Include openings deduction',
  'design.sample.rowDensity': 'Row density',
  'design.sample.comfortable': 'Comfortable',
  'design.sample.compact': 'Compact',
  'design.sample.snapToGrid': 'Snap to grid',
  'design.sample.sheetOpacity': 'Sheet opacity',
  'design.sample.storeyRange': 'Storey range',
  'design.sample.elementClass': 'Element class',
  'design.sample.elementPlaceholder': 'Choose an element class',
  'design.sample.wall': 'Wall',
  'design.sample.column': 'Column',
  'design.sample.beam': 'Beam',
  'design.sample.slab': 'Slab',
  'design.sample.condition': 'Condition',
  'design.sample.conditionPlaceholder': 'Search conditions',
  'design.sample.conditionC25Columns': 'C25 concrete, columns',
  'design.sample.conditionC25Walls': 'C25 concrete, walls',
  'design.sample.conditionFormwork': 'Formwork, columns',
  'design.sample.tabQuantities': 'Quantities',
  'design.sample.tabQuantitiesBody':
    'Quantities are grouped by element class and carry their basis.',
  'design.sample.tabSources': 'Sources',
  'design.sample.tabSourcesBody':
    'Each quantity names the sheet and the entities it was measured from.',
  'design.sample.tabHistory': 'History',
  'design.sample.tabHistoryBody': 'Every change keeps its author, time and reason.',
  'design.sample.measuredBasis': 'Measured basis',
  'design.sample.measuredTooltip': 'Taken from the drawing with the measure tools.',
  'design.sample.columnRef': 'Column C-14',
  'design.sample.columnDetail': 'Marked C-14 · Level 3 · 400 × 600 mm.',
  'design.sample.actions': 'Actions',
  'design.sample.rename': 'Rename',
  'design.sample.contextTarget': 'Right-click for row actions',
  'design.sample.copyValue': 'Copy value',
  'design.sample.traceToDrawing': 'Trace to drawing',
  'design.sample.clearCell': 'Clear cell',
  'design.sample.renameSheet': 'Rename sheet',
  'design.sample.renameSheetBody':
    'The new name appears in the register and on printed documents.',
  'design.sample.sheetName': 'Sheet name',
  'design.sample.cancel': 'Cancel',
  'design.sample.saveShort': 'Save',
  'design.sample.openInspector': 'Open inspector',
  'design.sample.inspector': 'Inspector',
  'design.sample.inspectorEmpty': 'Nothing is selected. Choose an entity on the sheet to inspect it.',
  'design.sample.showNotification': 'Show a notification',
  'design.sample.estimateSaved': 'Estimate saved.',
  'design.sample.draft': 'Draft',
  'design.sample.signed': 'Signed',
  'design.sample.stale': 'Stale',
  'design.sample.voided': 'Void',
  'design.sample.importedBadge': 'Imported',
  'design.sample.level3': 'Level 3',
  'design.sample.importProgress': 'Import progress',
  'design.sample.noDrawingsTitle': 'No drawings yet.',
  'design.sample.noDrawingsTeach': 'Upload a drawing to start measuring quantities.',
  'design.sample.uploadDrawing': 'Upload a drawing',
  'design.sample.noSignaturesTitle': 'No signatures yet.',
  'design.sample.noSignaturesTeach': 'Sign the estimate to freeze its quantities.',
  'design.sample.viewSheet': 'View sheet S-201',
  'design.sample.voidSignature': 'Void a signature',
  'design.sample.voidTitle': 'Void the signature on Estimate 4?',
  'design.sample.voidSignatures': 'Signatures voided',
  'design.sample.voidUnfrozen': 'Quantities unfrozen',
  'design.sample.voidSuperseded': 'Documents marked superseded',
  'design.sample.colMark': 'Mark',
  'design.sample.colElement': 'Element',
  'design.sample.colQuantity': 'Quantity (m³)',
  'design.sample.colBasis': 'Basis',
  'design.sample.total': 'Total',
  'design.sample.tableEmpty': 'No items measured yet. Measure a condition on the sheet to add rows.',
  'design.sample.holder': 'Ayesha Rahman, the project owner',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type DesignStringKey = keyof typeof DESIGN_STRINGS;

/** Read one string. A key the table does not carry is a compile error, not a blank. */
export function ds(key: DesignStringKey): string {
  return DESIGN_STRINGS[key];
}
