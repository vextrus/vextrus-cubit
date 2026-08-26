// The root layout every route and the root error boundary render inside. It carries no chrome and
// no styling: the Datum token source (R-UI-001) does not exist in the tree, and a colour or a font
// spelled here would be a value no token owns.
import type { ReactNode } from "react";

/**
 * Which theme the document is in (R-UI-001). The token source declares its whole dark half under
 * `[data-theme="dark"]` on the document root, and nothing else in the tree ever sets that attribute
 * — so without this line the dark half is unreachable from a browser: a reader whose system asks
 * for dark is served the light surface at every route, and S-Auth's one lawful `[data-theme]` rule
 * (the mark swap, Decision I-10) can never fire.
 *
 * It cannot be done in CSS. `prefers-color-scheme` is a media query, an attribute is not something
 * a media query can set, and re-declaring the dark values under a second selector would fork the
 * token source into two homes (B-17). So the document states which theme it is, from the one signal
 * a first paint has: the reader's own system preference.
 *
 * Inline and first in the body, because a theme applied after hydration is a flash of the wrong
 * surface on every load. It stays subscribed, so a reader whose system turns dark at dusk is not
 * left on the theme they opened the tab in. A person's *explicit* choice is the shell's to offer,
 * and it layers on top of this by writing the same attribute — which is why the attribute is set
 * once here rather than each screen consulting the query itself.
 */
const THEME_SYNC = [
  "(function(){",
  'var root=document.documentElement,q=window.matchMedia("(prefers-color-scheme: dark)");',
  'var apply=function(){root.setAttribute("data-theme",q.matches?"dark":"light");};',
  "apply();q.addEventListener(\"change\",apply);",
  "})();",
].join("");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The attribute is written by the script above before React hydrates, so the server's markup and
    // the client's document differ by exactly that attribute, by design.
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SYNC }} />
        {children}
      </body>
    </html>
  );
}
