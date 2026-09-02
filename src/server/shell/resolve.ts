// One render, one resolution (R-SPINE-001). A single navigation paints the layout, the frame and
// the routed screen, and each of them needs to know whose session it is. R-SPINE-001 makes that one
// resolution per request, whoever asks: resolving per asker would put a round trip on the page view
// for each of them, and `resolveSession` writes `sessions.lastSeenAt` when the resolution window has
// passed — so a plain read repeated per asker would issue the same UPDATE more than once.
//
// `cache` is React's own request-scoped memo: it lives exactly as long as the render, so nothing is
// remembered between requests or between people, and outside a render — a test calling a seam
// directly — it simply calls through. The resolution itself stays the identity seam's (B-17): this
// file adds no rule, only the scope the answer is reused in.
import { cache } from "react";
import { resolveSession } from "../auth/session";

/** The session the presented token stands for, resolved once for the render that asks for it. */
export const sessionOf = cache(async (sessionToken: string | null) => (sessionToken === null ? null : resolveSession(sessionToken)));
