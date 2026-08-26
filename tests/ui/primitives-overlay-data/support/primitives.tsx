/**
 * Acceptance support for inc-005 — the overlay and data primitive sets (R-UI-005/010/011/012,
 * B-17, B-19, Q-11).
 *
 * This module is the SINGLE declaration of the canonical states (B-19): the roster below names one
 * mounted/open state per barrel export, and every suite that enumerates components imports it.
 * Nothing here freezes "what exists today" — the roster is the thing a new export must join, and
 * the derivation test reads the barrels by reflection, so adding a primitive to a barrel fails
 * here until its canonical state is declared, which is the rule, not a snapshot.
 *
 * The primitives are observed through what the increment declares: the two barrels' export names,
 * the sixteen `data-testid`s of the closed test contract (docs/design/primitives-data.md §7), and
 * the roles / aria state / data-attributes that Decision fixes. jsdom lays nothing out, so every
 * stylesheet-derived fact (36/28 px rows, hairlines, sticky offsets, contrast) is left to the
 * gallery leaf's J-004 baselines, exactly as this increment's risk notes rule.
 *
 * NOTE FOR THE BUILDER: product modules are loaded here by absolute path, so the `@/*` tsconfig
 * alias is never resolved for the specifiers *inside* them either — this tree's vitest configs
 * install no path-alias plugin. Keep imports between src/ files relative.
 *
 * NOTE FOR THE BUILDER: the runtime packages this increment declares (Radix, sonner, TanStack,
 * react-resizable-panels) are never imported by these suites — they are reached only through the
 * product's own barrels. Until the barrels exist, every suite here fails naming the missing file.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { expect } from "vitest";

/** The checkout these tests run against. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The declared homes (increment interfaces + Design Decision §1). */
export const OVERLAY_DIR = "src/ui/primitives/overlay";
export const DATA_DIR = "src/ui/primitives/data";
export const OVERLAY_BARREL = `${OVERLAY_DIR}/index.ts`;
export const DATA_BARREL = `${DATA_DIR}/index.ts`;
/** The reticle's single home — this increment's CSS may not restate it (B-17, R-UI-012). */
export const RETICLE_CSS = "src/ui/primitives/core/reticle.css";
export const RETICLE_CLASS = "cx-reticle";

/** The sixteen ids of the closed test contract (C-05, Design Decision §7). */
export const TESTIDS = {
  dialogContent: "dialog-content",
  sheetContent: "sheet-content",
  popoverContent: "popover-content",
  dropdownContent: "dropdown-content",
  contextmenuContent: "contextmenu-content",
  datatable: "datatable",
  datatableHeader: "datatable-header",
  datatableViewport: "datatable-viewport",
  datatableRow: "datatable-row",
  datatableCell: "datatable-cell",
  datatableCellEditor: "datatable-cell-editor",
  tree: "tree",
  treeItem: "tree-item",
  scrollareaViewport: "scrollarea-viewport",
  resizableHandle: "resizable-handle",
} as const;

/** `datatable-filter-{columnId}` — the one parameterised id of the contract. */
export const filterTestId = (columnId: string): string => `datatable-filter-${columnId}`;

/** The Design Decision §4 sample copy, verbatim — the roster's canonical states. */
export const COPY = {
  dialogTrigger: "Rename project",
  dialogTitle: "Rename project",
  dialogBody: "The new name appears on every export and drawing sheet.",
  dialogClose: "Close",
  dialogCancel: "Cancel",
  dialogSave: "Save changes",
  sheetTrigger: "Line details",
  sheetLabel: "Line details",
  sheetHeading: "Line 4 \u2014 Footing F-8",
  sheetBody: "Basis and quantity for the selected register line.",
  popoverTrigger: "Column options",
  popoverBody: "Sort, filter and pin from the column header.",
  dropdownTrigger: "Row actions",
  dropdownItems: ["Duplicate line", "Copy quantity", "Delete line"],
  contextTrigger: "Right-click for drawing actions",
  contextItems: ["Open in viewer", "Rename", "Remove from project"],
  toastTitle: "Quantity updated",
  toastDescription: "Line 4 \u2014 7.25 CUM saved to the register.",
  tabs: ["Overview", "Quantities", "History"],
  tabPanels: [
    "Everything the project knows about this sheet.",
    "Quantities grouped by element class.",
    "Every change, newest first.",
  ],
  resizableHandleLabel: "Resize panels",
} as const;

