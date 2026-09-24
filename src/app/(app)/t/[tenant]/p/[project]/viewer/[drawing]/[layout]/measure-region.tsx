"use client";
/**
 * S-Measure's armed tools, whole, in the viewer's route (docs/design/s-measure.md § 2, I-370–I-372):
 * the tool row's measure group and its M menu, the keys the gesture grammar binds, the measure canvas
 * with the running figure's label and the reticle, the status line's measure cell, and the hidden
 * line that speaks each gesture.
 *
 * It lives HERE, in the route, beside the snapping region it stands on, because everything it adds
 * to `useMeasure` is what a module may not reach under ARCH-01: the string table, the one roster of
 * bindings the keys are matched against (`matchesStep`, `shortcutById`, R-UI-032), R-UI-002's glyph
 * table, the format seam and the primitives. `viewer-measure/**` holds no JSX and no sentence.
 *
 * A mode of the viewer, not a route (I-370): the armed tool is the screen's local state and never
 * enters the address. While a tool is armed a plain click places a point (I-371); nothing a QS has
 * drawn is recorded until a condition is picked and its card confirmed (I-497).
 */
import "@/modules/takeoff/viewer-measure/viewer-measure.css";

import { useCallback, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { formatUserFigure } from "@/core/format";
import type { Camera } from "@/modules/takeoff/viewer";
import type { PointerTool } from "@/modules/takeoff/viewer/hooks/use-pointer";
import { segmentFigure, type FigureSi, type MeasureFigure } from "@/modules/takeoff/viewer-measure/figure";
import { isMeasureTool, pointsOf, type MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { labelAt } from "@/modules/takeoff/viewer-measure/scene";
import { useMeasure, type MeasureLive, type MeasureNote, type MeasureView, type UseMeasure } from "@/modules/takeoff/viewer-measure/use-measure";
import { keyPointOf } from "@/modules/takeoff/viewer-snap/snap";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { IconChevronDown } from "@/ui/icons";
import { BASIS_GLYPHS } from "@/ui/primitives/core/basis";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { Kbd, Tooltip } from "@/ui/primitives/core";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/primitives/overlay";
import { isTextField, matchesStep, shortcutById } from "@/ui/shell/shortcuts/roster";
import { fill, strings, type StringKey } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";

/** The roster lines this region binds, each read from the one roster and spelled nowhere else (B-17). */
const TOOL_KEYS: readonly (readonly [string, MeasureTool])[] = [
  ["viewer-linear", "linear"],
  ["viewer-area", "area"],
  ["viewer-count", "count"],
];

/** The arrow keys, as the keyboard cursor moves by them: one screen pixel, ten with Shift (§2.2). */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });
const SHIFT_STEP = 10;

/** Why a figure stays in the sheet's own units, in words (§2.4, I-501): one line per reason the snapping region names. */
const FIGURE_NOTE: Readonly<Record<Exclude<FigureSi, "calibrated">, StringKey>> = Object.freeze({
  uncalibrated: "measure_figure_uncalibrated",
  windowed: "measure_figure_windowed",
  unrecorded: "measure_figure_unrecorded",
});

/** The word each tool is called by — the tool row's own labels. */
const TOOL_COPY: Readonly<Record<MeasureTool, StringKey>> = Object.freeze({ linear: "viewer_tool_linear", area: "viewer_tool_area", count: "viewer_tool_count" });

/** The rest of the toolset (§2.1): each stands in the M menu, disabled with its reason until its slice lands. */
const COMING: readonly (readonly [string, StringKey])[] = [
  ["perimeter", "measure_tool_perimeter"],
  ["volume", "measure_tool_volume"],
  ["typical", "measure_tool_typical"],
  ["pitch", "measure_tool_pitch"],
  ["layer-region", "measure_tool_layer_region"],
  ["fill", "measure_tool_fill"],
  ["freehand", "measure_tool_freehand"],
];

/** Why the tools cannot be used, or why a click places nothing — §3's reasons, in its order. */
export type MeasureReason = "offline" | "permission" | "unscaled";

/** The status line's measure cell (§2.4): what is armed, how far the shape has come, and why not. */
export type MeasureStatus = {
  readonly tool: MeasureTool | null;
  readonly points: number;
  readonly figure: MeasureFigure | null;
  readonly reason: MeasureReason | null;
  /** The cell's value: the tool, the points and the figure — or the reason the tools stand disabled. */
  readonly words: string;
  /** The last thing the grammar said that the cell repeats, or null. */
  readonly note: string | null;
};

