"use client";
// S-Settings · Site facts (AM-06 §1, L-MEA-06, L-ACT-01/02/03): the project's ledger of the readings
// no drawing carries — six facts in the roster's own order, each one entered or deferred BY NAME.
//
// I-170, as this panel inherits it: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17
// bars a screen from re-implementing a shipped primitive — so the renderers, the one dialog and the
// ids this panel publishes all arrive as `chrome` from the one file that may reach both trees
// (`src/app/.../settings/site-facts/site-facts-screen.tsx`).
//
// Every act here is a door and nothing more (L-ACT-02): the panel previews at the door, renders a
// rejection through the one RefusalState, and opens the one ConsequenceDialog only over a Consequence
// that was answered. Nothing on this panel commits anything itself, and nothing here re-derives a
// figure — a row reads the standing entry as it stands (I-276, L-QTY-03).
import { useCallback, useId, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { Consequence } from "@/core/acts";
import { refusalOf, type RefusalCode, type RefusalEntry } from "@/core/errors";
import { SITE_FACTS, type SiteFact, type StandingSiteFact } from "@/core/site-facts/law";
import type { Unit } from "@/core/units/canon";
import { SITE_FACT_DEFERRALS, statedByEdition } from "./deferrals";
import type { SiteFactsScreenState } from "./states";
import { factLabel, fillSiteFacts, siteFactsStrings, unitLabel, SITE_FACT_UNITS, SITE_FACT_UNIT_DEFAULT } from "./strings";

import "./site-facts.css";

// The module's door: the panel below, its copy, the deferral map it renders an absence through and
// R-UI-050's matrix — one import for the screen that mounts it and for the suites that judge it.
export { SITE_FACT_DEFERRALS, statedByEdition } from "./deferrals";
export { factLabel, siteFactsStrings, unitLabel, SITE_FACT_UNITS, SITE_FACT_UNIT_DEFAULT, type SiteFactsStringKey } from "./strings";
export { SITE_FACTS_SCREEN_STATES, SITE_FACTS_STATES, SITE_FACTS_STATE_NAMES, type SiteFactsScreenState, type SiteFactsStateCell, type SiteFactsStateName } from "./states";

/** The act this panel performs (L-ACT-02's pair), spelled once. */
const ACT_TYPE = "AUTHOR_SITE_FACT";

/** The permission AM-06 §1 enters this act under, which the door names when it stands shut. */
const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";

/** The code a reader who does not hold it is refused by, off the one register (R-UI-020). */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** R-UI-002's glyph for a figure a person entered, which is what every entered site fact is. */
const ENTERED = "ENTERED";

/** What `data-basis` says of a fact nobody has entered — not a basis, an absence (I-275). */
const ABSENT = "ABSENT";

/** The table's five columns, which is what a sub-row spans (§ 1.1). */
const COLUMNS = 5;

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/* ------------------------------------------------------------------ what the panel is handed */

/**
 * THE IDS THIS PANEL PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is the
 * one declaration of every test id and a module may not import it, so they arrive as chrome — exactly
 * as the renderers do. Every string is the registry's own.
 */
export interface SiteFactsTestIds {
  readonly screen: string;
  readonly section: string;
  readonly face: string;
  readonly table: string;
  readonly row: string;
  readonly rowValue: string;
  readonly rowSource: string;
  readonly rowAct: string;
  readonly rowDeferral: string;
  readonly enter: string;
  readonly value: string;
  readonly unit: string;
  readonly sourceNote: string;
  readonly submit: string;
  readonly refusal: string;
}

/** The shipped renderers this panel draws with, handed down rather than imported (ARCH-01, B-17). */
export interface SiteFactsChrome {
  readonly testIds: SiteFactsTestIds;
  readonly SettingsHeader: ComponentType<{ title: string; titleId?: string; about?: readonly string[] }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly ConsequenceDialog: ComponentType<{
    open: boolean;
    actType: string;
    preview: () => Promise<{ consequence: Consequence; consequenceDigest: string }>;
    commit: (carried: { consequenceDigest: string }) => Promise<{ actId: string }>;
    onOpenChange: (open: boolean) => void;
    onCommitted: (committed: { actId: string }) => void;
  }>;
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "act";
    loading?: boolean;
    onClick?: () => void;
    className?: string;
    children?: ReactNode;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  /** R-UI-083: a figure is written in the shipped NumberInput, never a bare `input type=number`. */
  readonly NumberInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
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
  readonly Input: ComponentType<{
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    className?: string;
    placeholder?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  /** R-UI-082: an identifier renders through IdChip, in its short form, and never as body text. */
  readonly IdChip: ComponentType<{ value: string; className?: string; "data-testid"?: string }>;
  /** R-UI-002's glyph and word. Only ENTERED is ever rendered here: absence is no basis (I-275). */
  readonly BasisChip: ComponentType<{ basis: typeof ENTERED }>;
}

/** What the panel states at either door, for one fact of one project. */
export interface SiteFactStatement {
  readonly projectId: string;
  readonly fact: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly sourceNote: string;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type SiteFactPreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type SiteFactCommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

export interface SiteFactsPanelProps {
  /** The workspace this project's ledger belongs to — the scope both doors are answered in. */
  readonly tenantId: string;
  readonly projectId: string;
  /** What each fact stands at — `standingSiteFacts`' answer, with an absent key per absent fact. */
  readonly standing: Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;
  /** Whether this reader holds AUTHOR_PROJECT_FACT; a reader without it still sees the whole panel. */
  readonly mayAuthor: boolean;
  readonly preview: (statement: SiteFactStatement) => Promise<SiteFactPreviewAnswer>;
  readonly commit: (carried: SiteFactStatement & { consequenceDigest: string }) => Promise<SiteFactCommitAnswer>;
  /** Where a deferral's evidence leads for the facts the pinned edition may also state (I-B). */
  readonly rulesetHref: string;
  /** Where PERMISSION_NOT_HELD is resolved: the screen a role is granted on. */
  readonly participantsHref: string;
  /**
   * The shipped renderers and the registry's ids, handed down by the one file that may reach both
   * trees. Optional in the TYPE and required in fact: ARCH-01 bars this module from importing
   * `src/ui`, so a mount that hands in nothing has nothing lawful to draw with — and says so by
   * name rather than painting a panel with holes in it (B-19: the cause is printed to be a cause).
   */
  readonly chrome?: SiteFactsChrome;
}

/**
 * The chrome, or the reason there is none. ARCH-01 bars this module from importing `src/ui`, so the
 * shipped renderers and the registry's ids are the caller's to hand down; a mount that hands in
 * nothing is named here rather than drawing a panel with holes where its refusals belong (B-19).
 */
function handedDown(chrome: SiteFactsChrome | undefined): SiteFactsChrome {
  if (chrome !== undefined) return chrome;
  throw new Error(
    "SiteFactsPanel was mounted with no chrome. ARCH-01 bars src/modules from importing src/ui, so the shipped RefusalState, ConsequenceDialog, NumberInput, Select, Input, IdChip, BasisChip and SettingsHeader — and the ids src/ui/testids.ts declares — are handed in by the one caller that may reach both trees (the settings route's site-facts-screen.tsx builds them).",
  );
}

/** The fragment a deferral's evidence link leads to: the row that resolves it, on this screen. */
function rowAnchor(fact: SiteFact): string {
  return `site-fact-${fact.toLowerCase()}`;
}

/** The units the form offers, in the canon's own order, with the words they are read by (§ 3). */
const UNIT_OPTIONS: readonly { value: string; label: string }[] = Object.freeze(
  SITE_FACT_UNITS.map((unit) => Object.freeze({ value: unit, label: unitLabel(unit) })),
);

export function SiteFactsPanel({ projectId, standing, mayAuthor, preview, commit, rulesetHref, participantsHref, chrome }: SiteFactsPanelProps): ReactNode {
  const { testIds, SettingsHeader, RefusalState, ConsequenceDialog, Button, NumberInput, Select, Input, IdChip, BasisChip } = handedDown(chrome);

  /** The fact whose form is open — one at a time, and one act per fact (I-281). */
  const [openFact, setOpenFact] = useState<SiteFact | null>(null);
  const [valueAsWritten, setValueAsWritten] = useState("");
  const [unitAsWritten, setUnitAsWritten] = useState<Unit | string>(SITE_FACT_UNIT_DEFAULT);
  const [sourceNote, setSourceNote] = useState("");
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** A refusal of the panel's own — never of a row's absence, which is the deferral beside it. */
  const [refusal, setRefusal] = useState<RefusalCode | null>(mayAuthor ? null : PERMISSION_NOT_HELD);
  /** The entry the last act carried, once it has been carried: what the status line speaks (§ 2). */
  const [entered, setEntered] = useState<{ fact: SiteFact; reading: string } | null>(null);

  const headingId = useId();
  const refusalId = useId();

  /** Where each reachable refusal is resolved (§ 2) — a place, named by where it goes (R-UI-020). */
  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === PERMISSION_NOT_HELD) return { href: participantsHref, label: siteFactsStrings.site_facts_evidence_participants };
      return { href: rulesetHref, label: siteFactsStrings.site_facts_evidence_ruleset };
    },
    [participantsHref, rulesetHref],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes. */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const stated = useCallback(
    (): SiteFactStatement => ({ projectId, fact: openFact ?? "", valueAsWritten, unitAsWritten, sourceNote }),
    [openFact, projectId, sourceNote, unitAsWritten, valueAsWritten],
  );

  const closeForm = useCallback((): void => {
    setOpenFact(null);
    setValueAsWritten("");
    setUnitAsWritten(SITE_FACT_UNIT_DEFAULT);
    setSourceNote("");
  }, []);

  /**
   * The row's own door. A form open on another fact closes: six facts read from six different notes
   * are six acts, never one group (I-281, R-UI-023). Nothing a reader typed is cleared by anything
   * but opening a new form or carrying the act out.
   */
  const openOn = (fact: SiteFact): void => {
    if (!mayAuthor || pending) return;
    setOpenFact(fact);
    setValueAsWritten("");
    setUnitAsWritten(SITE_FACT_UNIT_DEFAULT);
    setSourceNote("");
    setRefusal(null);
    setEntered(null);
  };

  /**
   * The act's door: preview first, and open the dialog only over a Consequence. A refusal of the
   * preview is answered in place and NO dialog opens — a malformed entry is refused before any row
   * exists, so the dialog never stands on one (§ 2).
   */
  const submit = async (): Promise<void> => {
    if (pending || !mayAuthor || openFact === null) return;
    setPending(true);
    setEntered(null);
    setRefusal(null);
    const answered = await preview(stated());
    setPending(false);
    if (!answered.previewed) {
      setRefusal(answered.refusal);
      return;
    }
    setDialogOpen(true);
  };

  const dialogPreview = useCallback(async () => {
    const answered = await preview(stated());
    if (!answered.previewed) throw refused(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [preview, refused, stated]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      const answered = await commit({ ...stated(), consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, refused, stated],
  );

  /** § 7: the state a read of this screen gets, spelled from the screen's own roster (§ 2). */
  const state: SiteFactsScreenState = pending ? "busy" : refusal !== null ? "refused" : "ready";

  const rows = useMemo(() => SITE_FACTS.map((fact) => ({ fact, held: standing[fact] })), [standing]);

  return (
    <div className="cx-site-facts" data-testid={testIds.screen} data-screen-root="" data-state={state}>
      <section className="cx-site-facts-section" data-testid={testIds.section} data-rendered-region={testIds.section} data-state={state} aria-labelledby={headingId}>
        <SettingsHeader title={siteFactsStrings.site_facts_heading} titleId={headingId} about={[siteFactsStrings.site_facts_caption]} />

        {/* § 1: the screen's one helper line — what L-MEA-06's silence costs, in one sentence. */}
        <p className="cx-site-facts-face" data-testid={testIds.face}>
          {siteFactsStrings.site_facts_face}
        </p>

        {/* § 7: the region a read waits on, and the count that says the table finished rendering.
            The roster is a compile-time constant, so the count is the roster's own length. */}
        <div className="cx-site-facts-table" data-testid={testIds.table} data-rows-rendered={String(SITE_FACTS.length)}>
          <table className="cx-site-facts-grid">
            <colgroup>
              <col className="cx-site-facts-col-fact" />
              <col className="cx-site-facts-col-value" />
              <col className="cx-site-facts-col-source" />
              <col className="cx-site-facts-col-act" />
              <col className="cx-site-facts-col-door" />
            </colgroup>
            <thead className="cx-site-facts-head">
              <tr>
                <th scope="col">{siteFactsStrings.site_facts_column_fact}</th>
                <th scope="col" className="cx-site-facts-numeric">
                  {siteFactsStrings.site_facts_column_value}
                </th>
                <th scope="col">{siteFactsStrings.site_facts_column_source}</th>
                <th scope="col">{siteFactsStrings.site_facts_column_act}</th>
                {/* The door's column is headed by nothing a reader needs to read; the buttons in it
                    say what they do (R-UI-012 is answered by each button's own words). */}
                <th scope="col">
                  <span className="cx-site-facts-hidden-head">{siteFactsStrings.site_facts_heading}</span>
                </th>
              </tr>
            </thead>

            {/* I-273: one element per fact carries `data-fact` and `data-basis`, and every `<tr>`
                inside it keeps the grid's own row height — a deferred fact shows its refusal in
                place (R-UI-020) without a row that is taller than the law allows (R-UI-083). */}
            {rows.map(({ fact, held }) => (
              <tbody
                key={fact}
                className="cx-site-facts-row"
                id={rowAnchor(fact)}
                data-testid={testIds.row}
                data-fact={fact}
                data-basis={held === undefined ? ABSENT : ENTERED}
              >
                <tr className="cx-site-facts-line">
                  <th scope="row" className="cx-site-facts-fact">
                    <span className="cx-site-facts-fact-inner">
                      {held === undefined ? null : <BasisChip basis={ENTERED} />}
                      <span className="cx-site-facts-fact-label">{factLabel(fact)}</span>
                    </span>
                  </th>
                  <td className="cx-site-facts-numeric">
                    {held === undefined ? (
                      <span className="cx-site-facts-absent">{siteFactsStrings.site_facts_absent_value}</span>
                    ) : (
                      // I-276: the reading AS WRITTEN, in the unit it was written in — the canonical
                      // metres the canon made of it are the ledger's, not this screen's (L-QTY-03).
                      <span className="cx-site-facts-value" data-testid={testIds.rowValue}>
                        {`${held.valueAsWritten} ${held.unitAsWritten}`}
                      </span>
                    )}
                  </td>
                  <td>
                    {held === undefined ? (
                      <span className="cx-site-facts-absent">{siteFactsStrings.site_facts_absent_value}</span>
                    ) : (
                      <span className="cx-site-facts-source" data-testid={testIds.rowSource} title={held.sourceNote}>
                        {held.sourceNote}
                      </span>
                    )}
                  </td>
                  <td>
                    {held === undefined ? (
                      <span className="cx-site-facts-absent">{siteFactsStrings.site_facts_absent_value}</span>
                    ) : (
                      <IdChip value={held.actId} data-testid={testIds.rowAct} />
                    )}
                  </td>
                  <td className="cx-site-facts-door">
                    {mayAuthor ? (
                      <Button
                        variant="ghost"
                        className="cx-site-facts-enter"
                        data-testid={testIds.enter}
                        onClick={() => openOn(fact)}
                      >
                        {held === undefined ? siteFactsStrings.site_facts_enter : siteFactsStrings.site_facts_restate}
                      </Button>
                    ) : (
                      // I-266's shut-door idiom: the door stands for a reader who cannot walk through
                      // it, in the tab order, described by the standing PERMISSION_NOT_HELD that says
                      // why — nothing is hidden from anyone who can see the project (R-SPINE-006).
                      <span
                        className="cx-btn cx-reticle cx-site-facts-enter"
                        data-variant="ghost"
                        data-testid={testIds.enter}
                        data-permission={AUTHOR_PROJECT_FACT}
                        role="button"
                        tabIndex={0}
                        aria-disabled="true"
                        aria-describedby={refusalId}
                      >
                        <span className="cx-btn-label">{held === undefined ? siteFactsStrings.site_facts_enter : siteFactsStrings.site_facts_restate}</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* I-274: the deferral stands while the form is open — a refusal is dismissed by
                    being resolved, never by being hidden (R-UI-020). */}
                {held === undefined ? (
                  <tr className="cx-site-facts-sub">
                    <td colSpan={COLUMNS} data-testid={testIds.rowDeferral}>
                      <RefusalState
                        refusal={refusalOf(SITE_FACT_DEFERRALS[fact])}
                        evidence={
                          statedByEdition(fact)
                            ? { href: rulesetHref, label: siteFactsStrings.site_facts_evidence_ruleset }
                            : { href: `#${rowAnchor(fact)}`, label: siteFactsStrings.site_facts_evidence_enter }
                        }
                      />
                    </td>
                  </tr>
                ) : null}

                {openFact === fact ? (
                  <tr className="cx-site-facts-sub">
                    <td colSpan={COLUMNS}>
                      <div className="cx-site-facts-form">
                        <NumberInput
                          className="cx-site-facts-field-value"
                          data-testid={testIds.value}
                          aria-label={fillSiteFacts(siteFactsStrings.site_facts_value_label, { fact: factLabel(fact) })}
                          value={valueAsWritten}
                          onChange={setValueAsWritten}
                        />
                        <Select
                          className="cx-site-facts-field-unit"
                          data-testid={testIds.unit}
                          aria-label={fillSiteFacts(siteFactsStrings.site_facts_unit_label, { fact: factLabel(fact) })}
                          options={UNIT_OPTIONS}
                          value={unitAsWritten}
                          onChange={setUnitAsWritten}
                        />
                        <Input
                          className="cx-site-facts-field-source"
                          data-testid={testIds.sourceNote}
                          aria-label={fillSiteFacts(siteFactsStrings.site_facts_source_label, { fact: factLabel(fact) })}
                          placeholder={siteFactsStrings.site_facts_source_placeholder}
                          value={sourceNote}
                          onChange={(event) => setSourceNote(event.target.value)}
                        />
                        <Button variant="secondary" onClick={closeForm}>
                          {siteFactsStrings.site_facts_cancel}
                        </Button>
                        <Button className="cx-site-facts-submit" data-testid={testIds.submit} loading={pending} onClick={() => void submit()}>
                          {siteFactsStrings.site_facts_submit}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            ))}
          </table>
        </div>

        {/* The panel's one answer slot: a refusal of the panel's own renders in place with its code,
            message, remedy and the evidence that resolves it — never a toast (R-UI-020, B-17). */}
        <div className="cx-site-facts-refusal" data-testid={testIds.refusal} id={refusalId}>
          {refusal !== null && !pending ? <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} /> : null}
        </div>

        {/* What a round trip has beyond its answer, spoken rather than only drawn: a reader who
            cannot see the table re-read still hears that the entry landed (R-UI-050). */}
        <p className="cx-site-facts-status" role="status" aria-live="polite">
          {pending
            ? siteFactsStrings.site_facts_status_pending
            : entered === null
              ? ""
              : fillSiteFacts(siteFactsStrings.site_facts_status_done, { fact: factLabel(entered.fact), value: entered.reading })}
        </p>
      </section>

      <ConsequenceDialog
        open={dialogOpen}
        actType={ACT_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          // The entered fact IS the answer: the route revalidates and the row re-renders ENTERED
          // with no deferral, so the form closes on what it carried rather than holding a reading
          // the ledger now states (§ 2, Ready).
          if (openFact !== null) setEntered({ fact: openFact, reading: `${valueAsWritten} ${unitAsWritten}` });
          closeForm();
        }}
      />
    </div>
  );
}
