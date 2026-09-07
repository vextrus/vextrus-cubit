/**
 * The stage inc-217-command-palette's acceptance stands on (R-SPINE-050, R-UI-032, R-UI-020).
 *
 * Mechanics only — nothing here judges the product. The palette is driven the way a person drives
 * it: the frame is mounted, a key is pressed, an option is arrowed to, Enter is pressed, and what
 * the screen did is read back off roles, aria state and the test contract's ids. Product modules
 * are loaded by absolute path through `productModule`, so a file the Builder has not written yet
 * fails as an assertion naming it rather than as a collection death that would read as a defect in
 * the acceptance.
 *
 * This file serves BOTH lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Every fixture the two lanes assert over is declared once,
 * here (B-19), and every name below is one the increment's interfaces, its test contract or a
 * committed Design Decision publishes (B-12): a Builder who reads only those can satisfy it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { expect } from "vitest";
import { NO_HIT_QUERY, SEARCH_KINDS, SEARCH_TOKEN } from "./search-contract";

export { NO_HIT_QUERY, SEARCH_KINDS, SEARCH_TOKEN, SEARCH_TOKEN_TYPED, BLANK_QUERIES, searchName } from "./search-contract";

/* ------------------------------------------------------------------ the homes the spec names */

/** The checkout both lanes run against: the gate's mount states it, the unit lane runs in it. */
export const REPO_ROOT: string = process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();

/** The pattern barrel (increment interfaces): `CommandPalette`, `ShortcutSheet`, `CommandPaletteProvider`. */
export const PALETTE_BARREL = "src/ui/patterns/command-palette/index.ts";

/** The pattern's R-UI-050 matrix, in the one enumerable place a suite reflects over (AC-4). */
export const PALETTE_STATES_MODULE = "src/ui/patterns/command-palette/states.ts";

/** The one shortcut roster (increment interfaces): `SHORTCUTS`, `chordOf`, `matchStep`, … */
export const ROSTER_MODULE = "src/ui/shell/shortcuts/roster.ts";

/** The app-layer host that holds the addresses and the transport (docs/design/command-palette.md §1). */
export const HOST_MODULE = "src/app/(app)/t/[tenant]/palette/palette-host.tsx";

/** The frame's top bar — the trigger's occupant (shell I-135). */
export const TOP_BAR_MODULE = "src/ui/shell/shell-top-bar.tsx";

/** `PROJECT_AREAS`, whose `route` is what an area's availability is read off (I-126, I-138). */
export const AREAS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/home/areas.ts";

/** The one typed string table (R-SPINE-060). */
export const STRINGS_MODULE = "src/ui/strings/index.ts";

/** The shell's own addresses — `shellHref` (AC-3). */
export const SHELL_ROUTES_MODULE = "src/ui/shell/routes.ts";

/** The four route-address homes AC-2 names; nothing here re-spells an address (B-17). */
export const DRAWINGS_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/drawings/route-address.ts";
export const SETS_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets/route-address.ts";
export const VIEWER_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/route-address.ts";

/** The ui-side refusal register the palette's card is read against (I-142). */
export const REFUSAL_ENTRIES_MODULE = "src/ui/screen-states/refusal-entries.ts";

/** The refusal marker a rejected read is marked with (R-SPINE-062). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/** R-UI-050's seven, in the clause's own order. */
export const SCREEN_STATES_CONTRACT_MODULE = "src/ui/screen-states/contract.ts";

/* ------------------------------------------------------------------------------ the test ids */

/** The test contract's ids, spelled once (C-05). */
export const TESTID = Object.freeze({
  trigger: "shell-command-palette",
  palette: "command-palette",
  input: "command-palette-input",
  list: "command-palette-list",
  group: "command-palette-group",
  item: "command-palette-item",
  reason: "command-palette-item-reason",
  empty: "command-palette-empty",
  loading: "command-palette-loading",
  refusal: "command-palette-refusal",
  sheet: "shortcut-sheet",
  sheetRow: "shortcut-sheet-row",
  sheetKeys: "shortcut-sheet-keys",
  topBar: "shell-topbar",
});

