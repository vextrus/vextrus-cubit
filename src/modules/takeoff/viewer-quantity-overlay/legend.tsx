"use client";
/**
 * R-TO-044's legend on the sheet: the conditions the visible sheet's quantities stand under, each with
 * its colour and hatch, how many of its members are measured here, and its measured-scope totals per
 * kind — the exact sum on `data-value`, the face at the kind's own document precision (L-FMT-02).
 * Under it, while the switch shows them, what was seen and not billed, with its reason and no figure
 * (L-QTY-07: never totalled); the bases the paint uses, each keyed by colour AND glyph (R-UI-002); and
 * the other sheets of this drawing the campaign's remaining members stand on.
 *
 * It lives in the module and imports nothing of `src/ui` (ARCH-01): the swatch, the glyphs, the words,
 * the refusal and the test ids are handed in by the screen, each from its one home (B-17).
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { REFUSALS } from "@/core/errors";
import { placesOf } from "@/core/documents/kinds/boq-draft-law";
import { formatUserFigure } from "@/core/format";
import type { ConditionColour, ConditionHatch } from "@/core/manual/law";
import type { QuantityBasis } from "@/core/offers/law";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { fillCopy, type QuantityCopy } from "./copy";
import { legendOf } from "./scene";
import type { QuantityOverlay, QuantityLegendRow, QuantityToggles } from "./types";
import type { QuantityOverlayPhase } from "./use-quantity-overlay";

/** The test ids the legend publishes, from the registry the screen reads (C-05). */
export type QuantityLegendTestIds = {
  readonly legend: string;
  readonly row: string;
  readonly total: string;
  readonly unmeasured: string;
  readonly basis: string;
  readonly elsewhere: string;
  readonly retry: string;
};

export type QuantityLegendProps = {
  copy: QuantityCopy;
  /** EnumLabel's one rule for saying a stored spelling in words (R-UI-082). */
  humanise: (value: string) => string;
  /** R-UI-002's glyph table, from its one home. */
  glyphs: Readonly<Record<QuantityBasis, string>>;
  /** The chest's own swatch: a condition's colour and its hatch, one renderer in the product (B-17). */
  Swatch: ComponentType<{ colour: ConditionColour; hatch: ConditionHatch }>;
  phase: QuantityOverlayPhase;
  overlay: QuantityOverlay | null;
  toggles: QuantityToggles;
  faultId: string | null;
  onRetry: () => void;
  /** The feed's own refusal, rendered by the product's one RefusalState — the screen's to mount. */
  refusal: ReactNode;
  testIds: QuantityLegendTestIds;
};

/** A kind in the QS's words: `rcc.concrete` → "Concrete" (the chest's own reading). */
function kindWords(kind: string, humanise: (value: string) => string): string {
  return humanise(kind.slice(kind.lastIndexOf(".") + 1));
}

/** A figure at its kind's document precision, grouped by the format seam (L-FMT-02, B-07). */
function figureOf(value: string, kind: string): string {
  return formatUserFigure(statedAt(value, placesOf(kind)));
}

/** What a condition is called: the chest condition's own name, or the rail class in words (I-634). */
function conditionWords(row: QuantityLegendRow, humanise: (value: string) => string): string {
  return row.condition.name ?? humanise(row.condition.class);
}

/** Why a condition's members were not billed: the variables they omitted, else each code's registered sentence. */
function reasonOf(row: QuantityLegendRow, copy: QuantityCopy): string {
  if (row.variables.length > 0) return fillCopy(copy.viewer_quantity_omitted, { variables: row.variables.join(", ") });
  const registered = REFUSALS as Readonly<Record<string, { readonly message: string } | undefined>>;
  return row.codes.map((code) => registered[code]?.message ?? code).join(" ");
}

const SEPARATOR = " · ";

