"use client";
/**
 * S-Viewer's work area (Decision § 1, § 2): whichever of the sheet's answers is on screen — the
 * refusal, the bones while the head is in flight, the absence of a drawing nobody has read, or the
 * sheet itself between the layers panel and the inspector.
 *
 * Chrome only: this file holds no effect, no fetch and no state. It is handed what the screen's
 * hooks decided and renders it, so the three unhappy answers stay as far apart here as they are
 * there (ARCH-03).
 */
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import type { RefusalEntry } from "../../../../../../../../../core/errors";
import type { LayerRow } from "../../../../../../../../../modules/takeoff/viewer/client";
import type { ViewerHead } from "../../../../../../../../../modules/takeoff/viewer";
import type { PointerGestures } from "../../../../../../../../../modules/takeoff/viewer/hooks/use-pointer";
import { InspectorPanel, type InspectorPanelProps } from "../../../../../../../../../modules/takeoff/viewer-inspector/inspector-panel";
import { Button, Skeleton } from "../../../../../../../../../ui/primitives/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../../../../../../../ui/primitives/data";
import { RefusalState, type RefusalEvidence } from "../../../../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../../../../ui/shell";
import { strings } from "../../../../../../../../../ui/strings";
import { FidelityFacts } from "./fidelity-facts";
import { LayersPanel } from "./layers-panel";

/** The rows the panel's bones stand for while the roster is in flight (Decision § 2). */
const LOADING_ROWS = 6;

/** The cells the inspector's own bones stand for while the head is in flight (Decision § 2). */
const LOADING_CELLS = 2;

/** The panel's share of the width, and the band a reader may drag it to (Decision § 1). */
const PANEL_SIZE = 22;
const PANEL_MIN = 14;
const PANEL_MAX = 40;

/** The layers panel's rows and the four things a reader does to one. */
export type LayersControl = {
  rows: LayerRow[];
  setVisible: (name: string, visible: boolean) => void;
  isolate: (name: string) => void;
  lock: (name: string, locked: boolean) => void;
  retry: (name: string) => void;
  selectLayer: (name: string) => void;
};

