// @vitest-environment jsdom
// S-Audit's address (src/app/(app)/t/[tenant]/p/[project]/audit/page.tsx): a segment that names no
// project of this workspace is an address that does not exist, and a screen that renders a full,
// confident act log for one tells a person the project is empty rather than absent.
//
// B-20 re-baseline (AC-2(e)): the barrel mock published `projectsForHome` alone, so the existence
// door this sweep gives the module could not land without rewriting it. Every assertion the file
// made before still stands — what changed is which seam answers "does this project exist here?",
// and the two AC-2(b) assertions below say so.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const TENANT = "tenant-1";
const HELD = "project-held";

const seams = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  projectHeld: vi.fn(async (_scope: { tenantId: string }, projectId: string) => projectId === "project-held"),
  projectsForHome: vi.fn(async () => [{ projectId: "project-held" }]),
  getAuditSurfaces: vi.fn(async () => ({ acts: [], jobs: [], modelLedger: [] })),
}));

vi.mock("next/navigation", () => ({ notFound: seams.notFound, redirect: vi.fn() }));
vi.mock("../../src/modules/spine/projects", () => ({ projectHeld: seams.projectHeld, projectsForHome: seams.projectsForHome }));
vi.mock("../../src/modules/spine/audit", () => ({ getAuditSurfaces: seams.getAuditSurfaces }));
// The two panels are other increments' screens; this criterion is about which answer the page gives,
// so they stand in as markers and nothing here depends on their internals.
vi.mock("../../src/app/(app)/t/[tenant]/p/[project]/audit/act-log-explorer", () => ({ ActLogExplorer: () => <div data-testid="act-log-explorer" /> }));
vi.mock("../../src/app/(app)/t/[tenant]/p/[project]/audit/audit-panels", () => ({ AuditPanels: () => <div data-testid="audit-panels" /> }));

const ProjectAudit = (await import("../../src/app/(app)/t/[tenant]/p/[project]/audit/page")).default;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

test("AC-2(e): a segment that names no project of the workspace is not found", async () => {
  // `notFound()` answers by throwing, which is the framework's business; what this criterion asks is
  // that the page reach for it at all rather than render a confident screen for an absent project.
  const rendered = await ProjectAudit({ params: Promise.resolve({ tenant: TENANT, project: "project-nobody-has" }) }).catch(() => null);

  expect(seams.notFound, "an unknown project id is answered as an absent address").toHaveBeenCalled();
  expect(rendered, "nothing is rendered for an address that names no project").toBeNull();
});

test("AC-2(e): a project the workspace holds still renders its explorer", async () => {
  render(await ProjectAudit({ params: Promise.resolve({ tenant: TENANT, project: HELD }) }));

  expect(seams.notFound, "a project that is in the roster is found").not.toHaveBeenCalled();
  expect(screen.getByTestId("act-log-explorer"), "the screen is still the act log explorer").toBeDefined();
});

test("AC-2(b): the existence check is one projectHeld call carrying the address's own segments", async () => {
  await ProjectAudit({ params: Promise.resolve({ tenant: TENANT, project: HELD }) });

  expect(seams.projectHeld.mock.calls.length, "one question, asked once — an existence answer is not a roster read").toBe(1);
  // The shim that named an account the screen does not have goes with the roster read: the door is
  // scoped by the workspace alone, which is the whole of what this question is about.
  expect(seams.projectHeld.mock.calls[0], "the door is asked about the two segments the address carries").toEqual([{ tenantId: TENANT }, HELD]);
});

test("AC-2(b): the workspace's whole project roster is never read to answer it", async () => {
  await ProjectAudit({ params: Promise.resolve({ tenant: TENANT, project: HELD }) });
  await ProjectAudit({ params: Promise.resolve({ tenant: TENANT, project: "project-nobody-has" }) }).catch(() => null);

  expect(seams.projectsForHome, "every project of the workspace, with its quick stats, is not what answers one yes/no").not.toHaveBeenCalled();
});
