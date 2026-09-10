"use client";
/**
 * The sheet itself, once there is one to draw (Decision § 1): the layers panel, the canvas with its
 * controls, and the inspector beside them. Markup only — every decision it renders was made by the
 * screen's hooks, and it holds no state and runs no effect of its own.
 */
import { useState } from "react";
import { ZOOM_STEP } from "@/modules/takeoff/viewer/hooks/use-camera";
import type { UsePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { InspectorPanel, type InspectorChrome, type InspectorPanelProps } from "@/modules/takeoff/viewer-inspector/inspector-panel";
import { SCALE_COPY } from "@/modules/takeoff/scale-ui/copy";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { BasisChip, Button } from "@/ui/primitives/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/data";
import { fill, strings } from "@/ui/strings";
import { LayersPanel, type LayersPanelProps } from "./layers-panel";
import { ScalePanel, type ScaleRegion, type ScaleViewBox } from "./scale-region";
import { SnapAnnouncer, SnapOverlay, SnapTools } from "./snap-region";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";

/**
 * The two shipped renderers the inspector panel is handed (I-170). The panel lives in `src/modules`,
 * which may not import `src/ui` (ARCH-01), and may not re-implement either (B-17) — so this file,
 * the markup that mounts the panel, binds them once.
 */
const INSPECTOR_CHROME: InspectorChrome = { BasisChip, EvidenceLink };

/** The panel's share of the width, and the band a reader may drag it to (Decision § 1). */
const PANEL_SIZE = 22;
const PANEL_MIN = 14;
const PANEL_MAX = 40;

export type ViewerStageProps = {
  panel: LayersPanelProps;
  /** The views/grid region: its section docks under the layers list in the one left column (I-110),
      its canvas lies over the sheet, reached by nothing (I-112), and its view boxes say where each
      view of the partition stands, which is how an observation names the view it was taken in. */
  partition: { panel: ReactNode; canvas: ReactNode; views: readonly ScaleViewBox[] };
  /** The scale region: the second tab of the right inspector (I-152). */
  scale: ScaleRegion;
  pointer: UsePointer;
  /** The snapping region: its toolbar on the stage and its marks on the overlay stack (I-151). */
  snap: UseSnap;
  inspector: Omit<InspectorPanelProps, "chrome">;
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sheetName: string;
  /** Whether the context was probed at all yet, and what it answered — a browser with no WebGL
      context draws no sheet and says so in the stage's place (I-82). */
  probed: boolean;
  renderer: "webgl" | "unavailable";
  onFit: () => void;
  onZoom: (factor: number) => void;
};

export function ViewerStage({ panel, partition, scale, pointer, snap, inspector, onKeyDown, stageRef, canvasRef, sheetName, probed, renderer, onFit, onZoom }: ViewerStageProps) {
  return (
    /* Every panel carries a stable id and order, so a layout stored by another build's group no
       longer matches this group and is dropped rather than misapplied (Decision § 1). */
    <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
      {/* I-110: one column of two lists rather than a second split — a nested handle would buy one
          degree of freedom at the price of a control that can crush either list to nothing. */}
      <ResizablePanel id="viewer-layers-panel" order={1} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
        <div className="cx-viewer-left-stack">
          <LayersPanel {...panel} />
          {partition.panel}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="viewer-stage-panel" order={2}>
        <div className="cx-viewer-stage" ref={stageRef}>
          {probed && renderer === "unavailable" ? (
            <div className="cx-viewer-empty">
              <h2 className="cx-viewer-empty-heading">{strings.viewer_no_webgl_heading}</h2>
              <p className="cx-viewer-empty-body">{strings.viewer_no_webgl_body}</p>
            </div>
          ) : null}
          {/* The keys the sheet answers, in one line the canvas points at: the camera's, and after
              them this region's own — the keyboard way to a measurement a pointer would take by
              hand (R-UI-060). Each table speaks its own sentence; neither respells the other's. */}
          <p className="cx-viewer-hidden" id="cx-viewer-keys">
            {`${strings.viewer_canvas_keys} ${strings.viewer_snap_canvas_keys}`}
          </p>
          <canvas
            className="cx-viewer-canvas cx-reticle"
            data-testid="viewer-canvas"
            ref={canvasRef}
            // The sheet is driven from the keyboard, so it is not announced as a picture: the keys
            // it answers are named beside it and pointed at from here (R-TO-010, A-11Y).
            role="application"
            tabIndex={0}
            aria-label={fill(strings.viewer_canvas_label, { layout: sheetName })}
            aria-describedby="cx-viewer-keys"
            onPointerDown={pointer.onPointerDown}
            onPointerMove={pointer.onPointerMove}
            onPointerUp={pointer.onPointerUp}
            onPointerCancel={pointer.onPointerUp}
            onPointerLeave={pointer.clearHover}
            onKeyDown={onKeyDown}
          />
          {partition.canvas}
          {/* The rectangle follows the pointer untweened and is written straight onto the element:
              sixty renders a second of the panel and the readout is what a marquee must not cost
              (PB-3). Its geometry is pointer data, not a style — the look is the stylesheet's. */}
          {pointer.marqueeOn ? (
            <div
              className="cx-viewer-marquee"
              data-testid="viewer-marquee"
              aria-hidden="true"
              ref={pointer.marqueeRef}
              style={{
                left: `${pointer.marqueeBox.left}px`,
                top: `${pointer.marqueeBox.top}px`,
                width: `${pointer.marqueeBox.width}px`,
                height: `${pointer.marqueeBox.height}px`,
              }}
            />
          ) : null}
          <SnapOverlay snap={snap} />
          <SnapTools snap={snap} />
          <SnapAnnouncer snap={snap} />
          <div className="cx-viewer-controls">
            <Button variant="secondary" data-testid="viewer-fit" onClick={onFit}>
              {strings.viewer_fit}
            </Button>
            <Button variant="secondary" data-testid="viewer-zoom-in" onClick={() => onZoom(ZOOM_STEP)}>
              {strings.viewer_zoom_in}
            </Button>
            <Button variant="secondary" data-testid="viewer-zoom-out" onClick={() => onZoom(1 / ZOOM_STEP)}>
              {strings.viewer_zoom_out}
            </Button>
          </div>
        </div>
      </ResizablePanel>
      {/* The right column stands whether or not a sheet can be drawn here (I-152): its scale tab is
          filled by a door and not by the canvas, so a browser that offers no WebGL context still
          reads every view's scale, its proposals and the absence a view declares (R-TO-020). Only
          the selection tab beside it depends on a drawing, and that is the tab's own emptiness to
          teach — never the whole column's absence. */}
      <ResizableHandle />
      <ResizablePanel id="viewer-inspector-panel" order={3} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
        <InspectorTabs inspector={inspector} scale={scale} snap={snap} views={partition.views} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * The inspector beside a sheet that could not be drawn. A Trace address carries a line as well as a
 * set of keys, and the reader who followed one is owed what became of that line even where there is
 * no sheet to fly to — otherwise a stale address answers with a page about the drawing and nothing
 * at all about what was asked for (AC-4, R-UI-050).
 *
 * It is the panel the stage mounts, with the same chrome, so no second inspector exists anywhere
 * (B-17). What it is handed is only what is true here: no hover, no selection and no Cited-by,
 * because all three are facts about a drawn sheet, and no canvas is mounted for it either — the
 * empty state's own ruling that no stage stands behind an unread sheet is untouched (s-viewer § 2).
 */
export function AbsentSheetWork({ absence, trace }: { absence: ReactNode; trace: InspectorPanelProps["trace"] }) {
  if (trace === null) return absence;
  return (
    <div className="cx-viewer-absence-work">
      {absence}
      <InspectorPanel
        hover={null}
        selection={[]}
        missing={[]}
        trace={trace}
        cited={null}
        onCopy={(key) => navigator.clipboard.writeText(key)}
        onReveal={NOTHING_TO_REVEAL}
        onClear={NOTHING_TO_REVEAL}
        chrome={INSPECTOR_CHROME}
      />
    </div>
  );
}

/** Nothing is held and no sheet is drawn, so the two controls that act on a selection do nothing. */
const NOTHING_TO_REVEAL = (): void => {};

/** The two tabs of the right inspector, and what each holds (I-152). */
const SELECTION_TAB = "selection";
const SCALE_TAB = "scale";

/**
 * The right inspector as a two-tab panel (I-152): the strip stands OUTSIDE the aside, wrapping the
 * contents of `viewer-inspector-panel`, so the inspector a journey already pictured is byte-identical
 * and only the height it stands in may change.
 *
 * The chosen tab is held here rather than by the primitive, because a tab is chosen by a click as
 * much as by the pointer-down and the keyboard the primitive answers on its own: one value, set by
 * whichever gesture arrived, keeps the strip and the panel saying the same thing (R-UI-012). Nothing
 * of it is persisted — that is the prefs seam's, and an IOU of this Decision's § 8.
 */
function InspectorTabs({ inspector, scale, snap, views }: { inspector: Omit<InspectorPanelProps, "chrome">; scale: ScaleRegion; snap: UseSnap; views: readonly ScaleViewBox[] }) {
  const [tab, setTab] = useState(SELECTION_TAB);
  return (
    <Tabs className="cx-viewer-inspector-tabs" value={tab} onValueChange={setTab}>
      <TabsList data-testid="viewer-inspector-tabs" aria-label={SCALE_COPY.viewer_scale_tabs_label}>
        <TabsTrigger value={SELECTION_TAB} data-testid="viewer-inspector-tab-selection" onClick={() => setTab(SELECTION_TAB)}>
          {SCALE_COPY.viewer_scale_tab_selection}
        </TabsTrigger>
        <TabsTrigger value={SCALE_TAB} data-testid="viewer-inspector-tab-scale" onClick={() => setTab(SCALE_TAB)}>
          {SCALE_COPY.viewer_scale_tab_scale}
        </TabsTrigger>
      </TabsList>
      <TabsContent className="cx-viewer-inspector-tab" value={SELECTION_TAB}>
        <InspectorPanel {...inspector} chrome={INSPECTOR_CHROME} />
      </TabsContent>
      <TabsContent className="cx-viewer-inspector-tab" value={SCALE_TAB}>
        {/* The picks are the snapping region's own, and a successful observation spends them: no
            second pick model exists anywhere in the product (I-158, B-17). */}
        <ScalePanel scale={scale} picks={snap.picks} views={views} onSpent={snap.clearPicks} />
      </TabsContent>
    </Tabs>
  );
}
