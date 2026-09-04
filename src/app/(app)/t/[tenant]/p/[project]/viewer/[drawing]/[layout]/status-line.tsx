"use client";
/**
 * The sheet's readout (Decision § 1): the sheet's name, the camera's scale, how much of the sheet has
 * arrived and how much of it is drawn. It is the one place a journey and an operator read the
 * viewer's arithmetic from, and every figure in it renders through the figure seam (R-SPINE-010).
 *
 * The frame ledger is not rendered here: the painter writes `data-frame-median-ms` and
 * `data-frame-p95-ms` straight onto this element as frames are delivered, so a hundred frames of a
 * gesture cost no re-render (Decision § 7).
 */
import type { RefObject } from "react";
import { formatUserFigure } from "../../../../../../../../../core/format";
import { fill, strings } from "../../../../../../../../../ui/strings";

/** How many decimals the camera's pixels-per-unit is published at. */
const SCALE_DECIMALS = 3;

export type StatusLineProps = {
  statusRef: RefObject<HTMLDivElement | null>;
  layoutName: string;
  /** Whether there is a sheet under this readout at all — a refusal has no camera to report. */
  sheet: boolean;
  scale: number;
  loadedLayers: number;
  totalLayers: number;
  drawnEntities: number;
  entityCount: number;
  firstPaint: boolean;
  renderer: "webgl" | "unavailable";
  partial: boolean;
};

export function StatusLine({
  statusRef,
  layoutName,
  sheet,
  scale,
  loadedLayers,
  totalLayers,
  drawnEntities,
  entityCount,
  firstPaint,
  renderer,
  partial,
}: StatusLineProps) {
  return (
    <div
      ref={statusRef}
      className="cx-viewer-readout"
      data-testid="viewer-status"
      role="status"
      aria-live="polite"
      data-first-paint={String(firstPaint)}
      data-renderer={renderer}
      data-loaded-layers={loadedLayers}
      data-total-layers={totalLayers}
      data-entity-count={entityCount}
      data-drawn-entities={drawnEntities}
      data-scale={scale}
    >
      <span className="cx-viewer-readout-sheet">{layoutName}</span>
      {/* A sheet that was refused has no camera and no layers: the readout names the sheet asked for
          and says nothing else, rather than reporting a scale of zero as if it were measuring one. */}
      {sheet ? (
        <>
          <span className="cx-viewer-readout-cell">
            <span className="cx-viewer-readout-label">{strings.viewer_status_scale}</span>
            <span className="cx-viewer-readout-value">
              {fill(strings.viewer_status_scale_value, {
                scale: formatUserFigure(scale.toFixed(SCALE_DECIMALS)),
              })}
            </span>
          </span>
          <span className="cx-viewer-readout-cell">
            <span className="cx-viewer-readout-label">{strings.viewer_status_layers}</span>
            <span className="cx-viewer-readout-value">
              {fill(strings.viewer_status_layers_value, {
                loaded: formatUserFigure(String(loadedLayers)),
                total: formatUserFigure(String(totalLayers)),
              })}
            </span>
          </span>
          <span className="cx-viewer-readout-cell">
            <span className="cx-viewer-readout-label">{strings.viewer_status_entities}</span>
            <span className="cx-viewer-readout-value">
              {fill(strings.viewer_status_entities_value, {
                drawn: formatUserFigure(String(drawnEntities)),
                total: formatUserFigure(String(entityCount)),
              })}
            </span>
          </span>
        </>
      ) : null}
      {partial ? <span className="cx-viewer-readout-partial">{strings.viewer_status_partial}</span> : null}
    </div>
  );
}
