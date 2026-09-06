/**
 * What is held on a sheet (R-UI-031, R-UI-050): the facts each source key stands for, the keys the
 * reader has taken, the keys an address named that this sheet does not hold, and the marks all of
 * that is painted with.
 *
 * The address is the state: `s` is read once per address rather than once per arrival, and it is
 * never written back until the reading has settled — a link copied while the sheet was still
 * arriving would otherwise carry the keys that had reached the browser so far. A key of the right
 * shape that no layer of this sheet carries, and a value that is no key at all, both land in the
 * partial cell while every key that was found stays selected (I-88).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { recordBox, recordKey, type IndexBox } from "../client";
import type { Painter } from "../painter";
import type { Camera, RenderLayer, RenderRecord, ViewerHead } from "../types";
import { parseSelection, unionBox } from "../../viewer-inspector/selection";
import type { SelectedEntity } from "../../viewer-inspector/inspector-panel";

/** What one source key of this sheet is: what it paints, where it lives, and how far it reaches. */
export type KeyFact = {
  type: string;
  layer: string;
  box: IndexBox;
  records: RenderRecord[];
};

/**
 * What every source key of this sheet is, gathered as the layers arrive. It is what a hover, a
 * selection row and a reveal read; the index in the worker answers *which* keys, and this answers
 * what they are (I-86: a key that paints many pieces is one atom, spanning all of them).
 */
export interface SheetFacts {
  get: (key: string) => KeyFact | undefined;
  has: (key: string) => boolean;
  /**
   * One arrived layer's records, filed under the key each is selected by. A store that is a reading
   * of a sheet rather than one being gathered has nothing to file, and says so by not offering this.
   */
  learn?: (layer: RenderLayer) => void;
}

export interface SelectionOptions {
  head: ViewerHead | null;
  drawingId: string;
  layoutName: string;
  /** The `s` parameter as the address carries it, or null where it carries none. */
  initialSelection: string | null;
  /** The `v` parameter: an address that names one is not flown anywhere (I-85). */
  initialViewport: string | null;
  loadedLayers: number;
  failedCount: number;
  /**
   * What every source key of this sheet stands for. A store handed in is the one read and learned
   * into; where none is, this hook keeps its own — either way a sheet has one set of facts (B-17).
   */
  facts?: SheetFacts;
  /** The travel the address asks for, told to whoever owns the fly-to (R-UI-022, I-85). */
  reveal?: (keys: readonly string[]) => void;
  /* Every one of the rest is a collaborator this hook draws *through* rather than a fact it reads,
     so each is optional and its absence is silence: what is held is answered from the keys alone,
     and a mount with no painter, no camera and no address still reads `s` and still says what this
     sheet does not hold (ARCH-01 — a hook owes an answer to whoever composes it, not a set of
     preconditions for being composed at all). */
  /** The layers' revision — the last layer of a roster can fail rather than arrive (I-81). */
  revision?: number;
  /** The layers being painted right now, as one value an effect can be keyed on. */
  drawnLayers?: string;
  painterRef?: { current: Painter | null };
  cameraRef?: { current: Camera | null };
  draw?: (camera: Camera) => void;
  /** The address written again with the camera as it stands — what is held is part of it. */
  republish?: () => void;
}

export interface HeldSelection {
  /** The source keys held, in selection order — the address's `s`, and the inspector's list. */
  selection: string[];
  /** Keys an address named that this sheet does not hold: a fact, never a refusal (I-88). */
  missing: string[];
  /** Those of them this sheet knows, as the inspector lists them. */
  selected: SelectedEntity[];
  facts: SheetFacts;
  learn: (layer: RenderLayer) => void;
  /** What a gesture holds — a fresh answer to "what is selected". */
  hold: (keys: string[] | ((held: string[]) => string[])) => void;
  /** A key added to, or taken out of, what is held — Shift's own arithmetic. */
  toggleKey: (key: string) => void;
}

/** A sheet's key facts, gathered layer by layer. */
function createSheetFacts(): SheetFacts {
  const held = new Map<string, KeyFact>();
  return {
    learn: (layer) => {
      for (const record of layer.records) {
        const key = recordKey(record);
        const box = recordBox(record);
        if (key === undefined || box === null) continue;
        const met = held.get(key);
        // A key that paints more than one record keeps the first record's type and layer and spans
        // every piece's box, because that is the one thing a reader selected (I-86).
        if (met === undefined) {
          held.set(key, { type: record.type, layer: layer.name, box, records: [record] });
          continue;
        }
        met.records.push(record);
        met.box = unionBox([met.box, box]) ?? met.box;
      }
    },
    get: (key) => held.get(key),
    has: (key) => held.has(key),
  };
}

