"use client";
// S-Levels' workspace — the level stack, cut from the grid-workspace template S-Takeoff established
// (docs/design/s-levels.md; Design Direction 00 §3.2). One DataTable of the live stack, the
// campaign's index beside it as a 240 px rail, the shell's ONE inspector filled on selection, and
// the lane's tabs-row aside holding the one primary.
//
// I-170, as this screen inherits it: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17
// bars a screen from re-implementing a shipped primitive — so the renderers, the two mounts and the
// ids this screen publishes all arrive as chrome from the one file that may reach both trees.
//
// Every act here is a door and nothing more (L-ACT-02, I-243): the screen previews at the door,
// renders a rejection through the one RefusalState, and opens the one ConsequenceDialog only over a
// Consequence that was answered. Nothing on this screen commits anything itself.
//
// Nothing here re-derives a figure (I-241, B-17): a standing, a coverage and a roll-up's total are
// all `levelsViewOf`'s answers, rendered as they stand.
import { useCallback, useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { AuthorStoreyHeightInput, AuthorTypicalRangeInput, Consequence, InsertLevelInput, RepudiateLevelInput } from "@/core/acts";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatDate, formatMoney, formatUserFigure, dhakaDateParts } from "@/core/format";
import { STOREY_HEIGHT_BASES } from "@/core/levels/law";
import type { QuantityBasis } from "@/core/offers/law";
import { CANONICAL_UNIT, UNITS, dimensionOf, isUnit } from "@/core/units/canon";
import { LEVELS_COPY, fillCopy } from "./copy";
import type { LevelsView, LevelsViewLevel, LevelsViewRange, LevelsViewReading, LevelsViewRollup } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/** One cell of the stack table, as the shipped DataTable hands one its row. */
type LevelCell = { readonly row: { readonly original: LevelsViewLevel } };

/** One column of the stack table, as the shipped DataTable takes one. */
type LevelColumn = {
  id: string;
  header: string;
  accessorFn?: (level: LevelsViewLevel) => string;
  enableSorting?: boolean;
  /** The width the column is READ at (§5 rule 3), never the primitive's 150. */
  size?: number;
  cell: (context: LevelCell) => ReactNode;
  meta?: { align?: "right" };
};

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * THE IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is
 * the one declaration of every test id and a module may not import it, so they arrive as chrome —
 * exactly as `DataTable` and `EnumLabel` do. Every string is the registry's own.
 */
export interface LevelsTestIds {
  readonly screen: string;
  readonly grid: string;
  readonly row: string;
  readonly rollup: string;
  readonly empty: string;
  readonly insert: string;
  readonly insertLabel: string;
  readonly insertOrdinal: string;
  readonly insertConfirm: string;
  readonly inspector: string;
  readonly reading: string;
  readonly heightValue: string;
  readonly heightUnit: string;
  readonly heightBasis: string;
  readonly heightSource: string;
  readonly authorHeight: string;
  readonly repudiate: string;
  readonly ranges: string;
  readonly rangeRow: string;
  readonly rangeFrom: string;
  readonly rangeTo: string;
  readonly authorRange: string;
}