/** The groups the Design Decision §1 fixes, by the `data-group` value each carries. */
export const GROUP = Object.freeze({
  recent: "recent",
  navigate: "navigate",
  areas: "areas",
  actions: "actions",
  shortcuts: "shortcuts",
});

/** The two clause-named actions (R-SPINE-050), by the key their row is found under (AC-5). */
export const ACTION_KEYS: readonly string[] = Object.freeze(["affirm-scale", "export-boq"]);

/* ------------------------------------------------------------------------ loading the product */

/** A component of the product, as this stage mounts one. */
export type Mountable = FunctionComponent<Record<string, unknown>>;

/** Import a product module by repo-relative path, asserting it exists first (the frame's contract). */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** One declared export, refused as absent rather than mounted as undefined. */
export function exported(bag: Record<string, unknown>, name: string, home: string): Mountable {
  expect(typeof bag[name], `${home} publishes \`${name}\` (the increment's declared interfaces)`).toBe("function");
  return bag[name] as Mountable;
}

/** A declared function export, called as itself. */
export function exportedFn(bag: Record<string, unknown>, name: string, home: string): (...args: never[]) => unknown {
  expect(typeof bag[name], `${home} publishes \`${name}\` (the increment's declared interfaces)`).toBe("function");
  return bag[name] as (...args: never[]) => unknown;
}

/** The one typed string table, by the barrel the tree already publishes it from. */
export async function strings(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(STRINGS_MODULE);
  const table = module["strings"];
  expect(typeof table, `${STRINGS_MODULE} publishes \`strings\` (R-SPINE-060)`).toBe("object");
  return table as Record<string, string>;
}

/** One key of that table, asserted present before it is used as an expectation. */
export function copy(table: Record<string, string>, key: string): string {
  const said = table[key];
  expect(typeof said, `the one string table states \`${key}\` (R-SPINE-060; the Decision's § 3 copy)`).toBe("string");
  return said as string;
}

/** Every value the string table holds — what a sentence on the screen must have come from (ARCH-01). */
export function tableValues(table: Record<string, string>): string[] {
  return Object.values(table).filter((value): value is string => typeof value === "string");
}

export interface RosterEntry {
  id: string;
  scope: string;
  keys: readonly string[];
  label: string;
  action: string;
  target?: string;
}

export interface RosterModule {
  SHORTCUTS: readonly RosterEntry[];
  SHORTCUT_SCOPES: readonly string[];
  CHORD_TIMEOUT_MS: number;
  chordOf: (entry: RosterEntry) => string;
  matchStep: (event: unknown, step: string) => boolean;
}

/** The one roster the palette rows, the ? sheet and the key handler all read (increment interfaces). */
export async function rosterModule(): Promise<RosterModule> {
  const module = await productModule<Record<string, unknown>>(ROSTER_MODULE);
  expect(Array.isArray(module["SHORTCUTS"]), `${ROSTER_MODULE} publishes \`SHORTCUTS\` (increment interfaces)`).toBe(true);
  expect(Array.isArray(module["SHORTCUT_SCOPES"]), `${ROSTER_MODULE} publishes \`SHORTCUT_SCOPES\``).toBe(true);
  expect(typeof module["CHORD_TIMEOUT_MS"], `${ROSTER_MODULE} publishes \`CHORD_TIMEOUT_MS\``).toBe("number");
  expect(typeof module["chordOf"], `${ROSTER_MODULE} publishes \`chordOf\``).toBe("function");
  expect(typeof module["matchStep"], `${ROSTER_MODULE} publishes \`matchStep\``).toBe("function");
  return module as unknown as RosterModule;
}

/** One area of a project, as `areas.ts` declares it — availability read off `route` (I-126). */
export interface AreaEntry {
  key: string;
  label: string;
  route: ((tenantId: string, projectId: string) => string) | null;
}

