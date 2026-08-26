// The root document: the one place the Datum stylesheets are loaded for the whole app, and the one
// element that carries the theme attribute every token value keys off (R-UI-001). Tokens first —
// globals.css consumes the variables tokens.css emits.
import "../ui/tokens.css";
import "../ui/theme/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { strings } from "../ui/strings";

// C-SPINE-PLATFORM: the tab and the page say the product's name from the same table entry.
export const metadata: Metadata = { title: strings.app_title };

// R-UI-001 — "dark mode flips values, never consumer code": the server renders the light theme and
// this resolver flips the single root attribute before first paint when the OS prefers dark. It
// never writes "light", reads no storage and registers no listener, so nothing here is a setting.
const THEME_RESOLVER =
  'try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(_){}';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning` covers the one attribute the resolver lawfully changes under React.
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        {/* First child of <body>: the parser runs it synchronously before any content exists, so no
            frame is ever painted in the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_RESOLVER }} />
        {children}
      </body>
    </html>
  );
}
