"use client";
// S-Takeoff's register workspace — THE GRID WORKSPACE TEMPLATE (Design Direction 00 §3.2; the
// template S-BOQ, S-BBS, S-Levels and S-Schedules are cut from). Grid first: above the lines table
// stand exactly two rows — the lane's 40 px tabs row, whose right half this screen mounts into
// (`chrome.TabsAside`), and one 36 px bar of filter chips. Everything that is not the grid is either
// a chip in that bar, a column of the index rail beside it, the shell's ONE inspector slot
// (`chrome.InspectorMount`), or a strip that exists only while a job runs (R-UI-080).
//
// I-170: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17 bars a screen from
// re-implementing a shipped primitive, so the workspace is handed its renderers — and, since
// v22, the two MOUNTS as well: a hook is the app layer's to call, and the app layer is the one file
// that may reach both trees. What the route binds and what the acceptance mounts are the same shipped
// components.
//
// Every act here is a door and nothing more: the screen previews at the door, renders a rejection
// through the one RefusalState, and opens the one ConsequenceDialog only over a Consequence that was
// answered. Nothing on this screen commits anything itself (L-ACT-02, I-175).
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode, type Ref } from "react";
import type { Consequence, CorroborateInput, InsertLevelInput, LevelStackGroupKey, RepudiateInput } from "@/core/acts";
import type { RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatDate, formatMoney, formatUserFigure, dhakaDateParts } from "@/core/format";
import type { JobKind } from "@/core/jobs/kinds";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import { parseSourceKey } from "@/core/sources";
import { LINE_PARAM, originAddress, traceAddress } from "@/modules/takeoff/trace/address";
import { basisOf } from "./basis";
import { REGISTER_COPY, fillCopy } from "./copy";
import { originRowIndexOf } from "./origin";
import type { RegisterView, ViewAttribute, ViewLine, ViewObject, ViewReading } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** One node of the tree, as the shipped Tree takes one. */
type TreeNode = { id: string; label: string; children?: TreeNode[] };

/** One cell of the lines table, as the shipped DataTable hands one its row. */
type LineCell = { readonly row: { readonly original: ViewLine } };

/**
 * One column of the lines table, as the shipped DataTable takes one.
 *
 * A column of one scalar carries the value it sorts on and takes the primitive's own sort control
 * (R-UI-010's `sort`): that control is also the only keyboard way into a virtualised scroll box of
 * 50 000 rows, and a scrollable region with no keyboard access is an axe-serious failure of R-UI-012.
 * A column whose cell composes several facts — the variable bindings, the basis pair, the calibration
 * keys — carries no single value to order by and stays unsorted.
 */
type LineColumn = {
  id: string;
  header: string;
  accessorFn?: (line: ViewLine) => string;
  enableSorting?: boolean;
  /** The width the column is READ at (§5 rule 3's sane defaults), never the primitive's 150. */
  size?: number;
  cell: (context: LineCell) => ReactNode;
  meta?: { align?: "right" };
};

/** One group header of the lines table — `▾ GF · column (4)` (§5 rule 4). */
type GroupKey = { readonly key: string; readonly label: string };

/** One subtotal a group or the footer states: a figure already written, and the unit it is in. */
type Subtotal = { readonly value: string; readonly unit: string };

/** One step of the shipped JobTimeline, already resolved (the pattern formats nothing). */
type TimelineStep = {
  readonly id: string;
  readonly jobId: string | null;
  readonly kind: JobKind;
  readonly status: "queued" | "running" | "succeeded" | "failed" | "refused";
  readonly timing: string | null;
  readonly refusal: RefusalEntry | null;
  readonly faultId: string | null;
  readonly evidence: { href: string; label: string };
};

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * The shipped renderers the app layer injects (I-170). Each is declared by exactly the props this
 * screen hands it, so the shipped component itself is assignable and no adapter stands between what
 * a reader sees and what a test mounts.
 */
/**
 * THE FOUR IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01).
 *
 * `src/ui/testids.ts` is the one declaration of every test id, and ARCH-01 bars a module from
 * importing `src/ui` — so these arrive as chrome, exactly as `BasisChip` and `DataTable` do. The
 * caller reads the registry key; the module publishes what it is handed. Every string is
 * byte-identical to the id that was already in the DOM.
 */
export interface RegisterTestIds {
  readonly inspector: string;
  readonly objectKey: string;
  readonly sourceKey: string;
  readonly technical: string;
}

export interface RegisterChrome {
  /** The ids the screen publishes that ARCH-01 forbids it to look up (AM-09 §1). */
  readonly testIds: RegisterTestIds;
  readonly Tree: ComponentType<{
    items: TreeNode[];
    onSelect?: (id: string) => void;
    defaultExpandedIds?: string[];
    defaultSelectedId?: string;
    "aria-label"?: string;
  }>;
  readonly DataTable: ComponentType<{
    /** The identity the reader's column furniture is remembered under (Direction 00 §5 rule 3). */
    tableId: string;
    columns: LineColumn[];
    data: ViewLine[];
    getRowId: (row: ViewLine, index: number) => string;
    /** §5 rule 3: the key column is frozen. Stated rather than assumed, because it is a law here. */
    freezeKeyColumn?: boolean;
    /** §5 rule 4: the group rows, with a subtotal per unit under each. */
    group?: {
      of: (row: ViewLine) => GroupKey | null;
      valueOf?: (row: ViewLine) => string | null;
      unitOf?: (row: ViewLine) => string;
    };
    /** §5 rule 1: the sticky footer, by column id. Absent totals, there is no footer at all. */
    totals?: Readonly<Record<string, ReactNode>>;
    /** §5 rule 10: the selection rises to the shell's inspector; the table owns no inspector. */
    onRowSelect?: (rowIds: readonly string[]) => void;
    /** What each row publishes of its own — the line it stands for, and whether it is the selected one. */
    rowDataOf?: (row: ViewLine, rowId: string) => Readonly<Record<string, string>>;
    "aria-label"?: string;
    /** The row a reader must be able to reach — the table scrolls to it and draws it (I-182). */
    scrollToRowId?: string;
  }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly OfferedGroups: ComponentType<{
    groups: readonly { key: LevelStackGroupKey; label: string; count: string }[];
    onConfirm: (key: LevelStackGroupKey) => void;
  }>;
  readonly ConsequenceDialog: ComponentType<{
    open: boolean;
    actType: string;
    preview: () => Promise<{ consequence: Consequence; consequenceDigest: string }>;
    commit: (carried: { consequenceDigest: string }) => Promise<{ actId: string }>;
    onOpenChange: (open: boolean) => void;
    onCommitted: (committed: { actId: string }) => void;
  }>;
  readonly JobTimeline: ComponentType<{ heading: string; steps: readonly TimelineStep[] }>;
  readonly Skeleton: ComponentType<{ style?: CSSProperties }>;
  readonly BasisChip: ComponentType<{ basis: QuantityBasis }>;
  readonly CoverageChip: ComponentType<{ value: number }>;
  /**
   * The filter control of Design Direction 00 §3.2 — `Label · Value ▾`, one 28 px chip per filter.
   */
  readonly Combobox: ComponentType<{
    options: readonly { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
    variant?: "field" | "chip";
    className?: string;
    "data-testid"?: string;
  }>;
  /**
   * The Trace's own affordance (R-UI-022), shipped by `src/ui/patterns/evidence-link`. Only the props
   * this screen hands it are declared: the address it stands at, the basis it wears, the source chips
   * it reads as, and the row facts it carries out to a test and to a reader.
   */
  readonly EvidenceLink: ComponentType<{
    href: string;
    basis: QuantityBasis;
    label: string;
    "data-line": string;
    "data-origin"?: "true" | "false";
    "aria-current"?: "true";
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    onAuxClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    ref?: Ref<HTMLAnchorElement>;
  }>;
  /** R-UI-082's identifier: short on screen, whole in `data-value`, one press from the clipboard. */
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  /** §6: a model value said in words, with the SCREAMING form kept inside its technical disclosure. */
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  /** §5 rule 5: mono, tabular, right-aligned, lakh/crore — with the unit as a muted badge beside it. */
  readonly QuantityText: ComponentType<{
    value: string;
    unit?: string;
    format?: { figure: (value: string) => string; money: (amount: string) => string; date: (at: Date) => string };
    className?: string;
    "data-testid"?: string;
  }>;
  readonly UnitBadge: ComponentType<{ unit: string }>;
  /** §5 rule 2's hint, and §6's "(i) popover on the section header" — one component, both duties. */
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  readonly EmptyState: ComponentType<{ heading: string; body?: string; children?: ReactNode; className?: string; "data-testid"?: string }>;
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "act";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children?: ReactNode;
    "data-testid"?: string;
  }>;
  readonly Input: ComponentType<{
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    type?: string;
    className?: string;
    placeholder?: string;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "data-testid"?: string;
  }>;
  /** B-07's exact addition, per unit, in its one home: the table's own (`subtotalsByUnit`). */
  readonly subtotalsByUnit: (rows: readonly ViewLine[], valueOf: (row: ViewLine) => string | null, unitOf: (row: ViewLine) => string) => readonly Subtotal[];
  /** `ASSIGN_ROLE` → `Assign role`, in the one home EnumLabel humanises by (B-17). */
  readonly humaniseEnum: (value: string) => string;
  /**
   * THE TWO MOUNTS (Direction §1, §3.1, §3.2). A hook belongs to the layer that may call it: the
   * lane's tabs row and the frame's ONE inspector are both filled through hooks in `src/ui`/`src/app`,
   * and this workspace is a module. Each mount is a component that takes what to show and renders it
   * where the region is — and NOTHING where there is nothing to show, so neither region stands as an
   * empty strip or an empty column (R-UI-080).
   */
  readonly TabsAside: ComponentType<{ children?: ReactNode }>;
  readonly InspectorMount: ComponentType<{ children?: ReactNode }>;
}

