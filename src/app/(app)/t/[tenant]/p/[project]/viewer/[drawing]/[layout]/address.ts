// R-UI-031: the address is the camera. Where that is decided is here, and only here (B-17) — the
// screen moves the camera, this module decides whether and how the address is rewritten.
//
// The decision is not "write it", it is "write it if this is still our page". A gesture's last
// frame settles on a timer, and the sheet is left by a link, a Back or a closed tab; a flush that
// arrives after the move would stamp `?v=…` onto whatever page the reader is now standing on,
// which is a viewport parameter on somebody else's address and a Back that returns to it.
import { serialiseViewport } from "../../../../../../../../../modules/takeoff/viewer/client";
import type { Camera } from "../../../../../../../../../modules/takeoff/viewer";

/** The window facts this decision reads, and the one history call it is allowed to make. */
export interface AddressBar {
  readonly location: { readonly pathname: string; readonly search: string; readonly href: string };
  readonly history: { replaceState(data: unknown, unused: string, url: string): void };
}

/**
 * Publish the camera to the address, if the address is still the viewer's own. Answers whether it
 * was published, so a caller can tell "we left" from "we wrote".
 *
 * The camera is replaced rather than pushed, so going back leaves the sheet instead of unwinding a
 * pan; every other query parameter the address carries is kept, because the viewer owns `v` and
 * nothing else on that address.
 */
export function publishViewport(win: AddressBar, ownPathname: string, at: Camera): boolean {
  if (win.location.pathname !== ownPathname) return false;

  const url = new URL(win.location.href);
  url.searchParams.set("v", serialiseViewport(at));
  win.history.replaceState(null, "", `${url.pathname}${url.search}`);
  return true;
}
