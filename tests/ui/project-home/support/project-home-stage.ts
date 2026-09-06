/**
 * The stage S-Project's acceptance stands on (inc-115-project-home).
 *
 * `ProjectHome` is a client component that takes its whole answer as one prop, so the screen can be
 * judged over injected data: what is asserted here is the screen's own behaviour, never the server's.
 * Product modules are loaded by absolute path through `productModule`, so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance.
 *
 * Nothing here reads product source. Every name below is one the increment's interface list, its
 * test contract or the committed Design Decision (docs/design/s-project.md) publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. The fixtures are declared once, here, and imported everywhere
 * they are asserted (B-19); keep it free of judgement so neither lane can hide one in it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { render } from "@testing-library/react";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { productModule } from "../../../server/support/wire";

export { productModule };

/* ------------------------------------------------------------------ the homes the spec names */

/** The mountable screen (increment interfaces). */
export const PROJECT_HOME_COMPONENT = "src/app/(app)/t/[tenant]/p/[project]/home/project-home.tsx";

/** `PROJECT_AREAS`, `QUICK_ACTIONS`, `RECENT_ACTIVITY_LIMIT` and the route builders (I-132). */
export const PROJECT_HOME_AREAS = "src/app/(app)/t/[tenant]/p/[project]/home/areas.ts";

/** The screen's own copy, keyed `project_home_…` (Decision §3). */
export const PROJECT_HOME_STRINGS = "src/app/(app)/t/[tenant]/p/[project]/home/strings.ts";

/** The one figure/date seam every screen renders through (SEAM-FORMAT). */
export const FORMAT_MODULE = "src/core/format.ts";

/** The refusal register — the one home of a code's message and remedy (R-SPINE-062). */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The route roster R-UI-050's matrix is closed against (`routesOnDisk`). */
export const ROUTE_SCAN_MODULE = "src/ui/screen-states/route-scan.ts";

/* ------------------------------------------------------------- what the screen is handed, typed */

/** A component of the product, as this stage mounts one. */
export type Mountable = (props: Record<string, unknown>) => unknown;

/** `Project` as `src/modules/spine/projects` publishes it, structurally. */
export interface StageProject {
  projectId: string;
  name: string;
  code: string | null;
  client: string | null;
  siteAddress: string | null;
  district: string | null;
  buildingType: string | null;
  storeys: number | null;
  targetGfaM2: string | null;
  notes: string | null;
  status: "active" | "archived";
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  quickStats: { sheets: number; campaigns: number; estimates: number; bids: number };
}

/** `AuditAct` as `src/modules/spine/audit` publishes it, structurally. */
export interface StageAct {
  actId: string;
  actType: string;
  actorId: string;
  actorLabel: string;
  subjects: readonly string[];
  consequenceDigest: string;
  occurredAt: Date;
}

/** `ProjectAiSpend` as `src/modules/ai/spend` publishes it, structurally. */
export interface StageSpend {
  projectId: string;
  calls: number;
  proposed: number;
  refused: number;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
  accepted: number;
  edited: number;
  rejected: number;
}

/** `ProjectHomeParticipant` (increment interfaces). */
export interface StageParticipant {
  userId: string;
  label: string;
  roles: readonly string[];
}

/** `ProjectHomeRoster` (increment interfaces): a roster, or the refusal that stands in its place. */
export type StageRoster = { roster: readonly StageParticipant[] } | { refusal: string };

/** `ZoneBadge` (increment interfaces). */
export interface StageZone {
  book: string;
  zone: string;
}

/** `ProjectHomeData` (increment interfaces) — the screen's whole answer, in one prop. */
export interface ProjectHomeDataLike {
  tenantId: string;
  projectId: string;
  project: StageProject;
  zones: readonly StageZone[];
  participants: StageRoster;
  spend: StageSpend;
  recentActs: readonly StageAct[];
}

/* --------------------------------------------------------------------- the fixtures, declared once */

/** The workspace and the project every mount in both lanes stands on (B-19: one identity). */
export const TENANT = "11111111-1111-4111-8111-111111111111";
export const PROJECT = "22222222-2222-4222-8222-222222222222";

/** The stored project the header reads: every field S-Project names is stated on it. */
export function aProject(over: Partial<StageProject> = {}): StageProject {
  return {
    projectId: PROJECT,
    name: "Ashuganj Terminal",
    code: "AT-001",
    client: "Ashuganj Holdings",
    siteAddress: "Ashuganj River Road",
    district: "Brahmanbaria",
    buildingType: "commercial",
    storeys: 6,
    targetGfaM2: "1250.50",
    notes: null,
    status: "active",
    archivedAt: null,
    createdAt: new Date("2026-03-01T04:00:00.000Z"),
    updatedAt: new Date("2026-03-02T04:00:00.000Z"),
    quickStats: { sheets: 0, campaigns: 0, estimates: 0, bids: 0 },
    ...over,
  };
}

/** One act of the log, newest-first order being the caller's to arrange. */
export function anAct(over: Partial<StageAct> = {}): StageAct {
  return {
    actId: "33333333-3333-4333-8333-333333333333",
    actType: "ASSIGN_PARTICIPANT_ROLE",
    actorId: "44444444-4444-4444-8444-444444444444",
    actorLabel: "rafiq@cubit.test",
    subjects: [PROJECT],
    consequenceDigest: "0".repeat(64),
    occurredAt: new Date("2026-03-02T04:00:00.000Z"),
    ...over,
  };
}

