"use client";
/**
 * S-Viewer's rooms region (viewer.md Part 7, I-687): the rooms panel docked last in the left
 * column, and the one act dialog it stands behind. It lives in the route for the partition region's
 * reason — the one OfferedGroups, RefusalState, ConsequenceDialog, Select and the string table are what
 * a module may not reach (ARCH-01). It is a component the stage mounts in the left column once there
 * is a drawn sheet (the stage stands only then); its dialog is portalled to the screen's root, so the
 * act is shown inside the screen that raised it (consequence-dialog I-167).
 *
 * On its first reading of a drawing whose rooms include some the labels cannot type and Jev has not
 * been asked about, it asks once (I-688) and reads again; a reader the ask door refuses keeps the
 * panel, with those rooms said as waiting — knowledge is not permission.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { RoomsGroupKey } from "@/core/acts";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { ROOM_TYPES, type RoomType } from "@/core/rooms/room-types";
import { RoomsPanel } from "@/modules/takeoff/rooms-ui";
import type { RoomsPanelPlan, RoomsPanelRoom, RoomsPanelView } from "@/modules/takeoff/rooms-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { OfferedGroups } from "@/ui/patterns/offered-group";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EnumLabel, Select } from "@/ui/primitives/core";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { participantsRoute } from "@/app/(app)/t/[tenant]/p/[project]/settings/participants/route-address";
import { askRooms, commitRooms, previewRooms, readRooms, type RoomsCommitAnswer, type RoomsPreviewAnswer } from "./rooms-actions";
import { viewerSheetRoute } from "./route-address";

/** The act this region renders — a machine identifier the dialog shows in words. */
const CONFIRM_ROOMS = "CONFIRM_ROOMS";

/** The kind a single room is confirmed under, spelled against the seam's own union (B-17). */
const ROOM: Extract<RoomsGroupKey, { kind: "ROOM" }>["kind"] = "ROOM";

const PANEL_TEST_IDS = Object.freeze({ panel: TESTIDS.rooms.panel, plan: TESTIDS.rooms.plan, room: TESTIDS.rooms.room, refused: TESTIDS.rooms.refused });

/** The roster as the Select offers it: every type, said in a reader's words (R-UI-082). */
const TYPE_OPTIONS = ROOM_TYPES.map((type) => ({ value: type, label: humaniseEnum(type) }));

export type RoomsRegionProps = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  sheetName: string;
  /** Where the act dialog is portalled: the screen's own root (consequence-dialog I-167). */
  container: HTMLElement | null;
};

