"use server";
// What the workspace screens ask the server to do. Each one names its seam and answers with what
// the seam answered: a registered refusal is carried back to the screen that asked, never turned
// into a fault and never swallowed (ARCH-03, B-21).
//
// Every door that takes anything from a browser is opened through the one server-call seam
// (`@/server/call`): it reads what was submitted against the schemas below, resolves the presented
// session ONCE for the action, and carries a registered refusal back in each screen's own answer
// shape. A submission that is not the shape a door is asked in is answered REQUEST_MALFORMED — a form post
// missing the workspace it is about states nothing this tier can act on, and guessing at it is how a
// write lands in the wrong place. The two doors that state nothing at all — signing out and taking
// the sample offer — are handed nothing to read, so they stand as they are.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { archiveProject, createProject, restoreProject, updateProject, type ProjectsCtx } from "@/modules/spine/projects";
import type { AuthSession } from "@/server/auth/session";
import { authorize } from "@/server/authorize";
import { serverCall } from "@/server/call";
import { sampleSeed, type SampleSeedAnswer } from "@/server/shell/sample-seed";
import { endSession, presentedSessionToken } from "@/server/shell/session";
import { renameWorkspace, type RenameAnswer } from "@/server/shell/workspace";
// The two pure helpers, from the module that holds them (B-17) rather than from the barrel that
// re-exports them: the barrel also carries the frame's client components and the shell stylesheet,
// and a "use server" module that imports it drags both into every action bundle.
import { hasVisibleText, shellHref } from "@/ui/shell/routes";
import { judgeProject, presentedProject, type PresentedProject, type ProjectJudgement } from "./home/judgement";

