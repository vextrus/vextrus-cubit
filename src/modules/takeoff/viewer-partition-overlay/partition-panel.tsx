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
 * person who opened the sheet.
 */
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { PARTITION_COPY, fillCopy } from "./copy";
import type { OverlayToggles, PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "./types";
import type { GridDeferralRow } from "@/modules/takeoff/partition";
import type { ReactNode } from "react";

import "./viewer-partition.css";

/** The element the panel's heading names it by, and the region a journey moves focus to. */
const TITLE_ID = "cx-viewer-partition-title";

/** The bones the body stands in while the partition is in flight (Decision § 2, R-UI-004). */
const LOADING_BONES = 3;

/** What the panel is showing, as its `data-state` publishes it (R-UI-050). */
export type PartitionPanelState = "loading" | "ready" | "empty" | "failed";

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
  /** The region's answer slot: one RefusalState, or the offline notice, or nothing. */
  answer: ReactNode;
};

/**
 * A stored measurement as a decimal string the figure seam accepts (R-SPINE-010, L-FMT-02).
 *
 * `String(value)` is the shortest text that round-trips a double, but for a magnitude near zero or
 * very large it is written with an exponent — `1.2e-17` — and an exponent is not a decimal: the seam
 * refuses it rather than guessing, and a row rendering one would take the whole screen down. A grid
 * position derived from a ring's own geometry lands there whenever an axis stands at the origin, so
 * the exponent is written out positionally here. Nothing is rounded, padded or dropped: the value
 * the store holds is the value the panel shows, spelled the way a decimal is spelled.
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

/** The register's own sentence for a code the store holds, or nothing where it holds none. */
function messageOf(code: string | null): string {
  if (code === null || !Object.hasOwn(REFUSALS, code)) return "";
  return REFUSALS[code as RefusalCode].message;
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

/** One stored view: its badge, its key, its caption, what it holds, and the reason it carries. */
function ViewRow({ view }: { view: PartitionOverlayView }) {
  const untyped = view.type === VIEW_TYPE.UNTYPED;
  const onSheet = view.box !== null;
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
        {/* I-114: the badge is the store's word, before and after a confirmation — the grammar's
            reading is never overwritten in front of a reader. */}
        <span className="cx-badge cx-viewer-partition-badge" data-testid="viewer-partition-view-badge" data-untyped={String(untyped)}>
          {view.type}
        </span>
        <span className="cx-viewer-partition-key">{view.viewKey}</span>
      </span>
      {view.caption === "" ? null : <span className="cx-viewer-partition-caption">{view.caption}</span>}
      <span className="cx-viewer-partition-line">
        <span className="cx-viewer-partition-figure">{fillCopy("viewer_partition_entities", { count: formatUserFigure(String(view.entityCount)) })}</span>
        {onSheet ? null : <span className="cx-viewer-partition-note">{PARTITION_COPY.viewer_partition_off_sheet}</span>}
        {view.confirmed !== null ? (
          <span className="cx-viewer-partition-note">{fillCopy("viewer_partition_confirmed", { type: view.confirmed.type })}</span>
        ) : view.proposed !== null ? (
          <span className="cx-viewer-partition-note">{fillCopy("viewer_partition_proposed", { type: view.proposed.type })}</span>
        ) : null}
      </span>
      {untyped ? (
        <p className="cx-viewer-partition-reason" data-testid="viewer-partition-view-reason">
          {messageOf(view.reason)}
        </p>
      ) : null}
    </li>
  );
}

/** One georeferenced axis, read as three bare tokens beside one another and spoken as a sentence. */
function AxisRow({ axis }: { axis: PartitionOverlayAxis }) {
  return (
    <li
      className="cx-viewer-partition-row"
      data-testid="viewer-partition-axis"
      data-view-key={axis.viewKey}
      data-family={axis.family}
      data-axis={axis.axis}
      data-label={axis.label}
    >
      <span className="cx-viewer-hidden">
        {fillCopy("viewer_partition_axis_reading", { label: axis.label, family: axis.family, position: formatUserFigure(decimalOf(axis.position)) })}
      </span>
      <span className="cx-viewer-partition-line" aria-hidden="true">
        <span className="cx-viewer-partition-axis-label">{axis.label}</span>
        <span className="cx-viewer-partition-note">{axis.family}</span>
        <span className="cx-viewer-partition-figure">{formatUserFigure(decimalOf(axis.position))}</span>
      </span>
    </li>
  );
}

/** One layout plan a grid could not lawfully be read off, naming the closed reason it deferred for. */
function DeferralRow({ deferral }: { deferral: GridDeferralRow }) {
  return (
    <li className="cx-viewer-partition-row" data-testid="viewer-partition-grid-deferral" data-view-key={deferral.viewKey} data-reason={deferral.reason}>
      <span className="cx-viewer-partition-key">{deferral.viewKey}</span>
      <span className="cx-viewer-partition-reason">{messageOf(deferral.reason)}</span>
    </li>
  );
}

export function PartitionPanel({ state, overlay, toggles, onToggle, onRetry, faultId, groups, answer }: PartitionPanelProps) {
  const views = overlay?.views ?? [];
  const axes = overlay?.axes ?? [];
  const deferrals = overlay?.deferrals ?? [];

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
        <div className="cx-viewer-partition-body">
          <span className="cx-viewer-hidden">{PARTITION_COPY.viewer_partition_loading_label}</span>
          {Array.from({ length: LOADING_BONES }, (_unused, bone) => (
            <div key={bone} className="cx-skeleton cx-viewer-partition-bone" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {/* An empty list says why it is empty (R-UI-020). The one action a reader has is on S-Drawings,
          which owns the rebuild — so this cell teaches rather than offering a door that cannot act. */}
      {state === "empty" ? (
        <div className="cx-viewer-partition-body">
          <p className="cx-viewer-partition-empty">{PARTITION_COPY.viewer_partition_empty}</p>
        </div>
      ) : null}

      {state === "failed" ? (
        <div className="cx-viewer-partition-body">
          <p className="cx-viewer-partition-failed">{PARTITION_COPY.viewer_partition_failed}</p>
          <button type="button" className="cx-btn cx-reticle" data-variant="secondary" data-testid="viewer-partition-retry" onClick={onRetry}>
            <span className="cx-btn-label">{PARTITION_COPY.viewer_partition_retry}</span>
          </button>
          {faultId === null ? null : <p className="cx-viewer-partition-fault">{fillCopy("viewer_partition_report_id", { id: faultId })}</p>}
        </div>
      ) : null}

      {state === "ready" ? (
        <div className="cx-viewer-partition-body">
          <ol className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_views_list_label}>
            {views.map((view) => (
              <ViewRow key={view.viewKey} view={view} />
            ))}
          </ol>
          {axes.length === 0 ? null : (
            <ol className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_grid_list_label}>
              {axes.map((axis) => (
                <AxisRow key={axis.bubbleKey} axis={axis} />
              ))}
            </ol>
          )}
          {deferrals.length === 0 ? null : (
            <ul className="cx-viewer-partition-list" aria-label={PARTITION_COPY.viewer_partition_deferrals_list_label}>
              {deferrals.map((deferral) => (
                <DeferralRow key={`${deferral.viewKey}|${deferral.reason}`} deferral={deferral} />
              ))}
            </ul>
          )}
          <div className="cx-viewer-partition-groups" data-testid="viewer-partition-groups">
            <h3 className="cx-viewer-partition-subheading">{PARTITION_COPY.viewer_partition_groups_heading}</h3>
            {groups}
            <div className="cx-viewer-partition-answer">{answer}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
