/**
 * The workspace screens' server actions.
 *
 * AC-1(a): signing out ends the session AND purges the router cache before it redirects. Next keeps
 * a client-side cache of already-rendered segments; a redirect on its own leaves the signed-in frame
 * — workspace name, member's e-mail, the switcher — sitting in that cache for the next person to
 * press Back into. `revalidatePath("/", "layout")` is what empties it, and it has to happen BEFORE
 * the redirect, because `redirect` unwinds the action by throwing (ARCH-03).
 *
 * AC-5(b): a `"use server"` module is a server bundle entry, and the defect is what LOADING it drags
 * in: the shell's UI barrel re-exports the frame's client components, so importing it for two pure
 * helpers pulls all of them into the server graph. That is asked here as a fact of the loader — the
 * barrel is answered with a stand-in that records being loaded, the action module's one other
 * in-app collaborator is stood in for so only THIS module's own imports are being watched, and the
 * helpers are then proved still to work from wherever they now come from. A module that spelled the
 * right import and kept the barrel too fails exactly as today's does (B-19).
 */
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const ACTIONS = "src/app/(app)/t/[tenant]/actions.ts";
const SHELL_BARREL = "src/ui/shell/index.ts";
const JUDGEMENT = "src/app/(app)/t/[tenant]/home/judgement.ts";
const SESSION = "src/server/shell/session.ts";
const WORKSPACE = "src/server/shell/workspace.ts";

const TENANT = "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88";

/** A name whose every character is invisible: two zero-width spaces (U+200B), spelled by code point. */
const ZERO_WIDTH_NAME = String.fromCharCode(0x200b, 0x200b);

interface ActionsModule {
  signOutAction: () => Promise<void>;
  renameWorkspaceAction: (shown: unknown, form: FormData) => Promise<unknown>;
}

/** Everything the doors did, in the order they did it. */
let trail: string[] = [];
/** Whether loading the action module dragged the shell's UI barrel into the server graph. */
let barrelLoaded = false;

beforeEach(() => {
  trail = [];
  barrelLoaded = false;
  vi.resetModules();
  vi.doMock("next/cache", () => ({
    revalidatePath: (path: string, type?: string) => {
      trail.push(`revalidatePath(${JSON.stringify(path)}, ${JSON.stringify(type)})`);
    },
  }));
  vi.doMock("next/navigation", () => ({
    redirect: (path: string) => {
      trail.push(`redirect(${JSON.stringify(path)})`);
    },
  }));
  // The barrel, answered by a stand-in that says so if this module's own graph loads it. It still
  // answers with everything the real barrel answers with, so the only thing this changes is that
  // the load becomes observable — the doors below behave exactly as they do in production.
  vi.doMock(join(REPO_ROOT, SHELL_BARREL), async (importOriginal) => {
    barrelLoaded = true;
    return { ...((await importOriginal()) as object) };
  });
  // The action module's one other in-app collaborator, stood in for: it has a barrel import of its
  // own, and this test is about what the ACTION module pulls in, not what its collaborators do.
  vi.doMock(join(REPO_ROOT, JUDGEMENT), () => ({
    judgeProject: () => ({ presentable: true, fields: {} }),
    presentedProject: () => ({}),
    isPlainDecimal: () => true,
  }));
  vi.doMock(join(REPO_ROOT, SESSION), () => ({
    presentedSessionToken: async () => "a-live-session-token",
    endSession: async () => {
      trail.push("endSession()");
    },
  }));
  vi.doMock(join(REPO_ROOT, WORKSPACE), () => ({
    renameWorkspace: async (asked: { name: string }) => {
      trail.push(`renameWorkspace(${JSON.stringify(asked.name)})`);
      return { renamed: true };
    },
    holdsWorkspace: async () => true,
    workspaceFor: async () => null,
    namedWorkspaceFor: async () => null,
    workspacesFor: async () => [],
  }));
});

afterEach(() => {
  vi.doUnmock("next/cache");
  vi.doUnmock("next/navigation");
  for (const module of [SHELL_BARREL, JUDGEMENT, SESSION, WORKSPACE]) vi.doUnmock(join(REPO_ROOT, module));
});

/** A rename submission as the form makes one. */
function submission(name: string): FormData {
  const form = new FormData();
  form.set("tenantId", TENANT);
  form.set("name", name);
  return form;
}

describe("AC-1: signing out leaves nothing of the workspace behind", () => {
  test("AC-1: signOutAction purges the router cache for the whole layout before it redirects", async () => {
    const actions = await productModule<ActionsModule>(ACTIONS);
    await actions.signOutAction();

    expect(trail, `signing out must end the session, purge the router cache and only then redirect — it did: ${JSON.stringify(trail)}`).toStrictEqual([
      "endSession()",
      'revalidatePath("/", "layout")',
      'redirect("/sign-in")',
    ]);
  });
});

describe("AC-5: the server-action module drags no client components into the server graph", () => {
  test("AC-5: loading the action module never loads the shell UI barrel", async () => {
    await productModule<ActionsModule>(ACTIONS);

    expect(barrelLoaded, `importing ${ACTIONS} pulled in the shell's UI barrel — every client component it re-exports is now in this "use server" entry's graph, for the sake of two pure helpers`).toBe(false);
  });

  test("AC-5: and the helpers still work — a name with nothing visible in it is refused, the seam untouched", async () => {
    const actions = await productModule<ActionsModule>(ACTIONS);

    expect(await actions.renameWorkspaceAction(null, submission(ZERO_WIDTH_NAME)), "I-22: a name with nothing visible in it is refused by the door itself").toStrictEqual({ renamed: false, blankName: true });
    expect(trail, "and the stored name is untouched by construction — the seam is never asked").toStrictEqual([]);
    expect(barrelLoaded, "judged without the barrel: the helper comes from its own home").toBe(false);
  });

  test("AC-5: a saved rename still re-reads the grid at the workspace's own address", async () => {
    const actions = await productModule<ActionsModule>(ACTIONS);

    expect(await actions.renameWorkspaceAction(null, submission("Datum Works Dhaka")), "a name with something visible in it reaches the seam").toStrictEqual({ renamed: true });
    expect(trail[0], "the seam is asked with the name as it was presented").toBe('renameWorkspace("Datum Works Dhaka")');
    const revalidated = trail.filter((entry) => entry.startsWith("revalidatePath("));
    expect(revalidated.length, `a saved name is re-read where it is rendered — the door did ${JSON.stringify(trail)}`).toBe(1);
    expect(revalidated[0], "at the address the shell's own route helper builds for this workspace").toContain(TENANT);
    expect(barrelLoaded, "and none of that needed the UI barrel").toBe(false);
  });
});