export function RoomsRegion({ tenantId, projectId, drawingId, sheetName, container }: RoomsRegionProps): ReactNode {
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [view, setView] = useState<RoomsPanelView | null>(null);
  const [asking, setAsking] = useState(0);
  const [feedRefusal, setFeedRefusal] = useState<RefusalCode | null>(null);
  const [actRefusal, setActRefusal] = useState<RefusalCode | null>(null);
  const [offline, setOffline] = useState(false);
  const [chosen, setChosen] = useState<Readonly<Record<string, RoomType>>>({});
  const [confirming, setConfirming] = useState<RoomsGroupKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const asked = useRef(false);
  const pressing = useRef(false);

  const read = useCallback(async (): Promise<RoomsPanelView | null> => {
    const answered = await readRooms({ projectId, drawingId });
    if (!answered.read) {
      setFeedRefusal(answered.refusal);
      setPhase("ready");
      return null;
    }
    setFeedRefusal(null);
    setView(answered.view);
    setPhase("ready");
    return answered.view;
  }, [drawingId, projectId]);

  const load = useCallback(async (): Promise<void> => {
    const first = await read();
    // I-688: the rooms the labels cannot type are put to Jev once per mount, then read again. A
    // refused ask (a reader without MEASURE) leaves them said as waiting; the panel stands either way.
    if (first === null || first.state !== "READ" || first.unasked === 0 || asked.current) return;
    asked.current = true;
    setAsking(first.unasked);
    await askRooms({ projectId, drawingId }).finally(() => setAsking(0));
    await read();
  }, [drawingId, projectId, read]);

  /** Every way the rooms can fail to arrive is this panel's own error cell, never the sheet's (the partition region's rule). */
  const open = useCallback((): void => {
    setPhase("loading");
    void load().catch(() => setPhase("failed"));
  }, [load]);

  useEffect(() => {
    void load().catch(() => setPhase("failed"));
  }, [load]);

  const evidenceFor = useCallback(
    (code: RefusalCode): { href: string; label: string } => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: strings.viewer_partition_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: viewerSheetRoute(tenantId, projectId, drawingId, sheetName), label: strings.viewer_partition_evidence_reload };
    },
    [drawingId, projectId, sheetName, tenantId],
  );
  const refusedAnswer = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  /** A door pressed: offline first, then the preview as a pre-check, then the dialog on a consequence. */
  const press = useCallback(
    async (group: RoomsGroupKey): Promise<void> => {
      if (pressing.current) return;
      setActRefusal(null);
      setOffline(false);
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setOffline(true);
        return;
      }
      pressing.current = true;
      try {
        const answered: RoomsPreviewAnswer = await previewRooms({ projectId, group });
        if (!answered.previewed) {
          setActRefusal(answered.refusal);
          return;
        }
        setConfirming(group);
        setDialogOpen(true);
      } finally {
        pressing.current = false;
      }
    },
    [projectId],
  );

  const dialogPreview = useCallback(async () => {
    if (confirming === null) throw new Error("the consequence dialog was opened with no rooms group to preview");
    const answered: RoomsPreviewAnswer = await previewRooms({ projectId, group: confirming });
    if (!answered.previewed) throw refusedAnswer(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [confirming, projectId, refusedAnswer]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (confirming === null) throw new Error("the consequence dialog committed with no rooms group to carry");
      const answered: RoomsCommitAnswer = await commitRooms({ projectId, group: confirming, consequenceDigest });
      if (!answered.committed) throw refusedAnswer(answered.refusal);
      return { actId: answered.actId };
    },
    [confirming, projectId, refusedAnswer],
  );

  const offer = (plan: RoomsPanelPlan): ReactNode =>
    plan.group === null ? null : (
      <OfferedGroups
        groups={[
          {
            key: plan.group,
            label: fill(strings.rooms_group_label, { caption: plan.caption }),
            count: plan.offered === 1 ? strings.rooms_group_count_one : fill(strings.rooms_group_count_many, { count: formatUserFigure(String(plan.offered)) }),
          },
        ]}
        onConfirm={(key) => void press(key)}
      />
    );

  const typeControl = (room: RoomsPanelRoom): ReactNode => {
    const picked = chosen[room.roomKey];
    return (
      <span className="cx-rooms-control">
        <Select
          options={TYPE_OPTIONS}
          value={picked ?? ""}
          placeholder={strings.rooms_type_placeholder}
          aria-label={fill(strings.rooms_type_field, { name: room.name })}
          data-testid={TESTIDS.rooms.typeSelect}
          onChange={(value) => setChosen((held) => ({ ...held, [room.roomKey]: value as RoomType }))}
        />
        <Button
          variant="secondary"
          disabled={picked === undefined}
          data-testid={TESTIDS.rooms.typeConfirm}
          onClick={() => (picked === undefined ? undefined : void press({ kind: ROOM, drawingId, roomKey: room.roomKey, roomType: picked }))}
        >
          {strings.rooms_type_confirm}
        </Button>
      </span>
    );
  };

  const answer: ReactNode =
    feedRefusal !== null ? (
      <RefusalState refusal={refusalOf(feedRefusal)} evidence={evidenceFor(feedRefusal)} />
    ) : offline ? (
      <p className="cx-rooms-note" role="alert">
        {strings.rooms_offline}
      </p>
    ) : actRefusal === "PERMISSION_NOT_HELD" ? (
      <>
        <p className="cx-rooms-note">{strings.rooms_denied_permission}</p>
        <p className="cx-rooms-note">{strings.rooms_denied_holder}</p>
      </>
    ) : actRefusal === null ? null : (
      <RefusalState refusal={refusalOf(actRefusal)} evidence={evidenceFor(actRefusal)} />
    );

  return (
    <>
      <RoomsPanel
        phase={phase}
        view={view}
        asking={asking}
        onRetry={open}
        offer={offer}
        typeControl={typeControl}
        answer={answer}
        EnumLabel={EnumLabel}
        humaniseEnum={humaniseEnum}
        testIds={PANEL_TEST_IDS}
      />
      <ConsequenceDialog
        open={dialogOpen}
        actType={CONFIRM_ROOMS}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        container={container}
        onCommitted={() => {
          setConfirming(null);
          setChosen({});
          void read();
        }}
      />
    </>
  );
}
