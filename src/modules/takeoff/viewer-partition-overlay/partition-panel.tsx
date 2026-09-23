"use client";
/**
 * S-Viewer's views/grid panel (docs/design/s-viewer-partition.md § 1): every view of the drawing's
 * current partition with the type spelling the store holds, every georeferenced axis, every layout
 * plan that georeferenced as deferred, and the two switches that gate the paint.
 *
 * It renders the state it is handed and decides nothing about the sheet: the feed, the camera, the
 * act and the address are all the screen's. Chrome comes from the shipped classes rather than the
 * core components — `src/modules` imports core and its own module only (ARCH-01), and `.cx-badge`,
 * `.cx-btn`, `.cx-skeleton`, `.cx-reticle` and `.cx-viewer-hidden` are the tree's one home for each
 * of those looks — the same borrowing the inspector beside it makes (B-17).
 *
 * The one offer and the one refusal arrive as slots: `OfferedGroups`, `ConsequenceDialog` and
 * `RefusalState` live in `src/ui`, so the screen mounts them and hands them in rather than this
 * module growing a second answer to who chose the subjects (L-ACT-02, R-UI-020).
 *
 * A stored reason is a fact about a VIEW, never an answer to this reader (I-111): an `UNTYPED` row
 * says the register's own sentence for the code the store holds, and nothing was refused of the
 * person who opened the sheet. It says it on the hatched badge, not as a paragraph under every row
 * (R-UI-081, I-111 as amended): ten untyped views were ten copies of one 88-character sentence.
 *
 * THIS SHEET FIRST (I-319). A drawing's partition is the drawing's, and a paper sheet shows one or
 * two of its views: F-RCC6-BNBC's S-10 listed 54 rows, 53 of them "Not on this sheet", and the one
 * view on it ninth, under the fold. The views, axes and deferrals standing on this sheet are listed
 * first; what stands on other sheets is folded under one disclosure that says how many.
 */
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { quantise } from "@/core/identity/keys";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { PARTITION_COPY, fillCopy } from "./copy";
import type { OverlayToggles, PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "./types";
import type { GridDeferralRow } from "@/modules/takeoff/partition";
import type { ComponentType, ReactNode } from "react";

import "./viewer-partition.css";

/** The element the panel's heading names it by, and the region a journey moves focus to. */
const TITLE_ID = "cx-viewer-partition-title";

/** The bones the body stands in while the partition is in flight (Decision § 2, R-UI-004). */
const LOADING_BONES = 3;

/** What the panel is showing, as its `data-state` publishes it (R-UI-050). */
export type PartitionPanelState = "loading" | "ready" | "empty" | "failed" | "refused";

export type PartitionPanelProps = {
  state: PartitionPanelState;
  overlay: PartitionOverlay | null;
  toggles: OverlayToggles;
  onToggle: (which: keyof OverlayToggles, on: boolean) => void;
  onRetry: () => void;
  /** The id a fault answer carried, so a reader can quote it; null where it carried none. */
  faultId: string | null;
  /** The one shipped `OfferedGroups`, mounted by the screen (ARCH-01) — or nothing to offer. */
  groups: ReactNode;
  /** The region's answer slot: one RefusalState — the feed's or the act's — or the offline notice,
      or nothing. In the `refused` state it stands in the body's place; otherwise beside the offer. */
  answer: ReactNode;
  /**
   * The shipped IdChip, handed in by the screen (ARCH-01: a module reaches no primitive of its own):
   * a view key is an identifier and renders through it, the anchor's handle as the measure and the
   * whole key as the value (I-190). Without one — a jsdom mount — the key stands whole in mono.
   */
  IdChip?: ComponentType<{ value: string; short?: string }>;
  /**
   * The shipped EnumLabel, handed in the same way (R-UI-082, I-114 as amended): a view's stored type
   * is an enum, and the badge says it in a reader's words with the stored spelling kept in its
   * technical disclosure. Without one the badge says the stored spelling itself.
   */
  EnumLabel?: ComponentType<{ value: string; label?: string; className?: string }>;
  /** EnumLabel's one rule for words, for the places a type is said inside a sentence ("Proposed as Detail"). */
  humaniseEnum?: (value: string) => string;
  /**
   * The shipped Tooltip (R-UI-010), where an untyped view's badge says its stored reason on hover and
   * focus (I-111 as amended). Without one the reason stays with the row for assistive technology alone.
   */
  Tooltip?: ComponentType<{ content: ReactNode; children: ReactNode }>;
};

/** The chrome a row renders through — the screen's, handed down whole. */
type RowChrome = Pick<PartitionPanelProps, "IdChip" | "EnumLabel" | "humaniseEnum" | "Tooltip">;

/** The measure a view key shows on its chip: its last segment, the anchor's own handle. */
function keyMeasure(viewKey: string): string | undefined {
  const at = viewKey.lastIndexOf(":");
  return at > 0 && at < viewKey.length - 1 ? viewKey.slice(at + 1) : undefined;
}

/** One view key, through the chip where the screen handed one and whole otherwise. */
function ViewKey({ viewKey, IdChip }: { viewKey: string; IdChip?: ComponentType<{ value: string; short?: string }> }) {
  return IdChip === undefined ? <span className="cx-viewer-partition-key">{viewKey}</span> : <IdChip short={keyMeasure(viewKey)} value={viewKey} />;
}

/**
 * A stored measurement as a decimal string, whole — the value an attribute a machine reads carries.
 *
 * `String(value)` is the shortest text that round-trips a double, but for a magnitude near zero or
 * very large it is written with an exponent — `1.2e-17` — and an exponent is not a decimal. A grid
 * position derived from a ring's own geometry lands there whenever an axis stands at the origin, so
 * the exponent is written out positionally here. Nothing is rounded, padded or dropped: this is the
 * EXACT value, and it rides on the row's `data-position` beside the figure the row states (I-363).
 */
function decimalOf(value: number): string {
  const written = String(value);
  const at = written.indexOf("e");
  if (at < 0) return written;
  const exponent = Number(written.slice(at + 1));
  const sign = written.startsWith("-") ? "-" : "";
  const digits = written.slice(sign.length, at).replace(".", "");
  const point = written.slice(sign.length, at).indexOf(".");
  // Where the decimal point stands once the exponent is spent: left of every digit for a magnitude
  // below one, right of the last for a whole number too long to write in place.
  const shift = (point < 0 ? digits.length : point) + exponent;
  if (shift <= 0) return `${sign}0.${"0".repeat(-shift)}${digits}`;
  if (shift >= digits.length) return `${sign}${digits}${"0".repeat(shift - digits.length)}`;
  return `${sign}${digits.slice(0, shift)}.${digits.slice(shift)}`;
}

/**
 * The register's own sentence for the code a row carries, or nothing at all where it carries none.
 *
 * The taxonomy is closed (R-SPINE-062), so a code the register does not hold is a store the product
 * has outgrown rather than a reader's problem: the row says the token the store holds — the one thing
 * a reader can quote and a journey can act on — instead of an empty sentence. A row that holds no
 * code at all renders no paragraph: an empty element is the silence R-UI-020 forbids, not a cure for
 * it, and the row's own type badge is already the fact it has to give.
 */
function messageOf(code: string | null): string | null {
  if (code === null) return null;
  return Object.hasOwn(REFUSALS, code) ? REFUSALS[code as RefusalCode].message : code;
}

/** One switch: a swatch that fills when it is on — the second, non-colour channel (R-UI-060). */
function OverlaySwitch({ testId, label, on, onFlip }: { testId: string; label: string; on: boolean; onFlip: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="cx-viewer-partition-switch cx-reticle" data-testid={testId} onClick={() => onFlip(!on)}>
      <span className="cx-viewer-partition-swatch" data-filled={String(on)} aria-hidden="true" />
      <span className="cx-viewer-partition-switch-label">{label}</span>
    </button>
  );
}

/**
 * One view's stored type, as its badge says it. I-114 as amended: the badge is still the STORE's
 * reading, before and after a confirmation — the grammar's word is never overwritten in front of a
 * reader — but it is said in a reader's words through the one EnumLabel (R-UI-082), the stored
 * spelling kept in its technical disclosure and on the row's `data-type`.
 *
 * An untyped view's badge is where its stored reason is said (I-111 as amended): on hover and focus,
 * through the one Tooltip, so the badge is then a button a keyboard reaches — never a paragraph
 * under the row.
 */
function TypeBadge({ view, untyped, reason, EnumLabel, Tooltip }: { view: PartitionOverlayView; untyped: boolean; reason: string | null } & RowChrome) {
  const badge = (
    <span className="cx-badge cx-viewer-partition-badge" data-testid="viewer-partition-view-badge" data-untyped={String(untyped)}>
      {EnumLabel === undefined ? view.type : <EnumLabel value={view.type} className="cx-viewer-partition-type" />}
    </span>
  );
  if (!untyped || reason === null || Tooltip === undefined) return badge;
  return (
    <Tooltip content={reason}>
      <button type="button" className="cx-viewer-partition-badge-trigger cx-reticle">
        {badge}
      </button>
    </Tooltip>
  );
}

/** One stored view: its badge, its key, its caption, what it holds, and the reason it carries. */
function ViewRow({ view, IdChip, EnumLabel, humaniseEnum, Tooltip }: { view: PartitionOverlayView } & RowChrome) {
  const untyped = view.type === VIEW_TYPE.UNTYPED;
  const onSheet = view.box !== null;
  const reason = untyped ? messageOf(view.reason) : null;
  const said = (type: string): string => (humaniseEnum === undefined ? type : humaniseEnum(type));
  return (
    <li
      className="cx-viewer-partition-row"
      data-testid="viewer-partition-view"
      data-view-key={view.viewKey}
      data-type={view.type}
      data-untyped={String(untyped)}
      data-reason={untyped ? (view.reason ?? undefined) : undefined}
      data-on-sheet={String(onSheet)}
      data-proposed={String(view.proposed !== null)}
      data-confirmed={String(view.confirmed !== null)}
    >
      <span className="cx-viewer-partition-line">
        <TypeBadge view={view} untyped={untyped} reason={reason} EnumLabel={EnumLabel} Tooltip={Tooltip} />
        <ViewKey viewKey={view.viewKey} IdChip={IdChip} />
      </span>
      {view.caption === "" ? null : <span className="cx-viewer-partition-caption">{view.caption}</span>}
      <span className="cx-viewer-partition-line">
        <span className="cx-viewer-partition-figure">{fillCopy("viewer_partition_entities", { count: formatUserFigure(String(view.entityCount)) })}</span>
        {view.confirmed !== null ? (
          <span className="cx-viewer-partition-note">{fillCopy("viewer_partition_confirmed", { type: said(view.confirmed.type) })}</span>
        ) : view.proposed !== null ? (
          <span className="cx-viewer-partition-note">{fillCopy("viewer_partition_proposed", { type: said(view.proposed.type) })}</span>
        ) : null}
      </span>
      {/* The register's sentence stays WITH the row for a reader who cannot hover (I-111): read out
          after the row's own facts, drawn nowhere — the hatched badge and its tooltip are the sighted
          reader's channel, and one sentence under every untyped row was R-UI-081's paragraph. */}
      {reason === null ? null : (
        <span className="cx-viewer-hidden" data-testid="viewer-partition-view-reason">
          {reason}
        </span>
      )}
    </li>
  );
}

/**
 * One georeferenced axis, read as three tokens on one line and spoken as a sentence.
 *
 * I-363: the position is STATED on L-REG-04's lattice — a world coordinate at 0.1 drawing unit, the
 * one-decimal string `quantise` spells for every placement key — and grouped by the figure seam.
 * The stored double is the ring's centre as the reading computed it, and printed whole it carried
 * the binary noise of that arithmetic onto the screen: S-10's axes read `12,00,000.000000001`,
 * `12,11,582.399999999`, each wrapping to a second line. The exact value is kept on `data-position`.
 * The family is an enum and is said through the one EnumLabel ("Numeral"); the stored spelling stays
 * on `data-family` and in EnumLabel's technical disclosure (R-UI-082).
 */
function AxisRow({ axis, EnumLabel }: { axis: PartitionOverlayAxis } & RowChrome) {
  const position = formatUserFigure(quantise(axis.position));
  return (
    <li
      className="cx-viewer-partition-row"
      data-testid="viewer-partition-axis"
      data-view-key={axis.viewKey}
      data-family={axis.family}
      data-axis={axis.axis}
      data-label={axis.label}
      data-position={decimalOf(axis.position)}
    >
      <span className="cx-viewer-hidden">{fillCopy("viewer_partition_axis_reading", { label: axis.label, family: axis.family, position })}</span>
      <span className="cx-viewer-partition-line cx-viewer-partition-axis-line" aria-hidden="true">
        <span className="cx-viewer-partition-axis-label">{axis.label}</span>
        <span className="cx-viewer-partition-note cx-viewer-partition-family">
          {EnumLabel === undefined ? axis.family : <EnumLabel value={axis.family} className="cx-viewer-partition-family-word" />}
        </span>
        <span className="cx-viewer-partition-figure">{position}</span>
      </span>
    </li>
  );
}

/** One layout plan a grid could not lawfully be read off, naming the closed reason it deferred for. */
function DeferralRow({ deferral, IdChip }: { deferral: GridDeferralRow; IdChip?: PartitionPanelProps["IdChip"] }) {
  return (
    <li className="cx-viewer-partition-row" data-testid="viewer-partition-grid-deferral" data-view-key={deferral.viewKey} data-reason={deferral.reason}>
      <ViewKey viewKey={deferral.viewKey} IdChip={IdChip} />
      <span className="cx-viewer-partition-reason">{messageOf(deferral.reason)}</span>
    </li>
  );
}

/**
 * The scrolling body beneath the head — the panel's one scroller (I-190). It takes focus itself: a
 * scrolled region must be keyboard-reachable (axe scrollable-region-focusable), and this one may hold
 * no stop of its own — bones while loading, a paragraph when empty — and still overflow where the
 * layers list above has taken the stack's room. It wears the reticle like every stop of the shell.
 */
function Body({ children }: { children: ReactNode }) {
  return (
    <div className="cx-viewer-partition-body cx-reticle" tabIndex={0}>
      {children}
    </div>
  );
}

/** A partition's rows, split by where their view stands: this sheet, or another. */
type SheetRows = {
  readonly views: readonly PartitionOverlayView[];
  readonly axes: readonly PartitionOverlayAxis[];
  readonly deferrals: readonly GridDeferralRow[];
};

/**
 * The partition split into what stands on this sheet and what stands on others (I-319), each half in
 * the order the store carries it. A view stands here when its members have a box on this sheet; an
 * axis and a deferral stand wherever their view does. A row naming a view the partition does not
 * carry stands nowhere this sheet can show, and goes with the others.
 */
function bySheet(overlay: PartitionOverlay | null): { here: SheetRows; elsewhere: SheetRows } {
  const views = overlay?.views ?? [];
  const onSheet = new Set(views.filter((view) => view.box !== null).map((view) => view.viewKey));
  const here = (viewKey: string): boolean => onSheet.has(viewKey);
  const axes = overlay?.axes ?? [];
  const deferrals = overlay?.deferrals ?? [];
  return {
    here: { views: views.filter((view) => here(view.viewKey)), axes: axes.filter((axis) => here(axis.viewKey)), deferrals: deferrals.filter((row) => here(row.viewKey)) },
    elsewhere: { views: views.filter((view) => !here(view.viewKey)), axes: axes.filter((axis) => !here(axis.viewKey)), deferrals: deferrals.filter((row) => !here(row.viewKey)) },
  };
}

/** The three lists of one half of the partition, each omitted where it holds nothing. */
function SheetLists({ rows, chrome }: { rows: SheetRows; chrome: RowChrome }) {
  return (
    <>
      {rows.views.length === 0 ? null : (
        <ol className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_views_list_label}>
          {rows.views.map((view) => (
            <ViewRow key={view.viewKey} view={view} {...chrome} />
          ))}
        </ol>
      )}
      {rows.axes.length === 0 ? null : (
        <ol className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_grid_list_label}>
          {rows.axes.map((axis) => (
            <AxisRow key={axis.bubbleKey} axis={axis} {...chrome} />
          ))}
        </ol>
      )}
      {rows.deferrals.length === 0 ? null : (
        <ul className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_deferrals_list_label}>
          {rows.deferrals.map((deferral) => (
            <DeferralRow key={`${deferral.viewKey}|${deferral.reason}`} deferral={deferral} IdChip={chrome.IdChip} />
          ))}
        </ul>
      )}
    </>
  );
}

