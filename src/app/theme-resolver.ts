// The pre-paint theme resolver, named once and published with its digest (B-17, ARCH-02).
//
// R-UI-001 — "dark mode flips values, never consumer code": the server renders the light theme and
// this resolver flips the single root attribute before first paint when the OS prefers dark. It
// never writes "light", reads no storage and registers no listener, so nothing here is a setting.
//
// docs/design/root-document.md I-10 fixes it as an INLINE script, and the way a Content-Security
// -Policy admits one of those is a `script-src 'sha256-…'` source: the base64 SHA-256 of the
// script's exact text. So the text has one home and its digest is published beside it — a header
// citing a digest of anything else blocks the product's own script. The document renders this very
// string, and the pair is pinned by tests/app/theme-resolver.test.tsx.

/** The resolver's text, exactly as the document carries it. */
export const THEME_RESOLVER =
  'try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(_){}';

/** The base64 SHA-256 of `THEME_RESOLVER` — the form a `script-src 'sha256-…'` source cites. */
export const THEME_RESOLVER_SHA256 = "U5b5k89vJo1se7x/hTidftQ5afKSmqBf/ol/dhTa3yk=";