/** The shipped renderers the app layer injects (I-170), each declared by the props this screen hands it. */
export interface LevelsChrome {
  readonly testIds: LevelsTestIds;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: LevelColumn[];
    data: LevelsViewLevel[];
    getRowId: (row: LevelsViewLevel, index: number) => string;
    freezeKeyColumn?: boolean;
    onRowSelect?: (rowIds: readonly string[]) => void;
    /** What each row publishes of its own — the level it stands for, as §7's contract spells it. */
    rowDataOf?: (row: LevelsViewLevel, rowId: string) => Readonly<Record<string, string>>;
    /** The id a row carries: this screen's own `levels-row`, not the primitive's (AM-09 §1). */
    rowTestId?: string;
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
  readonly Input: ComponentType<{
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    className?: string;
    placeholder?: string;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "data-testid"?: string;
  }>;
  /** R-UI-083: a figure is written in the shipped NumberInput, never a bare `input type=number`. */
  readonly NumberInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
    step?: number;
    className?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  /** R-UI-083: a roster is chosen at the shipped Select, never a native `select`. */
  readonly Select: ComponentType<{
    options: readonly { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  readonly Skeleton: ComponentType<{ style?: CSSProperties; className?: string }>;
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  readonly BasisChip: ComponentType<{ basis: QuantityBasis }>;
  readonly CoverageChip: ComponentType<{ value: number }>;
  readonly QuantityText: ComponentType<{
    value: string;
    unit?: string;
    format?: { figure: (value: string) => string; money: (amount: string) => string; date: (at: Date) => string };
    className?: string;
    "data-testid"?: string;
  }>;
  readonly UnitBadge: ComponentType<{ unit: string }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** The insert form's home: anchored on the one primary, never a row of fields in a 32 px track. */
  readonly Popover: ComponentType<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }>;
  readonly PopoverTrigger: ComponentType<{
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
    "data-variant"?: string;
    "data-testid"?: string;
    "data-permission"?: string;
  }>;
  readonly PopoverContent: ComponentType<{ children?: ReactNode; className?: string; "aria-label"?: string }>;
  /** `ASSIGN_ROLE` → `Assign role`, in the one home EnumLabel humanises by (B-17). */
  readonly humaniseEnum: (value: string) => string;
  /** THE TWO MOUNTS (Direction §1, §3.2): the lane's tabs row, and the frame's ONE inspector. */
  readonly TabsAside: ComponentType<{ children?: ReactNode }>;
  readonly InspectorMount: ComponentType<{ children?: ReactNode }>;
}

/** What a preview answers (L-ACT-02): the typed Consequence, and the digest that binds it. */
export type PreviewAnswer = { consequence: Consequence; consequenceDigest: string };

/** The doors this screen presses — the takeoff lane's own, as `src/server/routers/takeoff.ts` takes them. */
export interface LevelsDoors {
  readonly levels: (argument: { projectId: string }) => Promise<{ stack: readonly LevelsViewLevel[]; unstatedRanges: readonly LevelsViewRange[] }>;
  readonly previewInsertLevel: (argument: { input: InsertLevelInput }) => Promise<PreviewAnswer>;
  readonly commitInsertLevel: (argument: { input: InsertLevelInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewRepudiateLevel: (argument: { input: RepudiateLevelInput }) => Promise<PreviewAnswer>;
  readonly commitRepudiateLevel: (argument: { input: RepudiateLevelInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewAuthorStoreyHeight: (argument: { input: AuthorStoreyHeightInput }) => Promise<PreviewAnswer>;
  readonly commitAuthorStoreyHeight: (argument: { input: AuthorStoreyHeightInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewAuthorTypicalRange: (argument: { input: AuthorTypicalRangeInput }) => Promise<PreviewAnswer>;
  readonly commitAuthorTypicalRange: (argument: { input: AuthorTypicalRangeInput; consequenceDigest: string }) => Promise<{ actId: string }>;
}

export interface LevelsWorkspaceProps {
  readonly view: LevelsView;
  /** Which of the three permissions the reader holds, read server-side (Decision §2, I-247). */
  readonly permitted: Readonly<Record<string, boolean | undefined>>;
  readonly offline: boolean;
  /**
   * The state the ROUTE holds this screen in — `loading` while it waits and `error` where the read
   * faulted, both of which are facts about the read rather than about the stack. Left null, the
   * screen derives its own (§2's order, first holding wins).
   */
  readonly state?: string | null;
  /** The level a reader has already selected, where the caller mounts with a selection made. */
  readonly level?: string | null;
  /** The fault the read left behind, quoted verbatim in the error cell (R-UI-050, B-21). */
  readonly reportId?: string | null;
  /** The read's own retry, where the caller holds the read: the error cell's one door (R-UI-050). */
  readonly onRetry?: () => void;
  readonly chrome: LevelsChrome;
  readonly doors: LevelsDoors;
}

/* --------------------------------------------------------------------------- the addresses */

// The one address this screen links: where a denial is resolved. ARCH-01 bars a module from the app
// layer where a route builder lives, so it is spelled here for this screen and nowhere else in it.
const participantsHref = (projectId: string): string => `/p/${projectId}/settings/participants`;

/** The permission each door on this screen moves (L-ACT-03, Decision §2's denial table). */
export const AUTHOR_LEVEL_STACK = "AUTHOR_LEVEL_STACK";
export const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";
export const MEASURE = "MEASURE";

/** The four act types this screen confirms, verbatim as the act seam names them. */
const INSERT_LEVEL = "INSERT_LEVEL" as const;
const REPUDIATE_LEVEL = "REPUDIATE_LEVEL" as const;
const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT" as const;
const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE" as const;

/** The code the screen's own denial renders, off the registry it is looked up in (R-UI-020). */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The standing a level's height stands at when its readings agree — the only one that shows metres. */
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";

/** L-QTY-02's weaker coverage, which a cell states with no figure at all (I-241). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The identity the stack table's column furniture is remembered under (§5 rule 3). */
const LEVELS_TABLE_ID = "takeoff-level-stack";

/** The column widths §5 fixes, in the closed set the Decision's own token rule admits. */
const WIDTH_LEVEL = 180;
const WIDTH_ORDINAL = 80;
const WIDTH_STANDING = 200;
const WIDTH_ROLLUP = 160;

/** How finely a height and an ordinal are stepped where a reader uses the control's own arrows. */
const HEIGHT_STEP = 0.001;
const ORDINAL_STEP = 1;

/** SEAM-FORMAT, as the figure primitives take it (§5 rule 5's lakh/crore), handed down from core. */
const FIGURES = Object.freeze({
  figure: formatUserFigure,
  money: formatMoney,
  date: (at: Date): string => formatDate(dhakaDateParts(at)),
});

/**
 * The units a storey height may be written in: the canon's own LENGTH roster, read off the table
 * that carries the factors rather than transcribed beside it (B-17, B-19). The canonical metre leads,
 * because that is what a reader writing a height in this form most often writes.
 */
const HEIGHT_UNITS: readonly string[] = Object.freeze([
  CANONICAL_UNIT.LENGTH,
  ...UNITS.filter((unit) => dimensionOf(unit) === "LENGTH" && unit !== CANONICAL_UNIT.LENGTH),
]);

/** What a door answered that the screen shows in place: one registered refusal, or nothing. */
type Answer = { refusal: RefusalEntry; evidence: Evidence } | null;

/** The act a confirmed door opened the one dialog over, with the input it will be committed on. */
type Pending =
  | { readonly actType: typeof INSERT_LEVEL; readonly input: InsertLevelInput }
  | { readonly actType: typeof REPUDIATE_LEVEL; readonly input: RepudiateLevelInput }
  | { readonly actType: typeof AUTHOR_STOREY_HEIGHT; readonly input: AuthorStoreyHeightInput }
  | { readonly actType: typeof AUTHOR_TYPICAL_RANGE; readonly input: AuthorTypicalRangeInput };

/** A height being written in the inspector, before it is previewed at the door (I-243). */
type HeightDraft = { value: string; unit: string; basis: string; sourceKey: string };

/** A typical range being written in the rail, stated as the two ordinals a plan stands for. */
type RangeDraft = { from: string; to: string };

/* ----------------------------------------------------------------------------- the readings */

/**
 * The registered code a rejection carries, however it arrived. `refusalCodeOf` is the marker's one
 * home; a failure carrying none is a fault, and a fault belongs to the error boundary (ARCH-03).
 */
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

/** The stack as it physically stands: by ordinal, and by surrogate where two share one (L-MEA-07). */
function inOrdinalOrder(stack: readonly LevelsViewLevel[]): LevelsViewLevel[] {
  return [...stack].sort((left, right) => left.ordinal - right.ordinal || (left.levelId < right.levelId ? -1 : left.levelId > right.levelId ? 1 : 0));
}

/** Every kind the stack's stored lines bear, in the order the reading answers them (code point). */
function kindsOf(stack: readonly LevelsViewLevel[]): string[] {
  const held: string[] = [];
  for (const level of stack) {
    for (const rollup of level.rollups) if (!held.includes(rollup.kind)) held.push(rollup.kind);
  }
  return held.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** What every row of the stack publishes of its own (§7's closed contract, I-242). */
function rowDataOf(level: LevelsViewLevel, selected: string | null): Readonly<Record<string, string>> {
  const published: Record<string, string> = {
    "data-level": level.levelId,
    "data-ordinal": String(level.ordinal),
    "data-standing": level.standing,
    "data-code": level.code ?? "",
    // I-242: a figure printed beside the word *suspended* is the very claim the suspension denies.
    "data-metres": level.standing === AGREED ? (level.canonicalMetres ?? "") : "",
  };
  if (level.levelId === selected) published["data-selected-level"] = "true";
  return published;
}

/* --------------------------------------------------------------------------- the workspace */

export function LevelsWorkspace({ view, permitted, offline, state, level, reportId, onRetry, chrome, doors }: LevelsWorkspaceProps) {
  const {
    testIds,
    DataTable,
    RefusalState,
    ConsequenceDialog,
    EmptyState,
    Button,
    Input,
    NumberInput,
    Select,
    IdChip,
    EnumLabel,
    BasisChip,
    CoverageChip,
    QuantityText,
    UnitBadge,
    Tooltip,
    humaniseEnum,
    TabsAside,
    InspectorMount,
  } = chrome;

  /** The reading as it stands: the route's, until a committed act makes this screen read it again. */
  const [reading, setReading] = useState<{ stack: readonly LevelsViewLevel[]; unstatedRanges: readonly LevelsViewRange[] }>({
    stack: view.stack,
    unstatedRanges: view.unstatedRanges,
  });
  useEffect(() => {
    setReading({ stack: view.stack, unstatedRanges: view.unstatedRanges });
  }, [view]);

  const [selected, setSelected] = useState<string | null>(level ?? null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertDraft, setInsertDraft] = useState<{ label: string; ordinal: string }>({ label: "", ordinal: "" });
  const [heightDraft, setHeightDraft] = useState<HeightDraft>({ value: "", unit: CANONICAL_UNIT.LENGTH, basis: STOREY_HEIGHT_BASES[0], sourceKey: "" });
  const [rangeDrafts, setRangeDrafts] = useState<Readonly<Record<string, RangeDraft>>>({});
  /** What a door left that no registry entry stands for: held here, raised in render (ARCH-03, B-21). */
  const [fault, setFault] = useState<unknown>(null);

  const stack = useMemo(() => inOrdinalOrder(reading.stack), [reading.stack]);
  const kinds = useMemo(() => kindsOf(reading.stack), [reading.stack]);

  const holdsStack = permitted[AUTHOR_LEVEL_STACK] === true;
  const holdsFact = permitted[AUTHOR_PROJECT_FACT] === true;
  const holdsMeasure = permitted[MEASURE] === true;

  const evidence = useMemo<Evidence>(() => ({ href: participantsHref(view.projectId), label: LEVELS_COPY.levels_denied_evidence }), [view.projectId]);

  /**
   * A rejection at a door, answered in place — never a toast, and never a dialog over nothing
   * (R-UI-020, I-245). A failure carrying no registered code is a fault, and a fault belongs to the
   * boundary that owns the report id: it is re-raised untouched rather than dressed as a refusal.
   */
  const refuse = useCallback(
    (code: string | null, thrown: unknown): void => {
      const entry = code === null ? undefined : entryOf(code);
      // Every caller of this helper is an event handler the browser invokes as a bare promise, so a
      // throw here would become a rejection nobody observes: the fault is held and re-raised in
      // render, which is where React's boundary — and the report id it mints — can see it.
      if (entry === undefined) {
        setFault(() => thrown);
        return;
      }
      setAnswer({ refusal: entry, evidence });
    },
    [evidence],
  );

  /** Read the stack again, which is what a committed act and the error cell's retry both need. */
  const reread = useCallback((): void => {
    void doors
      .levels({ projectId: view.projectId })
      .then((answered) => {
        setReading({ stack: answered.stack ?? [], unstatedRanges: answered.unstatedRanges ?? [] });
      })
      .catch((thrown: unknown) => refuse(codeOf(thrown), thrown));
  }, [doors, refuse, view.projectId]);

  /**
   * A door, pre-flighted: a rejection is answered in place and opens NO dialog, and only an answered
   * Consequence opens one — whose own preview runs again, because L-ACT-02's digest must be the one
   * current state produces (the register's settled I-41).
   */
  const open = useCallback(
    async (act: Pending, preview: () => Promise<PreviewAnswer>): Promise<void> => {
      try {
        await preview();
      } catch (thrown) {
        refuse(codeOf(thrown), thrown);
        return;
      }
      setAnswer(null);
      setPending(act);
    },
    [refuse],
  );

  const openInsert = useCallback((): void => {
    const input: InsertLevelInput = {
      type: INSERT_LEVEL,
      projectId: view.projectId,
      levels: [{ label: insertDraft.label, ordinal: Number(insertDraft.ordinal) }],
    };
    void open({ actType: INSERT_LEVEL, input }, () => doors.previewInsertLevel({ input }));
  }, [doors, insertDraft, open, view.projectId]);

  const openRepudiate = useCallback(
    (levelId: string): void => {
      const input: RepudiateLevelInput = { type: REPUDIATE_LEVEL, projectId: view.projectId, levelId };
      void open({ actType: REPUDIATE_LEVEL, input }, () => doors.previewRepudiateLevel({ input }));
    },
    [doors, open, view.projectId],
  );

  const openHeight = useCallback(
    (levelId: string): void => {
      const input: AuthorStoreyHeightInput = {
        type: AUTHOR_STOREY_HEIGHT,
        projectId: view.projectId,
        levelId,
        basis: heightDraft.basis,
        // A height somebody entered cites no drawing entity, and an empty box is that absence rather
        // than a key spelled as "" (L-MEA-07's reading key, `NO_SOURCE_SLOT`).
        sourceKey: heightDraft.sourceKey === "" ? null : heightDraft.sourceKey,
        valueAsWritten: heightDraft.value,
        unitAsWritten: heightDraft.unit,
      };
      void open({ actType: AUTHOR_STOREY_HEIGHT, input }, () => doors.previewAuthorStoreyHeight({ input }));
    },
    [doors, heightDraft, open, view.projectId],
  );

  const openRange = useCallback(
    (range: LevelsViewRange): void => {
      const draft = rangeDrafts[range.viewKey] ?? { from: "", to: "" };
      // The reader states the two ORDINALS a typical plan stands for (§1's rail); the act names the
      // levels themselves. An ordinal no live level stands at is carried as written, so the seam is
      // the one judge of what a range may be and this screen invents no refusal of its own (B-17).
      const at = (ordinal: string): string => stack.find((held) => String(held.ordinal) === ordinal.trim())?.levelId ?? ordinal.trim();
      const input: AuthorTypicalRangeInput = {
        type: AUTHOR_TYPICAL_RANGE,
        projectId: view.projectId,
        viewKey: range.viewKey,
        fromLevelId: at(draft.from),
        toLevelId: at(draft.to),
      };
      void open({ actType: AUTHOR_TYPICAL_RANGE, input }, () => doors.previewAuthorTypicalRange({ input }));
    },
    [doors, open, rangeDrafts, stack, view.projectId],
  );

  /* ------------------------------------------------------------- the lane's own tabs row (§3.2) */

  /**
   * The ONE primary, in the right half of the lane's 32 px tabs row (I-246). It stands there while a
   * live level exists and INSIDE the empty state while none does — one element, one id, exactly one
   * instance in the DOM at any time.
   */
  const insertDoor = (
    <InsertDoor
      copy={LEVELS_COPY}
      testIds={testIds}
      held={holdsStack}
      offline={offline}
      open={insertOpen}
      onOpenChange={setInsertOpen}
      draft={insertDraft}
      onDraft={setInsertDraft}
      onConfirm={openInsert}
      chrome={chrome}
    />
  );

  /* ----------------------------------------------------------- the shell's ONE inspector (§3.2) */

  const chosen = stack.find((held) => held.levelId === selected) ?? null;

  /**
   * What the frame's right column shows, or null — and null means NO COLUMN AT ALL, not a panel
   * saying nothing is selected (R-UI-080, §1). Memoised, because the slot is state in the frame and
   * a node with a new identity every render would set it on every render.
   */
  const inspector = useMemo<ReactNode>(() => {
    if (chosen === null) return null;
    return (
      <div className="cx-levels-inspector" data-testid={testIds.inspector} data-level={chosen.levelId} data-standing={chosen.standing}>
        <p className="cx-levels-inspector-title">
          <span className="cx-levels-inspector-label">{chosen.label}</span>
          <IdChip value={chosen.levelId} />
        </p>
        <dl className="cx-levels-facts">
          <dt>{LEVELS_COPY.levels_col_ordinal}</dt>
          <dd className="cx-levels-mono">{formatUserFigure(String(chosen.ordinal))}</dd>
          <dt>{LEVELS_COPY.levels_col_standing}</dt>
          <dd>
            <EnumLabel value={chosen.standing} className="cx-levels-enum" />
            {chosen.standing === AGREED && chosen.canonicalMetres !== null ? (
              <QuantityText value={chosen.canonicalMetres} unit={CANONICAL_UNIT.LENGTH} format={FIGURES} />
            ) : null}
          </dd>
        </dl>
        {chosen.standing === SUSPENDED ? <p className="cx-levels-suspended">{LEVELS_COPY.levels_suspended_note}</p> : null}

        <h3 className="cx-levels-section-heading">{LEVELS_COPY.levels_readings_heading}</h3>
        {chosen.readings.length === 0 ? <p className="cx-levels-no-readings">{LEVELS_COPY.levels_no_readings}</p> : null}
        {chosen.readings.map((held) => (
          <Reading key={held.readingKey + held.valueAsWritten + held.canonicalMetres} reading={held} testId={testIds.reading} BasisChip={BasisChip} QuantityText={QuantityText} />
        ))}

        {/* I-243: the form stands open and typing changes nothing — only the door previews. */}
        <div className="cx-levels-height-form">
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_value_label}</span>
            <NumberInput
              value={heightDraft.value}
              step={HEIGHT_STEP}
              data-testid={testIds.heightValue}
              aria-label={LEVELS_COPY.levels_height_value_label}
              onChange={(value) => setHeightDraft((draft) => ({ ...draft, value }))}
            />
          </label>
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_unit_label}</span>
            <Select
              options={HEIGHT_UNITS.map((unit) => ({ value: unit, label: unit }))}
              value={heightDraft.unit}
              data-testid={testIds.heightUnit}
              aria-label={LEVELS_COPY.levels_height_unit_label}
              onChange={(unit) => setHeightDraft((draft) => ({ ...draft, unit }))}
            />
          </label>
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_basis_label}</span>
            {/* I-244: exactly the three bases a height may be READ on, off the law's own roster —
                never DEFAULTED, which L-MEA-07 bars and the act would refuse. */}
            <Select
              options={STOREY_HEIGHT_BASES.map((basis) => ({ value: basis, label: humaniseEnum(basis) }))}
              value={heightDraft.basis}
              data-testid={testIds.heightBasis}
              aria-label={LEVELS_COPY.levels_height_basis_label}
              onChange={(basis) => setHeightDraft((draft) => ({ ...draft, basis }))}
            />
          </label>
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_source_label}</span>
            <Input
              value={heightDraft.sourceKey}
              data-testid={testIds.heightSource}
              aria-label={LEVELS_COPY.levels_height_source_label}
              aria-describedby="levels-height-source-hint"
              onChange={(event) => setHeightDraft((draft) => ({ ...draft, sourceKey: event.target.value }))}
            />
          </label>
          <p className="cx-levels-hint" id="levels-height-source-hint">
            {LEVELS_COPY.levels_height_source_hint}
          </p>
          <Door
            testId={testIds.authorHeight}
            permission={AUTHOR_PROJECT_FACT}
            label={LEVELS_COPY.levels_author_height}
            denial={LEVELS_COPY.levels_denied_height}
            held={holdsFact}
            offline={offline}
            variant="secondary"
            onPress={() => openHeight(chosen.levelId)}
            Button={Button}
            Tooltip={Tooltip}
          />
          <Door
            testId={testIds.repudiate}
            permission={AUTHOR_LEVEL_STACK}
            label={LEVELS_COPY.levels_repudiate}
            denial={LEVELS_COPY.levels_denied_stack}
            held={holdsStack}
            offline={offline}
            variant="ghost"
            onPress={() => openRepudiate(chosen.levelId)}
            Button={Button}
            Tooltip={Tooltip}
          />
        </div>
      </div>
    );
  }, [
    BasisChip,
    Button,
    EnumLabel,
    IdChip,
    Input,
    NumberInput,
    QuantityText,
    Select,
    Tooltip,
    chosen,
    heightDraft,
    holdsFact,
    holdsStack,
    humaniseEnum,
    offline,
    openHeight,
    openRepudiate,
    testIds,
  ]);

  /* ------------------------------------------------------------------ the stack table's columns */

  const columns: LevelColumn[] = [
    {
      id: "level",
      header: LEVELS_COPY.levels_col_level,
      accessorFn: (held) => held.label,
      size: WIDTH_LEVEL,
      // R-UI-082: the surrogate renders as an IdChip beside the label, never woven into a sentence.
      cell: ({ row }) => (
        <span className="cx-levels-cell-level">
          <span className="cx-levels-label">{row.original.label}</span>
          <IdChip value={row.original.levelId} />
        </span>
      ),
    },
    {
      id: "ordinal",
      header: LEVELS_COPY.levels_col_ordinal,
      meta: { align: "right" },
      accessorFn: (held) => String(held.ordinal),
      size: WIDTH_ORDINAL,
      cell: ({ row }) => <span className="cx-levels-mono">{formatUserFigure(String(row.original.ordinal))}</span>,
    },
    {
      id: "standing",
      header: LEVELS_COPY.levels_col_standing,
      accessorFn: (held) => held.standing,
      size: WIDTH_STANDING,
      // I-242: the standing in words, and a figure ONLY where the readings agreed on one.
      cell: ({ row }) => (
        <span className="cx-levels-cell-standing">
          <EnumLabel value={row.original.standing} className="cx-levels-enum" />
          {row.original.standing === AGREED && row.original.canonicalMetres !== null ? (
            <QuantityText value={row.original.canonicalMetres} format={FIGURES} className="cx-levels-figure" />
          ) : null}
          {row.original.standing === AGREED && row.original.canonicalMetres !== null ? <UnitBadge unit={CANONICAL_UNIT.LENGTH} /> : null}
          {row.original.code === null ? null : <EnumLabel value={row.original.code} className="cx-levels-enum" />}
        </span>
      ),
    },
    ...kinds.map((kind) => ({
      id: `rollup:${kind}`,
      header: kind,
      size: WIDTH_ROLLUP,
      // I-241: the cell states the STORED lines of that kind on that level, exactly as the reading
      // answered them. A level bearing no line of this kind bears no roll-up to state.
      cell: ({ row }: LevelCell) => {
        const held = row.original.rollups.find((rollup) => rollup.kind === kind);
        if (held === undefined) return <span className="cx-levels-none">{DASH}</span>;
        return <Rollup rollup={held} testId={testIds.rollup} CoverageChip={CoverageChip} EnumLabel={EnumLabel} QuantityText={QuantityText} UnitBadge={UnitBadge} />;
      },
    })),
  ];

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all,
  // and a press that raised a fault into one would otherwise return with nothing said (R-UI-020).
  if (fault !== null) throw fault;

  /* ------------------------------------------------------------------------------ the state */

  /**
   * §2's order, first holding wins. `denied` is the whole screen's only when EVERY door on it is
   * shut (I-247) — a reader who holds one of the three is not denied, and the doors say for
   * themselves which permission each wants. `partial` is the reading's own deferred half: the views
   * whose typical range nobody stated are shown in the rail and never hidden (R-UI-050's partial),
   * while a level's own code and a roll-up's coverage are stated on the row that carries them.
   */
  const derived = !holdsStack && !holdsFact && !holdsMeasure
    ? "denied"
    : offline
      ? "offline"
      : answer !== null
        ? "refused"
        : stack.length === 0
          ? "empty"
          : reading.unstatedRanges.length > 0
            ? "partial"
            : "ready";
  const shown = state ?? derived;
  const denied = shown === "denied";

  /** R-UI-050's error cell: the read failed, and the report id stands beside the one door that clears it. */
  if (shown === "error") {
    return (
      <div className="cx-levels" data-testid={testIds.screen} data-state="error">
        <div className="cx-levels-fault" role="alert">
          <h1 className="cx-levels-fault-heading">{LEVELS_COPY.levels_error_heading}</h1>
          <p className="cx-levels-fault-body">{LEVELS_COPY.levels_error_body}</p>
          <p className="cx-levels-report">
            <span className="cx-levels-report-label">{LEVELS_COPY.levels_report_label}</span>
            {reportId === undefined || reportId === null ? null : <IdChip value={reportId} />}
          </p>
          <Button variant="secondary" onClick={onRetry ?? reread}>
            {LEVELS_COPY.levels_retry}
          </Button>
        </div>
      </div>
    );
  }

  if (shown === "loading") {
    return (
      <div className="cx-levels cx-levels-loading" data-testid={testIds.screen} data-state="loading">
        <LoadingBones Skeleton={chrome.Skeleton} />
      </div>
    );
  }

  return (
    <div className="cx-levels" data-testid={testIds.screen} data-state={shown}>
      {/* The lane's tabs row and the frame's one inspector are filled, not drawn (§3.2, R-UI-080):
          each mount renders where its region is, and nothing where there is nothing to show. */}
      <TabsAside>{stack.length === 0 ? null : insertDoor}</TabsAside>
      <InspectorMount>{inspector}</InspectorMount>

      {offline ? (
        <p className="cx-levels-offline" role="status">
          {LEVELS_COPY.levels_offline}
        </p>
      ) : null}

      {/* R-UI-020: a door's rejection renders in place, through the one renderer, never as a toast.
          The slot is live so an answer is spoken the moment it arrives (R-UI-012). */}
      <div className="cx-levels-answer" aria-live="polite">
        {denied ? (
          <>
            <p className="cx-levels-denied">{LEVELS_COPY.levels_denied_stack}</p>
            <p className="cx-levels-denied">{LEVELS_COPY.levels_denied_holder}</p>
            <Denied evidence={evidence} RefusalState={RefusalState} />
          </>
        ) : null}
        {answer === null ? null : <RefusalState refusal={answer.refusal} evidence={answer.evidence} />}
      </div>

      <div className="cx-levels-body">
        {/* I-240: the campaign's index stands BESIDE the grid, never under it — a view with no range
            is a fact ABOUT the stack rather than a level in it. */}
        <section className="cx-levels-panel cx-levels-ranges" data-testid={testIds.ranges}>
          <h2 className="cx-levels-panel-heading">{LEVELS_COPY.levels_ranges_heading}</h2>
          <p className="cx-levels-hint">{LEVELS_COPY.levels_ranges_hint}</p>
          {reading.unstatedRanges.length === 0 ? <p className="cx-levels-none-said">{LEVELS_COPY.levels_ranges_none}</p> : null}
          {reading.unstatedRanges.map((range) => (
            <div className="cx-levels-range-row" key={range.viewKey} data-testid={testIds.rangeRow} data-view={range.viewKey} data-code={range.code}>
              <p className="cx-levels-range-caption">
                <span>{range.caption}</span>
                <IdChip value={range.drawingId} />
              </p>
              <label className="cx-levels-field">
                <span>{LEVELS_COPY.levels_range_from_label}</span>
                <NumberInput
                  value={rangeDrafts[range.viewKey]?.from ?? ""}
                  step={ORDINAL_STEP}
                  data-testid={testIds.rangeFrom}
                  aria-label={LEVELS_COPY.levels_range_from_label}
                  onChange={(from) => setRangeDrafts((held) => ({ ...held, [range.viewKey]: { from, to: held[range.viewKey]?.to ?? "" } }))}
                />
              </label>
              <label className="cx-levels-field">
                <span>{LEVELS_COPY.levels_range_to_label}</span>
                <NumberInput
                  value={rangeDrafts[range.viewKey]?.to ?? ""}
                  step={ORDINAL_STEP}
                  data-testid={testIds.rangeTo}
                  aria-label={LEVELS_COPY.levels_range_to_label}
                  onChange={(to) => setRangeDrafts((held) => ({ ...held, [range.viewKey]: { from: held[range.viewKey]?.from ?? "", to } }))}
                />
              </label>
              <Door
                testId={testIds.authorRange}
                permission={MEASURE}
                label={LEVELS_COPY.levels_author_range}
                denial={LEVELS_COPY.levels_denied_range}
                held={holdsMeasure}
                offline={offline}
                variant="secondary"
                onPress={() => openRange(range)}
                Button={Button}
                Tooltip={Tooltip}
              />
            </div>
          ))}
        </section>

        {/* The primary region. Nothing stands above it inside `shell-main` (I-240): no filter bar,
            no heading, no caption — the grid is what this screen is. The keyboard path into a row is
            the grid's own; this handler adds the pointer to it, reading the row a click landed on off
            the `data-level` the screen itself published (§5 rule 10, the register's I-236). */}
        <div
          className="cx-levels-mount cx-levels-grid"
          data-testid={testIds.grid}
          data-rows-rendered={stack.length}
          onClick={(event) => {
            const row = event.target instanceof Element ? event.target.closest("[data-level]") : null;
            const levelId = row?.getAttribute("data-level") ?? null;
            if (levelId === null) return;
            setSelected((held) => (held === levelId ? null : levelId));
          }}
        >
          {stack.length === 0 ? (
            // I-246: the ONE insert door, inside the empty state while the stack is empty — never a
            // second door that teaches two ways to do one thing.
            <EmptyState data-testid={testIds.empty} className="cx-levels-empty" heading={LEVELS_COPY.levels_empty_heading} body={LEVELS_COPY.levels_empty_body}>
              {insertDoor}
            </EmptyState>
          ) : (
            <DataTable
              tableId={LEVELS_TABLE_ID}
              columns={columns}
              data={stack}
              getRowId={(held) => held.levelId}
              freezeKeyColumn
              rowTestId={testIds.row}
              rowDataOf={(held) => rowDataOf(held, selected)}
              onRowSelect={(ids) => setSelected(ids[0] ?? null)}
              aria-label={LEVELS_COPY.levels_grid_label}
            />
          )}
        </div>
      </div>

      {pending === null ? null : (
        <ConsequenceDialog
          open
          actType={pending.actType}
          preview={previewOf(doors, pending, evidence)}
          commit={commitOf(doors, pending, evidence)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPending(null);
          }}
          onCommitted={() => {
            setPending(null);
            setInsertOpen(false);
            // The stack moved, so the screen reads it again: what a roll-up and a standing say is the
            // record's answer, never this screen's arithmetic over what it just sent (I-241).
            reread();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------ the pieces */

/** The em dash a cell states an absence with — never a zero, which would be a figure (L-QTY-02). */
const DASH = "—";

/** The same rejection, shaped as the one ConsequenceDialog reads one (its I-40). */
function refused(thrown: unknown, evidence: Evidence): never {
  const code = codeOf(thrown);
  const entry = code === null ? undefined : entryOf(code);
  if (entry === undefined) throw thrown;
  throw Object.assign(new Error(entry.code), { refusal: entry, evidence });
}

/** The preview the dialog runs for itself: state's own digest, taken again at the moment of showing. */
function previewOf(doors: LevelsDoors, act: Pending, evidence: Evidence): () => Promise<PreviewAnswer> {
  return async () => {
    try {
      if (act.actType === INSERT_LEVEL) return await doors.previewInsertLevel({ input: act.input });
      if (act.actType === REPUDIATE_LEVEL) return await doors.previewRepudiateLevel({ input: act.input });
      if (act.actType === AUTHOR_STOREY_HEIGHT) return await doors.previewAuthorStoreyHeight({ input: act.input });
      return await doors.previewAuthorTypicalRange({ input: act.input });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The commit the dialog's confirm carries, bound to the digest it showed (L-ACT-02). */
function commitOf(doors: LevelsDoors, act: Pending, evidence: Evidence): (carried: { consequenceDigest: string }) => Promise<{ actId: string }> {
  return async (carried) => {
    try {
      if (act.actType === INSERT_LEVEL) return await doors.commitInsertLevel({ input: act.input, consequenceDigest: carried.consequenceDigest });
      if (act.actType === REPUDIATE_LEVEL) return await doors.commitRepudiateLevel({ input: act.input, consequenceDigest: carried.consequenceDigest });
      if (act.actType === AUTHOR_STOREY_HEIGHT) return await doors.commitAuthorStoreyHeight({ input: act.input, consequenceDigest: carried.consequenceDigest });
      return await doors.commitAuthorTypicalRange({ input: act.input, consequenceDigest: carried.consequenceDigest });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The registered denial, rendered through the one renderer or not at all (R-UI-020, B-17). */
function Denied({ evidence, RefusalState }: { evidence: Evidence; RefusalState: LevelsChrome["RefusalState"] }) {
  const entry = entryOf(PERMISSION_NOT_HELD);
  if (entry === undefined) return null;
  return <RefusalState refusal={entry} evidence={evidence} />;
}

/**
 * One door of this screen (I-247). A reader who holds its permission presses the shipped Button; a
 * reader who does not is shown the same affordance, refusing the press and NAMING the permission
 * that would have carried it — a door that vanished teaches nobody what to ask for. The shut form is
 * the frame's own unavailable affordance (`cx-btn` chrome, `role="button"`, `aria-disabled`, in the
 * tab order), because the shipped Button reports `aria-disabled` for busy and for nothing else.
 */
function Door({
  testId,
  permission,
  label,
  denial,
  held,
  offline,
  variant,
  onPress,
  Button,
  Tooltip,
}: {
  testId: string;
  permission: string;
  label: string;
  denial: string;
  held: boolean;
  offline: boolean;
  variant: "primary" | "secondary" | "ghost";
  onPress: () => void;
  Button: LevelsChrome["Button"];
  Tooltip: LevelsChrome["Tooltip"];
}) {
  if (held && !offline) {
    return (
      <Button variant={variant} data-testid={testId} data-permission={permission} onClick={onPress}>
        {label}
      </Button>
    );
  }
  return (
    <Tooltip content={denial}>
      <span className="cx-btn cx-reticle cx-levels-door-shut" data-variant={variant} role="button" tabIndex={0} aria-disabled="true" data-testid={testId} data-permission={permission}>
        <span className="cx-btn-label">{label}</span>
      </span>
    </Tooltip>
  );
}

/**
 * The one primary and the form it opens (I-243, I-246): the fields change nothing, and the door
 * beside them previews. The form is a Popover anchored on the door because the door stands in a
 * 32 px track, where a row of fields is not a thing that can stand.
 */
function InsertDoor({
  copy,
  testIds,
  held,
  offline,
  open,
  onOpenChange,
  draft,
  onDraft,
  onConfirm,
  chrome,
}: {
  copy: typeof LEVELS_COPY;
  testIds: LevelsTestIds;
  held: boolean;
  offline: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: { label: string; ordinal: string };
  onDraft: (draft: { label: string; ordinal: string }) => void;
  onConfirm: () => void;
  chrome: LevelsChrome;
}) {
  const { Button, Input, NumberInput, Popover, PopoverTrigger, PopoverContent, Tooltip } = chrome;
  if (!held || offline) {
    return (
      <Tooltip content={copy.levels_denied_stack}>
        <span
          className="cx-btn cx-reticle cx-levels-door-shut"
          data-variant="primary"
          role="button"
          tabIndex={0}
          aria-disabled="true"
          data-testid={testIds.insert}
          data-permission={AUTHOR_LEVEL_STACK}
        >
          <span className="cx-btn-label">{copy.levels_insert}</span>
        </span>
      </Tooltip>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger data-testid={testIds.insert} data-permission={AUTHOR_LEVEL_STACK} data-variant="primary" className="cx-levels-insert">
        {copy.levels_insert}
      </PopoverTrigger>
      <PopoverContent className="cx-levels-insert-form" aria-label={copy.levels_insert}>
        <label className="cx-levels-field">
          <span>{copy.levels_insert_label_field}</span>
          <Input
            value={draft.label}
            data-testid={testIds.insertLabel}
            aria-label={copy.levels_insert_label_field}
            onChange={(event) => onDraft({ ...draft, label: event.target.value })}
          />
        </label>
        <label className="cx-levels-field">
          <span>{copy.levels_insert_ordinal_field}</span>
          <NumberInput
            value={draft.ordinal}
            step={ORDINAL_STEP}
            data-testid={testIds.insertOrdinal}
            aria-label={copy.levels_insert_ordinal_field}
            onChange={(ordinal) => onDraft({ ...draft, ordinal })}
          />
        </label>
        <p className="cx-levels-hint">{copy.levels_insert_hint}</p>
        <Button variant="secondary" data-testid={testIds.insertConfirm} onClick={onConfirm}>
          {copy.levels_insert_confirm}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** One reading of a height, as the inspector lists one: superseded, never erased (R-TO-051). */
function Reading({
  reading,
  testId,
  BasisChip,
  QuantityText,
}: {
  reading: LevelsViewReading;
  testId: string;
  BasisChip: LevelsChrome["BasisChip"];
  QuantityText: LevelsChrome["QuantityText"];
}) {
  return (
    <p
      className="cx-levels-reading"
      data-testid={testId}
      data-basis={reading.basis}
      data-source={reading.sourceKey ?? ""}
      data-metres={reading.canonicalMetres}
      data-superseded={String(reading.superseded)}
    >
      {/* I-25: what was written is kept as it was written, beside what it is worth in metres. */}
      <span className="cx-levels-mono">
        {reading.valueAsWritten} {reading.unitAsWritten}
      </span>
      <BasisChip basis={reading.basis as QuantityBasis} />
      <QuantityText value={reading.canonicalMetres} unit={CANONICAL_UNIT.LENGTH} format={FIGURES} />
      {reading.sourceKey === null ? null : (
        <span className="cx-levels-source" data-technical="">
          {reading.sourceKey}
        </span>
      )}
      {reading.superseded ? <span className="cx-levels-superseded">{LEVELS_COPY.levels_reading_superseded}</span> : null}
    </p>
  );
}

/**
 * One roll-up cell: the stored lines of one kind on one level, read and never re-derived (I-241). A
 * PARTIAL_DECLARED cell states NO value at all — L-QTY-02's rule about a row, applied to the cell
 * that sums them — and states the code the omission was declared under beside its chip.
 */
function Rollup({
  rollup,
  testId,
  CoverageChip,
  EnumLabel,
  QuantityText,
  UnitBadge,
}: {
  rollup: LevelsViewRollup;
  testId: string;
  CoverageChip: LevelsChrome["CoverageChip"];
  EnumLabel: LevelsChrome["EnumLabel"];
  QuantityText: LevelsChrome["QuantityText"];
  UnitBadge: LevelsChrome["UnitBadge"];
}) {
  const complete = rollup.coverage !== PARTIAL_DECLARED;
  return (
    <span className="cx-levels-rollup" data-testid={testId} data-kind={rollup.kind} data-lines={rollup.lines} data-coverage={rollup.coverage} data-code={rollup.code ?? ""}>
      <span className="cx-levels-mono">{fillCopy("levels_rollup_lines", { count: formatUserFigure(String(rollup.lines)) })}</span>
      {complete && rollup.value !== null ? <QuantityText value={rollup.value} format={FIGURES} className="cx-levels-figure" /> : null}
      {complete && rollup.value !== null && isUnit(rollup.unit) ? <UnitBadge unit={rollup.unit} /> : null}
      <CoverageChip value={complete ? 1 : 0} />
      {rollup.code === null ? null : <EnumLabel value={rollup.code} className="cx-levels-enum" />}
    </span>
  );
}

/** The bones that keep this screen's own layout while the route holds it (R-UI-004, §2). */
function LoadingBones({ Skeleton }: { Skeleton: LevelsChrome["Skeleton"] }) {
  return (
    <div className="cx-levels-body">
      <Skeleton style={BONE_RAIL} />
      <Skeleton style={BONE_GRID} />
    </div>
  );
}

const BONE_RAIL = { height: "100%", width: "240px" };
const BONE_GRID = { height: "100%", width: "100%" };
