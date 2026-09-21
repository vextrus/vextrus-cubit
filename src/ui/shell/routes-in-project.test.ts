/**
 * THE BREADCRUMB INSIDE A PROJECT — `workspace › project ▾ › area › page` (R-UI-084, AM-08).
 *
 * WHY. Every Design Decision draws the trail the same way — `ws › Trace Survey ▾ › Takeoff › Register`,
 * `ws › Riverside Tower ▾ › Drawings › A-101 Foundation Plan`, `ws › Sattva Court ▾ › Project` — and
 * R-UI-084 says the crumb ALWAYS names workspace, project, area and page. Until 2026-09-21 every
 * project screen read `Golden Legs › Projects`: the frame never resolved the project the address is
 * inside, and the area crumb was the workspace's area ("Projects") rather than the project's own
 * (Takeoff, Drawings, Settings, or the project itself). Found by the session-3 probe on the register,
 * the levels, the coverage grid and the drawings screens alike — a cross-screen finding, owned here
 * by the foundation (AM-08: "a repeated cross-screen finding is owned by the foundation node").
 *
 * Interpretation (recorded here, I-3xx): inside a project the third crumb is the PROJECT'S area —
 * `takeoff`, `drawings`, `settings`, or the project's home for everything else (documents, audit) —
 * linking to that area's home, and current at it; the page crumb is the screen's own word, published
 * by the screen through `useShellPage`. The workspace's area ("Projects") is reached through the
 * workspace crumb and is not repeated. s-documents.md's wireframe writes `Projects › Documents`;
 * under this reading it renders `<project> › Project › Documents`, and the `page` crumb J-030 asserts
 * ("Documents") is unchanged.
 */
import { describe, expect, test } from "vitest";
import { strings } from "../strings";
import {
  PROJECT_AREAS,
  areaLabel,
  isProjectAreaHome,
  projectAreaHref,
  projectAreaLabel,
  projectAreaOf,
  projectHref,
  projectSettingsHref,
  shellCrumbs,
  shellHref,
  type ShellProject,
  type ShellWorkspace,
} from "./routes";

const WORKSPACE: ShellWorkspace = { tenantId: "11111111-1111-4111-8111-111111111111", name: "Trace Survey Works" };
const TOWER: ShellProject = { projectId: "22222222-2222-4222-8222-222222222222", name: "Trace Survey" };
const COURT: ShellProject = { projectId: "33333333-3333-4333-8333-333333333333", name: "Sattva Court" };
const AT = (tail: string): string => `${projectHref(WORKSPACE.tenantId, TOWER.projectId)}${tail}`;

describe("projectAreaOf: which of the project's areas an address is inside", () => {
  test.each([
    [AT(""), "home"],
    [AT("/"), "home"],
    [AT("/documents"), "home"],
    [AT("/audit"), "home"],
    [AT("/takeoff"), "takeoff"],
    [AT("/takeoff/register"), "takeoff"],
    [AT("/takeoff/coverage?cell=x"), "takeoff"],
    [AT("/drawings"), "drawings"],
    [AT("/drawings/sets/44444444-4444-4444-8444-444444444444"), "drawings"],
    [AT("/viewer/55555555-5555-4555-8555-555555555555/FOUNDATION%20PLAN"), "drawings"],
    [AT("/settings"), "settings"],
    [AT("/settings/ruleset"), "settings"],
  ])("%s → %s", (pathname, area) => {
    expect(projectAreaOf(pathname)).toBe(area);
  });

  test("an address outside a project names no project area", () => {
    expect(projectAreaOf(`/t/${WORKSPACE.tenantId}`)).toBeNull();
    expect(projectAreaOf(`/t/${WORKSPACE.tenantId}/books`)).toBeNull();
    expect(projectAreaOf(null)).toBeNull();
  });

  test("every project area has a home address and a label from the string table", () => {
    for (const area of PROJECT_AREAS) {
      expect(projectAreaHref(WORKSPACE.tenantId, TOWER.projectId, area).startsWith(projectHref(WORKSPACE.tenantId, TOWER.projectId))).toBe(true);
      expect(projectAreaLabel(area).length).toBeGreaterThan(0);
    }
    expect(projectAreaHref(WORKSPACE.tenantId, TOWER.projectId, "home")).toBe(projectHref(WORKSPACE.tenantId, TOWER.projectId));
    expect(projectAreaHref(WORKSPACE.tenantId, TOWER.projectId, "takeoff")).toBe(AT("/takeoff"));
    expect(projectAreaLabel("takeoff")).toBe(strings.takeoff_nav_label);
  });

  test("the settings area has no screen of its own: its crumb opens the first section, and is never the page", () => {
    // `/settings` is a frame with no page (s-settings-project-sub-navigation § 1): a crumb linking
    // there would be a door onto a 404. The project home's Settings tab lands on the rule set, and
    // so does the crumb — one address for one place.
    expect(projectAreaHref(WORKSPACE.tenantId, TOWER.projectId, "settings")).toBe(AT("/settings/ruleset"));
    expect(projectSettingsHref(WORKSPACE.tenantId, TOWER.projectId, "participants")).toBe(AT("/settings/participants"));
    expect(isProjectAreaHome(AT("/settings/ruleset"), WORKSPACE.tenantId, TOWER.projectId)).toBe(false);
    expect(isProjectAreaHome(AT("/settings"), WORKSPACE.tenantId, TOWER.projectId)).toBe(false);
  });

  test("isProjectAreaHome: the area's own address, and nothing beneath it", () => {
    expect(isProjectAreaHome(AT("/takeoff"), WORKSPACE.tenantId, TOWER.projectId)).toBe(true);
    expect(isProjectAreaHome(AT("/takeoff/register"), WORKSPACE.tenantId, TOWER.projectId)).toBe(false);
    expect(isProjectAreaHome(AT(""), WORKSPACE.tenantId, TOWER.projectId)).toBe(true);
    expect(isProjectAreaHome(AT("/documents"), WORKSPACE.tenantId, TOWER.projectId)).toBe(false);
  });
});

