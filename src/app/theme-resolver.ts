// R-UI-001 — "dark mode flips values, never consumer code": the server renders the light theme and
// this source flips the single root attribute before first paint when the OS prefers dark. It never
// writes "light", reads no storage and registers no listener, so nothing here is a setting.
//
// It has to run before the first frame is painted, so it is inline and can never be an external
// file. That leaves a hash as the only `script-src` source a Content-Security-Policy could ever
// admit it under, and a hash of a string nobody exports is a constant somebody has to keep in step
// by hand. So the source is a value with one home (B-17): the document renders it, the digest is
// derived from that same value, and a suite can run it.
import { createHash } from "node:crypto";

/**
 * The source the document runs, as text — the thing hashed and the thing rendered are one value.
 *
 * Its `catch` is empty on purpose, and the reason is the Decision's theme-resolution section: a UA
 * that publishes no `matchMedia`, or one that throws on it, keeps the light attribute the server
 * already rendered, which is the product's default and a correct document either way. Nothing more
 * can be done before first paint — no fault seam exists in the document yet, there is no screen to
 * tell and no request to record against — so there is nothing for the arm to hold.
 */
export const THEME_RESOLVER =
  'try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(_){}';

/**
 * The digest a `script-src 'sha256-…'` source cites for it: base64 of the SHA-256 of those exact
 * bytes. It is derived rather than transcribed, so the two can never drift apart.
 */
export const THEME_RESOLVER_SHA256 = createHash("sha256").update(THEME_RESOLVER, "utf8").digest("base64");
