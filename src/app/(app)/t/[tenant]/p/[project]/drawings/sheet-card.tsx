"use client";
// One card of the sheet index (R-TO-004): the sheet as the extractor read it, what its title block
// proposes, what the extraction cost, and — while it is unconfirmed and the reader may measure — the
// one door that opens a confirmation.
//
// Every value is data and renders as data (I-25): the format, the scheme, the discipline and every
// cited entity key are the drawing's own words, never woven into a sentence — and a person reads the
// enums as words, the raw value kept in the technical disclosure (EnumLabel, R-UI-082; I-323).
//
// The law itself, not the seam's barrel: the rosters are values that touch no database
// (src/core/sheets/law.ts), and a client component reaching through the barrel would drag the driver
// into the browser bundle.
import { useId, useState } from "react";
import { DISCIPLINES, FIDELITY_FACTS, UNFLAGGED_FACTS, type Discipline, type FidelityFact } from "@/core/sheets/law";
import { formatUserFigure } from "@/core/format";
import { isDigestScheme, isWholeDigest } from "@/core/sources";
import { Badge, Button, Chip, EnumLabel, IdChip } from "@/ui/primitives/core";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { shortForm } from "@/ui/primitives/core/id-chip";
import { fill } from "@/ui/strings";
import type { ReactNode } from "react";
import { viewerSheetRoute } from "../viewer/[drawing]/[layout]/route-address";
import { drawings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/** §8's cap for this screen, lowered by I-323: three keys, then "+N more". A card whose height is the
    length of a list has no height of its own, and at 1280 a 258 px card holds the label and three
    chips in two wrapped lines — five overflowed it, clipped invisibly over the next card (the
    target-size failure of the 2026-09-23 craft look). */
const CITED_SHOWN = 3;

/** The words a source scheme is read by (R-UI-082): the enum stays in the technical disclosure. */
const SCHEME_WORDS: Readonly<Record<string, string>> = {
  DXF_HANDLE: drawings.drawings_scheme_dxf_handle,
  PDF_OBJECT: drawings.drawings_scheme_pdf_object,
  RASTER_TRACE: drawings.drawings_scheme_raster_trace,
};

/** The words each discipline is read by (R-UI-082) — total over the closed roster, so a discipline the
    law adds is a compile error here rather than an enum on screen. */
export const DISCIPLINE_WORDS: Readonly<Record<Discipline, string>> = {
  STRUCTURAL: drawings.drawings_discipline_structural,
  ARCHITECTURAL: drawings.drawings_discipline_architectural,
  MEP: drawings.drawings_discipline_mep,
  CIVIL: drawings.drawings_discipline_civil,
  OTHER: drawings.drawings_discipline_other,
};

/**
 * The measure a cited `scheme:key` shows on its chip: the key, because the scheme is every
 * citation's. A handle is short and shown whole; a content digest is 64 characters no card holds, so
 * it shows IdChip's own short form — its leading characters — with the whole key in the tooltip, the
 * copy and `data-value` (I-519).
 */
function citedMeasure(key: string): string | undefined {
  const colon = key.indexOf(":");
  if (colon <= 0 || colon === key.length - 1) return undefined;
  const own = key.slice(colon + 1);
  return isDigestScheme(key.slice(0, colon)) && isWholeDigest(own) ? shortForm(own) : own;
}

export interface SheetCardData {
  readonly sheetId: string;
  readonly drawingId: string;
  readonly layoutName: string;
  /**
   * Which space the layout is (L-CAD-05): the drawing's one model space, or a paper sheet. The
   * module's card carries it whole; the screen names a model-space card as what it is and stands it
   * after its drawing's sheets (I-429).
   */
  readonly kind: "model" | "paper";
  readonly format: string;
  /**
   * The source-key schemes the sheet's own keys are of, in the law's order — one badge each, since a
   * page that carries a pasted scan mints two (L-CAD-02, I-519).
   */
  readonly schemes: readonly string[];
  readonly thumbnail: { readonly url: string; readonly width: number; readonly height: number } | null;
  readonly proposal: { readonly number: string | null; readonly title: string; readonly discipline: Discipline; readonly basis: string; readonly cited: readonly string[] };
  readonly confirmed: { readonly discipline: Discipline; readonly actId: string } | null;
  readonly scaleState: string;
  /**
   * How many views of this sheet carry no scale of record, or an unplaceable one (R-TO-021). Null
   * where no partition has been read through yet: a count nobody derived is never invented, exactly
   * as `viewCount` answers.
   */
  readonly unplaceableViews: number | null;
  readonly viewCount: number | null;
  readonly facts: Readonly<Record<string, number | boolean>>;
}

export interface SheetCardProps {
  card: SheetCardData;
  /** The workspace and project this card's sheet is addressed under (R-UI-031). */
  tenantId: string;
  projectId: string;
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
  collapsed: drawings.drawings_fact_collapsed,
  unread: drawings.drawings_fact_unread,
  dropped_layouts: drawings.drawings_fact_dropped_layouts,
};

/**
 * The name a card is known by on this screen — its title, its picture's alt, what the search reads
 * and how the confirmation dialog lists it (I-429, amending I-364's model-space sentence): a paper
 * sheet by the title its block proposes, model space as model space. The grammar still reads model
 * space's tallest text, and its proposal still decides the discipline and the group it is offered in;
 * only the name moves, because that text is one of the sheets' own titles ("COLUMN SCHEDULE"), and a
 * card wearing it stood in the fold as a second copy of a sheet.
 */
export function cardName(card: Pick<SheetCardData, "kind" | "proposal">): string {
  return card.kind === "model" ? drawings.drawings_model_space : card.proposal.title;
}

export function SheetCard({ card, tenantId, projectId, canConfirm, onConfirm, answer }: SheetCardProps) {
  const effective = card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline;
  const basis = card.confirmed === null ? card.proposal.basis : "CONFIRMED";
  const [chosen, setChosen] = useState<Discipline>(card.proposal.discipline);
  const titleId = useId();

  return (
    <article
      className="cx-drawings-card"
      data-testid={TESTIDS.sheet.card}
      data-sheet={card.sheetId}
      data-discipline={effective}
      data-confirmed={card.confirmed === null ? "false" : "true"}
      // Every card offers a door with the same words, so each is announced inside the region its
      // own sheet names — otherwise a screen reader hears "Open sheet" N times alike (A-11Y).
      aria-labelledby={titleId}
    >
      {/* I-87: the box is the same either way, so the grid does not reflow as rasters arrive. */}
      {card.thumbnail === null ? (
        <div className="cx-drawings-thumb" data-testid={TESTIDS.sheet.cardThumbnail} data-pending="true">
          {drawings.drawings_thumbnail_pending}
        </div>
      ) : (
        /* A signed, short-lived raster URL is not an asset an optimiser may fetch, cache or
           rewrite: the link stands for fifteen minutes and names one workspace's bytes (Q-12). */
        <img
          className="cx-drawings-thumb"
          data-testid={TESTIDS.sheet.cardThumbnail}
          data-pending="false"
          src={card.thumbnail.url}
          width={card.thumbnail.width}
          height={card.thumbnail.height}
          alt={fill(drawings.drawings_thumbnail_alt, { sheet: cardName(card) })}
        />
      )}

      <h3 className="cx-drawings-card-title" data-testid={TESTIDS.sheet.cardTitle} id={titleId}>
        {cardName(card)}
      </h3>

      {/* I-323: the sheet's identity on one line — its number, then what it was read from. The
          format and scheme are enums a person reads as words (R-UI-082); the stored values stay in
          the technical disclosure and in the element's text, so a reader matching on them still
          finds them. I-429: model space is numbered by no set, so its card has no number slot —
          "No sheet number" there stated a lack where nothing is missing (R-UI-080). */}
      <div className="cx-drawings-card-meta">
        {card.kind === "model" ? null : card.proposal.number === null ? (
          <p className="cx-drawings-card-none" data-testid={TESTIDS.sheet.cardNumber}>
            {drawings.drawings_number_none}
          </p>
        ) : (
          <p className="cx-drawings-card-number" data-testid={TESTIDS.sheet.cardNumber}>
            {card.proposal.number}
          </p>
        )}
        <Badge data-testid={TESTIDS.sheet.cardFormat} aria-label={fill(drawings.drawings_format_label, { value: card.format.toUpperCase() })}>
          <EnumLabel value={card.format} label={card.format.toUpperCase()} />
        </Badge>
        {card.schemes.map((scheme) => (
          <Badge key={scheme} data-testid={TESTIDS.sheet.cardScheme} data-scheme={scheme} aria-label={fill(drawings.drawings_scheme_label, { value: schemeWords(scheme) })}>
            <EnumLabel value={scheme} label={schemeWords(scheme)} />
          </Badge>
        ))}
      </div>

      <p className="cx-drawings-discipline" data-testid={TESTIDS.sheet.cardDiscipline} data-basis={basis}>
        <EnumLabel className="cx-drawings-discipline-value" value={effective} label={DISCIPLINE_WORDS[effective]} />
        <span className="cx-drawings-basis">{BASIS_WORDS[basis]}</span>
      </p>

      {/* I-323 (amending I-93 and I-96): the cited row WRAPS, and shows CITED_SHOWN keys then says how
          many more stand — never a row clipped at the card's edge, where the keys it hid were
          invisible, reachable by nothing and laid over the neighbouring card. The whole list is the
          viewer inspector's (R-TO-011); the card shows that the proposal has evidence, and how much.
          I-359: only while the proposal is still a proposal — once a person has confirmed the
          discipline the evidence for the machine's guess decides nothing, and a row of handles under
          every title read as debug output. */}
      {card.proposal.cited.length === 0 || card.confirmed !== null ? null : (
        <p className="cx-drawings-cited" role="group" aria-label={drawings.drawings_cited_label}>
          <span className="cx-drawings-cited-label">{drawings.drawings_cited_label}</span>
          {/* I-96: a cited key is an identifier and renders through the IdChip — the key's own tail as
              the measure, the whole source key as the value, never a handle as body text (R-UI-082). */}
          {card.proposal.cited.slice(0, CITED_SHOWN).map((key) => (
            <IdChip key={key} short={citedMeasure(key)} value={key} />
          ))}
          {card.proposal.cited.length > CITED_SHOWN ? (
            <span className="cx-drawings-cited-more" data-testid={TESTIDS.sheet.cardCitedMore}>
              {fill(drawings.drawings_cited_more, { count: formatUserFigure(String(card.proposal.cited.length - CITED_SHOWN)) })}
            </span>
          ) : null}
        </p>
      )}

      {/* The scale and the views are two short readings of one partition, one a line (I-323 point 5
          as amended): each lands on the job runner's clock, and neither may re-flow the card. */}
      <div className="cx-drawings-lines">
        <p
          className="cx-drawings-line"
          data-testid={TESTIDS.sheet.cardScale}
          data-scale={card.scaleState}
          data-unplaceable={card.unplaceableViews === null ? "" : String(card.unplaceableViews)}
        >
          {scaleLine(card)}
        </p>
        {/* I-359: where the scale line has already said "{count} of {total} views", the views line would
            say the total a second time. It stays in the tree carrying its count for every reader of
            `data-views`, and `data-said` takes it from sight and from assistive technology while
            KEEPING its box — the partition lands on the job runner's clock, and a line that left the
            flow as it landed would re-flow the card beneath it (I-323 point 5 as amended). */}
        <p
          className="cx-drawings-line"
          data-testid={TESTIDS.sheet.cardViews}
          data-views={card.viewCount === null ? "" : String(card.viewCount)}
          data-said={scaleCountsViews(card) ? "true" : undefined}
        >
          {viewsLine(card.viewCount)}
        </p>
      </div>

      {/* I-85 as amended by I-323: every fact still renders, zeros included, as a list of named
          figures (R-TO-001; seven, by I-520 and I-521) — inside a disclosure whose summary says
          how many are notable, so a card whose extraction lost nothing reads as one line instead of
          rows of zeros, and a card that lost something says so before it is opened. */}
      <details className="cx-drawings-facts">
        <summary className="cx-drawings-facts-summary cx-reticle" data-notable={notableCount(card) > 0 ? "true" : "false"}>
          <span className="cx-drawings-facts-label">{drawings.drawings_facts_summary}</span>
          <span className="cx-drawings-facts-notable">
            {notableCount(card) === 0 ? drawings.drawings_facts_notable_none : fill(drawings.drawings_facts_notable, { count: formatUserFigure(String(notableCount(card))) })}
          </span>
        </summary>
        <div className="cx-drawings-fact-list" role="list">
          {FIDELITY_FACTS.map((name) => {
            const value = card.facts[name] ?? 0;
            return (
              <span className="cx-drawings-fact" role="listitem" data-testid={TESTIDS.sheet.fact} data-fact={name} data-value={String(value)} data-notable={isNotable(name, value) ? "true" : "false"} key={name}>
                <span className="cx-drawings-fact-label">{FACT_WORDS[name]}</span>
                <span className="cx-drawings-fact-value">{factValue(value)}</span>
              </span>
            );
          })}
        </div>
      </details>

      {/* I-84: every discipline is offered with the proposal preselected — a sheet the grammar read
          wrongly must still be confirmable, or it can never be measured. A confirmed card renders no
          chooser (L-ACT-01: a second reading is a competing observation, not an overwrite). */}
      {card.confirmed === null && canConfirm ? (
        <>
          <fieldset className="cx-drawings-chooser">
            <legend className="cx-drawings-field-label">{drawings.drawings_confirm_legend}</legend>
            <span className="cx-drawings-choices">
              {DISCIPLINES.map((offered) => (
                <Chip key={offered} data-testid={TESTIDS.sheet.disciplineOption} data-value={offered} selected={chosen === offered} onClick={() => setChosen(offered)}>
                  <EnumLabel value={offered} label={DISCIPLINE_WORDS[offered]} />
                </Chip>
              ))}
            </span>
          </fieldset>
          <Button className="cx-drawings-card-confirm" variant="secondary" data-testid={TESTIDS.sheet.confirm} onClick={() => onConfirm(card.sheetId, chosen)}>
            {drawings.drawings_sheet_confirm}
          </Button>
        </>
      ) : null}

      <span className="cx-drawings-answer">{answer}</span>

      {/* R-UI-031: a screen reachable only by a typed address is a failing criterion, so every card
          carries the door onto its own sheet. A link and not a button — it is navigation a browser
          can follow, open in a new tab and copy. */}
      <a className="cx-btn cx-reticle cx-drawings-card-open" data-variant="secondary" data-testid={TESTIDS.sheet.cardOpen} href={viewerSheetRoute(tenantId, projectId, card.drawingId, card.layoutName)}>
        <span className="cx-btn-label">{drawings.drawings_open_sheet}</span>
      </a>
    </article>
  );
}

/**
 * The sentence this sheet's scale line reads (R-TO-021: "the sheet card shows the count").
 *
 * A sheet held back by views with no scale of record names how many, out of how many it holds; one
 * whose layout carries no extent or no drawing unit keeps the sheet grammar's own sentence, because
 * that is a different claim and no count belongs to it. The two states that carry no count read
 * exactly as they did before this increment (B-20).
 */
function scaleLine(card: SheetCardData): string {
  if (scaleCountsViews(card)) {
    return fill(drawings.drawings_scale_unplaceable_count, {
      count: formatUserFigure(String(card.unplaceableViews)),
      total: formatUserFigure(String(card.viewCount)),
    });
  }
  return SCALE_WORDS[card.scaleState] ?? card.scaleState;
}

/** Whether the scale line states "{count} of {total} views" — and with it the views line's total (I-359). */
function scaleCountsViews(card: SheetCardData): boolean {
  return card.scaleState === "unplaceable" && card.unplaceableViews !== null && card.viewCount !== null;
}

/**
 * The views line: the count said in the grammar of its number; that the record's partition answered
 * and put no view on this sheet (I-359); or that no partition has answered yet.
 */
function viewsLine(count: number | null): string {
  if (count === null) return drawings.drawings_views_unclassified;
  if (count === 0) return drawings.drawings_views_count_none;
  return fill(count === 1 ? drawings.drawings_views_count_one : drawings.drawings_views_count, { count: formatUserFigure(String(count)) });
}

/** A fact's own value: a count through SEAM-FORMAT, a flag as the two words the table holds. */
function factValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? drawings.drawings_fact_yes : drawings.drawings_fact_no;
  return formatUserFigure(String(value));
}

/**
 * Whether a fact reports a loss: a true flag, or a count above zero (I-85) — unless the fact is one
 * the law counts and never flags, because what it counts lost nothing (I-520: a duplicate collapsed
 * onto its twin is one object read once, and flagging it put "1 notable" on every sheet of a set).
 */
function isNotable(name: FidelityFact, value: number | boolean): boolean {
  if ((UNFLAGGED_FACTS as readonly FidelityFact[]).includes(name)) return false;
  return typeof value === "boolean" ? value : value > 0;
}

/** How many of the roster's facts report a loss on this card — the facts summary's figure. */
function notableCount(card: SheetCardData): number {
  return FIDELITY_FACTS.filter((name) => isNotable(name, card.facts[name] ?? 0)).length;
}

/** The words a source scheme is read by, or the mechanical reading of one the table does not name. */
function schemeWords(scheme: string): string {
  return SCHEME_WORDS[scheme] ?? humaniseEnum(scheme);
}
