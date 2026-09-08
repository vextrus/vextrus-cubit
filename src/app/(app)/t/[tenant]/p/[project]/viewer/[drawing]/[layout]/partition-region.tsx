"use client";
/**
 * S-Viewer's views/grid region, whole: the panel docked under the layers list, the overlay canvas
 * laid over the sheet, and the one act door those two stand behind (Decision § 1, § 2, I-110–I-116).
 *
 * It lives HERE, in the route, rather than beside the panel in `src/modules`, because everything
 * this file adds to the module's hooks is what a module may not reach under ARCH-01: the one
 * OfferedGroups, the one RefusalState, the one ConsequenceDialog, the string table, and the
 * addresses a refusal's evidence link promises. The panel itself takes those as slots (B-17 — one
 * offer, one refusal, one dialog in the product, not a second set per screen).
 *
 * It is a hook rather than a component because its three nodes are placed in three different parts
 * of the tree — the left stack, the stage and the screen's root — while one piece of state (what is
 * toggled, what is being confirmed, what the door refused) governs all three. A component could
 * render only one of them; `viewer-screen.tsx` places what this returns and holds none of it.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { refusalOf, type RefusalCode } from "@/core/errors";
import type { ViewGroupKey } from "@/core/acts";
import type { Camera } from "@/modules/takeoff/viewer";
import { offeredViewGroups } from "@/modules/takeoff/viewer-partition-overlay/groups";
import { PartitionPanel } from "@/modules/takeoff/viewer-partition-overlay/partition-panel";
import { overlayScene, sceneCounts } from "@/modules/takeoff/viewer-partition-overlay/scene";
import { usePartitionOverlay, useOverlayPaint } from "@/modules/takeoff/viewer-partition-overlay/use-partition-overlay";
import type { OverlayToggles } from "@/modules/takeoff/viewer-partition-overlay/types";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { OfferedGroups } from "@/ui/patterns/offered-group";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { strings } from "@/ui/strings";
import { participantsRoute } from "@/app/(app)/t/[tenant]/p/[project]/settings/participants/route-address";
import { commitConfirmViewType, previewConfirmViewType, type CommitAnswer, type PreviewAnswer } from "./partition-actions";
import { viewerSheetRoute } from "./route-address";

/** The act the views/grid panel renders — a machine identifier the dialog shows and never translates. */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE";

/** Both switches are on at every mount — nothing about them is persisted (Decision § 8's IOU). */
const BOTH_ON: OverlayToggles = { views: true, grid: true };

/**
 * The register's code a sheet feed refuses a reader with: 401 is a session that has ended, and the
 * other door this feed closes is the workspace permission the account does not hold. One home for
 * the reading both of this route's feeds make of a refused status (B-17) — the manifest's, in
 * `viewer-screen.tsx`, and this region's.
 */
export function feedRefusalCode(status: number): RefusalCode {
  return status === 401 ? "SIGNED_OUT" : "WORKSPACE_PERMISSION_NOT_HELD";
}

export type PartitionRegionOptions = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  /** The sheet's own name, as the evidence link of a refusal spells this address back (B-17). */
  sheetName: string;
  /** One part of this sheet's feed, addressed by the screen that owns the route (ARCH-01). */
  feed: (query: string) => string;
  /** Whether there is a drawn sheet to overlay yet: nothing is asked before the head is a manifest. */
  enabled: boolean;
  /** Where the camera stands, for the counts the overlay publishes after a frame. */
  camera: Camera | null;
  stageRef: RefObject<HTMLDivElement | null>;
  cameraRef: RefObject<Camera | null>;
  /** Where the screen's draw reads this region's paint: a ref, so a frame never waits on a render. */
  paintRef: RefObject<((at: Camera) => void) | null>;
};

export type PartitionRegion = {
  /** The section that docks under the layers list. */
  panel: ReactNode;
  /** The overlay canvas, laid over the sheet — null until there is a partition to paint. */
  canvas: ReactNode;
  /** The one act dialog, mounted at the screen's root. */
  dialog: ReactNode;
};

