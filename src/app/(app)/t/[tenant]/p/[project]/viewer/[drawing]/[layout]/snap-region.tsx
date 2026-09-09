"use client";
/**
 * S-Viewer's snapping region, whole (Decision § 1, I-151): the three-toggle toolbar on the stage, the
 * marks on the overlay stack, and the line that speaks a taken pick.
 *
 * It lives HERE, in the route, rather than beside the maths in `src/modules`, because everything it
 * adds to `useSnap` is what a module may not reach under ARCH-01: the one core Button, the one string
 * table, and the ONE roster of bindings the toggle states its key from. `viewer-snap/**` holds no JSX
 * and no sentence, so no copy is mirrored into a module and there is no second home for a word.
 */
import "@/modules/takeoff/viewer-snap/viewer-snap.css";

import { formatUserFigure } from "@/core/format";
import type { SnapKind } from "@/modules/takeoff/viewer-snap/snap";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { Button } from "@/ui/primitives/core";
import { shortcutById } from "@/ui/shell/shortcuts/roster";
import { fill, strings, type StringKey } from "@/ui/strings";

/** The binding R-UI-032 gives this region, read from the one roster and never spelled a second time. */
export const SNAP_SHORTCUT_ID = "viewer-snap";

/** The word each kind is named by in the readout — the second, non-colour channel (R-UI-060). */
const KIND_COPY: Readonly<Record<SnapKind, StringKey>> = Object.freeze({
  endpoint: "viewer_snap_kind_endpoint",
  midpoint: "viewer_snap_kind_midpoint",
  intersection: "viewer_snap_kind_intersection",
  perpendicular: "viewer_snap_kind_perpendicular",
  grid: "viewer_snap_kind_grid",
  nearest: "viewer_snap_kind_nearest",
});

export type SnapRegionProps = { snap: UseSnap };

/** One toggle of the toolbar: its swatch, its word, and whether it is pressed (WCAG 4.1.2). */
function SnapToggle({ testId, label, pressed, onPress, keys }: { testId: string; label: string; pressed: boolean; onPress: () => void; keys?: string }) {
  return (
    <Button
      variant="secondary"
      data-testid={testId}
      aria-pressed={pressed}
      aria-keyshortcuts={keys}
      onClick={onPress}
    >
      {/* The swatch is the second channel a pressed toggle carries: filled when pressed, hollow when
          not, so nothing here is told apart by hue alone (R-UI-060). */}
      <span className="cx-viewer-snap-swatch" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** The toolbar, at the stage's top-left (§ 1). The word is the accessible name, so no label is written. */
export function SnapTools({ snap }: SnapRegionProps) {
  return (
    <div className="cx-viewer-snap-tools" role="group" aria-label={strings.viewer_snap_tools_label}>
      <SnapToggle
        testId="viewer-snap-toggle"
        label={strings.viewer_snap_toggle}
        pressed={snap.enabled}
        onPress={snap.toggleSnapping}
        keys={shortcutById(SNAP_SHORTCUT_ID).keys.join(" ")}
      />
      <SnapToggle testId="viewer-snap-ortho" label={strings.viewer_snap_ortho} pressed={snap.ortho} onPress={snap.pressOrtho} />
      <SnapToggle testId="viewer-snap-angle" label={strings.viewer_snap_angle} pressed={snap.angle} onPress={snap.pressAngle} />
    </div>
  );
}

/**
 * The marks over the sheet: the picks taken, the band to the point being measured to, and at most one
 * glyph. The stack is reached by nothing — the pointer belongs to the canvas under it, and the
 * accessible path to the same facts is the readout and the live line below (§ 1).
 */
export function SnapOverlay({ snap }: SnapRegionProps) {
  const { band, glyph, picks } = snap.scene;
  return (
    <div className="cx-viewer-snap-overlay" aria-hidden="true">
      {picks.map((pick) => (
        <div
          key={pick.index}
          className="cx-viewer-snap-pick"
          data-testid="viewer-snap-pick"
          data-index={String(pick.index)}
          data-source={pick.sourceKeys.join(" ")}
          data-key-x={pick.keyPoint[0]}
          data-key-y={pick.keyPoint[1]}
          style={{ transform: `translate(${pick.at.x}px, ${pick.at.y}px)` }}
        />
      ))}
      {band === null ? null : (
        <div
          className="cx-viewer-snap-band"
          style={{ width: `${band.lengthPx}px`, transform: `translate(${band.at.x}px, ${band.at.y}px) rotate(${band.angleDeg}deg)` }}
        />
      )}
      {/* Exactly one glyph, or none: a second would be a second answer to one question (§ 1). Its
          position is written straight onto the element as the pointer moves, so sliding along an edge
          costs no render of the panel or the readout (PB-3). */}
      {glyph === null ? null : (
        <div
          ref={snap.glyphRef}
          className="cx-viewer-snap-glyph"
          data-testid="viewer-snap-glyph"
          data-kind={glyph.kind}
          data-source={glyph.sourceKeys.join(" ")}
          data-motion={snap.motion}
          style={{ transform: `translate(${glyph.at.x}px, ${glyph.at.y}px)` }}
        />
      )}
    </div>
  );
}

/**
 * The keyboard's own path to what the marks say (R-UI-060): at most three utterances per measurement
 * — a pick taken, and on the second the same figures the readout renders. The two cells themselves
 * are `aria-live="off"`, because a pointer-driven figure would otherwise be announced sixty times a
 * second.
 */
export function SnapAnnouncer({ snap }: SnapRegionProps) {
  const said = snap.announcement;
  const spoken =
    said === null
      ? ""
      : said.kind === "cleared"
        ? strings.viewer_snap_picks_cleared
        : `${fill(strings.viewer_snap_pick_taken, { index: String(said.index), x: said.keyPoint[0], y: said.keyPoint[1] })}${
            snap.readout.picks === 2 ? ` ${snapFigures(snap)}` : ""
          }`;

  return (
    <p className="cx-viewer-hidden" role="status" aria-live="polite">
      {spoken}
    </p>
  );
}

/** The figures the distance cell renders, as one spoken line (§ 1). */
function snapFigures(snap: UseSnap): string {
  const { distance, metres } = snap.readout;
  const units = distance === null ? "" : fill(strings.viewer_status_distance_units, { distance: formatUserFigure(distance) });
  return metres === null ? units : `${units} ${fill(strings.viewer_status_distance_metres, { metres: formatUserFigure(metres) })}`;
}

/** The kind's own word, for the readout that names what the shape drew (AC-2). */
export function snapKindCopy(kind: SnapKind): string {
  return strings[KIND_COPY[kind]];
}
