"use client";
// S-Coverage's workspace (docs/design/s-coverage.md): the heat grid, its legend, the inspector on one
// cell, and the certificate's two boundary statements previewed as document text.
//
// Presentational and injected (I-170): every piece of shipped chrome arrives as a renderer declared
// by exactly the props this screen hands it, so a module never reaches the ui layer (ARCH-01) and a
// suite mounts the very components a reader sees. The screen computes no residue of its own — the
// arms are L-QTY-05's, resolved in core, and what stands here is only how they are read.
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactElement } from "react";
import type { Consequence } from "@/core/acts";
// The law module, not the residue's roster: the roster carries the query and its channel readers,
// which reach the database, and this file runs in the browser (ARCH-01, the `@/core/levels/law`
// precedent). Everything a rendering needs — the closed cause set and the cell's address — is law.
import { RESIDUE_CAUSES, cellRef, type ResidueCell, type StatementRow } from "@/core/residue/law";
import type { RefusalEntry } from "@/core/errors";
// The marker's one reader (ARCH-02): whether a rejection carries a registered code is not a
// judgement this screen makes for itself, and a second reading of it would be a second home (B-17).
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { COVERAGE_COPY } from "./copy";
import { CoverageGrid, GRID_LABEL_ID, causeRead, causeWords, type CoverageDensity } from "./grid";
import { LegendGlyph, type GlyphReading } from "./glyphs";
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
 * The three shipped renderers the app layer injects (I-170). Each is declared by exactly the props
 * this screen hands it, so the shipped component itself is assignable and no adapter stands between
 * what a reader sees and what a test mounts.
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
   * handed over, this screen draws nothing in its place rather than growing a second spelling of it.
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

/** The two readings an axis stands at when nothing is wrong. */
const QUANTITY_BEARING = "QUANTITY_BEARING";
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";
const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE";
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
  if (props.view.campaignId === null || props.view.cells.length === 0) return "empty";
  return props.view.cells.some((cell) => cell.grain === "KIND") ? "partial" : "ready";
}

