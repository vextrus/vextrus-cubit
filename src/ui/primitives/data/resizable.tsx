"use client";
/**
 * R-UI-010's Resizable panels, on react-resizable-panels. The handle is a `role="separator"` the
 * keyboard can drive — arrow keys resize — so a split view is never a pointer-only affordance
 * (R-UI-012); it wears the reticle like every other focusable element.
 *
 * Remembered sizes are the viewer's concern (R-UI-005), so nothing here persists a layout.
 */
import type { ComponentProps } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { cx } from "../core/class-names";

export type ResizablePanelGroupProps = ComponentProps<typeof PanelGroup>;

export function ResizablePanelGroup({ className, ...rest }: ResizablePanelGroupProps) {
  return <PanelGroup {...rest} className={cx("cx-resizable", className)} />;
}

export type ResizablePanelProps = ComponentProps<typeof Panel>;

export function ResizablePanel({ className, ...rest }: ResizablePanelProps) {
  return <Panel {...rest} className={cx("cx-resizable-panel", className)} />;
}

export type ResizableHandleProps = ComponentProps<typeof PanelResizeHandle>;

/**
 * A separator the keyboard can drive must report the value it moves (R-UI-012). The library writes
 * the measured percentages onto the handle as soon as the group has a size; until then — and
 * wherever nothing lays out — the split reports the neutral range, so the role is never announced
 * without its value.
 */
const NEUTRAL_SPLIT = { min: 0, max: 100, now: 50 };

export function ResizableHandle({ className, children, ...rest }: ResizableHandleProps) {
  return (
    <PanelResizeHandle
      {...rest}
      aria-valuemin={rest["aria-valuemin"] ?? NEUTRAL_SPLIT.min}
      aria-valuemax={rest["aria-valuemax"] ?? NEUTRAL_SPLIT.max}
      aria-valuenow={rest["aria-valuenow"] ?? NEUTRAL_SPLIT.now}
      data-testid="resizable-handle"
      className={cx("cx-resizable-handle", "cx-reticle", className)}
    >
      {children ?? <span className="cx-resizable-line" aria-hidden="true" />}
    </PanelResizeHandle>
  );
}
