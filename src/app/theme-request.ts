/**
 * The one place the `?theme=` contract is spelled, shared by the two halves that answer a
 * request for a themed document: the middleware that reads the query off the incoming URL and
 * the root layout that renders the answer onto `<html>`.
 *
 * §1 of the Design Decision: `dark` for that exact value; light for a missing query, an unknown
 * value, or a query that cannot be parsed at all.
 */

/** The request header the middleware carries the resolved theme in. Internal to this app. */
export const THEME_HEADER = 'x-cubit-theme';

/** The two themes the document ships (AC-1). */
export type DocumentTheme = 'light' | 'dark';

/** The default: everything that is not the exact word `dark`. */
export function resolveTheme(value: string | null | undefined): DocumentTheme {
  return value === 'dark' ? 'dark' : 'light';
}
