/**
 * Where a portalled overlay surface is put (Q-11 / R-UI-012, axe's `region`).
 *
 * Radix portals every floating surface to `document.body`, which puts it outside every
 * landmark on the page — axe's `region` rule then reports the popper wrapper and the select
 * viewport as content no landmark contains. Portalling into the screen's own `main` instead
 * keeps the surface inside a landmark without inventing one, and changes nothing about the
 * paint: the popper wrapper is `position: fixed`, so its box is measured against the viewport
 * wherever it is parented.
 *
 * `undefined` on the server and on a screen with no `main` — Radix then falls back to the body
 * it would have used anyway.
 */
export function surfaceContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector('main') ?? undefined;
}
