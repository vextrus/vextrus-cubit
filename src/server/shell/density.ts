"use server";
// The density write, as a screen asks for it (R-UI-005). The mode is the only thing the caller
// sends: whose preference it is, is the session's answer and never a screen's — a request that
// could name its own account could write somebody else's preference.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DENSITIES, setDensity, type Density } from "../../core/prefs";
import { presentedSessionToken } from "./session";
import { viewerFor } from "./viewer";

/**
 * The workspace layout, as the route it is: the frame publishes the stored mode on `shell-root`, so
 * a written preference is re-read where it is rendered rather than mirrored in the browser.
 */
const WORKSPACE_LAYOUT = "/t/[tenant]";

/**
 * Store the mode the signed-in account chose. The value is caller-writable, so it is judged here
 * before any seam is reached: a mode outside the roster is refused as the fault it is rather than
 * carried down to the column's CHECK (docs/design/density-and-prefs.md I-34). A session that no
 * longer resolves is not a permission problem — it gets the remedy that fixes it (ARCH-03).
 */
export async function saveDensity(density: Density): Promise<void> {
  if (!(DENSITIES as readonly string[]).includes(density)) {
    throw new Error(`saveDensity was asked for ${JSON.stringify(density)}, which is no mode R-UI-005 names`);
  }
  const viewer = await viewerFor(await presentedSessionToken());
  if (viewer === null) redirect("/sign-in");

  await setDensity(viewer.userId, density);
  revalidatePath(WORKSPACE_LAYOUT, "layout");
}
