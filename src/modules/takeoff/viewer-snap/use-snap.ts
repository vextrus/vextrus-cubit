"use client";
/**
 * S-Viewer's snapping as one concern (Decision § 1): what the pointer meets on the drawing, the two
 * constraints a taken pick anchors, the picks themselves, and the figures the readout states.
 *
 * The maths is `./snap.ts` and the overlay's geometry is `./scene.ts`; what is here is the state a
 * reader changes and the wiring to the sheet the screen already holds. Under ARCH-01 this module
 * holds no import of `src/ui`: every element and every sentence of this region is the route's
 * (I-151), and this hook answers data.
 *
 * A hover is not a render (PB-3). The glyph's position is written straight onto its element as the
 * pointer moves, and React state is set only when what the readout SAYS changes — the kind, the keys,
 * and, while a pick stands, the live point the figure is measured to.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { buildSpatialIndex, hitTest, recordKey, type SpatialIndex, type ViewerState } from "@/modules/takeoff/viewer/client";
import type { Camera, RenderLayer, RenderRecord } from "@/modules/takeoff/viewer";
import type { GridAxisRow } from "@/modules/takeoff/partition";
import {
  ANGLE_STEP_DEG,
  SNAP_TOLERANCE_PX,
  constrainAngle,
  constrainOrtho,
  distanceBetween,
  gridIntersectionsOf,
  keyPointOf,
  metresBetween,
  resolveSnap,
  viewMeasuring,
} from "./snap";
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import { snapScene, type SnapScene } from "./scene";
import type { GridIntersection, SnapCalibration, SnapPick, SnapPoint, SnapResult } from "./types";

/** How many decimals the readout's drawing-unit figure is stated to (Decision § 5). */
const UNIT_DECIMALS = 1;

/**
 * How many decimals the offsets are published at. The figures a reader sees are stated to one
 * decimal; `data-dx`/`data-dy` are the segment ITSELF, and a journey reads the angle lock's 15° step
 * back off them — so they carry the direction faithfully rather than to the figure's own precision.
 */
const OFFSET_DECIMALS = 6;

/** The two doors a feed refuses a reader at. They are the SCREEN's to render, through its one home. */
const REFUSED: readonly number[] = [401, 403];

/** The media query the glyph's draw-in is read from (R-UI-004). */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** How a mark drew itself in, as the glyph publishes it for a journey to grade. */
export type SnapMotion = "full" | "reduced";

/** What the distance cell states: the picks standing, the segment between them, and its metres. */
export type SnapReadout = {
  readonly picks: number;
  /** The segment being measured, in drawing units — 0 while no pick stands. */
  readonly dx: number;
  readonly dy: number;
  /** The drawing-unit figure, or null while no pick stands (R-UI-041: drawing units always). */
  readonly distance: string | null;
  readonly si: "calibrated" | "uncalibrated";
  /** The view whose affirmed scale carried the segment into metres, named only when one did. */
  readonly viewKey: string | null;
  readonly metres: string | null;
  /** The calibration could not be read at all — the figure stands and the cell says so (R-UI-050). */
  readonly unread: boolean;
};

/**
 * What the hidden live region has to say — a FACT, never a sentence: under I-151 this module holds
 * no copy, and the route renders the registered line for whichever of the two happened.
 */
export type SnapAnnouncement = { readonly kind: "taken"; readonly index: number; readonly keyPoint: readonly [string, string] } | { readonly kind: "cleared" };

export type UseSnapOptions = {
  /** Every layer whose geometry has arrived, by name — what the candidates are narrowed from. */
  layers?: RefObject<Map<string, RenderLayer>>;
  /** The layer posture: a layer nobody can see is not a point of the drawing to snap to (I-87). */
  stateRef?: RefObject<ViewerState | null>;
  /** Where the camera stands right now, off the render loop — a hover is not a render (PB-3). */
  cameraRef?: RefObject<Camera | null>;
  /** Where the camera stands as the tree last rendered it: what the overlay's marks are placed by. */
  camera: Camera | null;
  /** The stored grid axes the screen already holds, paired into crossings here (I-149). */
  axes?: readonly GridAxisRow[];
  /** The scale of record over this sheet, as `?part=calibration` answered it. */
  calibration?: SnapCalibration | null;
  /** Whether the calibration read failed — the metre figure is absent and the cell says why. */
  calibrationUnread?: boolean;
};