/** `PROJECT_AREAS`, from its one home: the palette's area rows are derived from it, never listed. */
export async function projectAreas(): Promise<readonly AreaEntry[]> {
  const module = await productModule<Record<string, unknown>>(AREAS_MODULE);
  expect(Array.isArray(module["PROJECT_AREAS"]), `${AREAS_MODULE} publishes \`PROJECT_AREAS\``).toBe(true);
  return module["PROJECT_AREAS"] as readonly AreaEntry[];
}

/* ------------------------------------------------------------------------------- the fixtures */

/** The workspace, the project and the three subjects every mount in both lanes stands on (B-19). */
export const TENANT = "a1111111-1111-4111-8111-111111111111";
export const OTHER_TENANT = "b1111111-1111-4111-8111-111111111111";
export const PROJECT = "a2222222-2222-4222-8222-222222222222";
export const DRAWING = "a3333333-3333-4333-8333-333333333333";
export const SET = "a4444444-4444-4444-8444-444444444444";

/** A sheet is named by its layout, and a layout name carries a space (viewer route-address). */
export const LAYOUT = "KERANIGANJ FOUNDATION PLAN";

/** The typed query every hit's label carries (AC-2: a label contains the query, case-insensitively). */
export const QUERY = SEARCH_TOKEN;

/** A query nothing in the staged workspace matches (AC-5's empty state). */
export const QUERY_WITH_NO_HIT = NO_HIT_QUERY;

/** The workspace's own name, as the frame's breadcrumb reads it. */
export const WORKSPACE_NAME = "Keraniganj Works";

/**
 * One answer of the search, in the shape the four kinds need to build their addresses. Each id is
 * stated under both its generic and its named key, so the mapper reads whichever it declares and
 * the address it builds is the same either way — the acceptance pins the ADDRESS, never a field.
 */
export interface PaletteHit {
  readonly kind: "project" | "drawing" | "sheet" | "set";
  readonly label: string;
  readonly name: string;
  readonly id: string;
  readonly projectId: string;
  readonly drawingId?: string;
  readonly setId?: string;
  readonly sheetId?: string;
  readonly layoutName?: string;
}

/** One hit of each kind, all four matching `QUERY` case-insensitively (AC-2). */
export const HITS: readonly PaletteHit[] = Object.freeze([
  { kind: "project", label: "Keraniganj Depot", name: "Keraniganj Depot", id: PROJECT, projectId: PROJECT },
  { kind: "drawing", label: "KERANIGANJ-A1.dxf", name: "KERANIGANJ-A1.dxf", id: DRAWING, projectId: PROJECT, drawingId: DRAWING },
  {
    kind: "sheet",
    label: LAYOUT,
    name: LAYOUT,
    id: `${DRAWING}:${LAYOUT}`,
    projectId: PROJECT,
    drawingId: DRAWING,
    sheetId: `${DRAWING}:${LAYOUT}`,
    layoutName: LAYOUT,
  },
  { kind: "set", label: "Keraniganj issue set", name: "Keraniganj issue set", id: SET, projectId: PROJECT, setId: SET },
]);

/** The four kinds R-SPINE-050 names for navigation, from the fixtures rather than beside them. */
export const HIT_KINDS: readonly string[] = HITS.map((hit) => hit.kind);

/** The kinds the search answers, from the one place both lanes read them (search-contract). */
export const SEARCH_KIND_ROSTER: readonly string[] = SEARCH_KINDS;

/** `n` distinct project hits, each its own destination — what a recents cap is measured with. */
export function projectHits(n: number): readonly PaletteHit[] {
  return Array.from({ length: n }, (_, index) => {
    const projectId = `a2222222-2222-4222-8222-${`${index}`.padStart(12, "0")}`;
    return { kind: "project", label: `Keraniganj Depot ${index}`, name: `Keraniganj Depot ${index}`, id: projectId, projectId } as const;
  });
}

