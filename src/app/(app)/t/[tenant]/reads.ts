// The reads every screen of the workspace frame makes, each with one home and made once per request
// (B-17, ARCH-02).
//
// A screen inside the frame renders after the layout around it, and both need the same three facts:
// who is asking, which workspace the address names, and the density that person chose. Asked
// separately, one request pays for the whole set twice — the seam is a round trip each time (PB-2).
// React's `cache` memoises a read for the lifetime of one request, so the layout's ask and the
// screen's ask are the same ask, and every screen sees the same answer as the frame around it.
//
// The workspace is read by the name the ADDRESS carries (R-SPINE-002), never by the earliest
// membership: a person who has accepted an invitation holds two workspaces, and the frame renders
// the one they are standing in.
import { cache } from "react";
import { densityFor } from "../../../../core/prefs";
import { viewerFor } from "../../../../server/shell/viewer";
import { namedWorkspaceFor } from "../../../../server/shell/workspace";

/** Who is asking, resolved from the presented session token. */
export const viewerRead = cache(viewerFor);

/** The workspace the address names, admitted by the membership this account genuinely holds. */
export const namedWorkspaceRead = cache(namedWorkspaceFor);

/** The density this person chose, read before paint so no default is shown and then corrected. */
export const densityRead = cache(densityFor);
