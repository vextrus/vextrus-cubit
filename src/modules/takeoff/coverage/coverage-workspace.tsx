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
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import type { Consequence } from "@/core/acts";
// The law module, not the residue's roster: the roster carries the query and its channel readers,
// which reach the database, and this file runs in the browser (ARCH-01, the `@/core/levels/law`
// precedent). Everything a rendering needs — the closed cause set and the cell's address — is law.
import { RESIDUE_CAUSES, cellRef, type ResidueCell, type StatementRow } from "@/core/residue/law";
import type { RefusalEntry } from "@/core/errors";
// The marker's one reader (ARCH-02): whether a rejection carries a registered code is not a
// judgement this screen makes for itself, and a second reading of it would be a second home (B-17).
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { axisReadOf, citedActOf } from "./cited-act";
import { COVERAGE_COPY, countCoverageCopy, fillCoverageCopy } from "./copy";
import { CoverageGrid, causeRead, causeWords, markOf, type CoverageDensity } from "./grid";
import { LegendGlyph, type GlyphReading } from "./glyphs";
import { MARK_OF, MARK_TALLY, MARK_WORD, countsByMark } from "./heat";
import type { CoverageView } from "./view";

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
  /** §6: a model value said in words, with the SCREAMING form left inside `[data-technical]`. */
  readonly EnumLabel: ComponentType<{ value: string; className?: string }>;
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
const registerHref = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`;
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
  const held = cells.find((cell) => cellRef(cell) === selected) ?? null;

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

  // The registry is core, so a caller that hands no lookup gets the registry itself rather than a
  // screen with no words for a code (ARCH-02, B-17).
  const refusalOf = doors.refusalOf ?? causeWords;
  const refusal = refused === null ? undefined : refusalOf(refused);
  const denial = refusalOf(PERMISSION_NOT_HELD);
  const tenantId = view?.tenantId ?? "";
  const projectId = view?.projectId ?? "";

  /** Where a reader is sent to resolve a door's rejection — the register, where the lines are made. */
  const evidence: Evidence = { href: registerHref(tenantId, projectId), label: COVERAGE_COPY.takeoff_coverage_empty_campaign_action };

  /** What a door stands over as the screen stands NOW, read by the pair below rather than closed over. */
  const standing = useRef({ doors, refusalOf, view, held, door, evidence });
  standing.current = { doors, refusalOf, view, held, door, evidence };

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
    const { doors: at, view: over, held: cell, door: which } = standing.current;
    const open = which === HOLD_OUT_OF_BILL ? at.previewHoldOutOfBill : at.previewDeclareNotInProjectScope;
    if (over === null || cell === null || which === null || open === undefined) throw new Error(NO_DOOR_STANDS);
    try {
      return await open({ input: inputOf(over, cell) });
    } catch (thrown) {
      return refuse(thrown);
    }
  }, [refuse]);

  const commitAtDoor = useCallback(
    async (carried: { consequenceDigest: string }): Promise<{ actId: string }> => {
      const { doors: at, view: over, held: cell, door: which } = standing.current;
      const settle = which === HOLD_OUT_OF_BILL ? at.commitHoldOutOfBill : at.commitDeclareNotInProjectScope;
      if (over === null || cell === null || which === null || settle === undefined) throw new Error(NO_DOOR_STANDS);
      try {
        return await settle({ input: inputOf(over, cell), consequenceDigest: carried.consequenceDigest });
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
              />
              <Tally cells={cells} />
            </div>
          )}
          {/* I-208: the empty cell stands in the BODY's place; the preview stands beneath it in every
              state that has a reading, because a boundary nothing stands outside is still a statement
              a certificate makes (L-QTY-07, Decision §1–§2). */}
          <CertificatePreviewSection measurement={view.measurement} bill={view.bill} pinned={view.campaignId !== null} open={previewing} />
        </>
      )}

      {/* §3.1: the ONE right column, and it stands only while a cell is selected. */}
      {held === null ? null : (
        <InspectorMount>
          <Inspector
            cell={held}
            permitted={permitted}
            offline={offline}
            Button={Button}
            IdChip={IdChip}
            EnumLabel={EnumLabel}
            onHoldOut={() => setDoor(HOLD_OUT_OF_BILL)}
            onDeclareOutOfScope={() => setDoor(DECLARE_NOT_IN_PROJECT_SCOPE)}
            remedyHref={causeRead(held) === KIND_NOT_YET_SEEDED ? rulesetHref(tenantId, projectId) : registerHref(tenantId, projectId)}
            remedyLabel={
              causeRead(held) === KIND_NOT_YET_SEEDED ? COVERAGE_COPY.takeoff_coverage_remedy_ruleset : COVERAGE_COPY.takeoff_coverage_empty_campaign_action
            }
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

/** The cell one door stands over, in the shape the seam declares. */
function inputOf(view: CoverageView, cell: ResidueCell): BoundaryCell {
  return {
    projectId: view.projectId ?? "",
    campaignId: view.campaignId ?? "",
    class: cell.class ?? "",
    kind: cell.kind,
    levelId: cell.levelId ?? "",
  };
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
  const meaning = entry?.message ?? COVERAGE_COPY.takeoff_coverage_measured_note;
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
function Tally({ cells }: { cells: readonly ResidueCell[] }): ReactElement {
  return (
    <div className="cx-coverage-tally" aria-label={COVERAGE_COPY.takeoff_coverage_footer_label}>
      <span className="cx-coverage-tally-total">{countCoverageCopy("takeoff_coverage_footer_cells", cells.length)}</span>
      {countsByMark(cells, markOf).map((tally) => (
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
  permitted,
  offline,
  Button,
  IdChip,
  EnumLabel,
  onHoldOut,
  onDeclareOutOfScope,
  remedyHref,
  remedyLabel,
}: {
  cell: ResidueCell;
  permitted: boolean;
  offline: boolean;
  Button: CoverageChrome["Button"];
  IdChip: CoverageChrome["IdChip"];
  EnumLabel: CoverageChrome["EnumLabel"];
  onHoldOut: () => void;
  onDeclareOutOfScope: () => void;
  remedyHref: string;
  remedyLabel: string;
}) {
  // I-198: the cell is read under the axis a person moved — the bill's cause where one holds it out
  // of this bill, and the measurement cause everywhere else. One rule, one home (B-17).
  const read = causeRead(cell);
  const measured = read === QUANTITY_BEARING;
  const entry = measured ? undefined : causeWords(read);
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
  const addressable = cell.class !== null && cell.levelId !== null;
  const doorsStand = permitted && !grain && !measured && addressable;

  return (
    <aside
      className="cx-coverage-inspector"
      data-testid="coverage-inspector"
      data-cell={cellRef(cell)}
      data-kind={cell.kind}
      data-class={cell.class ?? ""}
      data-level={cell.levelId ?? ""}
    >
      {/* Where the cell stands, as ONE fact line: kind · class · level (§3.5). */}
      <p className="cx-coverage-where">
        <span className="cx-coverage-value">{cell.kind}</span>
        {grain ? (
          // I-196: a kind-grain row spans the whole extent, so it says so in place of a class and a level.
          <span className="cx-coverage-grain">{COVERAGE_COPY.takeoff_coverage_kind_grain_label}</span>
        ) : (
          <>
            <span className="cx-coverage-value">{cell.class ?? ""}</span>
            <span className="cx-coverage-value">{cell.levelLabel}</span>
          </>
        )}
      </p>

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_cause_heading}</h3>
      <p className="cx-coverage-cause" data-testid="coverage-inspector-cause" data-cause={read} data-code={read} data-act={actId ?? ""}>
        <span className="cx-coverage-cause-mark" data-mark={markOf(cell)}>
          <LegendGlyph reading={read as GlyphReading} />
          {MARK_WORD[markOf(cell)]}
        </span>
        {entry === undefined ? COVERAGE_COPY.takeoff_coverage_cell_label_measured : entry.message}
      </p>
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
        <p className="cx-coverage-remedy-sentence">{entry?.remedy ?? COVERAGE_COPY.takeoff_coverage_measured_note}</p>
        <a className="cx-btn cx-reticle cx-coverage-remedy-link" data-variant="secondary" href={remedyHref}>
          {remedyLabel}
        </a>
      </div>
      {cell.contradicted ? <p className="cx-coverage-contradicted">{COVERAGE_COPY.takeoff_coverage_contradicted_note}</p> : null}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_sightings_heading}</h3>
      {cell.sightings.length === 0 && declarations.length === 0 ? (
        <p className="cx-coverage-none">{COVERAGE_COPY.takeoff_coverage_sightings_none}</p>
      ) : (
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
      )}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_observations_heading}</h3>
      {cell.observations.length === 0 ? (
        <p className="cx-coverage-none">{COVERAGE_COPY.takeoff_coverage_observations_none}</p>
      ) : (
        cell.observations.map((observation) => (
          <div
            className="cx-coverage-observation"
            data-testid="coverage-inspector-observation"
            data-rail={observation.rail}
            data-reason={observation.reason}
            key={`${observation.rail}:${observation.reason}`}
          >
            <span className="cx-coverage-value">{observation.rail}</span>
            <EnumLabel value={observation.reason} className="cx-coverage-reason" />
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
 */
export function CertificatePreviewSection({
  measurement,
  bill,
  pinned,
  open,
}: {
  measurement: readonly StatementRow[];
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
      <Statement axis={MEASUREMENT} title={COVERAGE_COPY.takeoff_coverage_statement_measurement_title} none={measurementNone} rows={measurement} />
      <Statement axis={BILL} title={COVERAGE_COPY.takeoff_coverage_statement_bill_title} none={billNone} rows={bill} />
    </section>
  );
}

/** One statement: an enumeration in the certificate's own order, each row under its own cause. */
function Statement({ axis, title, none, rows }: { axis: string; title: string; none: string; rows: readonly StatementRow[] }): ReactElement {
  return (
    <section className="cx-coverage-statement" data-testid="coverage-statement" data-axis={axis}>
      <h3 className="cx-coverage-statement-title">{title}</h3>
      {rows.length === 0 ? (
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
              key={`${row.kind}:${row.class ?? ""}:${row.levelId ?? ""}:${row.cause}`}
            >
              <span className="cx-coverage-value">{row.kind}</span>
              <span className="cx-coverage-value">{row.class ?? ""}</span>
              <span className="cx-coverage-value">{row.levels}</span>
              <span className="cx-coverage-statement-cause">{causeWords(row.cause)?.message ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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

/** The model value verbatim, where no EnumLabel was handed over (I-25). */
function FallbackEnumLabel({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className} data-value={value}>
      {value}
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
