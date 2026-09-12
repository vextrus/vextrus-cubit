"use client";
/**
 * S-VIEWER'S THREE SLOT MOUNTS, as one hook (Decision § 1's own rule: "every effect the sheet runs …
 * is one hook of its own"; Design Direction 00 §1, §3.1).
 *
 * The tool row, the readout and the inspector are the SHELL's regions — `src/ui/shell/slots.tsx` and
 * `src/ui/shell/inspector.tsx` — and a screen fills them through a hook rather than drawing them, so
 * that the 32 px and 24 px the grid has already spent are not spent a second time out of the canvas.
 * That is the whole of §8's first fix for this screen, and the arithmetic is proved in
 * tests/ui/shell/work-surface-share.test.ts.
 *
 * It lives here and not in `viewer-screen.tsx` because that file has a line cap and a contract —
 * "the screen composes hooks and runs no effect of its own" — and ninety lines of memoised slot
 * content is exactly the kind of thing that cap exists to keep out of it. The cap found this; it was
 * not a guess.
 *
 * Each slot is memoised on what it actually shows: a slot re-set on every render would re-render the
 * frame sixty times a second while a camera settles, which is the one thing PB-3 forbids.
 */
import { useMemo, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import type { ViewerHead } from "@/modules/takeoff/viewer";
import type { UseCamera } from "@/modules/takeoff/viewer/hooks/use-camera";
import type { UseLayers } from "@/modules/takeoff/viewer/hooks/use-layers";
import type { UsePainter } from "@/modules/takeoff/viewer/hooks/use-painter";
import type { UsePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import type { UseReveal } from "@/modules/takeoff/viewer/hooks/use-reveal";
import type { UseSelection } from "@/modules/takeoff/viewer/hooks/use-selection";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import type { LineEvidenceHold } from "@/modules/takeoff/trace/use-trace";
import type { CitedBlock } from "@/modules/takeoff/viewer-inspector/inspector-panel";
import type { PartitionRegion } from "./partition-region";
import type { ScaleRegion } from "./scale-region";
import { ZOOM_STEP } from "@/modules/takeoff/viewer/hooks/use-camera";
import { useInspector, useShellStatus, useShellToolbar } from "@/ui/shell";
import { SnapTools } from "./snap-region";
import { StatusLine } from "./status-line";
import { InspectorTabs } from "./viewer-stage";
import { ViewerToolbar } from "./viewer-toolbar";

/**
 * What the screen already holds, handed over whole: this hook READS, it does not decide. Every field
 * is the published type of the hook that produced it — nothing here is `any`, because an `any` in a
 * composition module is a type hole in exactly the place the composition is supposed to be checked.
 */
export interface ViewerSlotsInput {
  /** The status a door refused this reader with, if one did. */
  denied: number | null;
  head: ViewerHead | null;
  tool: ViewerTool;
  setTool: (tool: ViewerTool) => void;
  snap: UseSnap;
  camera: UseCamera;
  layersOpen: boolean;
  setLayersOpen: Dispatch<SetStateAction<boolean>>;
  inspectorPinned: boolean;
  setInspectorPinned: Dispatch<SetStateAction<boolean>>;
  sheetName: string;
  loadedLayers: number;
  layers: UseLayers;
  held: UseSelection;
  paint: UsePainter;
  statusRef: RefObject<HTMLDivElement | null>;
  /** The `line` parameter: the register row a Trace was followed from (R-UI-022). */
  initialLine: string | null;
  pointer: UsePointer;
  line: LineEvidenceHold;
  cited: CitedBlock | null;
  trace: UseReveal;
  scale: ScaleRegion;
  partition: PartitionRegion;
}

/** The pointer's mode: what a drag on the sheet does (§3.1's Select V · Pan H). */
export type ViewerTool = "select" | "pan";

export interface ViewerSlots {
  toolbar: ReactNode | null;
  readout: ReactNode;
  /** Did a frame take the region? `false` means the screen renders it where it stands. */
  framedToolbar: boolean;
  framedStatus: boolean;
}

export function useViewerSlots(input: ViewerSlotsInput): ViewerSlots {
  const { denied, head, tool, setTool, snap, camera, layersOpen, setLayersOpen, inspectorPinned, setInspectorPinned, sheetName, loadedLayers, layers, held, paint, statusRef, initialLine, pointer, line, cited, trace, scale, partition } = input;
  const drawable = denied === null && head !== null && head.kind === "manifest";

  const toolbar = useMemo(
      () =>
        drawable ? (
          <ViewerToolbar
            tool={tool}
            onTool={setTool}
            snapTools={<SnapTools snap={snap} />}
            onFit={camera.fitSheet}
            onZoomIn={() => camera.zoomBy(ZOOM_STEP)}
            onZoomOut={() => camera.zoomBy(1 / ZOOM_STEP)}
            layersOpen={layersOpen}
            onLayers={() => setLayersOpen((open) => !open)}
            inspectorPinned={inspectorPinned}
            onInspector={() => setInspectorPinned((pinned) => !pinned)}
          />
        ) : null,
      [drawable, tool, snap, camera.fitSheet, camera.zoomBy, layersOpen, inspectorPinned],
  );
  const framedToolbar = useShellToolbar(toolbar);

  const readout = useMemo(
      () => (
        <StatusLine
          statusRef={statusRef}
          layoutName={sheetName}
          sheet={camera.camera !== null && head?.kind === "manifest"}
          scale={camera.camera?.scale ?? 0}
          loadedLayers={loadedLayers}
          totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
          drawnEntities={layers.state.drawnEntityCount()}
          entityCount={layers.state.entityCount()}
          selectionCount={held.selected.length}
          firstPaint={paint.firstPaint}
          renderer={paint.renderer}
          partial={layers.rows.some((row) => row.failed)}
          snap={snap}
        />
      ),
      [sheetName, camera.camera, head, loadedLayers, layers.state, layers.rows, held.selected.length, paint.firstPaint, paint.renderer, snap],
  );
  const framedStatus = useShellStatus(readout);

  // §3.1: "appears on selection… absent — width 0, not a placeholder sentence — when nothing is
  // selected". The pin is the one lawful way to hold it open at rest, because the scale tab is a
  // door onto every view's scale and is not a fact about a selection (I-152, R-TO-020).
  const selected = held.selected.length > 0 || initialLine !== null || inspectorPinned;
  useInspector(
    useMemo(
      () =>
        drawable && selected ? (
          <InspectorTabs
            inspector={{ hover: pointer.hovered, selection: held.selected, missing: held.missing, trace: line.block, cited, onCopy: (key: string) => navigator.clipboard.writeText(key), onReveal: () => trace.reveal(held.selection), onClear: () => held.hold([]) }}
            scale={scale}
            snap={snap}
            views={partition.views}
          />
        ) : null,
      [drawable, selected, pointer.hovered, held.selected, held.missing, held.selection, held.hold, line.block, cited, trace, scale, snap, partition.views],
    ),
  );


  return { toolbar, readout, framedToolbar, framedStatus };
}
