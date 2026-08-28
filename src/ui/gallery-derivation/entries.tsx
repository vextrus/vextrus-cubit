/**
 * The catalogue: one entry per component a barrel publishes, each holding the named states that
 * component can be mounted in, with the sample data its owning Design Decision fixed (R-UI-011).
 *
 * The gallery is evidence, never a second implementation (B-17): nothing here restyles a primitive,
 * re-draws one, or reaches past a barrel's index. Every string a person reads is either the sample
 * copy its owning Decision authored or one of the two chrome strings in `chrome.ts` (Decision I-17).
 *
 * A family part — `DialogClose`, `TabsList`, `ResizableHandle` — cannot mount alone, so its entry
 * renders the family's canonical composition under the single state name `composed` (Decision
 * I-16). Overlays render closed, their triggers reachable, because a page of open modals hides
 * every other entry from assistive technology (Decision I-15).
 */
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { RefusalEntry, RefusalSeverity, RefusalSurface } from "../../core/errors";
import { RefusalState } from "../patterns/refusal-state";
import {
  Badge,
  BasisChip,
  Button,
  Chip,
  CoverageChip,
  Input,
  Kbd,
  Skeleton,
  Textarea,
  Tooltip,
  UnitBadge,
} from "../primitives/core";
import {
  DataTable,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tree,
} from "../primitives/data";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Toaster,
  toast,
} from "../primitives/overlay";
import type { GalleryEntries, GalleryState } from "./types";

/* ------------------------------------------------------------------ sample copy (Decision I-17) */

/** The seven bases, in the order `BasisChip`'s own Decision lists them. */
const BASES = ["MEASURED", "TRANSCRIBED", "DERIVED", "IMPORTED", "ENTERED", "INTERPRETED", "DEFAULTED"] as const;

/** The copy each sample shows, verbatim from the Decision that authored it. */
const copy = {
  button: {
    primary: "Save changes",
    secondary: "Cancel",
    ghost: "Duplicate",
    danger: "Delete line",
    act: "Issue certificate",
  },
  input: { label: "Project name", placeholder: "e.g. Riverside Tower", value: "Riverside Tower" },
  textarea: { label: "Notes", placeholder: "Anything the estimator should know" },
  badge: "Draft",
  chip: "Layer S-COL",
  unit: "SQM",
  key: "K",
  tooltip: { content: "Snap to grid — S", trigger: "Snap" },
  dialog: { trigger: "Rename project", title: "Rename project", body: "The new name appears on every export and drawing sheet.", close: "Close" },
  sheet: { trigger: "Line details", label: "Line details", heading: "Line 4 — Footing F-8", body: "Basis and quantity for the selected register line." },
  popover: { trigger: "Column options", content: "Sort, filter and pin from the column header." },
  dropdown: { trigger: "Row actions", duplicate: "Duplicate line", copyQty: "Copy quantity", remove: "Delete line" },
  contextMenu: { surface: "Right-click for drawing actions", open: "Open in viewer", rename: "Rename", remove: "Remove from project" },
  toast: { title: "Quantity updated", description: "Line 4 — 7.25 CUM saved to the register.", trigger: "Save quantity" },
  tabs: {
    overview: "Overview",
    quantities: "Quantities",
    history: "History",
    overviewPanel: "Everything the project knows about this sheet.",
    quantitiesPanel: "Quantities grouped by element class.",
    historyPanel: "Every change, newest first.",
  },
  resizable: { list: "Sheet list", viewer: "Viewer", handle: "Resize panels" },
  refusal: {
    infoMessage: "This list is empty because no drawing has been uploaded yet.",
    infoRemedy: "Upload a drawing to begin.",
    errorEvidence: { href: "/settings/documents", label: "Open document settings" },
    warningEvidence: { href: "/design", label: "Try again" },
    infoEvidence: { href: "/", label: "Open the project" },
  },
} as const;

/** A `ScrollArea` line, as the data Decision spells it: "Sheet 1 of 40" … "Sheet 40 of 40". */
const SCROLL_LINES = 40;
const scrollLine = (line: number): string => `Sheet ${line} of ${SCROLL_LINES}`;

