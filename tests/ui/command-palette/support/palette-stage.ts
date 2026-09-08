/**
 * The stage the ⌘K palette's acceptance stands on (inc-217-command-palette).
 *
 * `PaletteHost` is the app-layer mount: it takes the workspace it stands in, the project it stands
 * inside (or `null`), the seam to ask (`search`) and the way to move (`navigate`), and renders the
 * provider, the palette and the ? sheet over whatever it is given as children. Every criterion below
 * therefore judges the product's own behaviour over injected answers, never the server's.
 *
 * Nothing here reads product source. Product modules are loaded by absolute path through the
 * loaders below, so a module the Builder has not written yet fails as an assertion naming the file
 * rather than as a collection death that would read as a defect in the acceptance.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. The fixtures are declared once, here, and imported everywhere
 * they are asserted (B-19); keep it free of judgement so neither lane can hide one in it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { expect } from "vitest";
import { shellHref, type ShellArea } from "../../../../src/ui/shell/routes";
import { fill, strings } from "../../../../src/ui/strings";

export { shellHref };
export type { ShellArea };

/**
 * The rendering library, re-exported from the one place that resolves it. The held-out lane loads
 * this stage from the checkout by absolute path, and a bare `@testing-library/react` specifier in a
 * file outside the checkout resolves against a directory that has no node_modules of its own.
 */
export { cleanup, fireEvent, waitFor };

/** The checkout these tests run against. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/* ------------------------------------------------------------------ the homes the spec names */

/** The ui pattern: the provider, the dialog, the sheet, the states declaration (Decision §1/§2). */
export const PALETTE_PATTERN_DIR = "src/ui/patterns/command-palette";

/** The one home of every R-UI-032 binding (increment interfaces). */
export const SHORTCUTS_DIR = "src/ui/shell/shortcuts";

/** The app layer that feeds the pattern typed rows (Decision §1, risk note 2: `t/[tenant]`). */
export const PALETTE_APP_DIR = "src/app/(app)/t/[tenant]/palette";

/** The seam `spine.search` answers through (increment interfaces). */
export const SEARCH_MODULE = "src/server/spine/search.ts";

/** The project's areas and its own address — `PROJECT_AREAS` and `projectHomeRoute` (I-126). */
export const AREAS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/home/areas.ts";

/** The three other addresses a hit is turned into (B-17: each spelled in its own home). */
export const DRAWINGS_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/drawings/route-address.ts";
export const SETS_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets/route-address.ts";
export const VIEWER_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/route-address.ts";

/* ---------------------------------------------------------------------------- module loading */

/**
 * Import a product module by repo-relative path, asserting it exists first (the same contract the
 * held-out frame's `productModule` carries, so both lanes read alike).
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/**
 * Everything a directory of the product publishes, merged. The increment's interfaces fix the
 * DIRECTORY each name belongs to — `src/ui/shell/shortcuts/**`, `src/ui/patterns/command-palette`,
 * `src/app/(app)/t/[tenant]/palette/**` — and leave the file inside it to the Builder, so the
 * acceptance asks the directory rather than pinning a filename the ownership list does not fix.
 */
export async function exportsUnder(relativeDir: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relativeDir);
  expect(
    existsSync(abs) && statSync(abs).isDirectory(),
    `${relativeDir}/ is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const merged: Record<string, unknown> = {};
  for (const entry of readdirSync(abs).sort()) {
    if (!/\.tsx?$/.test(entry) || /\.(test|spec)\.tsx?$/.test(entry)) continue;
    const specifier: string = join(abs, entry);
    const module = (await import(specifier)) as Record<string, unknown>;
    for (const [key, value] of Object.entries(module)) {
      if (key !== "default" && merged[key] === undefined) merged[key] = value;
    }
  }
  return merged;
}

/** One name a bag must publish, asserted present before anything is done with it. */
export function named<T>(bag: Record<string, unknown>, name: string, where: string): T {
  expect(bag[name] !== undefined, `${where} publishes \`${name}\` (increment interfaces / test contract)`).toBe(true);
  return bag[name] as T;
}

/** The pattern's own surface: the provider, the dialog, the sheet, the states declaration. */
export const patternModule = (): Promise<Record<string, unknown>> => exportsUnder(PALETTE_PATTERN_DIR);

