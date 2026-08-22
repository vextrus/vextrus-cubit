/**
 * The root layout — the whole application shell this increment founds.
 *
 * It does three things and no more: it brings in the one global stylesheet (./tailwind.css —
 * the application's Tailwind entry, which imports src/ui/globals.css: Tailwind, the Datum token
 * sheet, the bridge between them — R-UI-001) and the document's own theming
 * (./theme.css: the canvas colour and `color-scheme`, which belong to the document rather
 * than to any screen), and it decides `data-theme` on `<html>` so every token in the sheet
 * resolves against the theme the reader asked for.
 *
 * Where the theme comes from: an App Router *layout* is never handed the query string — only a
 * page is — so `?theme=` reaches this file as a request header instead. src/middleware.ts reads
 * it off the incoming URL and forwards the resolved value; `headers()` reads it back here and
 * the attribute is rendered on the server, in the document that actually leaves it. That is the
 * difference that matters: `GET /design?theme=dark` is dark for a reader with no JavaScript, a
 * crawler and `curl`, not only for a browser that has run a script. Nothing is patched after
 * hydration, so there is no attribute for the client to disagree with and no flash of the wrong
 * theme. A missing header — anything the matcher does not cover — resolves to `light`, the
 * default the document names.
 */
import { headers } from 'next/headers';
import { THEME_HEADER, resolveTheme } from './theme-request';
import type { ReactNode } from 'react';
import './tailwind.css';
import './theme.css';

export default async function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): Promise<ReactNode> {
  const theme = resolveTheme((await headers()).get(THEME_HEADER));
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
