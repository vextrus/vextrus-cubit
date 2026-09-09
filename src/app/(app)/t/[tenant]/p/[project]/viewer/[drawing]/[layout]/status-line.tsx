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
import { formatUserFigure } from "@/core/format";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { fill, strings } from "@/ui/strings";
import { snapKindCopy } from "./snap-region";

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
  /** How many source keys are held. Always reported: a counted empty set (R-UI-050). */
  selectionCount: number;
  firstPaint: boolean;
  renderer: "webgl" | "unavailable";
  partial: boolean;
  /** The snapping region's two cells, where there is a sheet to snap on (Decision § 1). */
  snap?: UseSnap;
};

/**
 * What the snap cell says the pointer is meeting: the kind's own word and each source key whole, or
 * — told apart from one another — that nothing is in reach and that snapping is off (AC-2). Off and
 * empty-handed are two different answers, and neither is silence (R-UI-020).
 */
function SnapCell({ snap }: { snap: UseSnap }) {
  const met = snap.enabled ? snap.snap : null;
  const kind = !snap.enabled ? "off" : met === null ? "none" : met.kind;
  return (
    <span
      className="cx-viewer-readout-cell"
      data-testid="viewer-status-snap"
      aria-live="off"
      data-enabled={String(snap.enabled)}
      data-kind={kind}
      data-source={met === null ? "" : met.sourceKeys.join(" ")}
      data-key-x={met === null ? "" : met.keyPoint[0]}
      data-key-y={met === null ? "" : met.keyPoint[1]}
    >
      <span className="cx-viewer-readout-label">{strings.viewer_status_snap}</span>
      <span className="cx-viewer-readout-value">
        {!snap.enabled ? strings.viewer_status_snap_off : met === null ? strings.viewer_status_snap_none : snapKindCopy(met.kind)}
        {/* A source key is model data: it renders whole, verbatim and selectable, never woven into a
            sentence (I-26). */}
        {met === null
          ? null
          : met.sourceKeys.map((key) => (
              <span key={key} className="cx-viewer-snap-key">
                {key}
              </span>
            ))}
      </span>
    </span>
  );
}

/**
 * The distance between the picks: the drawing's own units always, and metres beside them — never
 * instead of them — once both picks stand inside one view an affirmation of record measures
 * (R-UI-041, I-146). An empty cell would be the silence R-UI-020 forbids, so each absence has its
 * own sentence.
 */
function DistanceCell({ snap }: { snap: UseSnap }) {
  const { distance, dx, dy, metres, picks, si, unread, viewKey } = snap.readout;
  return (
    <span
      className="cx-viewer-readout-cell"
      data-testid="viewer-status-distance"
      aria-live="off"
      data-picks={String(picks)}
      data-dx={String(dx)}
      data-dy={String(dy)}
      data-si={si}
      data-view-key={viewKey ?? undefined}
    >
      <span className="cx-viewer-readout-label">{strings.viewer_status_distance}</span>
      <span className="cx-viewer-readout-value">
        {distance === null ? strings.viewer_status_distance_none : fill(strings.viewer_status_distance_units, { distance: formatUserFigure(distance) })}
        {metres === null ? null : <span className="cx-viewer-snap-metres">{fill(strings.viewer_status_distance_metres, { metres: formatUserFigure(metres) })}</span>}
        {picks === 2 && si === "uncalibrated" ? <span className="cx-viewer-snap-note">{strings.viewer_status_distance_uncalibrated}</span> : null}
        {/* A calibration the feed could not answer costs the reader metres, never the sheet: the
            drawing-unit figure stands and the cell names the move (R-UI-050's partial). */}
        {unread ? <span className="cx-viewer-snap-note">{strings.viewer_status_calibration_unread}</span> : null}
      </span>
    </span>
  );
}

export function StatusLine({
  statusRef,
  layoutName,
  sheet,
  scale,
  loadedLayers,
  totalLayers,
  drawnEntities,
  entityCount,
  selectionCount,
  firstPaint,
  renderer,
  partial,
  snap,
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
      data-selection={selectionCount}
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
          {/* The zero form reads "0 selected": a counted empty set, never a hidden cell (§ 1). */}
          <span className="cx-viewer-readout-cell" data-testid="viewer-status-selection">
            <span className="cx-viewer-readout-label">{strings.viewer_status_selection}</span>
            <span className="cx-viewer-readout-value">
              {fill(strings.viewer_inspector_selected_count, {
                count: formatUserFigure(String(selectionCount)),
              })}
            </span>
          </span>
          {snap === undefined ? null : (
            <>
              <SnapCell snap={snap} />
              <DistanceCell snap={snap} />
            </>
          )}
        </>
      ) : null}
      {partial ? <span className="cx-viewer-readout-partial">{strings.viewer_status_partial}</span> : null}
    </div>
  );
}
