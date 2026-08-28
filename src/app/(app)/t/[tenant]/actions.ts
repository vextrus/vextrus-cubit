"use server";
// What the workspace screens ask the server to do. Each one names its seam and answers with what
// the seam answered: a registered refusal is carried back to the screen that asked, never turned
// into a fault and never swallowed (ARCH-03, B-21).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sampleSeed, type SampleSeedAnswer } from "../../../../server/shell/sample-seed";
import { endSession, presentedSessionToken } from "../../../../server/shell/session";
import { renameWorkspace, type RenameAnswer } from "../../../../server/shell/workspace";
import { shellHref } from "../../../../ui/shell";

/** The user menu's way out: the session ends, and `/sign-in` is itself the visible way back in. */
export async function signOutAction(): Promise<void> {
  await endSession(await presentedSessionToken());
  redirect("/sign-in");
}

/** R-UI-033's one-click SAMPLE offer, answered by the seam that seeds the set. */
export async function offerSampleAction(): Promise<SampleSeedAnswer> {
  return sampleSeed();
}

/** What the settings form is showing: nothing yet, or the answer the seam last gave it. */
export type RenameFormState = RenameAnswer | null;

/**
 * R-UI-033's rename, driven by the form itself: the name as the person presented it, and the
 * workspace the form was rendered for. The workspace name is on every screen of the frame, so a
 * saved name is re-read there too — the layout is the one place it is rendered from.
 */
export async function renameWorkspaceAction(_shown: RenameFormState, form: FormData): Promise<RenameFormState> {
  const tenantId = String(form.get("tenantId") ?? "");
  const answer = await renameWorkspace({
    sessionToken: await presentedSessionToken(),
    tenantId,
    name: String(form.get("name") ?? ""),
  });
  if (answer.renamed) revalidatePath(shellHref(tenantId, "projects"), "layout");
  return answer;
}
