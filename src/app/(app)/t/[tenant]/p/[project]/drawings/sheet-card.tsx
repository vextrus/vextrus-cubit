"use client";
// One card of the sheet index (R-TO-004): the sheet as the extractor read it, what its title block
// proposes, what the extraction cost, and — while it is unconfirmed and the reader may measure — the
// one door that opens a confirmation.
//
// Every value is data and renders as data (I-25): the format, the scheme, the discipline and every
// cited entity key are the drawing's own words, shown verbatim and never woven into a sentence.
//
// The law itself, not the seam's barrel: the rosters are values that touch no database
// (src/core/sheets/law.ts), and a client component reaching through the barrel would drag the driver
// into the browser bundle.
import { useState } from "react";
import { DISCIPLINES, FIDELITY_FACTS, type Discipline, type FidelityFact } from "../../../../../../../core/sheets/law";
import { formatUserFigure } from "../../../../../../../core/format";
import { Badge, Button, Chip } from "../../../../../../../ui/primitives/core";
import { fill } from "../../../../../../../ui/strings";
import type { ReactNode } from "react";
import { drawings } from "./strings";

/** One card, as the page hands it down — the module's own answer, carried whole. */
export interface SheetCardData {
  readonly sheetId: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly format: string;
  readonly scheme: string;
  readonly thumbnail: { readonly url: string; readonly width: number; readonly height: number } | null;
  readonly proposal: { readonly number: string | null; readonly title: string; readonly discipline: Discipline; readonly basis: string; readonly cited: readonly string[] };
  readonly confirmed: { readonly discipline: Discipline; readonly actId: string } | null;
  readonly scaleState: string;
  readonly viewCount: number | null;
  readonly facts: Readonly<Record<string, number | boolean>>;
}

export interface SheetCardProps {
  card: SheetCardData;
  /** Whether this reader holds MEASURE — a control that could only refuse is theatre (I-90). */
  canConfirm: boolean;
  onConfirm: (sheetId: string, discipline: Discipline) => void;
  /** The answer this card's own door was given, rendered in its own slot (R-UI-020). */
  answer: ReactNode;
}

/** The scale sentence each state reads as (Decision § 3). */
const SCALE_WORDS: Readonly<Record<string, string>> = {
  unaffirmed: drawings.drawings_scale_unaffirmed,
  affirmed: drawings.drawings_scale_affirmed,
  unplaceable: drawings.drawings_scale_unplaceable,
};

/** The basis sentence each proposal basis reads as (I-83: not an R-UI-002 basis). */
const BASIS_WORDS: Readonly<Record<string, string>> = {
  GRAMMAR: drawings.drawings_basis_grammar,
  NONE: drawings.drawings_basis_none,
  CONFIRMED: drawings.drawings_basis_confirmed,
};

/** The label each fidelity fact is named by — total over the roster (R-TO-001, I-85). */
const FACT_WORDS: Readonly<Record<FidelityFact, string>> = {
  strays_rejected: drawings.drawings_fact_strays_rejected,
  explode_truncated: drawings.drawings_fact_explode_truncated,
  explode_losses: drawings.drawings_fact_explode_losses,
  flatten_capped: drawings.drawings_fact_flatten_capped,
  dropped_layouts: drawings.drawings_fact_dropped_layouts,
};

