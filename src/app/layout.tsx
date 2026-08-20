import { cookies } from 'next/headers';
import './globals.css';
import { ThemeToggle } from '../ui/primitives/theme-toggle';
import { THEME_COOKIE, resolveTheme } from '../ui/primitives/theme';
import { strings } from '../ui/strings/common';

/**
 * The shell every screen sits in: a banner landmark carrying the brand and the
 * theme control, and one main landmark. Landmarks are not decoration — they are
 * how a screen reader user moves (R-UI-060), and axe checks for them (Q-11).
 *
 * The title and description are rendered here, not exported as `metadata`.
 * Next streams exported metadata inside a boundary it tears down and rebuilds on
 * every re-render, so a server action — revoking a session, say — leaves the
 * document with no `<title>` for an instant: measured at one removal per
 * re-render. Anything reading the page in that instant, an accessibility scan
 * included, sees an untitled document (R-UI-060, Q-11). Rendered in the tree,
 * React hoists them into the head once and reconciles them in place.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <title>{strings.brand}</title>
        <meta name="description" content={strings.brandDescription} />

        <header className="appbar">
          <span className="auth-brand">{strings.brand}</span>
          <ThemeToggle initial={theme} />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
