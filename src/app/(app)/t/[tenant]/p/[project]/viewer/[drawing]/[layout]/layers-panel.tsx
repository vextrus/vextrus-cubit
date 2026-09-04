"use client";
/**
 * The layers panel (Decision § 1): one row per layer of the manifest, in the manifest's own order,
 * each carrying the swatch the reading resolved, the layer's name verbatim and how many entities it
 * holds — and the three things a reader does to a layer: show it, isolate it, lock it.
 *
 * Visibility is a switch and carries the swatch as its whole visible content: filled when shown and
 * hollow when hidden, so the state survives greyscale as well as colour. A layer that failed to load
 * keeps its row and offers to fetch itself again — a sheet is not withdrawn because part of it is
 * missing (R-UI-050, Decision I-81).
 */
import type { LayerRow } from "../../../../../../../../../modules/takeoff/viewer/client";
import { formatUserFigure } from "../../../../../../../../../core/format";
import { Button } from "../../../../../../../../../ui/primitives/core";
import { fill, strings } from "../../../../../../../../../ui/strings";

export type LayersPanelProps = {
  rows: LayerRow[];
  onVisible: (name: string, visible: boolean) => void;
  onIsolate: (name: string) => void;
  onLock: (name: string, locked: boolean) => void;
  onRetry: (name: string) => void;
};

/** A layer's resolved colour, as a style value — artifact data, never a token (Decision § 1). */
function swatchColour(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

export function LayersPanel({ rows, onVisible, onIsolate, onLock, onRetry }: LayersPanelProps) {
  return (
    <section className="cx-viewer-layers" data-testid="viewer-layers" aria-label={strings.viewer_layers_heading}>
      <h2 className="cx-viewer-layers-heading">{strings.viewer_layers_heading}</h2>
      <ol className="cx-viewer-layer-list">
        {rows.map((row) => (
          <li
            key={row.name}
            className="cx-viewer-layer-row"
            data-testid="viewer-layer-row"
            data-layer={row.name}
            data-visible={String(row.visible)}
            data-drawn={String(row.drawn)}
            data-locked={String(row.locked)}
            data-isolated={String(row.isolated)}
            data-failed={String(row.failed)}
          >
            <button
              type="button"
              role="switch"
              aria-checked={row.visible}
              className="cx-viewer-layer-switch cx-reticle"
              data-testid="viewer-layer-visible"
              aria-label={fill(strings.viewer_layer_visible_label, { layer: row.name })}
              onClick={() => onVisible(row.name, !row.visible)}
            >
              <span
                className="cx-viewer-layer-swatch"
                data-testid="viewer-layer-swatch"
                aria-hidden="true"
                style={{ background: row.visible ? swatchColour(row.rgb) : "none", borderColor: swatchColour(row.rgb) }}
              />
            </button>

            <span className="cx-viewer-layer-name">{row.name}</span>

            {row.failed ? (
              <Button variant="ghost" className="cx-viewer-layer-retry" onClick={() => onRetry(row.name)}>
                {strings.viewer_layer_retry}
              </Button>
            ) : (
              <span
                className="cx-viewer-layer-count"
                data-testid="viewer-layer-count"
                aria-label={fill(strings.viewer_layer_count_label, { count: formatUserFigure(String(row.entityCount)), layer: row.name })}
              >
                {formatUserFigure(String(row.entityCount))}
              </span>
            )}

            <button
              type="button"
              aria-pressed={row.isolated}
              className="cx-viewer-layer-control cx-reticle"
              data-testid="viewer-layer-isolate"
              onClick={() => onIsolate(row.name)}
            >
              {strings.viewer_layer_isolate}
            </button>
            <button
              type="button"
              aria-pressed={row.locked}
              className="cx-viewer-layer-control cx-reticle"
              data-testid="viewer-layer-lock"
              onClick={() => onLock(row.name, !row.locked)}
            >
              {strings.viewer_layer_lock}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
