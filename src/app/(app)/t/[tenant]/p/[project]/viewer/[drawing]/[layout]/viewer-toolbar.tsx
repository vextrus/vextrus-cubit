"use client";
/**
 * S-VIEWER'S TOOL PALETTE — one row of 28 px icon buttons in the frame's 32 px track (Direction §1,
 * §3.1). "AutoCAD's ribbon is the reference for PLACEMENT (tools live above the view, in groups,
 * small), not for its size: we use one row, never tabs of tabs."
 *
 * §3.1 fixes the groups and their order, left to right: Select V · Pan H | Linear L · Area A ·
 * Count C (M4 arms them; here they stand disabled with the reason in the tooltip, because a tool
 * that is coming is a fact and a tool that is missing is a hole) | Snap S ▾ · Ortho · Angle |
 * Views · Grid | Fit F · + · − | right-aligned L≡ (layers drawer) and V≡ (inspector pin).
 *
 * The three text buttons this replaces floated over the sheet in `cx-viewer-controls` — §8 scores
 * the viewer 1 on C1 and 2 on C11 partly for them: a control box on the canvas is canvas the reader
 * cannot use, and "Fit"/"Zoom in"/"Zoom out" as three secondary buttons is three button styles'
 * worth of weight for three tools. In the track they cost the work surface nothing at all, because
 * the track's 32 px are the grid's and were already spent (tests/ui/shell/work-surface-share.test.ts).
 *
 * The snapping toggles are NOT re-implemented here: they are the snapping region's own controls
 * (`snap-region.tsx`, B-17), handed up so the row can place them in the group §3.1 gives them.
 */
import { IconArea, IconCount, IconFit, IconInspector, IconLayers, IconLinear, IconPan, IconSelect, IconZoomIn, IconZoomOut } from "@/ui/icons";
import { IconButton } from "@/ui/primitives/core";
import { ShellToolbarGroup } from "@/ui/shell";
import { strings } from "@/ui/strings";
import type { ReactNode } from "react";
import { TESTIDS } from "@/ui/testids";

export type ViewerToolbarProps = {
  /** The pointer's mode: what a drag on the sheet does. */
  tool: "select" | "pan";
  onTool: (tool: "select" | "pan") => void;
  /** The snapping region's own three toggles, placed here rather than rebuilt here. */
  snapTools: ReactNode;
  /** The views/grid overlay toggle — the partition region's, for the same reason; absent where
      the sheet has no partition to overlay, and an absent group is no group at all (R-UI-080). */
  views?: ReactNode;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** The left drawer: shown or hidden, and remembered by the screen that owns the posture. */
  layersOpen: boolean;
  onLayers: () => void;
  /** The inspector pin: held open with nothing selected, so the scale tab is reachable at rest. */
  inspectorPinned: boolean;
  onInspector: () => void;
};

export function ViewerToolbar({ tool, onTool, snapTools, views, onFit, onZoomIn, onZoomOut, layersOpen, onLayers, inspectorPinned, onInspector }: ViewerToolbarProps) {
  return (
    <>
      <ShellToolbarGroup label={strings.viewer_tools_pointer}>
        <IconButton icon={<IconSelect />} label={strings.viewer_tool_select} kbd="V" pressed={tool === "select"} data-testid={TESTIDS.viewer.toolSelect} onClick={() => onTool("select")} />
        <IconButton icon={<IconPan />} label={strings.viewer_tool_pan} kbd="H" pressed={tool === "pan"} data-testid={TESTIDS.viewer.toolPan} onClick={() => onTool("pan")} />
      </ShellToolbarGroup>
      {/* Disabled with the reason, never absent: "Measurement tools arrive with S-Measure" (§3.1).
          A tool row that grows silently between milestones teaches a reader nothing about where the
          product is going; one that says so teaches them exactly that (R-UI-050's partial voice). */}
      <ShellToolbarGroup label={strings.viewer_tools_measure}>
        <IconButton icon={<IconLinear />} label={strings.viewer_tool_linear} kbd="L" disabled title={strings.viewer_tools_measure_absent} data-testid={TESTIDS.viewer.toolLinear} />
        <IconButton icon={<IconArea />} label={strings.viewer_tool_area} kbd="A" disabled title={strings.viewer_tools_measure_absent} data-testid={TESTIDS.viewer.toolArea} />
        <IconButton icon={<IconCount />} label={strings.viewer_tool_count} kbd="C" disabled title={strings.viewer_tools_measure_absent} data-testid={TESTIDS.viewer.toolCount} />
      </ShellToolbarGroup>
      <ShellToolbarGroup label={strings.viewer_snap_tools_label}>{snapTools}</ShellToolbarGroup>
      {views === undefined ? null : <ShellToolbarGroup label={strings.viewer_tools_views}>{views}</ShellToolbarGroup>}
      <ShellToolbarGroup label={strings.viewer_tools_camera}>
        <IconButton icon={<IconFit />} label={strings.viewer_fit} kbd="F" data-testid={TESTIDS.viewer.fit} onClick={onFit} />
        <IconButton icon={<IconZoomIn />} label={strings.viewer_zoom_in} kbd="+" data-testid={TESTIDS.viewer.zoomIn} onClick={onZoomIn} />
        <IconButton icon={<IconZoomOut />} label={strings.viewer_zoom_out} kbd="−" data-testid={TESTIDS.viewer.zoomOut} onClick={onZoomOut} />
      </ShellToolbarGroup>
      {/* The two panel toggles are right-aligned by the row's own last group (§3.1's `L≡ V≡`). */}
      <ShellToolbarGroup label={strings.viewer_tools_panels}>
        <IconButton icon={<IconLayers />} label={strings.viewer_tool_layers} pressed={layersOpen} data-testid={TESTIDS.viewer.layersToggle} onClick={onLayers} />
        <IconButton icon={<IconInspector />} label={strings.viewer_tool_inspector} pressed={inspectorPinned} data-testid={TESTIDS.viewer.inspectorPin} onClick={onInspector} />
      </ShellToolbarGroup>
    </>
  );
}