export function PartitionPanel({ state, overlay, toggles, onToggle, onRetry, faultId, groups, answer, IdChip, EnumLabel, humaniseEnum, Tooltip }: PartitionPanelProps) {
  const { here, elsewhere } = bySheet(overlay);
  const chrome: RowChrome = { IdChip, EnumLabel, humaniseEnum, Tooltip };
  const others = elsewhere.views.length;

  return (
    <section
      className="cx-viewer-partition"
      data-testid="viewer-partition"
      aria-labelledby={TITLE_ID}
      data-state={state}
      data-views={toggles.views ? "on" : "off"}
      data-grid={toggles.grid ? "on" : "off"}
      aria-busy={state === "loading" || undefined}
    >
      {/* The header renders whole in every state: both switches are local state rather than data,
          and they are operable the moment the panel is (Decision § 2). */}
      <div className="cx-viewer-partition-head">
        <h2 className="cx-viewer-partition-heading" id={TITLE_ID} tabIndex={-1}>
          {PARTITION_COPY.viewer_partition_heading}
        </h2>
        <OverlaySwitch
          testId="viewer-partition-views-toggle"
          label={PARTITION_COPY.viewer_partition_views_toggle}
          on={toggles.views}
          onFlip={(on) => onToggle("views", on)}
        />
        <OverlaySwitch
          testId="viewer-partition-grid-toggle"
          label={PARTITION_COPY.viewer_partition_grid_toggle}
          on={toggles.grid}
          onFlip={(on) => onToggle("grid", on)}
        />
      </div>

      {state === "loading" ? (
        <Body>
          <span className="cx-viewer-hidden">{PARTITION_COPY.viewer_partition_loading_label}</span>
          {Array.from({ length: LOADING_BONES }, (_unused, bone) => (
            <div key={bone} className="cx-skeleton cx-viewer-partition-bone" aria-hidden="true" />
          ))}
        </Body>
      ) : null}

      {/* An empty list says why it is empty (R-UI-020). The one action a reader has is on S-Drawings,
          which owns the rebuild — so this cell teaches rather than offering a door that cannot act. */}
      {state === "empty" ? (
        <Body>
          <p className="cx-viewer-partition-empty">{PARTITION_COPY.viewer_partition_empty}</p>
        </Body>
      ) : null}

      {state === "failed" ? (
        <Body>
          <p className="cx-viewer-partition-failed">{PARTITION_COPY.viewer_partition_failed}</p>
          <button type="button" className="cx-btn cx-reticle" data-variant="secondary" data-testid="viewer-partition-retry" onClick={onRetry}>
            <span className="cx-btn-label">{PARTITION_COPY.viewer_partition_retry}</span>
          </button>
          {faultId === null ? null : <p className="cx-viewer-partition-fault">{fillCopy("viewer_partition_report_id", { id: faultId })}</p>}
        </Body>
      ) : null}

      {/* A door that would not answer this read is answered HERE, in the body's place: the sheet, the
          layers list and this panel's own switches go on standing, because what was refused is the
          partition and not the drawing (Decision § 2, R-UI-050's partial). The screen hands in the one
          RefusalState with the address that resolves it — this panel never spells a refusal. */}
      {state === "refused" ? <Body>{answer}</Body> : null}

      {state === "ready" ? (
        <Body>
          <SheetLists rows={here} chrome={chrome} />
          {/* I-319: what stands on other sheets is one disclosure, closed, that says how many views it
              holds — their axes and deferrals travel with them. Where every view stands here (a
              model-space sheet) there is nothing to fold and no disclosure stands. */}
          {others === 0 && elsewhere.axes.length === 0 && elsewhere.deferrals.length === 0 ? null : (
            <details className="cx-viewer-partition-elsewhere" data-count={others}>
              <summary className="cx-viewer-partition-elsewhere-summary cx-reticle">
                {others === 1 ? PARTITION_COPY.viewer_partition_elsewhere_one : fillCopy("viewer_partition_elsewhere_many", { count: formatUserFigure(String(others)) })}
              </summary>
              <SheetLists rows={elsewhere} chrome={chrome} />
            </details>
          )}
          <div className="cx-viewer-partition-groups" data-testid="viewer-partition-groups">
            <h3 className="cx-viewer-partition-subheading">{PARTITION_COPY.viewer_partition_groups_heading}</h3>
            {groups}
            <div className="cx-viewer-partition-answer">{answer}</div>
          </div>
        </Body>
      ) : null}
    </section>
  );
}