/** The user menu's way out: the session ends, and `/sign-in` is itself the visible way back in. */
export async function signOutAction(): Promise<void> {
  await endSession(await presentedSessionToken());
  // The session is gone from the server, but the router still holds every rendered segment of the
  // frame this account was signed into — so browser Back repaints the workspace, its roster and its
  // project names for whoever is now standing at the machine. The cache is purged from the root as
  // a layout, before the redirect: `redirect` ends this action by throwing, so a purge written
  // after it would never run.
  revalidatePath("/", "layout");
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
/** What the rename form states: which workspace it was rendered for, and the name as presented. */
const RENAMED = z.object({ tenantId: z.string(), name: z.string() });

const renaming = serverCall(
  RENAMED,
  async (stated): Promise<RenameFormState> => {
    // The rename seam is handed the presented token rather than the resolved session: `renameWorkspace`
    // owns both the membership question and the resolution behind it (R-SPINE-001), and re-cutting
    // that seam to take an account id would be this file deciding who may rename a workspace — which
    // is the one thing a transport never decides (B-17, ARCH-02).
    const answer = await renameWorkspace({ sessionToken: await presentedSessionToken(), tenantId: stated.tenantId, name: stated.name });
    if (answer.renamed) revalidatePath(shellHref(stated.tenantId, "projects"), "layout");
    return answer;
  },
  (refusal): RenameFormState => ({ renamed: false, refusal }),
);

/**
 * R-UI-033's rename, driven by the form itself: the name as the person presented it, and the
 * workspace the form was rendered for. The workspace name is on every screen of the frame, so a
 * saved name is re-read there too — the layout is the one place it is rendered from.
 *
 * "An entered name is a name with something visible in it" (I-22) is judged HERE, before the server
 * call is made at all: a name with nothing in it enters nothing, the stored name is untouched by
 * construction because no seam is asked — not even the one that resolves the session — and the
 * closed refusal taxonomy (R-SPINE-062) gains nothing for a value the door itself can judge. Only a
 * submission that got past that judgement is read, sessioned and carried (ARCH-03).
 */
export async function renameWorkspaceAction(_shown: RenameFormState, form: FormData): Promise<RenameFormState> {
  if (!hasVisibleText(String(form.get("name") ?? ""))) return { renamed: false, blankName: true };
  return renaming(Object.fromEntries(form));
}

/** What L-ACT-03 makes project lifecycle move: the PRINCIPAL-only bundle the seam refuses by name. */
const LIFECYCLE_PERMISSION = "ADMINISTER_PROJECT" as const;

/** What the project form is showing: nothing yet, or the answer the last submission produced. */
export type ProjectFormState =
  | { saved: true; projectId: string }
  | { saved: false; judgement: ProjectJudgement }
  | { saved: false; refusal: RefusalCode }
  | null;

/** What a lifecycle door answered: it was done, or the registered refusal that stopped it. */
export type LifecycleAnswer = { done: true } | { done: false; refusal: RefusalCode };

/**
 * What a submission states at the three project doors: the workspace it was made in, the project it
 * is about (none, for a creation), and — for the form — the fields as the person presented them. The
 * fields' presentability is not judged here: I-34 puts that in one home (`./home/judgement`), which
 * the browser and this door both read, and a second reading would be a second answer.
 */
const PRESENTED: z.ZodType<PresentedProject> = z.object({
  name: z.string(),
  code: z.string(),
  client: z.string(),
  siteAddress: z.string(),
  district: z.string(),
  buildingType: z.string(),
  storeys: z.string(),
  gfaM2: z.string(),
  notes: z.string(),
});

const SAVED = z.object({ tenantId: z.string(), projectId: z.string(), presented: PRESENTED });
const LIFECYCLE = z.object({ tenantId: z.string(), projectId: z.string() });

const saving = serverCall(
  SAVED,
  async (stated, session): Promise<ProjectFormState> => {
    // A creation names no project, and an edit names the one it edits: the same door, two questions.
    const actor = await actorIn(stated.tenantId, session, stated.projectId === "" ? undefined : stated.projectId);
    if (typeof actor === "string") return { saved: false, refusal: actor };

    const judged = judgeProject(stated.presented);
    if (!judged.presentable) return { saved: false, judgement: judged.refused };

    return attempted<ProjectFormState>(
      actor.tenantId,
      async () => {
        if (stated.projectId === "") {
          const created = await createProject(actor, judged.fields);
          return { saved: true, projectId: created.projectId };
        }
        await updateProject(actor, { projectId: stated.projectId, ...judged.fields });
        return { saved: true, projectId: stated.projectId };
      },
      (refusal) => ({ saved: false, refusal }),
    );
  },
  (refusal): ProjectFormState => ({ saved: false, refusal }),
);

const archiving = serverCall(
  LIFECYCLE,
  async (stated, session): Promise<LifecycleAnswer> => {
    const actor = await actorIn(stated.tenantId, session, stated.projectId);
    if (typeof actor === "string") return { done: false, refusal: actor };
    return attempted<LifecycleAnswer>(
      actor.tenantId,
      async () => {
        await archiveProject(actor, { projectId: stated.projectId });
        return { done: true };
      },
      (refusal) => ({ done: false, refusal }),
    );
  },
  (refusal): LifecycleAnswer => ({ done: false, refusal }),
);

const restoring = serverCall(
  LIFECYCLE,
  async (stated, session): Promise<LifecycleAnswer> => {
    const actor = await actorIn(stated.tenantId, session, stated.projectId);
    if (typeof actor === "string") return { done: false, refusal: actor };
    return attempted<LifecycleAnswer>(
      actor.tenantId,
      async () => {
        await restoreProject(actor, { projectId: stated.projectId });
        return { done: true };
      },
      (refusal) => ({ done: false, refusal }),
    );
  },
  (refusal): LifecycleAnswer => ({ done: false, refusal }),
);

/**
 * R-SPINE-010's create and edit, through the one form that serves both: a submission carrying a
 * project id edits that project, and one carrying none creates a project. The fields are judged
 * before the seam is called (I-34) — the browser judged them too, and a submission that reached
 * here without them is answered with the same sentence rather than with a driver fault.
 */
export async function saveProjectAction(_shown: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  return saving({ tenantId: form.get("tenantId"), projectId: String(form.get("projectId") ?? ""), presented: presentedProject(form) });
}

/** AC-4's archive: the marker moves and nothing is deleted (L-ACT-03's lifecycle guard). */
export async function archiveProjectAction(tenantId: string, projectId: string): Promise<LifecycleAnswer> {
  return archiving({ tenantId, projectId });
}

/** …and its undo: archiving is reversible, so restore puts the marker back where it found it. */
export async function restoreProjectAction(tenantId: string, projectId: string): Promise<LifecycleAnswer> {
  return restoring({ tenantId, projectId });
}

/**
 * Of which workspace — or the registered refusal that answers instead. The session is the one the
 * server-call seam resolved for this action, and a request that presented none was answered
 * SIGNED_OUT there, whose remedy is signing in again; an address this session may not act at is
 * PERMISSION_NOT_HELD, which is the same answer the layout gives for the same reason (ARCH-03).
 *
 * The question is the guard's and no longer this file's (B-17, ARCH-02). It used to stop at
 * `holdsWorkspace`, which is the half-question: ANY member of the workspace could archive, restore
 * or rewrite the fields of ANY project in it, whatever they held on that project. L-ACT-03 names
 * what lifecycle moves — ADMINISTER_PROJECT, the PRINCIPAL-only bundle — and the seam behind these
 * three doors refuses by that very name, so the door now asks for it before the seam is called.
 *
 * The workspace still travels: a presented tenant that disagrees with the project's real owner is
 * refused by the guard rather than believed, and the scope handed on carries the guard's answer.
 */
async function actorIn(tenantId: string, session: AuthSession, projectId?: string): Promise<ProjectsCtx | RefusalCode> {
  const answer = await authorize({
    userId: session.userId,
    tenantId,
    // A door that names an existing project names the permission that project's lifecycle moves, and
    // the guard tests it against the grants the ledger holds. A creation names neither: there is no
    // project yet to hold a grant on, so membership is what admits it — which is all this door ever
    // asked, and all it may ask until the project exists.
    ...(projectId === undefined ? {} : { projectId, permission: LIFECYCLE_PERMISSION, actType: null }),
  });
  if (!answer.authorized) return "PERMISSION_NOT_HELD";
  return { tenantId: answer.tenantId, userId: answer.userId, actorKind: "human" };
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
