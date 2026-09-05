"use client";
/**
 * S-Viewer's right inspector (docs/design/s-viewer-inspector.md § 1): what is under the pointer, what
 * is held, the keys a link named that this sheet does not hold, and the two doors that act on a
 * selection.
 *
 * It renders the state it is handed and decides nothing about the sheet: the screen owns the camera,
 * the index and the clipboard, so this panel takes `window.location` and never a router and mounts
 * bare in a jsdom (Decision § 7). Every value the drawing supplied — a type, a layer name, a handle,
 * a source key — is shown verbatim as data and never woven into a sentence (I-25, I-26).
 *
 * Chrome comes from the shipped classes rather than from the core Button component: `src/modules`
 * imports core and its own module only (ARCH-01), and `.cx-btn` / `.cx-reticle` / `.cx-viewer-hidden`
 * are the tree's one home for a button's look, the focus reticle and the hidden-but-spoken
 * mechanism — the same borrowing the viewer's own empty-state door makes (B-17).
 */
import { useEffect, useState } from "react";
import { formatUserFigure } from "../../../core/format";
import type { IndexBox } from "../viewer/client";
import { INSPECTOR_COPY, fillCopy } from "./copy";

/** The scheme a source key of a DXF reading carries; the handle is what follows it (L-CAD-03). */
const SCHEME = "DXF_HANDLE:";

/** The element the panel's heading names it by. */
const TITLE_ID = "cx-viewer-inspector-title";

/** What the panel is told about the entity under the pointer. */
export type HoverFact = {
  readonly key: string;
  readonly type: string;
  readonly layer: string;
};

/** One selected entity, as the panel lists and copies it. */
export type SelectedEntity = HoverFact & { readonly box: IndexBox };

export type InspectorPanelProps = {
  hover: HoverFact | null;
  selection: readonly SelectedEntity[];
  /** Keys an address named that this sheet does not hold — a fact, never a refusal (I-88). */
  missing: readonly string[];
  /** The screen writes the key to the clipboard; a row says it is copied once that has been done. */
  onCopy: (key: string) => Promise<void>;
  onReveal: () => void;
  onClear: () => void;
};

/** `minx,miny,maxx,maxy` in world units — the spelling a selection row publishes its box in. */
function bboxAttribute(box: IndexBox): string {
  return [box.min[0], box.min[1], box.max[0], box.max[1]].join(",");
}

/** The handle alone: what follows the scheme in a source key, or the key itself under another one. */
function handleOf(key: string): string {
  return key.startsWith(SCHEME) ? key.slice(SCHEME.length) : key;
}

