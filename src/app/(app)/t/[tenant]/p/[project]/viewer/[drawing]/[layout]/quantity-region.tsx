"use client";
/**
 * S-Viewer's quantity region, whole (viewer.md Part 6): the two switches in the tool row, the third
 * canvas laid over the sheet, and the legend on the sheet.
 *
 * It lives HERE, in the route, because what it adds to the module's hooks is what a module may not
 * reach under ARCH-01: the string table, the one RefusalState, the chest's one Swatch, the basis glyph
 * table and the test-id registry. It is a hook rather than a component because its three nodes stand in
 * three places — the tool row, the stage's canvas stack and the stage's corner — while one piece of
 * state (the two switches) governs all three.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { refusalOf } from "@/core/errors";
import type { Camera } from "@/modules/takeoff/viewer";
import { QUANTITY_COPY_KEYS, type QuantityCopy } from "@/modules/takeoff/viewer-quantity-overlay/copy";
import { QuantityLegend, type QuantityLegendTestIds } from "@/modules/takeoff/viewer-quantity-overlay/legend";
import { quantityCounts, quantityScene } from "@/modules/takeoff/viewer-quantity-overlay/scene";
import type { QuantityToggles } from "@/modules/takeoff/viewer-quantity-overlay/types";
import { useQuantityOverlay, useQuantityPaint } from "@/modules/takeoff/viewer-quantity-overlay/use-quantity-overlay";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button } from "@/ui/primitives/core";
import { BASIS_GLYPHS } from "@/ui/primitives/core/basis";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { Swatch } from "./measure-chest";
import { feedRefusalCode } from "./partition-region";
import { viewerSheetRoute } from "./route-address";

/** The overlay opens OFF: a sheet is a drawing first, and nobody pays for the campaign they did not ask to see (Part 6 § 1). */
const BOTH_OFF: QuantityToggles = { quantities: false, unmeasured: false };

/** The registry's sentences under the keys the legend reads — built once, from the one home (I-636). */
const COPY: QuantityCopy = Object.freeze(Object.fromEntries(QUANTITY_COPY_KEYS.map((key) => [key, strings[key]])) as Record<(typeof QUANTITY_COPY_KEYS)[number], string>);

const LEGEND_TEST_IDS: QuantityLegendTestIds = Object.freeze({
  legend: TESTIDS.viewer.quantityLegend,
  row: TESTIDS.viewer.quantityLegendRow,
  total: TESTIDS.viewer.quantityLegendTotal,
  unmeasured: TESTIDS.viewer.quantityLegendUnmeasured,
  basis: TESTIDS.viewer.quantityLegendBasis,
  elsewhere: TESTIDS.viewer.quantityLegendElsewhere,
  retry: TESTIDS.viewer.quantityRetry,
});

export type QuantityRegionOptions = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  sheetName: string;
  feed: (query: string) => string;
  /** Whether there is a drawn sheet: nothing is asked, and no switch stands, before the head is a manifest. */
  enabled: boolean;
  camera: Camera | null;
  stageRef: RefObject<HTMLDivElement | null>;
  cameraRef: RefObject<Camera | null>;
  /** The frame's quantities slot: the fills are painted under the views/grid outlines (I-635). */
  paintRef: RefObject<((at: Camera) => void) | null>;
};

export type QuantityRegion = {
  /** The two switches, for the tool row's own group. */
  tools: ReactNode;
  /** The third canvas, laid over the sheet under the views/grid overlay — null while the overlay is off. */
  canvas: ReactNode;
  /** The legend on the sheet — null while the overlay is off. */
  legend: ReactNode;
};

/** One switch in the tool row: the snapping region's idiom — pressed state AND a filled swatch, never hue alone (R-UI-060). */
function OverlaySwitch({ testId, label, pressed, disabled, onPress }: { testId: string; label: string; pressed: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Button variant="secondary" data-testid={testId} aria-pressed={pressed} disabled={disabled} onClick={onPress}>
      <span className="cx-viewer-snap-swatch" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function useQuantityRegion({ tenantId, projectId, drawingId, sheetName, feed, enabled, camera, stageRef, cameraRef, paintRef }: QuantityRegionOptions): QuantityRegion {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [toggles, setToggles] = useState<QuantityToggles>(BOTH_OFF);
  /** Asked the first time the overlay is turned on, and held from then on (Part 6 § 1). */
  const [wanted, setWanted] = useState(false);
  const quantities = useQuantityOverlay({ feed, enabled: enabled && wanted });
  const paint = useQuantityPaint({ canvasRef, stageRef, cameraRef, overlay: quantities.overlay, toggles, glyphs: BASIS_GLYPHS });
  // The frame reads this region's paint through its slot; the paint is one stable callback, filed once
  // the region has committed, before the browser paints (I-635).
  useLayoutEffect(() => {
    paintRef.current = paint.paintQuantities;
  }, [paint.paintQuantities, paintRef]);

  /** What the canvas publishes after a frame, read off the scene, never off the paint (the partition overlay's rule). */
  const counts = useMemo(() => {
    const held = quantities.overlay;
    return held === null || camera === null ? null : quantityCounts(quantityScene(held, toggles, camera));
  }, [camera, quantities.overlay, toggles]);

  // Memoised on what it shows: the tool row is a frame slot, and a new node every render would set it on every render (PB-3).
  const tools = useMemo(
    () =>
      enabled ? (
        <span className="cx-viewer-quantity-tools">
          <OverlaySwitch
            testId={TESTIDS.viewer.quantityToggle}
            label={strings.viewer_quantity_toggle}
            pressed={toggles.quantities}
            onPress={() => {
              setWanted(true);
              setToggles((held) => ({ ...held, quantities: !held.quantities }));
            }}
          />
          <OverlaySwitch
            testId={TESTIDS.viewer.quantityUnmeasuredToggle}
            label={strings.viewer_quantity_unmeasured_toggle}
            pressed={toggles.unmeasured}
            disabled={!toggles.quantities}
            onPress={() => setToggles((held) => ({ ...held, unmeasured: !held.unmeasured }))}
          />
        </span>
      ) : null,
    [enabled, toggles],
  );

  const canvas =
    !toggles.quantities || counts === null ? null : (
      <canvas
        className="cx-viewer-quantity-canvas"
        data-testid={TESTIDS.viewer.quantityCanvas}
        aria-hidden="true"
        ref={canvasRef}
        data-filled={String(counts.filled)}
        data-hatched={String(counts.hatched)}
        data-placements={String(quantities.overlay?.placements.length ?? 0)}
      />
    );

  const code = quantities.refusedStatus === null ? null : feedRefusalCode(quantities.refusedStatus);
  const legend = !toggles.quantities ? null : (
    <QuantityLegend
      copy={COPY}
      humanise={humaniseEnum}
      glyphs={BASIS_GLYPHS}
      Swatch={Swatch}
      phase={quantities.phase}
      overlay={quantities.overlay}
      toggles={toggles}
      faultId={quantities.faultId}
      onRetry={quantities.retry}
      testIds={LEGEND_TEST_IDS}
      refusal={
        code === null ? null : (
          <RefusalState
            refusal={refusalOf(code)}
            evidence={code === "SIGNED_OUT" ? { href: "/sign-in", label: strings.shell_evidence_sign_in } : { href: viewerSheetRoute(tenantId, projectId, drawingId, sheetName), label: strings.viewer_partition_evidence_reload }}
          />
        )
      }
    />
  );

  return { tools, canvas, legend };
}
