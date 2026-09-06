/**
 * What is held, and the address's own reading of it (R-UI-031, R-UI-050).
 *
 * The selection is part of the address exactly as the camera is: it is read once from `s` when the
 * layers holding it have arrived, and written back replaced rather than pushed, so Back leaves the
 * sheet rather than unwinding a reader's clicks. A key of the right shape that no layer of this
 * sheet carries, and a value that is no key at all, both land in the partial cell while every key
 * that was found stays selected (I-88).
 *
 * Nothing is read back from `s` until the reading is settled: a link copied while the sheet was
 * still arriving would otherwise carry the keys that had reached the browser so far. A roster's last
 * layer can *fail* rather than arrive, so what has settled is counted from both (I-88).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { parseSelection } from "../../viewer-inspector/selection";
import type { SelectedEntity } from "../../viewer-inspector/inspector-panel";
import type { Camera, ViewerHead } from "../types";
import { createSheetFacts, type SheetFacts } from "./facts";
import { useHandedRef } from "./use-handed-ref";

export type UseSelectionOptions = {
  /** What each key of this sheet is. A key it does not hold is a key this sheet does not have. */
  facts?: SheetFacts;
  /** The `s` parameter as the address carries it, or null where it carries none. */
  initialSelection: string | null;
  /** The `v` parameter: a link that names a camera is never flown, only a link that names keys. */
  initialViewport: string | null;
  head?: ViewerHead | null;
  /** How many layers of the roster arrived, and how many did not: together, whether it settled. */
  loadedLayers: number;
  failedCount: number;
  /** How many layers the roster holds, where it is not read off the head. */
  totalLayers?: number;
  /** Bumped when a layer's posture or arrival changed outside React's own state. */
  revision?: number;
  /** What the address named and this sheet holds, handed over once the reading settles (I-85). */
  reveal?: (keys: readonly string[]) => void;
  /** The keys held, off the render loop: a settling gesture publishes what is held at that moment. */
  selectionRef?: RefObject<string[]>;
  cameraRef?: RefObject<Camera | null>;
  publish?: (at: Camera) => void;
  /** The sheet this reading was made of: a new one is read again, and the same one is not. */
  drawingId?: string;
  layoutName?: string;
};

export type UseSelection = {
  /** The source keys held, in selection order — the address's `s`, and the inspector's list. */
  selection: string[];
  /** Keys an address named that this sheet does not hold: a fact, never a refusal (I-88). */
  missing: string[];
  /** The selected keys this sheet can say something about — the inspector's rows. */
  selected: SelectedEntity[];
  /** What a gesture holds. A gesture is a fresh answer to "what is selected". */
  hold: (keys: string[] | ((held: string[]) => string[])) => void;
  /** A key added to, or taken out of, what is held — Shift's own arithmetic. */
  toggleKey: (key: string) => void;
};

export function useSelection(options: UseSelectionOptions): UseSelection {
  const { facts, initialSelection, initialViewport, head, loadedLayers, failedCount, totalLayers, revision = 0 } = options;
  const { reveal, selectionRef, cameraRef, publish, drawingId = "", layoutName = "" } = options;

  const [selection, setSelection] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  /** Whether the address's own selection has been applied — it is read once, not on every arrival. */
  const takenRef = useRef(false);
  /** The address that reading was made of, so a new one is read again and the same one is not. */
  const readRef = useRef<string | null>(null);
  const ownFacts = useRef<SheetFacts>(createSheetFacts());
  const held = facts ?? ownFacts.current;
  const keysHeld = useHandedRef<string[]>(selectionRef, []);
  const cameraAt = useHandedRef(cameraRef, null);

  // The sinks are read off a ref rather than depended on, so a screen that hands its callbacks in as
  // it writes them does not make every render a new reading of the address.
  const sink = useRef({ reveal, publish });
  sink.current = { reveal, publish };

  const hold = useCallback((keys: string[] | ((prior: string[]) => string[])): void => {
    // A gesture is a fresh answer to "what is selected", so the keys a link named and this sheet
    // does not hold stop being news the moment a reader picks something for themselves: the partial
    // cell reports on an address, and this is no longer that address.
    setSelection(keys);
    setMissing([]);
  }, []);

  const toggleKey = useCallback(
    (key: string): void => {
      hold((prior) => (prior.includes(key) ? prior.filter((each) => each !== key) : [...prior, key]));
    },
    [hold],
  );

  const total = totalLayers ?? (head?.kind === "manifest" ? head.manifest.layers.length : 0);

  useEffect(() => {
    // A move to another sheet, or a new address for this one, is a new reading of `s` — kept as the
    // address it was read from rather than reset in an effect of its own, which would run after this
    // one on mount and undo the reading it had just made.
    const address = `${drawingId} ${layoutName} ${initialSelection ?? ""}`;
    if (readRef.current !== address) {
      readRef.current = address;
      takenRef.current = false;
    }
    if (takenRef.current) return;
    // A head that is not a manifest holds no keys; a mount that names no head is judged on its own.
    if (head !== undefined && head?.kind !== "manifest") return;

    const asked = parseSelection(initialSelection);
    const arrived = loadedLayers + failedCount >= total;
    const found = asked.keys.filter((key) => held.has(key));
    const settled = asked.keys.length === 0 || found.length === asked.keys.length || arrived;
    if (!settled) return;

    takenRef.current = true;
    if (asked.keys.length > 0) setSelection(found);
    setMissing([...asked.malformed, ...asked.keys.filter((key) => !held.has(key))]);
    // A camera the address states is the camera the reader gets: only a link that named keys and no
    // viewport flies to them, and only then is `data-flyto` ever written (I-85).
    if (found.length > 0 && initialViewport === null) sink.current.reveal?.(found);
  }, [drawingId, failedCount, head, held, initialSelection, initialViewport, layoutName, loadedLayers, revision, total]);

  // What is held is part of the address exactly as the camera is, and it is replaced onto it, never
  // pushed: Back leaves the sheet rather than unwinding a reader's clicks (R-UI-031).
  useEffect(() => {
    keysHeld.current = selection;
    const at = cameraAt.current;
    if (at !== null) sink.current.publish?.(at);
  }, [cameraAt, keysHeld, selection]);

  /** One selected key as the inspector lists it — the keys this sheet has not met yet are not rows. */
  const selected: SelectedEntity[] = selection.flatMap((key) => {
    const fact = held.get(key);
    return fact === undefined ? [] : [{ key, type: fact.type, layer: fact.layer, box: fact.box }];
  });

  return { selection, missing, selected, hold, toggleKey };
}
