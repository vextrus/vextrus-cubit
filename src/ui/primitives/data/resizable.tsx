"use client";
/**
 * R-UI-010's Resizable panels, on react-resizable-panels (v4: `Group`, `Panel`, `Separator`). The
 * handle is a `role="separator"` the keyboard can drive — arrow keys resize — so a split view is
 * never a pointer-only affordance (R-UI-012); it wears the reticle like every other focusable
 * element.
 *
 * Sizes are strings with their unit: v4 reads a bare number as PIXELS, so a share of the group is
 * spelled `"30%"` — typecheck accepts either, and a number would silently change the geometry.
 *
 * Remembered sizes are the viewer's concern (R-UI-005): a group persists only when its caller names
 * the key (`autoSaveId`), and nothing here chooses one.
 */
import { Group, Panel, Separator, useDefaultLayout, type GroupProps, type LayoutStorage, type PanelProps, type SeparatorProps } from "react-resizable-panels";
import { cx } from "../core/class-names";
import { TESTIDS } from "@/ui/testids";

/**
 * Where a remembered split lives. The group renders on the server first, where there is no
 * `localStorage` (the library's default would throw there), so the server reads nothing and writes
 * nothing; a browser that refuses storage reads as one with nothing stored, as v2's own read did.
 */
const BROWSER_STORAGE: LayoutStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
};

export type ResizablePanelGroupProps = GroupProps & {
  /**
   * The key the split is remembered under (R-UI-005, viewer Decision I-84); omitted, nothing is
   * stored. v4 dropped the group's own `autoSaveId`, so the one spelling lives here and feeds
   * `useDefaultLayout`, which also reads a layout v2 stored under the same key.
   */
  autoSaveId?: string | undefined;
  /**
   * The ids of the panels the group mounts, in DOM order. A group whose panels come and go is
   * remembered once per combination, so closing a panel never overwrites the width it had.
   */
  panelIds?: string[] | undefined;
};

export function ResizablePanelGroup({ autoSaveId, panelIds, className, ...rest }: ResizablePanelGroupProps) {
  const props = { ...rest, className: cx("cx-resizable", className) };
  return autoSaveId === undefined ? <Group {...props} /> : <RememberedGroup {...props} autoSaveId={autoSaveId} panelIds={panelIds} />;
}

/** A group with a key: its hook runs only where a caller asked for a remembered split. */
function RememberedGroup({ autoSaveId, panelIds, ...rest }: GroupProps & { autoSaveId: string; panelIds: string[] | undefined }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: autoSaveId, panelIds, storage: BROWSER_STORAGE });
  return <Group {...rest} defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} />;
}

export type ResizablePanelProps = PanelProps;

/**
 * v4 hangs `className` on an inner box the library styles `overflow: auto`, and an inline style
 * outranks the class: the panel's `overflow: hidden` (`.cx-resizable-panel`) is restated inline so a
 * panel never grows its own scrollbars — the regions inside it own their scrolling.
 */
export function ResizablePanel({ className, style, ...rest }: ResizablePanelProps) {
  return <Panel {...rest} className={cx("cx-resizable-panel", className)} style={{ overflow: "hidden", ...style }} />;
}

/** The wrapper owns the handle's element ref: it is how the handle carries its test id. */
export type ResizableHandleProps = Omit<SeparatorProps, "elementRef">;

/**
 * The test contract's id for the handle (primitives-data Decision §7). v4 spells `data-testid` with
 * the separator's own id, after anything passed to it, so the id is set on the element once it
 * mounts; React never writes that attribute again while the separator's id stands. The `id` prop is
 * not used for it: a page may hold several splits, and a DOM id must be unique.
 *
 * The separator's `aria-valuemin/max/now` are the library's own, measured from the layout — it
 * writes them over any a caller passes (R-UI-012).
 */
const nameHandle = (element: HTMLDivElement | null): void => {
  element?.setAttribute("data-testid", TESTIDS.resizable.handle);
};

export function ResizableHandle({ className, children, ...rest }: ResizableHandleProps) {
  return (
    <Separator {...rest} elementRef={nameHandle} className={cx("cx-resizable-handle", "cx-reticle", className)}>
      {children ?? <span className="cx-resizable-line" aria-hidden="true" />}
    </Separator>
  );
}
