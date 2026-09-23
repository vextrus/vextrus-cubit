"use client";
// S-BOQ's workspace (docs/design/s-boq.md): the pinned campaign's draft as the owner ruled a bill is
// shaped — L-BD-08's sections, a trade heading per (class · kind) group, one numbered ITEM per
// description at one level band, each the register's sum of its member lines rounded once — and a
// closing section that says what the draft does not measure. No quantity is added across
// descriptions: a group, a section and the project state none (L-QTY-04, L-QTY-07, I-268,
// I-528, I-529).
//
// Presentational and injected (I-170): every piece of shipped chrome arrives as a renderer declared
// by exactly the props this screen hands it, so a module never reaches the ui layer (ARCH-01) and a
// suite mounts the very components a reader sees. Nothing is measured here and nothing is rounded
// here: the payload is the DOCUMENT's payload and the item numbers are the document's numbering, so
// what a reader reads and what the PDF prints are one derivation (I-269, I-271).
//
// AM-05 and I-265: the words on this screen are SECTION, DRAFT, ITEM and LINE. The name the law
// reserves for the signed thing appears in no sentence, no key and no class name here — only in
// `data-bill`, which is machine vocabulary a reader never meets.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { BoqDraftItem, BoqDraftPayload, BoqDraftSection } from "@/core/documents/kinds/boq-draft";
import { descriptionOf, groupQualifier, inWords, notMeasuredAbout } from "@/core/documents/kinds/boq-draft-law";
import type { RefusalEntry } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import type { JobKind } from "@/core/jobs/kinds";
import type { QuantityBasis } from "@/core/offers/law";
import { BOQ_COPY, BOQ_REASON_WORDS, BOQ_SECTION_WORDS } from "./copy";
import { DEFAULTED, groupKeyOf, type DescriptionBasis, type GroupDescriptions } from "./description-basis";
import { boqStateOf, nothingPublished } from "./states";
import { BILLS, UNCLASSIFIED } from "./taxonomy";
import type { BoqView } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * One row of a section's grid: an ITEM of the draft — or, in the kept Unclassified block, one line
 * the taxonomy could not place — with what its group and the numbering said about it.
 */
export type BoqRow = {
  /** The item's key, or the kept line's id: what the grid knows the row by and nothing more. */
  readonly key: string;
  readonly bill: string;
  readonly class: string;
  readonly kind: string;
  /** The trade heading the row stands under (`Column · Concrete`), as the group row says it. */
  readonly heading: string;
  /** The item's full description — its group's sentence, the member and what selects it. */
  readonly description: string;
  /**
   * Where this item's sentence came from (I-298): INTERPRETED where a model chose it from the
   * work-item catalogue against its group's own attributes, DEFAULTED where the catalogue's own
   * sentence stands. A reader and a suite ask the same row the same question.
   */
  readonly descriptionBasis: DescriptionBasis;
  /** The S.G.I string, or `null` on a row outside `BILLS` — a row with no section has no S (I-267). */
  readonly item: string | null;
  /** Why the taxonomy could not place this line, in words; `null` on an item it placed (L-BD-08). */
  readonly reason: string | null;
  /** The storey an item is priced at, or the levels its members stand on where it has no band. */
  readonly level: string;
  /** The lawful-null slot every member stands in where they stand on no level (`FOUNDATION`). */
  readonly slot: string | null;
  readonly levelOrdinal: number | null;
  /** The register's sum of the members that state a figure, rounded once — or nothing (L-QTY-02). */
  readonly quantity: string | null;
  readonly unit: string;
  readonly coverage: string;
  readonly quantityBasis: string;
  readonly selectionBasis: string;
  /** Which row of the taxonomy placed the row's lines, as the resolver recorded it (L-BD-08). */
  readonly decidedBy: string;
  /** How many member lines stand behind the row — its details of measurement. */
  readonly members: number;
  /** How much of the item its figure covers, and why the rest states none (I-450); empty when whole. */
  readonly qualifier: string;
  /** The registered codes its members gave for what they could not measure, once each (L-QTY-02). */
  readonly omitted: readonly string[];
  /** The kept line's own id on an Unclassified row; `null` on an item, which is many lines. */
  readonly lineId: string | null;
};

/** One cell of a section's grid, as the shipped DataTable hands one its row. */
type BoqCell = { readonly row: { readonly original: BoqRow } };

/** One column of a section's grid, as the shipped DataTable takes one. */
type BoqColumn = {
  id: string;
  header: string;
  accessorFn?: (row: BoqRow) => string;
  /** The width the column is READ at (§5 rule 3), never the primitive's 150. */
  size?: number;
  cell: (context: BoqCell) => ReactNode;
  meta?: { align?: "right"; groupSubtotal?: "value" | "unit" };
};

/** How a section's grid groups its rows: by the (class · kind) trade heading, stating no figure. */
type BoqGroup = {
  of: (row: BoqRow) => { key: string; label: string } | null;
  valueOf?: (row: BoqRow) => string | null;
  unitOf?: (row: BoqRow) => string;
  showCount?: boolean;
};

/** One step of the render job, as the shipped timeline reads one (job-timeline I-113). */
export type BoqJobStep = {
  readonly id: string;
  readonly jobId: string | null;
  readonly kind: JobKind;
  readonly status: "queued" | "running" | "succeeded" | "failed" | "refused";
  readonly timing: string | null;
  readonly refusal: RefusalEntry | null;
  readonly faultId: string | null;
  readonly evidence: Evidence;
};

/** The two artefacts the quantities travel as (R-TO-070, R-SPINE-041's kinds). */
export type BoqExportKind = "xlsx" | "csv";

/** What a quantities press answers: where the bytes are, what they are addressed by, and which kind. */
export type BoqQuantitiesLink = { readonly url: string; readonly sha256: string; readonly kind: string };