/** The tool row's measure group, as the toolbar places it (§2.1). */
export type MeasureTools = {
  /** Why the tools cannot be used on this sheet, in words, or null where they can (§3). */
  readonly disabled: string | null;
  readonly onArm: (tool: MeasureTool) => void;
  /** The M menu: the fourth button of the group, and the rest of the toolset behind it. */
  readonly menu: ReactNode;
};

export type MeasureRegionOptions = {
  tool: PointerTool;
  setTool: (tool: PointerTool) => void;
  snap: UseSnap;
  cameraRef: RefObject<Camera | null>;
  stageRef: RefObject<HTMLElement | null>;
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  /** The partition's views, and which of them no scale of record measures — the scale door's one answer (I-160). */
  views: readonly MeasureView[];
  unscaled: ReadonlyMap<string, string>;
  /** False only where the scale door refused this reader PERMISSION_NOT_HELD: measuring needs MEASURE (§3). */
  permitted: boolean;
  /** Where the screen's draw reaches this region's paint: a ref, so a frame never waits on a render (PB-3). */
  paintRef: RefObject<((at: Camera) => void) | null>;
  /** The name of the condition the chest picked, which the armed tool measures under, or null (S5, I-374). */
  condition?: string | null;
};

export type MeasureRegion = {
  measure: UseMeasure;
  tools: MeasureTools;
  /** The measure cell, where a tool is armed or the tools stand disabled — null otherwise (§2.4). */
  status: MeasureStatus | null;
  /** The stage's measure layer: the canvas, the label, the reticle, the point hooks and the live line. */
  layer: ReactNode;
  /** A tool asked for by a key or a button: never while a shape is in progress (I-372). */
  requestTool: (tool: PointerTool) => void;
  /** The grammar's keys, asked first by the sheet's keyboard (§2.2): true where the key was the region's. */
  onKey: (event: ReactKeyboardEvent<HTMLCanvasElement>) => boolean;
  onKeyUp: (event: ReactKeyboardEvent<HTMLCanvasElement>) => void;
};

/** A figure in the running figure's words: L, A or N and the value, grouped by the format seam (§2.4). */
export function figureWords(figure: MeasureFigure): string {
  const value = formatUserFigure(figure.value);
  // An area before its third point is measured by its live segment (§2.4).
  const segment = figure.tool === "area" && (figure.unit === "m" || figure.unit === "du");
  if (figure.unit === "count") return fill(strings.measure_figure_count, { value });
  if (segment) return fill(figure.unit === "m" ? strings.measure_figure_segment : strings.measure_figure_segment_units, { value });
  if (figure.unit === "m2") return fill(strings.measure_figure_area, { value });
  if (figure.unit === "du2") return fill(strings.measure_figure_area_units, { value });
  const total = fill(figure.unit === "m" ? strings.measure_figure_length : strings.measure_figure_length_units, { value });
  if (figure.segment === null) return total;
  return `${total} ${fill(figure.unit === "m" ? strings.measure_figure_segment : strings.measure_figure_segment_units, { value: formatUserFigure(figure.segment) })}`;
}

/** What a note says, in the region's words — or null for a note the status need not repeat. */
function noteWords(note: MeasureNote, tool: MeasureTool | null, figure: MeasureFigure | null): string | null {
  const toolWord = tool === null ? "" : strings[TOOL_COPY[tool]];
  const measured = figure === null ? "" : figureWords(figure);
  switch (note.kind) {
    case "placed":
      return fill(strings.measure_point_placed, { n: String(note.index), basis: humaniseEnum(note.basis).toLowerCase() });
    case "removed":
      return strings.measure_point_removed;
    case "finished":
      return fill(strings.measure_shape_finished, { tool: toolWord, figure: measured });
    case "cutout-started":
      return strings.measure_cutout_started;
    case "cutout-finished":
      return fill(strings.measure_cutout_finished, { figure: measured });
    case "cutout-discarded":
      return strings.measure_cutout_discarded;
    case "cutout-outside":
      return strings.measure_status_cutout_outside;
    case "reopened":
      return strings.measure_shape_reopened;
    case "kept":
      return strings.measure_draft_kept;
    case "discarded":
      return strings.measure_draft_discarded;
    case "finish-first":
      return strings.measure_status_finish_first;
    case "too-few":
      return fill(strings.measure_status_too_few, { tool: toolWord, count: String(note.needs) });
    case "degenerate":
      return strings.measure_status_degenerate;
    case "repeated":
      return strings.measure_status_repeated;
    case "pick-in-select":
      return strings.measure_status_pick_in_select;
    case "unscaled":
      return strings.measure_view_unscaled;
    case "card":
    case "leave":
      return null;
  }
}