export type UseSnap = {
  enabled: boolean;
  ortho: boolean;
  angle: boolean;
  motion: SnapMotion;
  /** What the pointer is meeting right now, or null where it meets nothing within reach. */
  snap: SnapResult | null;
  picks: readonly SnapPick[];
  /** What the picks last did, for the region's own live line (R-UI-060) — null until they do. */
  announcement: SnapAnnouncement | null;
  readout: SnapReadout;
  scene: SnapScene;
  /** The glyph's element: its position is written straight onto it as the pointer moves (PB-3). */
  glyphRef: RefObject<HTMLDivElement | null>;
  toggleSnapping: () => void;
  pressOrtho: () => void;
  pressAngle: () => void;
  /** The pointer moved onto a world point of the sheet. */
  onHover: (world: SnapPoint) => void;
  /** The pointer left the sheet, so nothing is under it. */
  onLeave: () => void;
  /** A pick taken where the live point stands (I-145). */
  takePick: () => void;
  /** Both picks let go of. */
  clearPicks: () => void;
};

/** One number as a data attribute: fixed precision, with the trailing zeros a reader never sees. */
function figure(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

/** What the readout is showing when nothing has been picked yet. */
const NO_PICKS: SnapReadout = Object.freeze({ picks: 0, dx: 0, dy: 0, distance: null, si: "uncalibrated", viewKey: null, metres: null, unread: false });

/** Whether this machine is asking for reduced motion right now (R-UI-004). */
function readsReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
}

/** The sheet as the snap narrows it: the index over what has arrived, and every record by its key. */
type Sheet = { readonly index: SpatialIndex; readonly records: Map<string, RenderRecord[]>; readonly signature: string };

/** An empty sheet — what a screen holds before any geometry has arrived. */
const NO_SHEET: Sheet = { index: { root: null, size: 0 }, records: new Map(), signature: "" };

/**
 * What the geometry a screen holds amounts to right now: the layers arrived and the records they
 * hold. It is read at every hover and costs one pass over the layer roster, so the index below is
 * rebuilt when a layer arrives or is fetched again and at no other time.
 */
function sheetSignature(layers: Map<string, RenderLayer>): string {
  let records = 0;
  for (const layer of layers.values()) records += layer.records.length;
  return `${layers.size}:${records}`;
}

/**
 * The layers as they stand, read for snapping: the viewer's OWN R-tree over them (B-17 — one index
 * structure, one hit-test), and the records behind the keys it answers, because the six kinds are
 * computed from a record's geometry rather than from its name.
 */
function readSheet(layers: Map<string, RenderLayer>): Sheet {
  const held = [...layers.values()];
  const signature = sheetSignature(layers);
  const records = new Map<string, RenderRecord[]>();
  for (const layer of held) {
    for (const record of layer.records) {
      const key = recordKey(record);
      if (key === undefined) continue;
      const under = records.get(key);
      if (under === undefined) records.set(key, [record]);
      else under.push(record);
    }
  }
  return { index: buildSpatialIndex({ layers: held }), records, signature };
}

