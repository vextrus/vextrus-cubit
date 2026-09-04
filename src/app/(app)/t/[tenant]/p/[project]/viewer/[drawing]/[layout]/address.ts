// R-UI-031: the address is the camera. Publishing it has one home (B-17) — the screen keeps no
// second copy of the rule — and the rule is that a camera is written onto the sheet's OWN address
// and no other. A settle or an unmount flush can fire after the reader has already followed a link,
// and the window it would then rewrite belongs to whatever page they landed on: the effect is a
// stranger's address wearing this sheet's viewport.
//
// The camera's text is the viewer module's own serialisation, asked for rather than re-derived
// (ARCH-02).
import type { Camera } from "../../../../../../../../../modules/takeoff/viewer";
import { serialiseViewport } from "../../../../../../../../../modules/takeoff/viewer/client";

/** As much of a window as publishing an address needs: where it is, and how it is replaced. */
export interface AddressWindow {
  location: { pathname: string; search: string; href: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
}

/** The pathname a sheet is addressed at, each segment written as an address writes it. */
export function viewerPathname(at: { tenantId: string; projectId: string; drawingId: string; layoutName: string }): string {
  const segments = [at.tenantId, at.projectId, at.drawingId, at.layoutName].map((segment) => encodeURIComponent(segment));
  return `/t/${segments[0]}/p/${segments[1]}/viewer/${segments[2]}/${segments[3]}`;
}

/**
 * Write the camera into the address, and answer whether it was written. The address is REPLACED
 * rather than pushed, so going back leaves the sheet instead of unwinding a pan, and every other
 * query parameter the address carries survives — this publisher owns `v` and nothing else.
 *
 * A window standing somewhere other than the sheet this publisher belongs to is left untouched.
 */
export function publishViewport(win: AddressWindow, ownPathname: string, at: Camera): boolean {
  if (!standingAt(win.location.pathname, ownPathname)) return false;
  const url = new URL(win.location.href);
  url.searchParams.set("v", serialiseViewport(at));
  win.history.replaceState(null, "", `${url.pathname}${url.search}`);
  return true;
}

/**
 * Is this window standing at that address? The two are compared as the segments they NAME, never as
 * the text they happen to be written in: a browser leaves `: @ $ & + , ; =` unescaped in a path
 * segment where `encodeURIComponent` escapes them, a mailed or typed address may spell its escapes
 * in lower case, and a deployment may serve the app under a prefix — none of which moves the reader
 * off this sheet, while a text comparison would answer that it did and stop publishing with no
 * signal anywhere.
 */
function standingAt(pathname: string, ownPathname: string): boolean {
  return named(pathname).endsWith(named(ownPathname));
}

/** The segments a pathname names, each read the way a query is read. */
function named(pathname: string): string {
  return pathname.split("/").map(readSegment).join("/");
}

/** What the query grammar spends on structure and a path segment spends on nothing but text. */
const QUERY_STRUCTURE = /[+&=]/g;
const AS_ESCAPE: Readonly<Record<string, string>> = { "+": "%2B", "&": "%26", "=": "%3D" };

/**
 * One segment as the text it names. The decode is the query parser's, which answers on a malformed
 * escape where `decodeURIComponent` throws — and a thrown address would be one more silent way for
 * the camera to stop being published. The three characters that grammar reads as structure are
 * escaped first, because in a path they are none: an unescaped `&` would otherwise end the segment
 * mid-name and a `+` would be read as a space.
 */
function readSegment(segment: string): string {
  const asQuery = segment.replaceAll(QUERY_STRUCTURE, (char) => AS_ESCAPE[char] ?? char);
  return new URLSearchParams(`s=${asQuery}`).get("s") ?? segment;
}