/** The roster's surface: `SHORTCUTS` and the readings that go with it. */
export const rosterModule = (): Promise<Record<string, unknown>> => exportsUnder(SHORTCUTS_DIR);

/** The app layer's surface: `PaletteHost`, `GO_TARGETS`, `PALETTE_ACTIONS`, `projectOf`. */
export const hostModule = (): Promise<Record<string, unknown>> => exportsUnder(PALETTE_APP_DIR);

/** Pattern and app layer merged, for the names whose file the interfaces do not fix. */
export async function paletteNames(): Promise<Record<string, unknown>> {
  const [pattern, app] = await Promise.all([patternModule(), hostModule()]);
  return { ...app, ...pattern };
}

/* --------------------------------------------------------------------------- the string table */

/** One key of the one table (R-SPINE-060), asserted present before it is used as an expectation. */
export function copy(key: string): string {
  const table = strings as unknown as Readonly<Record<string, string | undefined>>;
  const said = table[key];
  expect(typeof said, `the one string table states \`${key}\` (docs/design/command-palette.md §3)`).toBe("string");
  return said as string;
}

export { fill };

/* ------------------------------------------------------------------ the identities, declared once */

export const TENANT = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1";
export const OTHER_TENANT = "a2a2a2a2-1111-4111-8111-a2a2a2a2a2a2";
export const PROJECT = "b1b1b1b1-2222-4222-8222-b1b1b1b1b1b1";
export const DRAWING = "c1c1c1c1-3333-4333-8333-c1c1c1c1c1c1";
export const SET = "d1d1d1d1-4444-4444-8444-d1d1d1d1d1d1";
export const LAYOUT = "FOUNDATION PLAN";

/** The workspace a bare `ShellTopBar` mount is handed (its own props are the shell's). */
export const WORKSPACE = { tenantId: TENANT, name: "Ashuganj Holdings" };

/* ------------------------------------------------------------------- the seam's envelope, typed */

/** The four kinds `SEARCH_KINDS` closes over today (AC-2). */
export type SearchKind = "project" | "drawing" | "sheet" | "set";

/**
 * One answered row. A hit always names the project it belongs to, because every address the palette
 * builds from one is inside a project; the other three ids are carried by the kinds that need them.
 */
export interface SearchHit {
  readonly kind: SearchKind;
  /** The stored name, rendered as it stands (Decision §3). */
  readonly label: string;
  readonly projectId: string;
  readonly drawingId?: string | null;
  readonly setId?: string | null;
  readonly layoutName?: string | null;
  /** The row's second line — its project or drawing (Decision §1). */
  readonly meta?: string | null;
}

/**
 * The ONLY carrier the pattern reads (risk note 3): `refusal` is a registered code or null,
 * `faultId` a string or null, and a rejected promise is a fault. No other refusal carrier exists.
 */
export interface SearchAnswer {
  readonly hits: readonly SearchHit[];
  readonly refusal?: string | null;
  readonly faultId?: string | null;
}

export interface SearchRequest {
  readonly tenantId: string;
  readonly query: string;
}

export type SearchFn = (request: SearchRequest) => Promise<SearchAnswer>;

/** A hit of any kind, with the identities declared above. */
export function aHit(over: Partial<SearchHit> = {}): SearchHit {
  return { kind: "project", label: "Ashuganj Terminal", projectId: PROJECT, ...over };
}

/** The query a call carried, read through the rule rather than through one shape guess. */
export function queryOf(request: unknown): string {
  if (typeof request === "string") return request;
  if (typeof request === "object" && request !== null) {
    const asked = (request as { query?: unknown }).query;
    if (typeof asked === "string") return asked;
  }
  throw new Error(`the host called \`search\` with something that names no query: ${JSON.stringify(request)}`);
}

/** The seam, as a probe: what it was asked, and what it answers — immediately or when told to. */
export interface SearchProbe {
  readonly search: SearchFn;
  /** Every query the host asked for, in order. */
  readonly queries: string[];
  /** Answer every call from now on with this, at once. */
  answers(answer: SearchAnswer): void;
  /** Hold every call from now on open, so the pending state can be judged. */
  hold(): void;
  /** Settle every held call with this answer, and answer at once from now on. */
  settle(answer: SearchAnswer): void;
}

