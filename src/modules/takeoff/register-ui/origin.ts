// Where the row a Trace was followed back from stands in the table the reader is looking at (I-182).
//
// The answer is a function of the rows HANDED IN: the table sorts and the screen filters, so the row
// a reader came back to stands where the table put it, never where the unsorted list holds it. An
// origin no rendered row stands for answers nothing — nothing is scrolled to, nothing is focused and
// nothing is said about it (R-UI-050).

/** As far as this reading looks at a row: the line it stands for. */
type RenderedRow = { readonly lineId: string };

/** The index the origin renders at, or null where these rows do not render it. */
export function originRowIndexOf(renderedRows: readonly RenderedRow[], originLine: string | null): number | null {
  if (originLine === null) return null;
  const index = renderedRows.findIndex((row) => row.lineId === originLine);
  return index < 0 ? null : index;
}
