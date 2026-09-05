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
import { useState } from "react";
import { cssColour, type LayerRow } from "../../../../../../../../../modules/takeoff/viewer/client";
import { formatUserFigure } from "../../../../../../../../../core/format";
import { Button } from "../../../../../../../../../ui/primitives/core";
import { fill, strings } from "../../../../../../../../../ui/strings";

export type LayersPanelProps = {
  rows: LayerRow[];
  onVisible: (name: string, visible: boolean) => void;
  onIsolate: (name: string) => void;
  onLock: (name: string, locked: boolean) => void;
  onRetry: (name: string) => void;
  /** Take the whole layer — the keyboard path to a selection (Decision § 1). */
  onSelectLayer: (name: string) => void;
};

export function LayersPanel({ rows, onVisible, onIsolate, onLock, onRetry, onSelectLayer }: LayersPanelProps) {
  // Which row the keyboard is inside. The controls' reveal is the row's posture rather than a focus
  // style of this screen's own: the focus indicator has exactly one home (B-17, R-UI-012).
  const [active, setActive] = useState<string | null>(null);

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
            data-active={String(row.name === active)}
            onFocus={() => setActive(row.name)}
            onBlur={() => setActive(null)}
          >
            <button
              type="button"
              role="switch"
              aria-checked={row.visible}
              className="cx-viewer-layer-switch cx-reticle"
              data-testid="viewer-layer-visible"
              aria-label={fill(strings.viewer_layer_visible_label, {
                layer: row.name,
              })}
              onClick={() => onVisible(row.name, !row.visible)}
            >
              <span
                className="cx-viewer-layer-swatch"
                data-testid="viewer-layer-swatch"
                aria-hidden="true"
                style={{
                  background: row.visible ? cssColour(row.rgb) : "none",
                  borderColor: cssColour(row.rgb),
                }}
              />
            </button>

            <span className="cx-viewer-layer-name">{row.name}</span>

            {/* A layer that did not arrive keeps its count as well as its offer: the partial cell
                shows what is missing, and hiding the figure would hide the fact (R-UI-050). */}
            <span
              className="cx-viewer-layer-count"
              data-testid="viewer-layer-count"
              aria-label={fill(strings.viewer_layer_count_label, {
                count: formatUserFigure(String(row.entityCount)),
                layer: row.name,
              })}
            >
              {formatUserFigure(String(row.entityCount))}
            </span>
            {row.failed ? (
              <Button variant="ghost" className="cx-viewer-layer-retry" onClick={() => onRetry(row.name)}>
                {strings.viewer_layer_retry}
              </Button>
            ) : null}

            {/* Both controls carry the layer they act on: a sheet of N layers otherwise presents 2N
                buttons named alike, which no screen reader can tell apart (A-11Y). */}
            <button
              type="button"
              aria-pressed={row.isolated}
              className="cx-viewer-layer-control cx-reticle"
              data-testid="viewer-layer-isolate"
              aria-label={fill(strings.viewer_layer_isolate_label, {
                layer: row.name,
              })}
              onClick={() => onIsolate(row.name)}
            >
              {strings.viewer_layer_isolate}
            </button>
            <button
              type="button"
              aria-pressed={row.locked}
              className="cx-viewer-layer-control cx-reticle"
              data-testid="viewer-layer-lock"
              aria-label={fill(strings.viewer_layer_lock_label, {
                layer: row.name,
              })}
              onClick={() => onLock(row.name, !row.locked)}
            >
              {strings.viewer_layer_lock}
            </button>
            {/* A layer that is not drawn, or is locked out of the hit-test, has nothing a reader can
                see to select — and a selection nobody can see is a copyable list of ghosts (I-87). */}
            <button
              type="button"
              className="cx-viewer-layer-control cx-reticle"
              data-testid="viewer-layer-select"
              disabled={!row.drawn || row.locked}
              aria-label={fill(strings.viewer_layer_select_label, {
                layer: row.name,
              })}
              onClick={() => onSelectLayer(row.name)}
            >
              {strings.viewer_layer_select}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