/** What the route knows about the export it is watching, where one is being watched (I-270). */
export type BoqJobs = {
  readonly steps: readonly BoqJobStep[];
  readonly lost?: boolean;
  /** The document the finished render filed, once it exists (Decision §1's job strip). */
  readonly documentId?: string | null;
};

/**
 * THE IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is
 * the one declaration of every test id and a module may not import it, so they arrive as chrome —
 * exactly as `DataTable` and `EnumLabel` do. The defaults below are the registry's own spellings,
 * kept as data rather than as attribute literals so the registry stays the only declaration.
 */
export interface BoqTestIds {
  readonly screen: string;
  readonly answer: string;
  readonly grid: string;
  readonly bill: string;
  readonly line: string;
  /** Kept in the registry: the section's quantity foot it named is gone (I-529). */
  readonly subtotal: string;
  readonly export: string;
  /** The two quantity channels beside the primary, and the link a press hands back (R-TO-070). */
  readonly exportXlsx: string;
  readonly exportCsv: string;
  readonly exportLink: string;
  readonly empty: string;
  readonly revision: string;
  readonly taxonomyVersion: string;
  readonly draft: string;
  readonly jobs: string;
  readonly documentLink: string;
  /** The closing section that says what the draft does not measure (I-451, I-532). */
  readonly notMeasured?: string;
}

/** The registry's spellings, as this screen falls back to them when a caller hands none. */
const DEFAULT_TEST_IDS: BoqTestIds = Object.freeze({
  screen: "boq-screen",
  answer: "boq-answer",
  grid: "boq-grid",
  bill: "boq-bill",
  line: "boq-line",
  subtotal: "boq-subtotal",
  export: "boq-export",
  exportXlsx: "boq-export-xlsx",
  exportCsv: "boq-export-csv",
  exportLink: "boq-export-link",
  empty: "boq-empty",
  revision: "boq-revision",
  taxonomyVersion: "boq-taxonomy-version",
  draft: "boq-draft",
  jobs: "boq-jobs",
  documentLink: "boq-document-link",
  notMeasured: "boq-not-measured",
});

/** The shipped renderers the app layer injects (I-170), each declared by the props this screen hands it. */
export interface BoqChrome {
  readonly testIds?: BoqTestIds;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: BoqColumn[];
    data: BoqRow[];
    getRowId: (row: BoqRow, index: number) => string;
    freezeKeyColumn?: boolean;
    group?: BoqGroup;
    rowDataOf?: (row: BoqRow, rowId: string) => Readonly<Record<string, string>>;
    rowTestId?: string;
    loading?: boolean;
    loadingRows?: number;
    "aria-label"?: string;
  }>;
  readonly EmptyState: ComponentType<{ heading: string; body?: string; children?: ReactNode; className?: string; "data-testid"?: string }>;
  readonly ErrorState: ComponentType<{
    heading: string;
    body?: string;
    reportId?: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
    "data-testid"?: string;
  }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  readonly BasisChip: ComponentType<{ basis: QuantityBasis }>;
  readonly CoverageChip: ComponentType<{ value: number }>;
  readonly UnitBadge: ComponentType<{ unit: string; className?: string }>;
  readonly Skeleton: ComponentType<{ className?: string }>;
  readonly JobTimeline: ComponentType<{ heading: string; steps: readonly BoqJobStep[]; lost?: boolean }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "act";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children?: ReactNode;
    "aria-disabled"?: "true";
    "data-testid"?: string;
    "data-permission"?: string;
    "data-job"?: string;
    "data-kind"?: string;
  }>;
  /** The lane's own tabs row, filled by the surface standing in it (Direction §3.2). */
  readonly TabsAside?: ComponentType<{ children: ReactNode }>;
}

/** The doors this screen presses, and the one lookup a refusal's words are read through (I-170). */
export interface BoqDoors {
  /** The keyed render job (I-270): one press, one job, however many times it is pressed. */
  readonly exportDraft: () => Promise<{ jobId: string; deduplicated: boolean }>;
  /**
   * The quantities, written now and handed back as a signed link (R-TO-070, I-272). Synchronous:
   * a workbook is evidence addressed by its own bytes, so there is no run to watch and nothing is
   * filed — the answer IS the artefact's address.
   */
  readonly exportQuantities?: (input: { kind: BoqExportKind }) => Promise<BoqQuantitiesLink>;
  readonly refusalOf: (code: string) => RefusalEntry | undefined;
  /** Re-run the read in place — R-UI-050's error cell owns the one door that clears it. */
  readonly retry?: () => void;
}

export interface BoqWorkspaceProps {
  /** The reading, or `null` where it failed — the error cell is a state of this screen (R-UI-050). */
  readonly view: BoqView | null;
  /** The state cell the CALLER has already settled, where it knows one this screen cannot derive. */
  readonly state?: string | null;
  /** Whether this reader holds MEASURE on this project, read server-side (Decision §2). */
  readonly permitted?: boolean;
  readonly offline?: boolean;
  /** The fault the read left behind, quoted verbatim beside the retry (B-21). */
  readonly reportId?: string | null;
  /** The code a door answered with, rendered through the one refusal renderer (R-UI-020). */
  readonly refused?: string | null;
  readonly tenantId?: string;
  readonly projectId?: string;
  /** What the route is watching of the export it started, where one is being watched (I-270). */
  readonly jobs?: BoqJobs | null;
  /** Told when a press started a run, so the route can watch it (`useTrackedJobs` is the ui's). */
  readonly onExportStarted?: (jobId: string) => void;
  readonly chrome: BoqChrome;
  readonly doors?: Partial<BoqDoors>;
}

/* --------------------------------------------------------------------------- the vocabulary */

/** The code the screen's own denial renders, off the registry the caller looks it up in. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The permission the one door on this screen moves (L-ACT-03). */
const MEASURE = "MEASURE";

/** What an item says when every line behind it measured whole (L-QTY-02). */
const COMPLETE = "COMPLETE";

