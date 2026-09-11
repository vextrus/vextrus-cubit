"use server";
// The density write, as a screen asks for it (R-UI-005). The mode is the only thing the caller
// sends: whose preference it is, is the session's answer and never a screen's — a request that
// could name its own account could write somebody else's preference.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DENSITIES, setDensity, type Density } from "../../core/prefs";
import { parsed } from "../call";
import { presentedSessionToken } from "./session";
import { viewerFor } from "./viewer";

/**
 * The workspace layout, as the route it is: the frame publishes the stored mode on `shell-root`, so
 * a written preference is re-read where it is rendered rather than mirrored in the browser.
 */
const WORKSPACE_LAYOUT = "/t/[tenant]";

/**
 * The mode a caller may state, read by the one reading this tier has (`@/server/call`). This door
 * answers nothing — a toggle sets a preference and the frame re-renders — so a mode outside the
 * roster cannot be carried back as an answer the way a screen's own refusal is; it is RAISED as the
 * registered REQUEST_MALFORMED instead of as a plain Error, which is what keeps a caller's mistake off the
 * fault seam and out of the operator's record of our outages (ARCH-03, B-21).
 */
const mode = parsed(z.enum(DENSITIES as readonly [Density, ...Density[]], { error: "that is no mode R-UI-005 names" }));

/**
 * Store the mode the signed-in account chose. The value is caller-writable, so it is judged here
 * before any seam is reached rather than being carried down to the column's CHECK
 * (docs/design/density-and-prefs.md I-34). A session that no longer resolves is not a permission
 * problem — it gets the remedy that fixes it (ARCH-03).
 */
export async function saveDensity(density: Density): Promise<void> {
  const stated = mode(density);
  const viewer = await viewerFor(await presentedSessionToken());
  if (viewer === null) redirect("/sign-in");

  await setDensity(viewer.userId, stated);
  revalidatePath(WORKSPACE_LAYOUT, "layout");
}