/* ------------------------------------------------------------------ sample data (Decision §4) */

export interface TreeItemFixture {
  id: string;
  label: string;
  children?: TreeItemFixture[];
}

/** The Decision §4 tree, with its declared default-expanded and selected identities. */
export const TREE_ITEMS: TreeItemFixture[] = [
  {
    id: "riverside-tower",
    label: "Riverside Tower",
    children: [
      {
        id: "structural",
        label: "Structural",
        children: [
          { id: "s-101", label: "S-101 \u2014 Column layout" },
          { id: "s-102", label: "S-102 \u2014 Ground beams" },
        ],
      },
      {
        id: "architectural",
        label: "Architectural",
        children: [{ id: "a-201", label: "A-201 \u2014 Level 1 plan" }],
      },
    ],
  },
];
export const TREE_DEFAULT_EXPANDED = ["riverside-tower", "structural"];
export const TREE_SELECTED_ID = "s-101";

/** ScrollArea's forty lines (Decision §4), generated rather than transcribed. */
export const SCROLL_LINE_COUNT = 40;
export const scrollLines = (): string[] =>
  Array.from({ length: SCROLL_LINE_COUNT }, (_, i) => `Sheet ${i + 1} of ${SCROLL_LINE_COUNT}`);

export const RESIZABLE_PANELS = [
  { id: "sheet-list", label: "Sheet list", size: 30 },
  { id: "viewer", label: "Viewer", size: 70 },
] as const;

export interface TableRow {
  id: string;
  item: string;
  element: string;
  qty: number;
  unit: string;
  basis: string;
}

/** The five-row DataTable sample of Decision §4. */
export const TABLE_ROWS: TableRow[] = [
  { id: "l1", item: "Line 1", element: "Column C-12", qty: 4.8, unit: "CUM", basis: "MEASURED" },
  { id: "l2", item: "Line 2", element: "Beam GB-3", qty: 12.6, unit: "CUM", basis: "DERIVED" },
  { id: "l3", item: "Line 3", element: "Slab S-2", qty: 96, unit: "SQM", basis: "TRANSCRIBED" },
  { id: "l4", item: "Line 4", element: "Footing F-8", qty: 7.25, unit: "CUM", basis: "INTERPRETED" },
  { id: "l5", item: "Line 5", element: "Column C-4", qty: 3.1, unit: "CUM", basis: "ENTERED" },
];

/** The Decision's generated virtualisation set: n = 1…1000, elements and bases cycling. */
export const VIRTUAL_ROW_COUNT = 1000;
const ELEMENT_CYCLE = ["Column", "Beam", "Slab", "Footing"];
const BASIS_CYCLE = [
  "MEASURED",
  "TRANSCRIBED",
  "DERIVED",
  "IMPORTED",
  "ENTERED",
  "INTERPRETED",
  "DEFAULTED",
];
export const virtualRows = (count = VIRTUAL_ROW_COUNT): TableRow[] =>
  Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      id: `v${n}`,
      item: `Line ${n}`,
      element: ELEMENT_CYCLE[i % ELEMENT_CYCLE.length] ?? "",
      qty: n,
      unit: "CUM",
      basis: BASIS_CYCLE[i % BASIS_CYCLE.length] ?? "",
    };
  });

/** The two row heights R-UI-005 fixes; used only as the lower bound a total-size element must clear. */
export const ROW_HEIGHT_COMFORTABLE_PX = 36;
export const ROW_HEIGHT_COMPACT_PX = 28;

/** Column ids of the Decision §4 table — the identities every table assertion imports (B-19). */
export const COLUMN_IDS = {
  item: "item",
  element: "element",
  qty: "qty",
  unit: "unit",
  basis: "basis",
} as const;

export const formatQty = (value: number): string => value.toFixed(2);

/** A TanStack ColumnDef bag, typed structurally so this file imports no table package. */
export interface ColumnFixture {
  id: string;
  accessorKey: string;
  header: string;
  enableSorting?: boolean;
  cell?: (context: { getValue: () => unknown }) => React.ReactNode;
  meta?: { align?: "right"; filterable?: boolean; editable?: boolean };
}

