/**
 * The sheet feed as one concern: the head first, then each layer's geometry after it, one request
 * per layer in roster order, so first paint is the first layer of a heavy sheet rather than the
 * whole of it (R-UI-043, PB-2). A mount handed a head fetches nothing, which is how a sheet is
 * judged without a server.
 *
 * The three unhappy answers stay apart (ARCH-03): a head that cannot be read at all is handed back
 * as a failure for the screen to raise into the error boundary, a door that refused this reader is
 * reported by its status so the screen can name the register's code with the evidence a reader can
 * act on, and a layer that did not arrive is that layer's own row and never the whole sheet's
 * error cell (I-81).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderLayer, RenderManifest, ViewerHead } from "../types";

/** The facts an ingest record carries, as they arrive over the feed. */
type ViewerHeadFacts = Extract<ViewerHead, { kind: "refusal" }>["facts"];

/** One layer as the head publishes it: the swatch and the count, without the geometry. */
export type LayerRoster = {
  name: string;
  rgb: [number, number, number];
  entityCount: number;
};

/** The head as the feed answers it: the roster without the records, which are asked for one by one. */
export type HeadAnswer =
  | {
      kind: "manifest";
      cache: "hit" | "miss";
      facts: ViewerHeadFacts;
      version: 1;
      layoutName: string;
      extents: RenderManifest["extents"];
      insunits: RenderManifest["insunits"];
      digest: string;
      layers: LayerRoster[];
    }
  | { kind: "refusal"; refusal: Extract<ViewerHead, { kind: "refusal" }>["refusal"]; facts: ViewerHeadFacts }
  | { kind: "absent"; reason: "not-ingested" | "layout-unknown" };

export type UseManifestOptions = {
  /** A head handed in rather than fetched — a mount judged without a server. */
  supplied?: ViewerHead;
  /** The address one part of this sheet is asked at. The screen owns the route (ARCH-01). */
  feed: (query: string) => string;
  /** One layer's geometry, the moment it arrives. */
  onLayer: (layer: RenderLayer) => void;
  /** Whether a layer's row is standing on a failure, or has stopped (I-81). */
  onLayerFailed: (name: string, failed: boolean) => void;
  /**
   * A door that would not answer this reader, by its status. The register's code, its remedy and
   * the evidence a reader can act on are the screen's: nothing under `hooks/` may reach the string
   * table or the shell (ARCH-01).
   */
  onDenied?: (status: number) => void;
};

export type UseManifest = {
  head: ViewerHead | null;
  loadedLayers: number;
  /** Ask for one layer again, by its place in the roster and the name its row carries. */
  retryLayer: (index: number, name: string) => void;
  /** A head that could not be read at all, for the screen to raise into the error boundary. */
  failure: Error | null;
};

export function useManifest({ supplied, feed, onLayer, onLayerFailed, onDenied }: UseManifestOptions): UseManifest {
  const [head, setHead] = useState<ViewerHead | null>(supplied ?? null);
  const [loadedLayers, setLoadedLayers] = useState(supplied?.kind === "manifest" ? supplied.manifest.layers.length : 0);
  const [failure, setFailure] = useState<Error | null>(null);

  // The sinks are read off a ref rather than depended on: a screen that hands its callbacks in as
  // they are written would otherwise refetch the whole sheet on every render.
  const sink = useRef({ onLayer, onLayerFailed, onDenied });
  sink.current = { onLayer, onLayerFailed, onDenied };

  const takeLayer = useCallback(
    async (index: number, signal?: AbortSignal): Promise<boolean> => {
      // Every way one layer can fail to arrive is that layer's own row, never the whole screen's
      // error cell: a dropped connection and a body that is not JSON are the partial cell exactly as
      // a 500 is (I-81). Only a fetch this screen itself cut short is raised, and its caller ignores
      // it because leaving a sheet is not a failure anybody must be told about.
      try {
        const answer = await fetch(feed(`part=layer&index=${index}`), signal === undefined ? {} : { signal });
        if (!answer.ok) return false;
        const body = (await answer.json()) as {
          name: string;
          rgb: [number, number, number];
          entityCount: number;
          records: RenderLayer["records"];
        };
        sink.current.onLayer({ name: body.name, rgb: body.rgb, entityCount: body.entityCount, records: body.records });
        return true;
      } catch (cause) {
        if (signal?.aborted === true) throw cause;
        return false;
      }
    },
    [feed],
  );

  useEffect(() => {
    if (supplied !== undefined) {
      for (const layer of supplied.kind === "manifest" ? supplied.manifest.layers : []) sink.current.onLayer(layer);
      return;
    }

    const controller = new AbortController();
    const open = async (): Promise<void> => {
      const answer = await fetch(feed("part=head"), { signal: controller.signal });
      if (answer.status === 401 || answer.status === 403) {
        sink.current.onDenied?.(answer.status);
        return;
      }
      const body = (await answer.json()) as HeadAnswer | null;
      // An answer that is not one of the three heads is no head at all — a 500 carrying a fault id
      // is the commonest one — and it is the error cell. A sheet drawn empty out of it would be the
      // silence R-UI-020 forbids (I-81).
      if (body === null || (body.kind !== "manifest" && body.kind !== "refusal" && body.kind !== "absent")) {
        throw new Error(`the sheet feed answered ${answer.status}, which is not a head`);
      }
      if (body.kind !== "manifest") {
        setHead(body);
        return;
      }
      setHead({
        kind: "manifest",
        cache: body.cache,
        facts: body.facts,
        manifest: {
          version: body.version,
          layoutName: body.layoutName,
          extents: body.extents,
          insunits: body.insunits,
          digest: body.digest,
          layers: body.layers.map((layer) => ({ ...layer, records: [] })),
        },
      });

      // Layer by layer, in the roster's order: the first one painted is what a heavy sheet shows
      // first, and a layer that does not arrive leaves its row standing (R-UI-043, I-81).
      for (const [index, layer] of body.layers.entries()) {
        if (controller.signal.aborted) return;
        const took = await takeLayer(index, controller.signal);
        if (took) setLoadedLayers((held) => held + 1);
        else sink.current.onLayerFailed(layer.name, true);
      }
    };

    // A head that cannot be read at all is the error state and nothing else (I-81): it is handed
    // back for the screen to raise, where the root error boundary — the tree's one home for a fault
    // — takes it. A fetch cut short by this screen leaving is not a failure anybody must be told of.
    void open().catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setFailure(cause instanceof Error ? cause : new Error(String(cause)));
    });

    return () => controller.abort();
  }, [feed, supplied, takeLayer]);

  const retryLayer = useCallback(
    (index: number, name: string): void => {
      // A row the posture no longer holds names no place in the roster. Asking the feed for
      // `index=-1` would spend a request to be told so and then report that answer as a fresh
      // failure of a layer nobody is showing, which is news about nothing (R-UI-020).
      if (index < 0) return;
      // The row keeps saying the layer is missing until it is not: clearing it on the ask would
      // report a second failure as a fix, and a sheet that quietly claims to hold what it does not
      // is the silence R-UI-020 forbids.
      void takeLayer(index)
        .then((took) => {
          if (took) setLoadedLayers((held) => held + 1);
          sink.current.onLayerFailed(name, !took);
        })
        .catch(() => sink.current.onLayerFailed(name, true));
    },
    [takeLayer],
  );

  return { head, loadedLayers, retryLayer, failure };
}
