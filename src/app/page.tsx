/**
 * `/` — the only route the V-E2E lane serves this increment (test contract).
 *
 * J-000 asserts three things about this page: that `[data-testid="app-root"]` is on it,
 * that axe finds no violation, and that it renders the committed Linux baseline. So it is
 * a <main> (page content outside a landmark is an axe violation) carrying a heading (a page
 * with no h1 is another), and it is deliberately spare: every glyph on it is a glyph the
 * visual comparison has to reproduce byte-for-byte on another machine.
 *
 * `V-E2E` is the lane's own name — a code in R-SPINE-060's sense, rendered verbatim, not
 * copy a designer wrote. The screens that supersede this page key their strings in the
 * module string table.
 */
export default function Page() {
  return (
    <main data-testid="app-root">
      <h1>V-E2E</h1>
    </main>
  );
}