/** The address a hit's kind builds, from the route-address homes themselves (AC-2, B-17). */
export async function routeOf(hit: PaletteHit, tenantId: string = TENANT): Promise<string> {
  const areas = await productModule<Record<string, unknown>>(AREAS_MODULE);
  const drawings = await productModule<Record<string, unknown>>(DRAWINGS_ROUTE_MODULE);
  const sets = await productModule<Record<string, unknown>>(SETS_ROUTE_MODULE);
  const viewer = await productModule<Record<string, unknown>>(VIEWER_ROUTE_MODULE);
  const projectHomeRoute = exportedFn(areas, "projectHomeRoute", AREAS_MODULE) as (t: string, p: string) => string;
  const drawingsRoute = exportedFn(drawings, "drawingsRoute", DRAWINGS_ROUTE_MODULE) as (t: string, p: string) => string;
  const setRoute = exportedFn(sets, "setRoute", SETS_ROUTE_MODULE) as (t: string, p: string, s: string) => string;
  const viewerSheetRoute = exportedFn(viewer, "viewerSheetRoute", VIEWER_ROUTE_MODULE) as (t: string, p: string, d: string, l: string) => string;

  switch (hit.kind) {
    case "project":
      return projectHomeRoute(tenantId, hit.projectId);
    case "drawing":
      return drawingsRoute(tenantId, hit.projectId);
    case "sheet":
      return viewerSheetRoute(tenantId, hit.projectId, hit.drawingId ?? "", hit.layoutName ?? "");
    default:
      return setRoute(tenantId, hit.projectId, hit.setId ?? "");
  }
}

/* --------------------------------------------------------------------------- the search seams */

/** What the host is given in place of the `spine.search` transport (AC-2, AC-5). */
export type SearchSeam = (...args: unknown[]) => Promise<unknown>;

/**
 * A search that answers the given hits, however the host asks for them: the answer is an array of
 * the hits that also carries them under `hits`, so a caller reading either shape is answered.
 */
export function searchAnswering(hits: readonly PaletteHit[], record: unknown[] = []): SearchSeam {
  return async (...args: unknown[]): Promise<unknown> => {
    record.push(args[0]);
    const answer = [...hits] as PaletteHit[] & { hits?: readonly PaletteHit[] };
    answer.hits = [...hits];
    return answer;
  };
}

/** A search that never answers — the loading state, held open for as long as the case needs it. */
export function searchPending(): SearchSeam {
  return () => new Promise<unknown>(() => undefined);
}

/**
 * A search that refuses with a registered code, marked the way the product marks a refusal, and
 * carrying the code on the shapes a transport hands a caller (R-SPINE-062).
 */
export async function searchRefusing(code: string, message?: string, remedy?: string): Promise<SearchSeam> {
  const marker = await productModule<Record<string, unknown>>(REFUSAL_MARKER_MODULE);
  const refusal = exportedFn(marker, "refusal", REFUSAL_MARKER_MODULE) as (code: string, message: string, detail?: object) => Error;
  return async () => {
    const error = refusal(code, message ?? `refused: ${code}`, { code, refusalCode: code, remedy }) as Error & {
      data?: unknown;
      shape?: unknown;
    };
    error.data = { code, refusalCode: code, remedy };
    error.shape = { data: { code, refusalCode: code } };
    throw error;
  };
}

/* ---------------------------------------------------------------------------------- the mount */

/** jsdom lays nothing out and implements no media queries; the overlay primitives need both. */
let stubsInstalled = false;
export function installDomStubs(): void {
  if (stubsInstalled) return;
  stubsInstalled = true;
  const scope = globalThis as unknown as { ResizeObserver?: unknown; matchMedia?: unknown };
  if (typeof scope.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    scope.ResizeObserver = ResizeObserverStub;
  }
  if (typeof scope.matchMedia !== "function") {
    scope.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto["scrollIntoView"] !== "function") proto["scrollIntoView"] = function scrollIntoView(): void {};
  if (typeof proto["scrollTo"] !== "function") proto["scrollTo"] = function scrollTo(): void {};
  if (typeof proto["hasPointerCapture"] !== "function")
    proto["hasPointerCapture"] = function hasPointerCapture(): boolean {
      return false;
    };
  if (typeof proto["releasePointerCapture"] !== "function") proto["releasePointerCapture"] = function releasePointerCapture(): void {};
}

