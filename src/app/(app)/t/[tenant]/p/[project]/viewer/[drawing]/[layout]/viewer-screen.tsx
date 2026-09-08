"use client";
/**
 * S-Viewer's client screen (Decision § 1): the layers panel beside the sheet, the sheet itself on a
 * WebGL canvas, and the readout under both.
 *
 * The screen is composition and nothing else. Every effect the sheet runs — the feed, the layer
 * posture, the painter, the camera and its settle, the index in its worker, what is held, the
 * reveal, the pointer and the keyboard — is one hook of its own under
 * `src/modules/takeoff/viewer/hooks/`; what is left here is the wiring, the markup, and the two
 * things a module may not reach (ARCH-01): the address, whose one home is `./address.ts` (B-17),
 * and the string table.
 *
 * The three unhappy answers stay apart (ARCH-03): a reading nothing can be drawn from is the
 * registered refusal with its facts, an ended session and a workspace this reader does not hold
 * are the register's own codes through the same one renderer, and a drawing nobody has read yet
 * is an absence that teaches rather than an error.
 */
import "./viewer.css";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { REFUSALS, refusalOf, type RefusalCode } from "@/core/errors";
import type { ViewGroupKey } from "@/core/acts";
import type { Camera, RenderLayer, ViewerHead } from "@/modules/takeoff/viewer";
import type { Painter } from "@/modules/takeoff/viewer/painter";
import { createSheetFacts, learn } from "@/modules/takeoff/viewer/hooks/facts";
import { useCamera } from "@/modules/takeoff/viewer/hooks/use-camera";
import { useHitTesting } from "@/modules/takeoff/viewer/hooks/use-hit-testing";
import { useKeyboard } from "@/modules/takeoff/viewer/hooks/use-keyboard";
import { useLayers } from "@/modules/takeoff/viewer/hooks/use-layers";
import { useManifest } from "@/modules/takeoff/viewer/hooks/use-manifest";
import { usePainter } from "@/modules/takeoff/viewer/hooks/use-painter";
import { usePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import { useReveal } from "@/modules/takeoff/viewer/hooks/use-reveal";
import { useSelection } from "@/modules/takeoff/viewer/hooks/use-selection";
import { offeredViewGroups } from "@/modules/takeoff/viewer-partition-overlay/groups";
import { PartitionPanel } from "@/modules/takeoff/viewer-partition-overlay/partition-panel";
import { overlayScene, sceneCounts } from "@/modules/takeoff/viewer-partition-overlay/scene";
import { usePartitionOverlay, useOverlayPaint } from "@/modules/takeoff/viewer-partition-overlay/use-partition-overlay";
import type { OverlayToggles } from "@/modules/takeoff/viewer-partition-overlay/types";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { OfferedGroups } from "@/ui/patterns/offered-group";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { shellHref } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { projectHomeRoute } from "@/app/(app)/t/[tenant]/p/[project]/home/areas";
import { participantsRoute } from "@/app/(app)/t/[tenant]/p/[project]/settings/participants/route-address";
import { publishViewport } from "./address";
import { FidelityFacts } from "./fidelity-facts";
import { commitConfirmViewType, previewConfirmViewType, type CommitAnswer, type PreviewAnswer } from "./partition-actions";
import { SheetBones } from "./viewer-bones";
import { layoutNameOf, viewerSheetRoute } from "./route-address";
import { StatusLine } from "./status-line";
import { ViewerStage } from "./viewer-stage";

/** The act the views/grid panel renders — a machine identifier the dialog shows and never translates. */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE";

/** Both switches are on at every mount — nothing about them is persisted (Decision § 8's IOU). */
const BOTH_ON: OverlayToggles = { views: true, grid: true };

/** What the route hands the screen. `head` is supplied only where a mount is judged without a server. */
export type ViewerScreenProps = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  layoutName: string;
  /** The `v` parameter as the address carries it, or null where it carries none. */
  initialViewport: string | null;
  /** The `s` parameter as the address carries it, or null where it carries none. */
  initialSelection: string | null;
  head?: ViewerHead;
};

