/**
 * The root layout — the whole application shell this increment founds.
 *
 * It does three things and no more: it brings in the one global stylesheet (Tailwind, the
 * Datum token sheet, the bridge between them — R-UI-001) and the document's own theming
 * (./theme.css: the canvas colour and `color-scheme`, which belong to the document rather
 * than to any screen), and it decides `data-theme` on `<html>` so every token in the sheet
 * resolves against the theme the reader asked for.
 *
 * Why a script rather than a server-read query: the Design Decision (§1) makes /design
 * "statically renderable: no fetch, no auth, no live data", and an App Router *layout* is
 * never handed the query string — only a page is. A blocking script in `<head>` sets the
 * attribute before the first paint, from the same `?theme=` the page reads for its nav, so
 * the document never paints in the wrong theme and no font or colour flashes. The default
 * attribute is `light`, so an unknown value, a missing query and a reader with no JavaScript
 * all land on the light theme the document names as the default.
 */
import type { ReactNode } from 'react';
import '../ui/globals.css';
import './theme.css';

/**
 * Set before paint: `dark` only for the exact value the document names, `light` for a missing
 * query, an unknown value, or a query that cannot be parsed at all.
 */
const THEME_SCRIPT =
  "document.documentElement.dataset.theme=" +
  "new URLSearchParams(window.location.search).get('theme')==='dark'?'dark':'light';";

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