/** The sheet's own panel: the elements it is drawn on, and everything a gesture reaches it through. */
export type StageControl = {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  probed: boolean;
  renderer: "webgl" | "unavailable";
  pointer: PointerGestures;
  onKeyDown: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
  fitSheet: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export type WorkAreaProps = {
  tenantId: string;
  /** The sheet named as the canvas is labelled with it — the screen fills the one string (I-77). */
  canvasLabel: string;
  head: ViewerHead | null;
  /** A feed that refused, named by the screen from the register (ARCH-03). */
  refusal: { refusal: RefusalEntry; evidence: RefusalEvidence } | null;
  /** The evidence a refusal carried by the head links to. */
  evidence: RefusalEvidence;
  layers: LayersControl;
  stage: StageControl;
  inspector: InspectorPanelProps;
};

export function WorkArea({ tenantId, canvasLabel, head, refusal, evidence, layers, stage, inspector }: WorkAreaProps): ReactNode {
  if (refusal !== null) {
    return (
      <div className="cx-viewer-refusal">
        <RefusalState refusal={refusal.refusal} evidence={refusal.evidence} />
      </div>
    );
  }
  if (head === null) {
    return (
      <div className="cx-viewer-loading" data-testid="viewer-loading">
        <span className="cx-viewer-hidden">{strings.viewer_loading_label}</span>
        <div className="cx-viewer-bones-panel">
          <Skeleton style={{ height: "16px", width: "96px" }} />
          {Array.from({ length: LOADING_ROWS }, (_, row) => (
            <Skeleton key={row} style={{ height: "var(--row-comfortable)", width: "100%" }} />
          ))}
        </div>
        <Skeleton style={{ height: "100%", width: "100%" }} />
        {/* Bones where the inspector will stand: telling a reader to hover an entity before any
            exists is a lie about readiness (Decision § 2). */}
        <div className="cx-viewer-bones-panel">
          <Skeleton style={{ height: "16px", width: "96px" }} />
          {Array.from({ length: LOADING_CELLS }, (_, cell) => (
            <Skeleton key={cell} style={{ height: "12px", width: "140px" }} />
          ))}
        </div>
      </div>
    );
  }
  if (head.kind === "refusal") {
    return (
      <div className="cx-viewer-refusal">
        <RefusalState refusal={head.refusal} evidence={evidence} />
        <FidelityFacts facts={head.facts} />
      </div>
    );
  }
  if (head.kind === "absent") {
    const unread = head.reason === "not-ingested";
    return (
      <div className="cx-viewer-empty" data-testid="viewer-empty">
        <h2 className="cx-viewer-empty-heading">{unread ? strings.viewer_empty_unread_heading : strings.viewer_empty_sheet_heading}</h2>
        <p className="cx-viewer-empty-body">{unread ? strings.viewer_empty_unread_body : strings.viewer_empty_sheet_body}</p>
        <a className="cx-btn cx-reticle cx-viewer-empty-action" data-variant="secondary" href={shellHref(tenantId, "projects")}>
          <span className="cx-btn-label">{strings.viewer_evidence_project}</span>
        </a>
      </div>
    );
  }

  /** Whether a sheet can be drawn at all here — a browser with no WebGL context cannot (I-82). */
  const drawable = !(stage.probed && stage.renderer === "unavailable");

  return (
    /* Every panel carries a stable id and order, so a layout stored by another build's group no
       longer matches this group and is dropped rather than misapplied (Decision § 1). */
    <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
      <ResizablePanel id="viewer-layers-panel" order={1} defaultSize={PANEL_SIZE} minSize={PANEL_MIN} maxSize={PANEL_MAX}>
        <LayersPanel
          rows={layers.rows}
          onVisible={layers.setVisible}
          onIsolate={layers.isolate}
          onLock={layers.lock}
          onRetry={layers.retry}
          onSelectLayer={layers.selectLayer}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="viewer-stage-panel" order={2}>
        <div className="cx-viewer-stage" ref={stage.stageRef}>
          {stage.probed && stage.renderer === "unavailable" ? (
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
            ref={stage.canvasRef}
            // The sheet is driven from the keyboard, so it is not announced as a picture: the keys
            // it answers are named beside it and pointed at from here (R-TO-010, A-11Y).
            role="application"
            tabIndex={0}
            aria-label={canvasLabel}
            aria-describedby="cx-viewer-keys"
            onPointerDown={stage.pointer.onPointerDown}
            onPointerMove={stage.pointer.onPointerMove}
            onPointerUp={stage.pointer.onPointerUp}
            onPointerCancel={stage.pointer.onPointerUp}
            onPointerLeave={stage.pointer.onPointerLeave}
            onKeyDown={stage.onKeyDown}
          />
          {/* The rectangle follows the pointer untweened and is written straight onto the element:
              sixty renders a second of the panel and the readout is what a marquee must not cost
              (PB-3). Its geometry is pointer data, not a style — the look is the stylesheet's. */}
          {stage.pointer.marqueeOn ? (
            <div
              className="cx-viewer-marquee"
              data-testid="viewer-marquee"
              aria-hidden="true"
              ref={stage.pointer.marqueeRef}
              style={{
                left: `${stage.pointer.marqueeBox.left}px`,
                top: `${stage.pointer.marqueeBox.top}px`,
                width: `${stage.pointer.marqueeBox.width}px`,
                height: `${stage.pointer.marqueeBox.height}px`,
              }}
            />
          ) : null}
          <div className="cx-viewer-controls">
            <Button variant="secondary" data-testid="viewer-fit" onClick={stage.fitSheet}>
              {strings.viewer_fit}
            </Button>
            <Button variant="secondary" data-testid="viewer-zoom-in" onClick={stage.zoomIn}>
              {strings.viewer_zoom_in}
            </Button>
            <Button variant="secondary" data-testid="viewer-zoom-out" onClick={stage.zoomOut}>
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
