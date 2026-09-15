"use client";
// S-Schedules' workspace — the sheet rail, the reconstructed tables, the member-type registry and the
// notes panel, cut from the grid-workspace template S-Takeoff established (docs/design/s-schedules.md;
// Design Direction 00 §3.2).
//
// I-170, as this screen inherits it: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17
// bars a screen from re-implementing a shipped primitive — so the renderers, the two mounts and the
// ids this screen publishes all arrive as chrome from the one file that may reach both trees.
//
// Nothing here counts and nothing here computes (I-250, I-251): a table renders the rows the store
// holds, a family renders the mark the schedule wrote, and a standing renders the answer
// `schedulesViewOf` already derived. The one act is a door and nothing more (L-ACT-02, I-254): the
// screen previews at the door, renders a rejection through the one RefusalState, and opens the one
// ConsequenceDialog only over a Consequence that was answered. The verdict on a kept reading is the
// SEAM's — this screen never decides ACCEPTED from EDITED (R-TO-034, AC-2).
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from "react";
import type { Consequence, TranscribeSheetNotesInput } from "@/core/acts";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatUserFigure } from "@/core/format";
import type { NoteProposal } from "@/core/notes/grammar";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { SCHEDULES_COPY, fillCopy } from "./copy";
import type { FamilyView, ReadingView, ScheduleTableView, SchedulesView, SheetView, StandingView } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** One cell of a schedule table, as the shipped DataTable hands one its row. */
type BandCell = { readonly row: { readonly original: BandRow } };

/** One band of a schedule table, as the table is handed one. */
type BandRow = { readonly rowIndex: number; readonly cells: readonly { readonly columnIndex: number; readonly text: string; readonly sourceKeys: readonly string[] }[] };

/**
 * One column of a schedule table, as the shipped DataTable takes one. The header is a renderer
 * rather than a string because the stored header band's cells are `schedules-cell`s like any other
 * and carry their own trace (I-250) — the grid renders whatever the column names through `flexRender`.
 */
type BandColumn = {
  id: string;
  header: () => ReactNode;
  accessorFn?: (row: BandRow) => string;
  enableSorting?: boolean;
  size?: number;
  cell: (context: BandCell) => ReactNode;
};

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * THE IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is
 * the one declaration of every test id and a module may not import it, so they arrive as chrome —
 * exactly as `DataTable` and `EnumLabel` do. Every string is the registry's own.
 */
export interface SchedulesTestIds {
  readonly screen: string;
  readonly empty: string;
  readonly sheets: string;
  readonly sheetRow: string;
  readonly table: string;
  readonly cell: string;
  readonly deferral: string;
  readonly registry: string;
  readonly family: string;
  readonly variant: string;
  readonly zone: string;
  readonly notes: string;
  readonly standing: string;
  readonly reading: string;
  readonly proposal: string;
  readonly proposalValue: string;
  readonly transcribe: string;
  readonly inspector: string;
}

/** The shipped renderers the app layer injects (I-170), each declared by the props this screen hands it. */
export interface SchedulesChrome {
  readonly testIds: SchedulesTestIds;
  /** The lane's own nav entry for this screen, published so the rail can say where it stands. */
  readonly navTestId: string;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: BandColumn[];
    data: BandRow[];
    getRowId: (row: BandRow, index: number) => string;
    freezeKeyColumn?: boolean;
    "aria-label"?: string;
  }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly ConsequenceDialog: ComponentType<{
    open: boolean;
    actType: string;
    preview: () => Promise<{ consequence: Consequence; consequenceDigest: string }>;
    commit: (carried: { consequenceDigest: string }) => Promise<{ actId: string }>;
    onOpenChange: (open: boolean) => void;
    onCommitted: (committed: { actId: string }) => void;
  }>;
  readonly EmptyState: ComponentType<{ heading: string; body?: string; children?: ReactNode; className?: string; "data-testid"?: string }>;
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "act";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children?: ReactNode;
    "data-testid"?: string;
    "data-permission"?: string;
  }>;
  /** R-UI-083: a figure is written in the shipped NumberInput, never a bare `input type=number`. */
  readonly NumberInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
    className?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  readonly Skeleton: ComponentType<{ style?: CSSProperties; className?: string }>;
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  readonly UnitBadge: ComponentType<{ unit: string }>;
  /** R-UI-022's one affordance: a place, never a door — the address is composed by the caller (I-178). */
  readonly EvidenceLink: ComponentType<{ href: string; basis: typeof TRANSCRIBED; label: string; className?: string }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** THE TWO MOUNTS (Direction §1, §3.2): the lane's tabs row, and the frame's ONE inspector. */
  readonly TabsAside: ComponentType<{ children?: ReactNode }>;
  readonly InspectorMount: ComponentType<{ children?: ReactNode }>;
}

/** What a preview answers (L-ACT-02): the typed Consequence, and the digest that binds it. */
export type PreviewAnswer = { consequence: Consequence; consequenceDigest: string };

/** The doors this screen presses — the schedules lane's own (`src/server/routers/takeoff-schedules.ts`). */
export interface SchedulesDoors {
  readonly schedules: (argument: { projectId: string }) => Promise<SchedulesView>;
  readonly previewTranscribeSheetNotes: (argument: { input: TranscribeSheetNotesInput }) => Promise<PreviewAnswer>;
  readonly commitTranscribeSheetNotes: (argument: { input: TranscribeSheetNotesInput; consequenceDigest: string }) => Promise<{ actId: string }>;
}

/** The addresses this screen links, composed by the layer that owns the route tree (ARCH-01, B-17). */
export interface SchedulesAddresses {
  /** The viewer, at the entities something cites — `selectionAddress`, and never a second spelling. */
  readonly selection: (sheet: { drawingId: string; layoutName: string }, sourceKeys: readonly string[]) => string;
  /** Where a drawing is added — the empty state's one action. */
  readonly drawings: string;
  /** Where a permission is granted — the denial's evidence. */
  readonly participants: string;
}