export function useSnap({ layers, stateRef, cameraRef, camera, axes, calibration = null, calibrationUnread = false }: UseSnapOptions): UseSnap {
  const [enabled, setEnabled] = useState(true);
  const [ortho, setOrtho] = useState(false);
  const [angle, setAngle] = useState(false);
  const [motion, setMotion] = useState<SnapMotion>("full");
  const [snap, setSnap] = useState<SnapResult | null>(null);
  const [live, setLive] = useState<SnapPoint | null>(null);
  const [picks, setPicks] = useState<readonly SnapPick[]>([]);
  const [announcement, setAnnouncement] = useState<SnapAnnouncement | null>(null);

  const glyphRef = useRef<HTMLDivElement | null>(null);
  /** The sheet's index and records, kept across renders and rebuilt only when the geometry moves. */
  const sheetRef = useRef<Sheet>(NO_SHEET);
  /** What a pointer handler must read without a stale closure — a hover is not a render (PB-3). */
  const heldRef = useRef({ enabled, ortho, angle, picks, snap, live });
  heldRef.current = { enabled, ortho, angle, picks, snap, live };

  /** The crossings of the stored grid, paired within each view and never across one (I-149). */
  const grid = useMemo<readonly GridIntersection[]>(() => (axes === undefined ? [] : gridIntersectionsOf(axes)), [axes]);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  // R-UI-004: the duration token is zeroed at source, and the glyph publishes the same reading so a
  // journey can grade it. Read at mount rather than at first render, so a server rendering and a
  // browser one agree, and again whenever the machine's own answer changes.
  useEffect(() => {
    const read = (): void => setMotion(readsReducedMotion() ? "reduced" : "full");
    read();
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION);
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  /** The glyph put where the drawing was met, written straight onto the element (§ 1, PB-3). */
  const writeGlyph = useCallback(
    (at: { x: number; y: number } | null): void => {
      const element = glyphRef.current;
      if (element === null || at === null) return;
      element.style.transform = `translate(${at.x}px, ${at.y}px)`;
    },
    [],
  );

  /**
   * What the pointer meets at a world point: the sheet narrowed to the records within reach by the
   * viewer's own hit-test, and the six kinds resolved over their geometry and the stored grid.
   */
  const resolveAt = useCallback(
    (world: SnapPoint): SnapResult | null => {
      const at = cameraRef?.current ?? null;
      if (at === null) return null;
      const held = layers?.current ?? null;
      if (held === null) return null;
      if (sheetSignature(held) !== sheetRef.current.signature) sheetRef.current = held.size === 0 ? NO_SHEET : readSheet(held);

      const tolerance = SNAP_TOLERANCE_PX / at.scale;
      // A layer nobody is looking at is not a point of the drawing: it is not painted, so a snap to
      // it would be a mark standing on nothing. A LOCKED layer is painted and is snapped to — a
      // reader may measure against reference geometry they may not select (I-87).
      const unseen = (stateRef?.current?.layerRows() ?? []).filter((row) => !row.drawn).map((row) => row.name);
      const candidates: RenderRecord[] = [];
      for (const key of hitTest(sheetRef.current.index, [world[0], world[1]], tolerance, unseen)) {
        for (const record of sheetRef.current.records.get(key) ?? []) candidates.push(record);
      }
      return resolveSnap({ cursor: world, tolerance, candidates, grid: gridRef.current, firstPick: heldRef.current.picks[0]?.point ?? null });
    },
    [cameraRef, layers, stateRef],
  );

  /**
   * Where the live point stands for a raw cursor: the snapped point where something was met, then
   * constrained against the first pick where a constraint is pressed. With no pick standing there is
   * no anchor, so both constraints are inert and say nothing false (I-148).
   */
  const liveOf = useCallback((world: SnapPoint, met: SnapResult | null): SnapPoint => {
    const held = heldRef.current;
    const raw: SnapPoint = met === null ? world : met.point;
    const anchor = held.picks[0]?.point ?? null;
    if (anchor === null) return raw;
    if (held.ortho) return constrainOrtho(anchor, raw);
    if (held.angle) return constrainAngle(anchor, raw, ANGLE_STEP_DEG);
    return raw;
  }, []);

  const onHover = useCallback(
    (world: SnapPoint): void => {
      const held = heldRef.current;
      const met = held.enabled ? resolveAt(world) : null;
      const at = liveOf(world, met);
      const camera = cameraRef?.current ?? null;
      if (met !== null && camera !== null) {
        const [x, y] = screenAt(camera, met.point);
        writeGlyph({ x, y });
      }

      // The readout follows the pointer only while it has something to say about it: the kind and the
      // keys under it, and — while one pick stands — the point the figure is being measured to. A
      // pointer sliding over bare paper with nothing picked changes nothing a reader can read.
      const before = held.snap;
      // What a gesture reads is written first and unconditionally: a pick taken at this point stands
      // where the pointer stands, whether or not the readout had anything new to say about it.
      heldRef.current = { ...held, snap: met, live: at };
      const changed =
        (before === null) !== (met === null) ||
        (before !== null && met !== null && (before.kind !== met.kind || before.keyPoint[0] !== met.keyPoint[0] || before.keyPoint[1] !== met.keyPoint[1] || before.sourceKeys.join(" ") !== met.sourceKeys.join(" ")));
      const follows = held.picks.length === 1 && (held.live === null || held.live[0] !== at[0] || held.live[1] !== at[1]);
      if (!changed && !follows) return;
      setSnap(met);
      setLive(at);
    },
    [cameraRef, liveOf, resolveAt, writeGlyph],
  );

  const onLeave = useCallback((): void => {
    heldRef.current = { ...heldRef.current, snap: null, live: null };
    setSnap(null);
    setLive(null);
  }, []);

  const takePick = useCallback((): void => {
    const held = heldRef.current;
    const at = held.live;
    if (at === null) return;
    const taken: SnapPick = {
      index: held.picks.length === 1 ? 2 : 1,
      point: [at[0], at[1]],
      sourceKeys: held.enabled && held.snap !== null ? [...held.snap.sourceKeys] : [],
      keyPoint: keyPointOf(at),
    };
    // Two picks are a measurement; a third begins the next one, so a reader measuring twice is not
    // made to clear the first pair before they may.
    const next = held.picks.length === 1 ? [held.picks[0] as SnapPick, taken] : [taken];
    heldRef.current = { ...held, picks: next };
    setPicks(next);
    setAnnouncement({ kind: "taken", index: taken.index, keyPoint: taken.keyPoint });
  }, []);

  const clearPicks = useCallback((): void => {
    // Escape is one press doing two things in order (I-145), and it is pressed on a quiet canvas as
    // often as on a busy one: with nothing to let go of, there is nothing to announce either.
    if (heldRef.current.picks.length === 0) return;
    heldRef.current = { ...heldRef.current, picks: [] };
    setPicks([]);
    setAnnouncement({ kind: "cleared" });
  }, []);

  const toggleSnapping = useCallback((): void => {
    const on = !heldRef.current.enabled;
    heldRef.current = { ...heldRef.current, enabled: on, snap: null };
    setEnabled(on);
    // With snapping off no glyph mounts at all, wherever the pointer stands (AC-2).
    setSnap(null);
  }, []);

  /* The two constraints are exclusive: pressing one releases the other, because two constraints on
     one segment would be one constraint with a hidden winner (I-148). */
  const pressOrtho = useCallback((): void => {
    setOrtho((held) => !held);
    setAngle(false);
  }, []);

  const pressAngle = useCallback((): void => {
    setAngle((held) => !held);
    setOrtho(false);
  }, []);

  /** What the distance cell states, derived from the picks standing and the scale of record. */
  const readout = useMemo<SnapReadout>(() => {
    const first = picks[0];
    if (first === undefined) return { ...NO_PICKS, unread: calibrationUnread };
    const second = picks[1];
    const to = second?.point ?? live;
    if (to === null || to === undefined) return { ...NO_PICKS, picks: 1, unread: calibrationUnread };

    const measuring = second === undefined ? null : viewMeasuring(calibration, first.point, second.point);
    return {
      picks: picks.length,
      dx: Number(figure(to[0] - first.point[0], OFFSET_DECIMALS)),
      dy: Number(figure(to[1] - first.point[1], OFFSET_DECIMALS)),
      distance: distanceBetween(first.point, to).toFixed(UNIT_DECIMALS),
      si: measuring === null ? "uncalibrated" : "calibrated",
      viewKey: measuring?.viewKey ?? null,
      metres: measuring === null || second === undefined ? null : metresBetween(first.point, second.point, measuring),
      unread: calibrationUnread,
    };
  }, [calibration, calibrationUnread, live, picks]);

  const scene = useMemo<SnapScene>(() => snapScene({ camera, enabled, snap, picks, live }), [camera, enabled, live, picks, snap]);

  return {
    enabled,
    ortho,
    angle,
    motion,
    snap,
    picks,
    announcement,
    readout,
    scene,
    glyphRef,
    toggleSnapping,
    pressOrtho,
    pressAngle,
    onHover,
    onLeave,
    takePick,
    clearPicks,
  };
}

export type UseSnapCalibrationOptions = {
  /** One part of this sheet's feed, addressed by the screen that owns the route (ARCH-01). */
  feed: (query: string) => string;
  /** Whether there is a drawn sheet to measure on yet: a head that is not a manifest is asked nothing. */
  enabled: boolean;
  /** The answer, where a mount supplies one instead of a served feed. */
  supplied?: SnapCalibration | null;
  /** The status a door refused this read at — the SCREEN renders it, through its one home (I-150). */
  onDenied?: (status: number) => void;
};

export type UseSnapCalibration = {
  calibration: SnapCalibration | null;
  /** The read failed: the drawing-unit figure stands and the cell says why there are no metres. */
  unread: boolean;
};

/** What the feed answers under `?part=calibration` (the route's own shape). */
type CalibrationAnswer = { calibration: SnapCalibration | null };

/**
 * The scale of record over this sheet, asked for once the head is a manifest (R-UI-043: after the
 * manifest is warm, so a cold sheet's first paint is never delayed by a reading of the store).
 *
 * Every way it can fail to arrive is the readout's own partial cell and never the sheet's: a
 * calibration that cannot be read costs the reader metres, not the drawing (Decision § 2). The two
 * refusals are different in kind and are handed to the screen, which renders the register's own code
 * in the one place a refusal of this feed belongs (ARCH-03, I-150).
 */
export function useSnapCalibration({ feed, enabled, supplied, onDenied }: UseSnapCalibrationOptions): UseSnapCalibration {
  const [calibration, setCalibration] = useState<SnapCalibration | null>(supplied ?? null);
  const [unread, setUnread] = useState(false);
  const denied = useRef(onDenied);
  denied.current = onDenied;

  useEffect(() => {
    if (supplied !== undefined) {
      setCalibration(supplied);
      setUnread(false);
      return;
    }
    if (!enabled) return;
    const controller = new AbortController();

    const open = async (): Promise<void> => {
      setUnread(false);
      const answer = await fetch(feed("part=calibration"), { signal: controller.signal });
      if (REFUSED.includes(answer.status)) {
        denied.current?.(answer.status);
        return;
      }
      const body = (await answer.json()) as CalibrationAnswer | null;
      if (!answer.ok || body === null || !("calibration" in body)) {
        setUnread(true);
        return;
      }
      setCalibration(body.calibration);
    };

    void open().catch(() => {
      if (controller.signal.aborted) return;
      setUnread(true);
    });

    return () => controller.abort();
  }, [enabled, feed, supplied]);

  return { calibration, unread };
}
