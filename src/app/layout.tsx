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
// this resolver writes the single root attribute before first paint, from the OS preference. It
// reads no storage and offers no choice, so nothing here is a setting.
//
// It answers the preference for as long as the document lives, not only at the moment it loaded: a
// person who flips their OS to dark is answered on the page they are already on, rather than on the
// next document they happen to load. Resolved once at load, a session that began light stayed light
// through every later render while the surface around it — anything keyed on `prefers-color-scheme`
// in the browser itself — had already flipped, which is the palette-mid-flow disagreement a reader
// sees. The listener is on the query, so it fires only when the OS answer actually changes, and it
// writes the same single attribute the first resolution wrote: still one lever, never consumer code.
const THEME_RESOLVER =
  'try{var q=window.matchMedia("(prefers-color-scheme: dark)");' +
  'var r=function(){document.documentElement.setAttribute("data-theme",q.matches?"dark":"light")};' +
  'r();q.addEventListener("change",r)}catch(_){}';

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