/* ------------------------------------------------------------------ core samples */

/** Nothing happens: the interactive Chip states demonstrate chrome, not a consumer's behaviour. */
const noop = (): void => {};

const buttonStates: readonly GalleryState[] = [
  { name: "primary", render: () => <Button variant="primary">{copy.button.primary}</Button> },
  { name: "secondary", render: () => <Button variant="secondary">{copy.button.secondary}</Button> },
  { name: "ghost", render: () => <Button variant="ghost">{copy.button.ghost}</Button> },
  { name: "danger", render: () => <Button variant="danger">{copy.button.danger}</Button> },
  { name: "act", render: () => <Button variant="act">{copy.button.act}</Button> },
  { name: "loading", render: () => <Button variant="primary" loading>{copy.button.primary}</Button> },
  { name: "disabled", render: () => <Button variant="secondary" disabled>{copy.button.secondary}</Button> },
];

const inputStates: readonly GalleryState[] = [
  { name: "rest", render: () => <Input aria-label={copy.input.label} placeholder={copy.input.placeholder} /> },
  { name: "invalid", render: () => <Input aria-label={copy.input.label} placeholder={copy.input.placeholder} aria-invalid /> },
  { name: "disabled", render: () => <Input aria-label={copy.input.label} placeholder={copy.input.placeholder} disabled /> },
];

const textareaStates: readonly GalleryState[] = [
  { name: "rest", render: () => <Textarea aria-label={copy.textarea.label} placeholder={copy.textarea.placeholder} /> },
  { name: "invalid", render: () => <Textarea aria-label={copy.textarea.label} placeholder={copy.textarea.placeholder} aria-invalid /> },
  { name: "disabled", render: () => <Textarea aria-label={copy.textarea.label} placeholder={copy.textarea.placeholder} disabled /> },
];

const chipStates: readonly GalleryState[] = [
  { name: "rest", render: () => <Chip onClick={noop}>{copy.chip}</Chip> },
  { name: "selected", render: () => <Chip onClick={noop} selected>{copy.chip}</Chip> },
  { name: "static", render: () => <Chip>{copy.chip}</Chip> },
];

const basisStates: readonly GalleryState[] = BASES.map((basis) => ({
  name: basis.toLowerCase(),
  render: () => <BasisChip basis={basis} />,
}));

const coverageStates: readonly GalleryState[] = [
  { name: "low", render: () => <CoverageChip value={0.32} /> },
  { name: "mid", render: () => <CoverageChip value={0.82} /> },
  { name: "full", render: () => <CoverageChip value={1} /> },
];

/* ------------------------------------------------------------------ overlay compositions */

/** One state list holding a single `composed` cell of a family's canonical sample (Decision I-16). */
const composed = (render: () => ReactNode): readonly GalleryState[] => [{ name: "composed", render }];

/** …and the same composition under the family root's own name: closed, its trigger reachable. */
const closed = (render: () => ReactNode): readonly GalleryState[] => [{ name: "closed", render }];

const dialogSample = (): ReactNode => (
  <Dialog>
    <DialogTrigger>{copy.dialog.trigger}</DialogTrigger>
    <DialogContent>
      <DialogTitle>{copy.dialog.title}</DialogTitle>
      <p>{copy.dialog.body}</p>
      <Input aria-label={copy.input.label} defaultValue={copy.input.value} />
      <DialogClose aria-label={copy.dialog.close} />
    </DialogContent>
  </Dialog>
);

const sheetSample = (): ReactNode => (
  <Sheet>
    <SheetTrigger>{copy.sheet.trigger}</SheetTrigger>
    <SheetContent side="right" aria-label={copy.sheet.label}>
      <h4>{copy.sheet.heading}</h4>
      <p>{copy.sheet.body}</p>
    </SheetContent>
  </Sheet>
);

const popoverSample = (): ReactNode => (
  <Popover>
    <PopoverTrigger>{copy.popover.trigger}</PopoverTrigger>
    <PopoverContent>{copy.popover.content}</PopoverContent>
  </Popover>
);