export function InspectorPanel({ hover, selection, missing, onCopy, onReveal, onClear }: InspectorPanelProps) {
  /** Which row holds the copied key. At most one does: the clipboard holds one key (Decision § 1). */
  const [copied, setCopied] = useState<string | null>(null);
  const held = selection.map((entity) => entity.key).join(",");

  // What was copied is a fact about the clipboard, not a flash, so it is never on a timer — but it
  // stops being true of this list when the list changes underneath it.
  useEffect(() => {
    setCopied(null);
  }, [held]);

  const state = selection.length > 0 ? "selected" : hover === null ? "idle" : "hover";

  return (
    <aside className="cx-viewer-inspector" data-testid="viewer-inspector" aria-labelledby={TITLE_ID} data-state={state} data-count={selection.length}>
      <h2 className="cx-viewer-inspector-heading" id={TITLE_ID}>
        {INSPECTOR_COPY.viewer_inspector_heading}
      </h2>

      <div className="cx-viewer-inspector-body">
        {/* Reading under the pointer is not a change of what you hold: the hover stands above a
            selection and never displaces it (Decision § 1). */}
        {hover === null ? null : (
          <dl className="cx-viewer-inspector-hover" data-testid="viewer-inspector-hover" data-key={hover.key}>
            <dt className="cx-viewer-inspector-term">{INSPECTOR_COPY.viewer_inspector_hover_type}</dt>
            <dd className="cx-viewer-inspector-value" data-testid="viewer-inspector-hover-type">
              {hover.type}
            </dd>
            <dt className="cx-viewer-inspector-term">{INSPECTOR_COPY.viewer_inspector_hover_layer}</dt>
            <dd className="cx-viewer-inspector-value" data-testid="viewer-inspector-hover-layer">
              {hover.layer}
            </dd>
            <dt className="cx-viewer-inspector-term">{INSPECTOR_COPY.viewer_inspector_hover_handle}</dt>
            <dd className="cx-viewer-inspector-value" data-testid="viewer-inspector-hover-handle">
              {handleOf(hover.key)}
            </dd>
          </dl>
        )}

        {/* The summary is sticky: a whole layer selected must never scroll the Reveal door out of
            reach. The count is stated at zero too — a counted empty set (R-UI-050). */}
        <div className="cx-viewer-inspector-actions">
          <p className="cx-viewer-inspector-count">
            {fillCopy("viewer_inspector_selected_count", { count: formatUserFigure(String(selection.length)) })}
          </p>
          <div className="cx-viewer-inspector-doors">
            <button
              type="button"
              className="cx-btn cx-reticle"
              data-variant="secondary"
              data-testid="viewer-inspector-reveal"
              disabled={selection.length === 0}
              onClick={onReveal}
            >
              <span className="cx-btn-label">{INSPECTOR_COPY.viewer_inspector_reveal}</span>
            </button>
            <button type="button" className="cx-btn cx-reticle" data-variant="ghost" data-testid="viewer-inspector-clear" onClick={onClear}>
              <span className="cx-btn-label">{INSPECTOR_COPY.viewer_inspector_clear}</span>
            </button>
          </div>
        </div>

        {selection.length === 0 ? null : (
          <ol className="cx-viewer-inspector-list" data-testid="viewer-inspector-selection">
            {selection.map((entity) => (
              <li
                className="cx-viewer-inspector-entity"
                data-testid="viewer-inspector-entity"
                data-key={entity.key}
                data-type={entity.type}
                data-layer={entity.layer}
                data-bbox={bboxAttribute(entity.box)}
                key={entity.key}
              >
                <p className="cx-viewer-inspector-facts">
                  <span className="cx-viewer-inspector-type">{entity.type}</span>
                  <span className="cx-viewer-inspector-layer">{entity.layer}</span>
                </p>
                <div className="cx-viewer-inspector-key-line">
                  {/* Spoken, never seen: a bare mono string is not announced naked (Decision § 3). */}
                  <span className="cx-viewer-hidden">{INSPECTOR_COPY.viewer_inspector_key}</span>
                  <span className="cx-viewer-inspector-key" data-testid="viewer-inspector-key">
                    {entity.key}
                  </span>
                  <button
                    type="button"
                    className="cx-btn cx-reticle cx-viewer-inspector-copy"
                    data-variant="ghost"
                    data-testid="viewer-inspector-copy"
                    data-copied={String(copied === entity.key)}
                    aria-label={fillCopy("viewer_inspector_copy_label", { key: entity.key })}
                    onClick={() => {
                      // The screen owns the clipboard and any fault it raises (ARCH-03); this row
                      // claims to hold the copied key only once that write has been made, and goes
                      // back to offering the copy when it could not be.
                      void onCopy(entity.key).then(
                        () => setCopied(entity.key),
                        () => setCopied(null),
                      );
                    }}
                  >
                    <span className="cx-btn-label">
                      {copied === entity.key ? INSPECTOR_COPY.viewer_inspector_copied : INSPECTOR_COPY.viewer_inspector_copy}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* The partial cell: a link may be older than the sheet, and a reader is owed the news
            rather than a shorter selection than they asked for (I-88, R-UI-050). */}
        {missing.length === 0 ? null : (
          <section className="cx-viewer-inspector-missing">
            <h3 className="cx-viewer-inspector-subheading">{INSPECTOR_COPY.viewer_inspector_missing_heading}</h3>
            <p className="cx-viewer-inspector-body-line">{INSPECTOR_COPY.viewer_inspector_missing_body}</p>
            <ol className="cx-viewer-inspector-list" data-testid="viewer-inspector-missing">
              {missing.map((key) => (
                <li className="cx-viewer-inspector-missing-key" data-testid="viewer-inspector-missing-key" data-key={key} key={key}>
                  {key}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* The state that teaches, and its action is a gesture on the sheet: naming one of the three
            in a button here could only describe one of them (Decision § 1). */}
        {state === "idle" ? (
          <div className="cx-viewer-inspector-idle">
            <p className="cx-viewer-inspector-subheading">{INSPECTOR_COPY.viewer_inspector_idle_heading}</p>
            <p className="cx-viewer-inspector-body-line">{INSPECTOR_COPY.viewer_inspector_idle_body}</p>
          </div>
        ) : null}
      </div>

      {/* One region for the whole panel, not one per row: a reader who cannot see the button change
          is told once that the key is on the clipboard (Decision § 1, R-UI-012). */}
      <p className="cx-viewer-hidden" role="status" aria-live="polite">
        {copied === null ? "" : INSPECTOR_COPY.viewer_inspector_copied}
      </p>
    </aside>
  );
}