export function SheetCard({ card, canConfirm, onConfirm, answer }: SheetCardProps) {
  const effective = card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline;
  const basis = card.confirmed === null ? card.proposal.basis : "CONFIRMED";
  const [chosen, setChosen] = useState<Discipline>(card.proposal.discipline);

  return (
    <article className="cx-drawings-card" data-testid="sheet-card" data-sheet={card.sheetId} data-discipline={effective} data-confirmed={card.confirmed === null ? "false" : "true"}>
      {/* I-87: the box is the same either way, so the grid does not reflow as rasters arrive. */}
      {card.thumbnail === null ? (
        <div className="cx-drawings-thumb" data-testid="sheet-card-thumbnail" data-pending="true">
          {drawings.drawings_thumbnail_pending}
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived raster URL is
           not an asset the optimiser may fetch, cache or rewrite (Q-12). */
        <img
          className="cx-drawings-thumb"
          data-testid="sheet-card-thumbnail"
          data-pending="false"
          src={card.thumbnail.url}
          width={card.thumbnail.width}
          height={card.thumbnail.height}
          alt={fill(drawings.drawings_thumbnail_alt, { sheet: card.proposal.title })}
        />
      )}

      <h3 className="cx-drawings-card-title" data-testid="sheet-card-title">
        {card.proposal.title}
      </h3>

      {card.proposal.number === null ? (
        <p className="cx-drawings-card-none" data-testid="sheet-card-number">
          {drawings.drawings_number_none}
        </p>
      ) : (
        <p className="cx-drawings-card-number" data-testid="sheet-card-number">
          {card.proposal.number}
        </p>
      )}

      <p className="cx-drawings-badges">
        <Badge className="cx-drawings-enum" data-testid="sheet-card-format" aria-label={fill(drawings.drawings_format_label, { value: card.format })}>
          {card.format}
        </Badge>
        <Badge className="cx-drawings-enum" data-testid="sheet-card-scheme" aria-label={fill(drawings.drawings_scheme_label, { value: card.scheme })}>
          {card.scheme}
        </Badge>
      </p>

      <p className="cx-drawings-discipline" data-testid="sheet-card-discipline" data-basis={basis}>
        <span className="cx-drawings-enum">{effective}</span>
        <span className="cx-drawings-basis">{BASIS_WORDS[basis]}</span>
      </p>

      {/* I-93: evidence is shown whole, wrapping and selectable — never truncated behind a count. */}
      {card.proposal.cited.length === 0 ? null : (
        <p className="cx-drawings-cited">
          <span className="cx-drawings-cited-label">{drawings.drawings_cited_label}</span>
          {card.proposal.cited.map((key) => (
            <span className="cx-drawings-enum" key={key}>
              {key}
            </span>
          ))}
        </p>
      )}

      <p className="cx-drawings-line" data-testid="sheet-card-scale" data-scale={card.scaleState}>
        {SCALE_WORDS[card.scaleState] ?? card.scaleState}
      </p>
      <p className="cx-drawings-line" data-testid="sheet-card-views" data-views={card.viewCount === null ? "" : String(card.viewCount)}>
        {card.viewCount === null ? drawings.drawings_views_unclassified : fill(drawings.drawings_views_count, { count: formatUserFigure(String(card.viewCount)) })}
      </p>

      <p className="cx-drawings-facts">
        {FIDELITY_FACTS.map((name) => {
          const value = card.facts[name] ?? 0;
          const notable = typeof value === "boolean" ? value : value > 0;
          return (
            <span className="cx-drawings-fact" data-testid="sheet-fact" data-fact={name} data-value={String(value)} data-notable={notable ? "true" : "false"} key={name}>
              <span className="cx-drawings-fact-label">{FACT_WORDS[name]}</span>
              <span className="cx-drawings-fact-value">{factValue(value)}</span>
            </span>
          );
        })}
      </p>

      {/* I-84: every discipline is offered with the proposal preselected — a sheet the grammar read
          wrongly must still be confirmable, or it can never be measured. A confirmed card renders no
          chooser (L-ACT-01: a second reading is a competing observation, not an overwrite). */}
      {card.confirmed === null && canConfirm ? (
        <>
          <fieldset className="cx-drawings-chooser">
            <legend className="cx-drawings-field-label">{drawings.drawings_confirm_legend}</legend>
            <span className="cx-drawings-choices">
              {DISCIPLINES.map((offered) => (
                <Chip className="cx-drawings-enum" key={offered} data-testid="sheet-discipline-option" data-value={offered} selected={chosen === offered} onClick={() => setChosen(offered)}>
                  {offered}
                </Chip>
              ))}
            </span>
          </fieldset>
          <Button className="cx-drawings-card-confirm" variant="secondary" data-testid="sheet-confirm" onClick={() => onConfirm(card.sheetId, chosen)}>
            {drawings.drawings_sheet_confirm}
          </Button>
        </>
      ) : null}

      <span className="cx-drawings-answer">{answer}</span>
    </article>
  );
}

/** A fact's own value: a count through SEAM-FORMAT, a flag as the two words the table holds. */
function factValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? drawings.drawings_fact_yes : drawings.drawings_fact_no;
  return formatUserFigure(String(value));
}
