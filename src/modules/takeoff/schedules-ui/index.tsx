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
import { inWords } from "@/core/documents/kinds/boq-draft-law";
import { displayText } from "@/core/entitygraph/text";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatUserFigure } from "@/core/format";
import type { NoteProposal } from "@/core/notes/grammar";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { isDecimalFigure } from "@/core/projects";
import { SCHEDULES_COPY, fillCopy } from "./copy";
import { keptReadingOf } from "./kept";
import {
  MODEL_SPACE,
  type FamilyView,
  type PrintedView,
  type ProposalView,
  type ReadingView,
  type ScheduleTableView,
  type SchedulesView,
  type SheetView,
  type StandingView,
  type VariantView,
} from "./view";

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
  /** A column every stored cell of which is a bare figure reads right-aligned (R-UI-083, I-sch-1). */
  meta?: { align?: "right" };
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
  /** The schedules region's own scrolling frame — the PRIMARY work surface §1 names (I-288). */
  readonly grid: string;
  readonly table: string;
  readonly cell: string;
  readonly deferral: string;
  /** An opening row whose printed quantity is declared rather than read as it stands (I-510). */
  readonly quantityCheck: string;
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
  /**
   * A registry code the ROUTE holds this screen refused at, answered in the answer slot as a door's
   * own rejection is — the refused cell as §2 rules it, without a door having to be pressed for it.
   * Left null, only a door's own rejection fills that slot (R-UI-020, I-255).
   */
  readonly refusal?: string | null;
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
 * The four rebar zones in words, under the same rule — §3's vocabulary, the raw zone beside it. Each
 * says only words its own value holds, so a zone row still says nothing the store did not (I-251).
 */
const ZONE_SAID: Readonly<Record<string, string>> = Object.freeze({ main: "Main", ties: "Ties", "ties-end": "End ties", "ties-mid": "Mid ties" });

/** The model space in words, under the same rule — §3's vocabulary, the raw kind beside it (I-353). */
const MODEL_SPACE_SAID = "Model space";

/**
 * A drawing's own words as the drawing SHOWS them (I-sch-1): the DXF control codes a TEXT carries —
 * `%%C` for the diameter sign, `%%D`, `%%P` and the formatting toggles — resolved by the one reading
 * of what a text shows, the reading the sheet is lettered by and the viewer's inspector says
 * (`displayText`, L-CAD-02, B-17, I-465). Only what a reader SEES goes through it; every
 * attribute, key and stored string keeps the text byte for byte.
 */
function drawn(text: string): string {
  return displayText(text);
}

/**
 * What a variant's Band cell says (I-436, I-sch-1(c)). A variant whose schedule states no band of
 * floors says its band is absent. A band the notation read in the stored text itself is that text,
 * verbatim; a band read off a longer text — a strip sheet's title — is said by its two ends in the
 * grammar's own words, joined by the one sentence the string table rules (`1ST`, `2ND TO 6TH`). A
 * variant the store was not asked the face of says its band text, as it always did.
 */
function bandSaid(variant: VariantView): string {
  if (variant.bandText === "" || variant.banded === false || variant.bandFace === null) return DASH;
  const face = variant.bandFace;
  if (face === undefined) return drawn(variant.bandText);
  if ("written" in face) return drawn(face.written);
  return face.from === face.to ? drawn(face.from) : fillCopy("schedules_registry_band_span", { from: drawn(face.from), to: drawn(face.to) });
}

/**
 * The stored text a variant's band was read AT, where the cell says something shorter — a strip
 * sheet's title behind `2ND TO 6TH` — as the drawing shows it; null where the cell says the stored
 * text itself, or nothing (I-436).
 */
function bandReadOff(variant: VariantView): string | null {
  const face = variant.bandFace;
  return face === undefined || face === null || "written" in face || variant.banded === false ? null : drawn(variant.bandText);
}

/**
 * What a committed reading says: its figure, once, through the format seam, and the unit it was
 * written in (§1's reading row, "canonical + unit"; I-437). The value as written is the drawing's
 * own words and already carries the unit (`500 MPa`, `50d`), so printing it beside the unit said the
 * unit twice (`500 MPa MPa`); it stays in the store and on the proposal row's *As written* trace.
 */
function readingSaid(reading: Pick<ReadingView, "canonical" | "unitAsWritten">): string {
  return `${figureSaid(reading.canonical)} ${reading.unitAsWritten}`.trim();
}

/**
 * A reading's canonical figure through the format seam. The seam refuses what is not a decimal
 * (L-FMT-02), and a value that states no figure canonicalises to its own words (`canonicalFigure`):
 * those are said as the reader wrote them, judged by the product's one decimal grammar before the
 * seam is asked, rather than a refused format taking the screen down.
 */
function figureSaid(canonical: string): string {
  return isDecimalFigure(canonical) ? formatUserFigure(canonical) : canonical;
}

