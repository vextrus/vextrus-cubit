"use client";
/**
 * S-VIEWER'S TOOL PALETTE — one row of 28 px icon buttons in the frame's 32 px track (Direction §1,
 * §3.1). "AutoCAD's ribbon is the reference for PLACEMENT (tools live above the view, in groups,
 * small), not for its size: we use one row, never tabs of tabs."
 *
 * §3.1 fixes the groups and their order, left to right: Select V · Pan H | Linear L · Area A ·
 * Count C · ▾ (armed in M4: s-measure §2.1 — each arms its tool, the ▾ opens the M menu of the rest
 * of the toolset, and where the tools cannot be used here they stand disabled with the reason in the
 * tooltip) | Snap S ▾ · Ortho · Angle | Views · Grid | Fit F · + · − | right-aligned L≡ (layers
 * drawer) and V≡ (inspector pin).
 *
 * The three text buttons this replaces floated over the sheet in `cx-viewer-controls` — §8 scores
 * the viewer 1 on C1 and 2 on C11 partly for them: a control box on the canvas is canvas the reader
 * cannot use, and "Fit"/"Zoom in"/"Zoom out" as three secondary buttons is three button styles'
 * worth of weight for three tools. In the track they cost the work surface nothing at all, because
 * the track's 32 px are the grid's and were already spent (tests/ui/shell/work-surface-share.test.ts).
 *
 * The snapping toggles are NOT re-implemented here: they are the snapping region's own controls
 * (`snap-region.tsx`, B-17), handed up so the row can place them in the group §3.1 gives them.
 *
 * The groups stand inside the shell's own `ShellToolbar`: the row's `role="toolbar"`, its name
 * ("Sheet tools") and its chrome — the 32 px, the hairline under it and the 28 px icon-button pin.
 * Mounted bare into the frame's slot, as they were until session 8, the row had no name for a
 * reader, its icon buttons were 28 px only because compact density happens to make `--control-h`
 * 28, and the craft instrument, which finds the row by its test id, never measured it. What is the
 * viewer's own — the panel pair at the row's end, the text toggles at the row's 28 px — is ruled
 * under `cx-viewer-toolbar` in `viewer.css`, so the shared row, and every other screen's tools in
 * it, stand exactly as they were (I-430).
 */
import type { PointerTool } from "@/modules/takeoff/viewer/hooks/use-pointer";
import type { MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { IconArea, IconCount, IconFit, IconInspector, IconLayers, IconLinear, IconPan, IconSelect, IconZoomIn, IconZoomOut } from "@/ui/icons";
import { IconButton } from "@/ui/primitives/core";
import { ShellToolbar, ShellToolbarGroup } from "@/ui/shell";
import { strings, type StringKey } from "@/ui/strings";
import type { ReactNode } from "react";
import { TESTIDS } from "@/ui/testids";

/** The measure group's three tools, in §3.1's order: icon, word, key and id (s-measure §2.1). */
const MEASURE_BUTTONS: readonly { readonly tool: MeasureTool; readonly icon: ReactNode; readonly label: StringKey; readonly kbd: string; readonly testId: string }[] = [
  { tool: "linear", icon: <IconLinear />, label: "viewer_tool_linear", kbd: "L", testId: TESTIDS.viewer.toolLinear },
  { tool: "area", icon: <IconArea />, label: "viewer_tool_area", kbd: "A", testId: TESTIDS.viewer.toolArea },
  { tool: "count", icon: <IconCount />, label: "viewer_tool_count", kbd: "C", testId: TESTIDS.viewer.toolCount },
];

/** The measure region's own group state, placed here rather than rebuilt here (`measure-region.tsx`). */
export type ViewerToolbarMeasure = {
  /** Why the tools cannot be used on this sheet, in words, or null where they can (s-measure §3). */
  readonly disabled: string | null;
  readonly onArm: (tool: MeasureTool) => void;
  /** The ▾ button and the M menu behind it. */
  readonly menu: ReactNode;
};

export type ViewerToolbarProps = {
  /** The pointer's mode: what a drag or a click on the sheet does — a measure tool armed places points. */
  tool: PointerTool;
  onTool: (tool: "select" | "pan") => void;
  /** The measure group, where the screen composes the measure region; absent, its tools stand disabled. */
  measure?: ViewerToolbarMeasure;
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

export function ViewerToolbar({ tool, onTool, measure, snapTools, views, onFit, onZoomIn, onZoomOut, layersOpen, onLayers, inspectorPinned, onInspector }: ViewerToolbarProps) {
  return (
    <ShellToolbar label={strings.viewer_tools_label} className="cx-viewer-toolbar">
      <ShellToolbarGroup label={strings.viewer_tools_pointer}>
        <IconButton icon={<IconSelect />} label={strings.viewer_tool_select} kbd="V" pressed={tool === "select"} data-testid={TESTIDS.viewer.toolSelect} onClick={() => onTool("select")} />
        <IconButton icon={<IconPan />} label={strings.viewer_tool_pan} kbd="H" pressed={tool === "pan"} data-testid={TESTIDS.viewer.toolPan} onClick={() => onTool("pan")} />
      </ShellToolbarGroup>
      {/* Armed (s-measure §2.1): the pressed tool wears the pressed IconButton's own underline. Where
          the tools cannot be used they stand disabled with the reason in the tooltip, never absent —
          a precondition is said before the first click (§3). */}
      <ShellToolbarGroup label={strings.viewer_tools_measure}>
        {MEASURE_BUTTONS.map((button) => (
          <IconButton
            key={button.tool}
            icon={button.icon}
            label={strings[button.label]}
            kbd={button.kbd}
            pressed={tool === button.tool}
            disabled={measure === undefined || measure.disabled !== null}
            title={measure?.disabled ?? undefined}
            data-testid={button.testId}
            onClick={() => measure?.onArm(button.tool)}
          />
        ))}
        {measure?.menu}
      </ShellToolbarGroup>
      <ShellToolbarGroup label={strings.viewer_snap_tools_label}>{snapTools}</ShellToolbarGroup>
      {views === undefined ? null : <ShellToolbarGroup label={strings.viewer_tools_views}>{views}</ShellToolbarGroup>}
      <ShellToolbarGroup label={strings.viewer_tools_camera}>
        <IconButton icon={<IconFit />} label={strings.viewer_fit} kbd="F" data-testid={TESTIDS.viewer.fit} onClick={onFit} />
        <IconButton icon={<IconZoomIn />} label={strings.viewer_zoom_in} kbd="+" data-testid={TESTIDS.viewer.zoomIn} onClick={onZoomIn} />
        <IconButton icon={<IconZoomOut />} label={strings.viewer_zoom_out} kbd="−" data-testid={TESTIDS.viewer.zoomOut} onClick={onZoomOut} />
      </ShellToolbarGroup>
      {/* The two panel toggles stand at the row's end (§3.1's "right-aligned L≡ V≡"): `viewer.css`
          pushes the row's LAST group there, so this group stays last whatever joins the row. */}
      <ShellToolbarGroup label={strings.viewer_tools_panels}>
        <IconButton icon={<IconLayers />} label={strings.viewer_tool_layers} pressed={layersOpen} data-testid={TESTIDS.viewer.layersToggle} onClick={onLayers} />
        <IconButton icon={<IconInspector />} label={strings.viewer_tool_inspector} pressed={inspectorPinned} data-testid={TESTIDS.viewer.inspectorPin} onClick={onInspector} />
      </ShellToolbarGroup>
    </ShellToolbar>
  );
}