export function CoverageWorkspace(props: CoverageWorkspaceProps) {
  const { view } = props;
  const density = props.density ?? "comfortable";
  const permitted = props.permitted ?? true;
  const offline = props.offline ?? false;
  const chrome = props.chrome ?? {};
  const doors: Partial<CoverageDoors> = props.doors ?? {};
  const reportId = props.reportId ?? null;
  const { Button = FallbackButton, RefusalState, ConsequenceDialog } = chrome;
  const state = props.state ?? stateOf(props);
  // A state the caller stated is a state the screen renders: the matrix declares this screen's
  // refusal as the denial of SET_BILL_BOUNDARY, so that is the code the refusal cell states when no
  // door has answered with one of its own (R-UI-020 — a refusal is never silent).
  const refused = props.refused ?? (state === "refusal" ? PERMISSION_NOT_HELD : null);
  const [selected, setSelected] = useState<string | null>(props.cell ?? null);
  const [door, setDoor] = useState<typeof HOLD_OUT_OF_BILL | typeof DECLARE_NOT_IN_PROJECT_SCOPE | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);

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

  return (
    <div className="cx-coverage" data-testid="coverage-screen" data-state={state} data-density={density} data-campaign={view?.campaignId ?? ""} ref={setRoot}>
      {offline ? (
        <p className="cx-coverage-offline" role="status">
          {COVERAGE_COPY.takeoff_coverage_offline}
        </p>
      ) : null}

      <header className="cx-coverage-header">
        <div className="cx-coverage-title">
          <h1 className="cx-coverage-heading">{COVERAGE_COPY.takeoff_coverage_heading}</h1>
          <p className="cx-coverage-caption">{COVERAGE_COPY.takeoff_coverage_caption}</p>
        </div>
        {view === null || view.setRevisionId === null ? null : (
          <p className="cx-coverage-revision-block">
            <span className="cx-coverage-revision-label">{COVERAGE_COPY.takeoff_coverage_revision_label}</span>
            <span className="cx-coverage-revision">{view.setRevisionId}</span>
          </p>
        )}
      </header>

      {/* R-UI-020: one renderer, one slot. A door's rejection is answered here and nowhere else. */}
      <div className="cx-coverage-answer" data-testid="coverage-answer" aria-live="polite">
        {state === "denied" ? (
          <>
            <p className="cx-coverage-denied">{COVERAGE_COPY.takeoff_coverage_denied_permission}</p>
            <p className="cx-coverage-denied-holder">{COVERAGE_COPY.takeoff_coverage_denied_holder}</p>
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
        <ErrorCell reportId={reportId} Button={Button} retry={doors.retry} />
      ) : (
        <>
          {state === "empty" ? (
            <EmptyCell view={view} />
          ) : (
            <div className="cx-coverage-body">
              <section className="cx-coverage-grid-region" aria-labelledby={GRID_LABEL_ID}>
                <h2 className="cx-coverage-grid-heading" id={GRID_LABEL_ID}>
                  {COVERAGE_COPY.takeoff_coverage_grid_label}
                </h2>
                {state === "partial" ? <p className="cx-coverage-partial-note">{COVERAGE_COPY.takeoff_coverage_partial_note}</p> : null}
                <div className="cx-coverage-scroll">
                  <CoverageGrid cells={cells} levels={view.input.levels} density={density} selected={selected} onSelect={select} />
                </div>
                <Legend />
              </section>
              <Inspector
                cell={held}
                permitted={permitted}
                offline={offline}
                Button={Button}
                onHoldOut={() => setDoor(HOLD_OUT_OF_BILL)}
                onDeclareOutOfScope={() => setDoor(DECLARE_NOT_IN_PROJECT_SCOPE)}
                rulesetHref={rulesetHref(tenantId, projectId)}
              />
            </div>
          )}
          {/* I-208: the empty cell stands in the BODY's place; the preview stands beneath it in every
              state that has a reading, because a boundary nothing stands outside is still a statement
              a certificate makes (L-QTY-07, Decision §1–§2). */}
          <CertificatePreviewSection measurement={view.measurement} bill={view.bill} />
        </>
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

/** R-UI-050's error cell: the read failed, nothing changed, and the report id stands by its door. */
function ErrorCell({ reportId, Button, retry }: { reportId: string | null; Button: CoverageChrome["Button"]; retry?: () => void }) {
  return (
    <div className="cx-coverage-empty" data-testid="coverage-empty">
      <h2 className="cx-coverage-empty-heading">{COVERAGE_COPY.takeoff_coverage_error_heading}</h2>
      <p className="cx-coverage-empty-body">{COVERAGE_COPY.takeoff_coverage_error_body}</p>
      <p className="cx-coverage-report">
        <span className="cx-coverage-report-label">{COVERAGE_COPY.takeoff_coverage_report_label}</span>
        <span className="cx-coverage-report-id">{reportId ?? ""}</span>
      </p>
      {retry === undefined ? null : (
        <Button variant="secondary" data-testid="coverage-retry" onClick={retry}>
          {COVERAGE_COPY.takeoff_coverage_retry}
        </Button>
      )}
    </div>
  );
}

/** R-UI-050's empty cell: two truths, each saying why, each teaching the one next action. */
function EmptyCell({ view }: { view: CoverageView }) {
  const pinned = view.campaignId !== null;
  const tenantId = view.tenantId ?? "";
  const projectId = view.projectId ?? "";
  return (
    <div className="cx-coverage-empty" data-testid="coverage-empty">
      <h2 className="cx-coverage-empty-heading">
        {pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_heading : COVERAGE_COPY.takeoff_coverage_empty_heading}
      </h2>
      <p className="cx-coverage-empty-body">{pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_body : COVERAGE_COPY.takeoff_coverage_empty_body}</p>
      {/* The core secondary Button worn as a link, the register's own idiom: a real anchor navigates. */}
      <a
        className="cx-btn cx-reticle cx-coverage-empty-action"
        data-variant="secondary"
        href={pinned ? registerHref(tenantId, projectId) : setsHref(tenantId, projectId)}
      >
        {pinned ? COVERAGE_COPY.takeoff_coverage_empty_campaign_action : COVERAGE_COPY.takeoff_coverage_empty_action}
      </a>
    </div>
  );
}

/**
 * I-195: the legend names MEANINGS, never codes. One entry per cause in the closed set's declared
 * order, each the mark, the registry's message as its name and the registry's remedy beneath — so
 * nothing on this screen is carried by colour alone (R-UI-060).
 */
function Legend() {
  return (
    <div className="cx-coverage-legend" data-testid="coverage-legend">
      <h3 className="cx-coverage-legend-heading">{COVERAGE_COPY.takeoff_coverage_legend_heading}</h3>
      {LEGEND_READINGS.map((reading) => (
        <LegendEntry key={reading} reading={reading} />
      ))}
    </div>
  );
}

/** The legend's mark size — the glyph viewBox's own 16 (Decision § 5). */
const LEGEND_MARK = 16;

/**
 * The legend's whole vocabulary, in the law's own order: the one measured reading a cell can bear,
 * then every cause of either axis (L-QTY-05's `RESIDUE_CAUSES`). Derived, never transcribed — a cause
 * the law admits later is an entry here without an edit (B-19).
 */
const LEGEND_READINGS: readonly GlyphReading[] = [QUANTITY_BEARING, ...RESIDUE_CAUSES];

function LegendEntry({ reading }: { reading: GlyphReading }): ReactElement {
  // The measured reading is refusal-SHAPED and is no refusal (L-QTY-05), so the register holds no
  // words for it and the screen's own sentence names it. Every cause's words are the register's.
  const entry = causeWords(reading);
  return (
    <div className="cx-coverage-legend-entry" data-testid="coverage-legend-entry" data-code={reading}>
      <LegendGlyph reading={reading} size={LEGEND_MARK} />
      <span className="cx-coverage-legend-name">{entry?.message ?? COVERAGE_COPY.takeoff_coverage_measured_note}</span>
      {entry === undefined ? null : <span className="cx-coverage-legend-remedy">{entry.remedy}</span>}
    </div>
  );
}

/**
 * The inspector on one cell (Decision § 1): what was sighted for it, what the rails observed, why it
 * stands as it does — in the registry's own words (I-191) — and, where a door could really be
 * carried, the two doors that move a boundary (I-194).
 */
function Inspector({
  cell,
  permitted,
  offline,
  Button,
  onHoldOut,
  onDeclareOutOfScope,
  rulesetHref: ruleset,
}: {
  cell: ResidueCell | null;
  permitted: boolean;
  offline: boolean;
  Button: CoverageChrome["Button"];
  onHoldOut: () => void;
  onDeclareOutOfScope: () => void;
  rulesetHref: string;
}) {
  if (cell === null) {
    return (
      <aside className="cx-coverage-inspector" data-testid="coverage-inspector" data-cell="">
        <h2 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_inspector_idle_heading}</h2>
        <p className="cx-coverage-inspector-body">{COVERAGE_COPY.takeoff_coverage_inspector_idle_body}</p>
      </aside>
    );
  }

  // I-198: the cell is read under the axis a person moved — the bill's cause where one holds it out
  // of this bill, and the measurement cause everywhere else. One rule, one home (B-17).
  const read = causeRead(cell);
  const measured = read === QUANTITY_BEARING;
  const entry = measured ? undefined : causeWords(read);
  const grain = cell.grain === "KIND";
  const actId = cell.measurementActId ?? cell.billActId;
  // Every act standing over this cell, on either axis — a cell can carry one on each (I-189), and a
  // reader is owed both. Deduplicated, because one act could in principle be cited by both.
  const declarations = [...new Set([cell.measurementActId, cell.billActId].filter((held): held is string => held !== null))];
  // I-194: a door that can answer only a refusal is theatre, so it is absent rather than disabled.
  const doorsStand = permitted && !grain && !measured;
  const holdStands = doorsStand && cell.bill !== NOT_IN_THIS_BILL;
  const scopeStands = doorsStand && cell.measurement !== NOT_IN_PROJECT_SCOPE;

  return (
    <aside
      className="cx-coverage-inspector"
      data-testid="coverage-inspector"
      data-cell={cellRef(cell)}
      data-kind={cell.kind}
      data-class={cell.class ?? ""}
      data-level={cell.levelId ?? ""}
    >
      <dl className="cx-coverage-facts">
        <dt>{COVERAGE_COPY.takeoff_coverage_kind_label}</dt>
        <dd className="cx-coverage-value">{cell.kind}</dd>
        {grain ? null : (
          <>
            <dt>{COVERAGE_COPY.takeoff_coverage_class_label}</dt>
            <dd className="cx-coverage-value">{cell.class ?? ""}</dd>
            <dt>{COVERAGE_COPY.takeoff_coverage_level_label}</dt>
            <dd className="cx-coverage-value">{cell.levelLabel}</dd>
          </>
        )}
      </dl>
      {/* I-196: a kind-grain row spans the whole extent, so it says so in place of a class and a level. */}
      {grain ? <p className="cx-coverage-grain">{COVERAGE_COPY.takeoff_coverage_kind_grain_label}</p> : null}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_cause_heading}</h3>
      <p className="cx-coverage-cause" data-testid="coverage-inspector-cause" data-cause={read} data-code={read} data-act={actId ?? ""}>
        {entry === undefined ? COVERAGE_COPY.takeoff_coverage_cell_label_measured : entry.message}
        {actId === null ? null : (
          <>
            <span className="cx-coverage-declared-label">{COVERAGE_COPY.takeoff_coverage_declared_label}</span>
            <span className="cx-coverage-act-id">{actId}</span>
          </>
        )}
      </p>
      {/*
        I-191: the remedy is the registry's sentence, verbatim. One cause names a place this product
        holds — the ruleset is where a bearer is recorded — so for that one the sentence itself is
        the link, and no second label is invented for it (Decision § 3, § 7).
      */}
      <p className="cx-coverage-remedy" data-testid="coverage-inspector-remedy">
        {read === KIND_NOT_YET_SEEDED && entry !== undefined ? (
          <a className="cx-coverage-remedy-link" href={ruleset}>
            {entry.remedy}
          </a>
        ) : (
          (entry?.remedy ?? COVERAGE_COPY.takeoff_coverage_measured_note)
        )}
      </p>
      {cell.contradicted ? <p className="cx-coverage-contradicted">{COVERAGE_COPY.takeoff_coverage_contradicted_note}</p> : null}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_sightings_heading}</h3>
      {cell.sightings.length === 0 && declarations.length === 0 ? (
        <p className="cx-coverage-none">{COVERAGE_COPY.takeoff_coverage_sightings_none}</p>
      ) : null}
      {cell.sightings.map((seen) => (
        <div
          className="cx-coverage-sighting"
          data-testid="coverage-inspector-sighting"
          data-channel={seen.channel}
          data-source={seen.sourceKey}
          key={`${seen.channel}:${seen.sourceKey}`}
        >
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_channel_label}</span>
          <span className="cx-coverage-value">{seen.channel}</span>
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_drawing_label}</span>
          <span className="cx-coverage-value">{seen.drawingId}</span>
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_view_label}</span>
          <span className="cx-coverage-value">{seen.layoutName}</span>
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_source_label}</span>
          <span className="cx-coverage-source-key">{seen.sourceKey}</span>
        </div>
      ))}
      {/*
        A declaration a person made is evidence for this cell's reading exactly as a sighting is, so
        it stands in the same list under its own channel (L-ACT-01): it is what a reader following
        "why does this cell read as it does" is owed, and it is the only evidence a contradicted cell
        has left once the published lines have beaten it (I-192, I-201). The act is cited, never the
        code it declared — a refusal code reaches no text node of this screen (Decision § 7).
      */}
      {declarations.map((declared) => (
        <div className="cx-coverage-sighting" data-testid="coverage-inspector-sighting" data-channel={DECLARATION} data-source={declared} key={`${DECLARATION}:${declared}`}>
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_channel_label}</span>
          <span className="cx-coverage-value">{DECLARATION}</span>
          <span className="cx-coverage-label">{COVERAGE_COPY.takeoff_coverage_declared_label}</span>
          <span className="cx-coverage-act-id">{declared}</span>
        </div>
      ))}

      <h3 className="cx-coverage-inspector-heading">{COVERAGE_COPY.takeoff_coverage_observations_heading}</h3>
      <p className="cx-coverage-hint">{COVERAGE_COPY.takeoff_coverage_observations_hint}</p>
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
            <span className="cx-coverage-reason">{observation.reason}</span>
          </div>
        ))
      )}

      {holdStands || scopeStands ? (
        <div className="cx-coverage-doors">
          <p className="cx-coverage-hint">{COVERAGE_COPY.takeoff_coverage_doors_hint}</p>
          {holdStands ? (
            <Button variant="secondary" data-testid="coverage-hold-out" disabled={offline} onClick={onHoldOut}>
              {COVERAGE_COPY.takeoff_coverage_hold_out}
            </Button>
          ) : null}
          {scopeStands ? (
            <Button variant="secondary" data-testid="coverage-declare-out-of-scope" disabled={offline} onClick={onDeclareOutOfScope}>
              {COVERAGE_COPY.takeoff_coverage_declare_out_of_scope}
            </Button>
          ) : null}
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
function CertificatePreviewSection({ measurement, bill }: { measurement: readonly StatementRow[]; bill: readonly StatementRow[] }) {
  return (
    <section className="cx-coverage-certificate" data-testid="coverage-certificate-preview">
      <h2 className="cx-coverage-certificate-heading">{COVERAGE_COPY.takeoff_coverage_certificate_heading}</h2>
      <p className="cx-coverage-hint">{COVERAGE_COPY.takeoff_coverage_certificate_hint}</p>
      <Statement
        axis={MEASUREMENT}
        title={COVERAGE_COPY.takeoff_coverage_statement_measurement_title}
        hint={COVERAGE_COPY.takeoff_coverage_statement_measurement_hint}
        none={COVERAGE_COPY.takeoff_coverage_statement_measurement_none}
        rows={measurement}
      />
      <Statement
        axis={BILL}
        title={COVERAGE_COPY.takeoff_coverage_statement_bill_title}
        hint={COVERAGE_COPY.takeoff_coverage_statement_bill_hint}
        none={COVERAGE_COPY.takeoff_coverage_statement_bill_none}
        rows={bill}
      />
    </section>
  );
}

/** One statement: an enumeration in the certificate's own order, each row under its own cause. */
function Statement({
  axis,
  title,
  hint,
  none,
  rows,
}: {
  axis: string;
  title: string;
  hint: string;
  none: string;
  rows: readonly StatementRow[];
}): ReactElement {
  return (
    <section className="cx-coverage-statement" data-testid="coverage-statement" data-axis={axis}>
      <h3 className="cx-coverage-statement-title">{title}</h3>
      <p className="cx-coverage-hint">{hint}</p>
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