/**
 * The Decision §4 columns: Item (filterable, the pinned one), Element, Qty (right-aligned,
 * sortable, editable), Unit, Basis.
 */
export const tableColumns = (): ColumnFixture[] => [
  { id: COLUMN_IDS.item, accessorKey: "item", header: "Item", meta: { filterable: true } },
  { id: COLUMN_IDS.element, accessorKey: "element", header: "Element" },
  {
    id: COLUMN_IDS.qty,
    accessorKey: "qty",
    header: "Qty",
    enableSorting: true,
    cell: (context) => formatQty(Number(context.getValue())),
    meta: { align: "right", editable: true },
  },
  { id: COLUMN_IDS.unit, accessorKey: "unit", header: "Unit" },
  { id: COLUMN_IDS.basis, accessorKey: "basis", header: "Basis" },
];

export const getRowId = (row: TableRow): string => row.id;

/* ------------------------------------------------------------------ product loading */

/**
 * Import a product module by repo-relative path, asserting it exists first so a module the Builder
 * has not written yet fails as an assertion naming the file, never as an unreadable resolution
 * error. (Same contract as the held-out frame's `productModule`, so both sets read alike.)
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${relative} is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

export type ModuleBag = Record<string, unknown>;

export const loadOverlayBarrel = (): Promise<ModuleBag> => productModule<ModuleBag>(OVERLAY_BARREL);
export const loadDataBarrel = (): Promise<ModuleBag> => productModule<ModuleBag>(DATA_BARREL);

export interface Barrels {
  overlay: ModuleBag;
  data: ModuleBag;
}

export const loadBarrels = async (): Promise<Barrels> => ({
  overlay: await loadOverlayBarrel(),
  data: await loadDataBarrel(),
});

/** A module's named exports, module plumbing excluded. */
export const exportNames = (mod: ModuleBag): string[] =>
  Object.keys(mod)
    .filter((name) => name !== "default" && name !== "__esModule")
    .sort();

/* ------------------------------------------------------------------ element building */

type AnyComponent = React.ComponentType<Record<string, unknown>>;

/** One element from a barrel, asserting the export is a component before it is used. */
export function el(
  mod: ModuleBag,
  barrel: string,
  name: string,
  props: Record<string, unknown> = {},
  ...children: React.ReactNode[]
): React.ReactElement {
  const component = mod[name];
  expect(typeof component, `${barrel} does not export a component named \`${name}\``).toBe("function");
  return React.createElement(component as AnyComponent, props, ...children);
}

export const ov = (
  b: Barrels,
  name: string,
  props: Record<string, unknown> = {},
  ...children: React.ReactNode[]
): React.ReactElement => el(b.overlay, OVERLAY_BARREL, name, props, ...children);

export const dt = (
  b: Barrels,
  name: string,
  props: Record<string, unknown> = {},
  ...children: React.ReactNode[]
): React.ReactElement => el(b.data, DATA_BARREL, name, props, ...children);

/** The `toast` export is a function, not a component — asserted on its own terms. */
export function toastFn(b: Barrels): (message: string, options?: unknown) => unknown {
  const fn = b.overlay.toast;
  expect(typeof fn, `${OVERLAY_BARREL} does not export a callable \`toast\``).toBe("function");
  return fn as (message: string, options?: unknown) => unknown;
}

/* ------------------------------------------------------------------ the roster (B-19) */

export interface KeyboardUser {
  tab(): Promise<void>;
  keyboard(text: string): Promise<void>;
  click(element: Element): Promise<void>;
  clear(element: Element): Promise<void>;
  type(element: Element, text: string): Promise<void>;
  pointer(input: unknown): Promise<void>;
}

/**
 * One canonical state. `covers` names the barrel exports this state exercises; the derivation test
 * requires every export of both barrels to be covered by exactly one case, so a primitive added to
 * a barrel later fails here until its canonical state is declared — the rule, never a frozen list.
 *
 * `open` performs the state's opening gesture through behaviour the increment declares (a keyboard
 * activation, a contextmenu event, a toast call) — never through a private prop.
 */
