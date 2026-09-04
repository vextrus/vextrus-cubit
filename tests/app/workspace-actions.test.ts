/**
 * The workspace screens' server actions.
 *
 * AC-1(a): signing out ends the session AND purges the router cache before it redirects. Next keeps
 * a client-side cache of already-rendered segments; a redirect on its own leaves the signed-in frame
 * — workspace name, member's e-mail, the switcher — sitting in that cache for the next person to
 * press Back into. `revalidatePath("/", "layout")` is what empties it, and it has to happen BEFORE
 * the redirect, because `redirect` unwinds the action by throwing (ARCH-03).
 *
 * AC-5(b): a `"use server"` module is a server bundle entry. Importing the shell's UI barrel from it
 * drags every client component in the barrel into that graph for the sake of two pure helpers, so
 * the helpers are taken from their own home (`ui/shell/routes`) and the barrel is not imported at
 * all — while the judgement those helpers carry (I-22's "a name with something visible in it") is
 * unchanged, which is what the second test drives.
 */
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";
import { importsOf } from "./support/sources";

const ACTIONS = "src/app/(app)/t/[tenant]/actions.ts";
const SESSION = "src/server/shell/session.ts";
const WORKSPACE = "src/server/shell/workspace.ts";

/** A name whose every character is invisible: two zero-width spaces (U+200B), spelled by code point. */
const ZERO_WIDTH_NAME = String.fromCharCode(0x200b, 0x200b);

interface ActionsModule {
  signOutAction: () => Promise<void>;
  renameWorkspaceAction: (shown: unknown, form: FormData) => Promise<unknown>;
}

/** Everything the two doors did, in the order they did it. */
let trail: string[] = [];

beforeEach(() => {
  trail = [];
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
  vi.doMock(join(REPO_ROOT, SESSION), () => ({
    presentedSessionToken: async () => "a-live-session-token",
    endSession: async () => {
      trail.push("endSession()");
    },
  }));
  vi.doMock(join(REPO_ROOT, WORKSPACE), () => ({
    renameWorkspace: async () => {
      trail.push("renameWorkspace()");
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
  vi.doUnmock(join(REPO_ROOT, SESSION));
  vi.doUnmock(join(REPO_ROOT, WORKSPACE));
});

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

describe("AC-5: the server-action module imports only what it uses", () => {
  test("AC-5: actions.ts takes the shell helpers from their own home, never through the UI barrel", async () => {
    // white-box: AC-5(b) — "which module a helper is imported FROM" is a property of the import
    // graph, and the graph is written in the text; no run of the action can observe it.
    const records = importsOf(ACTIONS);
    const barrelled = records.filter((record) => /\/ui\/shell(\/index)?$/.test(record.specifier));
    expect(barrelled, `${ACTIONS} is a "use server" entry: importing the shell UI barrel (${JSON.stringify(barrelled.map((record) => record.specifier))}) pulls its client components into the server graph`).toStrictEqual([]);

    const routed = records.filter((record) => /\/ui\/shell\/routes$/.test(record.specifier));
    expect(routed.length, `${ACTIONS} must take its shell helpers from ui/shell/routes — it imports from ${JSON.stringify(records.map((record) => record.specifier))}`).toBe(1);
    for (const binding of ["hasVisibleText", "shellHref"]) {
      expect(routed[0]?.clause, `${binding} comes from ui/shell/routes`).toContain(binding);
    }
  });

  test("AC-5: renameWorkspaceAction still refuses a name with nothing visible in it, and never asks the seam", async () => {
    const actions = await productModule<ActionsModule>(ACTIONS);
    const form = new FormData();
    form.set("tenantId", "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88");
    form.set("name", ZERO_WIDTH_NAME);

    expect(await actions.renameWorkspaceAction(null, form), "I-22: a name with nothing visible in it is refused by the door itself").toStrictEqual({ renamed: false, blankName: true });
    expect(trail, "and the stored name is untouched by construction — the seam is never asked").toStrictEqual([]);
  });
});