export function QuantityLegend({ copy, humanise, glyphs, Swatch, phase, overlay, toggles, faultId, onRetry, refusal, testIds }: QuantityLegendProps) {
  if (!toggles.quantities) return null;
  const legend = overlay === null ? { rows: [], bases: [] } : legendOf(overlay, toggles);
  const measured = legend.rows.filter((row) => row.measured > 0);
  const unmeasured = legend.rows.filter((row) => row.unmeasured > 0);

  const body = (): ReactNode => {
    if (phase === "refused") return refusal;
    if (phase === "loading" || phase === "idle") return <p className="cx-viewer-quantity-note" role="status">{copy.viewer_quantity_loading}</p>;
    if (phase === "failed")
      return (
        <div className="cx-viewer-quantity-failed" role="alert">
          <p className="cx-viewer-quantity-note">{copy.viewer_quantity_failed}</p>
          {faultId === null ? null : <p className="cx-viewer-quantity-note cx-viewer-quantity-mono">{fillCopy(copy.viewer_quantity_report_id, { id: faultId })}</p>}
          <button type="button" className="cx-viewer-quantity-retry cx-reticle" data-testid={testIds.retry} onClick={onRetry}>
            {copy.viewer_quantity_retry}
          </button>
        </div>
      );
    if (phase === "empty" || (measured.length === 0 && unmeasured.length === 0 && (overlay?.elsewhere.length ?? 0) === 0))
      return <p className="cx-viewer-quantity-note">{copy.viewer_quantity_empty}</p>;

    return (
      <>
        {measured.length === 0 ? null : (
          <>
            {/* L-QTY-07: what stands here is measured scope — the COMPLETE lines, per kind — never a grand total. */}
            <p className="cx-viewer-quantity-subhead" title={copy.viewer_quantity_measured_scope_note}>
              {copy.viewer_quantity_measured_scope}
            </p>
            <ul className="cx-viewer-quantity-rows">
              {measured.map((row) => (
                <li key={row.condition.key} className="cx-viewer-quantity-row" data-testid={testIds.row} data-condition={row.condition.key} data-measured={String(row.measured)}>
                  <Swatch colour={row.condition.colour} hatch={row.condition.hatch} />
                  <span className="cx-viewer-quantity-condition">{conditionWords(row, humanise)}</span>
                  <span className="cx-viewer-quantity-count">{`${SEPARATOR}${formatUserFigure(String(row.measured))}`}</span>
                  {row.totals.map((total) => (
                    <span key={`${total.kind}|${total.unit}`} className="cx-viewer-quantity-total" data-testid={testIds.total} data-kind={total.kind} data-unit={total.unit} data-value={total.value} data-lines={String(total.lines)}>
                      {SEPARATOR}
                      {row.totals.length > 1 ? `${kindWords(total.kind, humanise)} ` : ""}
                      <span className="cx-viewer-quantity-mono">{figureOf(total.value, total.kind)}</span> <span className="cx-viewer-quantity-unit">{total.unit}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
        {unmeasured.length === 0 ? null : (
          <>
            <p className="cx-viewer-quantity-subhead">{copy.viewer_quantity_unmeasured_heading}</p>
            <ul className="cx-viewer-quantity-rows">
              {unmeasured.map((row) => (
                <li key={row.condition.key} className="cx-viewer-quantity-row" data-testid={testIds.unmeasured} data-condition={row.condition.key} data-unmeasured={String(row.unmeasured)} data-codes={row.codes.join(" ")}>
                  <span className="cx-viewer-quantity-hatch" aria-hidden="true" />
                  <span className="cx-viewer-quantity-condition">{conditionWords(row, humanise)}</span>
                  <span className="cx-viewer-quantity-count">{`${SEPARATOR}${fillCopy(copy.viewer_quantity_unmeasured_count, { count: formatUserFigure(String(row.unmeasured)) })}`}</span>
                  <span className="cx-viewer-quantity-reason">{reasonOf(row, copy)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {legend.bases.length === 0 ? null : (
          <p className="cx-viewer-quantity-bases">
            <span className="cx-viewer-quantity-subhead">{copy.viewer_quantity_bases_heading}</span>
            {legend.bases.map((basis) => (
              <span key={basis} className="cx-viewer-quantity-basis" data-testid={testIds.basis} data-basis={basis} style={{ "--cx-basis": `var(--basis-${basis.toLowerCase()})` } as CSSProperties}>
                <span className="cx-viewer-quantity-glyph" aria-hidden="true">
                  {glyphs[basis]}
                </span>
                {humanise(basis)}
              </span>
            ))}
          </p>
        )}
        {(overlay?.elsewhere.length ?? 0) === 0 ? null : (
          <p className="cx-viewer-quantity-elsewhere" data-testid={testIds.elsewhere}>
            <span className="cx-viewer-quantity-subhead">{copy.viewer_quantity_elsewhere_heading}</span>
            {(overlay?.elsewhere ?? []).map((sheet) => (
              <span key={sheet.layoutName} className="cx-viewer-quantity-sheet" data-layout={sheet.layoutName}>
                {fillCopy(copy.viewer_quantity_elsewhere_row, { sheet: sheet.label, count: formatUserFigure(String(sheet.placements)) })}
              </span>
            ))}
          </p>
        )}
      </>
    );
  };

  return (
    <section className="cx-viewer-quantity-legend" aria-label={copy.viewer_quantity_legend_label} data-testid={testIds.legend} data-state={phase} data-rows={String(measured.length)} data-unmeasured-rows={String(unmeasured.length)}>
      <h2 className="cx-viewer-quantity-heading">{copy.viewer_quantity_legend_heading}</h2>
      {body()}
    </section>
  );
}