export interface RosterCase {
  id: string;
  covers: readonly string[];
  element: (b: Barrels) => React.ReactElement;
  open?: (b: Barrels, user: KeyboardUser) => Promise<void>;
  /** The contract testid the opening gesture must bring into the document, where it has one. */
  openedTestId?: string;
  /** Text the opened state must show, for a state whose contract gives it no id (the toast). */
  openedText?: string;
}

/** Tab from the document body until `predicate` holds, then stop — Q-11's "begin on the keyboard". */
export async function tabUntil(
  user: KeyboardUser,
  predicate: (active: Element) => boolean,
  what: string,
  limit = 200,
): Promise<HTMLElement> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  for (let step = 0; step < limit; step += 1) {
    await user.tab();
    const now = document.activeElement;
    if (now instanceof HTMLElement && now !== document.body && predicate(now)) return now;
  }
  return expect.fail(
    `Tab travel never reached ${what} — R-UI-012: every interactive element is keyboard reachable`,
  );
}

/** Tab to an element and activate it with Enter — the only sanctioned open gesture (Q-11). */
export async function keyboardActivate(user: KeyboardUser, target: Element, what: string): Promise<void> {
  await tabUntil(user, (active) => active === target, what);
  await user.keyboard("{Enter}");
}

const FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]";

/**
 * The element that READS as `text` — the deepest match (so an ancestor whose only content is the
 * trigger, the render container included, never wins), preferring a focusable one.
 */
const byText = (root: ParentNode, text: string): Element => {
  const matches = [...root.querySelectorAll("*")].filter((node) => node.textContent?.trim() === text);
  const deepest = matches.filter((node) => !matches.some((other) => other !== node && node.contains(other)));
  const hit = deepest.find((node) => node.matches(FOCUSABLE)) ?? deepest[0];
  expect(hit, `no element in the rendered tree reads \`${text}\``).toBeTruthy();
  return hit as Element;
};

/** The trigger a roster case opens from, found by its Decision §4 copy. */
export const triggerByCopy = (text: string): Element => byText(document.body, text);