export function searchProbe(initial: SearchAnswer = { hits: [] }): SearchProbe {
  const queries: string[] = [];
  let answer: SearchAnswer = initial;
  let holding = false;
  let waiting: ((given: SearchAnswer) => void)[] = [];
  const probe: SearchProbe = {
    queries,
    search: (request: SearchRequest) => {
      queries.push(queryOf(request));
      if (!holding) return Promise.resolve(answer);
      return new Promise<SearchAnswer>((settle) => {
        waiting.push(settle);
      });
    },
    answers: (given: SearchAnswer) => {
      answer = given;
    },
    hold: () => {
      holding = true;
    },
    settle: (given: SearchAnswer) => {
      answer = given;
      holding = false;
      const held = waiting;
      waiting = [];
      for (const settleOne of held) settleOne(given);
    },
  };
  return probe;
}

/** Where the host was asked to go, in order. */
export interface NavigationProbe {
  readonly hrefs: string[];
  readonly navigate: (href: string) => void;
}

export function navigationProbe(): NavigationProbe {
  const hrefs: string[] = [];
  return { hrefs, navigate: (href: string) => void hrefs.push(href) };
}

/* ------------------------------------------------------------------------- the addresses a row leads to */

export interface RouteBuilders {
  projectHomeRoute(tenantId: string, projectId: string): string;
  drawingsRoute(tenantId: string, projectId: string): string;
  viewerSheetRoute(tenantId: string, projectId: string, drawingId: string, layoutName: string): string;
  setRoute(tenantId: string, projectId: string, setId: string): string;
}

/** The four address homes, read from the modules that already own them (B-17). */
export async function routeBuilders(): Promise<RouteBuilders> {
  const [areas, drawings, sets, viewer] = await Promise.all([
    productModule<Record<string, unknown>>(AREAS_MODULE),
    productModule<Record<string, unknown>>(DRAWINGS_ROUTE_MODULE),
    productModule<Record<string, unknown>>(SETS_ROUTE_MODULE),
    productModule<Record<string, unknown>>(VIEWER_ROUTE_MODULE),
  ]);
  return {
    projectHomeRoute: named(areas, "projectHomeRoute", AREAS_MODULE),
    drawingsRoute: named(drawings, "drawingsRoute", DRAWINGS_ROUTE_MODULE),
    setRoute: named(sets, "setRoute", SETS_ROUTE_MODULE),
    viewerSheetRoute: named(viewer, "viewerSheetRoute", VIEWER_ROUTE_MODULE),
  };
}

/** The address a hit leads to, derived from the hit's kind through the four homes (AC-3). */
export function hrefOf(routes: RouteBuilders, tenantId: string, hit: SearchHit): string {
  switch (hit.kind) {
    case "project":
      return routes.projectHomeRoute(tenantId, hit.projectId);
    case "drawing":
      return routes.drawingsRoute(tenantId, hit.projectId);
    case "sheet":
      return routes.viewerSheetRoute(tenantId, hit.projectId, hit.drawingId ?? "", hit.layoutName ?? "");
    case "set":
      return routes.setRoute(tenantId, hit.projectId, hit.setId ?? "");
  }
}

/** The project screen's own copy, which is where an area's label lives (S-Project Decision §3). */
export const PROJECT_HOME_STRINGS = "src/app/(app)/t/[tenant]/p/[project]/home/strings.ts";

/**
 * The area labels, found by the keys the S-Project Decision fixes rather than by the export's name —
 * a table is a table whatever it is called. The palette names an area with the same words the
 * project's own screen does (B-17), so this is the one home either surface's expectation reads.
 */
export async function areaLabels(): Promise<Readonly<Record<string, string>>> {
  const module = await productModule<Record<string, unknown>>(PROJECT_HOME_STRINGS);
  for (const value of Object.values(module)) {
    if (value !== null && typeof value === "object" && "project_home_tab_drawings" in (value as Record<string, unknown>)) {
      return value as Record<string, string>;
    }
  }
  throw new Error(`${PROJECT_HOME_STRINGS} publishes no table carrying the keys S-Project's Decision §3 fixes (project_home_…)`);
}

/**
 * `GO_TARGETS` as a map from a roster id to the `PROJECT_AREAS` key it aims at — read tolerantly,
 * because the increment's interfaces name the roster but not the shape it is written in: a record,
 * a Map, or a list of entries naming the shortcut and the area all read the same here.
 */