/** A stored cell that is a bare figure — digits and their separators, nothing else (R-UI-083). */
const BARE_FIGURE = /^[0-9][0-9.,\s]*$/;

/**
 * The words §3's refusal table gives each entry's evidence link. They are not keys of the string
 * registry either, for the same reason: the table states them in its own column rather than by key.
 */
const OPEN_THE_SHEET = "Open the sheet";
const OPEN_THE_PLAN = "Open the plan";
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

export function SchedulesWorkspace({ view, projectId, permitted, offline, state, refusal, reportId, onRetry, chrome, doors, addresses }: SchedulesWorkspaceProps) {
  const { testIds, RefusalState, ConsequenceDialog, EmptyState, Button, NumberInput, IdChip, EnumLabel, UnitBadge, EvidenceLink, Tooltip, TabsAside, InspectorMount } = chrome;

  /** The reading as it stands: the route's, until a committed act makes this screen read it again. */
  const [reading, setReading] = useState<SchedulesView>(view ?? { projectId, setRevisionId: null, sheets: [] });
  useEffect(() => {
    if (view !== null) setReading(view);
  }, [view]);

  const [sheetKey, setSheetKey] = useState<SheetKey | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  /** What stands in each proposal's box, under `draftKey` — one box per (kind, sourceKey), never per kind. */
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  // A code the route holds the screen refused at stands in the slot from the first paint; every other
  // rejection reaches it through `refuse`, which is the only other thing that writes here.
  const [answer, setAnswer] = useState<Answer>(() => {
    const entry = refusal === undefined || refusal === null ? undefined : entryOf(refusal);
    return entry === undefined ? null : { refusal: entry, evidence: { href: addresses.participants, label: OPEN_PARTICIPANTS } };
  });
  const [pending, setPending] = useState<TranscribeSheetNotesInput | null>(null);
  /** What a door left that no registry entry stands for: held here, raised in render (ARCH-03, B-21). */
  const [fault, setFault] = useState<unknown>(null);

  const sheets = reading.sheets;
  /** The one drawing every sheet of the rail belongs to, where they all belong to one (I-sch-1). */
  const oneDrawing = useMemo(() => {
    const drawings = new Set(sheets.map((held) => held.drawingId));
    return drawings.size === 1 ? ([...drawings][0] ?? null) : null;
  }, [sheets]);
  /**
   * The sheet the rail has selected — until a reader chooses another, the first sheet holding a
   * schedule, which is what a reader came to this screen for; the rail's first sheet where none holds
   * one (I-248, I-551).
   */
  const sheet = useMemo(() => sheets.find((held) => sameSheet(sheetKey, held)) ?? sheets.find((held) => held.schedules.length > 0) ?? sheets[0] ?? null, [sheetKey, sheets]);

  /**
   * What the schedules region publishes as its rendered contract (I-288, §7 C10): the bands the
   * chosen sheet's stored tables hold, added up and nothing else. Each table still states what IT
   * drew, off the grid's own number; this is the frame's statement about the whole region, so it is
   * the SUM OF THE STORED COUNTS each table was handed — the screen counts nothing of its own
   * (I-250). A sheet holding notes and no table says `0`, which is the truth about that sheet and
   * not a region that failed to paint.
   */
  const rowsDrawn = sheet === null ? 0 : sheet.schedules.reduce((total, table) => total + table.rows.length, 0);

  const holdsMeasure = permitted[MEASURE] === true;
  const evidence = useMemo<Evidence>(() => ({ href: addresses.participants, label: OPEN_PARTICIPANTS }), [addresses]);

  /** Where a sheet's own evidence stands: the sheet, at the entities the thing cited (R-UI-022). */
  const traceTo = useCallback(
    (sourceKeys: readonly string[]): string => (sheet === null ? "" : addresses.selection({ drawingId: sheet.drawingId, layoutName: sheet.layoutName }, sourceKeys)),
    [addresses, sheet],
  );

  /**
   * I-563: where a refused door is resolved. A permission is granted on the participants screen,
   * so the denial's link goes there; every other refusal at this door — a reading that would change
   * nothing, a source not on the sheet — is resolved on the sheet the readings are read from, at the
   * notes they cite, never on a screen that has nothing to do with notes.
   */
  const evidenceFor = useCallback(
    (code: string): Evidence =>
      code === PERMISSION_NOT_HELD || sheet === null
        ? evidence
        : { href: traceTo(sheet.notes.proposals.map((proposal) => proposal.sourceKey)), label: OPEN_THE_SHEET },
    [evidence, sheet, traceTo],
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
      setAnswer({ refusal: entry, evidence: evidenceFor(entry.code) });
    },
    [evidenceFor],
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
        // I-254: what the box holds is what is kept — the drawing's own words until a reader edits
        // them. Whether that is ACCEPTED or EDITED is the seam's judgement and never this screen's.
        readings: proposals.map((proposal) => keptReadingOf({ ...proposal, draft: drafts[draftKey(proposal)] })),
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
          <p className="cx-schedules-mono">{cell.text === "" ? DASH : drawn(cell.text)}</p>
          <Sources label={SCHEDULES_COPY.schedules_inspector_sources_label} sourceKeys={cell.sourceKeys} IdChip={IdChip} />
          <EnumLabel value={TRANSCRIBED} className="cx-schedules-enum" />
          {cell.sourceKeys.length === 0 ? null : <EvidenceLink href={traceTo(cell.sourceKeys)} basis={TRANSCRIBED} label={drawn(cell.text)} />}
        </div>
      );
    }
    const held = sheet.notes.readings.find((one) => one.readingKey === selected.readingKey);
    if (held === undefined) return null;
    return (
      <div className="cx-schedules-inspector" data-testid={testIds.inspector} data-kind={held.kind}>
        <h2 className="cx-schedules-inspector-title">{SCHEDULES_COPY.schedules_inspector_reading_heading}</h2>
        <p className="cx-schedules-mono">{readingSaid(held)}</p>
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
   * shut (I-256) — and this screen has one.
   *
   * The three cells the reading itself decides — empty, partial, ready — are read off the SHEET the
   * rail has chosen and never off the revision's whole list (I-248, I-257). The sheet is the subject:
   * what a reader is looking at is what the screen is in the state of, and a view that deferred on
   * some other sheet is that sheet's word to say when it is chosen. `partial` is therefore this
   * sheet's own deferred half — a schedule view that yielded no table, or a kind two people read
   * differently — standing beside the rows that do stand (R-UI-050).
   *
   * A sheet whose texts state no figure is NOT partial by that alone: the notes panel says so in
   * place, and a sheet is empty only where nothing it holds stands at all — no table, no deferral,
   * no member type, no proposal and no reading (AC-8's reading of R-UI-050).
   */
  // A declared quantity check is this sheet's own deferred half too (I-510): an opening whose
  // printed quantity stands against its plan, or on no stated basis, stands beside what is read.
  const partial =
    sheet !== null && (sheet.deferrals.length > 0 || declaredChecksOf(sheet).length > 0 || sheet.notes.standings.some((standing) => standing.standing === SUSPENDED));
  const stands =
    sheet !== null && (sheet.schedules.length > 0 || sheet.deferrals.length > 0 || sheet.families.length > 0 || sheet.notes.proposals.length > 0 || sheet.notes.readings.length > 0);
  const derived = !holdsMeasure
    ? "denied"
    : offline
      ? "offline"
      : answer !== null
        ? "refused"
        : sheets.length === 0 || sheet === null || !stands
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

      {/* The screen's own name, read and not shown (R-UI-012, s-bbs I-289's rule): the frame prints
          it in the crumb, and every panel heading beneath is an h2, so the page has one h1. */}
      <h1 className="cx-schedules-name">{SCHEDULES_COPY.takeoff_nav_schedules}</h1>

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
            {/* The drawing's chip stands ONCE, beside the heading, where every sheet of the rail is a
                sheet of one drawing — the same chip on every row said one fact twenty-five times and
                took the width the sheet names need (R-UI-082, I-sch-1). Across two drawings or more
                each row carries its own, because then it tells the rows apart. */}
            <div className="cx-schedules-sheets-head">
              <h2 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_sheets_heading}</h2>
              {oneDrawing === null ? null : (
                <span className="cx-schedules-sheet-id">
                  <IdChip value={oneDrawing} />
                </span>
              )}
            </div>
            {sheets.map((held) => (
              // The row is the region; the sheet's NAME is the control that chooses it. The drawing's
              // surrogate stands BESIDE that control rather than inside it, because an `IdChip` owns a
              // copy button, and a control inside a control is one neither a pointer nor a screen
              // reader can address (R-UI-060, R-UI-082) — the s-levels range row composes the same
              // way. The row hears the click, so choosing a sheet is the whole row's business and the
              // button's own activation, by pointer or by Enter, reaches it by bubbling.
              <div
                key={`${held.drawingId}\u0000${held.layoutName}`}
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
                  {/* A paper sheet is named by its own title. The MODEL space's layout name is the
                      DXF's word for the space (`model`), which names no sheet a reader ever opened, so
                      it is said in words through `EnumLabel` — the space's own value beside it under
                      `data-technical`, the name still on `data-layout` and the tooltip (I-353). */}
                  <span className="cx-schedules-sheet-name" title={held.layoutName}>
                    {held.kind === MODEL_SPACE ? <EnumLabel value={MODEL_SPACE} label={MODEL_SPACE_SAID} className="cx-schedules-sheet-space" /> : held.layoutName}
                  </span>
                  <span className="cx-schedules-sheet-holds">{holdsSaid(held)}</span>
                </button>
                {/* The chip does not hold its click back: a pointer anywhere in this row chose this
                    row, and copying the drawing's id while choosing the sheet it belongs to is what
                    a reader meant by aiming there (R-UI-031). */}
                {oneDrawing === null ? (
                  <span className="cx-schedules-sheet-id">
                    <IdChip value={held.drawingId} />
                  </span>
                ) : null}
              </div>
            ))}
          </nav>

          <div className="cx-schedules-work">
            {/* What the sheet HOLDS scrolls as one, so a long schedule and a long record of readings
                follow each other down a single column; the registry pane below is pinned to the foot
                of the work column and scrolls alone (§1, I-249). Two scroll regions rather than one
                is what keeps either of them from pushing the other off the screen.

                This frame IS the primary work surface §1 measures, so it carries the id that says so
                and the rows the region holds (I-288): the instrument reads the frame a reader reads,
                rather than one table inside it. No geometry of the frame changes — the id and the
                count are a statement about what is already drawn here. */}
            <div className="cx-schedules-scroll" data-testid={testIds.grid} data-rows-rendered={rowsDrawn}>
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
              {/* I-510: each opening row whose printed quantity is declared, beneath what was read.
                  Its evidence selects the schedule's cell and the plan's tags of the mark together. */}
              {declaredChecksOf(sheet).map((check) => (
                <QuantityCheck
                  key={`${check.family}\u0000${check.variantKey}`}
                  check={check}
                  href={traceTo([...check.printed.sourceKeys, ...check.printed.tagKeys])}
                  RefusalState={RefusalState}
                  testId={testIds.quantityCheck}
                />
              ))}
            </section>

            {/* I-253: the answer, then the record, then the offer. */}
            <section className="cx-schedules-notes" data-testid={testIds.notes} aria-label={SCHEDULES_COPY.schedules_notes_heading}>
              <h2 className="cx-schedules-section-heading">{SCHEDULES_COPY.schedules_notes_heading}</h2>
              {/* Silence is never a state: a sheet whose words state no figure says SO, in place and
                  under the registered code, whether or not somebody has already read something off
                  it (R-UI-020, AC-7). The record beside it is not unsaid by a grammar that reads
                  nothing today — what was committed stands, and only the OFFER goes away. */}
              {sheet.notes.proposals.length === 0 ? <Silent href={traceTo([])} RefusalState={RefusalState} /> : null}
              {sheet.notes.proposals.length === 0 && sheet.notes.readings.length === 0 ? null : (
                <>
                  <h3 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_standing_heading}</h3>
                  {sheet.notes.standings.map((standing) => (
                    <Standing
                      key={`${standing.kind}\u0000${standing.scopeClass ?? ""}`}
                      standing={standing}
                      others={standing.scopeClass === null && sheet.notes.standings.some((one) => one.kind === standing.kind && one.scopeClass !== null)}
                      testId={testIds.standing}
                      href={traceTo([])}
                      EnumLabel={EnumLabel}
                      RefusalState={RefusalState}
                      UnitBadge={UnitBadge}
                    />
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
                          key={`${proposal.kind}\u0000${proposal.sourceKey}`}
                          proposal={proposal}
                          testIds={testIds}
                          href={traceTo([proposal.sourceKey])}
                          value={drafts[draftKey(proposal)] ?? proposal.canonical}
                          stands={standsAt(sheet, proposal, drafts[draftKey(proposal)] ?? proposal.canonical)}
                          onValue={(value) => setDrafts((held) => ({ ...held, [draftKey(proposal)]: value }))}
                          EnumLabel={EnumLabel}
                          EvidenceLink={EvidenceLink}
                          NumberInput={NumberInput}
                        />
                      ))}
                      <TranscribeDoor
                        testId={testIds.transcribe}
                        held={holdsMeasure}
                        offline={offline}
                        movesNothing={sheet.notes.proposals.every((proposal) => standsAt(sheet, proposal, drafts[draftKey(proposal)] ?? proposal.canonical))}
                        onPress={() => openTranscribe(sheet.notes.proposals)}
                        Button={Button}
                        Tooltip={Tooltip}
                      />
                    </>
                  )}
                </>
              )}
            </section>
            </div>

            {/* I-249: the registry yields its height to the inspector, and stays a disclosure. */}
            <section
              className="cx-schedules-panel cx-schedules-registry"
              data-testid={testIds.registry}
              data-collapsed={selected === null ? "false" : "true"}
              // A pane with no family to show still STANDS and states its sentence (§1's empty cell),
              // but it takes only the room that sentence needs: 240 px of empty panel would push the
              // sheet's own notes off the fold to hold nothing.
              data-empty={sheet.families.length === 0 ? "true" : undefined}
            >
              <h2 className="cx-schedules-panel-heading">{SCHEDULES_COPY.schedules_registry_heading}</h2>{" "}
              {sheet.families.length === 0 ? (
                <p className="cx-schedules-none-said">{SCHEDULES_COPY.schedules_registry_none}</p>
              ) : (
                // I-353: ONE grid of fixed tracks — Mark, Band, Section, then a track per rebar zone —
                // headed once, so every variant is one `--row-h` row whose cells stand under their
                // column's name, and the words `Band`, `Section` and `Zone` are said once rather than
                // on every row. A family is a subgrid over every track: its mark stands in the first
                // and its variants run down the rest, one row each.
                <div className="cx-schedules-registry-grid">
                  <p className="cx-schedules-registry-head">
                    <span className="cx-schedules-registry-heading cx-schedules-at-mark">{SCHEDULES_COPY.schedules_registry_mark}</span>{" "}
                    <span className="cx-schedules-registry-heading cx-schedules-at-band">{SCHEDULES_COPY.schedules_registry_band}</span>{" "}
                    <span className="cx-schedules-registry-heading cx-schedules-at-section">{SCHEDULES_COPY.schedules_registry_section}</span>{" "}
                    {/* Only over zones that stand: a heading over four empty tracks would hold them
                        open at its own width for nothing beneath it. */}
                    {sheet.families.some((family) => family.variants.some((variant) => variant.zones.length > 0)) ? (
                      <span className="cx-schedules-registry-heading cx-schedules-at-zones">{SCHEDULES_COPY.schedules_registry_zone}</span>
                    ) : null}
                  </p>
                  {sheet.families.map((family) => (
                    <Family
                      key={family.family}
                      family={family}
                      testIds={testIds}
                      href={(sourceKeys) => traceTo(sourceKeys)}
                      EvidenceLink={EvidenceLink}
                      EnumLabel={EnumLabel}
                      Tooltip={Tooltip}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {pending === null ? null : (
        <ConsequenceDialog
          open
          actType={TRANSCRIBE_SHEET_NOTES}
          preview={previewOf(doors, pending, evidenceFor)}
          commit={commitOf(doors, pending, evidenceFor)}
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
 * Which box a proposal reads and writes: the (kind, sourceKey) pair the store keys a reading on, and
 * never the kind alone. One sheet may state two figures of one kind off two different sentences — the
 * bored-pile `f'c` beside the slab's — and boxes that shared a draft would send, under one of those
 * source keys, a figure no reader ever typed there (R-TO-034, I-254).
 */
function draftKey(proposal: NoteProposal): string {
  return `${proposal.kind}\0${proposal.sourceKey}`;
}

/**
 * Whether a proposal, at the figure standing in its box, already stands under this reader's own
 * record — the reason a preview of it would move nothing (I-255). Read off the readings the sheet
 * holds rather than decided here: what the seam would refuse is what the record says.
 */
function standsAt(sheet: SheetView, proposal: NoteProposal, value: string): boolean {
  return sheet.notes.readings.some(
    (reading) =>
      reading.kind === proposal.kind &&
      reading.sourceKey === proposal.sourceKey &&
      reading.canonical === value &&
      reading.unitAsWritten === proposal.unitAsWritten &&
      // A figure kept for another scope than the one the sheet states is not yet read as the sheet
      // states it: re-reading it moves the scope (I-652).
      (reading.scopeClass ?? null) === proposal.scopeClass,
  );
}

/** The same rejection, shaped as the one ConsequenceDialog reads one (its I-40). */
function refused(thrown: unknown, evidenceFor: (code: string) => Evidence): never {
  const code = codeOf(thrown);
  const entry = code === null ? undefined : entryOf(code);
  if (entry === undefined) throw thrown;
  throw Object.assign(new Error(entry.code), { refusal: entry, evidence: evidenceFor(entry.code) });
}

/** The preview the dialog runs for itself: state's own digest, taken again at the moment of showing. */
function previewOf(doors: SchedulesDoors, input: TranscribeSheetNotesInput, evidenceFor: (code: string) => Evidence): () => Promise<PreviewAnswer> {
  return async () => {
    try {
      return await doors.previewTranscribeSheetNotes({ input });
    } catch (thrown) {
      return refused(thrown, evidenceFor);
    }
  };
}

/** The commit the dialog's confirm carries, bound to the digest it showed (L-ACT-02). */
function commitOf(doors: SchedulesDoors, input: TranscribeSheetNotesInput, evidenceFor: (code: string) => Evidence): (carried: { consequenceDigest: string }) => Promise<{ actId: string }> {
  return async (carried) => {
    try {
      return await doors.commitTranscribeSheetNotes({ input, consequenceDigest: carried.consequenceDigest });
    } catch (thrown) {
      return refused(thrown, evidenceFor);
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

/** One opening row whose printed quantity is declared: which mark, over which floors, and what the schedule printed. */
type DeclaredCheck = { readonly family: string; readonly markText: string; readonly variantKey: string; readonly printed: PrintedView & { readonly refusal: string } };

/**
 * The opening rows of this sheet whose printed quantity is DECLARED (I-507/i), in the registry's
 * own order: the families the schedules named, each variant whose reading stands under a code. The
 * screen filters what the store holds and counts nothing (I-251).
 */
function declaredChecksOf(sheet: SheetView): DeclaredCheck[] {
  return sheet.families.flatMap((family) =>
    family.variants.flatMap((variant) => {
      const printed = variant.printed;
      if (printed === undefined || printed.refusal === null) return [];
      return [{ family: family.family, markText: family.markText, variantKey: variant.variantKey, printed: { ...printed, refusal: printed.refusal } }];
    }),
  );
}

/**
 * One declared quantity check, stated where it belongs and never silently (I-510, R-UI-050): the
 * mark and the printed cell as the schedule shows them — model data in mono, never woven into the
 * sentence (I-25/I-26) — then the one RefusalState. Its evidence opens the plan with the cell and the
 * tags selected where a plan was checked, and the sheet where none was.
 */
function QuantityCheck({ check, href, RefusalState, testId }: { check: DeclaredCheck; href: string; RefusalState: SchedulesChrome["RefusalState"]; testId: string }) {
  const entry = entryOf(check.printed.refusal);
  if (entry === undefined) return null;
  return (
    <div className="cx-schedules-deferral cx-schedules-quantity-check" data-testid={testId} data-family={check.family} data-variant={check.variantKey} data-code={entry.code}>
      <p className="cx-schedules-quantity-said">
        <span className="cx-schedules-mono">{drawn(check.markText)}</span> <span className="cx-schedules-mono">{drawn(check.printed.text)}</span>
      </p>
      <RefusalState refusal={entry} evidence={{ href, label: check.printed.planKey === null ? OPEN_THE_SHEET : OPEN_THE_PLAN }} />
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
        {cell.text === "" ? <span className="cx-schedules-none">{DASH}</span> : <EvidenceLink href={href(cell.sourceKeys)} basis={TRANSCRIBED} label={drawn(cell.text)} />}
      </span>
    );
  };

  const shown: BandColumn[] = columns.map((columnIndex, at) => ({
    id: `column:${columnIndex}`,
    header: () => (table.header === undefined ? null : cellAt(table.header, columnIndex)),
    enableSorting: false,
    ...(at === 0 ? { size: widthOfMarkColumn(table) } : {}),
    // A column of bare figures — a SPAN, a count the schedule states — reads down its right edge, as
    // every column of figures on this product does (R-UI-083). The first column is the frozen mark.
    ...(at > 0 && figuresOnly(table, columnIndex) ? { meta: { align: "right" as const } } : {}),
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
        <span>{drawn(table.title)}</span>
        <span className="cx-schedules-table-rows">{fillCopy("schedules_table_rows", { count: formatUserFigure(String(table.rows.length)) })}</span>
      </p>
      <DataTable
        tableId={`takeoff-schedule:${table.scheduleKey}`}
        columns={shown}
        data={[...table.rows]}
        getRowId={(row) => String(row.rowIndex)}
        freezeKeyColumn
        aria-label={drawn(table.title)}
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

/** Whether every stored data cell of one column that says anything is a bare figure (R-UI-083). */
function figuresOnly(table: ScheduleTableView, columnIndex: number): boolean {
  const said = table.rows.flatMap((row) => row.cells.filter((cell) => cell.columnIndex === columnIndex && cell.text.trim() !== "").map((cell) => cell.text.trim()));
  return said.length > 0 && said.every((text) => BARE_FIGURE.test(text));
}

/** One mark family of the registry: what the schedule said a member IS, and never how many (I-251). */
function Family({
  family,
  testIds,
  href,
  EvidenceLink,
  EnumLabel,
  Tooltip,
}: {
  family: FamilyView;
  testIds: SchedulesTestIds;
  href: (sourceKeys: readonly string[]) => string;
  EvidenceLink: SchedulesChrome["EvidenceLink"];
  EnumLabel: SchedulesChrome["EnumLabel"];
  Tooltip: SchedulesChrome["Tooltip"];
}) {
  return (
    <div className="cx-schedules-family" data-testid={testIds.family} data-family={family.family}>
      {/* The trace is labelled with the MARK the registry filed this family under — the same word
          `data-family` carries, and the word every variant and zone beneath it is spoken of by. The
          mark cell's own spelling stands beside it, verbatim, because the registry states what the
          schedule wrote and never only what it normalises to (I-251, L-CAD-08). It stands in the
          Mark track of the family's first row; the variants run down the tracks beside it (I-353). */}
      {/* The `{" "}` between two inline pieces is a WORD BREAK and not layout: two spans set side by
          side read as one run of text to anything that takes the text rather than the picture — a
          screen reader, a copy, a translation — and `C1 350x350` must not become `C1350x350`
          (R-UI-060). The gaps a reader SEES are the grid's tracks, and these are beneath them. */}
      <p className="cx-schedules-family-mark cx-schedules-at-mark">
        <EvidenceLink href={href(family.sourceKeys)} basis={TRANSCRIBED} label={family.family} />{" "}
        {/* Only where the mark CELL spelled it differently: where the two agree there is one word to
            say, and a row that said it twice would be saying the schedule wrote it twice. */}
        {family.markText === family.family ? null : <span className="cx-schedules-mono">{drawn(family.markText)}</span>}{" "}
      </p>
      {family.variants.map((variant) => {
        // A Band is a band of FLOORS (§1). A schedule that states none — a beam schedule — gave the
        // variant its section column's HEADER as its band text, and printing `SIZE` under Band says a
        // band the drawing never drew; such a variant says its band is absent (I-sch-1). A strip
        // family's band was read off its sheet's TITLE, and the cell says the band, not the title; the
        // title stands in the cell's Tooltip, as the drawing shows it (I-436).
        const band = bandSaid(variant);
        const readOff = bandReadOff(variant);
        const section = variant.sectionText === "" ? DASH : drawn(variant.sectionText);
        return (
          <div className="cx-schedules-variant" key={variant.variantKey} data-testid={testIds.variant} data-variant={variant.variantKey}>
            {/* The variant's KEY is not said at all. It is the store's own surrogate for the band —
                `4TH-ROOF` where the drawing wrote `4TH TO ROOF` — so printing it puts a word beside
                the band that the schedule never wrote there, and its digits stand as figures nobody
                measured (I-251, L-CAD-08). The key rides `data-variant`, which is where a suite
                addresses it and where no reader mistakes it for the drawing's own text. */}
            {readOff === null ? (
              <span className="cx-schedules-registry-cell cx-schedules-mono cx-schedules-at-band">{band}</span>
            ) : (
              <Tooltip content={readOff}>
                <span className="cx-schedules-registry-cell cx-schedules-mono cx-schedules-at-band">{band}</span>
              </Tooltip>
            )}{" "}
            {/* The one track that gives way: a section written with its bars in one cell is the longest
                thing on the row, so it ellipsises and the whole of it stands in its Tooltip (§1's cell
                rule — no wrap, ellipsis plus tooltip, R-UI-083). */}
            <Tooltip content={section}>
              <span className="cx-schedules-registry-cell cx-schedules-mono cx-schedules-at-section">{section}</span>
            </Tooltip>{" "}
            {variant.zones.map((zone) => (
              // The zone is an enum, so it is said in WORDS through `EnumLabel` with the store's own
              // value beside it under `data-technical` (R-UI-082, I-sch-1); the words are only words its
              // value holds, so the row still says nothing the schedule did not (I-251). The value is
              // on `data-zone` either way, which is where a suite matches it — and where the grid
              // finds the zone's own track, so a zone stands under the same zone on every row (I-353).
              <p className="cx-schedules-zone" key={zone.zone} data-testid={testIds.zone} data-zone={zone.zone}>
                <EnumLabel value={zone.zone} label={ZONE_SAID[zone.zone] ?? zone.zone} className="cx-schedules-enum" />{" "}
                <span className="cx-schedules-mono cx-schedules-zone-text">{drawn(zone.text)}</span>{" "}
              </p>
            ))}
          </div>
        );
      })}
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
  others,
  testId,
  href,
  EnumLabel,
  RefusalState,
  UnitBadge,
}: {
  standing: StandingView;
  /** An unscoped standing beside a scoped one of its kind governs every OTHER class (I-652). */
  others: boolean;
  testId: string;
  href: string;
  EnumLabel: SchedulesChrome["EnumLabel"];
  RefusalState: SchedulesChrome["RefusalState"];
  UnitBadge: SchedulesChrome["UnitBadge"];
}) {
  const entry = standing.code === null ? undefined : entryOf(standing.code);
  const stands = standing.standing === AGREED && standing.canonical !== null;
  return (
    <div
      className="cx-schedules-standing"
      data-testid={testId}
      data-kind={standing.kind}
      data-scope={standing.scopeClass ?? ""}
      data-standing={standing.standing}
      data-code={standing.code ?? ""}
    >
      <EnumLabel value={standing.kind} label={KIND_SAID[standing.kind]} className="cx-schedules-enum" />
      <ScopeSaid scopeClass={standing.scopeClass} others={others} EnumLabel={EnumLabel} />
      <EnumLabel value={standing.standing} label={STANDING_SAID[standing.standing] ?? STANDING_SAID[NONE]} className="cx-schedules-enum" />
      {stands ? <span className="cx-schedules-figure cx-schedules-mono">{formatUserFigure(standing.canonical as string)}</span> : <span className="cx-schedules-none">{DASH}</span>}
      {stands && standing.unitAsWritten !== null && standing.unitAsWritten !== "" ? <UnitBadge unit={standing.unitAsWritten} /> : null}
      {entry === undefined ? null : (
        <div className="cx-schedules-standing-refusal">
          <RefusalState refusal={entry} evidence={{ href, label: OPEN_THE_SHEET }} />
        </div>
      )}
    </div>
  );
}

/**
 * The members a figure is for (I-652): the class a note scoped it to, as a word through EnumLabel
 * under the draft bill's own rule (`pile` → `Pile`, the raw class under `data-technical`), or — for an
 * unscoped figure — every member, or every OTHER member where a scoped figure of its kind stands
 * beside it.
 */
function ScopeSaid({ scopeClass, others, EnumLabel }: { scopeClass: string | null; others: boolean; EnumLabel: SchedulesChrome["EnumLabel"] }) {
  if (scopeClass !== null) return <EnumLabel value={scopeClass} label={inWords(scopeClass)} className="cx-schedules-enum" />;
  return <span className="cx-schedules-scope-all">{others ? SCHEDULES_COPY.schedules_scope_others : SCHEDULES_COPY.schedules_scope_all}</span>;
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
      data-scope={reading.scopeClass ?? ""}
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
      {reading.scopeClass === null ? null : <ScopeSaid scopeClass={reading.scopeClass} others={false} EnumLabel={EnumLabel} />}
      <span className="cx-schedules-mono">{readingSaid(reading)}</span>
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
  proposal: ProposalView;
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
    <div className="cx-schedules-proposal" data-testid={testIds.proposal} data-kind={proposal.kind} data-scope={proposal.scopeClass ?? ""} data-proposed-by={proposal.proposedBy}>
      <EnumLabel value={proposal.kind} label={KIND_SAID[proposal.kind]} className="cx-schedules-enum" />
      {/* I-296: a figure a model classified says so, in place, before a reader keeps it. The figure
          itself is the grammar's reading of the clause — a model moves no digit (L-AI-03). */}
      {proposal.proposedBy === "model" ? <span className="cx-schedules-proposed-by">{SCHEDULES_COPY.schedules_proposal_proposed_by_model}</span> : null}
      <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_proposal_written_label}</span>
      {/* I-652: the clause WHOLE, as the sheet shows it — `f'c = 3000 psi (BORED PILES)` says whose
          strength it is, and the figure alone would drop the words that scope it. */}
      <EvidenceLink href={href} basis={TRANSCRIBED} label={drawn(proposal.text)} />
      <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_proposal_applies_label}</span>
      <ScopeSaid scopeClass={proposal.scopeClass} others={false} EnumLabel={EnumLabel} />
      <label className="cx-schedules-field">
        <span className="cx-schedules-label">{SCHEDULES_COPY.schedules_proposal_value_label}</span>
        <NumberInput value={value} data-testid={testIds.proposalValue} aria-label={`${KIND_SAID[proposal.kind]} ${SCHEDULES_COPY.schedules_proposal_value_label}`} onChange={onValue} />
      </label>
      <span className="cx-schedules-unit cx-schedules-mono">{proposal.unitAsWritten}</span>
      {/* I-255: a reader sees the reason a preview would move nothing BEFORE they press. */}
      {stands ? <span className="cx-schedules-already">{SCHEDULES_COPY.schedules_proposal_already_read}</span> : null}
      {/* AM-03(e), I-296: what a model made of whether THIS note's lap governs over the sheet's own
          table is a proposition presented with its figure — it moves nothing and stands for nothing. */}
      {proposal.governs === null ? null : (
        <span className="cx-schedules-governs">
          {SCHEDULES_COPY.schedules_proposal_lap_governs} <span className="cx-schedules-mono">{formatUserFigure(proposal.governs)}</span>
        </span>
      )}
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
  movesNothing,
  onPress,
  Button,
  Tooltip,
}: {
  testId: string;
  held: boolean;
  offline: boolean;
  /** Every figure in its box already stands as a reading on this sheet (I-563). */
  movesNothing: boolean;
  onPress: () => void;
  Button: SchedulesChrome["Button"];
  Tooltip: SchedulesChrome["Tooltip"];
}) {
  if (held && !offline && !movesNothing) {
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
    <Tooltip content={!held ? SCHEDULES_COPY.schedules_denied_transcribe : offline ? SCHEDULES_COPY.schedules_offline : SCHEDULES_COPY.schedules_transcribe_nothing}>
      <span
        className="cx-btn cx-reticle cx-schedules-door-shut"
        data-variant="primary"
        role="button"
        tabIndex={0}
        aria-disabled="true"
        data-testid={testId}
        {...(held ? {} : { "data-permission": MEASURE })}
        // I-563: shut because pressing would record nothing — every figure already stands.
        {...(held && !offline && movesNothing ? { "data-shut": "moves-nothing" } : {})}
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