export const ROSTER: readonly RosterCase[] = [
  {
    id: "dialog",
    covers: ["Dialog", "DialogTrigger", "DialogContent", "DialogTitle", "DialogClose"],
    element: (b) =>
      ov(
        b,
        "Dialog",
        {},
        ov(b, "DialogTrigger", {}, COPY.dialogTrigger),
        ov(
          b,
          "DialogContent",
          {},
          ov(b, "DialogTitle", {}, COPY.dialogTitle),
          React.createElement("p", null, COPY.dialogBody),
          ov(b, "DialogClose", { "aria-label": COPY.dialogClose }),
        ),
      ),
    open: async (_b, user) => {
      await keyboardActivate(user, triggerByCopy(COPY.dialogTrigger), "the Dialog trigger");
    },
    openedTestId: TESTIDS.dialogContent,
  },
  {
    id: "sheet",
    covers: ["Sheet", "SheetTrigger", "SheetContent"],
    element: (b) =>
      ov(
        b,
        "Sheet",
        {},
        ov(b, "SheetTrigger", {}, COPY.sheetTrigger),
        ov(
          b,
          "SheetContent",
          { "aria-label": COPY.sheetLabel },
          React.createElement("h2", null, COPY.sheetHeading),
          React.createElement("p", null, COPY.sheetBody),
        ),
      ),
    open: async (_b, user) => {
      await keyboardActivate(user, triggerByCopy(COPY.sheetTrigger), "the Sheet trigger");
    },
    openedTestId: TESTIDS.sheetContent,
  },
  {
    id: "popover",
    covers: ["Popover", "PopoverTrigger", "PopoverContent"],
    element: (b) =>
      ov(
        b,
        "Popover",
        {},
        ov(b, "PopoverTrigger", {}, COPY.popoverTrigger),
        ov(b, "PopoverContent", {}, COPY.popoverBody),
      ),
    open: async (_b, user) => {
      await keyboardActivate(user, triggerByCopy(COPY.popoverTrigger), "the Popover trigger");
    },
    openedTestId: TESTIDS.popoverContent,
  },
  {
    id: "dropdown-menu",
    covers: ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem"],
    element: (b) =>
      ov(
        b,
        "DropdownMenu",
        {},
        ov(b, "DropdownMenuTrigger", {}, COPY.dropdownTrigger),
        ov(
          b,
          "DropdownMenuContent",
          {},
          ...COPY.dropdownItems.map((label) => ov(b, "DropdownMenuItem", { key: label }, label)),
        ),
      ),
    open: async (_b, user) => {
      await keyboardActivate(user, triggerByCopy(COPY.dropdownTrigger), "the DropdownMenu trigger");
    },
    openedTestId: TESTIDS.dropdownContent,
  },
  {
    id: "context-menu",
    covers: ["ContextMenu", "ContextMenuTrigger", "ContextMenuContent", "ContextMenuItem"],
    element: (b) =>
      ov(
        b,
        "ContextMenu",
        {},
        ov(b, "ContextMenuTrigger", {}, COPY.contextTrigger),
        ov(
          b,
          "ContextMenuContent",
          {},
          ...COPY.contextItems.map((label) => ov(b, "ContextMenuItem", { key: label }, label)),
        ),
      ),
    open: async () => {
      await openContextMenu(triggerByCopy(COPY.contextTrigger));
    },
    openedTestId: TESTIDS.contextmenuContent,
  },
  {
    id: "toast",
    covers: ["Toaster", "toast"],
    element: (b) => ov(b, "Toaster", {}),
    open: async (b) => {
      await raiseToast(b, COPY.toastTitle);
    },
    openedText: COPY.toastTitle,
  },
  {
    id: "tabs",
    covers: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"],
    element: (b) =>
      dt(
        b,
        "Tabs",
        { defaultValue: tabValue(0) },
        dt(
          b,
          "TabsList",
          {},
          ...COPY.tabs.map((label, i) => dt(b, "TabsTrigger", { key: label, value: tabValue(i) }, label)),
        ),
        ...COPY.tabPanels.map((body, i) =>
          dt(b, "TabsContent", { key: tabValue(i), value: tabValue(i) }, body),
        ),
      ),
  },
  {
    id: "tree",
    covers: ["Tree"],
    element: (b) =>
      dt(b, "Tree", {
        items: TREE_ITEMS,
        defaultExpandedIds: TREE_DEFAULT_EXPANDED,
      }),
  },
  {
    id: "scrollarea",
    covers: ["ScrollArea"],
    element: (b) =>
      dt(
        b,
        "ScrollArea",
        {},
        ...scrollLines().map((line) => React.createElement("p", { key: line }, line)),
      ),
  },
  {
    id: "resizable",
    covers: ["ResizablePanelGroup", "ResizablePanel", "ResizableHandle"],
    element: (b) =>
      dt(
        b,
        "ResizablePanelGroup",
        { direction: "horizontal" },
        dt(b, "ResizablePanel", { id: RESIZABLE_PANELS[0].id, order: 1, defaultSize: RESIZABLE_PANELS[0].size }, RESIZABLE_PANELS[0].label),
        dt(b, "ResizableHandle", { "aria-label": COPY.resizableHandleLabel }),
        dt(b, "ResizablePanel", { id: RESIZABLE_PANELS[1].id, order: 2, defaultSize: RESIZABLE_PANELS[1].size }, RESIZABLE_PANELS[1].label),
      ),
  },
  {
    id: "datatable",
    covers: ["DataTable"],
    element: (b) =>
      dt(b, "DataTable", {
        columns: tableColumns(),
        data: TABLE_ROWS,
        getRowId,
      }),
  },
];

/** Tab values are derived from the Decision's tab copy, so a renamed tab renames its value once. */
export function tabValue(index: number): string {
  return (COPY.tabs[index] ?? `tab-${index}`).toLowerCase();
}

/** The contextmenu gesture Radix's ContextMenu listens for (AC-3, Decision §2). */
export async function openContextMenu(trigger: Element): Promise<void> {
  const { fireEvent, act } = await import("@testing-library/react");
  await act(async () => {
    fireEvent.contextMenu(trigger, { button: 2, clientX: 8, clientY: 8 });
  });
}

/** Raise a toast through the barrel's own re-export, inside `act` (AC-8, Decision §2). */
export async function raiseToast(b: Barrels, message: string, options?: unknown): Promise<void> {
  const { act } = await import("@testing-library/react");
  const fn = toastFn(b);
  await act(async () => {
    fn(message, options);
    await Promise.resolve();
  });
}

