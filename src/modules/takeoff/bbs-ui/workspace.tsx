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
// groups a figure with (`formatUserFigure`, SEAM-FORMAT). No mass is summed here, no length is
// rounded here, and the member group row carries no subtotal at all — the domain's totals are per
// diameter and per mark, and both stand in the summary beneath the grid (B-17).
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { RefusalEntry } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { BBS_COPY } from "./copy";
import { bbsRowsOf, bbsSummaryOf, type BbsGridRow, type BbsSummaryRow } from "./present";
import { bbsStateOf, nothingScheduled } from "./states";
import type { BbsView } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/** One cell of the schedule's grid, as the shipped DataTable hands one its row. */
type BbsCell = { readonly row: { readonly original: BbsGridRow } };

/** One column of the schedule's grid, as the shipped DataTable takes one. */
type BbsColumn = {
  id: string;
  header: string;
  accessorFn?: (row: BbsGridRow) => string;
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
});

/** The shipped renderers the app layer injects (I-170), each declared by the props it is handed. */
export interface BbsChrome {
  readonly testIds?: BbsTestIds;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: BbsColumn[];
    data: BbsGridRow[];
    getRowId: (row: BbsGridRow, index: number) => string;
    freezeKeyColumn?: boolean;
    rowDataOf?: (row: BbsGridRow, rowId: string) => Readonly<Record<string, string>>;
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
  readonly Skeleton: ComponentType<{ className?: string }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** The `(i)` note the summary's heading carries: the shipped Popover, composed by the app (§1). */
  readonly Note: ComponentType<{ label: string; body: string }>;
  /** The lane's own tabs row, filled by the surface standing in it (Direction §3.2). */
  readonly TabsAside?: ComponentType<{ children: ReactNode }>;
}

/** The one lookup a refusal's words are read through, and the one door the error cell owns. */
export interface BbsDoors {
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
  readonly chrome: BbsChrome;
  readonly doors?: Partial<BbsDoors>;
}

/* --------------------------------------------------------------------------- the vocabulary */

/** The code the screen's own denial renders, off the registry the caller looks it up in. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** What a cell reads where the component it stands for has no such figure (I-bbs-3). */
const NOTHING = "—";


// The addresses this screen links. ARCH-01 bars a module from the app layer where a route builder
// lives, so they are spelled here for this screen and nowhere else in it (Decision §6).
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;