export function ViewerScreen({ tenantId, projectId, drawingId, layoutName, initialViewport, initialSelection, head: supplied }: ViewerScreenProps) {
  /** The status a door refused this reader with, if one did — the code it maps to is decided below. */
  const [denied, setDenied] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** The overlay's own canvas: paint over the sheet, out of the pointer's reach (Decision I-112). */
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  /** The keys held, off the render loop: a gesture publishes the address without a stale closure. */
  const selectionRef = useRef<string[]>([]);
  /** Every layer whose geometry has arrived, and what each source key of it is — one home each. */
  const arrived = useRef<Map<string, RenderLayer>>(new Map());
  const facts = useRef(createSheetFacts()).current;

  /**
   * The sheet this address names. Next hands a page its `[layout]` segment exactly as the path
   * spells it — `FOUNDATION%20PLAN` for a sheet whose name carries a space — so the segment is read
   * once, here, and the sheet's own name is shown to a reader and asked of the feed (B-17).
   */
  const sheetName = layoutNameOf(layoutName);
  const feed = useCallback((query: string) => `/api/viewer/${drawingId}/${encodeURIComponent(sheetName)}?tenant=${encodeURIComponent(tenantId)}&${query}`, [drawingId, sheetName, tenantId]);

  /**
   * The address this sheet was opened at, captured as this ref is first made rather than in an
   * effect, so a camera published before the effects have run is written rather than dropped. Read
   * again whenever the sheet changes — that reading is an effect, and every effect of this screen is
   * a hook's, so `useCamera` runs it over this ref (R-UI-031).
   */
  const ownPathname = useRef(typeof window === "undefined" ? "" : window.location.pathname);

  /**
   * R-UI-031: the address is the camera and the selection, written by the one module that decides
   * that (B-17). The selection is read off its ref, so a camera published from a settling gesture
   * carries whatever is held at that moment rather than what was held when it started.
   */
  const publish = useCallback((at: Camera): void => {
    if (typeof window === "undefined") return;
    publishViewport(window, ownPathname.current, at, selectionRef.current);
  }, []);

  /** One arrived layer, filed where the painter and the index read it, and read for what it holds. */
  const onLayer = useCallback(
    (layer: RenderLayer): void => {
      arrived.current.set(layer.name, layer);
      learn(facts, layer);
    },
    [facts],
  );

  // The row a failed layer stands on is the posture's to keep (I-81), and the posture is made from
  // the head the feed answers with — so the feed reaches it through what this render last wired.
  const failedSink = useRef<(name: string, failed: boolean) => void>(() => undefined);
  const onLayerFailed = useCallback((name: string, failed: boolean): void => failedSink.current(name, failed), []);

  const sheet = useManifest({ supplied, feed, onLayer, onLayerFailed, onDenied: setDenied });
  const layers = useLayers({ head: sheet.head });
  failedSink.current = layers.markFailed;

  /**
   * The stored partition of this sheet, asked for once the head is a manifest (R-UI-043: the feed
   * answers it after the manifest cache is warm, so a cold sheet's first paint is never delayed by
   * a reading of the store). A door that refuses this reader is the screen's ONE refusal, told apart
   * from a partition that could not be read and from a drawing nobody has partitioned (ARCH-03).
   */
  const [toggles, setToggles] = useState<OverlayToggles>(BOTH_ON);
  const partition = usePartitionOverlay({ feed, enabled: sheet.head?.kind === "manifest", onDenied: setDenied });
  const overlay = useOverlayPaint({ canvasRef: overlayRef, stageRef, cameraRef, overlay: partition.overlay, toggles });

  // Every sheet frame paints the overlay again, at the very camera the sheet was drawn at: the
  // outline is data and never tweens, so a toggle, a camera move and a confirmation all land on the
  // next frame (Decision I-112, § 4).
  const draw = useCallback(
    (at: Camera): void => {
      painterRef.current?.draw(at, layers.stateRef.current);
      overlay.paintOverlay(at);
    },
    [layers.stateRef, overlay],
  );
  const pulse = useCallback((durationMs: number): void => void painterRef.current?.pulse(durationMs), []);

  const camera = useCamera({ head: sheet.head, initialViewport, stageRef, cameraRef, draw, publish, ownPathname, sheetKey: `${drawingId}/${layoutName}` });
  const trace = useReveal({ head: sheet.head, stageRef, facts, cameraRef, moveCamera: camera.moveCamera, jumpTo: camera.jumpTo, pulse });
  const held = useSelection({ facts, head: sheet.head, initialSelection, initialViewport, loadedLayers: sheet.loadedLayers, failedCount: layers.failedCount, revision: layers.revision, reveal: trace.reveal, selectionRef, cameraRef, publish, drawingId, layoutName });
  const index = useHitTesting({ head: sheet.head, layers: arrived, loadedLayers: sheet.loadedLayers, stateRef: layers.stateRef, statusRef, cameraRef });
  const pointer = usePointer({ head: sheet.head, canvasRef, cameraRef, facts, keysUnder: index.keysUnder, ask: index.ask, openLayers: layers.openLayers, hold: held.hold, toggleKey: held.toggleKey, moveCamera: camera.moveCamera });
  const keyboard = useKeyboard({ moveCamera: camera.moveCamera, zoomBy: camera.zoomBy, fitSheet: camera.fitSheet, hold: held.hold });
  const paint = usePainter({ head: sheet.head, refused: denied !== null, canvasRef, stageRef, statusRef, painterRef, stateRef: layers.stateRef, cameraRef, layers: arrived, facts, loadedLayers: sheet.loadedLayers, drawnLayers: layers.drawnLayers, selection: held.selection, hovered: pointer.hovered });

  /**
   * What the overlay canvas publishes after a frame. It is read off the scene the panel's data
   * computed rather than off the paint: a count that waited on a 2D context would be a count no
   * reader and no journey could rely on (Decision § 1).
   */
  const overlayCounts = useMemo(() => {
    const held = partition.overlay;
    const at = camera.camera;
    return held === null || at === null ? null : sceneCounts(overlayScene(held, toggles, at));
  }, [camera.camera, partition.overlay, toggles]);

  /** L-ACT-02's offer, derived from the views the partition carries — never assembled by a reader. */
  const offered = useMemo(() => (partition.overlay === null ? [] : offeredViewGroups(partition.overlay.views, drawingId)), [drawingId, partition.overlay]);

  /** The group a dialog is open over, the door's answer, and the notice a press offline leaves. */
  const [confirming, setConfirming] = useState<ViewGroupKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actRefusal, setActRefusal] = useState<RefusalCode | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);

  /** Where a refusal of the confirm door is resolved — the address the label promises (R-UI-020). */
  const evidenceFor = useCallback(
    (code: RefusalCode): { href: string; label: string } => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD")
        return { href: participantsRoute(tenantId, projectId), label: strings.viewer_partition_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: viewerSheetRoute(tenantId, projectId, drawingId, sheetName), label: strings.viewer_partition_evidence_reload };
    },
    [drawingId, projectId, sheetName, tenantId],
  );

  /** The rejection shape the one dialog resolves a refusal from (consequence-dialog I-40). */
  const refusedAnswer = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const dialogPreview = useCallback(async () => {
    if (confirming === null) throw new Error("the consequence dialog was opened with no group to preview");
    const answered: PreviewAnswer = await previewConfirmViewType({ projectId, group: confirming });
    if (!answered.previewed) throw refusedAnswer(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [confirming, projectId, refusedAnswer]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (confirming === null) throw new Error("the consequence dialog committed with no group to carry");
      const answered: CommitAnswer = await commitConfirmViewType({ projectId, group: confirming, consequenceDigest });
      if (!answered.committed) throw refusedAnswer(answered.refusal);
      return { actId: answered.actId };
    },
    [confirming, projectId, refusedAnswer],
  );

  /** A door pressed: offline is judged first (s-drawings I-89), then the one dialog opens over it. */
  const pressGroup = useCallback((key: ViewGroupKey): void => {
    setActRefusal(null);
    setOfflineNotice(false);
    // Reading a partition writes nothing, so the panel carries no offline banner; "read-only" binds
    // the one act, and a confirm pressed with no connection opens no dialog at all (Decision § 2).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOfflineNotice(true);
      return;
    }
    setConfirming(key);
    setDialogOpen(true);
  }, []);

  // A head that cannot be read at all is the error state and nothing else: it is raised into the
  // render, where the root error boundary — the tree's one home for a fault — takes it (I-81).
  if (sheet.failure !== null) throw sheet.failure;

  const head = sheet.head;
  /** Whether a sheet can be drawn at all here — a browser with no WebGL context cannot (I-82). */
  const drawable = !(paint.probed && paint.renderer === "unavailable");
  // "Go to the project" lands on the project home the label names, spelled by that screen's own
  // address rather than respelled here (Decision § 2, B-17): the reader already stands inside a
  // project, so the workspace list is not the address this evidence promises (R-UI-020).
  const projectEvidence = { href: projectHomeRoute(tenantId, projectId), label: strings.viewer_evidence_project };
  // The evidence a denied reader can act on is their own workspace, not the signed-out home the
  // label does not promise — a refusal's link lands on the address it names (R-UI-020).
  const feedRefusal =
    denied === 401
      ? { refusal: REFUSALS.SIGNED_OUT, evidence: { href: "/sign-in", label: strings.shell_evidence_sign_in } }
      : denied === null
        ? null
        : { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD, evidence: { href: shellHref(tenantId, "projects"), label: strings.shell_denied_evidence } };

  /**
   * The views/grid panel, docked under the layers list. The offer, the refusal and the dialog are
   * mounted HERE and handed in as slots: the panel lives in `src/modules`, which may not import
   * `src/ui` (ARCH-01), and there is exactly one OfferedGroups and one RefusalState (B-17).
   *
   * A reader without MEASURE keeps every row, every axis and the whole overlay — knowledge is not
   * permission (s-drawings I-90) — and loses only the door, with the register's own denial in its
   * place (Decision § 2).
   */
  const partitionRegion = (
    <PartitionPanel
      state={partition.phase}
      overlay={partition.overlay}
      toggles={toggles}
      onToggle={(which, on) => setToggles((held) => ({ ...held, [which]: on }))}
      onRetry={partition.retry}
      faultId={partition.faultId}
      groups={
        actRefusal === "PERMISSION_NOT_HELD" ? (
          <>
            <p className="cx-viewer-partition-denied">{strings.viewer_partition_denied_permission}</p>
            <p className="cx-viewer-partition-denied">{strings.viewer_partition_denied_holder}</p>
          </>
        ) : (
          <OfferedGroups groups={offered} onConfirm={pressGroup} />
        )
      }
      answer={
        offlineNotice ? (
          <p className="cx-viewer-partition-notice" role="alert">
            {strings.viewer_partition_offline}
          </p>
        ) : actRefusal === null ? null : (
          <RefusalState refusal={refusalOf(actRefusal)} evidence={evidenceFor(actRefusal)} />
        )
      }
    />
  );

  /* The overlay canvas mounts only once there is a partition to paint, and publishes what the scene
     holds so a journey reads what the machine sees rather than counting pixels (Decision § 1). */
  const overlayCanvas =
    partition.overlay === null || overlayCounts === null ? null : (
      <canvas
        className="cx-viewer-partition-canvas"
        data-testid="viewer-partition-canvas"
        aria-hidden="true"
        ref={overlayRef}
        data-outlines={String(overlayCounts.outlines)}
        data-hatched={String(overlayCounts.hatched)}
        data-axes={String(overlayCounts.axes)}
        data-bubbles={String(overlayCounts.bubbles)}
      />
    );

  const workArea = (): ReactNode => {
    if (feedRefusal !== null) {
      return (
        <div className="cx-viewer-refusal">
          <RefusalState refusal={feedRefusal.refusal} evidence={feedRefusal.evidence} />
        </div>
      );
    }
    if (head === null) {
      return (
        <div className="cx-viewer-loading" data-testid="viewer-loading">
          <span className="cx-viewer-hidden">{strings.viewer_loading_label}</span>
          <SheetBones />
        </div>
      );
    }
    if (head.kind === "refusal") {
      return (
        <div className="cx-viewer-refusal">
          <RefusalState refusal={head.refusal} evidence={projectEvidence} />
          <FidelityFacts facts={head.facts} />
        </div>
      );
    }
    if (head.kind === "absent") {
      const unread = head.reason === "not-ingested";
      return (
        <div className="cx-viewer-empty" data-testid="viewer-empty">
          <h2 className="cx-viewer-empty-heading">{unread ? strings.viewer_empty_unread_heading : strings.viewer_empty_sheet_heading}</h2>
          <p className="cx-viewer-empty-body">{unread ? strings.viewer_empty_unread_body : strings.viewer_empty_sheet_body}</p>
          <a className="cx-btn cx-reticle cx-viewer-empty-action" data-variant="secondary" href={projectEvidence.href}>
            <span className="cx-btn-label">{projectEvidence.label}</span>
          </a>
        </div>
      );
    }

    return (
      <ViewerStage
        partition={partitionRegion}
        overlay={overlayCanvas}
        panel={{
          rows: layers.rows,
          onVisible: layers.setVisible,
          onIsolate: layers.isolate,
          onLock: layers.setLocked,
          onRetry: (name) => sheet.retryLayer(layers.rows.findIndex((row) => row.name === name), name),
          // A whole layer taken, in the order the index answers it — the keyboard path to a selection.
          onSelectLayer: (name) => void index.ask({ kind: "layer", layer: name }).then((keys) => held.hold(keys.filter((key) => facts.has(key)))),
        }}
        pointer={pointer}
        // The source key goes to the clipboard exactly as it stands — nothing stripped, nothing
        // trimmed (R-TO-011). A browser that refuses the write refuses that promise, and the row
        // goes on offering the copy rather than claiming to have made one.
        inspector={{ hover: pointer.hovered, selection: held.selected, missing: held.missing, onCopy: (key) => navigator.clipboard.writeText(key), onReveal: () => trace.reveal(held.selection), onClear: () => held.hold([]) }}
        onKeyDown={keyboard.onKeyDown}
        stageRef={stageRef}
        canvasRef={canvasRef}
        sheetName={sheetName}
        drawable={drawable}
        probed={paint.probed}
        renderer={paint.renderer}
        onFit={camera.fitSheet}
        onZoom={camera.zoomBy}
      />
    );
  };

  return (
    <div className="cx-viewer" data-testid="viewer-screen" data-project={projectId} data-flyto={trace.flyto ?? undefined}>
      {/* The sheet names itself once, as the house style has every screen do: heading navigation
          lands on the sheet a reader opened rather than nowhere (R-UI-050's siblings, axe). */}
      <h1 className="cx-viewer-hidden">{fill(strings.viewer_canvas_label, { layout: sheetName })}</h1>
      <div className="cx-viewer-work">{workArea()}</div>
      <StatusLine
        statusRef={statusRef}
        layoutName={sheetName}
        sheet={camera.camera !== null && head?.kind === "manifest"}
        scale={camera.camera?.scale ?? 0}
        loadedLayers={sheet.loadedLayers}
        totalLayers={head?.kind === "manifest" ? head.manifest.layers.length : 0}
        drawnEntities={layers.state.drawnEntityCount()}
        entityCount={layers.state.entityCount()}
        selectionCount={held.selected.length}
        firstPaint={paint.firstPaint}
        renderer={paint.renderer}
        partial={layers.rows.some((row) => row.failed)}
      />
      {/* R-UI-021's one act pattern: the typed consequence the server computed, the digest it is
          bound to, and the confirm that carries it. On a commit the feed is re-read — the emptied
          group and the rows' new lines are the visible answer, and there is no toast. */}
      <ConsequenceDialog
        open={dialogOpen}
        actType={CONFIRM_VIEW_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          setConfirming(null);
          partition.retry();
        }}
      />
    </div>
  );
}
