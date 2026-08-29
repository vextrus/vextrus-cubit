"use server";
// What the workspace screens ask the server to do. Each one names its seam and answers with what
// the seam answered: a registered refusal is carried back to the screen that asked, never turned
// into a fault and never swallowed (ARCH-03, B-21).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RefusalCode } from "../../../../core/errors";
import { refusalCodeOf } from "../../../../core/faults/refusal-marker";
import { archiveProject, createProject, restoreProject, updateProject, type ProjectsCtx } from "../../../../modules/spine/projects";
import { sampleSeed, type SampleSeedAnswer } from "../../../../server/shell/sample-seed";
import { endSession, presentedSessionToken } from "../../../../server/shell/session";
import { viewerFor } from "../../../../server/shell/viewer";
import { renameWorkspace, workspaceFor, type RenameAnswer } from "../../../../server/shell/workspace";
import { hasVisibleText, shellHref } from "../../../../ui/shell";
import { judgeProject, presentedProject, type ProjectJudgement } from "./home/judgement";

/** The user menu's way out: the session ends, and `/sign-in` is itself the visible way back in. */
export async function signOutAction(): Promise<void> {
  await endSession(await presentedSessionToken());
  redirect("/sign-in");
}

/** R-UI-033's one-click SAMPLE offer, answered by the seam that seeds the set. */
export async function offerSampleAction(): Promise<SampleSeedAnswer> {
  return sampleSeed();
}

/**
 * The name the door would not carry to the seam: R-UI-033 asks for an entered name, and a name
 * with nothing visible in it enters nothing. The stored name is untouched by construction — the
 * seam is never asked — and the screen says so in its own copy, so the closed refusal taxonomy
 * (R-SPINE-062) gains nothing for a value the door itself can judge.
 */
export interface BlankNameAnswer {
  renamed: false;
  blankName: true;
}

/** What the settings form is showing: nothing yet, or the answer the last submission produced. */
export type RenameFormState = RenameAnswer | BlankNameAnswer | null;

/**
 * R-UI-033's rename, driven by the form itself: the name as the person presented it, and the
 * workspace the form was rendered for. The workspace name is on every screen of the frame, so a
 * saved name is re-read there too — the layout is the one place it is rendered from.
 */
export async function renameWorkspaceAction(_shown: RenameFormState, form: FormData): Promise<RenameFormState> {
  const tenantId = String(form.get("tenantId") ?? "");
  const name = String(form.get("name") ?? "");
  // "An entered name is a name with something visible in it" (I-22) is judged in its one home, so
  // a name of zero-width characters is refused here exactly as a name of spaces is.
  if (!hasVisibleText(name)) return { renamed: false, blankName: true };

  const answer = await renameWorkspace({
    sessionToken: await presentedSessionToken(),
    tenantId,
    name,
  });
  if (answer.renamed) revalidatePath(shellHref(tenantId, "projects"), "layout");
  return answer;
}

/** What the project form is showing: nothing yet, or the answer the last submission produced. */
export type ProjectFormState =
  | { saved: true; projectId: string }
  | { saved: false; judgement: ProjectJudgement }
  | { saved: false; refusal: RefusalCode }
  | null;

/** What a lifecycle door answered: it was done, or the registered refusal that stopped it. */
export type LifecycleAnswer = { done: true } | { done: false; refusal: RefusalCode };

/**
 * R-SPINE-010's create and edit, through the one form that serves both: a submission carrying a
 * project id edits that project, and one carrying none creates a project. The fields are judged
 * before the seam is called (I-34) — the browser judged them too, and a submission that reached
 * here without them is answered with the same sentence rather than with a driver fault.
 */
export async function saveProjectAction(_shown: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  const tenantId = String(form.get("tenantId") ?? "");
  const projectId = String(form.get("projectId") ?? "");
  const actor = await actorIn(tenantId);
  if (typeof actor === "string") return { saved: false, refusal: actor };

  const judged = judgeProject(presentedProject(form));
  if (!judged.presentable) return { saved: false, judgement: judged.refused };

  return attempted<ProjectFormState>(
    tenantId,
    async () => {
      if (projectId === "") {
        const created = await createProject(actor, judged.fields);
        return { saved: true, projectId: created.projectId };
      }
      await updateProject(actor, { projectId, ...judged.fields });
      return { saved: true, projectId };
    },
    (refusal) => ({ saved: false, refusal }),
  );
}

/** AC-4's archive: the marker moves and nothing is deleted (L-ACT-03's lifecycle guard). */
export async function archiveProjectAction(tenantId: string, projectId: string): Promise<LifecycleAnswer> {
  const actor = await actorIn(tenantId);
  if (typeof actor === "string") return { done: false, refusal: actor };
  return attempted<LifecycleAnswer>(
    tenantId,
    async () => {
      await archiveProject(actor, { projectId });
      return { done: true };
    },
    (refusal) => ({ done: false, refusal }),
  );
}

/** …and its undo: archiving is reversible, so restore puts the marker back where it found it. */
export async function restoreProjectAction(tenantId: string, projectId: string): Promise<LifecycleAnswer> {
  const actor = await actorIn(tenantId);
  if (typeof actor === "string") return { done: false, refusal: actor };
  return attempted<LifecycleAnswer>(
    tenantId,
    async () => {
      await restoreProject(actor, { projectId });
      return { done: true };
    },
    (refusal) => ({ done: false, refusal }),
  );
}

/**
 * Who is asking, and of which workspace — or the registered refusal that answers instead. A cookie
 * that no longer stands for a live session is SIGNED_OUT, whose remedy is signing in again; an
 * address naming a workspace this session does not hold is PERMISSION_NOT_HELD, which is the same
 * answer the layout gives for the same reason (ARCH-03, B-21).
 */
async function actorIn(tenantId: string): Promise<ProjectsCtx | RefusalCode> {
  const presented = await presentedSessionToken();
  const viewer = await viewerFor(presented);
  if (viewer === null) return "SIGNED_OUT";
  const workspace = await workspaceFor(presented);
  if (workspace === null || workspace.tenantId !== tenantId) return "PERMISSION_NOT_HELD";
  return { tenantId, userId: viewer.userId, actorKind: "human" };
}

/**
 * A seam call whose registered refusal is carried back to the screen that asked, and whose success
 * re-reads the grid the answer changed. Anything the seam did not mark as a refusal is a fault and
 * travels on to the error path unchanged — a swallowed catch is how an outage becomes a shrug
 * (ARCH-03, B-21).
 */
async function attempted<T>(tenantId: string, write: () => Promise<T>, refused: (refusal: RefusalCode) => T): Promise<T> {
  try {
    const answer = await write();
    revalidatePath(shellHref(tenantId, "projects"));
    return answer;
  } catch (thrown) {
    if (refusalCodeOf(thrown) !== "PERMISSION_NOT_HELD") throw thrown;
    return refused("PERMISSION_NOT_HELD");
  }
}