/* ------------------------------------------------------------------ lazy dependencies */

interface UserEventSetup {
  setup(options?: Record<string, unknown>): KeyboardUser;
}

/** `@testing-library/user-event` — Q-11's keyboard gestures; a declared dependency of this increment. */
export async function keyboardUser(criterion: string): Promise<KeyboardUser> {
  const specifier = "@testing-library/user-event";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — ${criterion} (${String(cause)})`);
  });
  const bag = mod as { default?: UserEventSetup } & Partial<UserEventSetup>;
  const setup = bag.default?.setup ?? bag.setup;
  expect(typeof setup, `${specifier} exposes no setup()`).toBe("function");
  const owner = bag.default ?? bag;
  return (setup as UserEventSetup["setup"]).call(owner, {});
}

export interface AxeViolation {
  id: string;
  impact?: string | null;
  help?: string;
  nodes?: { html?: string }[];
}

interface AxeLike {
  run(context: unknown, options?: Record<string, unknown>): Promise<{ violations: AxeViolation[] }>;
}

/** `axe-core` — Q-11's zero serious/critical; a declared dependency of this increment. */
export async function axeRunner(criterion: string): Promise<AxeLike> {
  const specifier = "axe-core";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — ${criterion} (${String(cause)})`);
  });
  const bag = mod as { default?: AxeLike } & Partial<AxeLike>;
  const axe = typeof bag.run === "function" ? (bag as AxeLike) : bag.default;
  expect(typeof axe?.run, `${specifier} exposes no run()`).toBe("function");
  return axe as AxeLike;
}

/**
 * Q-11: zero serious/critical on the given subtree. The gate is the clause's own two impacts —
 * widening it to any-impact would be widening the law, narrowing it would be hiding a defect.
 */
export async function seriousOrCritical(root: Element, criterion: string): Promise<AxeViolation[]> {
  const axe = await axeRunner(criterion);
  const results = await axe.run(root, { resultTypes: ["violations"] });
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

export function describeViolations(violations: AxeViolation[]): string {
  return violations.map((v) => `${v.impact ?? "?"}: ${v.id} — ${v.help ?? ""} ${v.nodes?.[0]?.html ?? ""}`).join("\n");
}

/* ------------------------------------------------------------------ DOM observation */

/** The accessible name of an overlay content, by the two routes Decision §1 sanctions. */
export function accessibleName(element: Element): string {
  const label = element.getAttribute("aria-label")?.trim();
  if (label) return label;
  const ids = element.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
  return ids
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
    .join(" ")
    .trim();
}

export const byTestId = (root: ParentNode, id: string): Element | null =>
  root.querySelector(`[data-testid="${id}"]`);

export function requireTestId(root: ParentNode, id: string, what: string): HTMLElement {
  const node = byTestId(root, id);
  expect(node, `no [data-testid="${id}"] in the document — ${what}`).toBeTruthy();
  return node as HTMLElement;
}

export const allTestId = (root: ParentNode, id: string): HTMLElement[] =>
  [...root.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];

export const textOf = (node: Element | null | undefined): string => node?.textContent?.trim() ?? "";

/* ------------------------------------------------------------------ source & CSS reading */

export function readRepoFile(relative: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** Every file under a repo-relative directory, repo-relative, or [] when the directory is absent. */
export function filesUnder(relativeDir: string): string[] {
  const abs = join(REPO_ROOT, relativeDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true, encoding: "utf8" })
    .map((name) => `${relativeDir}/${String(name).split("\\").join("/")}`)
    .filter((rel) => statSync(join(REPO_ROOT, rel)).isFile());
}

/** This increment's two slices, asserting each exists: a scan over an absent directory must fail. */
export function requireSliceFiles(): string[] {
  const files = [...filesUnder(OVERLAY_DIR), ...filesUnder(DATA_DIR)];
  expect(filesUnder(OVERLAY_DIR), `${OVERLAY_DIR} is missing from the checkout`).not.toEqual([]);
  expect(filesUnder(DATA_DIR), `${DATA_DIR} is missing from the checkout`).not.toEqual([]);
  return files;
}

export const sliceStylesheets = (): string[] => requireSliceFiles().filter((f) => f.endsWith(".css"));