export function usePartitionRegion({ tenantId, projectId, drawingId, sheetName, feed, enabled, camera, stageRef, cameraRef, paintRef }: PartitionRegionOptions): PartitionRegion {
  /** The overlay's own canvas: paint over the sheet, out of the pointer's reach (Decision I-112). */
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * The stored partition of this sheet, asked for once the head is a manifest (R-UI-043: the feed
   * answers it after the manifest cache is warm, so a cold sheet's first paint is never delayed by
   * a reading of the store). A door that refuses this reader is the product's ONE RefusalState in
   * THIS region's body — told apart from a partition that could not be read and from a drawing
   * nobody has partitioned (ARCH-03) — and the sheet beside it is never taken down for it: what was
   * refused is the partition, not the drawing (Decision § 2, R-UI-050's partial).
   */
  const [toggles, setToggles] = useState<OverlayToggles>(BOTH_ON);
  const partition = usePartitionOverlay({ feed, enabled });
  const overlay = useOverlayPaint({ canvasRef: overlayRef, stageRef, cameraRef, overlay: partition.overlay, toggles });
  // The paint is one stable callback (PB-3), so filing it where the sheet's own draw reads it costs
  // nothing and repeats identically — the overlay lands on the frame the sheet was drawn at (I-112).
  paintRef.current = overlay.paintOverlay;

  /**
   * What the overlay canvas publishes after a frame. It is read off the scene the panel's data
   * computed rather than off the paint: a count that waited on a 2D context would be a count no
   * reader and no journey could rely on (Decision § 1).
   */
  const overlayCounts = useMemo(() => {
    const held = partition.overlay;
    return held === null || camera === null ? null : sceneCounts(overlayScene(held, toggles, camera));
  }, [camera, partition.overlay, toggles]);

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

  /** Whether a press is already at the door — a second one while it is open asks nothing twice. */
  const pressing = useRef(false);

  /**
   * A door pressed: offline is judged first (s-drawings I-89), then the pre-check, then the dialog
   * on a consequence and only on one (participants I-49, Decision § 1). A refusal of the preview is
   * this region's answer — it renders in the answer slot beside the offer, and where it is
   * `PERMISSION_NOT_HELD` the offer itself gives way to the denial (Decision § 2).
   */
  const pressGroup = useCallback(
    async (key: ViewGroupKey): Promise<void> => {
      if (pressing.current) return;
      setActRefusal(null);
      setOfflineNotice(false);
      // Reading a partition writes nothing, so the panel carries no offline banner; "read-only" binds
      // the one act, and a confirm pressed with no connection opens no dialog at all (Decision § 2).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setOfflineNotice(true);
        return;
      }
      pressing.current = true;
      try {
        const answered: PreviewAnswer = await previewConfirmViewType({ projectId, group: key });
        if (!answered.previewed) {
          setActRefusal(answered.refusal);
          return;
        }
        setConfirming(key);
        setDialogOpen(true);
      } finally {
        pressing.current = false;
      }
    },
    [projectId],
  );

  /**
   * The views/grid panel, docked under the layers list. The offer, the refusal and the dialog are
   * mounted HERE and handed in as slots: the panel lives in `src/modules`, which may not import
   * `src/ui` (ARCH-01), and there is exactly one OfferedGroups and one RefusalState (B-17).
   *
   * A reader without MEASURE keeps every row, every axis and the whole overlay — knowledge is not
   * permission (s-drawings I-90) — and loses only the door, with the register's own denial in its
   * place (Decision § 2).
   */
  const panel = (
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
          <OfferedGroups groups={offered} onConfirm={(key) => void pressGroup(key)} />
        )
      }
      answer={
        partition.refusedStatus !== null ? (
          // The feed's own refusal, in the panel's body: the code, its remedy and the address that
          // resolves it, through the product's one renderer (R-UI-020, Decision § 2).
          <RefusalState refusal={refusalOf(feedRefusalCode(partition.refusedStatus))} evidence={evidenceFor(feedRefusalCode(partition.refusedStatus))} />
        ) : offlineNotice ? (
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
  const canvas =
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

  /* R-UI-021's one act pattern: the typed consequence the server computed, the digest it is bound
     to, and the confirm that carries it. On a commit the feed is re-read — the emptied group and the
     rows' new lines are the visible answer, and there is no toast. */
  const dialog = (
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
  );

  return { panel, canvas, dialog };
}
