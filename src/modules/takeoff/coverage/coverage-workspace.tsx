"use client";
// S-Coverage's workspace (docs/design/s-coverage.md, Design Direction 00 §3.5): the heat grid first,
// a 28 px key line above it, a 28 px tally beneath it, the cell's whole story in the shell's ONE
// inspector, and the certificate's two boundary statements as document text.
//
// Presentational and injected (I-170): every piece of shipped chrome arrives as a renderer declared
// by exactly the props this screen hands it, so a module never reaches the ui layer (ARCH-01) and a
// suite mounts the very components a reader sees. The screen computes no residue of its own — the
// arms are L-QTY-05's, resolved in core, and what stands here is only how they are read.
//
// THE THREE SHELL SLOTS (Direction §1, §3.1) arrive the same way. `useInspector`, `useShellToolbar`
// and `useShellStatus` are hooks of `@/ui/shell`, which a module may not import; so the workspace
// hands its inspector and its tool row to two injected MOUNTS, and the binding file — the one file
// allowed to reach both trees — is where the hooks are called. A mount that hands none renders the
// same nodes in place, which is what keeps this module a whole screen on its own (I-209).
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import type { Consequence } from "@/core/acts";
// The law module, not the residue's roster: the roster carries the query and its channel readers,
// which reach the database, and this file runs in the browser (ARCH-01, the `@/core/levels/law`
// precedent). Everything a rendering needs — the closed cause set and the cell's address — is law.
import { RESIDUE_CAUSES, UNPLACED, cellRef, type PartialStatementRow, type ResidueCell, type StatementRow } from "@/core/residue/law";
import type { UnclassedStatementRow } from "@/core/residue/statement";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { reasonsInWords } from "@/core/documents/kinds/boq-draft-law";
// The marker's one reader (ARCH-02): whether a rejection carries a registered code is not a
// judgement this screen makes for itself, and a second reading of it would be a second home (B-17).
import { refusalCodeOf } from "@/core/faults/refusal-marker";
// The viewer's address at the entities something cites, spelled once by the Trace (B-17): a module
// may not reach the app layer's route builders, and this one carries no database (ARCH-01).
import { narrowingQuery } from "@/modules/takeoff/register-ui/narrowing";
import { selectionAddress } from "@/modules/takeoff/trace/address";
import { axisReadOf, citedActOf } from "./cited-act";
import { COVERAGE_COPY, countCoverageCopy, countWords, fillCoverageCopy } from "./copy";
import {
  CoverageGrid,
  VOID_MARK,
  causeRead,
  causeSentence,
  causeWords,
  classWord,
  kindWord,
  levelWord,
  markOf,
  partialSummary,
  partlyBorne,
  remedyEntry,
  type CoverageDensity,
} from "./grid";
import { LegendGlyph, type GlyphReading } from "./glyphs";
import { MARK_OF, MARK_TALLY, MARK_WORD, countsByMark, linesDeclared } from "./heat";
import type { CoverageCauseProposalView, CoverageView, ProposedCause } from "./view";

export type { CoverageDensity } from "./grid";

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/** What a preview answers (L-ACT-02): the typed Consequence, and the digest that binds it. */
export type CoveragePreviewAnswer = { consequence: Consequence; consequenceDigest: string };

/** The cell a boundary act stands over, as the two doors name one. */
export type BoundaryCell = {
  readonly projectId: string;
  readonly campaignId: string;
  readonly class: string;
  readonly kind: string;
  readonly levelId: string;
  /** The boundary a model proposed, where the person carrying the act was shown one (I-297). */
  readonly proposal?: ProposedCause;
};

/**
 * The shipped renderers the app layer injects (I-170). Each is declared by exactly the props this
 * screen hands it, so the shipped component itself is assignable and no adapter stands between what
 * a reader sees and what a test mounts.
 */
export interface CoverageChrome {
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary";
    disabled?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
    "data-testid"?: string;
  }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly ConsequenceDialog: ComponentType<{
    open: boolean;
    actType: string;
    preview: () => Promise<CoveragePreviewAnswer>;
    commit: (carried: { consequenceDigest: string }) => Promise<{ actId: string }>;
    onOpenChange: (open: boolean) => void;
    onCommitted: (committed: { actId: string }) => void;
    container?: HTMLElement | null;
  }>;
  /** R-UI-082: an opaque identifier as a person can use it — short, whole, copyable. */
  readonly IdChip: ComponentType<{ value: string; className?: string }>;
  /**
   * §6: a model value said in words, with the SCREAMING form left inside `[data-technical]` — and, for
   * a kind, the words the draft BOQ's rule says it by, handed in as its `label` (I-351).
   */
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string }>;
  /** The key line's one-sentence meaning, on hover and on focus (§3.5). */
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** R-UI-050's empty cell: glyph, title, one sentence, one primary. */
  readonly EmptyState: ComponentType<{ heading: string; body?: string; children?: ReactNode; "data-testid"?: string }>;
  /** R-UI-050's fault cell: the retry and the id to quote, never a refusal. */
  readonly ErrorState: ComponentType<{
    heading: string;
    body?: string;
    reportId?: string;
    onRetry?: () => void;
    retryLabel?: string;
    "data-testid"?: string;
  }>;
  /** The shell's ONE right column, mounted through `useInspector` by the binding file (§3.1). */
  readonly InspectorMount: ComponentType<{ children: ReactNode }>;
  /** The shell's 32 px tool row, mounted through `useShellToolbar` by the binding file (§3.1). */
  readonly ToolbarMount: ComponentType<{ children: ReactNode }>;
}

