"use client";
// The condition chest's wiring to the measure region (s-measure §2.6, I-374), kept out of the screen,
// which composes hooks only. The chest is composed AHEAD of the region, whose status names the
// condition picked, so a pick arms the region's tool through what the screen's render last wired;
// and the chest's digits are asked ahead of the grammar's keys (1–9 pick a condition and arm its tool).
import { useCallback, useRef, type MutableRefObject } from "react";
import { isMeasureTool, type MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { useMeasureChest, type ChestDoors, type UseMeasureChest } from "./measure-chest";

type Armed = { arm: (asked: MeasureTool) => void; busy: () => boolean };
type ChestOptions = { projectId: string; enabled: boolean; tool: string; doors: ChestDoors | undefined };

/** The chest, and the late-bound door its pick arms the region through. */
export function useChest({ projectId, enabled, tool, doors }: ChestOptions): { chest: UseMeasureChest; wired: MutableRefObject<Armed> } {
  const wired = useRef<Armed>({ arm: () => undefined, busy: () => false });
  const onArm = useCallback((asked: MeasureTool): void => wired.current.arm(asked), []);
  const isBusy = useCallback((): boolean => wired.current.busy(), []);
  const chest = useMeasureChest({ projectId, enabled, onArm, isBusy, armed: isMeasureTool(tool) ? tool : null, ...(doors === undefined ? {} : { doors }) });
  return { chest, wired };
}

/** Wires the region the chest arms, and answers one key handler: the chest's digits first, then the grammar's keys. */
export function useChestKeys<E>(
  { chest, wired }: { chest: UseMeasureChest; wired: MutableRefObject<Armed> },
  region: { tools: { onArm: (asked: MeasureTool) => void }; measure: { busy: boolean }; onKey: (event: E) => boolean },
): (event: E) => boolean {
  wired.current = { arm: region.tools.onArm, busy: () => region.measure.busy };
  const chestKey = chest.onKey as (event: E) => boolean;
  const regionKey = region.onKey;
  return useCallback((event: E): boolean => chestKey(event) || regionKey(event), [chestKey, regionKey]);
}