/** What a mounted frame hands the case that drives it. */
export interface Frame {
  /** The keyboard the whole journey is driven from (R-UI-032: keyboard-first). */
  readonly user: ReturnType<typeof userEvent.setup>;
  /** Every address `navigate` was asked for, in order. */
  readonly navigated: string[];
  /** Every input the host handed the search seam, in order. */
  readonly searched: unknown[];
  readonly tenantId: string;
  readonly projectId: string | null;
}

export interface MountOptions {
  tenantId?: string;
  /** The project the reader stands in, or null for a workspace-level address (I-139). */
  projectId?: string | null;
  search?: SearchSeam;
  hits?: readonly PaletteHit[];
  /** Extra children under the frame, beside the top bar. */
  children?: ReactNode;
}

/**
 * Mount the signed-in frame: the app-layer host holding the addresses and the transport, with the
 * shell's top bar under it as the trigger's occupant (I-135).
 *
 * The increment's interfaces fix the host's props and the provider's, but not which of the two
 * mounts the other — so both compositions are attempted and the one that renders the frame is the
 * one used. Nothing else about the mount is tolerant: the trigger, the dialog and every row are
 * read strictly through the test contract's ids.
 */
export async function mountFrame(options: MountOptions = {}): Promise<Frame> {
  installDomStubs();
  const tenantId = options.tenantId ?? TENANT;
  const projectId = options.projectId === undefined ? PROJECT : options.projectId;
  const navigated: string[] = [];
  const searched: unknown[] = [];
  const search = options.search ?? searchAnswering(options.hits ?? HITS, searched);
  const navigate = (href: unknown): void => {
    navigated.push(String(href));
  };

  const hostModule = await productModule<Record<string, unknown>>(HOST_MODULE);
  const host = exported(hostModule, "PaletteHost", HOST_MODULE);
  const barrel = await productModule<Record<string, unknown>>(PALETTE_BARREL);
  const provider = exported(barrel, "CommandPaletteProvider", PALETTE_BARREL);
  const barModule = await productModule<Record<string, unknown>>(TOP_BAR_MODULE);
  const topBar = exported(barModule, "ShellTopBar", TOP_BAR_MODULE);

  const props: Record<string, unknown> = { tenantId, projectId, search, navigate };
  const frameChildren = (): ReactNode =>
    createElement(
      "div",
      null,
      createElement(topBar, {
        workspace: { tenantId, name: WORKSPACE_NAME },
        area: "projects",
        atAreaHome: true,
        email: null,
        signOut: () => {},
      }),
      options.children ?? null,
    );

  const attempt = (tree: () => ReactNode): boolean => {
    try {
      render(createElement("div", null, tree()));
    } catch {
      return false;
    }
    return document.body.querySelector(`[data-testid="${TESTID.trigger}"]`) !== null;
  };

  const hostOverProvider = (): ReactNode => createElement(host, { ...props, children: frameChildren() });
  const providerOverHost = (): ReactNode =>
    createElement(provider, { ...props, children: createElement(host, { ...props, children: frameChildren() }) });

  if (!attempt(hostOverProvider)) {
    cleanup();
    expect(
      attempt(providerOverHost),
      `mounting PaletteHost renders no \`${TESTID.trigger}\` in the top bar — neither as the frame itself nor inside a CommandPaletteProvider (AC-1)`,
    ).toBe(true);
  }

  return { user: userEvent.setup(), navigated, searched, tenantId, projectId };
}

/** The top bar alone, outside any provider — the bare mount I-135 keeps standing (AC-1). */
export async function mountBareTopBar(): Promise<HTMLElement> {
  installDomStubs();
  const barModule = await productModule<Record<string, unknown>>(TOP_BAR_MODULE);
  const topBar = exported(barModule, "ShellTopBar", TOP_BAR_MODULE);
  const { container } = render(
    createElement(topBar, {
      workspace: { tenantId: TENANT, name: WORKSPACE_NAME },
      area: "projects",
      atAreaHome: true,
      email: null,
      signOut: () => {},
    }),
  );
  return container;
}