/** The doors this screen presses, and the one lookup a refusal's words are read through (I-170). */
export interface CoverageDoors {
  readonly previewHoldOutOfBill: (argument: { input: BoundaryCell }) => Promise<CoveragePreviewAnswer>;
  readonly commitHoldOutOfBill: (argument: { input: BoundaryCell; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewDeclareNotInProjectScope: (argument: { input: BoundaryCell }) => Promise<CoveragePreviewAnswer>;
  readonly commitDeclareNotInProjectScope: (argument: { input: BoundaryCell; consequenceDigest: string }) => Promise<{ actId: string }>;
  /**
   * Re-run the read in place — R-UI-050's error cell owns the one door that clears it. A mount that
   * hands none has nothing to re-read, and the retry is not rendered rather than pressed into a
   * silence (R-UI-020).
   */
  readonly retry?: () => void;
  readonly refusalOf: (code: string) => RefusalEntry | undefined;
  /**
   * Ask what boundary a model would propose for the selected cell (I-297). It answers `{proposal:
   * null}` for every cell it does not ask about and for every answer it will not stand behind, so
   * this screen never learns the gate, the floor or the refusal taxonomy — all three are the
   * server's, where the residue and the ledger are (L-AI-02, B-17). A mount that hands no such door
   * shows no proposal, which is the same screen a cell with nothing proposed shows.
   */
  readonly proposeCause?: (argument: { cell: string }) => Promise<CoverageCauseProposalView>;
}

export interface CoverageWorkspaceProps {
  /** The reading, or `null` where it failed — the error cell is a state of this screen (R-UI-050). */
  readonly view: CoverageView | null;
  readonly density?: CoverageDensity;
  /** Whether the reader holds SET_BILL_BOUNDARY on this project, read server-side (Decision § 2). */
  readonly permitted?: boolean;
  readonly offline?: boolean;
  /** The fault the read left behind, where one did — quoted verbatim beside the retry (B-21). */
  readonly reportId?: string | null;
  /** The code a door answered with, rendered through the one refusal renderer (R-UI-020). */
  readonly refused?: string | null;
  /** The cell the address named on mount (I-193); a cell this residue does not hold selects nothing. */
  readonly cell?: string | null;
  /**
   * The state cell the CALLER has already settled, where it knows one this screen cannot derive —
   * `loading` is the route's own, because a screen holding a reading is by definition past it. It is
   * the one place R-UI-050's matrix and this screen meet, so it is spelled in the matrix' own names
   * (B-19); absent, the state is derived from the reading below and no caller can claim one.
   */
  readonly state?: string | null;
  /**
   * The shipped chrome, injected (I-170). Each renderer is optional because a module may not reach
   * the ui layer (ARCH-01) and the patterns have exactly one home each (B-17): where one is not
   * handed over, this screen falls back to house markup rather than growing a second component.
   */
  readonly chrome?: Partial<CoverageChrome>;
  readonly doors?: Partial<CoverageDoors>;
}

/* --------------------------------------------------------------------------- the addresses */

// The addresses this screen links. ARCH-01 bars a module from the app layer where a route builder
// lives, so they are spelled here for this screen and nowhere else in it (Decision § 7).
const setsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;
const drawingsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings`;
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;

/**
 * The register, narrowed to one cell's class, kind and level (I-484): what "Open the
 * register" from a cell promises is that cell's lines and objects, never all of them. The query is
 * the register's own (`narrowingQuery`, which the register reads back into its filter chips), and the
 * values are the ones it filters by — the stored class and kind, the level as the register labels it
 * (its label, or the slot a foundation stands in). A class nothing placed stands on no level at all.
 */
export function registerCellHref(tenantId: string, projectId: string, cell: Pick<ResidueCell, "kind" | "class" | "levelLabel" | "levelSlot">): string {
  const level = cell.levelLabel !== "" ? cell.levelLabel : (cell.levelSlot ?? "");
  const query = narrowingQuery({ class: cell.class ?? "", kind: cell.kind, level: level === UNPLACED ? "" : level });
  return `${registerHref(tenantId, projectId)}?${query}`;
}

/** The two reasons whose fix is made on a sheet rather than in the register (I-484). */
const CLASS_NOT_PLACED = REFUSALS.COVERAGE_CLASS_NOT_PLACED.code;
const VIEW_SCALE_UNAFFIRMED = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;

/**
 * Where a cell's one remedy button goes — the place its fix is made (R-UI-020, I-484): the
 * rule set for a kind no class bears; the sheet that shows a class nothing placed, flown to its
 * caption; the drawings, where a view's scale is affirmed; and for everything else the register,
 * narrowed to the cell.
 */
export function remedyDoorOf(cell: ResidueCell, tenantId: string, projectId: string): { href: string; label: string } {
  const read = causeRead(cell);
  if (read === KIND_NOT_YET_SEEDED) return { href: rulesetHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_remedy_ruleset };
  if (read === NOT_ESTABLISHED && cell.reason === CLASS_NOT_PLACED) {
    const shown = cell.sightings.find((sighting) => sighting.declared === true && sighting.layoutName !== "");
    return shown === undefined
      ? { href: drawingsHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_remedy_drawings }
      : {
          href: selectionAddress(tenantId, projectId, { drawingId: shown.drawingId, layoutName: shown.layoutName, sourceKeys: [shown.sourceKey] }),
          label: COVERAGE_COPY.takeoff_coverage_remedy_sheet,
        };
  }
  if (read === NOT_ESTABLISHED && cell.reason === VIEW_SCALE_UNAFFIRMED) {
    return { href: drawingsHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_remedy_drawings };
  }
  return { href: registerCellHref(tenantId, projectId, cell), label: COVERAGE_COPY.takeoff_coverage_empty_campaign_action };
}
const participantsHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`;
const rulesetHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset`;

/** The code the screen's own denial renders, off the registry the caller looks it up in. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The act types the two doors confirm as. */
const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL" as const;
const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE" as const;

/** The reading the measurement axis stands at when nothing is wrong. */
const QUANTITY_BEARING = "QUANTITY_BEARING";
/** The one cause whose remedy names a place this product holds — the ruleset (I-191). */
const KIND_NOT_YET_SEEDED = "KIND_NOT_YET_SEEDED";
/** The writerless fall-through every campaign-read reason stands beside (L-QTY-05, I-480). */
const NOT_ESTABLISHED = "NOT_ESTABLISHED";
/** The bill cause the hold writes, and the door a proposal of it names (I-297). */
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";

/**
 * Whether the two boundary doors stand over this cell for this reader — I-194's one rule, read by
 * the inspector that draws them and by the effect that asks what a model would propose, because a
 * proposal is only ever worth asking for where the person could carry it (L-AI-01: a call nobody
 * could act on is a charge for nothing). A second spelling of it would be a second answer (B-17).
 */
function boundaryDoorsStand(cell: ResidueCell, permitted: boolean): boolean {
  return permitted && cell.grain !== "KIND" && causeRead(cell) !== QUANTITY_BEARING && cell.class !== null && cell.levelId !== null;
}

/**
 * The address parameter this screen is widened by (Decision § 7). Exported because the route builder
 * beside `page.tsx` spells the same address, and a parameter name with two homes is a parameter that
 * can drift (B-17).
 */
export const CELL_PARAM = "cell";

/** Which statement a section prints — two, separately titled and never merged (L-QTY-07). */
const MEASUREMENT = "MEASUREMENT";
const BILL = "BILL";

/** The channel a person's own declaration is cited under, beside the three the machine sights on. */
const DECLARATION = "DECLARATION";

/** What an empty statement answers with: a boundary nothing stands outside is still a statement. */
const NONE = "NONE";

/** The dialog is mounted only over a standing door, so its pair is asked nothing when none stands. */
const NO_DOOR_STANDS = "no door stands over a cell";

/**
 * The state cell this screen stands in, in the Decision § 2's own order — first holding wins, and
 * every reading is one of R-UI-050's own matrix names so the declaration and the screen cannot spell
 * the same state two ways (B-19). `loading` is not derivable here and is the caller's to state.
 */
function stateOf(props: CoverageWorkspaceProps): string {
  if (props.permitted === false) return "denied";
  if (props.offline === true) return "offline";
  if (props.view === null) return "error";
  if ((props.refused ?? null) !== null) return "refusal";
  if (nothingToShow(props.view)) return "empty";
  return props.view.cells.some((cell) => cell.grain === "KIND") ? "partial" : "ready";
}

/**
 * Whether this reading has anything to show: no campaign pinned, or a campaign whose residue holds
 * no cell. It is a fact about the READING, not about the state cell — a reader denied the boundary
 * doors is still owed the reason the screen is empty, and a denial states a permission they do not
 * need in order to be told that nothing has been pinned yet (R-UI-050, R-UI-020: an empty list says
 * why it is empty). So the body asks this question and the state precedence asks it too, from one
 * home (B-17), exactly as the error cell already stands whatever the precedence said.
 */
function nothingToShow(view: CoverageView): boolean {
  return view.campaignId === null || view.cells.length === 0;
}

export function CoverageWorkspace(props: CoverageWorkspaceProps) {
  const { view } = props;
  const density = props.density ?? "comfortable";
  const offline = props.offline ?? false;
  const chrome = props.chrome ?? {};
  const doors: Partial<CoverageDoors> = props.doors ?? {};
  const reportId = props.reportId ?? null;
  const {
    Button = FallbackButton,
    RefusalState,
    ConsequenceDialog,
    IdChip = FallbackIdChip,
    EnumLabel = FallbackEnumLabel,
    Tooltip = FallbackTooltip,
    EmptyState = FallbackEmptyState,
    ErrorState = FallbackErrorState,
    InspectorMount = InPlace,
    ToolbarMount = InPlace,
  } = chrome;
  const state = props.state ?? stateOf(props);
  // I-194: the denial is the STATE, not merely the prop it usually derives from. A caller that states
  // `denied` outright — R-UI-050's matrix walked one cell at a time — is stating that this reader does
  // not hold SET_BILL_BOUNDARY, and a screen reading `data-state="denied"` keeps no door open on any
  // other evidence: both are absent, never disabled, and the denial is said once in `coverage-answer`.
  const permitted = (props.permitted ?? true) && state !== "denied";
  // A state the caller stated is a state the screen renders: the matrix declares this screen's
  // refusal as the denial of SET_BILL_BOUNDARY, so that is the code the refusal cell states when no
  // door has answered with one of its own (R-UI-020 — a refusal is never silent).
  const refused = props.refused ?? (state === "refusal" ? PERMISSION_NOT_HELD : null);
  const [selected, setSelected] = useState<string | null>(props.cell ?? null);
  const [door, setDoor] = useState<typeof HOLD_OUT_OF_BILL | typeof DECLARE_NOT_IN_PROJECT_SCOPE | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  // The certificate is a DOCUMENT, and a document is not the work surface: it shuts from the tool row
  // so the grid can take main's height back (§7 C1). It stands OPEN by default — a boundary statement
  // nobody can see is a statement nobody reads (L-QTY-07).
  const [previewing, setPreviewing] = useState(true);

  const cells = view?.cells ?? [];
  // I-cov-1: the published lines kept with no quantity, as a set the grid, the tally and the
  // inspector all read — one reading of "partly borne", never three.
  const declaredIds = view?.declaredLineIds;
  const declared = useMemo<ReadonlySet<string>>(() => new Set(declaredIds ?? []), [declaredIds]);
  const held = cells.find((cell) => cellRef(cell) === selected) ?? null;
  // The boundary a model proposed for the cell the inspector stands over, filed under that cell's
  // own address: a proposal read for one cell is never shown beside another (I-297).
  const [proposed, setProposed] = useState<{ cell: string; proposal: ProposedCause | null } | null>(null);
  const askable = held !== null && boundaryDoorsStand(held, permitted) && !offline;
  const askCause = doors.proposeCause;

  // I-193: the address is replaced rather than pushed, so it is shareable and Back leaves the screen
  // instead of walking a reader backwards through fifty clicks.
  const select = useCallback((address: string): void => {
    setSelected(address);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const here = new URL(window.location.href);
    if (selected === null) here.searchParams.delete(CELL_PARAM);
    else here.searchParams.set(CELL_PARAM, selected);
    window.history.replaceState(window.history.state, "", here.toString());
  }, [selected]);

  /**
   * One cell open, one question asked (I-297). The door is put once per cell the two boundary doors
   * stand over, and its answer is discarded when the reader moves on — a proposal is read for the
   * cell in front of the person, and an answer that arrives after they have moved names a cell that
   * is no longer selected. A rejection is no proposal: the door already answers `{proposal: null}`
   * for every refusal it can name, so anything that still reaches here leaves the region absent
   * rather than putting a model's silence in the reader's way (R-UI-020, L-AI-02).
   */
  useEffect(() => {
    if (askCause === undefined || selected === null || !askable) {
      setProposed(null);
      return;
    }
    const address = selected;
    let standing = true;
    setProposed(null);
    void askCause({ cell: address }).then(
      (answer) => {
        if (standing) setProposed({ cell: address, proposal: answer.proposal });
      },
      () => {
        if (standing) setProposed({ cell: address, proposal: null });
      },
    );
    return () => {
      standing = false;
    };
  }, [askCause, selected, askable]);

  // The registry is core, so a caller that hands no lookup gets the registry itself rather than a
  // screen with no words for a code (ARCH-02, B-17).
  const refusalOf = doors.refusalOf ?? causeWords;
  const refusal = refused === null ? undefined : refusalOf(refused);
  const denial = refusalOf(PERMISSION_NOT_HELD);
  const tenantId = view?.tenantId ?? "";
  const projectId = view?.projectId ?? "";

  /** Where a reader is sent to resolve a door's rejection — the register, where the lines are made. */
  const evidence: Evidence = { href: registerHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_empty_campaign_action };

  /** The proposal standing over the cell in front of the reader, and nothing for any other cell. */
  const proposal = held !== null && proposed !== null && proposed.cell === cellRef(held) ? proposed.proposal : null;

  /** What a door stands over as the screen stands NOW, read by the pair below rather than closed over. */
  const standing = useRef({ doors, refusalOf, view, held, door, evidence, proposal });
  standing.current = { doors, refusalOf, view, held, door, evidence, proposal };

  /**
   * A rejection at a door, shaped as the one ConsequenceDialog reads one (its I-40): a registered
   * code is rendered as an ANSWER, in the dialog holding the reader's focus (R-UI-020, R-UI-050,
   * Decision § 2) — and `CONSEQUENCES_NOT_CARRIED` reaches the dialog's own re-render rather than a
   * card (I-44). A failure carrying no registered code is a fault and is re-raised untouched, for
   * the boundary that mints the report id (ARCH-03, B-21).
   *
   * The reading is re-read in place first: a person refused because the state moved under them is
   * owed the state that refused them, not the one they loaded (R-UI-050).
   */
  const refuse = useCallback((thrown: unknown): never => {
    const { doors: at, refusalOf: words, evidence: sends } = standing.current;
    const code = refusalCodeOf(thrown);
    const entry = code === null ? undefined : words(code);
    if (entry === undefined) throw thrown;
    at.retry?.();
    throw Object.assign(new Error(entry.code), { refusal: entry, evidence: sends });
  }, []);

  /**
   * The pair the dialog is handed (L-ACT-02), bound ONCE for as long as it stands: the shipped dialog
   * re-runs its preview whenever these two change identity, so a pair rebuilt on every render would
   * wipe the very answer the reader is looking at the moment the re-read above lands. What each call
   * stands over is read off the ref, so the pair is stable and never stale.
   */
  const previewAtDoor = useCallback(async (): Promise<CoveragePreviewAnswer> => {
    const { doors: at, view: over, held: cell, door: which, proposal: offered } = standing.current;
    const open = which === HOLD_OUT_OF_BILL ? at.previewHoldOutOfBill : at.previewDeclareNotInProjectScope;
    if (over === null || cell === null || which === null || open === undefined) throw new Error(NO_DOOR_STANDS);
    try {
      return await open({ input: inputOf(over, cell, offered) });
    } catch (thrown) {
      return refuse(thrown);
    }
  }, [refuse]);

  const commitAtDoor = useCallback(
    async (carried: { consequenceDigest: string }): Promise<{ actId: string }> => {
      const { doors: at, view: over, held: cell, door: which, proposal: offered } = standing.current;
      const settle = which === HOLD_OUT_OF_BILL ? at.commitHoldOutOfBill : at.commitDeclareNotInProjectScope;
      if (over === null || cell === null || which === null || settle === undefined) throw new Error(NO_DOOR_STANDS);
      try {
        return await settle({ input: inputOf(over, cell, offered), consequenceDigest: carried.consequenceDigest });
      } catch (thrown) {
        return refuse(thrown);
      }
    },
    [refuse],
  );

  /** Whether a reading stands at all — what the tool row's own control may act on. */
  const readable = view !== null && state !== "error" && state !== "loading";

  return (
    <div className="cx-coverage" data-testid="coverage-screen" data-state={state} data-density={density} data-campaign={view?.campaignId ?? ""} ref={setRoot}>
      {/* §3.5's 32 px tool row: what a reader does TO the screen, never inside the work surface. */}
      <ToolbarMount>
        <div className="cx-coverage-tools">
          {view === null || view.setRevisionId === null ? null : (
            <span className="cx-coverage-revision-block">
              <span className="cx-coverage-revision-label">{COVERAGE_COPY.takeoff_coverage_revision_label}</span>
              <IdChip value={view.setRevisionId} className="cx-coverage-revision" />
            </span>
          )}
          {readable ? (
            <Button variant="secondary" onClick={() => setPreviewing((open) => !open)}>
              {previewing ? COVERAGE_COPY.takeoff_coverage_certificate_hide : COVERAGE_COPY.takeoff_coverage_certificate_show}
            </Button>
          ) : null}
        </div>
      </ToolbarMount>

      {/* I-cov-5: the screen names itself once, for heading navigation, clipped out of sight — the
          breadcrumb and the current tab already say `Coverage` (the register's `cx-register-title`). */}
      <h1 className="cx-coverage-title">{COVERAGE_COPY.takeoff_coverage_heading}</h1>

      {offline ? (
        <p className="cx-coverage-offline" role="status">
          {COVERAGE_COPY.takeoff_coverage_offline}
        </p>
      ) : null}

      {/* R-UI-020: one renderer, one slot. A door's rejection is answered here and nowhere else. */}
      <div className="cx-coverage-answer" data-testid="coverage-answer" aria-live="polite">
        {state === "denied" ? (
          <>
            <p className="cx-coverage-denied">{COVERAGE_COPY.takeoff_coverage_denied_permission}</p>
            {denial === undefined || RefusalState === undefined ? null : (
              <RefusalState refusal={denial} evidence={{ href: participantsHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_denied_holder }} />
            )}
          </>
        ) : null}
        {refusal === undefined || RefusalState === undefined ? null : (
          <RefusalState refusal={refusal} evidence={{ href: registerHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_empty_campaign_action }} />
        )}
      </div>

      {state === "loading" ? (
        // R-UI-050's loading cell: the shape of what is coming, not a spinner over nothing. The
        // route is the only reader that knows this state, so it is the only one that can state it.
        <div className="cx-coverage-loading" aria-busy="true" aria-live="polite">
          <p className="cx-coverage-hint">{COVERAGE_COPY.takeoff_coverage_loading}</p>
        </div>
      ) : view === null || state === "error" ? (
        // No reading came back, so there is nothing to state: the error cell owns the whole body and
        // the preview stands down with it — a statement over a read that failed would be a claim
        // about a boundary nobody read (R-UI-050, B-21).
        <ErrorState
          heading={COVERAGE_COPY.takeoff_coverage_error_heading}
          body={COVERAGE_COPY.takeoff_coverage_error_body}
          reportId={reportId ?? undefined}
          onRetry={doors.retry}
          retryLabel={COVERAGE_COPY.takeoff_coverage_retry}
          data-testid="coverage-empty"
        />
      ) : (
        <>
          {nothingToShow(view) ? (
            <EmptyCell view={view} EmptyState={EmptyState} />
          ) : (
            // The work surface is a box, not a region: the matrix inside it carries the name (I-190),
            // and a second element with the same accessible name is the same fact said twice.
            <div className="cx-coverage-work">
              <KeyLine Tooltip={Tooltip} />
              <CoverageGrid
                cells={cells}
                levels={view.input.levels}
                truncated={view.input.truncated}
                density={density}
                selected={selected}
                onSelect={select}
                declared={declared}
                EnumLabel={EnumLabel}
              />
              <Tally cells={cells} declared={declared} />
            </div>
          )}
          {/* I-208: the empty cell stands in the BODY's place; the preview stands beneath it in every
              state that has a reading, because a boundary nothing stands outside is still a statement
              a certificate makes (L-QTY-07, Decision §1–§2). */}
          <CertificatePreviewSection
            measurement={view.measurement}
            partial={view.partial ?? []}
            unclassed={view.unclassed ?? []}
            bill={view.bill}
            pinned={view.campaignId !== null}
            open={previewing}
          />
        </>
      )}

      {/* §3.1: the ONE right column, and it stands only while a cell is selected. */}
      {held === null ? null : (
        <InspectorMount>
          <Inspector
            cell={held}
            declared={declared}
            permitted={permitted}
            offline={offline}
            proposal={proposal}
            Button={Button}
            IdChip={IdChip}
            EnumLabel={EnumLabel}
            onCarryProposed={() => setDoor(proposal?.cause === NOT_IN_THIS_BILL ? HOLD_OUT_OF_BILL : DECLARE_NOT_IN_PROJECT_SCOPE)}
            onHoldOut={() => setDoor(HOLD_OUT_OF_BILL)}
            onDeclareOutOfScope={() => setDoor(DECLARE_NOT_IN_PROJECT_SCOPE)}
            remedyHref={remedyDoorOf(held, tenantId, projectId).href}
            remedyLabel={remedyDoorOf(held, tenantId, projectId).label}
          />
        </InspectorMount>
      )}

      {door === null || held === null || view === null || ConsequenceDialog === undefined ? null : (
        <ConsequenceDialog
          open
          actType={door}
          container={root}
          preview={previewAtDoor}
          commit={commitAtDoor}
          onOpenChange={(open) => {
            if (!open) setDoor(null);
          }}
          onCommitted={() => {
            setDoor(null);
            doors.retry?.();
          }}
        />
      )}
    </div>
  );
}

/**
 * The cell one door stands over, in the shape the seam declares — and the proposal the reader was
 * shown, where one stood (I-297). A person who declared unaided carries no member at all, so the act
 * writes no outcome rather than a row saying a proposal nobody saw was confirmed.
 */
function inputOf(view: CoverageView, cell: ResidueCell, proposal: ProposedCause | null): BoundaryCell {
  return {
    projectId: view.projectId ?? "",
    campaignId: view.campaignId ?? "",
    class: cell.class ?? "",
    kind: cell.kind,
    levelId: cell.levelId ?? "",
    ...(proposal === null ? {} : { proposal }),
  };
}

/**
 * The one line the sightings fold behind (I-484): how many, and the sheets they stand on,
 * each once — "23 sightings on S-13" — or that they name no sheet.
 */
function sightingsSummary(count: number, sightings: ResidueCell["sightings"]): string {
  const sheets = [...new Set(sightings.map((seen) => seen.layoutName).filter((name) => name !== ""))];
  return countCoverageCopy("takeoff_coverage_sightings_summary", count, { sheets: sheets.length === 0 ? COVERAGE_COPY.takeoff_coverage_sightings_nowhere : sheets.join(" · ") });
}

/** One report the measure run made about a cell, said once with how many members it was said of. */
type Report = { readonly rail: string; readonly kind: string; readonly class: string; readonly reason: string; readonly view: string; readonly count: number };

/** A cell's reports, one per (rail, sentence, view), most said first (I-484). */
function reportsOf(cell: ResidueCell): Report[] {
  const held = new Map<string, Report>();
  for (const observation of cell.observations) {
    const view = observation.view ?? "";
    const key = `${observation.rail}\u0000${observation.reason}\u0000${view}`;
    const seen = held.get(key);
    held.set(key, { rail: observation.rail, kind: observation.kind, class: observation.class, reason: observation.reason, view, count: (seen?.count ?? 0) + 1 });
  }
  return [...held.values()].sort((left, right) => right.count - left.count);
}

/* ------------------------------------------------------------------------------ the parts */

/** R-UI-050's empty cell: two truths, each saying why, each teaching the one next action. */
function EmptyCell({ view, EmptyState }: { view: CoverageView; EmptyState: CoverageChrome["EmptyState"] }) {
  const pinned = view.campaignId !== null;
  const tenantId = view.tenantId ?? "";
  const projectId = view.projectId ?? "";
  return (
    <EmptyState
      data-testid="coverage-empty"
      heading={pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_heading : COVERAGE_COPY.takeoff_coverage_empty_heading}
      body={pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_body : COVERAGE_COPY.takeoff_coverage_empty_body}
    >
      {/* The core secondary Button worn as a link, the register's own idiom: a real anchor navigates. */}
      <a
        className="cx-btn cx-reticle cx-coverage-empty-action"
        data-variant="secondary"
        href={pinned ? registerHref(tenantId, projectId) : setsHref(tenantId, projectId)}
      >
        {pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_action : COVERAGE_COPY.takeoff_coverage_empty_action}
      </a>
    </EmptyState>
  );
}

/**
 * The key line (§3.5, §8's second fix): ONE 28 px row of seven glyph+word pairs. It was a 540 px
 * column of sentences — the sentences are not deleted, they are where a person asks for them, on
 * hover and on focus (I-195, §6). Nothing on this screen is carried by colour alone (R-UI-060): the
 * pair is a mark and a word, and the mark is the very one the grid draws.
 */
function KeyLine({ Tooltip }: { Tooltip: CoverageChrome["Tooltip"] }) {
  return (
    <div className="cx-coverage-legend" data-testid="coverage-legend" role="list" aria-label={COVERAGE_COPY.takeoff_coverage_legend_heading}>
      {LEGEND_READINGS.map((reading) => (
        <LegendEntry key={reading} reading={reading} Tooltip={Tooltip} />
      ))}
      {/* I-485: the position no class bears is keyed too — its own faint dash, its word
          and its meaning. It is no reading of the law's, so it carries no legend-entry test id. */}
      <Tooltip content={COVERAGE_COPY.takeoff_coverage_void_meaning}>
        <span className="cx-coverage-legend-entry cx-coverage-legend-void" data-mark={VOID_MARK} data-meaning={COVERAGE_COPY.takeoff_coverage_void_meaning} role="listitem" tabIndex={0}>
          <span className="cx-coverage-void-key" aria-hidden="true" />
          <span className="cx-coverage-legend-name">{COVERAGE_COPY.takeoff_coverage_mark_void}</span>
        </span>
      </Tooltip>
    </div>
  );
}

/**
 * The key line's whole vocabulary, in the law's own order: the one measured reading a cell can bear,
 * then every cause of either axis (L-QTY-05's `RESIDUE_CAUSES`). Derived, never transcribed — a cause
 * the law admits later is an entry here without an edit (B-19).
 */
const LEGEND_READINGS: readonly GlyphReading[] = [QUANTITY_BEARING, ...RESIDUE_CAUSES];

function LegendEntry({ reading, Tooltip }: { reading: GlyphReading; Tooltip: CoverageChrome["Tooltip"] }): ReactElement {
  // The measured reading is refusal-SHAPED and is no refusal (L-QTY-05), so the register holds no
  // words for it and the screen's own sentence names it. Every cause's words are the register's.
  const entry = causeWords(reading);
  // I-195 as amended by I-480: the writerless fall-through's registered sentence says that
  // nothing explains an absence, and on this screen every such cell now names its reason — so its key
  // entry says what the mark means here, and the cell says why.
  const meaning = reading === NOT_ESTABLISHED ? COVERAGE_COPY.takeoff_coverage_absent_meaning : (entry?.message ?? COVERAGE_COPY.takeoff_coverage_measured_note);
  return (
    <Tooltip content={meaning}>
      <span
        className="cx-coverage-legend-entry"
        data-testid="coverage-legend-entry"
        data-code={reading}
        data-mark={MARK_OF[reading]}
        // The sentence the mark MEANS, bound to the mark mechanically: the tooltip renders it on
        // hover and on focus, and the closed contract reads it here (Decision § 7, C-05).
        data-meaning={meaning}
        role="listitem"
        tabIndex={0}
      >
        <LegendGlyph reading={reading} />
        <span className="cx-coverage-legend-name">{MARK_WORD[MARK_OF[reading]]}</span>
      </span>
    </Tooltip>
  );
}

/** §3.5's 28 px footer: the counts by mark, and no sentence — "42 cells · 31 published · 6 absent". */
function Tally({ cells, declared }: { cells: readonly ResidueCell[]; declared: ReadonlySet<string> }): ReactElement {
  return (
    <div className="cx-coverage-tally" aria-label={COVERAGE_COPY.takeoff_coverage_footer_label}>
      <span className="cx-coverage-tally-total">{countCoverageCopy("takeoff_coverage_footer_cells", cells.length)}</span>
      {countsByMark(cells, (cell) => markOf(cell, declared)).map((tally) => (
        <span className="cx-coverage-tally-mark" key={tally.mark} data-mark={tally.mark}>
          {fillCoverageCopy("takeoff_coverage_footer_tally", { count: String(tally.count), mark: MARK_TALLY[tally.mark] })}
        </span>
      ))}
    </div>
  );
}

/**
 * The inspector on one cell (§3.5, Decision § 1), mounted in the shell's one right column: where the
 * cell stands, the mark and the cause in the registry's own words (I-191), the act that declared it,
 * the remedy as one sentence and one button, what was sighted as a compact table, and what the rails
 * observed. Where a door could really be carried, the two doors that move a boundary (I-194).
 */
function Inspector({
  cell,
  declared,
  permitted,
  offline,
  proposal,
  Button,
  IdChip,
  EnumLabel,
  onCarryProposed,
  onHoldOut,
  onDeclareOutOfScope,
  remedyHref,
  remedyLabel,
}: {
  cell: ResidueCell;
  /** The published lines kept with no quantity — what makes this cell partly borne (I-cov-1). */
  declared: ReadonlySet<string>;
  permitted: boolean;
  offline: boolean;
  /** The boundary a model proposed for this cell, or `null` — and then the region is ABSENT (I-297). */
  proposal: ProposedCause | null;
  Button: CoverageChrome["Button"];
  IdChip: CoverageChrome["IdChip"];
  EnumLabel: CoverageChrome["EnumLabel"];
  onCarryProposed: () => void;
  onHoldOut: () => void;
  onDeclareOutOfScope: () => void;
  remedyHref: string;
  remedyLabel: string;
}) {
  // I-198: the cell is read under the axis a person moved — the bill's cause where one holds it out
  // of this bill, and the measurement cause everywhere else. One rule, one home (B-17).
  const read = causeRead(cell);
  // I-480/e: the sentence this cell is read by — the reason beside a writerless absence,
  // what a partly published cell's lines left out — and the registry entry its one remedy is read
  // from. Both from the grid's one home for them, so the inspector and the cell's name agree (B-17).
  const partial = partlyBorne(cell, declared) ? partialSummary(cell) : null;
  const sentence = partial ?? causeSentence(cell);
  const remedy = remedyEntry(cell);
  const reasonViews = read === NOT_ESTABLISHED ? (cell.reasonViews ?? []) : [];
  const grain = cell.grain === "KIND";
  // The act cited is the act of the axis this cell is read under: the measurement act beside a cell
  // the BILL moved says nothing about why the cell reads as it does (L-QTY-05, B-17).
  const actId = citedActOf(cell, axisReadOf(cell));
  // Every act standing over this cell, on either axis — a cell can carry one on each (I-189), and a
  // reader is owed both. Deduplicated, because one act could in principle be cited by both.
  const declarations = [...new Set([cell.measurementActId, cell.billActId].filter((held): held is string => held !== null))];
  // I-194: a door that can answer only a refusal is theatre, so a cell no boundary can be declared
  // over at all — a kind-grain row, which names no class and no level, or a cell already bearing
  // published quantity — carries neither door.
  //
  // A cell already standing under a declaration keeps BOTH doors, though: nothing withdraws a
  // declaration (L-ACT-01 — in_force moves only by a later act), so the boundary a person moved is
  // still a boundary they may move on the other axis, and the door that would change nothing answers
  // ACT_CHANGES_NOTHING with its remedy through the one dialog rather than vanishing (R-UI-020,
  // ARCH-03). J-022 walks exactly this: after the hold is carried, both doors still stand.
  //
  // A CELL-grain cell may still name no level: the two channels that sight a placement on a sheet
  // answer `levelId: null` by construction, so a campaign whose partition has run and whose register
  // has not yet placed that class on a storey bears a cell with no level. The store a declaration
  // stands in addresses its cell by level (`scope_declarations.level_id`), so that cell is a cell no
  // boundary can be declared over either — its door would carry a reader through a confirmed
  // consequence into a write that cannot land (I-194, R-UI-020).
  const doorsStand = boundaryDoorsStand(cell, permitted);
  // The certificate's own sentence for the proposed cause, read from the register by CODE from the
  // cause the model chose — the very sentence the statement row prints (I-191, R-SPINE-062). It is
  // never generated and never paraphrased: what a model chose is a cause, never a sentence.
  const proposedWords = proposal === null ? undefined : causeWords(proposal.cause);

  return (
    <aside
      className="cx-coverage-inspector"
      data-testid="coverage-inspector"
      data-cell={cellRef(cell)}
      data-kind={cell.kind}
      data-class={cell.class ?? ""}
      data-level={cell.levelId ?? ""}
      data-proposed-cause={proposal?.cause ?? ""}
      data-proposed-call={proposal?.callId ?? ""}
    >
      {/* Where the cell stands, as ONE fact line: kind · class · level (§3.5) — the kind and the class
          in the words the grid's headers say them by, the level the stack's own label (I-351). */}
      <p className="cx-coverage-where">
        <EnumLabel value={cell.kind} label={kindWord(cell.kind)} className="cx-coverage-value cx-coverage-word" />
        {grain ? (
          // I-196: a kind-grain row spans the whole extent, so it says so in place of a class and a level.
          <span className="cx-coverage-grain">{COVERAGE_COPY.takeoff_coverage_kind_grain_label}</span>
        ) : (
          <>
            <span className="cx-coverage-value cx-coverage-word">{cell.class === null ? "" : classWord(cell.class)}</span>
            <span className="cx-coverage-value">{levelWord(cell.levelLabel, cell.levelSlot ?? null)}</span>
          </>
        )}
      </p>

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_cause_heading}</h3>
      {/* The cause stays on `data-code` (L-QTY-05); the reason read beside a writerless absence rides
          on `data-reason` and is what the sentence says (I-480). */}
      <p
        className="cx-coverage-cause"
        data-testid="coverage-inspector-cause"
        data-cause={read}
        data-code={read}
        data-reason={read === NOT_ESTABLISHED ? (cell.reason ?? "") : ""}
        data-act={actId ?? ""}
      >
        <span className="cx-coverage-cause-mark" data-mark={markOf(cell, declared)}>
          <LegendGlyph reading={read as GlyphReading} partial={partlyBorne(cell, declared)} />
          {MARK_WORD[markOf(cell, declared)]}
        </span>
        {sentence}
      </p>
      {/* The views the reason names, in the drawing's own words: the plan nobody affirmed a scale
          for, the captions that show a class nothing placed (I-480). */}
      {reasonViews.length === 0 ? null : (
        <p className="cx-coverage-reason-views">
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_reason_views_label}</span>
          {reasonViews.map((view) => (
            <span className="cx-coverage-reason-view" key={view}>
              {view}
            </span>
          ))}
        </p>
      )}
      {/* I-cov-1: a published cell whose lines carry no quantity says how many, in place, where the
          reading carries no declaration to say it in words (I-483 says it above instead). */}
      {partlyBorne(cell, declared) && partial === null ? (
        <p className="cx-coverage-declared-lines" data-declared={linesDeclared(cell, declared)}>
          {fillCoverageCopy("takeoff_coverage_cell_label_declared", { count: String(linesDeclared(cell, declared)), total: String(cell.lineIds.length) })}
        </p>
      ) : null}
      {actId === null ? null : (
        <p className="cx-coverage-declared">
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_declared_label}</span>
          <IdChip value={actId} className="cx-coverage-act-id" />
        </p>
      )}
      {/*
        I-191: the remedy is the registry's sentence, verbatim — and R-UI-020 asks a refusal to carry
        a remedy AND a link, so one button stands beside the sentence and goes where the cause is
        really resolved: the rule set for the one cause that names it, the register for every other.
      */}
      <div className="cx-coverage-remedy" data-testid="coverage-inspector-remedy">
        {/* The remedy of the reason where one stands beside the cause, of the first omission a
            partly published cell's lines declared, else of the cause (I-480/e). A cell
            measured whole has nothing to remedy, and its one button opens its lines. */}
        {remedy === undefined ? null : <p className="cx-coverage-remedy-sentence">{remedy.remedy}</p>}
        <a className="cx-btn cx-reticle cx-coverage-remedy-link" data-variant="secondary" href={remedyHref}>
          {remedyLabel}
        </a>
      </div>
      {cell.contradicted ? <p className="cx-coverage-contradicted">{COVERAGE_COPY.takeoff_coverage_contradicted_note}</p> : null}

      {/*
        I-297: the boundary a model proposed, stated as a proposal and nothing more. The region is
        ABSENT where nothing was proposed — there is no idle panel and no idle sentence on this
        screen (§1) — so a cell the question was never put over, a refusal, the model's own no-match
        and a confidence under the floor all read the same: the person reads the evidence below and
        decides, which is this screen's escalation to them (L-AI-02).

        No new test id: the region is found by its heading and the two attributes above, and the id
        registry stays closed (§7, AM-09 §1). The cause renders through EnumLabel — a model value is
        said in words (I-213) — and the sentence beneath it is the register's own for that cause.
      */}
      {proposal === null || proposedWords === undefined ? null : (
        <section className="cx-coverage-proposal" aria-label={COVERAGE_COPY.takeoff_coverage_proposed_heading}>
          <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_proposed_heading}</h3>
          <p className="cx-coverage-proposed-cause">
            <EnumLabel value={proposal.cause} className="cx-coverage-proposed-value" />
          </p>
          <p className="cx-coverage-proposed-note">{COVERAGE_COPY.takeoff_coverage_proposed_note}</p>
          <p className="cx-coverage-proposed-sentence">
            <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_proposed_sentence_label}</span>
            {proposedWords.message}
          </p>
          {doorsStand ? (
            <Button variant="secondary" disabled={offline} onClick={onCarryProposed}>
              {COVERAGE_COPY.takeoff_coverage_proposed_carry}
            </Button>
          ) : null}
        </section>
      )}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_sightings_heading}</h3>
      {cell.sightings.length === 0 && declarations.length === 0 ? (
        <p className="cx-coverage-none">{COVERAGE_COPY.takeoff_coverage_sightings_none}</p>
      ) : (
        // I-484: the sightings fold behind one line — how many, on which sheets — because a
        // cell sighted fifty times filled the inspector with fifty rows of keys above its doors. The
        // table is whole behind the disclosure, one press away, and every row stays in the DOM.
        <details className="cx-coverage-sightings-fold">
          <summary className="cx-coverage-sightings-summary">{sightingsSummary(cell.sightings.length + declarations.length, cell.sightings)}</summary>
        <table className="cx-coverage-sightings" aria-label={COVERAGE_COPY.takeoff_coverage_sightings_heading}>
          <thead>
            <tr>
              <th scope="col">{COVERAGE_COPY.takeoff_coverage_channel_label}</th>
              <th scope="col">{COVERAGE_COPY.takeoff_coverage_view_label}</th>
              <th scope="col">{COVERAGE_COPY.takeoff_coverage_source_label}</th>
            </tr>
          </thead>
          <tbody>
            {cell.sightings.map((seen) => (
              <tr data-testid="coverage-inspector-sighting" data-channel={seen.channel} data-source={seen.sourceKey} key={`${seen.channel}:${seen.sourceKey}`}>
                <td>
                  <EnumLabel value={seen.channel} />
                </td>
                <td className="cx-coverage-view-name">{seen.layoutName}</td>
                <td>
                  <IdChip value={seen.sourceKey} className="cx-coverage-source-key" />
                </td>
              </tr>
            ))}
            {/*
              A declaration a person made is evidence for this cell's reading exactly as a sighting
              is, so it stands in the same table under its own channel (L-ACT-01): it is what a reader
              following "why does this cell read as it does" is owed, and it is the only evidence a
              contradicted cell has left once the published lines have beaten it (I-192, I-201). The
              act is cited, never the code it declared — a refusal code reaches no text node here.
            */}
            {declarations.map((declared) => (
              <tr data-testid="coverage-inspector-sighting" data-channel={DECLARATION} data-source={declared} key={`${DECLARATION}:${declared}`}>
                <td>
                  <EnumLabel value={DECLARATION} />
                </td>
                <td className="cx-coverage-view-name">{COVERAGE_COPY.takeoff_coverage_declared_label}</td>
                <td>
                  <IdChip value={declared} className="cx-coverage-act-id" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </details>
      )}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_observations_heading}</h3>
      {cell.observations.length === 0 ? (
        <p className="cx-coverage-none">{COVERAGE_COPY.takeoff_coverage_observations_none}</p>
      ) : (
        // One row per report said, with how many members it was said of (I-484): the rail's
        // kind and class in words, the registry's sentence, and the view it names where it names one.
        reportsOf(cell).map((report) => (
          <div
            className="cx-coverage-observation"
            data-testid="coverage-inspector-observation"
            data-rail={report.rail}
            data-reason={report.reason}
            data-count={report.count}
            key={`${report.rail}:${report.reason}:${report.view}`}
          >
            <span className="cx-coverage-value cx-coverage-word">
              {kindWord(report.kind)} · {classWord(report.class)}
            </span>
            <span className="cx-coverage-reason">{report.reason}</span>
            {report.view === "" ? null : <span className="cx-coverage-reason-view">{report.view}</span>}
            {report.count > 1 ? <span className="cx-coverage-observation-count">{fillCoverageCopy("takeoff_coverage_observation_count", { count: countWords(report.count) })}</span> : null}
          </div>
        ))
      )}

      {doorsStand ? (
        <div className="cx-coverage-doors">
          <Button variant="secondary" data-testid="coverage-hold-out" disabled={offline} onClick={onHoldOut}>
            {COVERAGE_COPY.takeoff_coverage_hold_out}
          </Button>
          <Button variant="secondary" data-testid="coverage-declare-out-of-scope" disabled={offline} onClick={onDeclareOutOfScope}>
            {COVERAGE_COPY.takeoff_coverage_declare_out_of_scope}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The certificate's two boundary statements, previewed as document text (L-QTY-07): measurement
 * first and in full, then bill, never merged and never a shared cause column. No count appears
 * anywhere in this section — a count is not a boundary.
 *
 * The measurement statement enumerates three things (I-480/c/e): every cell nothing was
 * published for, each with the REASON read beside its cause — never "nothing explains"; every cell
 * published only in part, with what its lines left out; and every member the drawings show that no
 * class of this product measures. Its "none" sentence stands only where all three are empty.
 */
export function CertificatePreviewSection({
  measurement,
  partial = [],
  unclassed = [],
  bill,
  pinned,
  open,
}: {
  measurement: readonly StatementRow[];
  partial?: readonly PartialStatementRow[];
  unclassed?: readonly UnclassedStatementRow[];
  bill: readonly StatementRow[];
  pinned: boolean;
  open: boolean;
}) {
  // An empty statement is still a statement, but WHICH emptiness it states depends on whether there
  // is a campaign at all: over a project with nothing pinned, "this campaign measured everything"
  // would assert a campaign the screen has just said does not exist (X-3 — the residue read in five
  // seconds says one thing, not two that contradict each other).
  const measurementNone = pinned ? COVERAGE_COPY.takeoff_coverage_statement_measurement_none : COVERAGE_COPY.takeoff_coverage_statement_measurement_none_unpinned;
  const billNone = pinned ? COVERAGE_COPY.takeoff_coverage_statement_bill_none : COVERAGE_COPY.takeoff_coverage_statement_bill_none_unpinned;
  return (
    // The section scrolls when the statements are longer than the document box (`overflow: auto`),
    // and a region that scrolls has to be reachable by the keyboard — otherwise the part below the
    // fold can be read with a mouse and by no other means (R-UI-012: keyboard reachable, axe
    // serious/critical = 0 on every screen; the rule is `scrollable-region-focusable`).
    // It is focusable always rather than only when it overflows: whether it overflows depends on how
    // many boundaries the campaign has, which is not something the markup can know.
    <section className="cx-coverage-certificate" data-testid="coverage-certificate-preview" data-open={open ? "true" : "false"} tabIndex={0}>
      <h2 className="cx-coverage-certificate-heading">{COVERAGE_COPY.takeoff_coverage_certificate_heading}</h2>
      <Statement axis={MEASUREMENT} title={COVERAGE_COPY.takeoff_coverage_statement_measurement_title} none={measurementNone} rows={measurement} partial={partial} unclassed={unclassed} />
      <Statement axis={BILL} title={COVERAGE_COPY.takeoff_coverage_statement_bill_title} none={billNone} rows={bill} />
    </section>
  );
}

/**
 * What one statement row says after its coordinates (I-191, I-480): the registry's words
 * for the reason read beside the cause where the row carries one, else for the cause — and the views
 * that reason names, in the drawing's own words.
 */
function rowSentence(row: StatementRow): string {
  const said = causeSentence({ measurement: row.cause as ResidueCell["measurement"], bill: IN_BILL, reason: row.reason ?? null });
  const views = row.views ?? [];
  return views.length === 0 ? said : `${said} ${COVERAGE_COPY.takeoff_coverage_reason_views_label}: ${views.join("; ")}.`;
}

/** The bill axis a statement row of the measurement boundary stands in — it was never held out (L-QTY-05). */
const IN_BILL = "IN_BILL";

/** One statement: an enumeration in the certificate's own order, each row under its own cause. */
function Statement({
  axis,
  title,
  none,
  rows,
  partial = [],
  unclassed = [],
}: {
  axis: string;
  title: string;
  none: string;
  rows: readonly StatementRow[];
  partial?: readonly PartialStatementRow[];
  unclassed?: readonly UnclassedStatementRow[];
}): ReactElement {
  const empty = rows.length === 0 && partial.length === 0 && unclassed.length === 0;
  return (
    <section className="cx-coverage-statement" data-testid="coverage-statement" data-axis={axis}>
      <h3 className="cx-coverage-statement-title">{title}</h3>
      {empty ? (
        <p className="cx-coverage-none" data-testid="coverage-statement-none" data-code={NONE}>
          {none}
        </p>
      ) : (
        <ul className="cx-coverage-statement-rows">
          {rows.map((row) => (
            <li
              className="cx-coverage-statement-row"
              data-testid="coverage-statement-row"
              data-kind={row.kind}
              data-class={row.class ?? ""}
              data-level={row.levelId ?? ""}
              // The levels this ONE line states: a run of contiguous levels bearing one cause prints
              // as `first–last`, which is what a certificate reads like (L-QTY-07). `data-level`
              // beside it still names the run's first level, the one a reader lands on.
              data-levels={row.levels}
              data-code={row.cause}
              // The reason read beside a writerless absence (I-480); "" on every other row.
              data-reason={row.reason ?? ""}
              key={`${row.kind}:${row.class ?? ""}:${row.levelId ?? ""}:${row.cause}:${row.reason ?? ""}`}
            >
              {/* I-cov-4: kind · class · level, each named and separated (§3's statement row) — a
                  kind-grain row names neither class nor level, and a level-less cell says where it
                  stands (I-482). I-351: the kind and the class in words, by the rule the
                  draft BOQ prints them by (`Concrete`, `Pile cap`) — a certificate is a document a
                  client reads, and its keys stay on the row's `data-kind` and `data-class`; the level
                  is the stack's own label. */}
              <span className="cx-coverage-statement-where">
                <span className="cx-coverage-value cx-coverage-word">{kindWord(row.kind)}</span>
                {row.class === null ? null : <span className="cx-coverage-value cx-coverage-word">{classWord(row.class)}</span>}
                {row.class === null ? null : <span className="cx-coverage-value">{levelWord(row.levels, row.levelSlot ?? null)}</span>}
              </span>
              <span className="cx-coverage-statement-cause">{rowSentence(row)}</span>
            </li>
          ))}
          {/* I-483: a cell published only in part is enumerated with what its lines left
              out — in words, never a count — so it never passes as measured. Found by its class, the
              contract's ids being closed (§7). */}
          {partial.map((row) => (
            <li
              className="cx-coverage-statement-row cx-coverage-statement-partial"
              data-kind={row.kind}
              data-class={row.class ?? ""}
              data-level={row.levelId ?? ""}
              data-levels={row.levels}
              data-omitted={row.omitted.join(" ")}
              key={`partial:${row.kind}:${row.class ?? ""}:${row.levelId ?? ""}`}
            >
              <span className="cx-coverage-statement-where">
                <span className="cx-coverage-value cx-coverage-word">{kindWord(row.kind)}</span>
                {row.class === null ? null : <span className="cx-coverage-value cx-coverage-word">{classWord(row.class)}</span>}
                {row.class === null ? null : <span className="cx-coverage-value">{levelWord(row.levels, row.levelSlot)}</span>}
              </span>
              <span className="cx-coverage-statement-cause">
                {COVERAGE_COPY.takeoff_coverage_statement_partial_label}: {reasonsInWords(row.omitted)}.
              </span>
            </li>
          ))}
          {/* I-481: a member the drawings show that no class measures — a water tank, a
              parapet — named by its word and the caption that shows it, and the registry's reason. */}
          {unclassed.map((member) => (
            <li
              className="cx-coverage-statement-row cx-coverage-statement-unclassed"
              data-word={member.word}
              data-code={member.code}
              key={`unclassed:${member.word}:${member.drawingId}:${member.caption}`}
            >
              <span className="cx-coverage-statement-where">
                <span className="cx-coverage-value cx-coverage-word">{inWordsOf(member.word)}</span>
                <span className="cx-coverage-value">{member.caption}</span>
              </span>
              <span className="cx-coverage-statement-cause">{causeWords(member.code)?.message ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A word of the unclassed table as a row says it — capitalised, as the class words are. */
function inWordsOf(word: string): string {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}


/* ------------------------------------------------------- the house markup, where none is handed */

/**
 * The core Button's own markup, worn where no chrome was injected (ARCH-01): a module may not reach
 * `src/ui`, so a mount that hands none gets the house classes and a real `<button>` rather than a
 * second Button component to drift from the shipped one (the EmptyCell's `cx-btn cx-reticle` anchor
 * is the same idiom). Every surface a reader actually meets is handed the shipped Button (I-170).
 */
function FallbackButton({
  variant = "primary",
  disabled,
  onClick,
  children,
  ...hooks
}: {
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <button className="cx-btn cx-reticle" type="button" data-variant={variant} disabled={disabled} onClick={onClick} {...hooks}>
      {children}
    </button>
  );
}

/** The value itself, in mono, where no IdChip was handed over — never a truncation nobody can undo. */
function FallbackIdChip({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className} data-value={value}>
      {value}
    </span>
  );
}

/** The words a caller authored, else the model value verbatim, where no EnumLabel was handed over (I-25, I-351). */
function FallbackEnumLabel({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <span className={className} data-value={value}>
      {label ?? value}
    </span>
  );
}

/** No hover sentence without the shipped Tooltip: the meaning still rides on `data-meaning`. */
function FallbackTooltip({ children }: { content: ReactNode; children: ReactNode }) {
  return <>{children}</>;
}

/** R-UI-050's empty cell in house markup, where no EmptyState was handed over. */
function FallbackEmptyState({ heading, body, children, ...hooks }: { heading: string; body?: string; children?: ReactNode; "data-testid"?: string }) {
  return (
    <div className="cx-coverage-empty" {...hooks}>
      <h2 className="cx-coverage-empty-heading">{heading}</h2>
      {body === undefined ? null : <p className="cx-coverage-empty-body">{body}</p>}
      {children}
    </div>
  );
}

/** R-UI-050's fault cell in house markup, where no ErrorState was handed over. */
function FallbackErrorState({
  heading,
  body,
  reportId,
  onRetry,
  retryLabel,
  ...hooks
}: {
  heading: string;
  body?: string;
  reportId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  "data-testid"?: string;
}) {
  return (
    <div className="cx-coverage-empty" {...hooks}>
      <h2 className="cx-coverage-empty-heading">{heading}</h2>
      {body === undefined ? null : <p className="cx-coverage-empty-body">{body}</p>}
      <p className="cx-coverage-report">
        <span className="cx-coverage-report-label">{COVERAGE_COPY.takeoff_coverage_report_label}</span>
        <span className="cx-coverage-report-id">{reportId ?? ""}</span>
      </p>
      {onRetry === undefined ? null : (
        <button className="cx-btn cx-reticle" type="button" data-variant="secondary" data-testid="coverage-retry" onClick={onRetry}>
          {retryLabel ?? COVERAGE_COPY.takeoff_coverage_retry}
        </button>
      )}
    </div>
  );
}

/**
 * Where a slot was not handed over, the nodes stand where they were written. A module that cannot
 * call `useInspector` renders a whole screen anyway — which is what a suite mounts, and what keeps
 * this file a presentational screen rather than half of one (I-209, ARCH-01).
 */
function InPlace({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
