// The workspace action module (`src/app/(app)/t/[tenant]/actions.ts`): what signing out has to do
// before it leaves, what the module is allowed to drag into a "use server" bundle, and that the
// name judgement it owns is unchanged by either.
import { beforeEach, expect, test, vi } from "vitest";
import { importsOf } from "./support/source-facts";

const ACTIONS = "src/app/(app)/t/[tenant]/actions.ts";

const seams = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  endSession: vi.fn(async () => {}),
  presentedSessionToken: vi.fn(async () => "presented-token"),
  renameWorkspace: vi.fn(async () => ({ renamed: true as const, tenantId: "tenant", name: "Named" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: seams.revalidatePath, revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: seams.redirect, notFound: vi.fn() }));
vi.mock("../../src/server/shell/session", () => ({ endSession: seams.endSession, presentedSessionToken: seams.presentedSessionToken }));
vi.mock("../../src/server/shell/viewer", () => ({ viewerFor: vi.fn(async () => ({ userId: "user", email: "someone@example.com" })) }));
vi.mock("../../src/server/shell/workspace", () => ({ renameWorkspace: seams.renameWorkspace, holdsWorkspace: vi.fn(async () => true) }));
vi.mock("../../src/server/shell/sample-seed", () => ({ sampleSeed: vi.fn(async () => ({ available: false })) }));
vi.mock("../../src/modules/spine/projects", () => ({
  archiveProject: vi.fn(async () => {}),
  createProject: vi.fn(async () => ({ projectId: "project" })),
  restoreProject: vi.fn(async () => {}),
  updateProject: vi.fn(async () => {}),
}));
// The barrel the row asks the module to stop reaching for. Standing in for it with the routes module
// it genuinely wants keeps this suite honest either way: the import question is asked of the source.
vi.mock("../../src/ui/shell", async () => await vi.importActual("../../src/ui/shell/routes"));

const { renameWorkspaceAction, signOutAction } = await import("../../src/app/(app)/t/[tenant]/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

test("AC-1(a): signing out purges the router cache before it redirects to the way back in", async () => {
  await signOutAction();

  expect(seams.revalidatePath, "the router cache is purged from the root, as a layout").toHaveBeenCalledWith("/", "layout");
  expect(seams.redirect, "the way back in is /sign-in").toHaveBeenCalledWith("/sign-in");
  const purged = seams.revalidatePath.mock.invocationCallOrder[0];
  const left = seams.redirect.mock.invocationCallOrder[0];
  expect(purged, "revalidatePath must run before redirect — a purge after the redirect throws never runs").toBeDefined();
  expect(left, "redirect is still what ends the action").toBeDefined();
  expect(purged as number).toBeLessThan(left as number);
});

test("AC-5(b): the action module reads its two helpers from the shell's routes module, not the UI barrel", () => {
  // white-box: AC-5(b) — "a server action module carries no client-component barrel into its bundle"
  // is a property of the module's import list; there is no runtime observable of an unused import.
  const imports = importsOf(ACTIONS);
  const barrel = imports.filter((line) => /\/ui\/shell$|\/ui\/shell\/index$/.test(line.specifier));
  expect(barrel.map((line) => line.specifier), `${ACTIONS} still imports the UI shell barrel`).toEqual([]);

  const routes = imports.filter((line) => line.specifier.endsWith("/ui/shell/routes"));
  expect(routes.length, `${ACTIONS} reads no module ending in /ui/shell/routes`).toBeGreaterThan(0);
  const bound = new Set(routes.flatMap((line) => line.names));
  for (const helper of ["hasVisibleText", "shellHref"]) {
    expect(bound.has(helper), `${helper} is not bound from the routes module`).toBe(true);
  }
});

test("AC-5(b): the rename door still refuses a name with nothing visible in it, and asks no seam", async () => {
  // Written by code point rather than typed: a name of zero-width characters is unreadable in a
  // source file, and a suite that cannot be read cannot be trusted about what it submitted.
  const form = new FormData();
  form.set("tenantId", "tenant");
  form.set("name", String.fromCharCode(0x200b, 0x200d, 0x2060));

  await expect(renameWorkspaceAction(null, form)).resolves.toEqual({ renamed: false, blankName: true });
  expect(seams.renameWorkspace, "a name the door refuses is never carried to the seam").not.toHaveBeenCalled();
});
