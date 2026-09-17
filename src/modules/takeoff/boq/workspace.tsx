"use client";
// S-BOQ's workspace (docs/design/s-boq.md): every published line of the pinned campaign, grouped
// into L-BD-08's sections, each line numbered S.G.I, each section closed by the one foot incomplete
// coverage allows — and the project closed by nothing at all (L-QTY-04, L-QTY-07, I-268).
//
// Presentational and injected (I-170): every piece of shipped chrome arrives as a renderer declared
// by exactly the props this screen hands it, so a module never reaches the ui layer (ARCH-01) and a
// suite mounts the very components a reader sees. Nothing is measured here and nothing is rounded
// here: the payload is the DOCUMENT's payload and the item numbers are the document's numbering, so
// what a reader reads and what the PDF prints are one derivation (I-269, I-271).
//
// AM-05 and I-265: the words on this screen are SECTION, DRAFT and LINE. The name the law reserves
// for the signed thing appears in no sentence, no key and no class name here — only in `data-bill`,
// which is machine vocabulary a reader never meets.
import { useCallback, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { BoqDraftLine, BoqDraftPayload, BoqDraftSection } from "@/core/documents/kinds/boq-draft";
import type { RefusalEntry } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import type { JobKind } from "@/core/jobs/kinds";
import type { QuantityBasis } from "@/core/offers/law";
import { BOQ_COPY, BOQ_REASON_WORDS, BOQ_SECTION_WORDS } from "./copy";
import { boqStateOf, nothingPublished } from "./states";
import { UNCLASSIFIED } from "./taxonomy";
import type { BoqView } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/** One row of a section's grid: a payload line with what its group and the numbering said about it. */
export type BoqRow = BoqDraftLine & {
  readonly bill: string;
  readonly class: string;
  readonly kind: string;
  readonly description: string;
  /** The S.G.I string, or `null` on a row outside `BILLS` — a row with no section has no S (I-267). */
  readonly item: string | null;
  /** Why the taxonomy could not place this line, in words; `null` on a line it placed (L-BD-08). */
  readonly reason: string | null;
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
  meta?: { align?: "right" };
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
  readonly subtotal: string;
  readonly export: string;
  readonly empty: string;
  readonly revision: string;
  readonly taxonomyVersion: string;
  readonly draft: string;
  readonly jobs: string;
  readonly documentLink: string;
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
  empty: "boq-empty",
  revision: "boq-revision",
  taxonomyVersion: "boq-taxonomy-version",
  draft: "boq-draft",
  jobs: "boq-jobs",
  documentLink: "boq-document-link",
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
    group?: {
      of: (row: BoqRow) => { key: string; label: string } | null;
      valueOf?: (row: BoqRow) => string | null;
      unitOf?: (row: BoqRow) => string;
    };
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
  }>;
  /** The lane's own tabs row, filled by the surface standing in it (Direction §3.2). */
  readonly TabsAside?: ComponentType<{ children: ReactNode }>;
}