export function useSelection({
  head,
  drawingId,
  layoutName,
  initialSelection,
  initialViewport,
  loadedLayers,
  failedCount,
  facts: supplied,
  reveal,
  revision = 0,
  drawnLayers = "",
  painterRef,
  cameraRef,
  draw,
  republish,
}: SelectionOptions): HeldSelection {
  const [selection, setSelection] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  const ownFacts = useRef<SheetFacts | null>(null);
  ownFacts.current ??= createSheetFacts();
  const facts = supplied ?? ownFacts.current;

  /** Whether the address's own selection has been applied — it is read once, not on every arrival. */
  const addressTakenRef = useRef(false);
  /** The address that reading was made of, so a new one is read again and the same one is not. */
  const addressReadRef = useRef<string | null>(null);

  const learn = useCallback((layer: RenderLayer): void => facts.learn?.(layer), [facts]);

  /**
   * A gesture is a fresh answer to "what is selected", so the keys a link named and this sheet does
   * not hold stop being news the moment a reader picks something for themselves: the partial cell
   * reports on an address, and this is no longer that address.
   */
  const hold = useCallback((keys: string[] | ((held: string[]) => string[])): void => {
    setSelection(keys);
    setMissing([]);
  }, []);

  const toggleKey = useCallback(
    (key: string): void => {
      hold((held) => (held.includes(key) ? held.filter((each) => each !== key) : [...held, key]));
    },
    [hold],
  );

  /** The keys this sheet has not met yet are not rows — and a layer arriving makes one of them one,
   *  so the list is taken fresh rather than memoised on a selection that did not change (I-86). */
  const selected: SelectedEntity[] = selection.flatMap((key) => {
    const met = facts.get(key);
    return met === undefined ? [] : [{ key, type: met.type, layer: met.layer, box: met.box }];
  });

  // What is held is part of the address exactly as the camera is, and it is replaced onto it, never
  // pushed: Back leaves the sheet rather than unwinding a reader's clicks (R-UI-031).
  useEffect(() => {
    republish?.();
  }, [republish, selection]);

  // What is held is painted from its own buffer, so a selection of a whole sheet costs no
  // re-tessellation of a single layer batch (PB-3).
  //
  // Only what is drawn is marked: a selected entity whose layer is then hidden, isolated away or
  // failed stays listed and stays in `s` — the address is the state, and a layer toggle may not
  // silently rewrite a link someone shared — but it is not painted, because a mark on a layer that
  // is not there would be paint claiming to sit on geometry nobody can see (Decision § 2's partial).
  useEffect(() => {
    const painter = painterRef?.current ?? null;
    if (painter === null) return;
    const painted = new Set(drawnLayers === "" ? [] : drawnLayers.split("\n"));
    painter.setSelection(
      selection.flatMap((key) => {
        const met = facts.get(key);
        return met === undefined || !painted.has(met.layer) ? [] : met.records;
      }),
    );
    const at = cameraRef?.current ?? null;
    if (at !== null) draw?.(at);
  }, [cameraRef, draw, drawnLayers, facts, head, loadedLayers, painterRef, selection]);

  /**
   * The selection the address named, applied once the layers holding it have arrived.
   *
   * `revision` is read because the last layer of a roster can *fail* rather than arrive: a failure
   * writes a ref and bumps, `loadedLayers` never moves again, and without it the reading below would
   * never run — a deep link naming a key on that layer would be met with silence instead of the
   * partial cell R-UI-050 owes (I-81).
   */
  useEffect(() => {
    // A move to another sheet, or a new address for this one, is a new reading of `s` — kept as the
    // address it was read from rather than reset in an effect of its own, which would run after this
    // one on mount and undo the reading it had just made.
    const address = `${drawingId} ${layoutName} ${initialSelection ?? ""}`;
    if (addressReadRef.current !== address) {
      addressReadRef.current = address;
      addressTakenRef.current = false;
    }
    if (addressTakenRef.current || head?.kind !== "manifest") return;
    const asked = parseSelection(initialSelection);
    const arrived = loadedLayers + failedCount >= head.manifest.layers.length;
    const found = asked.keys.filter((key) => facts.has(key));
    const settled = asked.keys.length === 0 || found.length === asked.keys.length || arrived;
    // Nothing is written back to the address until the reading is settled: a link copied while the
    // sheet was still arriving would otherwise carry the keys that had reached the browser so far.
    if (!settled) return;

    addressTakenRef.current = true;
    if (asked.keys.length > 0) setSelection(found);
    setMissing([...asked.malformed, ...asked.keys.filter((key) => !facts.has(key))]);
    // A camera the address states is the camera the reader gets: only a link that named keys and no
    // viewport asks for the travel, and only then is `data-flyto` ever written (I-85). The reading
    // is made once per address, so the travel is asked for once.
    if (found.length > 0 && initialViewport === null) reveal?.(found);
  }, [drawingId, facts, failedCount, head, initialSelection, initialViewport, layoutName, loadedLayers, reveal, revision]);

  return { selection, missing, selected, facts, learn, hold, toggleKey };
}
