"use client";
/**
 * The Trace's two readings as a screen holds them (R-UI-022, X-2): the evidence of the line an
 * address named, and what the held selection is cited by. Both are state over a door's answer plus
 * the composition of the block the inspector renders — one concern, so it stands in one module
 * rather than in the screen that shows it (B-17, ARCH-02).
 *
 * The doors arrive as arguments. This is `src/modules`, which may not import a route's server
 * actions (ARCH-01), and the same reading is reached two ways — the route's actions in the browser
 * and `takeoff.lineEvidence` / `takeoff.linesCiting` on the wire — so the reading may not be welded
 * to either (risk note 4).
 *
 * A refusal is not a fault and is never swallowed: it is handed back to the caller, which answers it
 * where the sheet's own refusals are answered, through the one renderer with a remedy (ARCH-03,
 * B-21). A line the project does not hold is neither refusal nor fault — it is a fact about the
 * address, and it is the `missing` cell (I-88's idiom).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuantityBasis } from "@/core/offers/law";
import type { CitedBlock, CitedLine, TraceBlock, TraceEvidence } from "../viewer-inspector/inspector-panel";
import { originAddress } from "./address";

/** What a read of one line's evidence answers: the evidence, the fact that there is none, or a refusal. */
export type EvidenceAnswer = { read: true; evidence: TraceEvidence | null } | { read: false; refusal: string };

/** What a read of the citing lines answers. Each row carries its own address's parts, never the address. */
export type CitingAnswer = { read: true; lines: readonly Omit<CitedLine, "href">[] } | { read: false; refusal: string };

/** The door that reads one line's evidence — the route's server action, or any other spelling of it. */
export type EvidenceDoor = (request: { projectId: string; lineId: string }) => Promise<EvidenceAnswer>;

/** The door that reads the lines citing a sheet's keys. */
export type CitingDoor = (request: { projectId: string; drawingId: string; sourceKeys: readonly string[] }) => Promise<CitingAnswer>;

/**
 * How the read of the line a Trace address named stands. `pending` is the read in flight and shows
 * no block at all — the three cells the block renders are answers, and a block that stated one of
 * them before the door had answered would state a fact nobody had established (R-UI-050).
 */
type Reading = { state: "pending" | "ready" | "missing" | "failed"; evidence: TraceEvidence | null };

export type UseLineEvidenceOptions = {
  tenantId: string;
  projectId: string;
  /** The `line` the address named, or null where it named none — then nothing is read and no block stands. */
  lineId: string | null;
  read: EvidenceDoor;
  /** A registered refusal, handed to the screen that owns how this sheet answers one (ARCH-03). */
  onRefused: (refusal: string) => void;
};

export type LineEvidenceHold = {
  /** The block the selection tab renders, or null while the read is in flight or nothing was named. */
  readonly block: TraceBlock | null;
  /** The basis the traced number was measured on — the colour its arrival is struck in (R-UI-002). */
  readonly basis: QuantityBasis | undefined;
  /** Whether the door has answered at all: the travel waits for this, so it flies in the right colour. */
  readonly ready: boolean;
};

export function useLineEvidence({ tenantId, projectId, lineId, read, onRefused }: UseLineEvidenceOptions): LineEvidenceHold {
  const [reading, setReading] = useState<Reading>({ state: lineId === null ? "ready" : "pending", evidence: null });
  // What a caller does with a refusal is the caller's, and it may spell that inline: holding it here
  // keeps a fresh closure each render from re-reading a line nothing has changed about.
  const refused = useRef(onRefused);
  refused.current = onRefused;

  // Made at mount and made again by the `failed` cell's own door, which is why it is a callback and
  // not the body of the effect below.
  const readLine = useCallback((): void => {
    if (lineId === null) return;
    setReading({ state: "pending", evidence: null });
    void read({ projectId, lineId })
      .then((answer) => {
        if (!answer.read) {
          refused.current(answer.refusal);
          setReading({ state: "failed", evidence: null });
          return;
        }
        setReading(answer.evidence === null ? { state: "missing", evidence: null } : { state: "ready", evidence: answer.evidence });
      })
      .catch(() => setReading({ state: "failed", evidence: null }));
  }, [lineId, projectId, read]);

  useEffect(() => readLine(), [readLine]);

  const block: TraceBlock | null =
    lineId === null || reading.state === "pending"
      ? null
      : { state: reading.state, lineId, evidence: reading.evidence, originHref: originAddress(tenantId, projectId, lineId), onRetry: readLine };

  return { block, basis: reading.evidence?.quantityBasis, ready: reading.state !== "pending" };
}

export type UseCitedByOptions = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  /** The source keys held on the sheet right now — what the answer is about (X-2's other direction). */
  selection: readonly string[];
  read: CitingDoor;
};

export function useCitedBy({ tenantId, projectId, drawingId, selection, read }: UseCitedByOptions): CitedBlock | null {
  const [cited, setCited] = useState<CitedBlock | null>(null);
  // The effect turns on WHICH keys are held, not on the identity of the array a render happened to
  // build, so a re-render that holds the same keys reads nothing again.
  const heldKeys = selection.join(",");

  useEffect(() => {
    const keys = heldKeys === "" ? [] : heldKeys.split(",");
    // Nothing held is nothing to be cited by: the block is absent rather than empty, because the
    // panel's own empty state is what teaches a reader with no selection (R-UI-050).
    if (keys.length === 0) {
      setCited(null);
      return;
    }
    let live = true;
    void read({ projectId, drawingId, sourceKeys: keys })
      .then((answer) => {
        if (!live) return;
        setCited(
          answer.read
            ? { state: "ready", lines: answer.lines.map((line) => ({ ...line, href: originAddress(tenantId, projectId, line.lineId) })) }
            : { state: "failed", lines: [] },
        );
      })
      .catch(() => {
        if (live) setCited({ state: "failed", lines: [] });
      });
    return () => {
      live = false;
    };
  }, [drawingId, heldKeys, projectId, read, tenantId]);

  return cited;
}
