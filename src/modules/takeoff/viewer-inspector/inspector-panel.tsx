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
import { useEffect, useState, type ComponentType } from "react";
import { formatUserFigure } from "@/core/format";
import type { QuantityBasis } from "@/core/offers/law";
import type { IndexBox } from "../viewer/client";
import { INSPECTOR_COPY, TRACE_COPY, fillCopy, fillTrace } from "./copy";

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

/* ------------------------------------------------------ the Trace, both ways (R-UI-022, X-2) */

/** One live variable of a traced line's formula — the reading, as the drawing wrote it. */
export type TraceVariable = {
  readonly value: string;
  readonly unit: string;
  readonly basis: string;
  readonly source: string;
};

/** What the line the address named was measured as, as `takeoff.lineEvidence` answers it. */
export type TraceEvidence = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly kind: string;
  readonly value: string | null;
  readonly unit: string;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly sourceKeys: readonly string[];
  readonly formula: string;
  readonly variables: Readonly<Record<string, TraceVariable>>;
  readonly quantityBasis: QuantityBasis;
  readonly selectionBasis: string;
};

/**
 * The Trace block's whole state, as the screen's own read of the door leaves it: `ready` with the
 * evidence, `missing` where the project holds no line by that id — a fact about the address and
 * never a refusal (I-88's idiom) — and `failed` where the read faulted and may be made again.
 */
export type TraceBlock = {
  readonly state: "ready" | "missing" | "failed";
  /** The line the address named, carried in every state, because the address named it in every one. */
  readonly lineId: string;
  readonly evidence: TraceEvidence | null;
  /** `originAddress` for that line — the way back to the row it was traced from. */
  readonly originHref: string;
  readonly onRetry: () => void;
};

/** One line citing what is held, as `takeoff.linesCiting` answers one. */
export type CitedLine = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly kind: string;
  readonly value: string | null;
  readonly unit: string;
  readonly quantityBasis: QuantityBasis;
  /** `originAddress` for that line — where its own EvidenceLink goes back to. */
  readonly href: string;
};

/** The other direction of X-2: what the held selection is cited by. */
export type CitedBlock = {
  readonly state: "ready" | "failed";
  readonly lines: readonly CitedLine[];
};

/**
 * The two shipped renderers this panel is handed. `src/modules` may not import `src/ui` (ARCH-01)
 * and a screen may not re-implement a shipped primitive (B-17), so the basis chip and the Trace's
 * link arrive as chrome exactly as the register workspace's nine do (I-170).
 */
export type InspectorChrome = {
  readonly BasisChip: ComponentType<{ basis: QuantityBasis }>;
  readonly EvidenceLink: ComponentType<{ href: string; basis: QuantityBasis; label: string; "data-line"?: string }>;
};