/** The standing an unsigned draft carries, said once and in words (AM-05). */
const UNSIGNED = "UNSIGNED";

/** The two kinds the quantities travel as, as this screen states them on its own controls. */
const XLSX = "xlsx";
const CSV = "csv";

/** What parts a taxonomy version's family from its edition: `bill-taxonomy/2026-09-16`. */
const VERSION_EDITION = "/";

/**
 * The widths the six fixed columns are read at (§1's column table), and the least the Description
 * column is read at. The Description takes whatever the grid's band leaves (C9's BOQ half: the
 * description takes the slack), measured the s-bbs way — a band left empty after Coverage was the
 * craft review's finding, and an item's description is the longest thing on the row.
 */
const WIDTH = Object.freeze({ item: 96, level: 120, quantity: 140, unit: 80, basis: 240, coverage: 112 });
const DESCRIPTION_MIN = 320;
/** What the fixed six take together. */
const FIXED_WIDTH = Object.values(WIDTH).reduce((sum, width) => sum + width, 0);
/**
 * What the band keeps clear at its trailing edge: the DataTable's `⋯` over the header's last
 * `--row-h`, the last column's resize target beside it, and a vertical scroller (s-bbs's own 40).
 */
const TRAILING_ALLOWANCE = 40;
/** Widths stay on the 4 px grid the rest of the screen stands on (§1). */
const GRID_STEP = 4;

/** The Description column's width: what the band leaves once the six fixed columns have theirs. */
function descriptionWidthOf(gridWidth: number | null): number {
  if (gridWidth === null) return DESCRIPTION_MIN;
  const left = gridWidth - FIXED_WIDTH - TRAILING_ALLOWANCE;
  return Math.max(DESCRIPTION_MIN, Math.floor(left / GRID_STEP) * GRID_STEP);
}

/**
 * The short form a taxonomy version is SHOWN by: its edition — what follows the family's `/` — which
 * is the part that tells one taxonomy from the next (I-355). A version written without a family has
 * no better short form than the chip's own, so it is left to the chip. The whole value is never
 * rewritten: it stays the chip's `data-value`, tooltip and copy (R-UI-082).
 */
function editionOf(version: string): string | undefined {
  const at = version.lastIndexOf(VERSION_EDITION);
  const edition = at < 0 ? "" : version.slice(at + VERSION_EDITION.length);
  return edition === "" ? undefined : edition;
}