/** A node rendered where it stands, for a caller that hands no slot mount (I-209). */
function InPlace({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/** One member of the schedule: what it is, and the rows standing under it. */
type BbsMemberBlock = {
  readonly objectKey: string;
  readonly mark: string;
  readonly class: string;
  readonly level: string | null;
  readonly rows: BbsGridRow[];
};

/** The grid's rows gathered under the member each belongs to, in the presenter's own order. */
function membersOf(rows: readonly BbsGridRow[]): BbsMemberBlock[] {
  const order: string[] = [];
  const byMember = new Map<string, BbsMemberBlock>();
  for (const row of rows) {
    const held = byMember.get(row.objectKey);
    if (held === undefined) {
      order.push(row.objectKey);
      byMember.set(row.objectKey, { objectKey: row.objectKey, mark: row.mark, class: row.class, level: row.level, rows: [row] });
    } else held.rows.push(row);
  }
  return order.map((objectKey) => byMember.get(objectKey) as BbsMemberBlock);
}

/**
 * What one row publishes of its own — Decision §6's closed attribute contract, spelled once.
 *
 * The row's own test id travels with it, because ONE table draws TWO components and the primitive's
 * `rowTestId` names one: a NET row is `bbs-row` and the lap beneath it is `bbs-lap`, which is what
 * lets a reader — and a read — tell the bar from the lap without knowing this table's shape.
 */
function rowDataOf(ids: BbsTestIds): (row: BbsGridRow) => Record<string, string> {
  return (row): Record<string, string> => {
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
  const { DataTable, EmptyState, ErrorState, RefusalState, IdChip, EnumLabel, Skeleton, Tooltip, Note, TabsAside = InPlace } = chrome;
  const doors: Partial<BbsDoors> = props.doors ?? {};
  const tenantId = props.tenantId ?? "";
  const projectId = props.projectId ?? "";
  const reportId = props.reportId ?? null;
  const offline = props.offline ?? false;
  const refused = props.refused ?? null;

  const state = bbsStateOf({ view, permitted: props.permitted, offline, refused, state: props.state ?? null });
  // I-194's precedent: a denial is the STATE, and a screen standing in it shows no schedule on any
  // other evidence — the grid, the summary and both chips are absent, never emptied.
  const denied = state === "denied";
  const document_ = denied ? null : (view?.document ?? null);

  const rows = useMemo(() => (document_ === null ? [] : bbsRowsOf(document_)), [document_]);
  const members = useMemo(() => membersOf(rows), [rows]);
  const summary = useMemo(() => (document_ === null ? null : bbsSummaryOf(document_)), [document_]);
  const columns = useMemo(() => bbsColumns({ EnumLabel, Tooltip }), [EnumLabel, Tooltip]);
  const rowData = useMemo(() => rowDataOf(ids), [ids]);

  const denial = denied ? (doors.refusalOf?.(PERMISSION_NOT_HELD) ?? null) : null;
  const refusal = refused === null ? null : (doors.refusalOf?.(refused) ?? null);

  // A screen with NO READING says so, whatever else it knows about itself. The state cell keeps the
  // Decision §2 precedence its roster declares — an offline reader stands in `offline` — but what is
  // drawn beneath it is the reading this screen actually has: an empty grid under the completeness
  // line would state a completeness nobody read, and the fault the failed read minted would never
  // reach the reader it was minted for (R-UI-050, ARCH-03, B-21).
  const unread = view === null && state !== "loading" && state !== "denied";
  const drawsError = state === "error" || unread;
  const drawsGrid = !drawsError && state !== "loading" && state !== "denied" && !nothingScheduled(view);

  /**
   * What the grid ACTUALLY PAINTED, as the shipped table itself states it.
   *
   * A count taken from the model would say `n` however many rows reached the page, which is the
   * assertion the lane forbids (`.count()` on a virtualised table is not an assertion): this reads
   * each member table's own `data-rows-rendered` — the pair the retrying reads wait on — and sums
   * them, exactly as the documents screen reads the one table it mounts. The model's count stands
   * only until the primitive has stated one of its own.
   */
  const gridRef = useRef<HTMLDivElement | null>(null);
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
   * (R-UI-030, I-170). There is no primary here: nothing on this screen commits.
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
                  count of something rather than as the millimetre tolerance it is (§1, L-FMT-01). */}
              {`${BBS_COPY.bbs_stock_label} ${formatUserFigure(document_.stockMm)} ${BBS_COPY.bbs_unit_mm} · ${BBS_COPY.bbs_stock_rounding_label} ${String(document_.roundingMm)} ${BBS_COPY.bbs_unit_mm}`}
            </span>
          </>
        )}
      </div>
    ),
    [IdChip, Skeleton, document_, ids.revision, ids.stock, state, view],
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
      </div>

      {state === "loading" ? (
        /* §2's loading posture: the schedule's own shape, boned — two member blocks over eight row
           bones each, and the summary beneath them over three. A header standing alone above blank
           rows is indistinguishable from a screen that finished and found nothing (R-UI-050). */
        <>
          <div className="cx-bbs-grid" data-testid={ids.grid} aria-label={BBS_COPY.bbs_grid_label}>
            {LOADING_MEMBERS.map((bone) => (
              <section key={bone} className="cx-bbs-member-block">
                <Skeleton className="cx-bbs-bone-member" />
                <DataTable
                  tableId={`s-bbs-loading-${bone}`}
                  columns={columns}
                  data={[]}
                  getRowId={(row) => row.key}
                  freezeKeyColumn
                  loading
                  loadingRows={8}
                  aria-label={BBS_COPY.bbs_grid_label}
                />
              </section>
            ))}
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
            {members.map((member) => (
              <section key={member.objectKey} className="cx-bbs-member-block">
                {/* The member group row: where it stands, what it is, what it is marked — and no
                    figure at all. A per-member mass would be a second home for a sum nobody stores
                    (I-bbs-2, B-17). */}
                <h2
                  className="cx-bbs-member"
                  data-testid={ids.member}
                  data-member={member.objectKey}
                  data-mark={member.mark}
                  data-class={member.class}
                  data-level={member.level ?? ""}
                >
                  <span className="cx-bbs-member-level">{member.level ?? ""}</span>
                  <EnumLabel value={member.class} className="cx-bbs-enum" />
                  <span className="cx-bbs-member-mark">{member.mark}</span>
                </h2>
                <DataTable
                  tableId={`s-bbs-bars-${member.objectKey}`}
                  columns={columns}
                  data={member.rows}
                  getRowId={(row) => row.key}
                  freezeKeyColumn
                  rowDataOf={rowData}
                  rowTestId={ids.row}
                  aria-label={`${member.mark} — ${BBS_COPY.bbs_grid_label}`}
                />
              </section>
            ))}
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
                    {formatUserFigure(summary.grandTotalKg)}
                  </span>
                  <span role="cell" />
                  <span role="cell" />
                  <span role="cell" />
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** The two member blocks the loading posture bones, and the three lines its summary bones (§2). */
const LOADING_MEMBERS = Object.freeze(["a", "b"]);
const LOADING_SUMMARY_ROWS = Object.freeze(["a", "b", "c"]);

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
    >
      <span className="cx-bbs-figure" role="cell">
        {String(line.diameterMm)}
      </span>
      <span className="cx-bbs-figure" role="cell">
        {formatUserFigure(line.kg)}
      </span>
      <span className="cx-bbs-figure" role="cell">
        {formatUserFigure(String(line.stockBars))}
      </span>
      <span className="cx-bbs-figure" role="cell">
        {formatUserFigure(String(line.pieces))}
      </span>
      <span className="cx-bbs-figure" role="cell">
        {formatUserFigure(line.offcutMm)}
      </span>
    </div>
  );
}

