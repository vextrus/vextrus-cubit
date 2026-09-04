// The three seam reads the workspace frame makes to paint itself, each memoised for the life of one
// request (React's `cache`). The layout resolves the viewer, the workspace the address names and the
// stored density before it draws the frame; a screen inside that frame needs the same three answers
// and asks for them again rather than being handed them down through props it does not have.
//
// One home for each question (B-17, ARCH-02): every caller comes through here, so "which workspace
// is this screen about" has exactly one answer per request, and asking twice costs one round trip
// instead of two. The seam functions themselves are untouched — this file adds memoisation, never a
// second reading of what the answer means.
import { cache } from "react";
import { densityFor } from "../../../../core/prefs";
import { viewerFor } from "../../../../server/shell/viewer";
import { namedWorkspaceFor } from "../../../../server/shell/workspace";

/** Who is asking, from the token they presented. */
export const viewerRead = cache(viewerFor);

/**
 * The workspace the address names, admitted by the membership the account genuinely holds
 * (R-SPINE-002). It is the address's workspace and not the earliest membership: a person who has
 * accepted an invitation holds two, and a screen inside the frame is about the one the frame is
 * drawn for.
 */
export const namedWorkspaceRead = cache(namedWorkspaceFor);

/** The density this person chose, read once however many screens inside the frame want it. */
export const densityRead = cache(densityFor);
