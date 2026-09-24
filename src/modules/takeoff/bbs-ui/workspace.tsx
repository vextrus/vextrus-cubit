"use client";
// S-BBS's workspace (docs/design/s-bbs.md): every bar of the pinned campaign by member and mark,
// each lap standing as its own row beside its bar, and the cutting stock stated beneath them.
//
// Presentational and injected (I-170): every piece of shipped chrome arrives as a renderer declared
// by exactly the props this screen hands it, so a module never reaches the ui layer (ARCH-01) and a
// suite mounts the very components a reader sees.
//
// IT COMPUTES NOTHING (I-bbs-2). Every figure is a stored decimal of `bbsOf`'s document: the row
// carries it verbatim on its `data-*` and the CELL prints it through the one formatter this product
// groups a figure with (`formatUserFigure`, SEAM-FORMAT) — a mass STATED at the fraction length the
// document prints it at (`statedAt`, the PDF's own call), so the screen and the page read one figure.
// No mass is summed here, no length is rounded here, and the member group row carries no subtotal at
// all — the domain's totals are per diameter and per mark, and both stand in the summary beneath the
// grid (B-17).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { RefusalEntry } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import type { JobKind } from "@/core/jobs/kinds";
import { BBS_COMPONENT_SAID, BBS_COPY, fillCopy, membersSaid } from "./copy";
import { BBS_PLACES, bbsRowsOf, bbsSummaryOf, cuttingStandingOf, listed, statedAt, totalCoversOf, type BbsGridRow, type BbsSummaryRow } from "./present";
import { bbsStateOf, nothingScheduled } from "./states";
import type { BbsSheetSelection, BbsTraces, BbsView } from "./view";
// The viewer's address at the entities something cites, spelled once by the Trace (B-17): the pure
// module, which carries no store into this browser component (ARCH-01).
import { selectionAddress } from "@/modules/takeoff/trace/address";

/* ------------------------------------------------------------------ what the screen is handed */

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * The mark on its floor a run of bars belongs to, drawn as the grid's own group row (Decision §1):
 * where it stands, what it is, what it is marked and how many members of it the lines count — and no
 * mass at all (I-bbs-2, I-534).
 *
 * It is a ROW of the one grid rather than a heading above a table of its own, so the whole schedule
 * reads under ONE sticky column band and one frozen key column, and a reader scrolls bars rather than
 * repeated headers (R-UI-080, R-UI-084).
 */
export type BbsMemberRow = {
  readonly component: "MEMBER";
  readonly key: string;
  /** The entry's name: its first member's key (I-534). */
  readonly objectKey: string;
  readonly mark: string;
  readonly class: string;
  readonly level: string | null;
  /** How many members the entry's lines count — the door's own count, carried (I-534). */
  readonly members: number;
  /** Whether its running bars are storey-height runs whose laps are not stated (I-567). */
  readonly notForCutting: boolean;
};

/** One row of the schedule's grid: a member's group row, a bar, or the lap beneath a bar. */
export type BbsTableRow = BbsMemberRow | BbsGridRow;

/** One cell of the schedule's grid, as the shipped DataTable hands one its row. */
type BbsCell = { readonly row: { readonly original: BbsTableRow } };

/** One column of the schedule's grid, as the shipped DataTable takes one. */
type BbsColumn = {
  id: string;
  header: string;
  accessorFn?: (row: BbsTableRow) => string;
  /** The width the column is READ at (Decision §1), never the primitive's 150. */
  size?: number;
  cell: (context: BbsCell) => ReactNode;
  meta?: { align?: "right" };
};

/**
 * THE IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is
 * the one declaration of every test id and a module may not import it, so they arrive as chrome —
 * exactly as `DataTable` and `EnumLabel` do. The defaults below are the registry's own spellings,
 * kept as data rather than as attribute literals so the registry stays the only declaration.
 */
export interface BbsTestIds {
  readonly screen: string;
  readonly answer: string;
  readonly revision: string;
  readonly stock: string;
  readonly grid: string;
  readonly member: string;
  readonly row: string;
  readonly lap: string;
  readonly summary: string;
  readonly summaryRow: string;
  readonly empty: string;
  /** The export door, the job strip a press mounts, and the link a finished render offers (§1). */
  readonly export: string;
  readonly jobs: string;
  readonly documentLink: string;
}

/** The registry's spellings, as this screen falls back to them when a caller hands none. */
const DEFAULT_TEST_IDS: BbsTestIds = Object.freeze({
  screen: "bbs-screen",
  answer: "bbs-answer",
  revision: "bbs-revision",
  stock: "bbs-stock",
  grid: "bbs-grid",
  member: "bbs-member",
  row: "bbs-row",
  lap: "bbs-lap",
  summary: "bbs-summary",
  summaryRow: "bbs-summary-row",
  empty: "bbs-empty",
  export: "bbs-export",
  jobs: "bbs-jobs",
  documentLink: "bbs-document-link",
});

/** One step of the render job, as the shipped timeline reads one (job-timeline I-113). */
export type BbsJobStep = {
  readonly id: string;
  readonly jobId: string | null;
  readonly kind: JobKind;
  readonly status: "queued" | "running" | "succeeded" | "failed" | "refused";
  readonly timing: string | null;
  readonly refusal: RefusalEntry | null;
  readonly faultId: string | null;
  readonly evidence: Evidence;
};

/** What the route knows about the export it is watching, where one is being watched (I-270). */
export type BbsJobs = {
  readonly steps: readonly BbsJobStep[];
  readonly lost?: boolean;
  /** The document the finished render filed, once it exists (Decision §1's job strip). */
  readonly documentId?: string | null;
};