describe("shellCrumbs inside a project: workspace › project ▾ › area › page (R-UI-084)", () => {
  test("a takeoff screen: four crumbs, the area linking to the lane's home and the page current", () => {
    const trail = shellCrumbs({ workspace: WORKSPACE, project: TOWER, projects: [TOWER, COURT], area: "projects", atAreaHome: false, projectArea: "takeoff", page: "Register" });
    expect(trail.map((crumb) => crumb.label)).toEqual([WORKSPACE.name, TOWER.name, projectAreaLabel("takeoff"), "Register"]);
    expect(trail.map((crumb) => crumb.id)).toEqual(["workspace", "project", "area", "page"]);
    expect(trail[0]?.href, "the workspace crumb is the workspace's home — where 'Projects' is").toBe(shellHref(WORKSPACE.tenantId, "projects"));
    expect(trail[1]?.href).toBe(projectHref(WORKSPACE.tenantId, TOWER.projectId));
    expect(trail[1]?.menu?.map((offered) => offered.label), "the project crumb's ▾ offers the OTHER projects, never itself").toEqual([COURT.name]);
    expect(trail[2]?.href, "the area crumb links to the lane's own home").toBe(AT("/takeoff"));
    expect(trail[2]?.current).toBeUndefined();
    expect(trail[3]?.current).toBe(true);
    expect(trail.some((crumb) => crumb.label === areaLabel("projects")), "the workspace's area is not repeated inside a project").toBe(false);
  });

  test("the project's home: three crumbs, the project area current, and a page handed in is not shown", () => {
    const trail = shellCrumbs({ workspace: WORKSPACE, project: TOWER, projects: [TOWER], area: "projects", atAreaHome: true, projectArea: "home", page: "Ignored" });
    expect(trail.map((crumb) => crumb.label)).toEqual([WORKSPACE.name, TOWER.name, projectAreaLabel("home")]);
    expect(trail[2]?.current).toBe(true);
    expect(trail[2]?.href).toBeUndefined();
    expect(trail[1]?.menu, "a workspace with one project offers nothing to switch to").toBeUndefined();
  });

  test("a documents screen: the project's home is the area, and Documents the page", () => {
    const trail = shellCrumbs({ workspace: WORKSPACE, project: TOWER, projects: [], area: "projects", atAreaHome: false, projectArea: "home", page: "Documents" });
    expect(trail.map((crumb) => crumb.label)).toEqual([WORKSPACE.name, TOWER.name, projectAreaLabel("home"), "Documents"]);
    expect(trail[2]?.href).toBe(projectHref(WORKSPACE.tenantId, TOWER.projectId));
  });

  test("outside a project nothing moves: the workspace's own areas read as they always did", () => {
    const trail = shellCrumbs({ workspace: WORKSPACE, area: "books", atAreaHome: false, page: "A book" });
    expect(trail.map((crumb) => crumb.label)).toEqual([WORKSPACE.name, areaLabel("books"), "A book"]);
  });
});