/**
 * The ten columns, left to right, at the widths Decision §1 reads them at. The first is the frozen
 * key: the bar mark on a bar, and the word `Lap` on the lap beneath it — which is the one place this
 * screen says in words what `data-component` says in machine vocabulary (I-bbs-3, R-UI-082).
 */
function bbsColumns(chrome: Pick<BbsChrome, "EnumLabel" | "Tooltip">): BbsColumn[] {
  const { EnumLabel, Tooltip } = chrome;
  const lap = (row: BbsGridRow): boolean => row.component === "LAP";
  /** A stored decimal as a reader reads it: grouped lakh/crore, by the one formatter (SEAM-FORMAT). */
  const printed = (value: string): string => (value === "" ? NOTHING : formatUserFigure(value));
  return [
    {
      id: "mark",
      header: BBS_COPY.bbs_col_mark,
      size: 112,
      accessorFn: (row) => row.barMark,
      cell: ({ row }) =>
        lap(row.original) ? (
          <Tooltip content={BBS_COPY.bbs_lap_tooltip}>
            <span className="cx-bbs-lap-label">{BBS_COPY.bbs_lap_label}</span>
          </Tooltip>
        ) : (
          <span className="cx-bbs-mark">{row.original.barMark}</span>
        ),
    },
    {
      id: "role",
      header: BBS_COPY.bbs_col_role,
      size: 96,
      accessorFn: (row) => row.role,
      cell: ({ row }) => (lap(row.original) ? <span className="cx-bbs-nothing">{NOTHING}</span> : <EnumLabel value={row.original.role} className="cx-bbs-enum" />),
    },
    {
      id: "shape",
      header: BBS_COPY.bbs_col_shape,
      size: 72,
      accessorFn: (row) => row.shape,
      // A BS 8666 code is the domain's own name for the shape, so it is rendered as the code it is,
      // in the technical face — never as English somebody invented for it (I-bbs-6, R-UI-082).
      cell: ({ row }) =>
        lap(row.original) ? (
          <span className="cx-bbs-nothing">{NOTHING}</span>
        ) : (
          <span className="cx-bbs-shape" data-technical="">
            {row.original.shape}
          </span>
        ),
    },
    {
      id: "diameter",
      header: BBS_COPY.bbs_col_diameter,
      size: 88,
      meta: { align: "right" },
      accessorFn: (row) => String(row.diameterMm),
      cell: ({ row }) => <span className="cx-bbs-figure">{String(row.original.diameterMm)}</span>,
    },
    {
      id: "dims",
      header: BBS_COPY.bbs_col_dims,
      // The REMAINDER column (§1's column table: "remainder, min 200"). The nine figure and code
      // columns are read at fixed widths, so what is left of the grid's band belongs to the legs —
      // the one cell that truncates — rather than standing empty to the right of the last mass.
      size: 400,
      accessorFn: (row) => Object.keys(row.dimsMm).join(" "),
      cell: ({ row }) => <span className="cx-bbs-dims">{dimensionsOf(row.original)}</span>,
    },
    {
      id: "cuttingRaw",
      header: BBS_COPY.bbs_col_cutting_raw,
      size: 128,
      meta: { align: "right" },
      accessorFn: (row) => row.cuttingRawMm,
      // As stored, never re-rounded: the raw BS 8666 length is the one figure this product never
      // touches, and what it crosses here is the formatter's grouping alone (L-FRM-05, I-bbs-4).
      cell: ({ row }) => <span className="cx-bbs-figure">{printed(row.original.cuttingRawMm)}</span>,
    },
    {
      id: "cuttingRounded",
      header: BBS_COPY.bbs_col_cutting_rounded,
      size: 104,
      meta: { align: "right" },
      accessorFn: (row) => row.cuttingRoundedMm,
      cell: ({ row }) => <span className="cx-bbs-figure">{printed(row.original.cuttingRoundedMm)}</span>,
    },
    {
      id: "cuttingIs",
      header: BBS_COPY.bbs_col_cutting_is,
      size: 112,
      meta: { align: "right" },
      accessorFn: (row) => row.cuttingIsAdditiveMm,
      cell: ({ row }) => <span className="cx-bbs-figure">{printed(row.original.cuttingIsAdditiveMm)}</span>,
    },
    {
      id: "bars",
      header: BBS_COPY.bbs_col_bars,
      size: 88,
      meta: { align: "right" },
      accessorFn: (row) => row.bars,
      cell: ({ row }) => <span className="cx-bbs-figure">{printed(row.original.bars)}</span>,
    },
    {
      id: "kg",
      header: BBS_COPY.bbs_col_kg,
      size: 112,
      meta: { align: "right" },
      accessorFn: (row) => row.kg,
      cell: ({ row }) => <span className="cx-bbs-figure">{printed(row.original.kg)}</span>,
    },
  ];
}

/** The legs a bar is dimensioned by, or the lap's own length on the row beneath it (I-bbs-3). */
function dimensionsOf(row: BbsGridRow): string {
  if (row.component === "LAP") return `${BBS_COPY.bbs_lap_label} ${formatUserFigure(row.lapMm)} ${BBS_COPY.bbs_unit_mm}`;
  return Object.entries(row.dimsMm)
    .map(([letter, value]) => `${letter} ${formatUserFigure(value)}`)
    .join(" · ");
}
