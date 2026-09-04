// @vitest-environment jsdom
// S-Audit's address (src/app/(app)/t/[tenant]/p/[project]/audit/page.tsx): a segment that names no
// project of this workspace is an address that does not exist, and a screen that renders a full,
// confident act log for one tells a person the project is empty rather than absent.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const seams = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  projectsForHome: vi.fn(async () => [{ projectId: "project-held" }]),
  getAuditSurfaces: vi.fn(async () => ({ acts: [], jobs: [], modelLedger: [] })),
}));

vi.mock("next/navigation", () => ({ notFound: seams.notFound, redirect: vi.fn() }));
vi.mock("../../src/modules/spine/projects", () => ({ projectsForHome: seams.projectsForHome }));
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

test("AC-1(d): a segment that names no project of the workspace is not found", async () => {
  // `notFound()` answers by throwing, which is the framework's business; what this criterion asks is
  // that the page reach for it at all rather than render a confident screen for an absent project.
  const rendered = await ProjectAudit({ params: Promise.resolve({ tenant: "tenant-1", project: "project-nobody-has" }) }).catch(() => null);

  expect(seams.notFound, "an unknown project id is answered as an absent address").toHaveBeenCalled();
  expect(rendered, "nothing is rendered for an address that names no project").toBeNull();
});

test("AC-1(d): a project the workspace holds still renders its explorer", async () => {
  render(await ProjectAudit({ params: Promise.resolve({ tenant: "tenant-1", project: "project-held" }) }));

  expect(seams.notFound, "a project that is in the roster is found").not.toHaveBeenCalled();
  expect(screen.getByTestId("act-log-explorer"), "the screen is still the act log explorer").toBeDefined();
});
