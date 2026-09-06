/**
 * S-Viewer's sheet feed (R-UI-043, PB-2): the head first — the layer roster, the extents, the digest
 * and the facts the reading recorded — and each layer's geometry after it, one request per layer in
 * roster order, so first paint is the first layer of a heavy sheet rather than the whole of it. A
 * mount handed a head asks for nothing, which is how a sheet is judged without a server.
 *
 * The address is handed in and never spelled here (ARCH-01): this module holds no route, no string
 * table and no refusal register. A feed that refuses is reported as the status it answered with and
 * the screen names the refusal; a head that is no head at all is reported as the error it is; a
 * layer that does not arrive is that layer's own row and never the whole screen's (ARCH-03, I-81).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefusalEntry } from "../../../../core/errors";
import type { RenderLayer, RenderManifest, ViewerHead } from "../types";

/** The facts an ingest record carries, as they arrive over the feed. */
type ViewerHeadFacts = Extract<ViewerHead, { kind: "refusal" }>["facts"];

/** One layer as the head publishes it: the swatch and the count, without the geometry. */
type LayerRoster = {
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
  | { kind: "refusal"; refusal: RefusalEntry; facts: ViewerHeadFacts }
  | { kind: "absent"; reason: "not-ingested" | "layout-unknown" };

/** What one layer's own part of the feed answers with. */
type LayerAnswer = {
  name: string;
  rgb: [number, number, number];
  entityCount: number;
  records: RenderLayer["records"];
};

export interface ManifestFeedOptions {
  /** A head handed in rather than fetched — a mount that is judged without a server. */
  supplied?: ViewerHead;
  /** The address one part of the sheet is asked at, spelled by the screen that owns the route. */
  feed: (query: string) => string;
  /** One arrived layer, handed over exactly once. */
  onLayer: (layer: RenderLayer) => void;
  /** A layer's geometry did not arrive, or arrived after all — the row says so, and stays (I-81). */
  onLayerFailed: (name: string, failed: boolean) => void;
}

export interface ManifestFeed {
  /** The sheet's head, or null while it is still in flight. */
  head: ViewerHead | null;
  /** The status a refusing feed answered with, which the screen names as a refusal (ARCH-03). */
  denied: number | null;
  /** A head that could not be read at all — the error state, raised by the screen (ARCH-03). */
  failure: Error | null;
  /** How many of the roster's layers have arrived. */
  loadedLayers: number;
  /** That layer asked for again, by its own place in the roster. */
  retryLayer: (index: number, name: string) => void;
}

/** The layers a supplied head already carries — a head that is not a manifest carries none. */
function suppliedLayers(supplied: ViewerHead | undefined): readonly RenderLayer[] {
  return supplied !== undefined && supplied.kind === "manifest" ? supplied.manifest.layers : [];
}

export function useManifest({ supplied, feed, onLayer, onLayerFailed }: ManifestFeedOptions): ManifestFeed {
  const [head, setHead] = useState<ViewerHead | null>(supplied ?? null);
  const [denied, setDenied] = useState<number | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [loadedLayers, setLoadedLayers] = useState(suppliedLayers(supplied).length);

  /**
   * The hand-offs, read off a ref rather than closed over: a screen that re-composes them is not a
   * reason to open the sheet a second time, so the feed below is keyed on the address alone.
   */
  const handlers = useRef({ onLayer, onLayerFailed });
  handlers.current = { onLayer, onLayerFailed };

  const takeLayer = useCallback(
    async (index: number, signal?: AbortSignal): Promise<boolean> => {
      // Every way one layer can fail to arrive is that layer's own row, never the whole screen's
      // error cell: a dropped connection and a body that is not JSON are the partial cell exactly as
      // a 500 is (I-81). Only a fetch this screen itself cut short is raised, and its caller ignores
      // it because leaving a sheet is not a failure anybody must be told about.
      try {
        const answer = await fetch(feed(`part=layer&index=${index}`), signal === undefined ? {} : { signal });
        if (!answer.ok) return false;
        const body = (await answer.json()) as LayerAnswer;
        handlers.current.onLayer({
          name: body.name,
          rgb: body.rgb,
          entityCount: body.entityCount,
          records: body.records,
        });
        return true;
      } catch (fault) {
        if (signal?.aborted === true) throw fault;
        return false;
      }
    },
    [feed],
  );

  useEffect(() => {
    if (supplied !== undefined) {
      for (const layer of suppliedLayers(supplied)) handlers.current.onLayer(layer);
      return;
    }

    const controller = new AbortController();
    const open = async (): Promise<void> => {
      const answer = await fetch(feed("part=head"), { signal: controller.signal });
      // A session that ended and a workspace this reader does not hold are the register's own codes,
      // named by the screen that holds the strings and the evidence they link to (ARCH-01, ARCH-03).
      if (answer.status === 401 || answer.status === 403) {
        setDenied(answer.status);
        return;
      }
      const body = (await answer.json()) as HeadAnswer | null;
      // An answer that is not one of the three heads is no head at all — a 500 carrying a fault id
      // is the commonest one — and it is the error cell, raised so the root boundary takes it. A
      // sheet drawn empty out of it would be the silence R-UI-020 forbids (I-81).
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
        else handlers.current.onLayerFailed(layer.name, true);
      }
    };

    // A head that cannot be read at all is the error state and nothing else (I-81): it is reported
    // so the screen can raise it into the render, where the root error boundary — the tree's one home
    // for a fault — takes it. A fetch cut short by this screen leaving is not such a failure.
    void open().catch((fault: unknown) => {
      if (controller.signal.aborted) return;
      setFailure(fault instanceof Error ? fault : new Error(String(fault)));
    });

    return () => controller.abort();
  }, [feed, supplied, takeLayer]);

  const retryLayer = useCallback(
    (index: number, name: string): void => {
      if (index < 0) return;
      // The row keeps saying the layer is missing until it is not: clearing it on the ask would
      // report a second failure as a fix, and a sheet that quietly claims to hold what it does not
      // is the silence R-UI-020 forbids.
      void takeLayer(index)
        .then((took) => {
          if (took) setLoadedLayers((held) => held + 1);
          handlers.current.onLayerFailed(name, !took);
        })
        .catch(() => handlers.current.onLayerFailed(name, true));
    },
    [takeLayer],
  );

  return { head, denied, failure, loadedLayers, retryLayer };
}
