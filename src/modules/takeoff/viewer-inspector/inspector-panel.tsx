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
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { isKind } from "@/core/catalogue/kinds";
import { inWords, placesOf } from "@/core/documents/kinds/boq-draft-law";
import { dhakaDateParts, formatDate, formatMoney, formatUserFigure } from "@/core/format";
import { readCitedKey } from "@/core/identity/keys";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import { parseSourceKey } from "@/core/sources";
import { statedAt } from "../bbs-ui/present";
import { variableReading } from "../viewer-measure/words";
import type { LineMember, LineOmission, SourceLink } from "../trace/address";
import type { IndexBox } from "../viewer/client";
import { INSPECTOR_COPY, TRACE_COPY, fillCopy, fillTrace } from "./copy";

/** The element the panel's heading names it by. */
const TITLE_ID = "cx-viewer-inspector-title";

/** What the panel is told about the entity under the pointer. */
export type HoverFact = {
  readonly key: string;
  readonly type: string;
  readonly layer: string;
};

/**
 * One selected entity, as the panel lists and copies it. A text carries what it SHOWS — the drawing's
 * own words with their control codes resolved (`@/core/entitygraph/text`) — so a note a figure was
 * traced to is read here, not only named by its type and handle (B08, I-465).
 */
export type SelectedEntity = HoverFact & { readonly box: IndexBox; readonly text?: string };

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
  /** The class it was measured under, and the member it was measured off, if the register holds one. */
  readonly elementClass: string;
  readonly member: LineMember | null;
  readonly kind: string;
  readonly value: string | null;
  /** What a line kept with no quantity left out (L-QTY-02). */
  readonly omitted: readonly LineOmission[];
  readonly unit: string;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly traceKeys: readonly string[];
  /** The sheet each cited key stands on, and how a reader names each such sheet (VD-1, VD-2). */
  readonly sourceSheets: Readonly<Record<string, string | null>>;
  readonly sheetLabels: Readonly<Record<string, string>>;
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
  /** Where each key the line cites can be followed to, by the key as cited (`sourceLinksOf`, I-553). */
  readonly sources: Readonly<Record<string, SourceLink>>;
  readonly onRetry: () => void;
};

/** One line citing what is held, as `takeoff.linesCiting` answers one. */
export type CitedLine = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly elementClass: string;
  readonly member: LineMember | null;
  readonly kind: string;
  readonly value: string | null;
  readonly omitted: readonly LineOmission[];
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
  /** R-UI-082's identifier: a key is shown short, whole in `data-value`, one press from the clipboard. */
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  /** A model value said in words, the SCREAMING form kept inside its technical disclosure (§6). */
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  /** A figure in the face a figure is read in, grouped by the format seam, with its unit badge. */
  readonly QuantityText: ComponentType<{ value: string; unit?: string; format?: FigureFormat; className?: string; "data-testid"?: string }>;
  /** The ids VD-2's elements publish, read from `src/ui/testids.ts` by the screen (AM-09 §1, ARCH-01). */
  readonly testIds: InspectorTestIds;
};

/**
 * THE IDS THIS PANEL PUBLISHES THAT IT MAY NOT SPELL: the registry is `src/ui/testids.ts`, which a
 * module may not import (ARCH-01), so they arrive as chrome — the register's `RegisterTestIds` idiom —
 * and the literal ids below them stay frozen by the ratchet (tests/lint/testid-registry-ratchet).
 */
export type InspectorTestIds = {
  readonly traceLine: string;
  readonly traceFigure: string;
  readonly traceSource: string;
  readonly missingCount: string;
  readonly missingSheet: string;
};

/** SEAM-FORMAT's conventions, as the figure primitive takes them (`src/ui` may not call the seam). */
type FigureFormat = { figure: (value: string) => string; money: (amount: string) => string; date: (at: Date) => string };

/** The figures as the drawing and the store hold them: grouped by the seam, the digits their own (B-07). */
const FIGURES: FigureFormat = Object.freeze({
  figure: formatUserFigure,
  money: formatMoney,
  date: (at: Date): string => formatDate(dhakaDateParts(at)),
});

/** One format per kind, held, so a figure's format keeps its identity across renders. */
const FIGURES_OF_KIND = new Map<string, FigureFormat>();

/**
 * A line's figure at the places its kind is written to — the places the register's cell and the draft
 * BOQ state it at (s-takeoff I-reg-2) — with the exact value kept whole in `data-value`.
 */
function figuresOfKind(kind: string): FigureFormat {
  if (!isKind(kind)) return FIGURES;
  const held = FIGURES_OF_KIND.get(kind);
  if (held !== undefined) return held;
  const places = placesOf(kind);
  const made: FigureFormat = Object.freeze({ ...FIGURES, figure: (value: string): string => formatUserFigure(statedAt(value, places)) });
  FIGURES_OF_KIND.set(kind, made);
  return made;
}