export type InspectorPanelProps = {
  hover: HoverFact | null;
  selection: readonly SelectedEntity[];
  /** Keys an address named that this sheet does not hold — a fact, never a refusal (I-88). */
  missing: readonly string[];
  /** The shipped chrome, injected (I-170). */
  chrome: InspectorChrome;
  /** The line the address named, and how its reading stands — absent where it named none. */
  trace: TraceBlock | null;
  /** What cites the held selection — absent where nothing is held, or where nothing was asked. */
  cited: CitedBlock | null;
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

export function InspectorPanel({ hover, selection, missing, chrome, trace, cited, onCopy, onReveal, onClear }: InspectorPanelProps) {
  const { BasisChip, EvidenceLink } = chrome;
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
              onClick={() => onReveal()}
            >
              <span className="cx-btn-label">{INSPECTOR_COPY.viewer_inspector_reveal}</span>
            </button>
            <button type="button" className="cx-btn cx-reticle" data-variant="ghost" data-testid="viewer-inspector-clear" onClick={() => onClear()}>
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

        {/* The Trace, as R-UI-022 and X-2 ask for it: the formula the number was measured by, with
            every variable's live reading beside where it was read. It stands BESIDE the selection
            and never instead of it — what the address found stays held in all three cells (I-88). */}
        {trace === null ? null : (
          <section
            className="cx-viewer-trace"
            data-testid="viewer-inspector-trace"
            data-line={trace.lineId}
            data-basis={trace.evidence?.quantityBasis}
            data-state={trace.state}
          >
            <h3 className="cx-viewer-inspector-subheading">{TRACE_COPY.trace_heading}</h3>

            {trace.evidence === null ? (
              <p className="cx-viewer-inspector-body-line">{trace.state === "missing" ? TRACE_COPY.trace_missing : TRACE_COPY.trace_failed}</p>
            ) : (
              <>
                {/* The basis of the number that was traced, as glyph and word: the same pair the
                    register's cell wore and the same colour the sheet was struck in (R-UI-002). */}
                <p className="cx-viewer-trace-basis">
                  <BasisChip basis={trace.evidence.quantityBasis} />
                </p>

                <p className="cx-viewer-inspector-term">{TRACE_COPY.trace_formula_label}</p>
                {/* The line's own formula, verbatim and never re-spelled (I-25). */}
                <p className="cx-viewer-trace-formula" data-testid="viewer-inspector-trace-formula">
                  {trace.evidence.formula}
                </p>

                <p className="cx-viewer-inspector-term">{TRACE_COPY.trace_variables_label}</p>
                <ol className="cx-viewer-inspector-list cx-viewer-trace-variables">
                  {Object.entries(trace.evidence.variables).map(([name, binding]) => (
                    <li
                      className="cx-viewer-trace-variable"
                      data-testid="viewer-inspector-trace-variable"
                      data-name={name}
                      data-value={binding.value}
                      data-unit={binding.unit}
                      data-basis={binding.basis}
                      data-source={binding.source}
                      key={name}
                    >
                      <span className="cx-viewer-trace-name">{name}</span>
                      {/* Reading, unit, basis and the key it was read at — four facts of the
                          drawing, each shown as itself and none woven into a sentence (I-26). */}
                      <span className="cx-viewer-trace-reading">
                        {binding.value} {binding.unit}
                      </span>
                      <span className="cx-viewer-trace-basis-word">{binding.basis}</span>
                      <span className="cx-viewer-inspector-key">{binding.source}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {trace.state === "failed" ? (
              <button type="button" className="cx-btn cx-reticle" data-variant="secondary" data-testid="viewer-inspector-trace-retry" onClick={() => trace.onRetry()}>
                <span className="cx-btn-label">{TRACE_COPY.trace_retry}</span>
              </button>
            ) : null}

            {/* A plain anchor, so Back out of the sheet and this way back are the same kind of step
                (evidence-link I-178). It stands in every cell: a reader who followed a stale link
                came from a row all the same. */}
            <a className="cx-btn cx-reticle cx-viewer-trace-origin" data-variant="ghost" data-testid="viewer-inspector-trace-origin" href={trace.originHref}>
              <span className="cx-btn-label">{TRACE_COPY.trace_origin}</span>
            </a>
          </section>
        )}

        {/* X-2's other direction: the entities are held, and these are the lines that cite them.
            A selection nothing cites says so rather than vanishing (R-UI-050's counted empty). */}
        {cited === null || selection.length === 0 ? null : (
          <section className="cx-viewer-cited" data-testid="viewer-inspector-cited" data-state={cited.state} data-count={cited.lines.length}>
            <h3 className="cx-viewer-inspector-subheading">{TRACE_COPY.trace_cited_heading}</h3>
            <p className="cx-viewer-inspector-body-line">
              {cited.state === "failed"
                ? TRACE_COPY.trace_cited_failed
                : cited.lines.length === 0
                  ? TRACE_COPY.trace_cited_none
                  : fillTrace("trace_cited_count", { count: formatUserFigure(String(cited.lines.length)) })}
            </p>
            {cited.lines.length === 0 ? null : (
              <ol className="cx-viewer-inspector-list">
                {cited.lines.map((line) => (
                  <li
                    className="cx-viewer-cited-line"
                    data-testid="viewer-inspector-cited-line"
                    data-line={line.lineId}
                    data-basis={line.quantityBasis}
                    data-kind={line.kind}
                    key={line.lineId}
                  >
                    <span className="cx-viewer-cited-kind">{line.kind}</span>
                    <span className="cx-viewer-cited-figure">
                      {line.value ?? ""} {line.unit}
                    </span>
                    <EvidenceLink href={line.href} basis={line.quantityBasis} label={line.objectKey} data-line={line.lineId} />
                  </li>
                ))}
              </ol>
            )}
          </section>
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