// The addresses this screen links. ARCH-01 bars a module from the app layer where a route builder
// lives, so they are spelled here for this screen and nowhere else in it (Decision §7).
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;
const setsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;
const documentsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/documents`;
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;

/**
 * One quantities channel: the shipped secondary, and — while the connection is gone — the frame's own
 * unavailable affordance in its place.
 *
 * The shipped Button reports `aria-disabled` for busy and for nothing else, so a door shut for a
 * reason of this screen's own says so itself, exactly as the levels screen's shut doors do (I-247,
 * R-UI-010). Shut, it carries no press at all: a control a reader can activate while nothing can be
 * written would answer with a file of the register as it is not (R-UI-020).
 */
function ExportChannel({
  Button,
  Tooltip,
  testid,
  kind,
  format,
  hint,
  offline,
  onPress,
}: {
  Button: BoqChrome["Button"];
  Tooltip: BoqChrome["Tooltip"];
  testid: string;
  kind: string;
  /** The artefact's own word (`XLSX`, `CSV`), which follows the channel's noun. */
  format: string;
  hint: string;
  offline: boolean;
  onPress: () => void;
}): ReactNode {
  // The noun and the format are one name — `Quantities XLSX` — and both stay in the accessible name;
  // where the tabs row is narrower than the six tabs and the whole aside, the noun alone stands
  // visually hidden so the row keeps one line (§1, R-UI-080, I-boq-1).
  const label = (
    <>
      <span className="cx-boq-channel-noun">{BOQ_COPY.boq_export_quantities}</span> <span>{format}</span>
    </>
  );
  if (offline) {
    return (
      <Tooltip content={BOQ_COPY.boq_offline}>
        <span
          className="cx-btn cx-reticle cx-boq-export-shut"
          data-variant="secondary"
          role="button"
          tabIndex={0}
          aria-disabled="true"
          data-testid={testid}
          data-permission={MEASURE}
          data-kind={kind}
        >
          <span className="cx-btn-label">{label}</span>
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={hint}>
      <Button variant="secondary" className="cx-boq-export-quantities" data-testid={testid} data-permission={MEASURE} data-kind={kind} onClick={onPress}>
        {label}
      </Button>
    </Tooltip>
  );
}

/** A node rendered where it stands, for a caller that hands no slot mount (I-209). */
function InPlace({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/* ------------------------------------------------------------------------------- the reading */

/** The codes an item's members gave for what they could not measure, once each, in their order. */
function omittedOfItem(item: BoqDraftItem): string[] {
  return [...new Set(item.lines.flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : [])))];
}

/**
 * Every row of one section: its items, in the payload's own order — which is the order they were
 * numbered in (I-269). Each item carries its group's heading, so the grid's group row reads the trade
 * and the row reads the description.
 */
function rowsOf(section: BoqDraftSection, items: ReadonlyMap<string, string>, descriptions: GroupDescriptions | undefined): BoqRow[] {
  return section.groups.flatMap((group) =>
    group.items.map((item) => {
      const omitted = omittedOfItem(item);
      const measured = item.lines.filter((line) => line.quantity !== null).length;
      return {
        key: item.key,
        bill: section.bill,
        class: group.class,
        kind: group.kind,
        heading: descriptionOf(group.class, group.kind),
        description: item.description,
        descriptionBasis: descriptions?.get(groupKeyOf(group.class, group.kind))?.basis ?? DEFAULTED,
        item: items.get(item.key) ?? null,
        reason: null,
        level: item.level,
        slot: item.slot ?? null,
        levelOrdinal: item.levelOrdinal ?? null,
        quantity: item.quantity,
        unit: item.unit,
        coverage: item.coverage,
        quantityBasis: item.quantityBasis,
        selectionBasis: item.selectionBasis,
        decidedBy: item.lines[0]?.decidedBy ?? "",
        members: item.lines.length,
        qualifier: groupQualifier(measured, item.lines.length, omitted),
        omitted,
        lineId: null,
      };
    }),
  );
}

/** Every row the taxonomy could not place, kept and labelled after the six sections (I-266). */
function unclassifiedRowsOf(payload: BoqDraftPayload): BoqRow[] {
  return payload.unclassified.lines.map((line) => ({
    key: line.lineId,
    bill: UNCLASSIFIED,
    class: line.class,
    kind: line.kind,
    heading: descriptionOf(line.class, line.kind),
    // A line the taxonomy could not place is billed under nothing, so nothing was ever chosen for
    // it: its description is the plain one, and it says so (L-BD-08, I-266).
    description: descriptionOf(line.class, line.kind),
    descriptionBasis: DEFAULTED,
    item: null,
    reason: line.reason,
    level: line.level,
    slot: line.slot ?? null,
    levelOrdinal: line.levelOrdinal ?? null,
    quantity: line.quantity,
    unit: line.unit,
    coverage: line.coverage,
    quantityBasis: line.quantityBasis,
    selectionBasis: line.selectionBasis,
    decidedBy: line.decidedBy,
    members: 1,
    qualifier: "",
    omitted: line.quantity === null ? [...new Set(line.omitted ?? [])] : [],
    lineId: line.lineId,
  }));
}

/**
 * Why a kept line was not placed, as a reader reads it: the sentence this screen authored for a
 * registered reason, and — for a reason no table names — the same words the DOCUMENT writes it in
 * (`inWords`, one rule and one home). A code never reaches the page: SCREAMING_SNAKE is machine
 * vocabulary, and this screen puts it only where machines read (R-UI-020, I-265).
 */
function reasonInWords(reason: string | null): string {
  if (reason === null) return "";
  return BOQ_REASON_WORDS[reason] ?? inWords(reason);
}

/** What one row publishes of its own — §7's closed attribute contract, spelled once. */
function rowDataOf(row: BoqRow): Record<string, string> {
  const data: Record<string, string> = {
    "data-bill": row.bill,
    "data-group": `${row.class}:${row.kind}`,
    "data-class": row.class,
    "data-kind": row.kind,
    "data-level": row.level,
    "data-unit": row.unit,
    "data-coverage": row.coverage,
    "data-quantity-basis": row.quantityBasis,
    "data-selection-basis": row.selectionBasis,
    "data-decided-by": row.decidedBy,
    // Where this item's description came from (I-298): a suite reads the basis off the row itself.
    "data-description-basis": row.descriptionBasis,
    // How many member lines the item was summed from — its details of measurement (I-528).
    "data-members": String(row.members),
  };
  if (row.levelOrdinal !== null) data["data-ordinal"] = String(row.levelOrdinal);
  if (row.item !== null) data["data-item"] = row.item;
  // A row that states no figure carries none — never a zero, and never an attribute holding one
  // (L-QTY-02).
  if (row.quantity !== null) data["data-quantity"] = row.quantity;
  if (row.reason !== null) data["data-reason"] = row.reason;
  // A kept line is one register line, so it says which; an item is many and says how many.
  if (row.lineId !== null) data["data-line"] = row.lineId;
  return data;
}

/* ------------------------------------------------------------------------------ the workspace */

export function BoqWorkspace(props: BoqWorkspaceProps) {
  const { chrome, view } = props;
  const ids = chrome.testIds ?? DEFAULT_TEST_IDS;
  const {
    DataTable,
    EmptyState,
    ErrorState,
    RefusalState,
    IdChip,
    EnumLabel,
    BasisChip,
    CoverageChip,
    UnitBadge,
    Skeleton,
    JobTimeline,
    Tooltip,
    Button,
    TabsAside = InPlace,
  } = chrome;
  const doors: Partial<BoqDoors> = props.doors ?? {};
  const tenantId = props.tenantId ?? "";
  const projectId = props.projectId ?? "";
  const reportId = props.reportId ?? null;
  const offline = props.offline ?? false;

  /** The job this screen started and is watching, until the page is left (I-270). */
  const [jobId, setJobId] = useState<string | null>(null);
  /** The artefact the quantities door wrote, where one was asked for — a link, never a run (I-272). */
  const [link, setLink] = useState<BoqQuantitiesLink | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  // A caller that states a refusal outright — R-UI-050's matrix walked one cell at a time — is
  // stating what a door would have answered, so it is rendered exactly as a door's answer is.
  const refused = answered ?? props.refused ?? null;

  const state = boqStateOf({ view, permitted: props.permitted, offline, refused, state: props.state ?? null });
  // I-194's precedent: a denial is the STATE, and a screen standing in it keeps no door open on any
  // other evidence — the primary is absent, never disabled, and the denial is said once in the
  // answer slot over the one registered entry.
  const denied = state === "denied";
  const permitted = (props.permitted ?? true) && !denied;
  const payload = view?.payload ?? null;
  const items = view?.items ?? new Map<string, string>();
  const steps = props.jobs?.steps ?? [];
  const documentId = props.jobs?.documentId ?? null;

  // The two things a press needs, named one by one: keeping the whole props object in the deps would
  // give this callback — and the memoised aside that holds it — a new identity on every render, and a
  // node with a new identity every render sets the frame's slot on every render (see `aside` below).
  const exportDoor = doors.exportDraft;
  const onExportStarted = props.onExportStarted;
  const press = useCallback((): void => {
    if (exportDoor === undefined) return;
    void exportDoor().then(
      (answer) => {
        setJobId(answer.jobId);
        onExportStarted?.(answer.jobId);
      },
      (thrown: unknown) => {
        // A refused door is answered in the one place a refusal is rendered, by its registered code —
        // never a toast and never an improvised sentence (R-UI-020, ARCH-03).
        setAnswered(codeOf(thrown));
      },
    );
  }, [exportDoor, onExportStarted]);

  // The quantities are written while the reader waits and answered as a link, so a press leaves no
  // run to watch: what it leaves is the address of the bytes (I-272). A refusal lands where every
  // other refusal on this screen lands — the one answer slot, by its registered code (R-UI-020).
  const quantitiesDoor = doors.exportQuantities;
  const pressQuantities = useCallback(
    (kind: BoqExportKind): void => {
      if (quantitiesDoor === undefined) return;
      void quantitiesDoor({ kind }).then(
        (answer) => {
          setAnswered(null);
          setLink(answer);
        },
        (thrown: unknown) => {
          setLink(null);
          setAnswered(codeOf(thrown));
        },
      );
    },
    [quantitiesDoor],
  );
  const pressXlsx = useCallback((): void => pressQuantities(XLSX), [pressQuantities]);
  const pressCsv = useCallback((): void => pressQuantities(CSV), [pressQuantities]);

  /* --- the sections: one grid each, in BILLS order, then the unclassified block (I-266) --- */
  const sections = useMemo(() => payload?.sections ?? [], [payload]);
  const unclassified = useMemo(() => (payload === null ? [] : unclassifiedRowsOf(payload)), [payload]);

  /**
   * The width the grid's band is READ at, so the Description column can take what the six fixed
   * columns leave (§1 column 2: "remainder, min 320"). Before the box is measured — the server's
   * paint, a suite without layout — the column stands at its minimum; measuring only ever widens it.
   */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const drawsGrid = state !== "loading" && state !== "error" && !nothingPublished(view);
  useLayoutEffect(() => {
    const box = gridRef.current;
    if (box === null) return;
    const measure = (): void => setGridWidth(box.clientWidth > 0 ? box.clientWidth : null);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, [drawsGrid]);
  const descriptionWidth = descriptionWidthOf(gridWidth);

  /**
   * Why an item states no figure, in the registry's own words — each code its members omitted, once
   * (L-QTY-02, R-UI-020). Read through the one lookup a refusal's words come from; a code the
   * registry does not hold says nothing rather than itself (R-UI-082).
   */
  const refusalOf = doors.refusalOf;
  const reasonsOf = useCallback(
    (row: BoqRow): readonly string[] =>
      row.omitted.flatMap((code) => {
        const entry = refusalOf?.(code);
        return entry === undefined ? [] : [entry.message];
      }),
    [refusalOf],
  );

  const columns = useMemo(
    () => boqColumns({ BasisChip, CoverageChip, EnumLabel, UnitBadge, Tooltip }, false, reasonsOf, descriptionWidth),
    [BasisChip, CoverageChip, EnumLabel, UnitBadge, Tooltip, reasonsOf, descriptionWidth],
  );
  const unclassifiedColumns = useMemo(
    () => boqColumns({ BasisChip, CoverageChip, EnumLabel, UnitBadge, Tooltip }, true, reasonsOf, descriptionWidth),
    [BasisChip, CoverageChip, EnumLabel, UnitBadge, Tooltip, reasonsOf, descriptionWidth],
  );

  // A group row names the TRADE its items stand under and states no figure: its items are several
  // descriptions, and no quantity subtotal crosses descriptions (I-529). No count either —
  // §1: "no parenthesised count".
  // `valueOf` is stated, and states nothing, so the shipped table sums nothing under the heading.
  const group = useMemo<BoqGroup>(() => ({ of: (row: BoqRow) => ({ key: `${row.class}:${row.kind}`, label: row.heading }), valueOf: () => null, showCount: false }), []);

  /**
   * What the draft does not measure, in the same words the document closes on (I-451, I-532):
   * each row of the measurement statement, what it is ABOUT (`notMeasuredAbout`, the document's own
   * rule), over which levels, and why — the registry's own sentence through the one lookup.
   */
  const leftOut = useMemo(
    () =>
      (payload?.notMeasured ?? []).map((row) => ({
        about: notMeasuredAbout(row),
        levels: row.levels,
        why: refusalOf?.(row.cause)?.message ?? inWords(row.cause),
      })),
    [payload, refusalOf],
  );

  const denial = denied ? (doors.refusalOf?.(PERMISSION_NOT_HELD) ?? null) : null;
  const refusal = refused === null ? null : (doors.refusalOf?.(refused) ?? null);

  /**
   * What this surface hangs in the lane's tabs row, MEMOISED ON WHAT IT SHOWS. The slot is state in
   * the frame (`useTakeoffTabsAside`), so a node with a new identity every render would set that
   * state every render, re-render the frame, and re-render this surface — a loop that never idles,
   * which is also a loop no `router.refresh()` can land inside. The register's and the levels'
   * asides are memoised for the same reason (R-UI-030, I-170).
   */
  const aside = useMemo(
    () => (
      <div className="cx-boq-aside">
        {/* While the read is still coming, the two chips stand as their own bones — a reader can tell
            a loading aside from an empty one (§2 Loading). While NO campaign is pinned there is no
            identity to state, so the aside carries the tabs alone rather than an empty chip with a
            live copy control (§1's tabs row, I-112: never a machine hook spelling an empty id). */}
        {state === "loading" ? (
          <>
            <Skeleton className="cx-boq-bone-chip" />
            <Skeleton className="cx-boq-bone-chip" />
          </>
        ) : view === null || payload === null ? null : (
          <>
            <span className="cx-boq-aside-label">{BOQ_COPY.boq_revision_label}</span>
            <IdChip className="cx-boq-revision" data-testid={ids.revision} value={view.setRevisionId ?? ""} />
            <span className="cx-boq-aside-label">{BOQ_COPY.boq_taxonomy_label}</span>
            {/* The taxonomy's version is a family and an edition date (`bill-taxonomy/2026-09-16`); its
                first seven characters (`bill-ta`) are neither, so the chip says the EDITION, which is
                what tells two taxonomies apart — the whole value stays its `data-value`, its tooltip
                and its copy (R-UI-082, §1's `taxonomy 2026-09-16`, I-355). */}
            <IdChip className="cx-boq-taxonomy" data-testid={ids.taxonomyVersion} value={view.taxonomyVersion} short={editionOf(view.taxonomyVersion)} />
            <span className="cx-boq-standing" data-testid={ids.draft} data-state={UNSIGNED}>
              {BOQ_COPY.boq_draft_standing}
            </span>
          </>
        )}
        {permitted && payload !== null ? (
          <Tooltip content={BOQ_COPY.boq_export}>
            <Button
              variant="primary"
              className="cx-boq-export"
              data-testid={ids.export}
              data-permission={MEASURE}
              data-job={jobId ?? undefined}
              aria-disabled={offline || jobId !== null ? "true" : undefined}
              onClick={offline || jobId !== null ? undefined : press}
            >
              {BOQ_COPY.boq_export}
            </Button>
          </Tooltip>
        ) : null}
        {/* The two quantity channels, beside the primary and never in front of it: the draft is what
            this screen is for, and these hand a reader the same lines to work with elsewhere
            (R-TO-070, A-BOQ-XLSX). A press writes the file and answers where it is (I-272). */}
        {permitted && payload !== null ? (
          <>
            <ExportChannel
              Button={Button}
              Tooltip={Tooltip}
              testid={ids.exportXlsx}
              kind={XLSX}
              format={BOQ_COPY.boq_export_format_xlsx}
              hint={BOQ_COPY.boq_export_xlsx_hint}
              offline={offline}
              onPress={pressXlsx}
            />
            <ExportChannel
              Button={Button}
              Tooltip={Tooltip}
              testid={ids.exportCsv}
              kind={CSV}
              format={BOQ_COPY.boq_export_format_csv}
              hint={BOQ_COPY.boq_export_csv_hint}
              offline={offline}
              onPress={pressCsv}
            />
            {link === null ? null : (
              <a className="cx-boq-export-link cx-reticle" data-testid={ids.exportLink} data-kind={link.kind} data-sha256={link.sha256} href={link.url} download>
                {BOQ_COPY.boq_export_link}
              </a>
            )}
          </>
        ) : null}
      </div>
    ),
    [
      Button,
      IdChip,
      Skeleton,
      Tooltip,
      ids.draft,
      ids.export,
      ids.exportCsv,
      ids.exportLink,
      ids.exportXlsx,
      ids.revision,
      ids.taxonomyVersion,
      jobId,
      link,
      offline,
      payload,
      permitted,
      press,
      pressCsv,
      pressXlsx,
      state,
      view,
    ],
  );

  // The empty state teaches from WHERE the reader is (walk-0): with no campaign pinned, the chain
  // starts at the drawing sets; with a campaign pinned that published nothing, Measure ran and could
  // not measure, and the register's Deferred and refused list names why — so that is where it leads.
  const pinned = view !== null && view.campaignId !== null;

  return (
    <div
      className="cx-boq"
      data-testid={ids.screen}
      data-state={state}
      data-campaign={view?.campaignId ?? ""}
      data-coverage={view?.coverage ?? ""}
      data-taxonomy-version={view?.taxonomyVersion ?? ""}
    >
      <TabsAside>{aside}</TabsAside>

      {/* The screen's own name, read and not shown (I-boq-1, s-bbs I-289's rule): the frame prints it
          in the crumb, and the section headings beneath are its h2s, so the page has one h1. */}
      <h1 className="cx-boq-name">{BOQ_COPY.takeoff_nav_boq}</h1>

      {offline ? (
        <p className="cx-boq-offline" role="status">
          {BOQ_COPY.boq_offline}
        </p>
      ) : null}

      {/* The one answer slot: a refused door and the denial, rendered through the one renderer or
          not at all (R-UI-020, B-17). Empty, it draws no box. */}
      <div className="cx-boq-answer" data-testid={ids.answer} aria-live="polite">
        {denial === null ? null : (
          <>
            <RefusalState refusal={denial} evidence={{ href: participantsHref(tenantId, projectId), label: BOQ_COPY.boq_denied_holder }} />
            <p className="cx-boq-denied">{BOQ_COPY.boq_denied_export}</p>
          </>
        )}
        {refusal === null ? null : (
          <RefusalState refusal={refusal} evidence={{ href: registerHref(tenantId, projectId), label: BOQ_COPY.boq_register_link }} />
        )}
      </div>

      {jobId === null ? null : (
        <div className="cx-boq-jobs" data-testid={ids.jobs} data-job={jobId}>
          <JobTimeline heading={BOQ_COPY.boq_jobs_heading} steps={steps} lost={props.jobs?.lost ?? false} />
          {documentId === null ? null : (
            <a
              className="cx-boq-document-link cx-reticle"
              data-testid={ids.documentLink}
              data-document={documentId}
              href={documentsHref(tenantId, projectId)}
            >
              {BOQ_COPY.boq_document_link}
            </a>
          )}
        </div>
      )}

      {state === "loading" ? (
        <div className="cx-boq-grid" data-testid={ids.grid} aria-label={BOQ_COPY.boq_grid_label}>
          <div className="cx-boq-bones">
            <Skeleton className="cx-boq-bone-heading" />
          </div>
          <DataTable
            tableId="s-boq-loading"
            columns={columns}
            data={[]}
            getRowId={(row) => row.key}
            freezeKeyColumn
            loading
            loadingRows={8}
            aria-label={BOQ_COPY.boq_grid_label}
          />
        </div>
      ) : state === "error" ? (
        <ErrorState
          className="cx-boq-error"
          heading={BOQ_COPY.boq_error_heading}
          body={BOQ_COPY.boq_error_body}
          reportId={reportId ?? undefined}
          retryLabel={BOQ_COPY.boq_retry}
          onRetry={doors.retry}
        />
      ) : nothingPublished(view) ? (
        pinned ? (
          <EmptyState className="cx-boq-empty" data-testid={ids.empty} heading={BOQ_COPY.boq_empty_unmeasured_heading} body={BOQ_COPY.boq_empty_unmeasured_body}>
            {/* A pinned campaign that published nothing: Measure ran and could not measure. The
                register's Deferred and refused list names each reason and its fix (MEASURE-REFUSE),
                so the one action leads there, under the words this screen already says it in. */}
            <a className="cx-btn cx-reticle cx-boq-empty-action" data-variant="primary" href={registerHref(tenantId, projectId)}>
              {BOQ_COPY.boq_register_link}
            </a>
          </EmptyState>
        ) : (
          <EmptyState className="cx-boq-empty" data-testid={ids.empty} heading={BOQ_COPY.boq_empty_heading} body={BOQ_COPY.boq_empty_body}>
            {/* No campaign pinned: a draft is read from a pinned campaign, so the chain starts at the
                drawing sets — the address and the word S-Coverage and the register already pair
                (R-UI-050, B-17). */}
            <a className="cx-btn cx-reticle cx-boq-empty-action" data-variant="primary" href={setsHref(tenantId, projectId)}>
              {BOQ_COPY.boq_empty_action}
            </a>
          </EmptyState>
        )
      ) : (
        <>
          {/* I-268: the one status line — how an item's figure is made, and why no figure is stated
              for the project. Silence about a missing figure would be the silence R-UI-020 forbids. */}
          <p className="cx-boq-status" role="status">
            {view?.coverage === COMPLETE ? BOQ_COPY.boq_coverage_complete : BOQ_COPY.boq_coverage_incomplete}
          </p>

          <div className="cx-boq-grid" data-testid={ids.grid} aria-label={BOQ_COPY.boq_grid_label} data-rows-rendered={countOf(payload)} ref={gridRef}>
            {sections.map((section) => {
              const rows = rowsOf(section, items, view?.descriptions);
              // S is the section's ordinal among L-BD-08's SIX, never its position among the sections
              // this campaign happens to fill — the same S the item numbers carry, so a heading and the
              // items beneath it can never state two different sections (AM-14 §2, I-269).
              const ordinal = (BILLS as readonly string[]).indexOf(section.bill) + 1;
              return (
                <section
                  key={section.bill}
                  className="cx-boq-bill"
                  data-testid={ids.bill}
                  data-bill={section.bill}
                  data-ordinal={String(ordinal)}
                  data-rows-rendered={String(rows.length)}
                >
                  <h2 className="cx-boq-bill-heading">
                    <span className="cx-boq-bill-ordinal">{ordinal}</span>
                    {BOQ_SECTION_WORDS[section.bill] ?? section.label}
                  </h2>
                  {/* The section states no quantity of its own: its items are unlike descriptions,
                      and each item is its own figure (I-529). */}
                  <DataTable
                    tableId={`s-boq-${section.bill}`}
                    columns={columns}
                    data={rows}
                    getRowId={(row) => row.key}
                    freezeKeyColumn
                    group={group}
                    rowDataOf={rowDataOf}
                    rowTestId={ids.line}
                    aria-label={`${BOQ_SECTION_WORDS[section.bill] ?? section.label} — ${BOQ_COPY.boq_grid_label}`}
                  />
                </section>
              );
            })}

            {unclassified.length === 0 ? null : (
              <section
                className="cx-boq-bill cx-boq-unclassified"
                data-testid={ids.bill}
                data-bill={UNCLASSIFIED}
                data-rows-rendered={String(unclassified.length)}
              >
                <h2 className="cx-boq-bill-heading">{BOQ_COPY.boq_section_unclassified}</h2>
                {/* A KEPT LINE IS STILL A LINE (L-BD-08, I-266). It is published, it is measured and
                    it is read here — so it carries this screen's row identity like any other, and a
                    reader (or a suite) that asks a section for its rows is answered by every line
                    standing in it. What it does NOT carry is an item number: numbering is the six
                    sections', and a number here would make the kept block a seventh (I-267). */}
                <DataTable
                  tableId="s-boq-unclassified"
                  columns={unclassifiedColumns}
                  data={unclassified}
                  getRowId={(row) => row.key}
                  freezeKeyColumn
                  rowDataOf={rowDataOf}
                  rowTestId={ids.line}
                  aria-label={`${BOQ_COPY.boq_section_unclassified} — ${BOQ_COPY.boq_grid_label}`}
                />
              </section>
            )}

            {/* The draft closes on what it does not measure — the same statement the document's
                closing page and the workbook's sheet state (I-451, I-532). Absent where the
                draft left nothing out: a heading over nothing would be a claim with no content. */}
            {leftOut.length === 0 ? null : (
              <section className="cx-boq-left-out" data-testid={ids.notMeasured ?? DEFAULT_TEST_IDS.notMeasured}>
                <h2 className="cx-boq-bill-heading">{BOQ_COPY.boq_not_measured_heading}</h2>
                <ul className="cx-boq-left-out-list">
                  {leftOut.map((row) => (
                    <li key={`${row.about}\u0000${row.levels}\u0000${row.why}`} className="cx-boq-left-out-row">
                      <span className="cx-boq-left-out-about">{row.about}</span>
                      {row.levels === "" ? null : <span className="cx-boq-left-out-levels">{row.levels}</span>}
                      <span className="cx-boq-left-out-why">{row.why}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** How many rows the draft is drawing, over every section it renders: its items and its kept lines. */
function countOf(payload: BoqDraftPayload | null): string {
  if (payload === null) return "0";
  const inSections = payload.sections.reduce((sum, section) => sum + section.groups.reduce((held, group) => held + group.items.length, 0), 0);
  return String(inSections + payload.unclassified.lines.length);
}

/** The registered code a rejection carries, read off the marker the door left on it (ARCH-03). */
function codeOf(thrown: unknown): string | null {
  const carried = (thrown as { refusalCode?: unknown } | null)?.refusalCode;
  return typeof carried === "string" ? carried : null;
}

/**
 * The seven columns, left to right, at the widths the Decision §1 reads them at. The first column is
 * the frozen key: the item number on an item, and the reason in words on a row outside `BILLS`, which
 * has no number to show and may not be given one (I-267).
 */
function boqColumns(
  chrome: Pick<BoqChrome, "BasisChip" | "CoverageChip" | "EnumLabel" | "UnitBadge" | "Tooltip">,
  unplaced: boolean,
  reasonsOf: (row: BoqRow) => readonly string[],
  descriptionWidth: number,
): BoqColumn[] {
  const { BasisChip, CoverageChip, EnumLabel, UnitBadge, Tooltip } = chrome;
  return [
    {
      id: "item",
      header: BOQ_COPY.boq_col_item,
      size: WIDTH.item,
      meta: unplaced ? undefined : { align: "right" },
      accessorFn: (row) => row.item ?? "",
      cell: ({ row }) =>
        unplaced ? (
          <span className="cx-boq-reason">{reasonInWords(row.original.reason)}</span>
        ) : (
          <span className="cx-boq-item">{row.original.item}</span>
        ),
    },
    {
      id: "description",
      header: BOQ_COPY.boq_col_description,
      // The Description takes the slack (C9's BOQ half): an item's description is the longest thing
      // on its row, and a band left empty after Coverage read as a grid that did not know its width.
      size: descriptionWidth,
      accessorFn: (row) => row.description,
      // The item's full description, in the words the document prints it in — the group's sentence,
      // the member and what selects it (I-528). Where not every member line behind it states
      // a figure, the qualification follows, muted: how much the figure covers and why (I-450).
      // `data-description-basis` says WHERE the sentence came from (I-298). The shipped cell carries
      // the whole text as its tooltip wherever the column clips it (§5 rule 2).
      cell: ({ row }) => (
        <span className="cx-boq-description" data-description-basis={row.original.descriptionBasis}>
          <span className="cx-boq-description-text">{row.original.description}</span>
          {row.original.qualifier === "" ? null : <span className="cx-boq-qualifier">({row.original.qualifier})</span>}
        </span>
      ),
    },
    {
      id: "level",
      header: BOQ_COPY.boq_col_level,
      size: WIDTH.level,
      accessorFn: (row) => (row.level !== "" ? row.level : (row.slot ?? "")),
      // The storey an item is priced at, verbatim; where it has no band, the levels its members stand
      // on — and where they stand on no level at all, the lawful-null slot as WORDS through EnumLabel,
      // never an empty cell (I-boq-1, I-355, R-UI-085).
      cell: ({ row }) =>
        row.original.level !== "" || row.original.slot === null ? (
          <span className="cx-boq-level">{row.original.level}</span>
        ) : (
          <EnumLabel value={row.original.slot} className="cx-boq-slot cx-boq-enum" />
        ),
    },
    {
      id: "quantity",
      header: BOQ_COPY.boq_col_quantity,
      size: WIDTH.quantity,
      meta: { align: "right" },
      accessorFn: (row) => row.quantity ?? "",
      // I-271: the figure a reader reads is the figure the document prints — the register's sum of
      // the item's members, rounded once by the emission (I-528), grouped as the document
      // groups one (L-FMT-01). An item none of whose members states a figure states NO figure, and
      // says so in words, with the registry's own reasons a hover or a focus away (R-UI-020).
      cell: ({ row }) => {
        if (row.original.quantity !== null) return <span className="cx-boq-figure">{formatUserFigure(row.original.quantity)}</span>;
        const said = <span className="cx-boq-unmeasured">{BOQ_COPY.boq_quantity_unmeasured}</span>;
        const reasons = reasonsOf(row.original);
        return reasons.length === 0 ? said : <Tooltip content={reasons.join(" ")}>{said}</Tooltip>;
      },
    },
    {
      id: "unit",
      header: BOQ_COPY.boq_col_unit,
      size: WIDTH.unit,
      accessorFn: (row) => row.unit,
      cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
    },
    {
      id: "basis",
      header: BOQ_COPY.boq_col_basis,
      // Wide enough for the PAIR at its longest — `Measured` beside `Transcribed` — because §6
      // promises a basis is a glyph AND a word, and a column that cuts the second chip mid-word
      // keeps neither.
      size: WIDTH.basis,
      // I-25's pair, in the order it is read: how the quantity was got, then how the object was
      // selected — each the weakest over the item's members (L-QTY-01's roll-up). Each wears R-UI-002's
      // glyph AND its word, so neither carries meaning by colour.
      cell: ({ row }) => (
        <span className="cx-boq-bases">
          <BasisChip basis={row.original.quantityBasis as QuantityBasis} />
          <BasisChip basis={row.original.selectionBasis as QuantityBasis} />
        </span>
      ),
    },
    {
      id: "coverage",
      header: BOQ_COPY.boq_col_coverage,
      size: WIDTH.coverage,
      meta: { align: "right" },
      accessorFn: (row) => row.coverage,
      // An item every member of which measured whole is COMPLETE and its chip says 100 %. An item with
      // a partly declared member has no measured fraction anybody stated, so it wears its standing in
      // WORDS rather than a percentage the chip would invent (L-QTY-07, I-271, I-boq-1).
      cell: ({ row }) =>
        row.original.coverage === COMPLETE ? (
          <CoverageChip value={1} />
        ) : (
          <EnumLabel value={row.original.coverage} label={BOQ_COPY.boq_coverage_partial} className="cx-boq-coverage-partial" />
        ),
    },
  ];
}