/** `n` acts, newest first, each distinguishable by its own id, type and day. */
export function acts(n: number): readonly StageAct[] {
  return Array.from({ length: n }, (_, index) =>
    anAct({
      actId: `${index}`.padStart(8, "0") + "-3333-4333-8333-333333333333",
      actType: index % 2 === 0 ? "ASSIGN_PARTICIPANT_ROLE" : "CONFIRM_DISCIPLINE",
      actorLabel: `actor-${index}@cubit.test`,
      occurredAt: new Date(Date.UTC(2026, 2, 20 - index, 4, 0, 0)),
    }),
  );
}

/** What the ledger answers for this project. Nothing spent is the zeros, never an absence. */
export function aSpend(over: Partial<StageSpend> = {}): StageSpend {
  return {
    projectId: PROJECT,
    calls: 0,
    proposed: 0,
    refused: 0,
    inputTokens: 0,
    outputTokens: 0,
    attributedCost: "0.00",
    accepted: 0,
    edited: 0,
    rejected: 0,
    ...over,
  };
}

/** The roster the creator alone holds (C-SPINE-PROJECT: the creator is a PRINCIPAL). */
export function aRoster(over: readonly StageParticipant[] = []): StageRoster {
  return {
    roster:
      over.length > 0
        ? over
        : [{ userId: "44444444-4444-4444-8444-444444444444", label: "rafiq@cubit.test", roles: ["PRINCIPAL"] }],
  };
}

/** The whole prop, with every region answering, and any region the caller wants otherwise. */
export function homeData(over: Partial<ProjectHomeDataLike> = {}): ProjectHomeDataLike {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    project: aProject(),
    zones: [],
    participants: aRoster(),
    spend: aSpend(),
    recentActs: [],
    ...over,
  };
}

/* -------------------------------------------------------------------------------- the loaders */

/** The screen itself, by the export the increment's interfaces name. */
export async function projectHome(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(PROJECT_HOME_COMPONENT);
  expect(typeof module["ProjectHome"], `${PROJECT_HOME_COMPONENT} publishes \`ProjectHome\` (increment interfaces)`).toBe("function");
  return module["ProjectHome"] as Mountable;
}

/** One area of the project, as `areas.ts` declares it. */
export interface AreaEntry {
  key: string;
  label: string;
  route: ((tenantId: string, projectId: string) => string) | null;
}

export interface AreasModule {
  PROJECT_AREAS: readonly AreaEntry[];
  QUICK_ACTIONS: readonly AreaEntry[];
  RECENT_ACTIVITY_LIMIT: number;
}

/** `areas.ts`: the areas, the quick actions and the screen's one cap (I-132). */
export async function areasModule(): Promise<AreasModule> {
  const module = await productModule<Record<string, unknown>>(PROJECT_HOME_AREAS);
  expect(Array.isArray(module["PROJECT_AREAS"]), `${PROJECT_HOME_AREAS} publishes \`PROJECT_AREAS\` (increment interfaces)`).toBe(true);
  expect(Array.isArray(module["QUICK_ACTIONS"]), `${PROJECT_HOME_AREAS} publishes \`QUICK_ACTIONS\` (AC-6)`).toBe(true);
  expect(typeof module["RECENT_ACTIVITY_LIMIT"], `${PROJECT_HOME_AREAS} publishes \`RECENT_ACTIVITY_LIMIT\` — the screen's cap, named once (I-132)`).toBe("number");
  return module as unknown as AreasModule;
}

/**
 * The screen's copy, found by the keys the Design Decision §3 fixes rather than by the export's
 * name — a table is a table whatever it is called (the sets precedent).
 */
export async function homeStrings(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(PROJECT_HOME_STRINGS);
  for (const value of Object.values(module)) {
    if (value !== null && typeof value === "object" && "project_home_unstated" in (value as Record<string, unknown>)) {
      return value as Record<string, string>;
    }
  }
  throw new Error(`${PROJECT_HOME_STRINGS} publishes no table carrying the keys the Design Decision §3 fixes (project_home_…)`);
}

/** One key of that table, asserted present before it is used as an expectation. */
export function copy(table: Record<string, string>, key: string): string {
  const said = table[key];
  expect(typeof said, `the screen's string table states \`${key}\` (docs/design/s-project.md §3)`).toBe("string");
  return said as string;
}

export interface FormatSeam {
  formatUserFigure(value: string): string;
  formatSquareFeet(areaM2: string): string;
  formatDate(parts: { year: number; month: number; day: number }): string;
  dhakaDateParts(at: Date): { year: number; month: number; day: number };
}

/** The format seam, loaded from its one home so no expectation here re-derives a figure. */
export async function formatSeam(): Promise<FormatSeam> {
  return productModule<FormatSeam>(FORMAT_MODULE);
}

export interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
}

/** The register, read from its one home so nothing re-spells a code's words (ARCH-02, B-17). */
export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape | undefined>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/* --------------------------------------------------------------------------------- the mount */

/** Mount the screen over one answer and hand back its own root (`project-home`). */
export function mountHome(component: Mountable, data: ProjectHomeDataLike): HTMLElement {
  const { container } = render(createElement(component as unknown as FunctionComponent<{ data: ProjectHomeDataLike }>, { data }));
  const root = container.querySelector('[data-testid="project-home"]');
  expect(root, "ProjectHome renders its root `project-home` (test contract)").not.toBeNull();
  return root as HTMLElement;
}

/** Every element carrying a contract test id, in document order. */
export function all(root: HTMLElement, testId: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

/** The one element carrying a contract test id — asserted to be exactly one. */
export function one(root: HTMLElement, testId: string): HTMLElement {
  const found = all(root, testId);
  expect(found.length, `the screen renders exactly one \`${testId}\``).toBe(1);
  return found[0] as HTMLElement;
}

/** The text a cell states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}