export async function goTargets(): Promise<Map<string, string>> {
  const bag = await hostModule();
  const declared = named<unknown>(bag, "GO_TARGETS", PALETTE_APP_DIR);
  const targets = new Map<string, string>();
  const pick = (row: Record<string, unknown>, names: readonly string[]): string | null => {
    for (const name of names) {
      const value = row[name];
      if (typeof value === "string" && value !== "") return value;
    }
    return null;
  };
  if (declared instanceof Map) {
    for (const [key, value] of declared) targets.set(String(key), String(value));
  } else if (Array.isArray(declared)) {
    for (const row of declared as Record<string, unknown>[]) {
      const id = pick(row, ["id", "shortcut", "shortcutId"]);
      const area = pick(row, ["area", "areaKey", "key", "target"]);
      if (id !== null && area !== null) targets.set(id, area);
    }
  } else if (typeof declared === "object" && declared !== null) {
    for (const [key, value] of Object.entries(declared as Record<string, unknown>)) {
      if (typeof value === "string") targets.set(key, value);
      else if (typeof value === "object" && value !== null) {
        const area = pick(value as Record<string, unknown>, ["area", "areaKey", "key", "target"]);
        if (area !== null) targets.set(key, area);
      }
    }
  }
  expect(targets.size, "`GO_TARGETS` names, for each go-to binding, the project area it aims at").toBeGreaterThan(0);
  return targets;
}

/** One area of a project, as `areas.ts` declares it (I-126: availability is read off `route`). */
export interface AreaEntry {
  readonly key: string;
  readonly label: string;
  readonly route: ((tenantId: string, projectId: string) => string) | null;
}

export async function projectAreas(): Promise<readonly AreaEntry[]> {
  const areas = await productModule<Record<string, unknown>>(AREAS_MODULE);
  const roster = named<readonly AreaEntry[]>(areas, "PROJECT_AREAS", AREAS_MODULE);
  expect(Array.isArray(roster), `${AREAS_MODULE} publishes \`PROJECT_AREAS\` as a roster`).toBe(true);
  return roster;
}

/* ------------------------------------------------------------------------------------ the mount */

/** What `PaletteHost` is handed (Decision §1: the provider's props, plus the frame it stands over). */
export interface HostProps {
  tenantId: string;
  projectId: string | null;
  search: SearchFn;
  navigate: (href: string) => void;
  children?: ReactNode;
}

/** A component of the product, as this stage mounts one. */
export type Mountable = FunctionComponent<Record<string, unknown>>;

/** The app-layer host, by the export the increment's interfaces name. */
export async function paletteHostComponent(): Promise<Mountable> {
  const bag = await hostModule();
  const host = named<unknown>(bag, "PaletteHost", PALETTE_APP_DIR);
  expect(typeof host, `${PALETTE_APP_DIR}/ publishes \`PaletteHost\` as a component`).toBe("function");
  return host as Mountable;
}

/**
 * Mount the host and hand back the document body: the dialog is portalled outside the frame
 * (I-144), so everything this stage looks for is looked for in the document, never in the container.
 */
export function mountHost(Host: Mountable, props: HostProps): HTMLElement {
  render(createElement(Host as unknown as FunctionComponent<HostProps>, props));
  return document.body;
}

/** The host mounted over the fixtures, with whatever the case wants to change. */
export async function stageHost(over: Partial<HostProps> = {}): Promise<{
  body: HTMLElement;
  search: SearchProbe;
  navigation: NavigationProbe;
}> {
  const Host = await paletteHostComponent();
  const search = searchProbe();
  const navigation = navigationProbe();
  const props: HostProps = {
    ...over,
    tenantId: over.tenantId ?? TENANT,
    projectId: over.projectId === undefined ? PROJECT : over.projectId,
    search: over.search ?? search.search,
    navigate: over.navigate ?? navigation.navigate,
  };
  return { body: mountHost(Host, props), search, navigation };
}

/* ------------------------------------------------------------------------------- reading the DOM */

