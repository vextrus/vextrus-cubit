/**
 * `cx` — join the class names a primitive paints with the ones its caller passed.
 *
 * Every primitive carries Datum classes of its own and accepts a `className` from the screen
 * that mounts it; without this the two would be concatenated by hand at forty call sites, and
 * the `undefined` a missing prop leaves behind would reach the DOM as the word "undefined".
 * Deliberately not a class-variance library: R-UI-001 puts the variants in the stylesheet,
 * selected by `data-*`, so there is nothing here to merge or override.
 */
export function cx(...parts: readonly (string | false | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
}
