// The root document: the one place the Datum stylesheets are loaded for the whole app, and the one
// element that carries the theme attribute every token value keys off (R-UI-001). Tokens first —
// globals.css consumes the variables tokens.css emits.
import "../ui/tokens.css";
import "../ui/theme/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { strings } from "../ui/strings";
import { THEME_INSTRUMENT_ATTRIBUTE, THEME_RESOLVER, uiInstrumentArmed } from "./theme-resolver";

// C-SPINE-PLATFORM: the tab and the page say the product's name from the same table entry.
export const metadata: Metadata = { title: strings.app_title };

// Q-12: the Content-Security-Policy this product serves admits Next's inline runtime bootstraps by a
// nonce minted per request, and Next can only stamp that nonce onto them while it renders. Cached
// HTML would carry a stale one, so every route renders per request. This is a segment config, which
// is why `RootLayout` below stays synchronous — reading `headers()` here instead would make the one
// document the whole app hangs from an async component for no gain.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  // The instrument's flags are a capability, granted by the installation and never by a URL.
  const instrument = uiInstrumentArmed() ? { [THEME_INSTRUMENT_ATTRIBUTE]: "" } : {};
  return (
    // The Bible's ground is dark (R-UI-001): dark is what the server renders, and the resolver below
    // settles it to the person's own answer before the first frame is painted.
    // `suppressHydrationWarning` covers the one attribute the resolver lawfully changes under React.
    <html lang="en" data-theme="dark" suppressHydrationWarning {...instrument}>
      <body>
        {/* First child of <body>: the parser runs it synchronously before any content exists, so no
            frame is ever painted in the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_RESOLVER }} />
        {children}
      </body>
    </html>
  );
}
