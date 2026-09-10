"use client";
// S-Takeoff's register workspace (R-TO-050, R-TO-051, S-Takeoff, docs/design/s-takeoff.md § 1): the
// tree by discipline → level → class → object, the inspector that states what one object rests on,
// and the lines measured from it — with everything that produced no line standing beside them.
//
// I-170: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17 bars a screen from
// re-implementing a shipped primitive, so the workspace is handed its renderers. What the route
// binds and what the acceptance mounts are the same shipped Tree, DataTable, RefusalState,
// OfferedGroups, ConsequenceDialog, JobTimeline, Skeleton, BasisChip and CoverageChip.
//
// Every act here is a door and nothing more: the screen previews at the door, renders a rejection
// through the one RefusalState, and opens the one ConsequenceDialog only over a Consequence that was
// answered. Nothing on this screen commits anything itself (L-ACT-02, I-175).
import { useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { Consequence, CorroborateInput, InsertLevelInput, LevelStackGroupKey, RepudiateInput } from "@/core/acts";
import type { RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatUserFigure } from "@/core/format";
import type { JobKind } from "@/core/jobs/kinds";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import { REGISTER_COPY, fillCopy } from "./copy";
import type { RegisterView, ViewAttribute, ViewLine, ViewObject, ViewReading } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** The two row heights R-UI-005 fixes, as the frame states the reader's choice. */
export type RegisterDensity = "comfortable" | "compact";

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
 * A column whose cell composes several facts — the formula, the variable bindings, the basis pair,
 * the calibration keys — carries no single value to order by and stays unsorted.
 */
type LineColumn = {
  id: string;
  header: string;
  accessorFn?: (line: ViewLine) => string;
  enableSorting?: boolean;
  cell: (context: LineCell) => ReactNode;
  meta?: { align?: "right" };
};

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
 * The nine shipped renderers the app layer injects (I-170). Each is declared by exactly the props
 * this screen hands it, so the shipped component itself is assignable and no adapter stands between
 * what a reader sees and what a test mounts.
 */
export interface RegisterChrome {
  readonly Tree: ComponentType<{
    items: TreeNode[];
    onSelect?: (id: string) => void;
    defaultExpandedIds?: string[];
    defaultSelectedId?: string;
    "aria-label"?: string;
  }>;
  readonly DataTable: ComponentType<{
    columns: LineColumn[];
    data: ViewLine[];
    getRowId: (row: ViewLine, index: number) => string;
    density?: RegisterDensity;
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
  readonly density: RegisterDensity;
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

/** The job kind a measure run is watched under (SEAM-JOBS' roster). */
const MEASURE_KIND: JobKind = "measure";

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

/** How a coverage reads as a share of the item priced: only a COMPLETE line carries a quantity. */
const COMPLETE = "COMPLETE";

/** The tree, nested as the hierarchy is: discipline → level → class → object (R-TO-050). */
function treeOf(objects: readonly ViewObject[]): { items: TreeNode[]; expanded: string[] } {
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
    const discipline = at(items, `d:${object.discipline}`, object.discipline);
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

/** Class and level narrow the tree with the table, so one screen shows one answer (I-172). */
function keepsObject(object: ViewObject, filters: Filters): boolean {
  if (filters.class !== "" && object.class !== filters.class) return false;
  if (filters.level !== "" && object.level !== filters.level) return false;
  return true;
}

/* --------------------------------------------------------------------------- the workspace */

/** What a door answered that the screen shows in place: one registered refusal, or nothing. */
type Answer = { refusal: RefusalEntry; evidence: Evidence } | null;

/** The act a confirmed door opened the one dialog over, with the input it will be committed on. */
type Pending =
  | { readonly actType: typeof CORROBORATE; readonly input: CorroborateInput }
  | { readonly actType: typeof REPUDIATE; readonly input: RepudiateInput }
  | { readonly actType: typeof INSERT_LEVEL; readonly input: InsertLevelInput };

export function RegisterWorkspace({ view, density, permitted, offline, chrome, doors }: RegisterWorkspaceProps) {
  const { Tree, DataTable, RefusalState, OfferedGroups, ConsequenceDialog, JobTimeline, BasisChip, CoverageChip } = chrome;

  const evidence: Evidence = { href: drawingsHref(view.tenantId, view.projectId), label: REGISTER_COPY.takeoff_register_evidence };
  const deniedEvidence: Evidence = { href: participantsHref(view.tenantId, view.projectId), label: REGISTER_COPY.takeoff_register_evidence };

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>(view.objects[0]?.objectKey ?? null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [steps, setSteps] = useState<readonly TimelineStep[]>([]);
  const [draft, setDraft] = useState<{ attribute: string; value: string; unit: string; precedence: string } | null>(null);

  const objects = useMemo(() => view.objects.filter((object) => keepsObject(object, filters)), [view.objects, filters]);
  /* I-173: a line measured off a struck object stays on record and out of the table, so every count,
     option and row on this screen is taken over what the table may in fact show. */
  const registered = useMemo(() => view.lines.filter((line) => !line.repudiated), [view.lines]);
  const lines = useMemo(() => registered.filter((line) => keeps(line, filters)), [registered, filters]);
  const tree = useMemo(() => treeOf(objects), [objects]);

  const selected = view.objects.find((object) => object.objectKey === selectedKey) ?? null;
  const struck = selected !== null && selected.corroboration === REPUDIATED;
  const repudiated = view.objects.filter((object) => object.corroboration === REPUDIATED).length;
  const withheld = view.lines.length - registered.length;

  /**
   * A rejection at a door, answered in place — never a toast, and never a dialog over nothing. A
   * failure carrying no registered code is a fault, and a fault belongs to the boundary that owns
   * the report id: it is re-raised untouched rather than dressed as a refusal (ARCH-03, B-21).
   */
  const refuse = (code: string | null, thrown: unknown): void => {
    const entry = code === null ? undefined : doors.refusalOf(code);
    if (entry === undefined) throw thrown;
    setAnswer({ refusal: entry, evidence });
  };

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

  /**
   * The two inspector doors pre-flight their preview at the door: a rejection is answered in place
   * and opens NO dialog, and only an answered Consequence opens one — whose own preview runs again,
   * because L-ACT-02's digest must be the one current state produces (settled ruling, I-41).
   */
  const openCorroborate = async (attribute: ViewAttribute): Promise<void> => {
    if (selected === null || draft === null) return;
    const input: CorroborateInput = {
      type: CORROBORATE,
      projectId: view.projectId,
      objectKey: selected.objectKey,
      attribute: attribute.attribute,
      valueAsWritten: draft.value,
      unitAsWritten: draft.unit,
      precedence: Number(draft.precedence),
      sourceKey: selected.sourceKey,
    };
    try {
      await doors.previewCorroborate({ input });
    } catch (thrown) {
      refuse(refusalCodeOf(thrown) ?? refusalCodeOf((thrown as { cause?: unknown })?.cause), thrown);
      return;
    }
    setAnswer(null);
    setPending({ actType: CORROBORATE, input });
  };

  const openRepudiate = async (): Promise<void> => {
    if (selected === null) return;
    const input: RepudiateInput = { type: REPUDIATE, projectId: view.projectId, objectKey: selected.objectKey };
    try {
      await doors.previewRepudiate({ input });
    } catch (thrown) {
      refuse(refusalCodeOf(thrown) ?? refusalCodeOf((thrown as { cause?: unknown })?.cause), thrown);
      return;
    }
    setAnswer(null);
    setPending({ actType: REPUDIATE, input });
  };

  /** The Measure door: inc-209's own answer, and the run shown where it was started (R-UI-024). */
  const requestMeasure = async (): Promise<void> => {
    const campaignId = view.campaign?.campaignId;
    let asked: MeasureAnswer;
    try {
      asked = await doors.requestMeasure({ projectId: view.projectId, campaignId: campaignId ?? "" });
    } catch (thrown) {
      refuse(refusalCodeOf(thrown) ?? refusalCodeOf((thrown as { cause?: unknown })?.cause), thrown);
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
  };

  /* ------------------------------------------------------------------ the lines table's columns */

  const columns: LineColumn[] = [
    {
      id: "kind",
      header: REGISTER_COPY.takeoff_register_col_kind,
      accessorFn: (line) => line.kind,
      enableSorting: true,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.kind}</span>,
    },
    {
      id: "value",
      header: REGISTER_COPY.takeoff_register_col_value,
      meta: { align: "right" },
      accessorFn: (line) => line.value ?? "",
      enableSorting: true,
      // The SI value at the precision it was published at, never re-rounded (I-25); a row kept with
      // no quantity states none, never a zero (L-QTY-02).
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.value ?? ""}</span>,
    },
    {
      id: "unit",
      header: REGISTER_COPY.takeoff_register_col_unit,
      accessorFn: (line) => line.unit,
      enableSorting: true,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.unit}</span>,
    },
    {
      id: "formula",
      header: REGISTER_COPY.takeoff_register_col_formula,
      cell: ({ row }) => <span className="cx-register-formula">{row.original.formula}</span>,
    },
    {
      id: "variables",
      header: REGISTER_COPY.takeoff_register_col_variables,
      cell: ({ row }) => (
        <span className="cx-register-cell-mono">
          {Object.entries(row.original.variables)
            .map(([name, binding]) => `${name}=${binding.value} ${binding.unit}`)
            .join(" ")}
        </span>
      ),
    },
    {
      id: "bases",
      header: REGISTER_COPY.takeoff_register_col_bases,
      // I-25's pair reads as one token, so it renders as one: the chip carries the glyph and the
      // palette of the basis that determines the figure, and the selecting basis follows the slash
      // as the word itself — two chips cannot compose a slash-joined pair (R-UI-002).
      cell: ({ row }) => (
        <span className="cx-register-bases">
          <BasisChip basis={row.original.quantityBasis} />
          <span className="cx-register-cell-mono">/{row.original.selectionBasis}</span>
        </span>
      ),
    },
    {
      id: "coverage",
      header: REGISTER_COPY.takeoff_register_col_coverage,
      accessorFn: (line) => line.coverage,
      enableSorting: true,
      cell: ({ row }) => (
        <span className="cx-register-coverage">
          <span className="cx-register-cell-mono">{row.original.coverage}</span>
          <CoverageChip value={row.original.coverage === COMPLETE ? 1 : 0} />
        </span>
      ),
    },
    {
      id: "calibration",
      header: REGISTER_COPY.takeoff_register_col_calibration,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.calibrationKeys.join(" ")}</span>,
    },
    {
      id: "engine",
      header: REGISTER_COPY.takeoff_register_col_engine,
      accessorFn: (line) => line.engine,
      enableSorting: true,
      cell: ({ row }) => <span className="cx-register-cell-mono">{row.original.engine}</span>,
    },
    {
      id: "source",
      header: REGISTER_COPY.takeoff_register_col_source,
      accessorFn: (line) => line.sourceKey,
      enableSorting: true,
      // Text, not a link: the Trace from a line to its entities is inc-215's (Decision § 8).
      cell: ({ row }) => <span className="cx-register-source">{row.original.sourceKey}</span>,
    },
  ];

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

  return (
    <div className="cx-register" data-testid="register-workspace" data-state={state} data-campaign={view.campaign?.campaignId}>
      {offline ? (
        <p className="cx-register-offline" role="status">
          {REGISTER_COPY.takeoff_register_offline}
        </p>
      ) : null}

      <header className="cx-register-header">
        <div className="cx-register-title">
          <h1 className="cx-register-heading">{REGISTER_COPY.takeoff_register_heading}</h1>
          <p className="cx-register-caption">{REGISTER_COPY.takeoff_register_caption}</p>
        </div>
        <div className="cx-register-actions">
          {/* The label names a value: with no campaign open there is no pinned revision, and a label
              standing over nothing reads as a stray fragment rather than as a fact. The pair is
              rendered whole or not at all — the empty cell below is what says there is no campaign. */}
          {view.campaign === null ? null : (
            <p className="cx-register-campaign">
              <span className="cx-register-campaign-label">{REGISTER_COPY.takeoff_register_campaign_label}</span>
              {/* A surrogate, rendered verbatim beside the words and never inside a sentence (I-26);
                  it is per-run ink, so a design picture masks it by this id (Decision § 7). */}
              <span className="cx-register-campaign-id" data-testid="register-campaign">
                {view.campaign.setRevisionId}
              </span>
            </p>
          )}
          <div className="cx-register-measure">
            <button
              type="button"
              className="cx-btn cx-reticle"
              data-variant="primary"
              data-testid="register-measure"
              disabled={offline}
              onClick={() => {
                void requestMeasure();
              }}
            >
              {REGISTER_COPY.takeoff_register_measure}
            </button>
            <p className="cx-register-measure-hint">{REGISTER_COPY.takeoff_register_measure_hint}</p>
          </div>
        </div>
      </header>

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

      <section className="cx-register-timeline" data-testid="register-timeline">
        <JobTimeline heading={REGISTER_COPY.takeoff_register_timeline_heading} steps={steps} />
      </section>

      <div className="cx-register-filters">
        {(Object.keys(filterOptions) as (keyof Filters)[]).map((name) => (
          <label key={name} className="cx-register-filter">
            <span className="cx-register-filter-label">{filterOptions[name].label}</span>
            <select
              className="cx-input cx-reticle cx-register-select"
              data-testid={`register-filter-${name}`}
              data-chosen={filters[name] === "" ? undefined : "true"}
              value={filters[name]}
              onChange={(event) => setFilters((held) => ({ ...held, [name]: event.target.value }))}
            >
              <option value="">{filterOptions[name].any}</option>
              {filterOptions[name].options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p className="cx-register-count" data-testid="register-lines-count" role="status">
          {fillCopy("takeoff_register_lines_count", { shown: formatUserFigure(String(lines.length)), total: formatUserFigure(String(registered.length)) })}
        </p>
      </div>

      {nothingRegistered ? (
        <div className="cx-register-empty" data-testid="register-empty">
          <h2 className="cx-register-empty-heading">
            {view.campaign === null ? REGISTER_COPY.takeoff_register_empty_heading : REGISTER_COPY.takeoff_register_empty_campaign_heading}
          </h2>
          <p className="cx-register-empty-body">
            {view.campaign === null ? REGISTER_COPY.takeoff_register_empty_body : REGISTER_COPY.takeoff_register_empty_campaign_body}
          </p>
          {view.campaign === null ? (
            <a className="cx-btn cx-reticle cx-register-empty-action" data-variant="secondary" href={setsHref(view.tenantId, view.projectId)}>
              {REGISTER_COPY.takeoff_register_empty_action}
            </a>
          ) : null}
        </div>
      ) : (
        <div className="cx-register-body">
          <section className="cx-register-panel cx-register-tree-panel">
            <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_tree_label}</h2>
            {/* I-171: the shipped Tree fixes its own id after the spread, so the screen's id rides a
                `display: contents` wrapper that adds no box and no line of layout. */}
            <div className="cx-register-mount" data-testid="register-tree">
              <Tree
                items={tree.items}
                defaultExpandedIds={tree.expanded}
                defaultSelectedId={selectedKey === null ? undefined : `o:${selectedKey}`}
                aria-label={REGISTER_COPY.takeoff_register_tree_label}
                onSelect={(id) => {
                  if (id.startsWith("o:")) setSelectedKey(id.slice(2));
                }}
              />
            </div>
            <p className="cx-register-repudiated" data-testid="register-repudiated-count">
              {fillCopy("takeoff_register_repudiated_count", { count: formatUserFigure(String(repudiated)), lines: formatUserFigure(String(withheld)) })}
            </p>
          </section>

          <div className="cx-register-mount cx-register-lines" data-testid="register-lines">
            {lines.length === 0 ? (
              <p className="cx-register-lines-none">{REGISTER_COPY.takeoff_register_lines_none}</p>
            ) : (
              <DataTable columns={columns} data={[...lines]} getRowId={(line) => line.lineId} density={density} />
            )}
          </div>

          <aside className="cx-register-panel cx-register-inspector" data-testid="register-inspector" data-object={selected?.objectKey}>
            {selected === null ? (
              <>
                <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_inspector_idle_heading}</h2>
                <p className="cx-register-idle-body">{REGISTER_COPY.takeoff_register_inspector_idle_body}</p>
              </>
            ) : (
              <>
                <span className="cx-visually-hidden">{REGISTER_COPY.takeoff_register_object_key_label}</span>
                <p className="cx-register-object-key" data-testid="register-object-key">
                  {selected.objectKey}
                </p>
                <dl className="cx-register-facts">
                  <dt>{REGISTER_COPY.takeoff_register_basis_label}</dt>
                  <dd data-testid="register-object-basis" data-basis={selected.basis}>
                    <BasisChip basis={selected.basis as QuantityBasis} />
                  </dd>
                  <dt>{REGISTER_COPY.takeoff_register_role_label}</dt>
                  <dd className="cx-register-cell-mono" data-testid="register-object-role" data-role={selected.role}>
                    {selected.role}
                  </dd>
                  <dt>{REGISTER_COPY.takeoff_register_corroboration_label}</dt>
                  <dd className="cx-register-cell-mono" data-testid="register-object-corroboration" data-standing={selected.corroboration}>
                    {selected.corroboration}
                  </dd>
                  <dt>{REGISTER_COPY.takeoff_register_source_label}</dt>
                  <dd className="cx-register-source" data-testid="register-source-key">
                    {selected.sourceKey}
                  </dd>
                </dl>
                {/* I-173: a struck object states what its repudiation did — and offers no door to
                    corroborate or to strike again what a person has already judged to be nothing. */}
                {struck ? <p className="cx-register-repudiated-note">{REGISTER_COPY.takeoff_register_repudiated_note}</p> : null}
                {permitted && !offline && !struck ? (
                  <button
                    type="button"
                    className="cx-btn cx-reticle"
                    data-variant="secondary"
                    onClick={() => {
                      void openRepudiate();
                    }}
                  >
                    {REGISTER_COPY.takeoff_register_repudiate}
                  </button>
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
                    <p className="cx-register-cell-mono">{attribute.standing}</p>
                    {attribute.canonicalValue === null || attribute.canonicalUnit === null ? null : (
                      <p className="cx-register-reading" data-testid="register-reading" data-role="standing">
                        <span className="cx-register-cell-mono">
                          {attribute.canonicalValue} {attribute.canonicalUnit}
                        </span>
                      </p>
                    )}
                    {attribute.standing === "SUSPENDED" ? <p className="cx-register-suspended">{REGISTER_COPY.takeoff_register_suspended_note}</p> : null}
                    {attribute.competing.length === 0 && attribute.overruled.length === 0 ? (
                      <p className="cx-register-no-readings">{REGISTER_COPY.takeoff_register_no_readings}</p>
                    ) : null}
                    <Readings
                      label={REGISTER_COPY.takeoff_register_competing_label}
                      role="competing"
                      readings={attribute.competing}
                      BasisChip={BasisChip}
                    />
                    <Readings
                      label={REGISTER_COPY.takeoff_register_overruled_label}
                      role="overruled"
                      readings={attribute.overruled}
                      BasisChip={BasisChip}
                    />
                    {permitted && !offline && !struck ? (
                      <div className="cx-register-corroborate">
                        <button
                          type="button"
                          className="cx-btn cx-reticle"
                          data-variant="ghost"
                          onClick={() =>
                            setDraft((held) =>
                              held !== null && held.attribute === attribute.attribute ? null : { attribute: attribute.attribute, value: "", unit: "", precedence: "0" },
                            )
                          }
                        >
                          {REGISTER_COPY.takeoff_register_corroborate}
                        </button>
                        {draft !== null && draft.attribute === attribute.attribute ? (
                          <div className="cx-register-corroborate-form">
                            <label className="cx-register-field">
                              <span>{REGISTER_COPY.takeoff_register_corroborate_value}</span>
                              <input
                                className="cx-input cx-reticle"
                                type="text"
                                value={draft.value}
                                onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                              />
                            </label>
                            <label className="cx-register-field">
                              <span>{REGISTER_COPY.takeoff_register_corroborate_unit}</span>
                              <input
                                className="cx-input cx-reticle"
                                type="text"
                                value={draft.unit}
                                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                              />
                            </label>
                            <label className="cx-register-field">
                              <span>{REGISTER_COPY.takeoff_register_corroborate_precedence}</span>
                              <input
                                className="cx-input cx-reticle"
                                type="text"
                                aria-describedby={`precedence-hint-${attribute.attribute}`}
                                value={draft.precedence}
                                onChange={(event) => setDraft({ ...draft, precedence: event.target.value })}
                              />
                            </label>
                            <p className="cx-register-hint" id={`precedence-hint-${attribute.attribute}`}>
                              {REGISTER_COPY.takeoff_register_corroborate_precedence_hint}
                            </p>
                            <button
                              type="button"
                              className="cx-btn cx-reticle"
                              data-variant="secondary"
                              onClick={() => {
                                void openCorroborate(attribute);
                              }}
                            >
                              {REGISTER_COPY.takeoff_register_corroborate_preview}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ))}
              </>
            )}
          </aside>
        </div>
      )}

      {/* R-UI-020: a sighting that produced no line says why, in place, with the evidence that
          resolves it — and the count is stated even when it is zero (silence never happens). */}
      <section className="cx-register-refusals" data-testid="register-refusals" data-count={view.refusals.length}>
        <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_refusals_heading}</h2>
        <p className="cx-register-refusals-hint">{REGISTER_COPY.takeoff_register_refusals_hint}</p>
        {view.refusals.map((refusal) => {
          // A row with no message, remedy or evidence link is the silence R-UI-020 forbids: a code
          // the registry does not hold is a fault of the reading, raised to the boundary that mints
          // the report id rather than rendered as a blank row (ARCH-03, B-21).
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
              <p className="cx-register-refusal-fact">
                <span className="cx-register-refusal-label">{REGISTER_COPY.takeoff_register_refusal_object_label}</span>
                <span className="cx-register-cell-mono" data-testid="register-refusal-object">
                  {refusal.objectKey}
                </span>
              </p>
              {refusal.kind === null ? null : (
                <p className="cx-register-refusal-fact">
                  <span className="cx-register-refusal-label">{REGISTER_COPY.takeoff_register_refusal_kind_label}</span>
                  <span className="cx-register-cell-mono">{refusal.kind}</span>
                </p>
              )}
              <RefusalState refusal={entry} evidence={evidence} />
            </div>
          );
        })}
      </section>

      {/* R-UI-023: the one bulk door on this screen. There is no checkbox, no row selection and no
          select-all anywhere under this workspace — the offer is confirmed exactly as it is named. */}
      {permitted ? (
        <section className="cx-register-level-stack" data-testid="register-level-stack">
          <h2 className="cx-register-panel-heading">{REGISTER_COPY.takeoff_register_level_stack_heading}</h2>
          <p className="cx-register-level-stack-hint">{REGISTER_COPY.takeoff_register_level_stack_hint}</p>
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
          <BasisChip basis={reading.basis as QuantityBasis} />
          <span className="cx-register-source">{reading.sourceKey}</span>
        </p>
      ))}
    </>
  );
}
