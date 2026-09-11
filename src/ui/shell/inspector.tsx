"use client";
/**
 * The shell's ONE inspector slot (Direction §1, §3.1; R-UI-080): "the shell owns one right slot; a
 * screen mounts its inspector into it (`useInspector`) and the slot is absent — width 0, not a
 * placeholder sentence — when nothing is selected. No screen renders a second right column, ever."
 *
 * The always-empty aside this replaces (`shell-inspector.tsx`) stated an absence in a sentence,
 * which is the placeholder the Direction refuses: a region that is honest about being empty is only
 * honest while something can be selected into it. With nothing selected the slot contributes no
 * column at all, and the main field takes the width the canvas law needs (R-UI-080).
 *
 * The width is the person's, and it is remembered (R-UI-005). It is held in this browser, for the
 * same reason the theme is (`theme-toggle`): a panel width is a property of the screen someone is
 * sitting at, and the same account may want 280 on a laptop and 480 at a desk. A browser that
 * refuses storage still resizes — the setting simply does not outlive the tab, and there is nothing
 * to tell anybody.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { strings } from "../strings";

/** The Direction's own three numbers (§4.2), read once here so nothing restates them in JS. */
export const INSPECTOR_WIDTH = 320;
export const INSPECTOR_WIDTH_MIN = 280;
export const INSPECTOR_WIDTH_MAX = 480;

/** Where the remembered width is held. One key: the slot is the shell's, and there is one of it. */
const STORED_WIDTH = "cx-inspector-w";

/** A width, brought inside the Direction's bounds. A stored value nobody can reach is not a width. */
export function inspectorWidthWithin(px: number): number {
  if (!Number.isFinite(px)) return INSPECTOR_WIDTH;
  return Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, Math.round(px)));
}

/** The remembered width as this browser holds it, or the Direction's default where none is held. */
export function storedInspectorWidth(read: (key: string) => string | null): number {
  const held = read(STORED_WIDTH);
  if (held === null) return INSPECTOR_WIDTH;
  const parsed = Number.parseInt(held, 10);
  return Number.isNaN(parsed) ? INSPECTOR_WIDTH : inspectorWidthWithin(parsed);
}

interface InspectorSlot {
  /** What the selected thing's detail is, or null when nothing is selected. */
  readonly content: ReactNode | null;
  readonly setContent: (content: ReactNode | null) => void;
  readonly width: number;
  readonly setWidth: (px: number) => void;
}

const InspectorContext = createContext<InspectorSlot | null>(null);

/**
 * The slot's own state, published once by the frame. A screen mounted outside the frame — the
 * gallery's evidence renderer is one — finds no provider and `useInspector` answers a no-op, so a
 * component is never made to know whether it is inside the shell.
 */
export function InspectorProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [width, setStateWidth] = useState<number>(INSPECTOR_WIDTH);

  // Read after mount, never during render: the server renders the default, and a width read from
  // this browser during the first render would be a hydration mismatch on every machine that holds
  // one. The first paint is the default and the second is theirs, which is one frame, not a flash.
  useEffect(() => {
    try {
      setStateWidth(storedInspectorWidth((key) => window.localStorage.getItem(key)));
    } catch {
      // Storage refused: the slot keeps the Direction's default, which is a working inspector.
    }
  }, []);

  const setWidth = useCallback((px: number): void => {
    const within = inspectorWidthWithin(px);
    setStateWidth(within);
    try {
      window.localStorage.setItem(STORED_WIDTH, String(within));
    } catch {
      // The drag still took; it simply does not outlive the tab.
    }
  }, []);

  const slot = useMemo<InspectorSlot>(() => ({ content, setContent, width, setWidth }), [content, width, setWidth]);
  return <InspectorContext.Provider value={slot}>{children}</InspectorContext.Provider>;
}

/**
 * What a screen mounts its inspector through: hand it the detail of what is selected, or null. The
 * slot renders exactly what it is given and nothing of its own — the shell owns the region, the
 * screen owns the words (Direction §3.1).
 */
export function useInspector(content: ReactNode | null): void {
  const slot = useContext(InspectorContext);
  const set = slot?.setContent;
  useEffect(() => {
    if (set === undefined) return;
    set(content);
    // Leaving the screen empties the slot: an inspector outliving the selection it describes would
    // be a right column belonging to a screen nobody is on.
    return () => set(null);
  }, [set, content]);
}

/** The slot as the frame reads it: what to render, and how wide. Absent means no column at all. */
export function useInspectorSlot(): { content: ReactNode | null; width: number; setWidth: (px: number) => void } {
  const slot = useContext(InspectorContext);
  if (slot === null) return { content: null, width: INSPECTOR_WIDTH, setWidth: () => undefined };
  return { content: slot.content, width: slot.width, setWidth: slot.setWidth };
}

/** How far one press of an arrow key moves the seam — the 4-pt grid, which every width sits on. */
const KEY_STEP = 4;

/**
 * The slot itself. It renders NOTHING when nothing is selected: no aside, no sentence, no column —
 * the grid's inspector track collapses to zero and the main field takes the width (R-UI-080).
 */
export function ShellInspectorSlot() {
  const { content, width, setWidth } = useInspectorSlot();
  const aside = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);

  // The drag lives on the window, not on the handle: a pointer that leaves the 4 px seam mid-drag
  // must keep resizing, which is what a person expects of every panel edge they have ever dragged.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent): void => {
      const box = aside.current?.getBoundingClientRect();
      if (box === undefined) return;
      // The seam is the panel's inline start, so the width is what remains to its end.
      setWidth(box.right - event.clientX);
    };
    const stop = (): void => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging, setWidth]);

  if (content === null) return null;

  return (
    <aside
      ref={aside}
      className="cx-shell-inspector"
      data-testid="shell-inspector"
      aria-label={strings.shell_inspector_label}
      style={{ inlineSize: `${width}px` }}
    >
      {/* A separator with a value is a control a keyboard owns too: the arrows move the seam by the
          grid's own step, so the width is reachable without a pointer (R-UI-012). */}
      <div
        className="cx-shell-inspector-handle cx-reticle"
        data-testid="shell-inspector-resize"
        role="separator"
        tabIndex={0}
        aria-label={strings.shell_inspector_resize_label}
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={INSPECTOR_WIDTH_MIN}
        aria-valuemax={INSPECTOR_WIDTH_MAX}
        onPointerDown={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onKeyDown={(event) => {
          // The inspector grows leftwards, so "wider" is the key that points away from it.
          if (event.key === "ArrowLeft") setWidth(width + KEY_STEP);
          else if (event.key === "ArrowRight") setWidth(width - KEY_STEP);
          else return;
          event.preventDefault();
        }}
      />
      <div className="cx-shell-inspector-body">{content}</div>
    </aside>
  );
}
