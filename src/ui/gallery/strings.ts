/**
 * The gallery module's string table (R-SPINE-060).
 *
 * "Every user-facing string lives in one typed string table (`src/ui/strings.ts` per module)
 * keyed by id with English values; the compiler refuses a missing key; no string literals in
 * JSX except test ids and codes." This is that table for `src/ui/gallery/**`: the state
 * labels below, and — spread in from where the entries keep their own words — every entry
 * title and every sample string the Design Decision §5–§6 quotes.
 *
 * The values are the decision's, verbatim (AM-03 (2)); a gallery that needs a new word adds it
 * to docs/design/s-design.md first.
 */
import { ENTRY_STRINGS } from './entries/strings';

export const GALLERY_STRINGS = Object.freeze({
  ...ENTRY_STRINGS,

  /* ---- State labels: the state name, hyphens as spaces, sentence case ------------------ */
  'gallery.state.primary': 'Primary',
  'gallery.state.secondary': 'Secondary',
  'gallery.state.ghost': 'Ghost',
  'gallery.state.danger': 'Danger',
  'gallery.state.with-icon': 'With icon',
  'gallery.state.disabled': 'Disabled',
  'gallery.state.loading': 'Loading',
  'gallery.state.default': 'Default',
  'gallery.state.invalid': 'Invalid',
  'gallery.state.unchecked': 'Unchecked',
  'gallery.state.checked': 'Checked',
  'gallery.state.indeterminate': 'Indeterminate',
  'gallery.state.off': 'Off',
  'gallery.state.on': 'On',
  'gallery.state.single': 'Single',
  'gallery.state.range': 'Range',
  'gallery.state.placeholder': 'Placeholder',
  'gallery.state.selected': 'Selected',
  'gallery.state.neutral': 'Neutral',
  'gallery.state.success': 'Success',
  'gallery.state.warn': 'Warn',
  'gallery.state.info': 'Info',
  'gallery.state.removable': 'Removable',
  'gallery.state.zero': 'Zero',
  'gallery.state.half': 'Half',
  'gallery.state.full': 'Full',
  'gallery.state.horizontal': 'Horizontal',
  'gallery.state.vertical': 'Vertical',
  'gallery.state.with-action': 'With action',
  'gallery.state.labelled': 'Labelled',
  'gallery.state.comfortable': 'Comfortable',
  'gallery.state.compact': 'Compact',
  'gallery.state.grouped': 'Grouped',
  'gallery.state.empty': 'Empty',
  'gallery.state.measured': 'Measured',
  'gallery.state.transcribed': 'Transcribed',
  'gallery.state.derived': 'Derived',
  'gallery.state.imported': 'Imported',
  'gallery.state.entered': 'Entered',
  'gallery.state.interpreted': 'Interpreted',
  'gallery.state.defaulted': 'Defaulted',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type GalleryStringKey = keyof typeof GALLERY_STRINGS;

/** Read one string by a key the compiler can check. */
export function gs(key: GalleryStringKey): string {
  return GALLERY_STRINGS[key];
}

/**
 * Read one string by a key assembled at run time from an entry id or a state name.
 *
 * The screen walks a registry, so the key for a title or a state label is `gallery.entry.` and
 * an id the compiler cannot narrow. It throws rather than rendering a blank: a state cell with
 * no label is a copy defect that would otherwise ship silently, and R-SPINE-060's whole point
 * is that a missing key is loud.
 */
export function gsKeyed(key: string): string {
  const table: Readonly<Record<string, string | undefined>> = GALLERY_STRINGS;
  const value = table[key];
  if (value === undefined) throw new Error(`Unregistered gallery string: ${key}`);
  return value;
}
