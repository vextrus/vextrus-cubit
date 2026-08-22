/**
 * The `/design` screen's own string table (R-SPINE-060).
 *
 * The chrome around the sheet — its title, its count, its rail, its section headings, its
 * theme control and the words its own R-UI-050 states say. The values are the Design
 * Decision §7's, verbatim: copy is design (AM-03 (2)), so a new word is added to
 * docs/design/s-design.md before it is added here.
 */
export const DESIGN_STRINGS = Object.freeze({
  'design.title': 'Datum',
  'design.count': '{count} components',
  'design.nav': 'Components',
  'design.module.primitives': 'Primitives',
  'design.module.patterns': 'Patterns',
  'design.module.data': 'Data',
  'design.theme': 'Dark theme',
  'design.empty.title': 'No components are registered.',
  'design.empty.teach':
    'Add a gallery entry under src/ui/gallery/entries to put a component on this sheet.',
  'design.permission.holder': 'the design system owner',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type DesignStringKey = keyof typeof DESIGN_STRINGS;

/** Read one string by a key the compiler can check. */
export function dsg(key: DesignStringKey): string {
  return DESIGN_STRINGS[key];
}