/** What a preview answers (L-ACT-02): the typed Consequence, and the digest that binds it. */
export type PreviewAnswer = { consequence: Consequence; consequenceDigest: string };

/** What inc-209's measure door answers — its own answer, carried through unchanged (AC-8). */
export type MeasureAnswer =
  | { requested: true; jobId: string; deduplicated: boolean }
  | { requested: false; refusal: string };

/** The doors this screen presses, and the one lookup a refusal's words are read through (I-170). */
export interface RegisterDoors {
  readonly previewCorroborate: (argument: { input: CorroborateInput }) => Promise<PreviewAnswer>;
  readonly commitCorroborate: (argument: { input: CorroborateInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewRepudiate: (argument: { input: RepudiateInput }) => Promise<PreviewAnswer>;
  readonly commitRepudiate: (argument: { input: RepudiateInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewInsertLevel: (argument: { input: InsertLevelInput }) => Promise<PreviewAnswer>;
  readonly commitInsertLevel: (argument: { input: InsertLevelInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly requestMeasure: (argument: { projectId: string; campaignId: string }) => Promise<MeasureAnswer>;
  readonly refusalOf: (code: string) => RefusalEntry | undefined;
}

export interface RegisterWorkspaceProps {
  readonly view: RegisterView;
  /** Whether the reader holds MEASURE on this project, read server-side (Decision § 2). */
  readonly permitted: boolean;
  readonly offline: boolean;
  readonly chrome: RegisterChrome;
  readonly doors: RegisterDoors;
}

/* --------------------------------------------------------------------------- the addresses */

// The three addresses this screen links. ARCH-01 bars a module from the app layer where a route
// builder lives, so they are spelled here for this screen and nowhere else in it (Decision § 7).
const drawingsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings`;
const setsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;

/** The code the screen's own denial renders, off the registry the caller looks it up in. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The act types the two inspector doors confirm as, and the one the offer does. */
const CORROBORATE = "CORROBORATE" as const;
const REPUDIATE = "REPUDIATE" as const;
const INSERT_LEVEL = "INSERT_LEVEL" as const;

/** The corroboration state of an object a person has judged to be nothing (I-173). */
const REPUDIATED = "REPUDIATED";

/** The basis a figure nobody read carries — the one basis no Trace is offered from (I-181). */
const DEFAULTED: QuantityBasis = "DEFAULTED";

/**
 * One stored basis, chipped where the canon admits it (B-17). A value off the roster renders no chip
 * at all: a label painted for a basis nobody declared would say something the register does not
 * (R-UI-050).
 */
function StoredBasis({ Chip, said }: { readonly Chip: ComponentType<{ basis: QuantityBasis }>; readonly said: string }): ReactNode {
  const basis = basisOf(said);
  return basis === null ? null : <Chip basis={basis} />;
}

/** The job kind a measure run is watched under (SEAM-JOBS' roster). */
const MEASURE_KIND: JobKind = "measure";

/** How a coverage reads as a share of the item priced: only a COMPLETE line carries a quantity. */
const COMPLETE = "COMPLETE";

/** The standing of an attribute whose readings disagree, which renders no value at all (I-174). */
const SUSPENDED = "SUSPENDED";

/**
 * The identity the lines table's column furniture is remembered under — one name, one drawer
 * (`cubit.datatable.v1:takeoff-register-lines`, Design Direction 00 §5 rule 3).
 */
const REGISTER_TABLE_ID = "takeoff-register-lines";

/**
 * SEAM-FORMAT, as the figure primitives take it (Direction §5 rule 5's lakh/crore). `src/ui` may not
 * call the seam and may not carry a second grouping of its own, so the conventions are handed down —
 * from here, because a module MAY read core and this screen already reads `formatUserFigure` for its
 * counts. One home for `1,00,00,000`, read twice by the same screen (B-17, L-FMT-01).
 */
const FIGURES = Object.freeze({
  figure: formatUserFigure,
  money: formatMoney,
  date: (at: Date): string => formatDate(dhakaDateParts(at)),
});

/** The separator §6 writes a composed identifier with: `S-101 · C1 · #…`. */
const CHIP_SEPARATOR = " · ";

/**
 * What every row of the lines table publishes of its own: the line it stands for — which is how a
 * row a POINTER landed on is read back — and, on the one a reader chose, that it is chosen, because
 * the shipped grid paints only the selection IT took (§5 rule 8, and the IOU in §8).
 */
function rowDataOf(line: ViewLine, selectedLineId: string | null): Readonly<Record<string, string>> {
  const published: Record<string, string> = { "data-line": line.lineId };
  if (line.lineId === selectedLineId) published["data-line-selected"] = "true";
  return published;
}

/** A line's bindings as one line of cell text: `name=value unit`, in binding order (I-25). */
function variablesOf(line: ViewLine): string {
  return Object.entries(line.variables)
    .map(([name, binding]) => `${name}=${binding.value} ${binding.unit}`)
    .join(" ");
}

/* ----------------------------------------------------------------------------- the readings */

/**
 * The registered code a rejection carries, however it arrived. `refusalCodeOf` is the marker's one
 * home; a failure carrying none is a fault, and a fault belongs to the error boundary (ARCH-03).
 */
function codeOf(thrown: unknown): string | null {
  const direct = refusalCodeOf(thrown);
  if (direct !== null) return direct;
  const cause = (thrown as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** The tree, nested as the hierarchy is: discipline → level → class → object (R-TO-050). */
function treeOf(objects: readonly ViewObject[], humanise: (value: string) => string): { items: TreeNode[]; expanded: string[] } {
  const items: TreeNode[] = [];
  const expanded: string[] = [];
  const at = (list: TreeNode[], id: string, label: string): TreeNode => {
    const held = list.find((node) => node.id === id);
    if (held !== undefined) return held;
    const made: TreeNode = { id, label, children: [] };
    list.push(made);
    expanded.push(id);
    return made;
  };
  for (const object of objects) {
    // §6: people see labels, never machine identifiers — a discipline is a SCREAMING enum in the
    // store and a word on a screen. The Tree takes a string, so the humanising is the one the
    // EnumLabel does, handed in rather than written again (B-17).
    const discipline = at(items, `d:${object.discipline}`, humanise(object.discipline));
    const level = at(discipline.children as TreeNode[], `d:${object.discipline}|l:${object.level}`, object.level);
    const cls = at(level.children as TreeNode[], `d:${object.discipline}|l:${object.level}|c:${object.class}`, object.class);
    (cls.children as TreeNode[]).push({ id: `o:${object.objectKey}`, label: object.mark });
  }
  return { items, expanded };
}

/** Every distinct value one field of the rows takes, in the order the rows state them. */
function optionsOf<T>(rows: readonly T[], read: (row: T) => string): string[] {
  const held: string[] = [];
  for (const row of rows) {
    const value = read(row);
    if (value !== "" && !held.includes(value)) held.push(value);
  }
  return held;
}

/** The five narrowings, as the reader has them set (I-172). Empty means the all-option. */
type Filters = { class: string; kind: string; level: string; basis: string; coverage: string };

const NO_FILTERS: Filters = { class: "", kind: "", level: "", basis: "", coverage: "" };

/** A line survives every narrowing the reader set — the basis narrowed on is the quantity's. */
function keeps(line: ViewLine, filters: Filters): boolean {
  if (filters.class !== "" && line.class !== filters.class) return false;
  if (filters.kind !== "" && line.kind !== filters.kind) return false;
  if (filters.level !== "" && line.level !== filters.level) return false;
  if (filters.basis !== "" && line.quantityBasis !== filters.basis) return false;
  if (filters.coverage !== "" && line.coverage !== filters.coverage) return false;
  return true;
}

/**
 * Whether a line has somewhere to be traced to (I-181). R-UI-022 offers the Trace to a figure that
 * "came from a drawing", which is the condition and not a formality: a reading that resolved no
 * sheet, and a figure nobody read — a DEFAULTED one — would fly to nothing, so neither is offered a
 * link at all rather than a dead one (evidence-link I-178).
 */
function traceable(line: ViewLine): boolean {
  return line.drawingId !== null && line.layoutName !== null && line.quantityBasis !== DEFAULTED;
}

/** Class and level narrow the tree with the table, so one screen shows one answer (I-172). */
function keepsObject(object: ViewObject, filters: Filters): boolean {
  if (filters.class !== "" && object.class !== filters.class) return false;
  if (filters.level !== "" && object.level !== filters.level) return false;
  return true;
}

/**
 * A cited key as §6 writes one: `S-101 · C1 · #…` — the sheet it stands on, the mark it was read
 * for, and the extractor's handle. The scheme is the grammar's (`parseSourceKey`, L-CAD-02), so a key
 * of that grammar reads as a handle and a key of any other reads whole: a chip that invented a
 * shape for an unparsed key would be a second grammar (B-17, I-26 — nothing is abbreviated away).
 */
function sourceChips(line: ViewLine, mark: string | null): string {
  const parsed = parseSourceKey(line.sourceKey);
  const handle = parsed === null ? line.sourceKey : `#${parsed.slice(parsed.indexOf(":") + 1)}`;
  return [line.layoutName, mark, handle].filter((part): part is string => part !== null && part !== "").join(CHIP_SEPARATOR);
}

/* --------------------------------------------------------------------------- the workspace */

/** What a door answered that the screen shows in place: one registered refusal, or nothing. */
type Answer = { refusal: RefusalEntry; evidence: Evidence } | null;

/** The act a confirmed door opened the one dialog over, with the input it will be committed on. */
type Pending =
  | { readonly actType: typeof CORROBORATE; readonly input: CorroborateInput }
  | { readonly actType: typeof REPUDIATE; readonly input: RepudiateInput }
  | { readonly actType: typeof INSERT_LEVEL; readonly input: InsertLevelInput };

/** A reading being written, before it is previewed at the door (I-175). */
type Draft = { attribute: string; value: string; unit: string; precedence: string };

export function RegisterWorkspace({ view, permitted, offline, chrome, doors }: RegisterWorkspaceProps) {
  const {
    Tree,
    DataTable,
    RefusalState,
    OfferedGroups,
    ConsequenceDialog,
    JobTimeline,
    BasisChip,
    CoverageChip,
    Combobox,
    EvidenceLink,
    IdChip,
    EnumLabel,
    QuantityText,
    UnitBadge,
    Tooltip,
    EmptyState,
    Button,
    Input,
    subtotalsByUnit,
    humaniseEnum,
    TabsAside,
    InspectorMount,
  } = chrome;

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  /** The object a reader chose in the tree, and the line a reader chose in the grid — one at a time. */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [steps, setSteps] = useState<readonly TimelineStep[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** What a door left that no registry entry stands for: held here, raised in render (ARCH-03, B-21). */
  const [fault, setFault] = useState<unknown>(null);

  const evidence = useMemo<Evidence>(
    () => ({ href: drawingsHref(view.tenantId, view.projectId), label: REGISTER_COPY.takeoff_register_evidence }),
    [view.tenantId, view.projectId],
  );
  const deniedEvidence = useMemo<Evidence>(
    () => ({ href: participantsHref(view.tenantId, view.projectId), label: REGISTER_COPY.takeoff_register_evidence }),
    [view.tenantId, view.projectId],
  );

  const objects = useMemo(() => view.objects.filter((object) => keepsObject(object, filters)), [view.objects, filters]);
  /* I-173: a line measured off a struck object stays on record and out of the table, so every count,
     option and row on this screen is taken over what the table may in fact show. */
  const registered = useMemo(() => view.lines.filter((line) => !line.repudiated), [view.lines]);
  const lines = useMemo(() => registered.filter((line) => keeps(line, filters)), [registered, filters]);
  const tree = useMemo(() => treeOf(objects, humaniseEnum), [objects, humaniseEnum]);
  /** The mark an object key stands under, so a cited key can read as `sheet · mark · #handle` (§6). */
  const marks = useMemo(() => new Map(view.objects.map((object) => [object.objectKey, object.mark])), [view.objects]);

  /* ------------------------------------------------- the Trace's origin row (I-180, I-182) */

  /** The row a Trace was followed from, as this screen's own address carries it (`?line=`). */
  const [originLine, setOriginLine] = useState<string | null>(null);
  /** The anchor that row's cell renders, so the reticle can be put back where the reader left it. */
  const originRef = useRef<HTMLAnchorElement | null>(null);
  /** The address already restored from — the reticle is taken at most once per address (I-182). */
  const restoredRef = useRef<string | null>(null);

  // The address is the state, and it is read in the browser: a server render knows no `?line=`, and
  // reading it in an effect is what keeps the first paint the same on both sides (I-182).
  useEffect(() => {
    setOriginLine(new URLSearchParams(window.location.search).get(LINE_PARAM));
  }, []);

  /**
   * The reticle, taken as the origin's own anchor mounts — whether that is on this paint or on the
   * one after the table scrolled the named row into view. A row the table does not show never mounts
   * one, so nothing is focused and nothing is said (I-182).
   */
  const holdOrigin = (node: HTMLAnchorElement | null): void => {
    const leaving = originRef.current;
    originRef.current = node;
    if (node === null) {
      // The anchor is going away — the table re-paints its rows as it scrolls the named one into
      // view, so the element the reticle was put on is not the element the row ends up with. A
      // reticle that stood on the row it left behind must travel WITH the row: the restoration is
      // owed again, or the reader is standing on the document body answering no key (I-182).
      if (leaving !== null && leaving.ownerDocument.activeElement === leaving) restoredRef.current = null;
      return;
    }
    if (originLine === null || restoredRef.current === originLine) return;
    restoredRef.current = originLine;
    node.focus();
    // `focus()` on an element the browser will not take (still being laid out under the viewport it
    // is scrolling to) is refused silently. Nothing is claimed that did not happen: the address is
    // still owed its reticle, and the next paint of this row takes it.
    if (node.ownerDocument.activeElement !== node) restoredRef.current = null;
  };

  /** The origin stamped onto this screen's own entry, before the browser is allowed to leave (I-180). */
  const stampOrigin = useCallback(
    (lineId: string): void => {
      window.history.replaceState(null, "", originAddress(view.tenantId, view.projectId, lineId));
    },
    [view.projectId, view.tenantId],
  );

  /**
   * A rejection at a door, answered in place — never a toast, and never a dialog over nothing. A
   * failure carrying no registered code is a fault, and a fault belongs to the boundary that owns
   * the report id: it is re-raised untouched rather than dressed as a refusal (ARCH-03, B-21).
   */
  const refuse = useCallback(
    (code: string | null, thrown: unknown): void => {
      const entry = code === null ? undefined : doors.refusalOf(code);
      // Every caller of this helper is an event handler the browser invokes as a bare promise, so a
      // throw here would become a rejection nobody observes: the fault is held and re-raised in
      // render, which is where React's boundary — and the report id it mints — can see it.
      if (entry === undefined) {
        setFault(() => thrown);
        return;
      }
      setAnswer({ refusal: entry, evidence });
    },
    [doors, evidence],
  );

  /** The Measure door: inc-209's own answer, and the run shown where it was started (R-UI-024). */
  const requestMeasure = useCallback(async (): Promise<void> => {
    const campaignId = view.campaign?.campaignId;
    let asked: MeasureAnswer;
    try {
      asked = await doors.requestMeasure({ projectId: view.projectId, campaignId: campaignId ?? "" });
    } catch (thrown) {
      refuse(codeOf(thrown), thrown);
      return;
    }
    // A door that refused answered a code; a code the registry does not hold is a fault and is
    // re-raised as one, exactly as `refuse` re-raises it — the press never returns silent (R-UI-020,
    // ARCH-03).
    if (!asked.requested) {
      refuse(asked.refusal, new Error(asked.refusal));
      return;
    }
    const jobId = asked.jobId;
    setAnswer(null);
    setSteps((held) =>
      held.some((step) => step.jobId === jobId)
        ? held
        : [...held, { id: jobId, jobId, kind: MEASURE_KIND, status: "queued", timing: null, refusal: null, faultId: null, evidence }],
    );
  }, [doors, evidence, refuse, view.campaign?.campaignId, view.projectId]);

  /**
   * The two inspector doors pre-flight their preview at the door: a rejection is answered in place
   * and opens NO dialog, and only an answered Consequence opens one — whose own preview runs again,
   * because L-ACT-02's digest must be the one current state produces (settled ruling, I-41).
   */
  const openRepudiate = useCallback(
    async (objectKey: string): Promise<void> => {
      const input: RepudiateInput = { type: REPUDIATE, projectId: view.projectId, objectKey };
      try {
        await doors.previewRepudiate({ input });
      } catch (thrown) {
        refuse(codeOf(thrown), thrown);
        return;
      }
      setAnswer(null);
      setPending({ actType: REPUDIATE, input });
    },
    [doors, refuse, view.projectId],
  );

  const openCorroborate = useCallback(
    async (object: ViewObject, attribute: ViewAttribute, written: Draft): Promise<void> => {
      const input: CorroborateInput = {
        type: CORROBORATE,
        projectId: view.projectId,
        objectKey: object.objectKey,
        attribute: attribute.attribute,
        valueAsWritten: written.value,
        unitAsWritten: written.unit,
        precedence: Number(written.precedence),
        sourceKey: object.sourceKey,
      };
      try {
        await doors.previewCorroborate({ input });
      } catch (thrown) {
        refuse(codeOf(thrown), thrown);
        return;
      }
      setAnswer(null);
      setPending({ actType: CORROBORATE, input });
    },
    [doors, refuse, view.projectId],
  );

  /* ------------------------------------------------------------- the lane's own tabs row (§3.2) */

  /**
   * The right half of the 40 px tabs row: the pinned revision as an `IdChip` (R-UI-082 — a surrogate
   * is short on screen, whole in the DOM and one press from the clipboard) and the ONE primary this
   * screen holds. The Measure hint is the button's tooltip rather than a sentence under it: §6 allows
   * one helper line in main and this screen spends it on the count.
   *
   * Memoised on what it shows, because a slot re-set on every render would re-render the row that
   * holds it on every render of this screen.
   */
  const tabsAside = useMemo(
    () => (
      <>
        {view.campaign === null ? null : (
          <span className="cx-register-campaign">
            <span className="cx-register-campaign-label">{REGISTER_COPY.takeoff_register_campaign_label}</span>
            <IdChip value={view.campaign.setRevisionId} data-testid="register-campaign" />
          </span>
        )}
        <Tooltip content={REGISTER_COPY.takeoff_register_measure_hint}>
          <Button
            variant="primary"
            data-testid="register-measure"
            disabled={offline}
            onClick={() => {
              void requestMeasure();
            }}
          >
            {REGISTER_COPY.takeoff_register_measure}
          </Button>
        </Tooltip>
      </>
    ),
    [Button, IdChip, Tooltip, offline, requestMeasure, view.campaign],
  );

  /* ------------------------------------------------------------------ the lines table's columns */

  // §3.2's own order: what a thing is, how much of it, in what, on what basis, how covered — and only
  // then how it was worked out and where it was read. Ten columns at the widths they are read at.
  const columns: LineColumn[] = [
    {
      id: "kind",
      header: REGISTER_COPY.takeoff_register_col_kind,
      accessorFn: (line) => line.kind,
      enableSorting: true,
      size: 148,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.kind}</span>,
    },
    {
      id: "value",
      header: REGISTER_COPY.takeoff_register_col_value,
      meta: { align: "right" },
      accessorFn: (line) => line.value ?? "",
      enableSorting: true,
      size: 116,
      // The SI value at the precision it was published at, never re-rounded (I-25), grouped as the
      // document groups a figure (L-FMT-01) and kept whole in `data-value`; a row kept with no
      // quantity states none, never a zero (L-QTY-02).
      cell: ({ row }) =>
        row.original.value === null ? null : <QuantityText value={row.original.value} format={FIGURES} className="cx-register-figure" />,
    },
    {
      id: "unit",
      header: REGISTER_COPY.takeoff_register_col_unit,
      accessorFn: (line) => line.unit,
      enableSorting: true,
      size: 64,
      cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
    },
    {
      id: "bases",
      header: REGISTER_COPY.takeoff_register_col_bases,
      // 184, not 160: the cell is a chip AND the selecting basis in words, and at 160 the longest
      // registered word was sliced mid-letter in both committed stills ("Defa…" with no ellipsis to
      // say so). The width is the content's: chip 94 + gap 4 + the longest selection basis + the
      // cell's own padding (§5 rule 3's "the width it is read at").
      size: 184,
      // I-25's pair, said the way each half is said: the basis that determines the figure wears
      // R-UI-002's chip — the glyph and the palette travel with it — and the selecting basis is a
      // model value in words, with its SCREAMING form kept inside the label's own disclosure (§6).
      cell: ({ row }) => (
        <span className="cx-register-bases">
          <BasisChip basis={row.original.quantityBasis} />
          <EnumLabel value={row.original.selectionBasis} className="cx-register-enum" />
        </span>
      ),
    },
    {
      id: "coverage",
      header: REGISTER_COPY.takeoff_register_col_coverage,
      accessorFn: (line) => line.coverage,
      enableSorting: true,
      // 152 for the same reason as `bases` above: the coverage chip and the word beside it are two
      // boxes, not one text cell, so the table's ellipsis never reached them and "Complete" stood
      // cut at the cell's edge.
      size: 152,
      cell: ({ row }) => (
        <span className="cx-register-coverage">
          <CoverageChip value={row.original.coverage === COMPLETE ? 1 : 0} />
          <EnumLabel value={row.original.coverage} className="cx-register-enum" />
        </span>
      ),
    },
    {
      id: "formula",
      header: REGISTER_COPY.takeoff_register_col_formula,
      size: 180,
      // §5 rule 2: never a taller row. The cell is one line; the table's own Tooltip states it whole
      // when it is clipped, and the inspector expands it beside the variables it was read with.
      cell: ({ row }) => <span className="cx-register-formula">{row.original.formula}</span>,
    },
    {
      id: "variables",
      header: REGISTER_COPY.takeoff_register_col_variables,
      size: 180,
      cell: ({ row }) => <span className="cx-register-cell-mono">{variablesOf(row.original)}</span>,
    },
    {
      id: "calibration",
      header: REGISTER_COPY.takeoff_register_col_calibration,
      size: 120,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.calibrationKeys.join(" ")}</span>,
    },
    {
      id: "engine",
      header: REGISTER_COPY.takeoff_register_col_engine,
      accessorFn: (line) => line.engine,
      enableSorting: true,
      size: 104,
      cell: ({ row }) => <EnumLabel value={row.original.engine} className="cx-register-enum" />,
    },
    {
      id: "source",
      header: REGISTER_COPY.takeoff_register_col_source,
      accessorFn: (line) => line.sourceKey,
      enableSorting: true,
      size: 180,
      // I-179 as §6 amends it: a number's evidence is the key it was read at, so the key IS the
      // affordance and the cell's whole content is the link — but a person reads `S-101 · C1 · #1F`,
      // not a scheme and a handle. The key itself stays whole in the address the link carries and in
      // the inspector's Technical disclosure. I-181: a line that can name no place — no sheet
      // resolved, or a figure that was defaulted rather than read from a drawing — keeps its chips as
      // plain text and is offered no anchor at all, which is honest rather than hidden.
      cell: ({ row }) => {
        const line = row.original;
        const chips = sourceChips(line, marks.get(line.objectKey) ?? null);
        if (!traceable(line)) return <span className="cx-register-source">{chips}</span>;
        const isOrigin = line.lineId === originLine;
        return (
          <span className="cx-register-source cx-register-trace">
            <EvidenceLink
              href={traceAddress(view.tenantId, view.projectId, line)}
              basis={line.quantityBasis}
              label={chips}
              data-line={line.lineId}
              // Whether a row is the one returned to is a two-valued fact about every row, not a
              // badge only the winner wears: each link says which it is, so "no origin at all" and
              // "not this one" are answerable from the row itself (I-182). `aria-current` is the
              // other kind — it names the one current item and is absent everywhere else (R-UI-012).
              data-origin={isOrigin ? "true" : "false"}
              aria-current={isOrigin ? "true" : undefined}
              // Never `preventDefault`, never `pushState`: the stamp rides the click and the browser
              // makes the history step, which is what makes Back a real one (I-180). A modified click
              // opens another tab and names the same origin, so the auxiliary press stamps too.
              onClick={() => stampOrigin(line.lineId)}
              onAuxClick={() => stampOrigin(line.lineId)}
              ref={isOrigin ? holdOrigin : undefined}
            />
          </span>
        );
      },
    },
  ];

  /** §5 rule 4: one group per level and class, as the wireframe writes one — `▾ GF · column (4)`. */
  const group = useMemo(
    () => ({
      of: (line: ViewLine): GroupKey => ({ key: `${line.level}|${line.class}`, label: `${line.level}${CHIP_SEPARATOR}${line.class}` }),
      valueOf: (line: ViewLine): string | null => line.value,
      unitOf: (line: ViewLine): string => line.unit,
    }),
    [],
  );

  /** §5 rule 1's sticky footer: what the visible set adds up to, exactly and per unit (B-07). */
  const totals = useMemo(
    () => ({
      value: (
        <span className="cx-register-totals">
          {subtotalsByUnit(lines, (line) => line.value, (line) => line.unit).map((subtotal) => (
            <QuantityText key={subtotal.unit} value={subtotal.value} unit={subtotal.unit} format={FIGURES} />
          ))}
        </span>
      ),
    }),
    [QuantityText, lines, subtotalsByUnit],
  );

  /* ----------------------------------------------------------- the shell's ONE inspector (§3.2) */

  const selected = view.objects.find((object) => object.objectKey === selectedKey) ?? null;
  const selectedLine = view.lines.find((line) => line.lineId === selectedLineId) ?? null;
  const struck = selected !== null && selected.corroboration === REPUDIATED;
  const repudiated = view.objects.filter((object) => object.corroboration === REPUDIATED).length;
  const withheld = view.lines.length - registered.length;

  /**
   * What the frame's right column shows, or null — and null means NO COLUMN AT ALL, not a sentence
   * saying nothing is selected (R-UI-080, §3.1). A row selected in the grid states the line; an
   * object chosen in the tree states the object and carries this screen's two act doors. Memoised,
   * because the slot is state in the frame and a node with a new identity every render would set it
   * on every render.
   */
  const inspector = useMemo<ReactNode>(() => {
    if (selectedLine !== null) {
      const mark = marks.get(selectedLine.objectKey) ?? null;
      return (
        <div className="cx-register-inspector" data-testid={chrome.testIds.inspector} data-object={selectedLine.objectKey} data-line={selectedLine.lineId}>
          <p className="cx-register-inspector-title">{selectedLine.kind}</p>
          <dl className="cx-register-facts">
            <dt>{REGISTER_COPY.takeoff_register_col_value}</dt>
            <dd>
              {selectedLine.value === null ? null : <QuantityText value={selectedLine.value} unit={selectedLine.unit} format={FIGURES} />}
            </dd>
            <dt>{REGISTER_COPY.takeoff_register_col_bases}</dt>
            <dd data-basis={selectedLine.quantityBasis}>
              <BasisChip basis={selectedLine.quantityBasis} />
              <EnumLabel value={selectedLine.selectionBasis} className="cx-register-enum" />
            </dd>
            <dt>{REGISTER_COPY.takeoff_register_col_coverage}</dt>
            <dd>
              <CoverageChip value={selectedLine.coverage === COMPLETE ? 1 : 0} />
              <EnumLabel value={selectedLine.coverage} className="cx-register-enum" />
            </dd>
            <dt>{REGISTER_COPY.takeoff_register_col_source}</dt>
            <dd className="cx-register-source">{sourceChips(selectedLine, mark)}</dd>
          </dl>
          {/* §5 rule 2's "expand affordance in the inspector": the formula the cell could only show
              one line of, whole, with every variable it was read with beside it. */}
          <h3 className="cx-register-attributes-heading">{REGISTER_COPY.takeoff_register_col_formula}</h3>
          <p className="cx-register-formula-full">{selectedLine.formula}</p>
          <dl className="cx-register-facts">
            {Object.entries(selectedLine.variables).map(([name, binding]) => (
              <Fragment key={name}>
                <dt className="cx-register-cell-mono">{name}</dt>
                <dd>
                  <QuantityText value={binding.value} unit={binding.unit} format={FIGURES} />
                </dd>
              </Fragment>
            ))}
          </dl>
          {traceable(selectedLine) ? (
            <EvidenceLink
              href={traceAddress(view.tenantId, view.projectId, selectedLine)}
              basis={selectedLine.quantityBasis}
              label={sourceChips(selectedLine, mark)}
              data-line={selectedLine.lineId}
              onClick={() => stampOrigin(selectedLine.lineId)}
              onAuxClick={() => stampOrigin(selectedLine.lineId)}
            />
          ) : null}
          {/* The disclosure is a door, and a door a journey must open is a door with a name: the
              object key moved inside it when §7's C6 put the machine's own names behind one
              (I-234), so the summary carries a stable id rather than being addressed by its words. */}
          <details className="cx-register-technical">
            <summary className="cx-reticle" data-testid={chrome.testIds.technical}>
              {REGISTER_COPY.takeoff_register_object_key_label}
            </summary>
            <p className="cx-register-object-key" data-testid={chrome.testIds.objectKey} data-technical="">
              {selectedLine.objectKey}
            </p>
            <dl className="cx-register-facts">
              <dt>{REGISTER_COPY.takeoff_register_source_label}</dt>
              <dd className="cx-register-source" data-testid={chrome.testIds.sourceKey} data-technical="">
                {selectedLine.sourceKey}
              </dd>
            </dl>
          </details>
        </div>
      );
    }
    if (selected === null) return null;
    return (
      <div className="cx-register-inspector" data-testid={chrome.testIds.inspector} data-object={selected.objectKey}>
        <p className="cx-register-inspector-title">{selected.mark}</p>
        <dl className="cx-register-facts">
          <dt>{REGISTER_COPY.takeoff_register_basis_label}</dt>
          <dd data-testid="register-object-basis" data-basis={selected.basis}>
            <StoredBasis Chip={BasisChip} said={selected.basis} />
          </dd>
          <dt>{REGISTER_COPY.takeoff_register_role_label}</dt>
          <dd data-testid="register-object-role" data-role={selected.role}>
            <EnumLabel value={selected.role} className="cx-register-enum" />
          </dd>
          <dt>{REGISTER_COPY.takeoff_register_corroboration_label}</dt>
          <dd data-testid="register-object-corroboration" data-standing={selected.corroboration}>
            <EnumLabel value={selected.corroboration} className="cx-register-enum" />
          </dd>
        </dl>
        {/* §6: the machine's own names — the object key it is filed under and the key it was read at
            — are not what a person is shown, and they are not hidden either: they stand one press
            away, inside the disclosure the rubric names (C6's `[data-technical]`). */}
        <details className="cx-register-technical">
          <summary className="cx-reticle" data-testid={chrome.testIds.technical}>
            {REGISTER_COPY.takeoff_register_object_key_label}
          </summary>
          <p className="cx-register-object-key" data-testid={chrome.testIds.objectKey} data-technical="">
            {selected.objectKey}
          </p>
          <dl className="cx-register-facts">
            <dt>{REGISTER_COPY.takeoff_register_source_label}</dt>
            <dd className="cx-register-source" data-testid={chrome.testIds.sourceKey} data-technical="">
              {selected.sourceKey}
            </dd>
          </dl>
        </details>
        {/* I-173: a struck object states what its repudiation did — and offers no door to corroborate
            or to strike again what a person has already judged to be nothing. */}
        {struck ? <p className="cx-register-repudiated-note">{REGISTER_COPY.takeoff_register_repudiated_note}</p> : null}
        {permitted && !offline && !struck ? (
          <Button
            variant="secondary"
            onClick={() => {
              void openRepudiate(selected.objectKey);
            }}
          >
            {REGISTER_COPY.takeoff_register_repudiate}
          </Button>
        ) : null}

        <h3 className="cx-register-attributes-heading">{REGISTER_COPY.takeoff_register_attributes_label}</h3>
        {selected.attributes.map((attribute) => (
          <section
            key={attribute.attribute}
            className="cx-register-attribute"
            data-testid="register-attribute"
            data-attribute={attribute.attribute}
            data-standing={attribute.standing}
          >
            <p className="cx-register-attribute-name">{attribute.attribute}</p>
            <EnumLabel value={attribute.standing} className="cx-register-enum" />
            {attribute.canonicalValue === null || attribute.canonicalUnit === null ? null : (
              <p className="cx-register-reading" data-testid="register-reading" data-role="standing">
                <QuantityText value={attribute.canonicalValue} unit={attribute.canonicalUnit} format={FIGURES} />
              </p>
            )}
            {attribute.standing === SUSPENDED ? <p className="cx-register-suspended">{REGISTER_COPY.takeoff_register_suspended_note}</p> : null}
            {attribute.competing.length === 0 && attribute.overruled.length === 0 ? (
              <p className="cx-register-no-readings">{REGISTER_COPY.takeoff_register_no_readings}</p>
            ) : null}
            <Readings label={REGISTER_COPY.takeoff_register_competing_label} role="competing" readings={attribute.competing} BasisChip={BasisChip} />
            <Readings label={REGISTER_COPY.takeoff_register_overruled_label} role="overruled" readings={attribute.overruled} BasisChip={BasisChip} />
            {permitted && !offline && !struck ? (
              <div className="cx-register-corroborate">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDraft((held) =>
                      held !== null && held.attribute === attribute.attribute ? null : { attribute: attribute.attribute, value: "", unit: "", precedence: "0" },
                    )
                  }
                >
                  {REGISTER_COPY.takeoff_register_corroborate}
                </Button>
                {draft !== null && draft.attribute === attribute.attribute ? (
                  <div className="cx-register-corroborate-form">
                    <label className="cx-register-field">
                      <span>{REGISTER_COPY.takeoff_register_corroborate_value}</span>
                      <Input value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
                    </label>
                    <label className="cx-register-field">
                      <span>{REGISTER_COPY.takeoff_register_corroborate_unit}</span>
                      <Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
                    </label>
                    <label className="cx-register-field">
                      <span>{REGISTER_COPY.takeoff_register_corroborate_precedence}</span>
                      <Input
                        value={draft.precedence}
                        aria-describedby={`precedence-hint-${attribute.attribute}`}
                        onChange={(event) => setDraft({ ...draft, precedence: event.target.value })}
                      />
                    </label>
                    <p className="cx-register-hint" id={`precedence-hint-${attribute.attribute}`}>
                      {REGISTER_COPY.takeoff_register_corroborate_precedence_hint}
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void openCorroborate(selected, attribute, draft);
                      }}
                    >
                      {REGISTER_COPY.takeoff_register_corroborate_preview}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    );
  }, [
    BasisChip,
    Button,
    CoverageChip,
    EnumLabel,
    EvidenceLink,
    Input,
    QuantityText,
    draft,
    marks,
    offline,
    openCorroborate,
    openRepudiate,
    permitted,
    selected,
    selectedLine,
    stampOrigin,
    struck,
    view.projectId,
    view.tenantId,
  ]);

  /** The same rejection, shaped as the one ConsequenceDialog reads one (its I-40). */
  const refused = (thrown: unknown): never => {
    const code = codeOf(thrown);
    const entry = code === null ? undefined : doors.refusalOf(code);
    if (entry === undefined) throw thrown;
    throw Object.assign(new Error(entry.code), { refusal: entry, evidence });
  };

  const previewOf = (act: Pending) => async (): Promise<PreviewAnswer> => {
    try {
      if (act.actType === CORROBORATE) return await doors.previewCorroborate({ input: act.input });
      if (act.actType === REPUDIATE) return await doors.previewRepudiate({ input: act.input });
      return await doors.previewInsertLevel({ input: act.input });
    } catch (thrown) {
      return refused(thrown);
    }
  };

  const commitOf = (act: Pending) => async (carried: { consequenceDigest: string }): Promise<{ actId: string }> => {
    try {
      if (act.actType === CORROBORATE) return await doors.commitCorroborate({ input: act.input, consequenceDigest: carried.consequenceDigest });
      if (act.actType === REPUDIATE) return await doors.commitRepudiate({ input: act.input, consequenceDigest: carried.consequenceDigest });
      return await doors.commitInsertLevel({ input: act.input, consequenceDigest: carried.consequenceDigest });
    } catch (thrown) {
      return refused(thrown);
    }
  };

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all,
  // and a press that raised a fault into one would otherwise return with nothing said (R-UI-020).
  if (fault !== null) throw fault;

  /* ------------------------------------------------------------------------------ the state */

  const nothingRegistered = view.campaign === null || view.objects.length === 0;
  const state = !permitted
    ? "denied"
    : offline
      ? "offline"
      : answer !== null
        ? "refused"
        : nothingRegistered
          ? "empty"
          : view.refusals.length > 0
            ? "partial"
            : "ready";

  const filterOptions: Readonly<Record<keyof Filters, { label: string; any: string; options: string[] }>> = {
    class: {
      label: REGISTER_COPY.takeoff_register_filter_class,
      any: REGISTER_COPY.takeoff_register_filter_any_class,
      options: optionsOf(registered, (line) => line.class).concat(optionsOf(view.objects, (object) => object.class)).filter((value, at, all) => all.indexOf(value) === at),
    },
    kind: { label: REGISTER_COPY.takeoff_register_filter_kind, any: REGISTER_COPY.takeoff_register_filter_any_kind, options: optionsOf(registered, (line) => line.kind) },
    level: {
      label: REGISTER_COPY.takeoff_register_filter_level,
      any: REGISTER_COPY.takeoff_register_filter_any_level,
      options: optionsOf(registered, (line) => line.level).concat(optionsOf(view.objects, (object) => object.level)).filter((value, at, all) => all.indexOf(value) === at),
    },
    basis: {
      label: REGISTER_COPY.takeoff_register_filter_basis,
      any: REGISTER_COPY.takeoff_register_filter_any_basis,
      // The roster's own order, narrowed to what this campaign in fact published (I-172).
      options: QUANTITY_BASES.filter((basis) => registered.some((line) => line.quantityBasis === basis)),
    },
    coverage: { label: REGISTER_COPY.takeoff_register_filter_coverage, any: REGISTER_COPY.takeoff_register_filter_any_coverage, options: optionsOf(registered, (line) => line.coverage) },
  };

  /**
   * A row chosen with the pointer. The shipped grid raises its own selection (Space, ⇧-range) through
   * `onRowSelect`, and a click moves the cell cursor without taking a row — so the row a reader
   * POINTED at is read here, from the `data-line` every row publishes through `rowDataOf`. This reads
   * nothing of the primitive's insides: it reads an attribute this screen itself put there. The
   * keyboard path is the grid's own, which is why no key handler stands beside this one.
   */
  const takeRowAt = (target: EventTarget | null): void => {
    const row = target instanceof Element ? target.closest("[data-line]") : null;
    const lineId = row?.getAttribute("data-line") ?? null;
    if (lineId === null) return;
    setSelectedKey(null);
    setSelectedLineId((held) => (held === lineId ? null : lineId));
  };

  return (
    <div className="cx-register" data-testid="register-workspace" data-state={state} data-campaign={view.campaign?.campaignId}>
      {/* The lane's tabs row and the frame's one inspector are filled, not drawn (§3.2, R-UI-080):
          each mount renders where its region is, and nothing at all where there is nothing to show. */}
      <TabsAside>{tabsAside}</TabsAside>
      <InspectorMount>{inspector}</InspectorMount>

      {/* The screen names itself once, for heading navigation. The breadcrumb and the current tab
          both say `Register` where a reader can see it, so a 20 px title over the grid would be the
          third — and the grid is what this screen is (§1: never a heading with a sentence under it). */}
      <h1 className="cx-register-title">{REGISTER_COPY.takeoff_register_heading}</h1>

      {offline ? (
        <p className="cx-register-offline" role="status">
          {REGISTER_COPY.takeoff_register_offline}
        </p>
      ) : null}

      {/* R-UI-020: a door's rejection renders in place, through the one renderer, and never as a
          toast. The slot is live so an answer is spoken the moment it arrives (R-UI-012). */}
      <div className="cx-register-answer" data-testid="register-answer" aria-live="polite">
        {permitted ? null : (
          <>
            <p className="cx-register-denied">{REGISTER_COPY.takeoff_register_denied_permission}</p>
            <p className="cx-register-denied">{REGISTER_COPY.takeoff_register_denied_holder}</p>
            <Denied refusalOf={doors.refusalOf} evidence={deniedEvidence} RefusalState={RefusalState} />
          </>
        )}
        {answer === null ? null : <RefusalState refusal={answer.refusal} evidence={answer.evidence} />}
      </div>

      {/* R-UI-080: the job strip EXISTS ONLY WHILE THERE IS A RUN. A "Measure runs" block standing
          empty over the grid was the height §8 took this screen's first point for. */}
      {steps.length === 0 ? null : (
        <section className="cx-register-timeline" data-testid="register-timeline">
          <JobTimeline heading={REGISTER_COPY.takeoff_register_timeline_heading} steps={steps} />
        </section>
      )}

      {/* §3.2's 36 px filter bar: one chip per narrowing, each reading `Label · Value ▾`, and the
          live count. The label rides inside the control rather than standing beside it as a row,
          which is what keeps the bar one line — and the platform's own popup is gone (I-172). */}
      <div className="cx-register-filters">
        {(Object.keys(filterOptions) as (keyof Filters)[]).map((name) => (
          <Combobox
            key={name}
            className="cx-register-filter"
            data-testid={`register-filter-${name}`}
            variant="chip"
            label={filterOptions[name].label}
            placeholder={filterOptions[name].any}
            options={[{ value: "", label: filterOptions[name].any }, ...filterOptions[name].options.map((option) => ({ value: option, label: option }))]}
            value={filters[name]}
            onChange={(chosen) => setFilters((held) => ({ ...held, [name]: chosen }))}
          />
        ))}
        {/* The one helper line this screen spends (§6, C7): what is shown, of what there is. */}
        <p className="cx-register-count" data-testid="register-lines-count" role="status">
          {fillCopy("takeoff_register_lines_count", { shown: formatUserFigure(String(lines.length)), total: formatUserFigure(String(registered.length)) })}
        </p>
      </div>

      <div className="cx-register-body">
        {/* The index rail (§3.2's `tree`, widened to hold what else the campaign answered): the
            objects, what was struck, what produced no line, and what the machine offers. All of it
            stands BESIDE the grid rather than under it, so none of it is height the grid pays for. */}
        <section className="cx-register-panel cx-register-index">
          <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_tree_label}</h2>
          {/* I-171: the shipped Tree fixes its own id after the spread, so the screen's id rides a
              `display: contents` wrapper that adds no box and no line of layout. */}
          <div className="cx-register-mount cx-register-tree" data-testid="register-tree">
            <Tree
              items={tree.items}
              defaultExpandedIds={tree.expanded}
              aria-label={REGISTER_COPY.takeoff_register_tree_label}
              onSelect={(id) => {
                if (!id.startsWith("o:")) return;
                setSelectedLineId(null);
                setSelectedKey(id.slice(2));
              }}
            />
          </div>
          <div className="cx-register-repudiated" data-testid="register-repudiated-count">
            {fillCopy("takeoff_register_repudiated_count", { count: formatUserFigure(String(repudiated)), lines: formatUserFigure(String(withheld)) })}
          </div>

          {/* R-UI-020: a sighting that produced no line says why, in place, with the evidence that
              resolves it — and the count is stated even when it is zero (silence never happens). The
              sentence that used to stand under this heading is now the heading's own hint (§6). */}
          {/* The same clause, for the same reason: this region scrolls too, and a campaign that
              refused nothing leaves it with no focusable child (R-UI-012). */}
          <section
            className="cx-register-refusals cx-reticle cx-reticle-scroll"
            data-testid="register-refusals"
            data-count={view.refusals.length}
            tabIndex={0}
            aria-label={REGISTER_COPY.takeoff_register_refusals_heading}
          >
            <Tooltip content={REGISTER_COPY.takeoff_register_refusals_hint}>
              <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_refusals_heading}</h2>
            </Tooltip>
            {view.refusals.map((refusal) => {
              // A row with no message, remedy or evidence link is the silence R-UI-020 forbids: a
              // code the registry does not hold is a fault of the reading, raised to the boundary
              // that mints the report id rather than rendered as a blank row (ARCH-03, B-21).
              const entry = doors.refusalOf(refusal.code);
              if (entry === undefined) {
                throw new Error(`the register read a refusal code no registry entry stands for: ${refusal.code} (R-UI-020)`);
              }
              return (
                <div
                  key={`${refusal.code}-${refusal.objectKey}`}
                  className="cx-register-refusal"
                  data-testid="register-refusal"
                  data-code={refusal.code}
                  data-object={refusal.objectKey}
                  data-kind={refusal.kind ?? undefined}
                >
                  <div className="cx-register-refusal-fact">
                    <span className="cx-register-refusal-label">{REGISTER_COPY.takeoff_register_refusal_object_label}</span>
                    <span className="cx-register-cell-mono" data-testid="register-refusal-object" data-technical="">
                      {refusal.objectKey}
                    </span>
                  </div>
                  {refusal.kind === null ? null : (
                    <div className="cx-register-refusal-fact">
                      <span className="cx-register-refusal-label">{REGISTER_COPY.takeoff_register_refusal_kind_label}</span>
                      <span className="cx-register-cell-mono">{refusal.kind}</span>
                    </div>
                  )}
                  <RefusalState refusal={entry} evidence={evidence} />
                </div>
              );
            })}
          </section>

          {/* R-UI-023: the one bulk door on this screen. There is no checkbox, no row selection and
              no select-all anywhere under this workspace — the offer is confirmed as it is named. */}
          {permitted ? (
            // R-UI-012, in the words `ScrollArea` already settled it with: "a region that scrolls
            // must be reachable and scrollable from the keyboard, and it wears the reticle like
            // anything else that takes focus". This one scrolls (register.css) and holds nothing
            // focusable at all while the machine offers no stack, so without this it was a region a
            // pointer could read and a keyboard could not — axe SERIOUS `scrollable-region-focusable`.
            <section
              className="cx-register-level-stack cx-reticle cx-reticle-scroll"
              data-testid="register-level-stack"
              tabIndex={0}
              aria-label={REGISTER_COPY.takeoff_register_level_stack_heading}
            >
              <Tooltip content={REGISTER_COPY.takeoff_register_level_stack_hint}>
                <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_level_stack_heading}</h2>
              </Tooltip>
              <OfferedGroups
                groups={view.levelStacks.map((stack) => ({
                  key: stack.key,
                  label: fillCopy("takeoff_register_level_stack_label", { drawing: stack.label }),
                  count: fillCopy("takeoff_register_level_stack_count", { count: formatUserFigure(String(stack.count)) }),
                }))}
                onConfirm={(key) => {
                  const offer = view.levelStacks.find((stack) => stack.key.drawingId === key.drawingId && stack.key.ingestId === key.ingestId);
                  if (offer === undefined) return;
                  setAnswer(null);
                  setPending({ actType: INSERT_LEVEL, input: { type: INSERT_LEVEL, projectId: view.projectId, levels: offer.levels } });
                }}
              />
            </section>
          ) : null}
        </section>

        {/* The primary region. Nothing stands above it inside `shell-main` but the 40 px tabs row and
            the 36 px bar, so its first row is within 116 px of the top of main at both viewports
            (§3.2's hard rule, §7 C2). */}
        {/* The keyboard path into a row is the grid's own (Space takes a row, ⇧ extends the range),
            so this handler adds a pointer to it rather than a second way to do one thing: it reads
            the row a click landed on off the `data-line` the screen itself published (§5 rule 10). */}
        <div className="cx-register-mount cx-register-lines" data-testid="register-lines" onClick={(event) => takeRowAt(event.target)}>
          {nothingRegistered ? (
            <EmptyState
              data-testid="register-empty"
              className="cx-register-empty"
              heading={view.campaign === null ? REGISTER_COPY.takeoff_register_empty_heading : REGISTER_COPY.takeoff_register_empty_campaign_heading}
              body={view.campaign === null ? REGISTER_COPY.takeoff_register_empty_body : REGISTER_COPY.takeoff_register_empty_campaign_body}
            >
              {view.campaign === null ? (
                <a className="cx-btn cx-reticle cx-register-empty-action" data-variant="secondary" href={setsHref(view.tenantId, view.projectId)}>
                  {REGISTER_COPY.takeoff_register_empty_action}
                </a>
              ) : null}
            </EmptyState>
          ) : lines.length === 0 ? (
            <EmptyState className="cx-register-empty" heading={REGISTER_COPY.takeoff_register_lines_none} />
          ) : (
            // The origin is named, not hunted for: the table is told which row a reader must be able
            // to reach and answers with it drawn, so this screen reads nothing of the table's insides
            // to put the reticle back where Back came from (I-182, B-17). The row height is the
            // ROOT's density token, not this screen's (§4.2, §5 rule 1).
            <DataTable
              tableId={REGISTER_TABLE_ID}
              columns={columns}
              data={[...lines]}
              getRowId={(line) => line.lineId}
              freezeKeyColumn
              group={group}
              totals={totals}
              onRowSelect={(ids) => {
                setSelectedKey(null);
                setSelectedLineId(ids[0] ?? null);
              }}
              rowDataOf={(line) => rowDataOf(line, selectedLineId)}
              aria-label={REGISTER_COPY.takeoff_register_heading}
              // The table is asked to travel only to a row it is in fact rendering: an origin a
              // filter has taken away stands nowhere, and asking for it would leave the reticle owed
              // for the rest of the visit. Where the row does stand, WHERE it stands is the table's
              // own reading of its sorted order, never this screen's of the unsorted list (I-182).
              scrollToRowId={originRowIndexOf(lines, originLine) === null ? undefined : (originLine ?? undefined)}
            />
          )}
        </div>
      </div>

      {pending === null ? null : (
        <ConsequenceDialog
          open
          actType={pending.actType}
          preview={previewOf(pending)}
          commit={commitOf(pending)}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          onCommitted={() => {
            setPending(null);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

/** The registered denial, rendered through the one renderer or not at all (R-UI-020, B-17). */
function Denied({
  refusalOf,
  evidence,
  RefusalState,
}: {
  refusalOf: (code: string) => RefusalEntry | undefined;
  evidence: Evidence;
  RefusalState: RegisterChrome["RefusalState"];
}) {
  const entry = refusalOf(PERMISSION_NOT_HELD);
  if (entry === undefined) return null;
  return <RefusalState refusal={entry} evidence={evidence} />;
}

/**
 * One list of readings under its own label, each stating its value, its basis, the precedence it was
 * declared at and the source key it was read from — overruled, never erased (L-ACT-01, I-174).
 */
function Readings({
  label,
  role,
  readings,
  BasisChip,
}: {
  label: string;
  role: "competing" | "overruled";
  readings: readonly ViewReading[];
  BasisChip: RegisterChrome["BasisChip"];
}) {
  if (readings.length === 0) return null;
  return (
    <>
      <p className="cx-register-readings-label">{label}</p>
      {readings.map((reading) => (
        <p
          key={reading.observationId}
          className="cx-register-reading"
          data-testid="register-reading"
          data-role={role}
          data-basis={reading.basis}
          data-precedence={reading.precedence}
        >
          <span className="cx-register-cell-mono">
            {reading.valueAsWritten} {reading.unitAsWritten}
          </span>
          <StoredBasis Chip={BasisChip} said={reading.basis} />
          <span className="cx-register-source" data-technical="">
            {reading.sourceKey}
          </span>
        </p>
      ))}
    </>
  );
}