/** The shipped renderers the app layer injects (I-170), each declared by the props it is handed. */
export interface BbsChrome {
  readonly testIds?: BbsTestIds;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: BbsColumn[];
    data: BbsTableRow[];
    getRowId: (row: BbsTableRow, index: number) => string;
    freezeKeyColumn?: boolean;
    rowDataOf?: (row: BbsTableRow, rowId: string) => Readonly<Record<string, string>>;
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
  /**
   * R-UI-022's Trace (I-559): a mass to the members it weighs on their plan, a bar mark to the
   * schedule cells it was read off. `data-member` / `data-bar-key` say which, for a test and a reader.
   */
  readonly EvidenceLink: ComponentType<{
    href: string;
    basis: "DERIVED" | "TRANSCRIBED";
    label: string;
    "data-member"?: string;
    "data-bar-key"?: string;
  }>;
  readonly Skeleton: ComponentType<{ className?: string }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** The `(i)` note the summary's heading carries: the shipped Popover, composed by the app (§1). */
  readonly Note: ComponentType<{ label: string; body: string }>;
  /** The job pattern's timeline, rendered where the render was started (R-UI-024, I-270). */
  readonly JobTimeline: ComponentType<{ heading: string; steps: readonly BbsJobStep[]; lost?: boolean }>;
  /** The shipped Button, for the one primary this screen holds (§1). */
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
  }>;
  /** The lane's own tabs row, filled by the surface standing in it (Direction §3.2). */
  readonly TabsAside?: ComponentType<{ children: ReactNode }>;
}

/** The doors this screen presses, and the one lookup a refusal's words are read through (I-170). */
export interface BbsDoors {
  /** The keyed render job (I-270): one press, one job, however many times it is pressed. */
  readonly exportSchedule?: () => Promise<{ jobId: string; deduplicated: boolean }>;
  readonly refusalOf: (code: string) => RefusalEntry | undefined;
  /** Re-run the read in place — R-UI-050's error cell owns the one door that clears it. */
  readonly retry?: () => void;
}

export interface BbsWorkspaceProps {
  /** The reading, or `null` where it failed — the error cell is a state of this screen (R-UI-050). */
  readonly view: BbsView | null;
  /** The state cell the CALLER has already settled, where it knows one this screen cannot derive. */
  readonly state?: string | null;
  /** Whether this reader holds MEASURE on this project, read server-side (I-bbs-1). */
  readonly permitted?: boolean;
  readonly offline?: boolean;
  /** The fault the read left behind, quoted verbatim beside the retry (B-21). */
  readonly reportId?: string | null;
  /** The code a door answered with, rendered through the one refusal renderer (R-UI-020). */
  readonly refused?: string | null;
  readonly tenantId?: string;
  readonly projectId?: string;
  /** What the route is watching of the export it started, where one is being watched (I-270). */
  readonly jobs?: BbsJobs | null;
  /** Told when a press started a run, so the route can watch it (`useTrackedJobs` is the ui's). */
  readonly onExportStarted?: (jobId: string) => void;
  readonly chrome: BbsChrome;
  readonly doors?: Partial<BbsDoors>;
}

/* --------------------------------------------------------------------------- the vocabulary */

/** The code the screen's own denial renders, off the registry the caller looks it up in. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The permission the one door on this screen moves (L-ACT-03). */
const MEASURE = "MEASURE";

/** The registered code a door's rejection carries, read off the marker the lane put on it. */
function codeOf(thrown: unknown): string {
  const marked = thrown as { refusalCode?: unknown; cause?: { refusalCode?: unknown } } | null;
  const direct = marked?.refusalCode;
  if (typeof direct === "string") return direct;
  const carried = marked?.cause?.refusalCode;
  return typeof carried === "string" ? carried : "";
}

/** What a cell reads where the component it stands for has no such figure (I-bbs-3). */
const NOTHING = "—";