export interface SchedulesWorkspaceProps {
  readonly view: SchedulesView | null;
  readonly projectId: string;
  readonly tenantId: string;
  /** Which permission the reader holds, read server-side (Decision §2, I-256). */
  readonly permitted: Readonly<Record<string, boolean | undefined>>;
  readonly offline: boolean;
  /**
   * The state the ROUTE holds this screen in — `loading` while it waits and `error` where the read
   * faulted, both of which are facts about the read rather than about the sheets. Left null, the
   * screen derives its own (§2's order, first holding wins).
   */
  readonly state?: string | null;
  /** The fault the read left behind, quoted verbatim in the error cell (R-UI-050, B-21). */
  readonly reportId?: string | null;
  /** The read's own retry, where the caller holds the read: the error cell's one door (R-UI-050). */
  readonly onRetry?: () => void;
  readonly chrome: SchedulesChrome;
  readonly doors: SchedulesDoors;
  readonly addresses: SchedulesAddresses;
}

/* --------------------------------------------------------------------------- the law's words */

/** The permission this screen's one door moves (L-ACT-03, Decision §2's denial table). */
export const MEASURE = "MEASURE";

/** The act this screen confirms, verbatim as the act seam names it. */
const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES" as const;

/** The code the screen's own denial renders, off the registry it is looked up in (R-UI-020). */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The code a sheet whose words state no figure says its silence under (Decision §3). */
const NOTES_NONE_PROPOSED = "NOTES_NONE_PROPOSED";

/** The one basis a reading off a drawing's own text stands on (L-QTY-01). */
const TRANSCRIBED = "TRANSCRIBED";

/** The standing that carries a figure, and the one that carries none (I-253). */
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";
const NONE = "NONE";

/** The two verdicts the seam judges a kept reading under (R-TO-034) — reported, never decided here. */
const ACCEPTED = "ACCEPTED";

/** The em dash a cell states an absence with — never a zero, which would be a figure (I-252). */
const DASH = "—";

/**
 * The words §3 rules each kind, each standing and each verdict by. They are not keys of the string
 * registry: §3 states them as the vocabulary EnumLabel labels a value with, and the registry's key
 * table is closed to exactly the sentences §3 names by key. Each is handed to `EnumLabel` as its
 * label, so the raw value still stands beside it under `data-technical` (Decision §3, R-UI-082).
 */
const KIND_SAID: Readonly<Record<NoteKind, string>> = Object.freeze({
  FY: "Reinforcement grade",
  FC: "Concrete strength",
  LAP: "Tension lap",
  HOOK: "Hook extension",
  HOOK_MIN: "Minimum hook length",
});

const STANDING_SAID: Readonly<Record<string, string>> = Object.freeze({ AGREED: "Agreed", SUSPENDED: "Suspended", NONE: "Not read" });

/**
 * The words §3's refusal table gives each entry's evidence link. They are not keys of the string
 * registry either, for the same reason: the table states them in its own column rather than by key.
 */
const OPEN_THE_SHEET = "Open the sheet";
const OPEN_PARTICIPANTS = "Open the participants screen";

/** The widths §5 admits for the frozen mark column; the rest of a stored table's columns divide evenly. */
const WIDTH_MARK_MIN = 120;
const WIDTH_MARK_MAX = 280;

/** How wide a stored cell's text is reckoned to be, in the mono the table draws it in (§5). */
const MONO_CHAR_PX = 8;

/** What a door answered that the screen shows in place: one registered refusal, or nothing. */
type Answer = { refusal: RefusalEntry; evidence: Evidence } | null;

/** What a reader has chosen — a cell of a table, or one reading of a note. Exactly one, or none. */
type Selection = { kind: "cell"; scheduleKey: string; rowIndex: number; columnIndex: number } | { kind: "reading"; readingKey: string };

/** Which sheet the rail has selected: the drawing and the layout, as the rail keys one. */
type SheetKey = { drawingId: string; layoutName: string };

/* ----------------------------------------------------------------------------- the readings */

/** The registered entry a code names, or none — a code the register does not hold is not a refusal. */
function entryOf(code: string): RefusalEntry | undefined {
  return (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];
}

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

/** Whether two rail keys name the same sheet. */
function sameSheet(left: SheetKey | null, right: SheetKey): boolean {
  return left !== null && left.drawingId === right.drawingId && left.layoutName === right.layoutName;
}

/**
 * The record of what a sheet has been READ at: every reading committed on it, gathered by kind.
 *
 * Every one of them, and never the latest per note. A reading is an act a named person performed, so
 * a second person's reading of the same note replaces nothing — it disagrees, and the standing above
 * these rows is where that disagreement is stated (L-REG-03, I-253). A reading that a LATER one by
 * the SAME person stands over keeps its row too, marked superseded, because what a sheet has been
 * read at is the whole record and not its last line (L-ACT-01).
 *
 * Within a kind the store's own order stands, oldest first, so a superseded reading sits above the
 * reading that took its place.
 */
function readingsOfRecord(readings: readonly ReadingView[]): ReadingView[] {
  return [...readings].sort((left, right) => NOTE_KINDS.indexOf(left.kind) - NOTE_KINDS.indexOf(right.kind));
}

/** Every band of a stored table, the header among them — what the grid draws, header row included. */
function bandsOf(table: ScheduleTableView): readonly BandRow[] {
  return table.header === undefined ? table.rows : [table.header, ...table.rows];
}

/** How many columns a stored table stands in — the widest band it holds, and never a re-reckoning. */
function columnsOf(table: ScheduleTableView): number[] {
  const held = new Set<number>();
  for (const row of bandsOf(table)) {
    for (const cell of row.cells) held.add(cell.columnIndex);
  }
  return [...held].sort((left, right) => left - right);
}

/**
 * How many rows the grid DREW, read from the one place that knows it (B-17). The shipped table
 * windows its rows once a table is long enough and publishes the number it in fact put in the
 * document; the region carries the id a retrying read waits on (§7), so it repeats the table's own
 * number rather than restating the length of the data it handed over.
 */
function useRowsDrawn(region: RefObject<HTMLElement | null>, rows: number): number {
  const [drawn, setDrawn] = useState(rows);
  useEffect(() => {
    const host = region.current;
    if (host === null) return;
    const read = (): void => {
      const said = host.querySelector("[data-rows-rendered]")?.getAttribute("data-rows-rendered");
      const count = said === null || said === undefined ? Number.NaN : Number(said);
      setDrawn(Number.isFinite(count) ? count : rows);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: ["data-rows-rendered"], subtree: true, childList: true });
    return () => watch.disconnect();
  }, [region, rows]);
  return drawn;
}

