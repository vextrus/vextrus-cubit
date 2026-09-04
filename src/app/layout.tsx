// The root document: the one place the Datum stylesheets are loaded for the whole app, and the one
// element that carries the theme attribute every token value keys off (R-UI-001). Tokens first —
// globals.css consumes the variables tokens.css emits.
import "../ui/tokens.css";
import "../ui/theme/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { strings } from "../ui/strings";
import { THEME_RESOLVER } from "./theme-resolver";

// C-SPINE-PLATFORM: the tab and the page say the product's name from the same table entry.
export const metadata: Metadata = { title: strings.app_title };

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
