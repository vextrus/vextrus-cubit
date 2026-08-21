/**
 * PostCSS — Tailwind 4's bridge, and nothing else.
 *
 * `src/ui/globals.css` opens with `@import 'tailwindcss'`; without this plugin `next build`
 * ships that line to the browser verbatim and the app renders unstyled (R-UI-001's tokens
 * still arrive, but not one utility does).
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