/** What a traced or citing line is, in a quantity surveyor's words: `C4 · GF · Column concrete` (I-552). */
export function lineWordsOf(line: { readonly member: LineMember | null; readonly elementClass: string; readonly kind: string }): string {
  const description = fillTrace("trace_line_description", { class: inWords(line.elementClass), kind: inWords(line.kind).toLowerCase() });
  const parts = [line.member?.mark ?? "", line.member?.level ?? "", description].filter((part) => part !== "");
  return parts.join(" · ");
}

/**
 * The short form a key is shown by in its IdChip: the handle of a source key (`9DC`), the mark of a
 * placement (`C1`), else the chip's own leading characters. The whole key stays in `data-value`.
 */
function keyShortOf(key: string): string | undefined {
  if (parseSourceKey(key) !== null) return handleOf(key);
  const cited = readCitedKey(key);
  if (cited.scheme === "placement" || cited.scheme === "bars") {
    const mark = key.split("|")[1];
    if (mark !== undefined && mark !== "") return mark;
  }
  return undefined;
}

/**
 * Whether a variable was read off a hand trace: its source is the act that measured it (`act:`,
 * I-619), which the block says in words beside the sheet it was traced on (s-measure I-662).
 */
export function isHandSource(key: string): boolean {
  return readCitedKey(key).scheme === "act";
}

/** The basis a reading wears on its link: its own where it states a registered one, else the line's. */
function basisOf(stated: string, fallback: QuantityBasis): QuantityBasis {
  return (QUANTITY_BASES as readonly string[]).includes(stated) ? (stated as QuantityBasis) : fallback;
}

/**
 * A line's figure, or — for a line kept with no quantity — what it left out, never a bare unit and
 * never a zero (L-QTY-02, walk-1 B15): `0.405 m³`, `lap, ties unstated`, `No figure`.
 */
function LineFigure({
  line,
  QuantityText,
}: {
  line: { readonly value: string | null; readonly unit: string; readonly kind: string; readonly omitted: readonly LineOmission[] };
  QuantityText: InspectorChrome["QuantityText"];
}): ReactNode {
  if (line.value !== null) return <QuantityText value={line.value} unit={line.unit} format={figuresOfKind(line.kind)} />;
  const variables = [...new Set(line.omitted.map((omission) => omission.variable))];
  const codes = [...new Set(line.omitted.map((omission) => omission.code))];
  return (
    <span className="cx-viewer-trace-omitted" data-omitted={codes.join(" ")}>
      {variables.length === 0 ? TRACE_COPY.trace_figure_unstated : fillTrace("trace_figure_omitted", { variables: variables.join(", ") })}
    </span>
  );
}

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

/**
 * The handle alone: what follows the scheme in a source key of ANY registered scheme — a DXF handle,
 * a PDF object, a raster trace (L-CAD-02) — or the key itself where it is of none, never taken apart
 * on a guess (I-234).
 */
function handleOf(key: string): string {
  const parsed = parseSourceKey(key);
  return parsed === null ? key : parsed.slice(parsed.indexOf(":") + 1);
}

