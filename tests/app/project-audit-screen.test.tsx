// @vitest-environment jsdom
/**
 * AC-1(d): an audit address that names no project of this workspace is a not-found, not an empty
 * explorer.
 *
 * The module answers the same surfaces shape for a segment that names nothing, so a mistyped or
 * stale address today renders a complete S-Audit screen — heading, filters, both panels — reporting
 * that a project which does not exist has no acts. That is a screen telling a falsehood politely.
 * The address is checked against the projects this workspace actually holds, and an address naming
 * none of them gets Next's not-found (which wears the root layout — a lawful second route).
 *
 * `projectsForHome` includes archived projects, so an archived project still has an audit page: the
 * roster is asked for, never re-derived here (B-19).
 */
import { join } from "node:path";
import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const PAGE = "src/app/(app)/t/[tenant]/p/[project]/audit/page.tsx";
const PROJECTS = "src/modules/spine/projects/index.ts";
const AUDIT = "src/modules/spine/audit/index.ts";

const TENANT = "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88";
const HELD = "3f2c8d10-91ab-4c5e-8d77-1e6b0a4f2c39";
const ARCHIVED = "5a71e2c4-08bd-4f19-9b3a-77c2e15d6a08";
const STRANGER = "7d94b6a2-4e51-4a80-91cd-2f60b8e3d715";

/** What the screen did that ends a render: Next's not-found, or nothing. */
let trail: string[] = [];
/** The projects the workspace holds, as the module answers them — archived ones included. */
let roster: { projectId: string; name: string }[] = [];

interface PageModule {
  default: (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown>;
}

function arm(): void {
  vi.resetModules();
  vi.doMock("next/navigation", () => ({
    notFound: () => {
      trail.push("notFound()");
      throw new Error("NEXT_NOT_FOUND");
    },
    redirect: (path: string) => {
      trail.push(`redirect(${JSON.stringify(path)})`);
    },
  }));
  vi.doMock(join(REPO_ROOT, PROJECTS), () => ({
    projectsForHome: async (ctx: { tenantId: string }) => {
      trail.push(`projectsForHome(${JSON.stringify(ctx.tenantId)})`);
      return roster;
    },
  }));
  vi.doMock(join(REPO_ROOT, AUDIT), () => ({
    AUDIT_PANEL_TABLES: { modelLedger: "model_calls", jobs: "jobs" },
    getAuditSurfaces: async () => {
      trail.push("getAuditSurfaces()");
      return { acts: [], jobs: { armed: false }, modelLedger: { armed: false } };
    },
  }));
}

/** Render the audit page for one address, keeping whatever ended the render. */
async function open(project: string): Promise<{ tree: unknown; ended: string | null }> {
  const page = await productModule<PageModule>(PAGE);
  try {
    return { tree: await page.default({ params: Promise.resolve({ tenant: TENANT, project }) }), ended: null };
  } catch (thrown) {
    return { tree: null, ended: thrown instanceof Error ? thrown.message : String(thrown) };
  }
}

beforeEach(() => {
  trail = [];
  roster = [
    { projectId: HELD, name: "Gulshan Tower" },
    { projectId: ARCHIVED, name: "Mirpur Depot" },
  ];
  arm();
});

afterEach(() => {
  vi.doUnmock("next/navigation");
  vi.doUnmock(join(REPO_ROOT, PROJECTS));
  vi.doUnmock(join(REPO_ROOT, AUDIT));
});

describe("AC-1: the audit screen answers only for projects this workspace holds", () => {
  test("AC-1: an address naming no project of this workspace is a not-found", async () => {
    const opened = await open(STRANGER);
    expect(trail, `the screen must ask which projects this workspace holds and answer notFound() for an address naming none of them — it did: ${JSON.stringify(trail)}`).toContain("notFound()");
    expect(opened.tree, "and it renders no explorer for a project that is not there").toBeNull();
  });

  test("AC-1: a project the workspace holds still renders the explorer", async () => {
    const opened = await open(HELD);
    expect(trail, "a real project is not refused").not.toContain("notFound()");
    expect(opened.ended, "and nothing ended the render").toBeNull();

    const view = render(opened.tree as never);
    try {
      expect(within(view.container).getByTestId("audit-acts-empty"), "the act-log explorer stands, stating the honest absence of acts").toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  test("AC-1: an archived project still has an audit page", async () => {
    const opened = await open(ARCHIVED);
    expect(trail, "projectsForHome answers with archived projects too — archiving hides a project, it does not erase its history").not.toContain("notFound()");
    expect(opened.ended, "so the screen renders").toBeNull();
  });
});