const dropdownSample = (): ReactNode => (
  <DropdownMenu>
    <DropdownMenuTrigger>{copy.dropdown.trigger}</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>{copy.dropdown.duplicate}</DropdownMenuItem>
      <DropdownMenuItem>{copy.dropdown.copyQty}</DropdownMenuItem>
      <DropdownMenuItem variant="danger">{copy.dropdown.remove}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const contextMenuSample = (): ReactNode => (
  <ContextMenu>
    <ContextMenuTrigger>{copy.contextMenu.surface}</ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem>{copy.contextMenu.open}</ContextMenuItem>
      <ContextMenuItem>{copy.contextMenu.rename}</ContextMenuItem>
      <ContextMenuItem variant="danger">{copy.contextMenu.remove}</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);

const toasterSample = (): ReactNode => (
  <>
    <Toaster />
    <Button variant="ghost" onClick={() => toast(copy.toast.title, { description: copy.toast.description })}>
      {copy.toast.trigger}
    </Button>
  </>
);

/* ------------------------------------------------------------------ data compositions */

const tabsSample = (historyDisabled: boolean): ReactNode => (
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">{copy.tabs.overview}</TabsTrigger>
      <TabsTrigger value="quantities">{copy.tabs.quantities}</TabsTrigger>
      <TabsTrigger value="history" disabled={historyDisabled}>
        {copy.tabs.history}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="overview">{copy.tabs.overviewPanel}</TabsContent>
    <TabsContent value="quantities">{copy.tabs.quantitiesPanel}</TabsContent>
    <TabsContent value="history">{copy.tabs.historyPanel}</TabsContent>
  </Tabs>
);

const treeSample = (): ReactNode => (
  <Tree
    items={[
      {
        id: "riverside-tower",
        label: "Riverside Tower",
        children: [
          {
            id: "structural",
            label: "Structural",
            children: [
              { id: "s-101", label: "S-101 — Column layout" },
              { id: "s-102", label: "S-102 — Ground beams" },
            ],
          },
          { id: "architectural", label: "Architectural", children: [{ id: "a-201", label: "A-201 — Level 1 plan" }] },
        ],
      },
    ]}
    defaultExpandedIds={["riverside-tower", "structural"]}
    defaultSelectedId="s-101"
  />
);

const scrollAreaSample = (): ReactNode => (
  <ScrollArea className="cx-gallery-scroll">
    {Array.from({ length: SCROLL_LINES }, (_unused, index) => (
      <p key={scrollLine(index + 1)}>{scrollLine(index + 1)}</p>
    ))}
  </ScrollArea>
);

const resizableSample = (): ReactNode => (
  <ResizablePanelGroup direction="horizontal" className="cx-gallery-resizable">
    <ResizablePanel defaultSize={30}>{copy.resizable.list}</ResizablePanel>
    <ResizableHandle aria-label={copy.resizable.handle} />
    <ResizablePanel defaultSize={70}>{copy.resizable.viewer}</ResizablePanel>
  </ResizablePanelGroup>
);

/* ------------------------------------------------------------------ the table's sample register */

/** One register line, as the data Decision's §4 sample spells it. */
interface SampleRow {
  id: string;
  item: string;
  element: string;
  qty: string;
  unit: string;
  basis: string;
}

const TABLE_COLUMNS = [
  { id: "item", accessorKey: "item", header: "Item", meta: { filterable: true } },
  { id: "element", accessorKey: "element", header: "Element" },
  { id: "qty", accessorKey: "qty", header: "Qty", enableSorting: true, meta: { align: "right", editable: true } },
  { id: "unit", accessorKey: "unit", header: "Unit" },
  { id: "basis", accessorKey: "basis", header: "Basis" },
] as ColumnDef<SampleRow, unknown>[];

const TABLE_ROWS: readonly SampleRow[] = [
  { id: "line-1", item: "Line 1", element: "Column C-12", qty: "4.80", unit: "CUM", basis: "MEASURED" },
  { id: "line-2", item: "Line 2", element: "Beam GB-3", qty: "12.60", unit: "CUM", basis: "DERIVED" },
  { id: "line-3", item: "Line 3", element: "Slab S-2", qty: "96.00", unit: "SQM", basis: "TRANSCRIBED" },
  { id: "line-4", item: "Line 4", element: "Footing F-8", qty: "7.25", unit: "CUM", basis: "INTERPRETED" },
  { id: "line-5", item: "Line 5", element: "Column C-4", qty: "3.10", unit: "CUM", basis: "ENTERED" },
];

/** The generated set the virtualisation state shows: 1000 lines, cycling elements and bases. */
const VIRTUALISED_ROWS = 1000;
const ELEMENTS = ["Column", "Beam", "Slab", "Footing"] as const;
const generatedRows = (): SampleRow[] =>
  Array.from({ length: VIRTUALISED_ROWS }, (_unused, index) => {
    const line = index + 1;
    return {
      id: `line-${line}`,
      item: `Line ${line}`,
      element: ELEMENTS[index % ELEMENTS.length] ?? "",
      qty: `${line}.00`,
      unit: "CUM",
      basis: BASES[index % BASES.length] ?? "",
    };
  });

const rowId = (row: SampleRow): string => row.id;

const tableStates: readonly GalleryState[] = [
  { name: "comfortable", render: () => <DataTable columns={TABLE_COLUMNS} data={[...TABLE_ROWS]} getRowId={rowId} density="comfortable" /> },
  { name: "compact", render: () => <DataTable columns={TABLE_COLUMNS} data={[...TABLE_ROWS]} getRowId={rowId} density="compact" /> },
  {
    name: "pinned",
    render: () => <DataTable columns={TABLE_COLUMNS} data={[...TABLE_ROWS]} getRowId={rowId} columnPinning={{ left: ["item"] }} />,
  },
  {
    name: "virtualised",
    render: () => <DataTable columns={TABLE_COLUMNS} data={generatedRows()} getRowId={rowId} className="cx-gallery-table" />,
  },
];

/* ------------------------------------------------------------------ the refusal sample matrix */

/**
 * A sample refusal, authored as data (Decision I-18): the ui layer holds no value import of core,
 * so `RefusalEntry` arrives as a type and the entry itself is written here. Where a severity has a
 * registered code the sample reuses that code and its copy verbatim; the registry holds no info
 * code yet, so the info sample carries a gallery code — machine-readable only, never read by a
 * person.
 */
const sampleRefusal = (severity: RefusalSeverity, surface: RefusalSurface): RefusalEntry => {
  if (severity === "error") {
    return {
      code: "PRECISION_NOT_APPLIED",
      message: "The value is not at the exact precision this document requires.",
      remedy: "Enter the value at the stated precision — nothing is rounded or padded on your behalf.",
      severity,
      surface,
    };
  }
  if (severity === "warning") {
    return {
      code: "RATE_LIMITED",
      message: "Too many attempts in a short time, so this one was not tried.",
      remedy: "Wait a minute, then try again.",
      severity,
      surface,
    };
  }
  return {
    code: "GALLERY_SAMPLE_INFO" as RefusalEntry["code"],
    message: copy.refusal.infoMessage,
    remedy: copy.refusal.infoRemedy,
    severity,
    surface,
  };
};

const REFUSAL_EVIDENCE = {
  error: copy.refusal.errorEvidence,
  warning: copy.refusal.warningEvidence,
  info: copy.refusal.infoEvidence,
} as const;

const REFUSAL_SEVERITIES: readonly RefusalSeverity[] = ["error", "warning", "info"];
const REFUSAL_SURFACES: readonly RefusalSurface[] = ["inline", "dialog", "banner"];

const refusalStates: readonly GalleryState[] = REFUSAL_SEVERITIES.flatMap((severity) =>
  REFUSAL_SURFACES.map((surface) => ({
    name: `${severity}-${surface}`,
    render: () => <RefusalState refusal={sampleRefusal(severity, surface)} evidence={REFUSAL_EVIDENCE[severity]} />,
  })),
);

/* ------------------------------------------------------------------ the catalogue */

/**
 * One entry per component the barrels publish. The keys are asserted against the derivation's own
 * product surface — `missingEntries()` must be empty — so an export added later fails a test
 * computed from the tree rather than sliding past a list nobody read (B-19).
 */
export const galleryEntries: GalleryEntries = {
  "patterns/refusal-state/RefusalState": { states: refusalStates },

  "primitives/core/Badge": { states: [{ name: "rest", render: () => <Badge>{copy.badge}</Badge> }] },
  "primitives/core/BasisChip": { states: basisStates },
  "primitives/core/Button": { states: buttonStates },
  "primitives/core/Chip": { states: chipStates },
  "primitives/core/CoverageChip": { states: coverageStates },
  "primitives/core/Input": { states: inputStates },
  "primitives/core/Kbd": { states: [{ name: "rest", render: () => <Kbd>{copy.key}</Kbd> }] },
  "primitives/core/Skeleton": { states: [{ name: "rest", render: () => <Skeleton className="cx-gallery-bone" /> }] },
  "primitives/core/Textarea": { states: textareaStates },
  "primitives/core/Tooltip": {
    states: [
      {
        name: "rest",
        render: () => (
          <Tooltip content={copy.tooltip.content}>
            <Button variant="ghost">{copy.tooltip.trigger}</Button>
          </Tooltip>
        ),
      },
    ],
  },
  "primitives/core/UnitBadge": { states: [{ name: "rest", render: () => <UnitBadge unit={copy.unit} /> }] },

  "primitives/data/DataTable": { states: tableStates },
  "primitives/data/ResizableHandle": { states: composed(resizableSample) },
  "primitives/data/ResizablePanel": { states: composed(resizableSample) },
  "primitives/data/ResizablePanelGroup": { states: [{ name: "rest", render: resizableSample }] },
  "primitives/data/ScrollArea": { states: [{ name: "rest", render: scrollAreaSample }] },
  "primitives/data/Tabs": {
    states: [
      { name: "rest", render: () => tabsSample(false) },
      { name: "disabled", render: () => tabsSample(true) },
    ],
  },
  "primitives/data/TabsContent": { states: composed(() => tabsSample(false)) },
  "primitives/data/TabsList": { states: composed(() => tabsSample(false)) },
  "primitives/data/TabsTrigger": { states: composed(() => tabsSample(false)) },
  "primitives/data/Tree": { states: [{ name: "rest", render: treeSample }] },

  "primitives/overlay/ContextMenu": { states: closed(contextMenuSample) },
  "primitives/overlay/ContextMenuContent": { states: composed(contextMenuSample) },
  "primitives/overlay/ContextMenuItem": { states: composed(contextMenuSample) },
  "primitives/overlay/ContextMenuTrigger": { states: composed(contextMenuSample) },
  "primitives/overlay/Dialog": { states: closed(dialogSample) },
  "primitives/overlay/DialogClose": { states: composed(dialogSample) },
  "primitives/overlay/DialogContent": { states: composed(dialogSample) },
  "primitives/overlay/DialogTitle": { states: composed(dialogSample) },
  "primitives/overlay/DialogTrigger": { states: composed(dialogSample) },
  "primitives/overlay/DropdownMenu": { states: closed(dropdownSample) },
  "primitives/overlay/DropdownMenuContent": { states: composed(dropdownSample) },
  "primitives/overlay/DropdownMenuItem": { states: composed(dropdownSample) },
  "primitives/overlay/DropdownMenuTrigger": { states: composed(dropdownSample) },
  "primitives/overlay/Popover": { states: closed(popoverSample) },
  "primitives/overlay/PopoverContent": { states: composed(popoverSample) },
  "primitives/overlay/PopoverTrigger": { states: composed(popoverSample) },
  "primitives/overlay/Sheet": { states: closed(sheetSample) },
  "primitives/overlay/SheetContent": { states: composed(sheetSample) },
  "primitives/overlay/SheetTrigger": { states: composed(sheetSample) },
  "primitives/overlay/Toaster": { states: [{ name: "ready", render: toasterSample }] },
};