/** Unmount everything the case put on the document. */
export function unmountAll(): void {
  cleanup();
}

/* --------------------------------------------------------------------------- reading the DOM */

/**
 * Everything carrying a contract id, in document order — read off `document.body` because every
 * overlay in this tree portals there (overlay Decision § 1).
 */
export function all(testId: string, within: ParentNode = document.body): HTMLElement[] {
  return [...within.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

/** The one element carrying a contract id, asserted to be exactly one. */
export function one(testId: string, within: ParentNode = document.body): HTMLElement {
  const found = all(testId, within);
  expect(found.length, `the screen renders exactly one \`${testId}\` (test contract)`).toBe(1);
  return found[0] as HTMLElement;
}

/** The element carrying a contract id, or null when the screen renders none. */
export function maybe(testId: string, within: ParentNode = document.body): HTMLElement | null {
  return all(testId, within)[0] ?? null;
}

/** The text a cell states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** One group of the list, by the `data-group` the Decision § 1 fixes. */
export function group(name: string): HTMLElement | null {
  return all(TESTID.group).find((node) => node.getAttribute("data-group") === name) ?? null;
}

/** The rows of one group, in document order. */
export function itemsOf(name: string): HTMLElement[] {
  const held = group(name);
  return held === null ? [] : all(TESTID.item, held);
}

/** The option the combobox says is active — `aria-activedescendant`, resolved (WAI-ARIA). */
export function activeOption(): HTMLElement | null {
  const input = maybe(TESTID.input);
  const id = input?.getAttribute("aria-activedescendant");
  if (id === null || id === undefined || id === "") return null;
  return document.getElementById(id);
}

/** Whether an option names a key — by `data-*` if it carries one, else by the id § 1 builds from it. */
export function namesKey(option: HTMLElement, key: string): boolean {
  const attributes = ["data-action", "data-key", "data-area", "data-shortcut", "data-target"];
  if (attributes.some((name) => option.getAttribute(name) === key)) return true;
  return option.id.endsWith(key);
}

/* ------------------------------------------------------------------------ driving the palette */

/** ⌘K / Ctrl+K, as the two chords AC-1 names. */
export const META_K = "{Meta>}k{/Meta}";
export const CONTROL_K = "{Control>}k{/Control}";

/** Open the palette from the keyboard and wait for the dialog and its input. */
export async function openPalette(frame: Frame, chord: string = META_K): Promise<HTMLElement> {
  await frame.user.keyboard(chord);
  await settle();
  const palette = maybe(TESTID.palette);
  expect(palette, `pressing ${chord} opens \`${TESTID.palette}\` (AC-1)`).not.toBeNull();
  return palette as HTMLElement;
}

/** Type a query into the palette's own input, and let the answer arrive. */
export async function typeQuery(frame: Frame, query: string): Promise<void> {
  const input = one(TESTID.input);
  await frame.user.click(input);
  await frame.user.keyboard(query);
  await settle();
}

/**
 * Arrow down to the option a predicate names and press Enter on it (AC-2's gesture). The number of
 * presses is bounded by the options on screen, so a palette that never activates the row fails as
 * a named assertion rather than as a hung test.
 */
export async function arrowTo(frame: Frame, predicate: (option: HTMLElement) => boolean, what: string): Promise<HTMLElement> {
  const options = all(TESTID.item);
  expect(options.length, `the list holds options to arrow through — looking for ${what}`).toBeGreaterThan(0);
  for (let step = 0; step <= options.length; step += 1) {
    const active = activeOption();
    if (active !== null && predicate(active)) return active;
    await frame.user.keyboard("{ArrowDown}");
    await settle();
  }
  const active = activeOption();
  expect(active !== null && predicate(active), `ArrowDown reaches ${what} and makes it the active option (AC-2, § 1's keyboard)`).toBe(true);
  return active as HTMLElement;
}

/** Let promises, effects and the microtask queue finish before the DOM is read. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