export function useMeasureRegion({ tool, setTool, snap, cameraRef, stageRef, moveCamera, views, unscaled, permitted, paintRef, condition = null }: MeasureRegionOptions): MeasureRegion {
  const [menuOpen, setMenuOpen] = useState(false);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const noteRef = useRef<HTMLSpanElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);

  /**
   * The running figure's label and the reticle, written straight onto their elements as the live
   * point moves (PB-3): 12 px right of and below the point, clamped inside the stage (§2.4).
   */
  const onLive = useCallback(
    (live: MeasureLive | null): void => {
      const label = labelRef.current;
      const reticle = reticleRef.current;
      if (reticle !== null) {
        reticle.dataset["shown"] = String(live !== null);
        if (live !== null) reticle.style.transform = `translate(${live.at.x}px, ${live.at.y}px)`;
        reticle.dataset["refusal"] = live?.refusal ?? "";
      }
      if (label === null) return;
      const figure = live?.figure ?? null;
      if (live === null || figure === null) {
        label.dataset["shown"] = "false";
        return;
      }
      if (valueRef.current !== null) valueRef.current.textContent = figureWords(figure);
      if (noteRef.current !== null) noteRef.current.textContent = figure.si === null || figure.si === "calibrated" ? "" : strings[FIGURE_NOTE[figure.si]];
      label.dataset["shown"] = "true";
      label.dataset["value"] = figure.value;
      label.dataset["unit"] = figure.unit;
      label.dataset["si"] = figure.si ?? "";
      label.dataset["via"] = figure.via ?? "";
      const stage = stageRef.current;
      const inset = stage === null ? 0 : Number.parseFloat(getComputedStyle(stage).getPropertyValue("--space-3")) || 0;
      const at = labelAt(live.at, { width: label.offsetWidth, height: label.offsetHeight }, { width: stage?.clientWidth ?? 0, height: stage?.clientHeight ?? 0 }, inset);
      label.style.transform = `translate(${at.x}px, ${at.y}px)`;
    },
    [stageRef],
  );

  const letter = useCallback(
    (from: readonly [number, number], to: readonly [number, number]): string => {
      // A lettered segment is carried as the running figure is: through its one window on paper (I-501).
      const { value, si } = segmentFigure(from, to, snap.calibration);
      return si === "calibrated" ? fill(strings.viewer_status_distance_metres, { metres: formatUserFigure(value) }) : fill(strings.viewer_status_distance_units, { distance: formatUserFigure(value) });
    },
    [snap],
  );

  const measure = useMeasure({ tool, snap, cameraRef, stageRef, views, unscaled, glyphs: BASIS_GLYPHS, onLive, letter, moveCamera, onLeave: () => setTool("select") });
  paintRef.current = measure.paint;

  const requestTool = useCallback(
    (asked: PointerTool): void => {
      // A tool never changes under a shape in progress, whichever tool is asked for: the grammar says
      // "finish or discard first", and the outline stays (I-372).
      if (measure.busy) {
        measure.input({ kind: "tool" });
        return;
      }
      if (isMeasureTool(asked) && !permitted) return;
      setTool(asked);
    },
    [measure, permitted, setTool],
  );

  const armTool = useCallback(
    (asked: MeasureTool, rectangle = false): void => {
      if (measure.busy) {
        measure.input({ kind: "tool" });
        return;
      }
      if (!permitted) return;
      measure.setRectangle(rectangle);
      setTool(asked);
    },
    [measure, permitted, setTool],
  );

  const onKey = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): boolean => {
      if (isTextField(event.target)) return false;
      const is = (id: string): boolean => shortcutById(id).keys.some((step) => matchesStep(event, step));
      if (event.key === "Shift") {
        snap.holdShift(true);
        return false;
      }
      if (is("viewer-measure")) {
        event.preventDefault();
        if (permitted) setMenuOpen(true);
        return true;
      }
      for (const [id, asked] of TOOL_KEYS) {
        if (!is(id)) continue;
        armTool(asked);
        return true;
      }
      const armed = measure.armed;
      if (armed === null) return false;
      if (is("viewer-select") || is("viewer-pan")) {
        if (!measure.busy) return false;
        measure.input({ kind: "tool" });
        return true;
      }
      if (is("viewer-measure-finish")) {
        event.preventDefault();
        measure.input({ kind: "finish" });
        return true;
      }
      if (is("viewer-measure-undo")) {
        event.preventDefault();
        measure.input({ kind: "undo" });
        return true;
      }
      if (is("viewer-escape")) {
        measure.input({ kind: "escape" });
        return true;
      }
      if (is("viewer-measure-cutout")) {
        measure.input({ kind: "cutout" });
        return true;
      }
      if (is("viewer-measure-point")) {
        event.preventDefault();
        measure.click(1);
        return true;
      }
      const arrow = ARROWS[event.key];
      if (arrow !== undefined) {
        event.preventDefault();
        const by = event.shiftKey ? SHIFT_STEP : 1;
        measure.nudge(arrow[0] * by, arrow[1] * by);
        return true;
      }
      return false;
    },
    [armTool, measure, permitted, snap],
  );

  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
      if (event.key === "Shift") snap.holdShift(false);
    },
    [snap],
  );

  const reason: MeasureReason | null = !measure.online ? "offline" : !permitted ? "permission" : measure.refusal === "unscaled" ? "unscaled" : null;
  const disabled = permitted ? null : strings.measure_tools_permission;
  const canCut = measure.armed === "area" && (measure.draft.phase === "draft" || measure.draft.phase === "closed");

  const cut = measure.input;
  // The slot that shows the row is re-set only when what the row shows moved (PB-3).
  const menu = useMemo(() => (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip
        content={
          <span className="cx-icon-btn-hint">
            {strings.viewer_tool_measure_menu}
            <Kbd>M</Kbd>
          </span>
        }
      >
        <DropdownMenuTrigger className="cx-viewer-measure-menu" aria-label={strings.viewer_tool_measure_menu} data-testid={TESTIDS.viewer.toolMeasureMenu} disabled={disabled !== null} title={disabled ?? undefined}>
          <IconChevronDown />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent aria-label={strings.viewer_tool_measure_menu}>
        <DropdownMenuItem data-testid={TESTIDS.measure.menuItem} data-tool="rectangle" onSelect={() => armTool("area", true)}>
          {strings.measure_tool_rectangle}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid={TESTIDS.measure.menuItem} data-tool="cutout" disabled={!canCut} onSelect={() => cut({ kind: "cutout" })}>
          {strings.measure_tool_cutout}
          <Kbd>X</Kbd>
        </DropdownMenuItem>
        {COMING.map(([id, label]) => (
          <DropdownMenuItem key={id} data-testid={TESTIDS.measure.menuItem} data-tool={id} disabled title={strings.measure_tool_not_yet}>
            {strings[label]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ), [armTool, canCut, cut, disabled, menuOpen]);

  const tools = useMemo<MeasureTools>(() => ({ disabled, onArm: armTool, menu }), [armTool, disabled, menu]);

  const points = useMemo(() => pointsOf(measure.draft), [measure.draft]);
  const said = measure.note === null ? null : noteWords(measure.note.note, measure.armed, measure.figure);

  const status = useMemo<MeasureStatus | null>(() => {
    if (measure.armed === null && reason !== "permission") return null;
    const tool = measure.armed;
    const count = measure.draft.outer.length + measure.draft.cutouts.reduce((sum, ring) => sum + ring.length, 0) + measure.draft.cutting.length;
    const toolWord = tool === null ? "" : strings[TOOL_COPY[tool]];
    // Under a picked condition the cell names it (§ 4's `measure_status_drawing`); with none, the tool and its points.
    const shape =
      tool === null
        ? ""
        : condition !== null
          ? fill(strings.measure_status_drawing, { tool: toolWord, condition, points: String(count) })
          : count === 1
            ? fill(strings.measure_status_tool_one, { tool: toolWord })
            : fill(strings.measure_status_tool, { tool: toolWord, points: String(count) });
    const words = reason === "permission" ? strings.measure_tools_permission : measure.figure === null ? shape : `${shape} · ${figureWords(measure.figure)}`;
    // The cell repeats what a reader who is not looking at the pointer needs: a refusal, a reason, or
    // — a shape finished — that nothing was recorded: with no condition picked (I-497), or under one
    // whose card has not landed yet (S5; S6 brings the card that records it).
    const kind = measure.note?.note.kind;
    const note =
      reason === "offline"
        ? strings.measure_tools_offline
        : reason === "unscaled"
          ? strings.measure_view_unscaled
          : kind === "finished" || (kind === "cutout-finished" && measure.draft.phase === "draft")
            ? condition === null
              ? strings.measure_status_unrecorded
              : fill(strings.measure_status_condition_pending, { condition })
            : kind === "placed" || kind === undefined
              ? null
              : said;
    return { tool, points: count, figure: measure.figure, reason, words, note };
  }, [condition, measure.armed, measure.draft, measure.figure, measure.note, reason, said]);

  const { armed, rectangle, draft, basis, canvasRef } = measure;
  const layer =
    armed === null ? null : (
      <MeasureLayer
        tool={armed}
        shape={armed === "area" && rectangle ? "rectangle" : "polygon"}
        state={draft.phase}
        points={points}
        basis={basis}
        said={said}
        serial={measure.note?.serial ?? 0}
        canvasRef={canvasRef}
        reticleRef={reticleRef}
        labelRef={labelRef}
        valueRef={valueRef}
        noteRef={noteRef}
      />
    );

  return { measure, tools, status, layer, requestTool, onKey, onKeyUp };
}

/** What the layer shows, and the elements the live point is written onto, straight, as it moves (PB-3). */
type MeasureLayerProps = {
  tool: MeasureTool;
  shape: "polygon" | "rectangle";
  state: string;
  points: ReturnType<typeof pointsOf>;
  basis: string | null;
  said: string | null;
  serial: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  reticleRef: RefObject<HTMLDivElement | null>;
  labelRef: RefObject<HTMLDivElement | null>;
  valueRef: RefObject<HTMLSpanElement | null>;
  noteRef: RefObject<HTMLSpanElement | null>;
};

/**
 * The stage's measure layer (§2.3, §2.4, §9): the canvas the draft is painted on, the placed points as
 * data, the reticle, the running figure's label, and the one line that speaks each gesture.
 */
function MeasureLayer({ tool, shape, state, points, basis, said, serial, canvasRef, reticleRef, labelRef, valueRef, noteRef }: MeasureLayerProps) {
  return (
    <>
      <canvas
        ref={canvasRef}
        className="cx-viewer-measure-canvas"
        data-testid={TESTIDS.measure.draft}
        aria-hidden="true"
        data-tool={tool}
        data-shape={shape}
        data-state={state}
        data-points={String(points.length)}
        data-basis={basis ?? undefined}
      />
      {/* The placed points as data, for a reader of the test surface — the canvas above paints them. */}
      <div className="cx-viewer-hidden" aria-hidden="true">
        {points.map(({ ring, index, point }) => {
          const [keyX, keyY] = keyPointOf(point.at);
          return (
            <span
              key={`${ring}:${index}`}
              data-testid={TESTIDS.measure.point}
              data-ring={ring}
              data-index={String(index)}
              data-basis={point.basis}
              data-source={point.sourceKeys.join(" ")}
              data-key-x={keyX}
              data-key-y={keyY}
            />
          );
        })}
      </div>
      <div ref={reticleRef} className="cx-viewer-measure-reticle" aria-hidden="true" data-shown="false" />
      <div ref={labelRef} className="cx-viewer-measure-figure" data-testid={TESTIDS.measure.liveFigure} aria-hidden="true" data-shown="false">
        <span ref={valueRef} className="cx-viewer-measure-figure-value" />
        <span ref={noteRef} className="cx-viewer-measure-figure-note" />
      </div>
      {/* One utterance per gesture, never per pointer move (§2.9). */}
      <p className="cx-viewer-hidden" role="status" aria-live="polite" data-serial={serial}>
        {said ?? ""}
      </p>
    </>
  );
}
