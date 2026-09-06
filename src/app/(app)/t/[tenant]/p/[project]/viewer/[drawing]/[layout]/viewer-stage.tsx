"use client";
/**
 * The sheet itself, once there is one to draw (Decision § 1): the layers panel, the canvas with its
 * controls, and the inspector beside them. Markup only — every decision it renders was made by the
 * screen's hooks, and it holds no state and runs no effect of its own.
 */
import { ZOOM_STEP } from "@/modules/takeoff/viewer/hooks/use-camera";
import type { UsePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import { InspectorPanel, type InspectorPanelProps } from "@/modules/takeoff/viewer-inspector/inspector-panel";
import { Button } from "@/ui/primitives/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/ui/primitives/data";
import { fill, strings } from "@/ui/strings";
import { LayersPanel, type LayersPanelProps } from "./layers-panel";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

/** The panel's share of the width, and the band a reader may drag it to (Decision § 1). */
const PANEL_SIZE = 22;
const PANEL_MIN = 14;
const PANEL_MAX = 40;

export type ViewerStageProps = {
  panel: LayersPanelProps;
  pointer: UsePointer;
  inspector: InspectorPanelProps;
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sheetName: string;
  /** Whether a sheet can be drawn at all here — a browser with no WebGL context cannot (I-82). */
  drawable: boolean;
  probed: boolean;
  renderer: "webgl" | "unavailable";
  onFit: () => void;
  onZoom: (factor: number) => void;
};

export function ViewerStage({ panel, pointer, inspector, onKeyDown, stageRef, canvasRef, sheetName, drawable, probed, renderer, onFit, onZoom }: ViewerStageProps) {
  return (
    /* Every panel carries a stable id and order, so a layout stored by another build's group no
       longer matches this group and is dropped rather than misapplied (Decision § 1). */
    <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
      <ResizablePanel id="viewer-layers-panel" order={1} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
        <LayersPanel {...panel} />
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
          <p className="cx-viewer-hidden" id="cx-viewer-keys">
            {strings.viewer_canvas_keys}
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
      {/* A browser that offers no context draws no sheet, and an inspector beside a sheet that was
          never drawn is a panel that can never fill: the group falls back to two panels, and nothing
          is placeheld (Decision § 2, s-viewer's own rule). */}
      {drawable ? (
        <>
          <ResizableHandle />
          <ResizablePanel id="viewer-inspector-panel" order={3} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
            <InspectorPanel {...inspector} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
