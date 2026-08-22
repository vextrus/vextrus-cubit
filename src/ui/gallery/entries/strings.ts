/**
 * The entries' own words: one title per entry, and every sample string the Design Decision
 * §5–§6 quotes (R-SPINE-060, AM-03 (2) — the copy is the decision's, not a builder's).
 *
 * Why it lives beside the entries rather than in `src/ui/gallery/strings.ts`, which composes
 * it: an entry title *is* the component's name in sentence case, so this table spells
 * "Button", "Input", "Badge" — and a file in the gallery's chrome that spells twenty component
 * names is indistinguishable, to the completeness scan and to a reader, from the frozen roster
 * that scan exists to forbid. The entry directory is where names are carried as data (the
 * `covers` lists are here for the same reason), so the entries' words are carried here too.
 * `GALLERY_STRINGS` still holds every key: one module table, assembled from where its parts
 * belong.
 */
export const ENTRY_STRINGS = Object.freeze({
  /* ---- Titles: the component's name, sentence case, spaces for the humps --------------- */
  'gallery.entry.button': 'Button',
  'gallery.entry.icon-button': 'Icon button',
  'gallery.entry.input': 'Input',
  'gallery.entry.textarea': 'Textarea',
  'gallery.entry.number-input': 'Number input',
  'gallery.entry.checkbox': 'Checkbox',
  'gallery.entry.radio-group': 'Radio group',
  'gallery.entry.switch': 'Switch',
  'gallery.entry.slider': 'Slider',
  'gallery.entry.select': 'Select',
  'gallery.entry.combobox': 'Combobox',
  'gallery.entry.tabs': 'Tabs',
  'gallery.entry.tooltip': 'Tooltip',
  'gallery.entry.popover': 'Popover',
  'gallery.entry.dropdown-menu': 'Dropdown menu',
  'gallery.entry.context-menu': 'Context menu',
  'gallery.entry.dialog': 'Dialog',
  'gallery.entry.sheet': 'Sheet',
  'gallery.entry.toaster': 'Toaster',
  'gallery.entry.badge': 'Badge',
  'gallery.entry.tag': 'Tag',
  'gallery.entry.kbd': 'Kbd',
  'gallery.entry.progress': 'Progress',
  'gallery.entry.skeleton': 'Skeleton',
  'gallery.entry.separator': 'Separator',
  'gallery.entry.empty-state': 'Empty state',
  'gallery.entry.error-state': 'Error state',
  'gallery.entry.partial-notice': 'Partial notice',
  'gallery.entry.offline-banner': 'Offline banner',
  'gallery.entry.permission-denied': 'Permission denied',
  'gallery.entry.refusal-state': 'Refusal state',
  'gallery.entry.evidence-link': 'Evidence link',
  'gallery.entry.consequence-dialog': 'Consequence dialog',
  'gallery.entry.data-table': 'Data table',
  'gallery.entry.basis-chip': 'Basis chip',
  'gallery.entry.coverage-chip': 'Coverage chip',
  'gallery.entry.unit-badge': 'Unit badge',

  /* ---- Sample copy (§5), one key per string -------------------------------------------- */
  'gallery.sample.button.label': 'Save measurement',
  'gallery.sample.button.danger': 'Void signatures',
  'gallery.sample.icon-button.label': 'Close panel',
  'gallery.sample.input.value': 'Ground floor plan',
  'gallery.sample.input.name': 'Sheet name',
  'gallery.sample.textarea.value':
    'Column grid shifted 40 mm east of the architectural set.',
  'gallery.sample.textarea.name': 'Sheet note',
  'gallery.sample.number-input.name': 'Quantity',
  'gallery.sample.checkbox.label': 'Include openings',
  'gallery.sample.radio-group.comfortable': 'Comfortable',
  'gallery.sample.radio-group.compact': 'Compact',
  'gallery.sample.switch.label': 'Snap to grid',
  'gallery.sample.slider.single': 'Sheet opacity',
  'gallery.sample.slider.range': 'Storey range',
  'gallery.sample.select.placeholder': 'Choose an element class',
  'gallery.sample.select.wall': 'Wall',
  'gallery.sample.select.column': 'Column',
  'gallery.sample.select.beam': 'Beam',
  'gallery.sample.select.slab': 'Slab',
  'gallery.sample.combobox.placeholder': 'Search layers',
  'gallery.sample.tabs.sheets': 'Sheets',
  'gallery.sample.tabs.measurements': 'Measurements',
  'gallery.sample.tabs.estimates': 'Estimates',
  'gallery.sample.tabs.panel': 'Every sheet in this set, newest first.',
  'gallery.sample.tabs.panel-measurements': 'Every measurement taken off these sheets.',
  'gallery.sample.tabs.panel-estimates': 'Every estimate line these measurements price.',
  'gallery.sample.tooltip.trigger': 'Snap settings',
  'gallery.sample.tooltip.tip': 'Snap to grid intersections',
  'gallery.sample.popover.trigger': 'Sheet details',
  'gallery.sample.popover.body': 'Scale 1:100. Calibrated against grid line A–B.',
  'gallery.sample.dropdown-menu.trigger': 'Sheet actions',
  'gallery.sample.dropdown-menu.rename': 'Rename sheet',
  'gallery.sample.dropdown-menu.duplicate': 'Duplicate sheet',
  'gallery.sample.dropdown-menu.delete': 'Delete sheet',
  'gallery.sample.context-menu.trigger': 'Sheet B-2',
  'gallery.sample.context-menu.rename': 'Rename sheet',
  'gallery.sample.context-menu.duplicate': 'Duplicate sheet',
  'gallery.sample.context-menu.delete': 'Delete sheet',
  'gallery.sample.dialog.trigger': 'Rename sheet',
  'gallery.sample.dialog.title': 'Rename sheet',
  'gallery.sample.dialog.description':
    'The new name appears everywhere this sheet is cited.',
  'gallery.sample.sheet.trigger': 'Open sheet details',
  'gallery.sample.sheet.title': 'Sheet details',
  'gallery.sample.sheet.body': 'Scale 1:100. Calibrated against grid line A–B.',
  'gallery.sample.toaster.trigger': 'Show a notification',
  'gallery.sample.toaster.message': 'Measurement saved.',
  'gallery.sample.badge.neutral': 'Draft',
  'gallery.sample.badge.success': 'Signed',
  'gallery.sample.badge.warn': 'Stale',
  'gallery.sample.badge.danger': 'Voided',
  'gallery.sample.badge.info': 'Imported',
  'gallery.sample.tag.label': 'Layer S-COL',
  'gallery.sample.kbd.modifier': '⌘',
  'gallery.sample.kbd.letter': 'K',
  'gallery.sample.progress.name': 'Upload progress',
  'gallery.sample.separator.before': 'Sheets',
  'gallery.sample.separator.after': 'Estimates',
  'gallery.sample.empty-state.title': 'No sheets in this set.',
  'gallery.sample.empty-state.teach': 'Upload a drawing to start measuring.',
  'gallery.sample.empty-state.action': 'Upload a drawing',
  'gallery.sample.permission-denied.holder': 'the project lead',
  'gallery.sample.evidence-link.label': 'View sheet B-2',
  'gallery.sample.consequence-dialog.trigger': 'Void signatures',
  'gallery.sample.consequence-dialog.title': 'Void signatures',
  'gallery.sample.consequence-dialog.voided': 'Signatures voided',
  'gallery.sample.consequence-dialog.reopened': 'Estimate lines reopened',

  /* ---- The data table (§6): its columns, its rows and why it can be empty --------------- */
  'gallery.sample.data-table.element': 'Element',
  'gallery.sample.data-table.quantity': 'Quantity',
  'gallery.sample.data-table.unit': 'Unit',
  'gallery.sample.data-table.basis': 'Basis',
  'gallery.sample.data-table.empty': 'No measurements match this filter.',
  /*
   * The element of a row is its class, not its name: two walls, two columns, two beams and two
   * slabs, so `grouped` — which groups on this column (§6) — draws the four groups §6 names
   * rather than eight groups of one. The row's identity is carried by its quantity and basis.
   */
  'gallery.sample.data-table.row-1': 'Wall',
  'gallery.sample.data-table.row-2': 'Wall',
  'gallery.sample.data-table.row-3': 'Column',
  'gallery.sample.data-table.row-4': 'Column',
  'gallery.sample.data-table.row-5': 'Beam',
  'gallery.sample.data-table.row-6': 'Beam',
  'gallery.sample.data-table.row-7': 'Slab',
  'gallery.sample.data-table.row-8': 'Slab',
} as const);

/** The keys this half of the module table carries. */
export type EntryStringKey = keyof typeof ENTRY_STRINGS;