/* --------------------------------------------------------------------------- the workspace */

export function SchedulesWorkspace({ view, projectId, permitted, offline, state, reportId, onRetry, chrome, doors, addresses }: SchedulesWorkspaceProps) {
  const { testIds, RefusalState, ConsequenceDialog, EmptyState, Button, NumberInput, IdChip, EnumLabel, UnitBadge, EvidenceLink, Tooltip, TabsAside, InspectorMount } = chrome;

  /** The reading as it stands: the route's, until a committed act makes this screen read it again. */
  const [reading, setReading] = useState<SchedulesView>(view ?? { projectId, setRevisionId: null, sheets: [] });
  useEffect(() => {
    if (view !== null) setReading(view);
  }, [view]);

  const [sheetKey, setSheetKey] = useState<SheetKey | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [answer, setAnswer] = useState<Answer>(null);
  const [pending, setPending] = useState<TranscribeSheetNotesInput | null>(null);
  /** What a door left that no registry entry stands for: held here, raised in render (ARCH-03, B-21). */
  const [fault, setFault] = useState<unknown>(null);

  const sheets = reading.sheets;
  /** The sheet the rail has selected — the first one until a reader chooses another (I-248). */
  const sheet = useMemo(() => sheets.find((held) => sameSheet(sheetKey, held)) ?? sheets[0] ?? null, [sheetKey, sheets]);

  const holdsMeasure = permitted[MEASURE] === true;
  const evidence = useMemo<Evidence>(() => ({ href: addresses.participants, label: OPEN_PARTICIPANTS }), [addresses]);

  /** Where a sheet's own evidence stands: the sheet, at the entities the thing cited (R-UI-022). */
  const traceTo = useCallback(
    (sourceKeys: readonly string[]): string => (sheet === null ? "" : addresses.selection({ drawingId: sheet.drawingId, layoutName: sheet.layoutName }, sourceKeys)),
    [addresses, sheet],
  );

  /**
   * A rejection at a door, answered in place — never a toast, and never a dialog over nothing
   * (R-UI-020, I-255). A failure carrying no registered code is a fault, and a fault belongs to the
   * boundary that owns the report id: it is re-raised untouched rather than dressed as a refusal.
   */
  const refuse = useCallback(
    (code: string | null, thrown: unknown): void => {
      const entry = code === null ? undefined : entryOf(code);
      if (entry === undefined) {
        setFault(() => thrown);
        return;
      }
      setAnswer({ refusal: entry, evidence });
    },
    [evidence],
  );

  /** Read the sheets again, which is what a committed act and the error cell's retry both need. */
  const reread = useCallback((): void => {
    void doors
      .schedules({ projectId })
      .then((answered) => setReading(answered))
      .catch((thrown: unknown) => refuse(codeOf(thrown), thrown));
  }, [doors, projectId, refuse]);

  /** What the person would keep off this sheet: every proposal, at the figure standing in its box. */
  const kept = useCallback(
    (proposals: readonly NoteProposal[]): TranscribeSheetNotesInput | null => {
      if (sheet === null || proposals.length === 0) return null;
      return {
        type: TRANSCRIBE_SHEET_NOTES,
        projectId,
        drawingId: sheet.drawingId,
        layoutName: sheet.layoutName,
        readings: proposals.map((proposal) => ({
          kind: proposal.kind,
          sourceKey: proposal.sourceKey,
          // I-254: what the box holds is what is kept — the grammar's canonical until a reader edits
          // it. Whether that is ACCEPTED or EDITED is the seam's judgement and never this screen's.
          valueAsWritten: drafts[proposal.kind] ?? proposal.canonical,
          unitAsWritten: proposal.unitAsWritten,
        })),
      };
    },
    [drafts, projectId, sheet],
  );

  /**
   * The one door, pre-flighted: a rejection is answered in place and opens NO dialog, and only an
   * answered Consequence opens one — whose own preview runs again, because L-ACT-02's digest must be
   * the one current state produces (I-255, the register's settled I-41).
   */
  const openTranscribe = useCallback(
    (proposals: readonly NoteProposal[]): void => {
      const input = kept(proposals);
      if (input === null) return;
      void (async () => {
        try {
          await doors.previewTranscribeSheetNotes({ input });
        } catch (thrown) {
          refuse(codeOf(thrown), thrown);
          return;
        }
        setAnswer(null);
        setPending(input);
      })();
    },
    [doors, kept, refuse],
  );

  /* ----------------------------------------------------------- the shell's ONE inspector (§3.2) */

  /**
   * What the frame's right column shows, or null — and null means NO COLUMN AT ALL, not a panel
   * saying nothing is selected (R-UI-080, §1). Memoised, because the slot is state in the frame and
   * a node with a new identity every render would set it on every render.
   */
  const inspector = useMemo<ReactNode>(() => {
    if (sheet === null || selected === null) return null;
    if (selected.kind === "cell") {
      const table = sheet.schedules.find((held) => held.scheduleKey === selected.scheduleKey);
      // Every band the grid drew, the header among them: a column's NAME came off the drawing as
      // surely as the figures beneath it, and a reader who chose it is owed the same evidence (I-250).
      const cell = table === undefined ? undefined : bandsOf(table).find((row) => row.rowIndex === selected.rowIndex)?.cells.find((one) => one.columnIndex === selected.columnIndex);
      if (table === undefined || cell === undefined) return null;
      return (
        <div className="cx-schedules-inspector" data-testid={testIds.inspector} data-schedule={table.scheduleKey}>
          <h2 className="cx-schedules-inspector-title">{SCHEDULES_COPY.schedules_inspector_cell_heading}</h2>
          <p className="cx-schedules-mono">{cell.text === "" ? DASH : cell.text}</p>
          <Sources label={SCHEDULES_COPY.schedules_inspector_sources_label} sourceKeys={cell.sourceKeys} IdChip={IdChip} />
          <EnumLabel value={TRANSCRIBED} className="cx-schedules-enum" />
          {cell.sourceKeys.length === 0 ? null : <EvidenceLink href={traceTo(cell.sourceKeys)} basis={TRANSCRIBED} label={cell.text} />}
        </div>
      );
    }
    const held = sheet.notes.readings.find((one) => one.readingKey === selected.readingKey);
    if (held === undefined) return null;
    return (
      <div className="cx-schedules-inspector" data-testid={testIds.inspector} data-kind={held.kind}>
        <h2 className="cx-schedules-inspector-title">{SCHEDULES_COPY.schedules_inspector_reading_heading}</h2>
        <p className="cx-schedules-mono">
          {held.valueAsWritten} {held.unitAsWritten}
        </p>
        <Sources label={SCHEDULES_COPY.schedules_inspector_sources_label} sourceKeys={[held.sourceKey]} IdChip={IdChip} />
        <EnumLabel value={held.kind} label={KIND_SAID[held.kind]} className="cx-schedules-enum" />
        <EnumLabel value={held.basis} className="cx-schedules-enum" />
        <EnumLabel value={held.acceptance} label={held.acceptance === ACCEPTED ? SCHEDULES_COPY.schedules_reading_accepted : SCHEDULES_COPY.schedules_reading_edited} className="cx-schedules-enum" />
        <EvidenceLink href={traceTo([held.sourceKey])} basis={TRANSCRIBED} label={held.sourceKey} />
      </div>
    );
  }, [EnumLabel, EvidenceLink, IdChip, selected, sheet, testIds, traceTo]);

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all,
  // and a press that raised a fault into one would otherwise return with nothing said (R-UI-020).
  if (fault !== null) throw fault;

  /* ------------------------------------------------------------------------------ the state */

  /**
   * §2's order, first holding wins. `denied` is the whole screen's only when EVERY door on it is
   * shut (I-256) — and this screen has one. `partial` is the reading's own deferred half: a view that
   * yielded no table, a kind two people read differently, and a sheet whose words state no figure all
   * stand where they belong and are never hidden (R-UI-050).
   */
  const partial = sheets.some(
    (held) => held.deferrals.length > 0 || held.notes.standings.some((standing) => standing.standing === SUSPENDED) || (held.notes.proposals.length === 0 && held.notes.readings.length === 0),
  );
  const derived = !holdsMeasure
    ? "denied"
    : offline
      ? "offline"
      : answer !== null
        ? "refused"
        : sheets.length === 0
          ? "empty"
          : partial
            ? "partial"
            : "ready";
  const shown = state ?? derived;

  /** R-UI-050's error cell: the read failed, and the report id stands beside the one door that clears it. */
  if (shown === "error") {
    return (
      <div className="cx-schedules" data-testid={testIds.screen} data-state="error">
        <div className="cx-schedules-fault" role="alert">
          <h1 className="cx-schedules-fault-heading">{SCHEDULES_COPY.schedules_error_heading}</h1>
          <p className="cx-schedules-fault-body">{SCHEDULES_COPY.schedules_error_body}</p>
          <p className="cx-schedules-report">
            <span className="cx-schedules-report-label">{SCHEDULES_COPY.schedules_report_label}</span>
            {reportId === undefined || reportId === null ? null : <IdChip value={reportId} />}
          </p>
          <Button variant="secondary" onClick={onRetry ?? reread}>
            {SCHEDULES_COPY.schedules_retry}
          </Button>
        </div>
      </div>
    );
  }

  if (shown === "loading") {
    return (
      <div className="cx-schedules cx-schedules-loading" data-testid={testIds.screen} data-state="loading">
        <LoadingBones Skeleton={chrome.Skeleton} />
      </div>
    );
  }

  return (
    <div className="cx-schedules" data-testid={testIds.screen} data-state={shown} data-revision={reading.setRevisionId ?? ""}>
      {/* §1: this screen's one primary lives in the notes panel, so the lane's tabs row carries no
          aside at all — the mount is claimed and left empty rather than filled with something. */}
      <TabsAside>{null}</TabsAside>
      <InspectorMount>{inspector}</InspectorMount>

      {offline ? (
        <p className="cx-schedules-offline" role="status">
          {SCHEDULES_COPY.schedules_offline}
        </p>
      ) : null}

      {/* R-UI-020: a door's rejection renders in place, through the one renderer, never as a toast.
          The slot is live so an answer is spoken the moment it arrives (R-UI-012). */}
      <div className="cx-schedules-answer" aria-live="polite">
        {shown === "denied" ? (
          <>
            <p className="cx-schedules-denied">{SCHEDULES_COPY.schedules_denied_transcribe}</p>
            <p className="cx-schedules-denied">{SCHEDULES_COPY.schedules_denied_holder}</p>
            <Denied evidence={evidence} RefusalState={RefusalState} />
          </>
        ) : null}
        {answer === null ? null : <RefusalState refusal={answer.refusal} evidence={answer.evidence} />}
      </div>

      {sheets.length === 0 || sheet === null ? (
        <EmptyState
          data-testid={testIds.empty}
          className="cx-schedules-empty"
          heading={SCHEDULES_COPY.schedules_empty_heading}
          body={SCHEDULES_COPY.schedules_empty_body}
        >
          <a className="cx-btn cx-reticle" data-variant="secondary" href={addresses.drawings}>
            <span className="cx-btn-label">{SCHEDULES_COPY.schedules_empty_action}</span>
          </a>
        </EmptyState>
      ) : (
        <div className="cx-schedules-body">
          {/* I-248: the rail selects a SHEET, and main renders what that sheet holds. */}
          <nav className="cx-schedules-panel cx-schedules-sheets" data-testid={testIds.sheets} aria-label={SCHEDULES_COPY.schedules_sheets_heading}>
            <h2 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_sheets_heading}</h2>
            {sheets.map((held) => (
              // The row is the region; the sheet's NAME is the control that chooses it. The drawing's
              // surrogate stands BESIDE that control rather than inside it, because an `IdChip` owns a
              // copy button, and a control inside a control is one neither a pointer nor a screen
              // reader can address (R-UI-060, R-UI-082) — the s-levels range row composes the same
              // way. The row hears the click, so choosing a sheet is the whole row's business and the
              // button's own activation, by pointer or by Enter, reaches it by bubbling.
              <div
                key={`${held.drawingId} ${held.layoutName}`}
                className="cx-schedules-sheet-row"
                data-testid={testIds.sheetRow}
                data-drawing={held.drawingId}
                data-layout={held.layoutName}
                aria-current={sameSheet({ drawingId: sheet.drawingId, layoutName: sheet.layoutName }, held) ? "true" : undefined}
                onClick={() => {
                  setSheetKey({ drawingId: held.drawingId, layoutName: held.layoutName });
                  setSelected(null);
                  setDrafts({});
                }}
              >
                <button type="button" className="cx-schedules-sheet-choose cx-reticle">
                  <span className="cx-schedules-sheet-name">{held.layoutName}</span>
                  <span className="cx-schedules-sheet-holds">{holdsSaid(held)}</span>
                </button>
                {/* The chip does not hold its click back: a pointer anywhere in this row chose this
                    row, and copying the drawing's id while choosing the sheet it belongs to is what
                    a reader meant by aiming there (R-UI-031). */}
                <span className="cx-schedules-sheet-id">
                  <IdChip value={held.drawingId} />
                </span>
              </div>
            ))}
          </nav>

          <div className="cx-schedules-work">
            <section className="cx-schedules-tables" aria-label={SCHEDULES_COPY.schedules_tables_heading}>
              {sheet.schedules.length === 0 ? null : <h2 className="cx-schedules-section-heading">{SCHEDULES_COPY.schedules_tables_heading}</h2>}
              {sheet.schedules.map((table) => (
                <ScheduleGrid
                  key={table.scheduleKey}
                  table={table}
                  testIds={testIds}
                  DataTable={chrome.DataTable}
                  EvidenceLink={EvidenceLink}
                  href={(sourceKeys) => traceTo(sourceKeys)}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))}
              {sheet.deferrals.map((deferral) => (
                <Deferral key={deferral.viewKey} code={deferral.reason} href={traceTo([])} RefusalState={RefusalState} testId={testIds.deferral} />
              ))}
            </section>

            {/* I-253: the answer, then the record, then the offer. */}
            <section className="cx-schedules-notes" data-testid={testIds.notes} aria-label={SCHEDULES_COPY.schedules_notes_heading}>
              <h2 className="cx-schedules-section-heading">{SCHEDULES_COPY.schedules_notes_heading}</h2>
              {sheet.notes.proposals.length === 0 && sheet.notes.readings.length === 0 ? (
                <Silent href={traceTo([])} RefusalState={RefusalState} />
              ) : (
                <>
                  <h3 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_standing_heading}</h3>
                  {sheet.notes.standings.map((standing) => (
                    <Standing key={standing.kind} standing={standing} testId={testIds.standing} href={traceTo([])} EnumLabel={EnumLabel} RefusalState={RefusalState} UnitBadge={UnitBadge} />
                  ))}

                  <h3 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_readings_heading}</h3>
                  {readingsOfRecord(sheet.notes.readings).map((held) => (
                    <Reading
                      // The act is what tells two rows apart: a superseded reading and the reading
                      // that took its place stand under the SAME note key, and only the act each was
                      // written by separates them — while one act writes one reading per note key
                      // (L-ACT-01).
                      key={`${held.actId} ${held.readingKey}`}
                      reading={held}
                      testId={testIds.reading}
                      href={traceTo([held.sourceKey])}
                      EnumLabel={EnumLabel}
                      EvidenceLink={EvidenceLink}
                      Tooltip={Tooltip}
                      onSelect={() => setSelected({ kind: "reading", readingKey: held.readingKey })}
                    />
                  ))}

                  {sheet.notes.proposals.length === 0 ? null : (
                    <>
                      <h3 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_proposals_heading}</h3>
                      {sheet.notes.proposals.map((proposal) => (
                        <Proposal
                          key={`${proposal.kind} ${proposal.sourceKey}`}
                          proposal={proposal}
                          testIds={testIds}
                          href={traceTo([proposal.sourceKey])}
                          value={drafts[proposal.kind] ?? proposal.canonical}
                          stands={standsAt(sheet, proposal, drafts[proposal.kind] ?? proposal.canonical)}
                          onValue={(value) => setDrafts((held) => ({ ...held, [proposal.kind]: value }))}
                          EnumLabel={EnumLabel}
                          EvidenceLink={EvidenceLink}
                          NumberInput={NumberInput}
                        />
                      ))}
                      <TranscribeDoor
                        testId={testIds.transcribe}
                        held={holdsMeasure}
                        offline={offline}
                        onPress={() => openTranscribe(sheet.notes.proposals)}
                        Button={Button}
                        Tooltip={Tooltip}
                      />
                    </>
                  )}
                </>
              )}
            </section>

            {/* I-249: the registry yields its height to the inspector, and stays a disclosure. */}
            <section className="cx-schedules-panel cx-schedules-registry" data-testid={testIds.registry} data-collapsed={selected === null ? "false" : "true"}>
              <h2 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_registry_heading}</h2>{" "}
              {sheet.families.length === 0 ? <p className="cx-schedules-none-said">{SCHEDULES_COPY.schedules_registry_none}</p> : null}
              {sheet.families.map((family) => (
                <Family key={family.family} family={family} testIds={testIds} href={(sourceKeys) => traceTo(sourceKeys)} EvidenceLink={EvidenceLink} IdChip={IdChip} />
              ))}
            </section>
          </div>
        </div>
      )}

      {pending === null ? null : (
        <ConsequenceDialog
          open
          actType={TRANSCRIBE_SHEET_NOTES}
          preview={previewOf(doors, pending, evidence)}
          commit={commitOf(doors, pending, evidence)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPending(null);
          }}
          onCommitted={() => {
            setPending(null);
            // The sheet's readings moved, so the screen reads them again: what stands and what is
            // suspended is the record's answer, never this screen's arithmetic over what it sent.
            reread();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------ the pieces */

/** What a sheet holds, said in the rail's own muted words (§1, §3). */
function holdsSaid(sheet: SheetView): string {
  const said: string[] = [];
  if (sheet.schedules.length > 0) said.push(SCHEDULES_COPY.schedules_sheet_holds_schedule);
  if (sheet.notes.proposals.length > 0 || sheet.notes.readings.length > 0) said.push(SCHEDULES_COPY.schedules_sheet_holds_notes);
  if (sheet.deferrals.length > 0) said.push(SCHEDULES_COPY.schedules_sheet_holds_deferral);
  return said.join(" · ");
}

/**
 * Whether a proposal, at the figure standing in its box, already stands under this reader's own
 * record — the reason a preview of it would move nothing (I-255). Read off the readings the sheet
 * holds rather than decided here: what the seam would refuse is what the record says.
 */
function standsAt(sheet: SheetView, proposal: NoteProposal, value: string): boolean {
  return sheet.notes.readings.some(
    (reading) => reading.kind === proposal.kind && reading.sourceKey === proposal.sourceKey && reading.canonical === value && reading.unitAsWritten === proposal.unitAsWritten,
  );
}

/** The same rejection, shaped as the one ConsequenceDialog reads one (its I-40). */
function refused(thrown: unknown, evidence: Evidence): never {
  const code = codeOf(thrown);
  const entry = code === null ? undefined : entryOf(code);
  if (entry === undefined) throw thrown;
  throw Object.assign(new Error(entry.code), { refusal: entry, evidence });
}

/** The preview the dialog runs for itself: state's own digest, taken again at the moment of showing. */
function previewOf(doors: SchedulesDoors, input: TranscribeSheetNotesInput, evidence: Evidence): () => Promise<PreviewAnswer> {
  return async () => {
    try {
      return await doors.previewTranscribeSheetNotes({ input });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The commit the dialog's confirm carries, bound to the digest it showed (L-ACT-02). */
function commitOf(doors: SchedulesDoors, input: TranscribeSheetNotesInput, evidence: Evidence): (carried: { consequenceDigest: string }) => Promise<{ actId: string }> {
  return async (carried) => {
    try {
      return await doors.commitTranscribeSheetNotes({ input, consequenceDigest: carried.consequenceDigest });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The registered denial, rendered through the one renderer or not at all (R-UI-020, B-17). */
function Denied({ evidence, RefusalState }: { evidence: Evidence; RefusalState: SchedulesChrome["RefusalState"] }) {
  const entry = entryOf(PERMISSION_NOT_HELD);
  if (entry === undefined) return null;
  return <RefusalState refusal={entry} evidence={evidence} />;
}

/** A sheet whose words state no figure, saying so through the one renderer (Decision §1, R-UI-020). */
function Silent({ href, RefusalState }: { href: string; RefusalState: SchedulesChrome["RefusalState"] }) {
  const entry = entryOf(NOTES_NONE_PROPOSED);
  if (entry === undefined) return null;
  return <RefusalState refusal={entry} evidence={{ href, label: OPEN_THE_SHEET }} />;
}

/** A schedule view that yielded no table, stated where it belongs and never silently (R-UI-050). */
function Deferral({ code, href, RefusalState, testId }: { code: string; href: string; RefusalState: SchedulesChrome["RefusalState"]; testId: string }) {
  const entry = entryOf(code);
  if (entry === undefined) return null;
  return (
    <div className="cx-schedules-deferral" data-testid={testId} data-code={entry.code}>
      <RefusalState refusal={entry} evidence={{ href, label: OPEN_THE_SHEET }} />
    </div>
  );
}

/** The keys something was read from, as chips — data beside a label, never woven into a sentence (I-26). */
function Sources({ label, sourceKeys, IdChip }: { label: string; sourceKeys: readonly string[]; IdChip: SchedulesChrome["IdChip"] }) {
  if (sourceKeys.length === 0) return null;
  return (
    <p className="cx-schedules-sources">
      <span className="cx-schedules-label">{label}</span>
      {sourceKeys.map((key) => (
        <IdChip key={key} value={key} />
      ))}
    </p>
  );
}

/**
 * One stored schedule, rendered exactly as it was stored (I-250). The stored header band names the
 * columns AND stands as a band of its own, because every cell that came from a drawing carries its
 * own trace — a header cell the screen swallowed into a column label would be a reading with no
 * evidence behind it (R-UI-022, I-252).
 */
function ScheduleGrid({
  table,
  testIds,
  DataTable,
  EvidenceLink,
  href,
  selected,
  onSelect,
}: {
  table: ScheduleTableView;
  testIds: SchedulesTestIds;
  DataTable: SchedulesChrome["DataTable"];
  EvidenceLink: SchedulesChrome["EvidenceLink"];
  href: (sourceKeys: readonly string[]) => string;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  const rowsDrawn = useRowsDrawn(region, table.rows.length);
  const columns = columnsOf(table);

  /**
   * One band's cell at one column, wherever that band stands. The stored header band renders through
   * this too: its cells are `schedules-cell`s citing their own entities, because the words naming a
   * column came off the drawing exactly as the figures beneath them did (I-250, I-252, R-UI-022).
   */
  const cellAt = (band: BandRow, columnIndex: number): ReactNode => {
    const cell = band.cells.find((one) => one.columnIndex === columnIndex);
    if (cell === undefined) return <span className="cx-schedules-none">{DASH}</span>;
    const chosen = selected !== null && selected.kind === "cell" && selected.scheduleKey === table.scheduleKey && selected.rowIndex === band.rowIndex && selected.columnIndex === columnIndex;
    return (
      <span className="cx-schedules-cell" data-testid={testIds.cell} data-row={band.rowIndex} data-column={columnIndex} data-selected={chosen ? "true" : undefined}>
        {/* I-252: a cell whose stored text is empty renders no anchor — a link without a place is
            not withheld chrome, it is an honest absence. */}
        {cell.text === "" ? <span className="cx-schedules-none">{DASH}</span> : <EvidenceLink href={href(cell.sourceKeys)} basis={TRANSCRIBED} label={cell.text} />}
      </span>
    );
  };

  const drawn: BandColumn[] = columns.map((columnIndex, at) => ({
    id: `column:${columnIndex}`,
    header: () => (table.header === undefined ? null : cellAt(table.header, columnIndex)),
    enableSorting: false,
    ...(at === 0 ? { size: widthOfMarkColumn(table) } : {}),
    cell: ({ row }: BandCell) => cellAt(row.original, columnIndex),
  }));

  return (
    <div
      ref={region}
      className="cx-schedules-table"
      data-testid={testIds.table}
      data-schedule={table.scheduleKey}
      data-rows-rendered={rowsDrawn}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        const target = event.target instanceof Element ? event.target : null;
        const cell = target?.closest(`[data-testid="${testIds.cell}"]`) ?? null;
        if (cell === null) return;
        const rowIndex = Number(cell.getAttribute("data-row"));
        const columnIndex = Number(cell.getAttribute("data-column"));
        if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) return;
        // A pointer click inside the grid CHOOSES the cell: the inspector is where a cell's whole
        // evidence stands, and a screen that navigated away on the first click would never show it.
        // The trace itself is still a place — keyboard activation (`detail === 0`) and every modified
        // click are left to the browser, so Back still returns to this screen (R-UI-022, I-178).
        if (event.detail > 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
        onSelect({ kind: "cell", scheduleKey: table.scheduleKey, rowIndex, columnIndex });
      }}
    >
      <p className="cx-schedules-table-title">
        <span>{table.title}</span>
        <span className="cx-schedules-table-rows">{fillCopy("schedules_table_rows", { count: formatUserFigure(String(table.rows.length)) })}</span>
      </p>
      <DataTable
        tableId={`takeoff-schedule:${table.scheduleKey}`}
        columns={drawn}
        data={[...table.rows]}
        getRowId={(row) => String(row.rowIndex)}
        freezeKeyColumn
        aria-label={table.title}
      />
    </div>
  );
}

/**
 * How wide the frozen mark column is drawn: its own widest stored cell, inside §5's 120–280. The
 * table's other columns are not this file's business — a reconstructed schedule's columns are not
 * known to it, and the shipped table divides the rest evenly.
 */
function widthOfMarkColumn(table: ScheduleTableView): number {
  const first = columnsOf(table)[0];
  if (first === undefined) return WIDTH_MARK_MIN;
  const widest = Math.max(0, ...bandsOf(table).map((row) => row.cells.find((cell) => cell.columnIndex === first)?.text.length ?? 0));
  return Math.min(WIDTH_MARK_MAX, Math.max(WIDTH_MARK_MIN, widest * MONO_CHAR_PX));
}

/** One mark family of the registry: what the schedule said a member IS, and never how many (I-251). */
function Family({
  family,
  testIds,
  href,
  EvidenceLink,
  IdChip,
}: {
  family: FamilyView;
  testIds: SchedulesTestIds;
  href: (sourceKeys: readonly string[]) => string;
  EvidenceLink: SchedulesChrome["EvidenceLink"];
  IdChip: SchedulesChrome["IdChip"];
}) {
  return (
    <div className="cx-schedules-family" data-testid={testIds.family} data-family={family.family}>
      {/* The trace is labelled with the MARK the registry filed this family under — the same word
          `data-family` carries, and the word every variant and zone beneath it is spoken of by. The
          mark cell's own spelling stands beside it, verbatim, because the registry states what the
          schedule wrote and never only what it normalises to (I-251, L-CAD-08). */}
      {/* The `{" "}` between two inline pieces is a WORD BREAK and not layout: two spans set side by
          side read as one run of text to anything that takes the text rather than the picture — a
          screen reader, a copy, a translation — and `Mark C1` must not become `MarkC1` (R-UI-060).
          The gaps a reader SEES are §5's tokens, and these are beneath them. */}
      <p className="cx-schedules-family-mark">
        <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_registry_mark}</span>{" "}
        <EvidenceLink href={href(family.sourceKeys)} basis={TRANSCRIBED} label={family.family} />{" "}
        <span className="cx-schedules-mono">{family.markText}</span>{" "}
      </p>
      {family.variants.map((variant) => (
        <div className="cx-schedules-variant" key={variant.variantKey} data-testid={testIds.variant} data-variant={variant.variantKey}>
          <p className="cx-schedules-variant-band">
            <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_registry_band}</span>{" "}
            <span className="cx-schedules-mono">{variant.bandText === "" ? DASH : variant.bandText}</span>{" "}
            <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_registry_section}</span>{" "}
            <span className="cx-schedules-mono">{variant.sectionText === "" ? DASH : variant.sectionText}</span>{" "}
            {/* The variant's key is said WHOLE: it is the band the schedule named (`GF TO 3RD`), not
                an opaque surrogate, and seven leading characters of it would be a word the drawing
                never wrote (R-UI-082, I-251). */}
            <IdChip value={variant.variantKey} short={variant.variantKey} />{" "}
          </p>
          {variant.zones.map((zone) => (
            // The zone is said in the store's own word rather than through `EnumLabel`: this pane
            // states what the schedule WROTE and nothing it was read as, and the zone is the one enum
            // on it the partition itself spelled (I-251, L-CAD-08). The value is on `data-zone`
            // either way, which is where a suite matches it.
            <p className="cx-schedules-zone" key={zone.zone} data-testid={testIds.zone} data-zone={zone.zone}>
              <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_registry_zone}</span>{" "}
              <span className="cx-schedules-enum">{zone.zone}</span>{" "}
              <span className="cx-schedules-mono">{zone.text}</span>{" "}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * How one kind stands (I-253). A SUSPENDED standing renders NO figure — a number printed beside the
 * word *suspended* is the claim the suspension denies — and the row expands to hold exactly one
 * RefusalState under the code the absence is refused by.
 */
function Standing({
  standing,
  testId,
  href,
  EnumLabel,
  RefusalState,
  UnitBadge,
}: {
  standing: StandingView;
  testId: string;
  href: string;
  EnumLabel: SchedulesChrome["EnumLabel"];
  RefusalState: SchedulesChrome["RefusalState"];
  UnitBadge: SchedulesChrome["UnitBadge"];
}) {
  const entry = standing.code === null ? undefined : entryOf(standing.code);
  const stands = standing.standing === AGREED && standing.canonical !== null;
  return (
    <div className="cx-schedules-standing" data-testid={testId} data-kind={standing.kind} data-standing={standing.standing} data-code={standing.code ?? ""}>
      <EnumLabel value={standing.kind} label={KIND_SAID[standing.kind]} className="cx-schedules-enum" />
      <EnumLabel value={standing.standing} label={STANDING_SAID[standing.standing] ?? STANDING_SAID[NONE]} className="cx-schedules-enum" />
      {stands ? <span className="cx-schedules-figure cx-schedules-mono">{formatUserFigure(standing.canonical as string)}</span> : <span className="cx-schedules-none">{DASH}</span>}
      {stands && standing.unitAsWritten !== null && standing.unitAsWritten !== "" ? <UnitBadge unit={standing.unitAsWritten} /> : null}
      {entry === undefined ? null : <RefusalState refusal={entry} evidence={{ href, label: OPEN_THE_SHEET }} />}
    </div>
  );
}

/** One committed reading, with the verdict the SEAM gave it — reported, never decided here (I-254). */
function Reading({
  reading,
  testId,
  href,
  EnumLabel,
  EvidenceLink,
  Tooltip,
  onSelect,
}: {
  reading: ReadingView;
  testId: string;
  href: string;
  EnumLabel: SchedulesChrome["EnumLabel"];
  EvidenceLink: SchedulesChrome["EvidenceLink"];
  Tooltip: SchedulesChrome["Tooltip"];
  onSelect: () => void;
}) {
  const said = (
    <div
      className="cx-schedules-reading"
      data-testid={testId}
      data-kind={reading.kind}
      data-acceptance={reading.acceptance}
      data-basis={reading.basis}
      data-source={reading.sourceKey}
      // §7: the mark stands only on a reading a later one replaced — a row saying `false` would make
      // every standing reading carry the word for the thing it is not.
      data-superseded={reading.superseded ? "true" : undefined}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        // The same reading the grid takes: a pointer click chooses the row, and the trace stays a
        // place a keyboard or a modified click still opens (R-UI-022, I-178).
        if (event.detail > 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
        onSelect();
      }}
    >
      <EnumLabel value={reading.kind} label={KIND_SAID[reading.kind]} className="cx-schedules-enum" />
      <span className="cx-schedules-mono">
        {reading.valueAsWritten} {reading.unitAsWritten}
      </span>
      <EnumLabel
        value={reading.acceptance}
        label={reading.acceptance === ACCEPTED ? SCHEDULES_COPY.schedules_reading_accepted : SCHEDULES_COPY.schedules_reading_edited}
        className="cx-schedules-enum"
      />
      <EvidenceLink href={href} basis={TRANSCRIBED} label={reading.sourceKey} />
    </div>
  );
  return reading.superseded ? <Tooltip content={SCHEDULES_COPY.schedules_reading_superseded}>{said}</Tooltip> : said;
}

/** One figure the sheet offers, and the box a reader may keep another in — typing moves nothing (I-254). */
function Proposal({
  proposal,
  testIds,
  href,
  value,
  stands,
  onValue,
  EnumLabel,
  EvidenceLink,
  NumberInput,
}: {
  proposal: NoteProposal;
  testIds: SchedulesTestIds;
  href: string;
  value: string;
  stands: boolean;
  onValue: (value: string) => void;
  EnumLabel: SchedulesChrome["EnumLabel"];
  EvidenceLink: SchedulesChrome["EvidenceLink"];
  NumberInput: SchedulesChrome["NumberInput"];
}) {
  return (
    <div className="cx-schedules-proposal" data-testid={testIds.proposal} data-kind={proposal.kind}>
      <EnumLabel value={proposal.kind} label={KIND_SAID[proposal.kind]} className="cx-schedules-enum" />
      <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_proposal_written_label}</span>
      <EvidenceLink href={href} basis={TRANSCRIBED} label={proposal.valueAsWritten} />
      <label className="cx-schedules-field">
        <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_proposal_value_label}</span>
        <NumberInput value={value} data-testid={testIds.proposalValue} aria-label={`${KIND_SAID[proposal.kind]} ${SCHEDULES_COPY.schedules_proposal_value_label}`} onChange={onValue} />
      </label>
      <span className="cx-schedules-unit cx-schedules-mono">{proposal.unitAsWritten}</span>
      {/* I-255: a reader sees the reason a preview would move nothing BEFORE they press. */}
      {stands ? <span className="cx-schedules-already">{SCHEDULES_COPY.schedules_proposal_already_read}</span> : null}
    </div>
  );
}

/**
 * The one door of this screen (I-256). A reader who holds MEASURE presses the shipped Button; a
 * reader who does not is shown the same affordance, refusing the press and NAMING the permission that
 * would have carried it — a door that vanished teaches nobody what to ask for.
 */
function TranscribeDoor({
  testId,
  held,
  offline,
  onPress,
  Button,
  Tooltip,
}: {
  testId: string;
  held: boolean;
  offline: boolean;
  onPress: () => void;
  Button: SchedulesChrome["Button"];
  Tooltip: SchedulesChrome["Tooltip"];
}) {
  if (held && !offline) {
    return (
      <Button variant="primary" data-testid={testId} data-permission={MEASURE} onClick={onPress}>
        {SCHEDULES_COPY.schedules_transcribe}
      </Button>
    );
  }
  // Offline is not a denial. A reader who HOLDS the permission is told what is true — the connection
  // is gone and nothing can be committed — and the door publishes no `data-permission`, because
  // claiming a permission this reader in fact holds would be a false statement about their standing.
  return (
    <Tooltip content={held ? SCHEDULES_COPY.schedules_offline : SCHEDULES_COPY.schedules_denied_transcribe}>
      <span
        className="cx-btn cx-reticle cx-schedules-door-shut"
        data-variant="primary"
        role="button"
        tabIndex={0}
        aria-disabled="true"
        data-testid={testId}
        {...(held ? {} : { "data-permission": MEASURE })}
      >
        <span className="cx-btn-label">{SCHEDULES_COPY.schedules_transcribe}</span>
      </span>
    </Tooltip>
  );
}

/** The bones that keep this screen's own layout while the route holds it (R-UI-004, §2). */
function LoadingBones({ Skeleton }: { Skeleton: SchedulesChrome["Skeleton"] }) {
  return (
    <div className="cx-schedules-body">
      <Skeleton style={BONE_RAIL} />
      <Skeleton style={BONE_WORK} />
      <Skeleton style={BONE_REGISTRY} />
    </div>
  );
}

const BONE_RAIL = { height: "100%", width: "200px" };
const BONE_WORK = { height: "100%", width: "100%" };
const BONE_REGISTRY = { height: "240px", width: "100%" };