/** Every element carrying a contract test id, in document order. */
export function all(root: ParentNode, testId: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

/** The one element carrying a contract test id — asserted to be exactly one. */
export function one(root: ParentNode, testId: string): HTMLElement {
  const found = all(root, testId);
  expect(found.length, `exactly one \`${testId}\` stands on the screen`).toBe(1);
  return found[0] as HTMLElement;
}

/** The group with this `data-group`, or null when it does not render (Decision §1). */
export function group(root: ParentNode, id: string): HTMLElement | null {
  const found = all(root, "command-palette-group").filter((node) => node.getAttribute("data-group") === id);
  expect(found.length, `at most one \`command-palette-group[data-group="${id}"]\` stands on the screen`).toBeLessThan(2);
  return found[0] ?? null;
}

/** The rows of a group, in document order — asserted to render at all. */
export function rowsOf(root: ParentNode, id: string): HTMLElement[] {
  const region = group(root, id);
  expect(region, `the \`${id}\` group renders`).not.toBeNull();
  return all(region as HTMLElement, "command-palette-item");
}

/** Every option on the screen, in document order — the "visible rows" the arrows walk. */
export const visibleRows = (root: ParentNode): HTMLElement[] => all(root, "command-palette-item");

/** The one option marked active, asserted to be exactly one. */
export function activeRow(root: ParentNode): HTMLElement {
  const active = visibleRows(root).filter((row) => row.getAttribute("aria-selected") === "true");
  expect(active.length, "exactly one option is active at a time (Decision §1)").toBe(1);
  return active[0] as HTMLElement;
}

/** The text a node states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------------------------- pressing keys */

/** `ShortcutKeyEvent` as the roster declares it (increment interfaces). */
export interface ShortcutKeyEventLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export type MatchesStep = (event: ShortcutKeyEventLike, step: string) => boolean;

/**
 * The keyboard event a roster step names — chosen by asking the product's own `matchesStep` which
 * of the candidates it accepts, so the acceptance drives the tree by the tree's own reading of a
 * step rather than by a second, transcribed one (B-17, B-19).
 */
export function eventForStep(step: string, matchesStep: MatchesStep): ShortcutKeyEventLike {
  const bare = step.split("+").pop() ?? step;
  const spellings = [bare, bare.toLowerCase(), bare.toUpperCase()];
  const candidates: ShortcutKeyEventLike[] = [];
  for (const key of spellings) {
    candidates.push({ key }, { key, shiftKey: true }, { key, metaKey: true }, { key, ctrlKey: true }, { key, metaKey: true, shiftKey: true }, { key, ctrlKey: true, shiftKey: true });
  }
  const found = candidates.find((candidate) => matchesStep(candidate, step) === true);
  expect(
    found,
    `no keyboard event this stage can synthesize satisfies \`matchesStep(event, ${JSON.stringify(step)})\` — the roster spells a step the product cannot recognise from a key plus its modifiers`,
  ).toBeTruthy();
  return found as ShortcutKeyEventLike;
}

/** Press one synthesized event where the focus is (or on the body, which is "anywhere"). */
export function press(event: ShortcutKeyEventLike, target?: Element | null): void {
  const where = target ?? document.activeElement ?? document.body;
  fireEvent.keyDown(where, { ...event });
}

/** Press the steps of a roster entry in order, on the same target — a chord is a sequence. */
export function pressSteps(steps: readonly string[], matchesStep: MatchesStep, target?: Element | null): void {
  for (const step of steps) press(eventForStep(step, matchesStep), target);
}

/** Escape, which every overlay in this tree is dismissed by. */
export const pressEscape = (target?: Element | null): void => press({ key: "Escape" }, target);

/**
 * ⌘K as a real keyboard sends it (AC-1). Spelled here so every suite opens the palette the one way,
 * and so the roster's own `palette` entry is judged against the product's `matchesStep` rather than
 * against a second transcription of the chord (AC-4).
 */
export const PALETTE_CHORD = { key: "k", code: "KeyK", metaKey: true } as const;

/** Open the palette from anywhere in the document, and wait for the dialog to stand. */
export async function openPalette(body: HTMLElement): Promise<HTMLElement> {
  fireEvent.keyDown(document.body, { ...PALETTE_CHORD });
  return waitFor(() => one(body, "command-palette"));
}

/** The palette's input, which is where focus lives while it is open (I-137). */
export const paletteInput = (body: HTMLElement): HTMLInputElement => one(body, "command-palette-input") as HTMLInputElement;
