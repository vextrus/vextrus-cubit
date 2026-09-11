// R-UI-001 — "dark mode flips values, never consumer code". The Bible's ground is dark-first, so the
// server renders dark and this source settles the one root attribute before the first frame is
// painted. It resolves in BOTH directions, which the earlier version did not: it only ever wrote
// "dark", so a device that preferred light was answered by whatever the server had already rendered.
// That is not a detail. It is how the Surveyor photographs the product: the stage drives a theme
// with `page.emulateMedia({ colorScheme })` (vextrus-builder src/stage/driver.ts), and against a
// write-only resolver half of that instrument did nothing — the light capture of a dark-default
// product would have been dark, and nobody would have been able to tell that from a bug in a screen.
//
// Precedence, highest first: the instrument's `?__theme=` flag (only where the document says the
// instrument is armed), the person's own stored choice, then the operating system's preference.
//
// It has to run before the first frame is painted, so it is inline and can never be an external
// file. That leaves a hash as the only `script-src` source a Content-Security-Policy could ever
// admit it under, and a hash of a string nobody exports is a constant somebody has to keep in step
// by hand. So the source is a value with one home (B-17): the document renders it, the digest is
// derived from that same value, and a suite can run it.
import { createHash } from "node:crypto";

/** The cookie the person's own choice is kept in — readable before paint, by a script with no imports. */
export const THEME_COOKIE = "cx-theme";

/**
 * The attribute the document carries when the evidence instrument is armed. A `?__theme=` flag in a
 * URL is a capability, so it is not one a served production document grants: without this attribute
 * the resolver never reads the query string at all.
 */
export const THEME_INSTRUMENT_ATTRIBUTE = "data-ui-instrument";

/**
 * The source the document runs, as text — the thing hashed and the thing rendered are one value.
 *
 * Its `catch` is empty on purpose, and the reason is the Decision's theme-resolution section: a UA
 * that publishes no `matchMedia`, or one that throws on it, keeps the dark attribute the server
 * already rendered, which is the product's default and a correct document either way. Nothing more
 * can be done before first paint — no fault seam exists in the document yet, there is no screen to
 * tell and no request to record against — so there is nothing for the arm to hold.
 */
export const THEME_RESOLVER =
  'try{var d=document.documentElement,t=null,m;' +
  `if(d.hasAttribute("${THEME_INSTRUMENT_ATTRIBUTE}")){m=/[?&]__theme=(dark|light)/.exec(location.search);if(m){t=m[1]}}` +
  `if(!t){m=/(?:^|; )${THEME_COOKIE}=(dark|light)/.exec(document.cookie);if(m){t=m[1]}}` +
  'if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}' +
  'd.setAttribute("data-theme",t)}catch(_){}';

/**
 * The digest a `script-src 'sha256-…'` source cites for it: base64 of the SHA-256 of those exact
 * bytes. It is derived rather than transcribed, so the two can never drift apart.
 */
export const THEME_RESOLVER_SHA256 = createHash("sha256").update(THEME_RESOLVER, "utf8").digest("base64");

/**
 * Whether this installation arms the evidence instrument: the `?__theme=` and `?__state=` flags.
 * A production deployment arms nothing unless it is told to by name, so a URL cannot be forged into
 * a capability on an installation that never opted in.
 */
export const uiInstrumentArmed = (): boolean =>
  process.env["NODE_ENV"] !== "production" || process.env["CUBIT_UI_INSTRUMENT"] === "1";