/** The doors this screen presses, and the one lookup a refusal's words are read through (I-170). */
export interface BoqDoors {
  /** The keyed render job (I-270): one press, one job, however many times it is pressed. */
  readonly exportDraft: () => Promise<{ jobId: string; deduplicated: boolean }>;
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

/** The foot's scope: what was measured, and never more than that (L-QTY-04). */
const MEASURED = "MEASURED";

/** What a line says about what it could not measure (L-QTY-02). */
const COMPLETE = "COMPLETE";

/** The standing an unsigned draft carries, said once and in words (AM-05). */
const UNSIGNED = "UNSIGNED";

// The addresses this screen links. ARCH-01 bars a module from the app layer where a route builder
// lives, so they are spelled here for this screen and nowhere else in it (Decision §7).
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;
const documentsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/documents`;
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;

/** A node rendered where it stands, for a caller that hands no slot mount (I-209). */
function InPlace({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/* ------------------------------------------------------------------------------- the reading */

/** Every row of one section, in the payload's own order — which is the order it was numbered in. */
function rowsOf(section: BoqDraftSection, items: ReadonlyMap<string, string>): BoqRow[] {
  return section.groups.flatMap((group) =>
    group.lines.map((line) => ({
      ...line,
      bill: section.bill,
      class: group.class,
      kind: group.kind,
      description: group.description,
      item: items.get(line.lineId) ?? null,
      reason: null,
    })),
  );
}

/** Every row the taxonomy could not place, kept and labelled after the six sections (I-266). */
function unclassifiedRowsOf(payload: BoqDraftPayload): BoqRow[] {
  return payload.unclassified.lines.map((line) => ({
    ...line,
    bill: UNCLASSIFIED,
    description: `${line.class} · ${line.kind}`,
    item: null,
    reason: line.reason,
  }));
}

/** What one row publishes of its own — §7's closed attribute contract, spelled once. */
function rowDataOf(row: BoqRow): Record<string, string> {
  const data: Record<string, string> = {
    "data-line": row.lineId,
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
  };
  if (row.levelOrdinal !== null && row.levelOrdinal !== undefined) data["data-ordinal"] = String(row.levelOrdinal);
  if (row.item !== null) data["data-item"] = row.item;
  // A line that declared what it could not measure states NO figure — never a zero, and never an
  // attribute holding one (L-QTY-02).
  if (row.quantity !== null) data["data-quantity"] = row.quantity;
  if (row.reason !== null) data["data-reason"] = row.reason;
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

  const press = useCallback((): void => {
    const door = doors.exportDraft;
    if (door === undefined) return;
    void door().then(
      (answer) => {
        setJobId(answer.jobId);
        props.onExportStarted?.(answer.jobId);
      },
      (thrown: unknown) => {
        // A refused door is answered in the one place a refusal is rendered, by its registered code —
        // never a toast and never an improvised sentence (R-UI-020, ARCH-03).
        setAnswered(codeOf(thrown));
      },
    );
  }, [doors, props]);

  /* --- the sections: one grid each, in BILLS order, then the unclassified block (I-266) --- */
  const sections = useMemo(() => payload?.sections ?? [], [payload]);
  const unclassified = useMemo(() => (payload === null ? [] : unclassifiedRowsOf(payload)), [payload]);

  const columns = useMemo(
    () => boqColumns({ BasisChip, CoverageChip, EnumLabel, UnitBadge }, false),
    [BasisChip, CoverageChip, EnumLabel, UnitBadge],
  );
  const unclassifiedColumns = useMemo(
    () => boqColumns({ BasisChip, CoverageChip, EnumLabel, UnitBadge }, true),
    [BasisChip, CoverageChip, EnumLabel, UnitBadge],
  );

  const group = useMemo(
    () => ({
      of: (row: BoqRow) => ({ key: `${row.class}:${row.kind}`, label: row.description }),
      valueOf: (row: BoqRow) => row.quantity,
      unitOf: (row: BoqRow) => row.unit,
    }),
    [],
  );

  const denial = denied ? (doors.refusalOf?.(PERMISSION_NOT_HELD) ?? null) : null;
  const refusal = refused === null ? null : (doors.refusalOf?.(refused) ?? null);

  return (
    <div
      className="cx-boq"
      data-testid={ids.screen}
      data-state={state}
      data-campaign={view?.campaignId ?? ""}
      data-coverage={view?.coverage ?? ""}
      data-taxonomy-version={view?.taxonomyVersion ?? ""}
    >
      <TabsAside>
        <div className="cx-boq-aside">
          {view === null ? null : (
            <>
              <span className="cx-boq-aside-label">{BOQ_COPY.boq_revision_label}</span>
              <IdChip className="cx-boq-revision" data-testid={ids.revision} value={view.setRevisionId ?? ""} />
              <span className="cx-boq-aside-label">{BOQ_COPY.boq_taxonomy_label}</span>
              <IdChip className="cx-boq-taxonomy" data-testid={ids.taxonomyVersion} value={view.taxonomyVersion} />
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
        </div>
      </TabsAside>

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
          <RefusalState refusal={refusal} evidence={{ href: registerHref(tenantId, projectId), label: BOQ_COPY.boq_empty_action }} />
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
            getRowId={(row) => row.lineId}
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
        <EmptyState className="cx-boq-empty" data-testid={ids.empty} heading={BOQ_COPY.boq_empty_heading} body={BOQ_COPY.boq_empty_body}>
          <a className="cx-btn cx-reticle cx-boq-empty-action" data-variant="secondary" href={registerHref(tenantId, projectId)}>
            {BOQ_COPY.boq_empty_action}
          </a>
        </EmptyState>
      ) : (
        <>
          {/* I-268: the one status line that says why no figure is stated for the project. Silence
              about a missing figure would be the silence R-UI-020 forbids. */}
          <p className="cx-boq-status" role="status">
            {view?.coverage === COMPLETE ? BOQ_COPY.boq_coverage_complete : BOQ_COPY.boq_coverage_incomplete}
          </p>

          <div className="cx-boq-grid" data-testid={ids.grid} aria-label={BOQ_COPY.boq_grid_label} data-rows-rendered={countOf(payload)}>
            {sections.map((section, index) => {
              const rows = rowsOf(section, items);
              return (
                <section
                  key={section.bill}
                  className="cx-boq-bill"
                  data-testid={ids.bill}
                  data-bill={section.bill}
                  data-ordinal={String(index + 1)}
                  data-rows-rendered={String(rows.length)}
                >
                  <h2 className="cx-boq-bill-heading">
                    <span className="cx-boq-bill-ordinal">{index + 1}</span>
                    {BOQ_SECTION_WORDS[section.bill] ?? section.label}
                  </h2>
                  <DataTable
                    tableId={`s-boq-${section.bill}`}
                    columns={columns}
                    data={rows}
                    getRowId={(row) => row.lineId}
                    freezeKeyColumn
                    group={group}
                    rowDataOf={rowDataOf}
                    rowTestId={ids.line}
                    aria-label={`${BOQ_SECTION_WORDS[section.bill] ?? section.label} — ${BOQ_COPY.boq_grid_label}`}
                  />
                  {/* The section's foot: one row per unit, under the one label incomplete coverage
                      allows. Cubic metres and square metres are never added together (L-QTY-04). */}
                  <div className="cx-boq-foot">
                    {section.subtotals.map((subtotal) => (
                      <div
                        key={subtotal.unit}
                        className="cx-boq-subtotal"
                        data-testid={ids.subtotal}
                        data-bill={section.bill}
                        data-unit={subtotal.unit}
                        data-quantity={subtotal.value}
                        data-scope={MEASURED}
                      >
                        <span className="cx-boq-subtotal-label">{BOQ_COPY.boq_subtotal_measured}</span>
                        <span className="cx-boq-subtotal-figure">{formatUserFigure(subtotal.value)}</span>
                        <UnitBadge unit={subtotal.unit} />
                      </div>
                    ))}
                  </div>
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
                <DataTable
                  tableId="s-boq-unclassified"
                  columns={unclassifiedColumns}
                  data={unclassified}
                  getRowId={(row) => row.lineId}
                  freezeKeyColumn
                  rowDataOf={rowDataOf}
                  aria-label={`${BOQ_COPY.boq_section_unclassified} — ${BOQ_COPY.boq_grid_label}`}
                />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** How many lines the draft is drawing, over every section it renders. */
function countOf(payload: BoqDraftPayload | null): string {
  if (payload === null) return "0";
  const inSections = payload.sections.reduce((sum, section) => sum + section.groups.reduce((held, group) => held + group.lines.length, 0), 0);
  return String(inSections + payload.unclassified.lines.length);
}

/** The registered code a rejection carries, read off the marker the door left on it (ARCH-03). */
function codeOf(thrown: unknown): string | null {
  const carried = (thrown as { refusalCode?: unknown } | null)?.refusalCode;
  return typeof carried === "string" ? carried : null;
}

/**
 * The seven columns, left to right, at the widths the Decision §1 reads them at. The first column is
 * the frozen key: the item number on a numbered line, and the reason in words on a row outside
 * `BILLS`, which has no number to show and may not be given one (I-267).
 */
function boqColumns(
  chrome: Pick<BoqChrome, "BasisChip" | "CoverageChip" | "EnumLabel" | "UnitBadge">,
  unplaced: boolean,
): BoqColumn[] {
  const { BasisChip, CoverageChip, EnumLabel, UnitBadge } = chrome;
  return [
    {
      id: "item",
      header: BOQ_COPY.boq_col_item,
      size: 96,
      meta: unplaced ? undefined : { align: "right" },
      accessorFn: (row) => row.item ?? "",
      cell: ({ row }) =>
        unplaced ? (
          <span className="cx-boq-reason">{BOQ_REASON_WORDS[row.original.reason ?? ""] ?? row.original.reason}</span>
        ) : (
          <span className="cx-boq-item">{row.original.item}</span>
        ),
    },
    {
      id: "description",
      header: BOQ_COPY.boq_col_description,
      size: 320,
      accessorFn: (row) => row.description,
      cell: ({ row }) => (
        <span className="cx-boq-description">
          <EnumLabel value={row.original.class} className="cx-boq-enum" />
          <span className="cx-boq-separator">{" · "}</span>
          <EnumLabel value={row.original.kind} className="cx-boq-enum" />
        </span>
      ),
    },
    {
      id: "level",
      header: BOQ_COPY.boq_col_level,
      size: 120,
      accessorFn: (row) => row.level,
      cell: ({ row }) => <span className="cx-boq-level">{row.original.level}</span>,
    },
    {
      id: "quantity",
      header: BOQ_COPY.boq_col_quantity,
      size: 140,
      meta: { align: "right" },
      accessorFn: (row) => row.quantity ?? "",
      // I-271: the figure a reader reads is the figure the document prints — already rounded at the
      // kind's own precision by the emission, grouped as the document groups one (L-FMT-01), and
      // ABSENT where a line declared what it could not measure (L-QTY-02).
      cell: ({ row }) => (row.original.quantity === null ? null : <span className="cx-boq-figure">{formatUserFigure(row.original.quantity)}</span>),
    },
    {
      id: "unit",
      header: BOQ_COPY.boq_col_unit,
      size: 80,
      accessorFn: (row) => row.unit,
      cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
    },
    {
      id: "basis",
      header: BOQ_COPY.boq_col_basis,
      size: 184,
      // I-25's pair, in the order it is read: how the quantity was got, then how the object was
      // selected. Each wears R-UI-002's glyph AND its word, so neither carries meaning by colour.
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
      size: 112,
      meta: { align: "right" },
      accessorFn: (row) => row.coverage,
      cell: ({ row }) => <CoverageChip value={row.original.coverage === COMPLETE ? 1 : 0} />,
    },
  ];
}