// The addresses this screen links. ARCH-01 bars a module from the app layer where a route builder
// lives, so they are spelled here for this screen and nowhere else in it (Decision §6).
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;
const documentsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/documents`;
const schedulesHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/schedules`;
const levelsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/levels`;

/**
 * The components of a rebar line in words (I-354): the rail's own variable names, said as §3's
 * vocabulary through `EnumLabel`, the raw name beside each under `data-technical`. The words are the
 * copy table's, read by the issued schedule too (`BBS_COMPONENT_SAID`, B-17).
 */
const COMPONENT_SAID: Readonly<Record<string, string>> = BBS_COMPONENT_SAID;

/**
 * Where each omission a partly declared line states is SETTLED, and the words its link says (I-354,
 * R-UI-020: what, why, and where to act). A disagreement over a note, a schedule nothing read, a tie
 * zone the schedule leaves unstated and a lap the edition cannot derive are all settled on the
 * Schedules screen, where the sheets' schedules and notes are read; a storey with no height is
 * settled on the level stack. A code this table does not name is said without a link rather than
 * sent somewhere it is not settled.
 */
const SETTLED_ON: Readonly<Record<string, "schedules" | "levels">> = Object.freeze({
  NOTE_READING_CONTESTED: "schedules",
  REBAR_SCHEDULE_UNREAD: "schedules",
  REBAR_TIE_ZONE_UNSTATED: "schedules",
  DETAILING_ROW_NOT_IN_EDITION: "schedules",
  REBAR_STOREY_RUN_UNSTATED: "levels",
});

/** The words each place's link says — §3's vocabulary, stated in its table and not keyed. */
const OPEN_THE_SCHEDULES = "Open the schedules";
const OPEN_THE_LEVELS = "Open the levels";

/** A node rendered where it stands, for a caller that hands no slot mount (I-209). */
function InPlace({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/**
 * The grid's rows in the order it draws them: each entry's group row — one mark on one floor, with
 * its number of members (I-534) — then the bars and laps standing under it, in the presenter's own
 * order: the entries in the order the document first names them, the rows inside an entry in the
 * document's own (L-REG-04). Nothing is sorted here.
 */
function tableRowsOf(rows: readonly BbsGridRow[], runs: ReadonlySet<string>): BbsTableRow[] {
  const order: string[] = [];
  const byMember = new Map<string, BbsTableRow[]>();
  for (const row of rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) {
      order.push(row.objectKey);
      const member: BbsMemberRow = {
        component: "MEMBER",
        key: `${row.objectKey}|MEMBER`,
        objectKey: row.objectKey,
        mark: row.mark,
        class: row.class,
        level: row.level,
        members: row.members,
        notForCutting: runs.has(row.objectKey),
      };
      byMember.set(row.objectKey, [member, row]);
    } else held.push(row);
  }
  return order.flatMap((objectKey) => byMember.get(objectKey) ?? []);
}

/**
 * What one row publishes of its own — Decision §6's closed attribute contract, spelled once.
 *
 * The row's own test id travels with it, because ONE table draws THREE kinds of row and the
 * primitive's `rowTestId` names one: a member's group row is `bbs-member`, a NET row is `bbs-row`
 * and the lap beneath it is `bbs-lap`, which is what lets a reader — and a read — tell the member
 * from the bar and the bar from the lap without knowing this table's shape.
 */
function rowDataOf(ids: BbsTestIds): (row: BbsTableRow) => Record<string, string> {
  return (row): Record<string, string> => {
    if (row.component === "MEMBER") {
      return {
        "data-testid": ids.member,
        "data-member": row.objectKey,
        "data-members": String(row.members),
        "data-mark": row.mark,
        "data-class": row.class,
        "data-level": row.level ?? "",
        ...(row.notForCutting ? { "data-not-for-cutting": "true" } : {}),
      };
    }
    if (row.component === "LAP") {
      return {
        "data-testid": ids.lap,
        "data-bar-key": row.barKey,
        "data-component": "LAP",
        "data-lap-mm": row.lapMm,
        "data-laps": String(row.lapsPerBar),
        "data-kg": row.kg,
      };
    }
    return {
      "data-testid": ids.row,
      "data-bar-key": row.barKey,
      "data-bar-mark": row.barMark,
      "data-role": row.role,
      "data-diameter": String(row.diameterMm),
      "data-shape": row.shape,
      "data-dims": JSON.stringify(row.dimsMm),
      "data-cutting-raw": row.cuttingRawMm,
      "data-cutting-rounded": row.cuttingRoundedMm,
      "data-cutting-is": row.cuttingIsAdditiveMm,
      "data-pieces": String(row.piecesPerBar),
      "data-bars": row.bars,
      "data-lap-mm": row.lapMm,
      "data-laps": String(row.lapsPerBar),
      "data-kg": row.kg,
      "data-component": "NET",
    };
  };
}

/* ------------------------------------------------------------------------------ the workspace */

export function BbsWorkspace(props: BbsWorkspaceProps) {
  const { chrome, view } = props;
  const ids = chrome.testIds ?? DEFAULT_TEST_IDS;
  const { DataTable, EmptyState, ErrorState, RefusalState, IdChip, EnumLabel, EvidenceLink, Skeleton, Tooltip, Note, JobTimeline, Button, TabsAside = InPlace } = chrome;
  const doors: Partial<BbsDoors> = props.doors ?? {};
  const tenantId = props.tenantId ?? "";
  const projectId = props.projectId ?? "";
  const reportId = props.reportId ?? null;
  const offline = props.offline ?? false;

  /** The job this screen started and is watching, until the page is left (I-270). */
  const [jobId, setJobId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  // A caller that states a refusal outright — R-UI-050's matrix walked one cell at a time — is
  // stating what a door would have answered, so it is rendered exactly as a door's answer is.
  const refused = answered ?? props.refused ?? null;

  const state = bbsStateOf({ view, permitted: props.permitted, offline, refused, state: props.state ?? null });
  const steps = props.jobs?.steps ?? [];
  const documentId = props.jobs?.documentId ?? null;

  // The two things a press needs, named one by one: keeping the whole props object in the deps would
  // give this callback — and the memoised aside that holds it — a new identity on every render, and a
  // node with a new identity every render sets the frame's slot on every render (see `aside` below).
  const exportDoor = doors.exportSchedule;
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
  // I-194's precedent: a denial is the STATE, and a screen standing in it shows no schedule on any
  // other evidence — the grid, the summary and both chips are absent, never emptied.
  const denied = state === "denied";
  const document_ = denied ? null : (view?.document ?? null);

  // Which entries hold storey-height runs and which diameters' cutting stock is therefore withheld —
  // the reading the issued schedule is emitted from too, so the two faces withhold the same lines
  // (I-567, B-17).
  const deferred = view?.deferred;
  const standing = useMemo(() => (document_ === null ? null : cuttingStandingOf(document_, deferred ?? [])), [document_, deferred]);
  const rows = useMemo(() => (document_ === null || standing === null ? [] : tableRowsOf(bbsRowsOf(document_), standing.runs)), [document_, standing]);
  const summary = useMemo(() => (document_ === null || standing === null ? null : bbsSummaryOf(document_, standing.withheld)), [document_, standing]);
  const notInSchedule = useMemo(() => view?.notInSchedule ?? [], [view?.notInSchedule]);
  const totalCovers = useMemo(
    () => (document_ === null ? "" : totalCoversOf(document_, { partial: view?.partial ?? false, omitted: view?.omitted ?? [], notInSchedule: notInSchedule.length })),
    [document_, view?.partial, view?.omitted, notInSchedule],
  );
  const rowData = useMemo(() => rowDataOf(ids), [ids]);

  /**
   * The width the grid's band is READ at, so the Dimensions column can take what the nine fixed
   * columns leave (§1 column 5: "remainder, min 200"). Before the box is measured — the server's
   * paint, a suite without layout — the column stands at its minimum, which fits at every viewport
   * the rubric reads; measuring only ever widens it.
   */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const traces = denied ? undefined : view?.traces;
  const traceTo = useMemo(() => traceAddressesOf(tenantId, projectId, traces), [projectId, tenantId, traces]);
  const columns = useMemo(() => bbsColumns({ EnumLabel, Tooltip, EvidenceLink }, dimensionsWidthOf(gridWidth), traceTo), [EnumLabel, EvidenceLink, Tooltip, gridWidth, traceTo]);

  const denial = denied ? (doors.refusalOf?.(PERMISSION_NOT_HELD) ?? null) : null;
  const refusal = refused === null ? null : (doors.refusalOf?.(refused) ?? null);
  /** The registered entries the partly declared lines name for what they left out, in their order. */
  const refusalOf = doors.refusalOf;
  const omissions = useMemo(
    () =>
      (view?.omitted ?? []).flatMap((omission) => {
        const entry = refusalOf?.(omission.code);
        return entry === undefined ? [] : [{ entry, components: omission.components, settledOn: SETTLED_ON[omission.code] ?? null }];
      }),
    [refusalOf, view?.omitted],
  );
  // I-bbs-1: a reader without MEASURE is denied the whole screen, so the door stands for a permitted
  // reader with a schedule to render and for nobody else — never disabled, absent (R-UI-080).
  const permitted = (props.permitted ?? true) && !denied;

  // A screen with NO READING says so, whatever else it knows about itself. The state cell keeps the
  // Decision §2 precedence its roster declares — an offline reader stands in `offline` — but what is
  // drawn beneath it is the reading this screen actually has: an empty grid under the completeness
  // line would state a completeness nobody read, and the fault the failed read minted would never
  // reach the reader it was minted for (R-UI-050, ARCH-03, B-21).
  const unread = view === null && state !== "loading" && state !== "denied";
  const drawsError = state === "error" || unread;
  const drawsGrid = !drawsError && state !== "loading" && state !== "denied" && !nothingScheduled(view);

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

  /**
   * What the grid ACTUALLY PAINTED, as the shipped table itself states it.
   *
   * A count taken from the model would say `n` however many rows reached the page, which is the
   * assertion the lane forbids (`.count()` on a virtualised table is not an assertion): this reads
   * the one table's own `data-rows-rendered` — the pair the retrying reads wait on — exactly as the
   * documents screen reads the one table it mounts. The model's count stands only until the
   * primitive has stated one of its own.
   */
  const [painted, setPainted] = useState<number | null>(null);
  useEffect(() => {
    const box = gridRef.current;
    if (box === null) return;
    const count = (): void => {
      const stated = Array.from(box.querySelectorAll("[data-rows-rendered]"), (table) => table.getAttribute("data-rows-rendered")).filter(
        (said): said is string => said !== null,
      );
      setPainted(stated.length === 0 ? null : stated.reduce((total, said) => total + Number(said), 0));
    };
    count();
    const watch = new MutationObserver(count);
    watch.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-rows-rendered"] });
    return () => watch.disconnect();
  }, [rows, drawsGrid]);

  /**
   * What this surface hangs in the lane's tabs row, MEMOISED ON WHAT IT SHOWS. The slot is state in
   * the frame (`useTakeoffTabsAside`), so a node with a new identity every render would set that
   * state every render, re-render the frame, and re-render this surface — a loop that never idles
   * (R-UI-030, I-170). The one primary stands here: the export door, which commits nothing — a
   * schedule is unsigned by definition (AM-05, I-270), so a render is a keyed job and not an act.
   */
  const aside = useMemo(
    () => (
      <div className="cx-bbs-aside">
        {state === "loading" ? (
          <>
            <Skeleton className="cx-bbs-bone-chip" />
            <Skeleton className="cx-bbs-bone-chip" />
          </>
        ) : document_ === null || view === null ? null : (
          <>
            <span className="cx-bbs-aside-label">{BBS_COPY.bbs_revision_label}</span>
            <IdChip className="cx-bbs-revision" data-testid={ids.revision} value={view.setRevisionId ?? ""} />
            <span
              className="cx-bbs-stock"
              data-testid={ids.stock}
              data-stock-mm={document_.stockMm}
              data-rounding-mm={String(document_.roundingMm)}
            >
              {/* Both figures carry the unit they are in: a bare `25` beside a `12,000` reads as a
                  count of something rather than as the millimetre tolerance it is (§1, L-FMT-01).
                  The words are the interface's and stand in its face beside `Pinned revision`; only
                  the two FIGURES are model data, and only they are set in mono (R-UI-085, I-354). */}
              {BBS_COPY.bbs_stock_label} <span className="cx-bbs-stock-figure">{formatUserFigure(document_.stockMm)}</span> {BBS_COPY.bbs_unit_mm}
              {" · "}
              {BBS_COPY.bbs_stock_rounding_label} <span className="cx-bbs-stock-figure">{String(document_.roundingMm)}</span> {BBS_COPY.bbs_unit_mm}
            </span>
          </>
        )}
        {permitted && drawsGrid ? (
          <Tooltip content={BBS_COPY.bbs_export}>
            <Button
              variant="primary"
              className="cx-bbs-export"
              data-testid={ids.export}
              data-permission={MEASURE}
              data-job={jobId ?? undefined}
              aria-disabled={offline || jobId !== null ? "true" : undefined}
              onClick={offline || jobId !== null ? undefined : press}
            >
              {BBS_COPY.bbs_export}
            </Button>
          </Tooltip>
        ) : null}
      </div>
    ),
    [Button, IdChip, Skeleton, Tooltip, document_, drawsGrid, ids.export, ids.revision, ids.stock, jobId, offline, permitted, press, state, view],
  );

  return (
    <div className="cx-bbs" data-testid={ids.screen} data-state={state} data-campaign={view?.campaignId ?? ""} data-rows={String(document_?.rows.length ?? 0)}>
      <TabsAside>{aside}</TabsAside>

      {/* The screen's own name. It is read, not shown: the frame prints it in the crumb, and a
          reader who arrives with no frame beside them still lands on a page that has one. */}
      <h1 className="cx-bbs-name">{BBS_COPY.takeoff_nav_bbs}</h1>

      {/* The banner speaks for a schedule that IS here: it says the reading stands as it stood when
          the page loaded. A reader whose read never landed has no such reading, and the error cell
          beneath states what happened instead — so the banner keeps its silence rather than claim a
          schedule nobody has (R-UI-020, B-21). */}
      {offline && !unread ? (
        <p className="cx-bbs-offline" role="status">
          {BBS_COPY.bbs_offline}
        </p>
      ) : null}

      {/* The one answer slot: a refused door, the denial, and the one helper line — everything this
          screen answers about its own reading, said once, in one polite live region (I-bbs-7,
          R-UI-020). Empty, it draws no box. */}
      <div className="cx-bbs-answer" data-testid={ids.answer} aria-live="polite">
        {denial === null ? null : (
          <>
            <RefusalState refusal={denial} evidence={{ href: participantsHref(tenantId, projectId), label: BBS_COPY.bbs_denied_holder }} />
            <p className="cx-bbs-denied">{BBS_COPY.bbs_denied_body}</p>
          </>
        )}
        {refusal === null ? null : (
          <RefusalState refusal={refusal} evidence={{ href: registerHref(tenantId, projectId), label: BBS_COPY.bbs_empty_action }} />
        )}
        {drawsGrid ? (
          <p className="cx-bbs-status" role="status">
            {state === "partial" ? BBS_COPY.bbs_partial : BBS_COPY.bbs_complete}
          </p>
        ) : null}
        {/* What the partly declared lines left out, each in the registry's own words and each once:
            a total beneath a schedule that holds no tie and no lap would otherwise read as the whole
            of the steel (L-QTY-02, L-QTY-07, R-UI-020). */}
        {/* Each line says WHAT is missing first — the line's components in words — then the
            registry's own message for why, then where it is settled, with the registry's remedy a
            hover or a focus away (I-354, R-UI-020). */}
        {drawsGrid && state === "partial" && omissions.length > 0 ? (
          <div className="cx-bbs-omitted">
            <span className="cx-bbs-omitted-label">{BBS_COPY.bbs_partial_omitted}</span>
            <ul className="cx-bbs-omitted-list">
              {omissions.map(({ entry, components, settledOn }) => (
                <li key={entry.code} className="cx-bbs-omitted-line">
                  {components.length === 0 ? null : (
                    <span className="cx-bbs-omitted-what">
                      {components.map((component, at) => (
                        <span key={component}>
                          {at === 0 ? null : <span className="cx-bbs-omitted-separator">{" · "}</span>}
                          <EnumLabel value={component} label={COMPONENT_SAID[component] ?? component} className="cx-bbs-omitted-component" />
                        </span>
                      ))}
                    </span>
                  )}{" "}
                  <span className="cx-bbs-omitted-why">{entry.message}</span>{" "}
                  {settledOn === null ? null : (
                    <Tooltip content={entry.remedy}>
                      <a className="cx-bbs-omitted-where" href={settledOn === "levels" ? levelsHref(tenantId, projectId) : schedulesHref(tenantId, projectId)}>
                        {settledOn === "levels" ? OPEN_THE_LEVELS : OPEN_THE_SCHEDULES}
                      </a>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {/* The steel no line was published for — beam, pile, cap and slab — in the draft BOQ's own
            closing words, so a schedule of column steel is never read as the building's
            (I-569, L-QTY-07). */}
        {drawsGrid && notInSchedule.length > 0 ? (
          <div className="cx-bbs-omitted cx-bbs-not-in-schedule">
            <span className="cx-bbs-omitted-label">{BBS_COPY.bbs_not_in_schedule}</span>
            <ul className="cx-bbs-omitted-list">
              {notInSchedule.map((one) => (
                <li key={`${one.about}|${one.levels}`} className="cx-bbs-omitted-line">
                  <span className="cx-bbs-omitted-what">{one.about}</span>
                  {one.levels === "" ? null : <span className="cx-bbs-omitted-separator">{` · ${one.levels}`}</span>}{" "}
                  <span className="cx-bbs-omitted-why">{one.why}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* The job strip, standing between the answer slot and the grid ONLY while a render this
          screen started is watched (R-UI-024, R-UI-080): the pattern's own timeline, and — once the
          issue is filed — the link to where it stands. Never an empty box at rest. */}
      {jobId === null ? null : (
        <div className="cx-bbs-jobs" data-testid={ids.jobs} data-job={jobId}>
          <JobTimeline heading={BBS_COPY.bbs_jobs_heading} steps={steps} lost={props.jobs?.lost ?? false} />
          {documentId === null ? null : (
            <a className="cx-bbs-document-link cx-reticle" data-testid={ids.documentLink} data-document={documentId} href={documentsHref(tenantId, projectId)}>
              {BBS_COPY.bbs_document_link}
            </a>
          )}
        </div>
      )}

      {state === "loading" ? (
        /* §2's loading posture: the schedule's own shape, boned — the one grid's real header over
           two members' worth of row bones (a group row and eight bars each), and the summary beneath
           over three. A header standing alone above blank rows is indistinguishable from a screen
           that finished and found nothing (R-UI-050). */
        <>
          <div className="cx-bbs-grid" data-testid={ids.grid} aria-label={BBS_COPY.bbs_grid_label} ref={gridRef}>
            <DataTable
              tableId="s-bbs-bars"
              columns={columns}
              data={[]}
              getRowId={(row) => row.key}
              freezeKeyColumn
              loading
              loadingRows={LOADING_ROWS}
              aria-label={BBS_COPY.bbs_grid_label}
            />
          </div>
          <section className="cx-bbs-summary" data-loading="">
            <h2 className="cx-bbs-summary-heading">{BBS_COPY.bbs_summary_heading}</h2>
            <div className="cx-bbs-summary-table" role="table" aria-label={BBS_COPY.bbs_summary_heading}>
              <SummaryHead />
              <div className="cx-bbs-summary-body">
                {LOADING_SUMMARY_ROWS.map((bone) => (
                  <div className="cx-bbs-summary-row" role="row" key={bone}>
                    <Skeleton className="cx-bbs-bone-row" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : drawsError ? (
        <ErrorState
          className="cx-bbs-error"
          heading={BBS_COPY.bbs_error_heading}
          body={BBS_COPY.bbs_error_body}
          reportId={reportId ?? undefined}
          retryLabel={BBS_COPY.bbs_retry}
          onRetry={doors.retry}
        />
      ) : denied ? (
        /* I-194: the denial IS the answer. A reader who may not read this schedule is not also told
           to go and measure one — the empty state's door is one they would be refused at. */
        null
      ) : !drawsGrid ? (
        <EmptyState className="cx-bbs-empty" data-testid={ids.empty} heading={BBS_COPY.bbs_empty_heading} body={BBS_COPY.bbs_empty_body}>
          {/* The one thing to do about a schedule with no bars: a bill of bars is read off a MEASURED
              campaign, and the register is where a campaign is measured (R-UI-050). */}
          <a className="cx-btn cx-reticle cx-bbs-empty-action" data-variant="primary" href={registerHref(tenantId, projectId)}>
            {BBS_COPY.bbs_empty_action}
          </a>
        </EmptyState>
      ) : (
        <>
          <div
            className="cx-bbs-grid"
            data-testid={ids.grid}
            aria-label={BBS_COPY.bbs_grid_label}
            data-rows-rendered={String(painted ?? rows.length)}
            ref={gridRef}
          >
            {/* ONE grid under one sticky column band (§1): each member's group row — where it
                stands, what it is, what it is marked, and no figure at all, because a per-member
                mass would be a second home for a sum nobody stores (I-bbs-2, B-17) — then its bars,
                each lap beneath its bar. */}
            <DataTable
              tableId="s-bbs-bars"
              columns={columns}
              data={rows}
              getRowId={(row) => row.key}
              freezeKeyColumn
              rowDataOf={rowData}
              rowTestId={ids.row}
              aria-label={BBS_COPY.bbs_grid_label}
            />
          </div>

          {summary === null ? null : (
            <section className="cx-bbs-summary" data-testid={ids.summary} data-kg={summary.grandTotalKg}>
              <h2 className="cx-bbs-summary-heading">
                {BBS_COPY.bbs_summary_heading}
                {/* The trigger is named for what it does, not for the section it stands in: a button
                    whose name repeats the heading reads that heading twice (R-UI-012). */}
                <Note label={BBS_COPY.bbs_stock_note_label} body={BBS_COPY.bbs_stock_note} />
              </h2>
              <div className="cx-bbs-summary-table" role="table" aria-label={BBS_COPY.bbs_summary_heading}>
                <SummaryHead />
                <div className="cx-bbs-summary-body">
                  {summary.rows.map((line) => (
                    <SummaryRow key={line.diameterMm} line={line} testId={ids.summaryRow} />
                  ))}
                </div>
                <div className="cx-bbs-summary-total" role="row">
                  <span role="cell">{BBS_COPY.bbs_summary_total}</span>
                  <span className="cx-bbs-figure" role="cell">
                    {massOf(summary.grandTotalKg)}
                  </span>
                  {/* A total over less than the whole of the steel says what it covers beside the figure
                      — `Column main bars only — laps and ties not counted` — the L-QTY-07 rule the
                      draft's sections already keep (I-bbs-9, I-567). */}
                  <span role="cell" className="cx-bbs-summary-scope">
                    {totalCovers === "" ? null : totalCovers}
                  </span>
                  <span role="cell" />
                  <span role="cell" />
                </div>
              </div>
              {standing === null || standing.withheld.length === 0 ? null : (
                <p className="cx-bbs-stock-withheld-note" role="note">
                  {fillCopy("bbs_stock_withheld_note", { diameters: listed(standing.withheld.map((diameter) => formatUserFigure(String(diameter)))) })}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Where a cell's Trace goes: the member's plan for a mass, the schedule's cells for a bar mark. */
type TraceTo = {
  readonly member: (objectKey: string) => string | null;
  readonly bar: (barKey: string) => string | null;
};

/**
 * The two Trace addresses a schedule's cells are offered (I-559), composed by the one spelling of
 * the viewer's address (`selectionAddress`) over what the server resolved. An entry or a bar the
 * server resolved nothing for answers null, and its cell states the figure unlinked.
 */
function traceAddressesOf(tenantId: string, projectId: string, traces: BbsTraces | undefined): TraceTo {
  const at = (selection: BbsSheetSelection | undefined): string | null =>
    selection === undefined || selection.sourceKeys.length === 0 || tenantId === "" || projectId === "" ? null : selectionAddress(tenantId, projectId, selection);
  return {
    member: (objectKey) => at(traces?.members[objectKey]),
    bar: (barKey) => at(traces?.bars[barKey]),
  };
}

/** A mass is DERIVED — worked from the schedule's bars and the edition — and a bar mark TRANSCRIBED. */
const MASS_BASIS = "DERIVED" as const;
const MARK_BASIS = "TRANSCRIBED" as const;

/** The loading posture's bones (§2): two members' worth of rows — a group row and eight bars each —
    and three lines of the summary beneath. */
const LOADING_ROWS = 18;
const LOADING_SUMMARY_ROWS = Object.freeze(["a", "b", "c"]);

/**
 * A mass as this schedule STATES it: the stored decimal written at the fraction length the document
 * prints a mass at (`BBS_PLACES.mass`, the call `emission.ts` makes for the PDF), then grouped by the
 * one formatter. The attribute beside it keeps the stored decimal (I-bbs-2, B-17).
 */
function massOf(kg: string): string {
  return kg === "" ? NOTHING : formatUserFigure(statedAt(kg, BBS_PLACES.mass));
}

/** The cutting-stock summary's column band — one spelling, read by the summary and by its bones. */
function SummaryHead() {
  return (
    <div className="cx-bbs-summary-head" role="row">
      <span role="columnheader">{BBS_COPY.bbs_summary_col_diameter}</span>
      <span role="columnheader">{BBS_COPY.bbs_summary_col_kg}</span>
      <span role="columnheader">{BBS_COPY.bbs_summary_col_stock_bars}</span>
      <span role="columnheader">{BBS_COPY.bbs_summary_col_pieces}</span>
      <span role="columnheader">{BBS_COPY.bbs_summary_col_offcut}</span>
    </div>
  );
}

/** One line of the cutting-stock summary: the door's own answer for one diameter (AM-03(e)). */
function SummaryRow({ line, testId }: { line: BbsSummaryRow; testId: string }) {
  return (
    <div
      className="cx-bbs-summary-row"
      role="row"
      data-testid={testId}
      data-diameter={String(line.diameterMm)}
      data-kg={line.kg}
      data-stock-bars={String(line.stockBars)}
      data-pieces={String(line.pieces)}
      data-offcut-mm={line.offcutMm}
      {...(line.withheld ? { "data-withheld": "true" } : {})}
    >
      <span className="cx-bbs-figure" role="cell">
        {String(line.diameterMm)}
      </span>
      <span className="cx-bbs-figure" role="cell">
        {massOf(line.kg)}
      </span>
      {/* A diameter whose bars include runs nobody can cut says so across its packing cells, in
          words, rather than printing a cutting plan (I-567). */}
      {line.withheld ? (
        <span className="cx-bbs-stock-withheld" role="cell">
          {BBS_COPY.bbs_stock_withheld}
        </span>
      ) : (
        <>
          <span className="cx-bbs-figure" role="cell">
            {formatUserFigure(String(line.stockBars))}
          </span>
          <span className="cx-bbs-figure" role="cell">
            {formatUserFigure(String(line.pieces))}
          </span>
          <span className="cx-bbs-figure" role="cell">
            {formatUserFigure(line.offcutM)}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The nine columns read at a fixed width, and the least the Dimensions column is read at (§1's
 * column table). The fixed widths are the headers' own: a right-aligned header is set in the figure
 * face, and `Cutting length (mm)` in that face does not fit the 128 it was first given — a header
 * that wraps is the no-wrap law broken in the grid's most-read row (R-UI-084).
 */
const WIDTH = Object.freeze({ mark: 104, role: 88, shape: 72, diameter: 112, cuttingRaw: 160, cuttingRounded: 104, cuttingIs: 136, bars: 72, kg: 112 });
const DIMENSIONS_MIN = 200;
/** What the fixed nine take together. */
const FIXED_WIDTH = Object.values(WIDTH).reduce((sum, width) => sum + width, 0);
/**
 * What the band keeps clear at its trailing edge: the DataTable's `⋯` stands over the header's last
 * `--row-h` (28 px compact, 36 comfortable), and the last column's 24 px resize target has to stand
 * clear of it (SC 2.5.8). Filled to within 16 px of the edge, `Mass`'s handle kept 12 px and axe
 * called it serious (session 7). 40 covers the comfortable ⋯ on the 4 px grid and a vertical scroller.
 */
const TRAILING_ALLOWANCE = 40;
/** Widths stay on the 4 px grid the rest of the screen stands on (§1). */
const GRID_STEP = 4;

/**
 * The Dimensions column's width: what the grid's band leaves once the nine fixed columns have their
 * widths, on the 4 px grid, and never less than its minimum (§1 column 5, "remainder, min 200").
 */
function dimensionsWidthOf(gridWidth: number | null): number {
  if (gridWidth === null) return DIMENSIONS_MIN;
  const left = gridWidth - FIXED_WIDTH - TRAILING_ALLOWANCE;
  return Math.max(DIMENSIONS_MIN, Math.floor(left / GRID_STEP) * GRID_STEP);
}

/**
 * The ten columns, left to right, at the widths Decision §1 reads them at. The first is the frozen
 * key: the bar mark on a bar, the word `Lap` on the lap beneath it — which is the one place this
 * screen says in words what `data-component` says in machine vocabulary (I-bbs-3, R-UI-082) — and,
 * on a member's group row, where the member stands, what it is and its mark, read across the row.
 * Every other cell of a group row is empty: the row carries no figure (I-bbs-2).
 */
function bbsColumns(chrome: Pick<BbsChrome, "EnumLabel" | "Tooltip" | "EvidenceLink">, dimensionsWidth: number, traceTo: TraceTo): BbsColumn[] {
  const { EnumLabel, Tooltip, EvidenceLink } = chrome;
  /** A stored decimal as a reader reads it: grouped lakh/crore, by the one formatter (SEAM-FORMAT). */
  const printed = (value: string): string => (value === "" ? NOTHING : formatUserFigure(value));
  /** A bar or a lap's own cell; a member's group row states none of them. */
  const bar = (render: (row: BbsGridRow) => ReactNode) =>
    ({ row }: BbsCell): ReactNode => (row.original.component === "MEMBER" ? null : render(row.original));
  const barText = (read: (row: BbsGridRow) => string) => (row: BbsTableRow): string => (row.component === "MEMBER" ? "" : read(row));
  return [
    {
      id: "mark",
      header: BBS_COPY.bbs_col_mark,
      size: WIDTH.mark,
      accessorFn: (row) => (row.component === "MEMBER" ? row.mark : row.barMark),
      cell: ({ row }) => {
        const held = row.original;
        if (held.component === "MEMBER") {
          return (
            <span className="cx-bbs-member">
              {held.level === null || held.level === "" ? null : (
                <>
                  <span className="cx-bbs-member-level">{held.level}</span>
                  <span className="cx-bbs-member-separator">{" · "}</span>
                </>
              )}
              <EnumLabel value={held.class} className="cx-bbs-enum" />
              <span className="cx-bbs-member-separator">{" · "}</span>
              <span className="cx-bbs-member-mark">{held.mark}</span>
              <span className="cx-bbs-member-separator">{" · "}</span>
              {/* BS 8666's "No. of members": the mark is stated once on this floor, and the count
                  says how many members its lines stand for (I-534). */}
              <span className="cx-bbs-member-count">{membersSaid(held.members, formatUserFigure(String(held.members)))}</span>
              {held.notForCutting ? (
                <>
                  <span className="cx-bbs-member-separator">{" · "}</span>
                  <Tooltip content={BBS_COPY.bbs_run_tooltip}>
                    <span className="cx-bbs-member-run">{BBS_COPY.bbs_run_label}</span>
                  </Tooltip>
                </>
              ) : null}
            </span>
          );
        }
        return held.component === "LAP" ? (
          <Tooltip content={BBS_COPY.bbs_lap_tooltip}>
            <span className="cx-bbs-lap-label">{BBS_COPY.bbs_lap_label}</span>
          </Tooltip>
        ) : (
          <BarMark row={held} href={traceTo.bar(held.barKey)} EvidenceLink={EvidenceLink} />
        );
      },
    },
    {
      id: "role",
      header: BBS_COPY.bbs_col_role,
      size: WIDTH.role,
      accessorFn: barText((row) => row.role),
      cell: bar((row) => (row.component === "LAP" ? <span className="cx-bbs-nothing">{NOTHING}</span> : <EnumLabel value={row.role} className="cx-bbs-enum" />)),
    },
    {
      id: "shape",
      header: BBS_COPY.bbs_col_shape,
      size: WIDTH.shape,
      accessorFn: barText((row) => row.shape),
      // A BS 8666 code is the domain's own name for the shape, so it is rendered as the code it is,
      // in the technical face — never as English somebody invented for it (I-bbs-6, R-UI-082).
      cell: bar((row) =>
        row.component === "LAP" ? (
          <span className="cx-bbs-nothing">{NOTHING}</span>
        ) : (
          <span className="cx-bbs-shape" data-technical="">
            {row.shape}
          </span>
        ),
      ),
    },
    {
      id: "diameter",
      header: BBS_COPY.bbs_col_diameter,
      size: WIDTH.diameter,
      meta: { align: "right" },
      accessorFn: barText((row) => String(row.diameterMm)),
      cell: bar((row) => <span className="cx-bbs-figure">{String(row.diameterMm)}</span>),
    },
    {
      id: "dims",
      header: BBS_COPY.bbs_col_dims,
      // The REMAINDER column (§1's column table: "remainder, min 200"). The nine figure and code
      // columns are read at fixed widths, so what is left of the grid's band belongs to the legs —
      // the one cell that truncates — rather than standing empty to the right of the last mass, and
      // never so much that the Mass column is pushed off a 1280 screen.
      size: dimensionsWidth,
      accessorFn: barText((row) => Object.keys(row.dimsMm).join(" ")),
      cell: bar((row) => <span className="cx-bbs-dims">{dimensionsOf(row)}</span>),
    },
    {
      id: "cuttingRaw",
      header: BBS_COPY.bbs_col_cutting_raw,
      size: WIDTH.cuttingRaw,
      meta: { align: "right" },
      accessorFn: barText((row) => row.cuttingRawMm),
      // As stored, never re-rounded: the raw BS 8666 length is the one figure this product never
      // touches, and what it crosses here is the formatter's grouping alone (L-FRM-05, I-bbs-4).
      cell: bar((row) => <span className="cx-bbs-figure">{printed(row.cuttingRawMm)}</span>),
    },
    {
      id: "cuttingRounded",
      header: BBS_COPY.bbs_col_cutting_rounded,
      size: WIDTH.cuttingRounded,
      meta: { align: "right" },
      accessorFn: barText((row) => row.cuttingRoundedMm),
      cell: bar((row) => <span className="cx-bbs-figure">{printed(row.cuttingRoundedMm)}</span>),
    },
    {
      id: "cuttingIs",
      header: BBS_COPY.bbs_col_cutting_is,
      size: WIDTH.cuttingIs,
      meta: { align: "right" },
      accessorFn: barText((row) => row.cuttingIsAdditiveMm),
      cell: bar((row) => <span className="cx-bbs-figure">{printed(row.cuttingIsAdditiveMm)}</span>),
    },
    {
      id: "bars",
      header: BBS_COPY.bbs_col_bars,
      size: WIDTH.bars,
      meta: { align: "right" },
      accessorFn: barText((row) => row.bars),
      // The TOTAL a site cuts. Where the line counts several members, what ONE takes is a hover or a
      // focus away — BS 8666's "No. in each", which the count on the group row multiplies (I-534).
      cell: bar((row) =>
        row.component === "NET" && row.members > 1 ? (
          <Tooltip content={fillCopy("bbs_bars_each", { each: formatUserFigure(String(row.barsPerUnit)), count: formatUserFigure(String(row.members)) })}>
            <span className="cx-bbs-figure">{printed(row.bars)}</span>
          </Tooltip>
        ) : (
          <span className="cx-bbs-figure">{printed(row.bars)}</span>
        ),
      ),
    },
    {
      id: "kg",
      header: BBS_COPY.bbs_col_kg,
      size: WIDTH.kg,
      meta: { align: "right" },
      accessorFn: barText((row) => row.kg),
      // Stated at the gramme the document prints a mass at, so the figure a reader reads here is
      // the figure the issued schedule prints (I-bbs-2); `data-kg` keeps the stored decimal.
      // I-559: the mass flies to the members it weighs, on their plan — a figure the reader can
      // check against the member it came from. Where nothing resolved, the figure stands unlinked.
      cell: bar((row) => {
        const href = row.kg === "" ? null : traceTo.member(row.objectKey);
        return href === null ? (
          <span className="cx-bbs-figure">{massOf(row.kg)}</span>
        ) : (
          <span className="cx-bbs-figure">
            <EvidenceLink href={href} basis={MASS_BASIS} label={massOf(row.kg)} data-member={row.objectKey} />
          </span>
        );
      }),
    },
  ];
}

/** A bar's mark, as the Trace to the schedule cells it was read off where they resolved (I-559). */
function BarMark({ row, href, EvidenceLink }: { row: BbsGridRow; href: string | null; EvidenceLink: BbsChrome["EvidenceLink"] }) {
  return href === null ? (
    <span className="cx-bbs-mark">{row.barMark}</span>
  ) : (
    <span className="cx-bbs-mark">
      <EvidenceLink href={href} basis={MARK_BASIS} label={row.barMark} data-bar-key={row.barKey} />
    </span>
  );
}

/** The legs a bar is dimensioned by, or the lap's own length on the row beneath it (I-bbs-3). */
function dimensionsOf(row: BbsGridRow): string {
  if (row.component === "LAP") return `${BBS_COPY.bbs_lap_label} ${formatUserFigure(row.lapMm)} ${BBS_COPY.bbs_unit_mm}`;
  return Object.entries(row.dimsMm)
    .map(([letter, value]) => `${letter} ${formatUserFigure(value)}`)
    .join(" · ");
}