export function InspectorPanel({ hover, selection, missing, chrome, trace, cited, onCopy, onReveal, onClear }: InspectorPanelProps) {
  const { BasisChip, EvidenceLink, IdChip, EnumLabel, QuantityText, testIds } = chrome;
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
    // `data-rendered-region` is this panel SAYING that its `data-state` is the rendered contract
    // the journey lane reads (tests/e2e/support/settled.ts). It is truthful here and it is not a
    // decoration: `state`, `data-count` and the `<ol>` below are all derived from the same
    // `selection` in the same commit, so a reader that has seen `data-state="selected"` is looking
    // at a DOM that already holds every row of that selection. Without it, every read inside this
    // panel fell back to three agreeing readings per element — 600 rows × 3 round trips was 330 s
    // of J-011's 366 (v22 speed-j011).
    <aside
      className="cx-viewer-inspector"
      data-testid="viewer-inspector"
      aria-labelledby={TITLE_ID}
      data-rendered-region
      data-state={state}
      data-count={selection.length}
    >
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
                {/* The drawing's own words, verbatim as the sheet shows them (I-25), whole (I-26). */}
                {entity.text === undefined ? null : <p className="cx-viewer-inspector-text">{entity.text}</p>}
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
                {/* The line as a quantity surveyor checks it: the member, its storey and what was
                    measured, then the figure — `C4 · GF · Column concrete  0.405 m³` (I-552). */}
                <p className="cx-viewer-trace-line" data-testid={testIds.traceLine} data-object={trace.evidence.objectKey}>
                  <span className="cx-viewer-trace-member">{lineWordsOf(trace.evidence)}</span>
                  <span className="cx-viewer-trace-figure" data-testid={testIds.traceFigure}>
                    <LineFigure line={trace.evidence} QuantityText={QuantityText} />
                  </span>
                </p>
                {/* The basis of the number that was traced, as glyph and word: the same pair the
                    register's cell wore and the same colour the sheet was struck in (R-UI-002). The
                    object's key is an identifier and renders as one, never as body text (R-UI-082). */}
                <p className="cx-viewer-trace-basis">
                  <BasisChip basis={trace.evidence.quantityBasis} />
                  <IdChip value={trace.evidence.objectKey} short={keyShortOf(trace.evidence.objectKey)} />
                </p>

                <p className="cx-viewer-inspector-term">{TRACE_COPY.trace_formula_label}</p>
                {/* The line's own formula, verbatim and never re-spelled (I-25). */}
                <p className="cx-viewer-trace-formula" data-testid="viewer-inspector-trace-formula">
                  {trace.evidence.formula}
                </p>

                <p className="cx-viewer-inspector-term">{TRACE_COPY.trace_variables_label}</p>
                <ol className="cx-viewer-inspector-list cx-viewer-trace-variables">
                  {Object.entries(trace.evidence.variables).map(([name, binding]) => {
                    const link = trace.sources[binding.source];
                    const basis = basisOf(binding.basis, (trace.evidence as TraceEvidence).quantityBasis);
                    return (
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
                      {/* Reading, unit, basis and where it was read — four facts of the drawing,
                          each shown as itself and none woven into a sentence (I-26). The reading is
                          the drawing's own, digits whole, grouped by the seam. */}
                      <span className="cx-viewer-trace-reading">
                        {/* An area traced in square millimetres is read in square metres at three
                            places (s-measure I-662); the exact reading stays on the row. */}
                        {((read) => <QuantityText value={read.value} unit={read.unit} format={FIGURES} />)(variableReading(binding.value, binding.unit))}
                      </span>
                      <span className="cx-viewer-trace-basis-word">{binding.basis === "" ? null : <EnumLabel value={binding.basis} />}</span>
                      {/* The sheet it was read on, one click away — the schedule cell on S-11, the
                          level note on S-25 (I-553) — and the key itself only as an identifier. */}
                      <span className="cx-viewer-trace-source">
                        {link === undefined ? null : (
                          <span className="cx-viewer-trace-source-link" data-testid={testIds.traceSource} data-sheet={link.sheet}>
                            <EvidenceLink href={link.href} basis={basis} label={link.sheet} />
                          </span>
                        )}
                        {binding.source === "" ? null : isHandSource(binding.source) ? (
                          <span className="cx-viewer-trace-source-hand">{TRACE_COPY.trace_source_hand}</span>
                        ) : (
                          <IdChip value={binding.source} short={keyShortOf(binding.source)} />
                        )}
                      </span>
                    </li>
                    );
                  })}
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
                    {/* The row names its line as the register's row does — member, storey, what was
                        measured — and its figure; the object key is an identifier chip (walk-1 B15). */}
                    <EvidenceLink href={line.href} basis={line.quantityBasis} label={lineWordsOf(line)} data-line={line.lineId} />
                    <span className="cx-viewer-cited-figure">
                      <LineFigure line={line} QuantityText={QuantityText} />
                    </span>
                    <IdChip value={line.objectKey} short={keyShortOf(line.objectKey)} />
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
            {/* R-UI-050's partial: the cell counts what it lacks, and where a key the Trace answered
                stands on another sheet, it names that sheet and opens it (I-553). */}
            <p className="cx-viewer-inspector-body-line" data-testid={testIds.missingCount} data-count={missing.length}>
              {fillCopy("viewer_inspector_missing_count", { count: formatUserFigure(String(missing.length)) })}
            </p>
            <ol className="cx-viewer-inspector-list" data-testid="viewer-inspector-missing">
              {missing.map((key) => {
                const elsewhere = trace?.sources[key];
                return (
                  <li className="cx-viewer-inspector-missing-key" data-testid="viewer-inspector-missing-key" data-key={key} data-sheet={elsewhere?.sheet} key={key}>
                    {/* The key a stale link named is all that names what is lacking, so it is shown
                        whole here (I-26) — the one place a key is read as the subject of a row. */}
                    <span className="cx-viewer-inspector-missing-value">{key}</span>
                    {elsewhere === undefined ? null : (
                      <span className="cx-viewer-inspector-missing-sheet" data-testid={testIds.missingSheet} data-sheet={elsewhere.sheet}>
                        <EvidenceLink
                          href={elsewhere.href}
                          basis={trace?.evidence?.quantityBasis ?? "MEASURED"}
                          label={fillCopy("viewer_inspector_missing_elsewhere", { sheet: elsewhere.sheet })}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
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
