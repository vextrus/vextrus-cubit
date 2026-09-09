"use client";
/**
 * S-Viewer's scale region, whole (docs/design/s-scale.md § 1, § 2): the panel docked as the second
 * tab of the right inspector, the two-point tool inside it, and the one act those rows stand behind.
 *
 * It lives HERE, in the route, rather than beside the maths in `src/modules`, because everything it
 * adds to the module's pure half is what a module may not reach under ARCH-01: the one RefusalState,
 * the one ConsequenceDialog, the shipped primitives, and the addresses a refusal's evidence link
 * promises. `scale-ui/**` holds no JSX, so no markup of this region has a second home (B-17).
 *
 * It is a hook plus components because its parts stand in three places of the tree — the inspector's
 * scale tab, the overlay's absence map and the screen's root — while one piece of state (what was
 * read, what is checked, what was observed, what a door refused) governs all three. The views/grid
 * region next door is composed exactly this way, so the two read alike (ARCH-02).
 *
 * The three unhappy answers stay apart (ARCH-03, B-21): a door that could not be read at all is this
 * panel's own error cell with a retry; a session that ended and a permission not held are the
 * register's own codes through the one renderer; a view no act names is a FACT about that view and
 * is rendered as the register's sentence inside its row (I-154).
 */
import "./viewer-scale.css";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { SCALE_RANKS, SCALE_UNITS, type ScaleRank, type ScaleUnit, type TwoPointObservation } from "@/core/scale";
import type { ScaleProposal, ViewScale } from "@/modules/takeoff/scale";
import { SCALE_COPY, fillCopy } from "@/modules/takeoff/scale-ui/copy";
import { judgeObservation, observationOf } from "@/modules/takeoff/scale-ui/two-point";
import type { SnapPick } from "@/modules/takeoff/viewer-snap/snap";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Badge, Button, Input, Skeleton } from "@/ui/primitives/core";
import { strings } from "@/ui/strings";
import { drawingsRoute } from "@/app/(app)/t/[tenant]/p/[project]/drawings/route-address";
import { participantsRoute } from "@/app/(app)/t/[tenant]/p/[project]/settings/participants/route-address";
import {
  commitAffirmScale as commitDoor,
  previewAffirmScale as previewDoor,
  readScaleProposals as readDoor,
  type AffirmScaleRequest,
  type CommitAnswer,
  type PreviewAnswer,
  type ReadAnswer,
} from "./scale-actions";
import { viewerSheetRoute } from "./route-address";

/** The act this panel commits — a machine identifier the dialog shows and never translates. */
const AFFIRM_SCALE = "AFFIRM_SCALE";

/** The rank a person's own two-point observation stands at (L-MEA-05's strongest). */
const QS_TWO_POINT: ScaleRank = "QS_TWO_POINT";

/** The bones that keep the panel's shape while the door is in flight (Decision § 2). */
const ROW_BONES = [
  { height: "12px", width: "96px" },
  { height: "12px", width: "min(220px, 100%)" },
];
const LOADING_ROWS = [0, 1, 2];

/** What the panel is showing, as its own `data-state` publishes it (R-UI-050, Decision § 2). */
export type ScalePhase = "loading" | "ready" | "failed" | "refused" | "denied";

/** The three doors this region is handed. The route hands the shipped server actions; a mount hands
    stand-ins, so the panel is judged over injected door answers exactly as the sheet's head is. */
export type ScaleDoors = {
  read: () => Promise<ReadAnswer>;
  preview: (request: AffirmScaleRequest) => Promise<PreviewAnswer>;
  commit: (request: AffirmScaleRequest & { consequenceDigest: string }) => Promise<CommitAnswer>;
};

/** One view of the partition as this region reads it: where it stands, so an observation taken
    inside it can name it. The boxes are the overlay's own — no second reading of the store (B-17). */
export type ScaleViewBox = { readonly viewKey: string; readonly box: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } | null };

/** One observation standing in the panel: what core read off it, and the observation itself, which
    is what an affirmation at rank QS_TWO_POINT is judged over by the seam (L-MEA-05). */
export type ScaleObservation = {
  readonly id: number;
  readonly axis: string;
  readonly drawn: string;
  readonly factor: string;
  readonly verified: boolean;
  /** The view the two picks stood inside, or null where they stood in none. */
  readonly viewKey: string | null;
  readonly observation: TwoPointObservation;
};

export type ScaleRegionOptions = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  /** The sheet's own name, as the evidence link of a refusal spells this address back (B-17). */
  sheetName: string;
  /** Whether there is a drawn sheet to scale yet: nothing is asked before the head is a manifest. */
  enabled: boolean;
  /** The doors, where a mount supplies them instead of the shipped server actions. */
  supplied?: ScaleDoors;
};

export type ScaleRegion = {
  state: ScalePhase;
  views: readonly ViewScale[];
  tolerances: { readonly anisotropy: string; readonly verification: string } | null;
  /** The id a fault answer carried, so a reader can quote it (R-UI-050's error leg). */
  faultId: string | null;
  /** Which views no affirmation act names, by the absence each declares — the overlay's hatch (I-160). */
  absence: ReadonlyMap<string, string>;
  members: ReadonlySet<string>;
  toggleMember: (viewKey: string) => void;
  distance: string;
  setDistance: (value: string) => void;
  unit: ScaleUnit;
  setUnit: (unit: ScaleUnit) => void;
  observations: readonly ScaleObservation[];
  /** The two picks standing on the sheet turned into one observation, and then spent (I-158). */
  observe: (o: { picks: readonly SnapPick[]; views: readonly ScaleViewBox[]; onSpent: () => void }) => void;
  /** The ranks every checked member can stand at, in L-MEA-05's precedence (I-157). */
  offeredRanks: readonly ScaleRank[];
  pressAffirm: (rank: ScaleRank) => void;
  /** The one answer slot's content: a refusal through the one renderer, or the offline notice (I-156). */
  answer: ReactNode;
  /** Whether that answer stands in the body's place — there is nothing else to show there (I-156). */
  answerInBody: boolean;
  retry: () => void;
  /** The one act dialog, mounted at the screen's root. */
  dialog: ReactNode;
};

export function useScaleRegion({ tenantId, projectId, drawingId, sheetName, enabled, supplied }: ScaleRegionOptions): ScaleRegion {
  const [phase, setPhase] = useState<ScalePhase>("loading");
  const [answered, setAnswered] = useState<{ views: readonly ViewScale[]; tolerances: { anisotropy: string; verification: string } } | null>(null);
  const [readRefusal, setReadRefusal] = useState<RefusalCode | null>(null);
  const [faultId, setFaultId] = useState<string | null>(null);
  /** Bumped by a retry and by a committed act: the effect below is what asks, so asking again is
      asking the same way (B-17). */
  const [asked, setAsked] = useState(0);

  const [members, setMembers] = useState<ReadonlySet<string>>(() => new Set());
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<ScaleUnit>(SCALE_UNITS[0] as ScaleUnit);
  const [observations, setObservations] = useState<readonly ScaleObservation[]>([]);
  const taken = useRef(0);

  const [affirming, setAffirming] = useState<AffirmScaleRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actRefusal, setActRefusal] = useState<RefusalCode | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const read = useCallback((): Promise<ReadAnswer> => (supplied === undefined ? readDoor({ projectId, drawingId }) : supplied.read()), [drawingId, projectId, supplied]);
  const preview = useCallback((request: AffirmScaleRequest): Promise<PreviewAnswer> => (supplied === undefined ? previewDoor(request) : supplied.preview(request)), [supplied]);
  const commit = useCallback(
    (request: AffirmScaleRequest & { consequenceDigest: string }): Promise<CommitAnswer> => (supplied === undefined ? commitDoor(request) : supplied.commit(request)),
    [supplied],
  );

  /**
   * The scale of every view, asked for once the head is a manifest (R-UI-043) and asked again after
   * an act, because the row's new state is the visible answer and never something this panel paints
   * for itself (Decision § 1). It is read at MOUNT rather than when the tab is opened: the overlay's
   * hatch is this answer's, and a sheet whose views have no scale is hatched before anyone asks.
   */
  useEffect(() => {
    if (!enabled) return;
    let live = true;

    const open = async (): Promise<void> => {
      setPhase("loading");
      setFaultId(null);
      setReadRefusal(null);
      const answer = await read();
      if (!live) return;
      if (!answer.read) {
        setReadRefusal(answer.refusal);
        setPhase(answer.refusal === "PERMISSION_NOT_HELD" ? "denied" : "refused");
        return;
      }
      setAnswered({ views: answer.views, tolerances: answer.tolerances });
      setPhase("ready");
    };

    // A scale that cannot be read at all costs the reader THIS panel and never the drawing beside it
    // (Decision § 2): it is this region's own error cell, with the report id the fault travelled with.
    void open().catch((thrown: unknown) => {
      if (!live) return;
      const digest = (thrown as { digest?: unknown } | null)?.digest;
      setFaultId(typeof digest === "string" ? digest : null);
      setPhase("failed");
    });

    return () => {
      live = false;
    };
  }, [asked, enabled, read]);

  const views = answered?.views ?? EMPTY_VIEWS;
  const tolerances = answered?.tolerances ?? null;

  /** The absence map the overlay hatches by: a view no act names, by the code it declares (I-160). */
  const absence = useMemo<ReadonlyMap<string, string>>(() => new Map(views.filter((view) => view.refusal !== null).map((view) => [view.viewKey, view.refusal as string])), [views]);

  const toggleMember = useCallback((viewKey: string): void => {
    setMembers((held) => {
      const next = new Set(held);
      if (!next.delete(viewKey)) next.add(viewKey);
      return next;
    });
  }, []);

  /**
   * The two picks and the entered distance as one observation row (AC-2).
   *
   * The axis is core's own reading of the two points, so it is asked for rather than derived here
   * (B-17): a first judgement over no corroboration names the axis, and the second is made against
   * what the drawing's own evidence offers on THAT axis inside the view the picks stood in. An
   * observation nothing corroborates keeps its row and says it is not verified (I-155); what core
   * refuses about the gesture itself renders in the answer slot and appends no row.
   */
  const observe = useCallback(
    ({ picks, views: boxes, onSpent }: { picks: readonly SnapPick[]; views: readonly ScaleViewBox[]; onSpent: () => void }): void => {
      if (tolerances === null) return;
      setActRefusal(null);
      setOfflineNotice(false);
      const held = observationOf(picks, { value: distance, unit });
      if ("refusal" in held) {
        setActRefusal(held.refusal as RefusalCode);
        return;
      }
      const named = judgeObservation(held.observation, [], tolerances.verification);
      if ("refusal" in named) {
        setActRefusal(named.refusal as RefusalCode);
        return;
      }
      const viewKey = viewHolding(boxes, picks);
      const standing = views.find((view) => view.viewKey === viewKey) ?? null;
      const corroborating = standing === null ? [] : standing.proposals.filter((proposal) => proposal.placeable).map((proposal) => factorOn(proposal, named.axis));
      const judged = judgeObservation(held.observation, corroborating, tolerances.verification);
      if ("refusal" in judged) {
        setActRefusal(judged.refusal as RefusalCode);
        return;
      }
      taken.current += 1;
      setObservations((rows) => [...rows, { id: taken.current, axis: judged.axis, drawn: judged.drawn, factor: judged.factor, verified: judged.verified, viewKey, observation: held.observation }]);
      // The marks are spent: an observation is never taken twice from picks already read (I-158).
      onSpent();
    },
    [distance, tolerances, unit, views],
  );

  /** L-MEA-05's precedence, narrowed to the ranks EVERY checked member can stand at (I-157). */
  const offeredRanks = useMemo<readonly ScaleRank[]>(() => {
    const chosen = views.filter((view) => members.has(view.viewKey));
    return SCALE_RANKS.filter((rank) =>
      chosen.every((view) => (rank === QS_TWO_POINT ? observations.some((row) => row.viewKey === view.viewKey) : view.proposals.some((proposal) => proposal.rank === rank))),
    );
  }, [members, observations, views]);

  /** What an affirmation at one rank asks for: the views checked, and — at rank QS_TWO_POINT — the
      observations they were taken from. What each view moves TO is the seam's to derive (L-ACT-02). */
  const requestFor = useCallback(
    (rank: ScaleRank): AffirmScaleRequest => ({
      projectId,
      drawingId,
      rank,
      viewKeys: views.filter((view) => members.has(view.viewKey)).map((view) => view.viewKey),
      ...(rank === QS_TWO_POINT ? { observations: observations.filter((row) => row.viewKey !== null && members.has(row.viewKey)).map((row) => row.observation) } : {}),
    }),
    [drawingId, members, observations, projectId, views],
  );

  /** Whether a press is already at the door — a second one while it is open asks nothing twice. */
  const pressing = useRef(false);

  /**
   * A door pressed: offline is judged first (s-drawings I-89), then the pre-check, then the dialog on
   * a consequence and only on one (Decision § 1). A refusal of the preview is this region's answer —
   * it renders in the answer slot beside the controls that raised it, and no dialog opens on nothing.
   */
  const pressAffirm = useCallback(
    (rank: ScaleRank): void => {
      if (pressing.current) return;
      setActRefusal(null);
      setOfflineNotice(false);
      // Reading, picking and judging are wholly local, so this panel carries no offline banner;
      // "read-only" binds the one act, and Affirm pressed with no connection opens nothing (§ 2).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setOfflineNotice(true);
        return;
      }
      pressing.current = true;
      const request = requestFor(rank);
      void preview(request)
        .then((answer) => {
          if (!answer.previewed) {
            setActRefusal(answer.refusal);
            return;
          }
          setAffirming(request);
          setDialogOpen(true);
        })
        .finally(() => {
          pressing.current = false;
        });
    },
    [preview, requestFor],
  );

  /** Where a refusal of one of these doors is resolved — the address the label promises (R-UI-020). */
  const evidenceFor = useCallback(
    (code: RefusalCode): { href: string; label: string } => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: SCALE_COPY.viewer_scale_evidence_participants };
      // The one sentence the shell already registers for an ended session: a second spelling of it
      // here would be a second home for one word (B-17, R-SPINE-060).
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      if (code === "PARTITION_NOT_AVAILABLE") return { href: drawingsRoute(tenantId, projectId), label: SCALE_COPY.viewer_scale_evidence_drawings };
      return { href: viewerSheetRoute(tenantId, projectId, drawingId, sheetName), label: SCALE_COPY.viewer_scale_evidence_reload };
    },
    [drawingId, projectId, sheetName, tenantId],
  );

  /** The rejection shape the one dialog resolves a refusal from (consequence-dialog I-40). */
  const refusedAnswer = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const dialogPreview = useCallback(async () => {
    if (affirming === null) throw new Error("the consequence dialog was opened with no affirmation to preview");
    const answer = await preview(affirming);
    if (!answer.previewed) throw refusedAnswer(answer.refusal);
    return { consequence: answer.consequence, consequenceDigest: answer.consequenceDigest };
  }, [affirming, preview, refusedAnswer]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (affirming === null) throw new Error("the consequence dialog committed with no affirmation to carry");
      const answer = await commit({ ...affirming, consequenceDigest });
      if (!answer.committed) throw refusedAnswer(answer.refusal);
      return { actId: answer.actId };
    },
    [affirming, commit, refusedAnswer],
  );

  const dialog = (
    <ConsequenceDialog
      open={dialogOpen}
      actType={AFFIRM_SCALE}
      preview={dialogPreview}
      commit={dialogCommit}
      onOpenChange={setDialogOpen}
      onCommitted={() => {
        setAffirming(null);
        setMembers(new Set());
        setAsked((held) => held + 1);
      }}
    />
  );

  // A refusal of an ACT is not a refusal of the reading: the rows, the proposals and the readouts
  // stand, and only the doors give way — knowledge is not permission (s-drawings I-90, § 2).
  const state: ScalePhase = phase === "ready" && actRefusal === "PERMISSION_NOT_HELD" ? "denied" : phase;
  const shown = readRefusal ?? actRefusal;
  const answer =
    shown !== null ? (
      <>
        {shown === "PERMISSION_NOT_HELD" ? (
          <>
            <p className="cx-viewer-scale-denied">{SCALE_COPY.viewer_scale_denied_permission}</p>
            <p className="cx-viewer-scale-denied">{SCALE_COPY.viewer_scale_denied_holder}</p>
          </>
        ) : null}
        <RefusalState refusal={refusalOf(shown)} evidence={evidenceFor(shown)} />
      </>
    ) : offlineNotice ? (
      <p className="cx-viewer-scale-notice" role="alert">
        {SCALE_COPY.viewer_scale_offline}
      </p>
    ) : null;

  const retry = useCallback((): void => setAsked((held) => held + 1), []);

  return {
    state,
    views,
    tolerances,
    faultId,
    absence,
    members,
    toggleMember,
    distance,
    setDistance,
    unit,
    setUnit,
    observations,
    observe,
    offeredRanks,
    pressAffirm,
    answer,
    // I-156: one slot holding one thing — in the body's place while there is no reading to show
    // under it, and beside the controls that raised it once there is.
    answerInBody: answered === null,
    retry,
    dialog,
  };
}

/** A sheet nobody has answered for holds no view — one frozen answer, so a render that changed
    nothing recomputes nothing off it (PB-3). */
const EMPTY_VIEWS: readonly ViewScale[] = Object.freeze([]);

/** The factor a proposal offers along one axis. X and Y derive independently (L-MEA-05). */
function factorOn(proposal: ScaleProposal, axis: string): string {
  return axis === "x" ? proposal.factorX : proposal.factorY;
}

/** The view both picks stand inside, or null where they stand in none: a point on the edge stands
    inside the view that drew it, exactly as the snapping region reads one (I-158). */
function viewHolding(views: readonly ScaleViewBox[], picks: readonly SnapPick[]): string | null {
  const holds = (box: NonNullable<ScaleViewBox["box"]>, at: readonly [number, number]): boolean => at[0] >= box.min[0] && at[0] <= box.max[0] && at[1] >= box.min[1] && at[1] <= box.max[1];
  for (const view of views) {
    if (view.box === null) continue;
    if (picks.every((pick) => holds(view.box as NonNullable<ScaleViewBox["box"]>, pick.point))) return view.viewKey;
  }
  return null;
}

/** The word a rank is read by, from this panel's one copy home (I-153, Decision § 3). */
function rankWord(rank: string): string {
  return SCALE_COPY[`scale_rank_${rank}` as keyof typeof SCALE_COPY] ?? rank;
}

export type ScalePanelProps = {
  scale: ScaleRegion;
  /** The picks standing on the sheet right now — the snapping region's own, never a second set. */
  picks: readonly SnapPick[];
  /** Where each view of the partition stands, so an observation can name the view it was taken in. */
  views: readonly ScaleViewBox[];
  /** The marks let go of once an observation has been taken from them (I-158). */
  onSpent: () => void;
};

/**
 * The panel itself (Decision § 1): the head, one row per view the door answered, the two-point tool,
 * the one answer slot and the affirm footer. Markup only — every decision it renders was made by the
 * hook above, and it holds no state of its own.
 */
export function ScalePanel({ scale, picks, views, onSpent }: ScalePanelProps) {
  const loading = scale.state === "loading";
  const denied = scale.state === "denied";
  const answerSlot = (
    <div className="cx-viewer-scale-answer" data-testid="viewer-scale-answer">
      {scale.answer}
    </div>
  );

  return (
    <section className="cx-viewer-scale" data-testid="viewer-scale" data-state={scale.state} aria-labelledby="cx-viewer-scale-title" aria-busy={loading || undefined}>
      <header className="cx-viewer-scale-head">
        <h2 className="cx-viewer-scale-heading" id="cx-viewer-scale-title" tabIndex={-1}>
          {SCALE_COPY.viewer_scale_heading}
        </h2>
        {scale.tolerances === null ? null : (
          <FiguredLine className="cx-viewer-scale-tolerance" template={SCALE_COPY.viewer_scale_tolerance_anisotropy} slot="tolerance" value={scale.tolerances.anisotropy} />
        )}
      </header>

      {loading ? (
        <div className="cx-viewer-scale-bones">
          <p className="cx-viewer-hidden">{SCALE_COPY.viewer_scale_loading_label}</p>
          {LOADING_ROWS.map((row) => (
            <div className="cx-viewer-scale-bone-row" key={row}>
              {ROW_BONES.map((bone, at) => (
                <Skeleton key={at} style={bone} />
              ))}
            </div>
          ))}
        </div>
      ) : scale.state === "failed" ? (
        <div className="cx-viewer-scale-failed">
          <p className="cx-viewer-scale-failed-line">{SCALE_COPY.viewer_scale_failed}</p>
          <Button variant="secondary" data-testid="viewer-scale-retry" onClick={scale.retry}>
            {SCALE_COPY.viewer_scale_retry}
          </Button>
          {scale.faultId === null ? null : <p className="cx-viewer-scale-report">{fillCopy(SCALE_COPY.viewer_scale_report_id, { id: scale.faultId })}</p>}
        </div>
      ) : scale.answerInBody ? (
        answerSlot
      ) : (
        <>
          <ol className="cx-viewer-scale-views" aria-label={SCALE_COPY.viewer_scale_views_list_label}>
            {scale.views.map((view) => (
              <ScaleViewRow key={view.viewKey} view={view} scale={scale} denied={denied} />
            ))}
          </ol>
          {denied ? null : <TwoPointTool scale={scale} picks={picks} views={views} onSpent={onSpent} />}
          {answerSlot}
          {denied ? null : (
            <footer className="cx-viewer-scale-footer">
              <p className="cx-viewer-scale-members">
                {fillCopy(SCALE_COPY.viewer_scale_members_count, { count: formatUserFigure(String(scale.members.size)), total: formatUserFigure(String(scale.views.length)) })}
              </p>
              {scale.offeredRanks.map((rank) => (
                <Button
                  key={rank}
                  variant="secondary"
                  data-testid="viewer-scale-affirm"
                  data-rank={rank}
                  disabled={scale.members.size === 0}
                  onClick={() => scale.pressAffirm(rank)}
                >
                  {fillCopy(SCALE_COPY.viewer_scale_affirm, { rank: rankWord(rank) })}
                </Button>
              ))}
            </footer>
          )}
        </>
      )}
    </section>
  );
}

/** One view's row: what it stands at, and — where no act names it — why, then what the machine read. */
function ScaleViewRow({ view, scale, denied }: { view: ViewScale; scale: ScaleRegion; denied: boolean }) {
  const labelId = useId();
  const affirmed = view.affirmed;
  const absence = view.refusal === null ? null : refusalOf(view.refusal as RefusalCode);

  return (
    <li
      className="cx-viewer-scale-view"
      data-testid="viewer-scale-view"
      data-view-key={view.viewKey}
      data-state={affirmed === null ? (view.refusal as string) : "affirmed"}
      {...(affirmed === null
        ? {}
        : {
            "data-calibration-key": affirmed.calibrationKey,
            "data-rank": affirmed.rank,
            "data-factor-x": affirmed.factorX,
            "data-factor-y": affirmed.factorY,
            "data-anisotropy": affirmed.anisotropy,
            "data-placeable": String(affirmed.placeable),
          })}
    >
      <div className="cx-viewer-scale-line">
        {denied ? null : (
          <>
            {/* The group is curated, never offered: one checkbox per row, and no select-all anywhere
                in this panel (I-157, R-UI-023). Each is named by the view it would include, so N of
                them are never announced alike (R-UI-012). */}
            <label className="cx-viewer-hidden" htmlFor={labelId}>
              {fillCopy(SCALE_COPY.viewer_scale_member_label, { viewKey: view.viewKey })}
            </label>
            <input
              className="cx-input cx-reticle cx-viewer-scale-member"
              type="checkbox"
              id={labelId}
              data-testid="viewer-scale-member"
              data-view-key={view.viewKey}
              checked={scale.members.has(view.viewKey)}
              onChange={() => scale.toggleMember(view.viewKey)}
            />
          </>
        )}
        <span className="cx-viewer-scale-key">{view.viewKey}</span>
        <Badge>{view.type}</Badge>
      </div>
      {view.caption === "" ? null : <p className="cx-viewer-scale-caption">{view.caption}</p>}

      {affirmed === null ? null : (
        <div className="cx-viewer-scale-affirmed">
          <p className="cx-viewer-scale-standing">{fillCopy(SCALE_COPY.viewer_scale_affirmed, { rank: rankWord(affirmed.rank) })}</p>
          <p className="cx-viewer-scale-pair">
            <span className="cx-viewer-scale-label">{SCALE_COPY.viewer_scale_calibration_label}</span>
            <span className="cx-viewer-scale-figure">{affirmed.calibrationKey}</span>
          </p>
          <ScaleFigures factorX={affirmed.factorX} factorY={affirmed.factorY} anisotropy={affirmed.anisotropy} placeable={affirmed.placeable} />
        </div>
      )}

      {absence === null ? null : (
        <div className="cx-viewer-scale-absence">
          {/* I-154: a view's absence is a FACT about that view, said in the register's own words
              inside its row — never the RefusalState, which answers what was refused OF a reader. */}
          <p className="cx-viewer-scale-absence-message">{absence.message}</p>
          <p className="cx-viewer-scale-absence-remedy">{absence.remedy}</p>
        </div>
      )}

      {affirmed !== null ? null : view.proposals.length === 0 ? (
        <p className="cx-viewer-scale-empty">{SCALE_COPY.viewer_scale_no_proposals}</p>
      ) : (
        <ol className="cx-viewer-scale-proposals" aria-label={SCALE_COPY.viewer_scale_proposals_label}>
          {view.proposals.map((proposal) => (
            <li
              className="cx-viewer-scale-proposal"
              data-testid="viewer-scale-proposal"
              key={proposal.rank}
              data-rank={proposal.rank}
              data-factor-x={proposal.factorX}
              data-factor-y={proposal.factorY}
              data-anisotropy={proposal.anisotropy}
              data-placeable={String(proposal.placeable)}
            >
              <p className="cx-viewer-scale-rank">{rankWord(proposal.rank)}</p>
              <p className="cx-viewer-scale-evidence">
                <span className="cx-viewer-scale-label">{SCALE_COPY.viewer_scale_evidence_label}</span>
                {/* Every source key whole: a factor is evidence, and evidence is never truncated
                    behind an affordance (I-26, I-159). */}
                {proposal.evidence.map((key) => (
                  <span className="cx-viewer-scale-figure" key={key}>
                    {key}
                  </span>
                ))}
              </p>
              <ScaleFigures factorX={proposal.factorX} factorY={proposal.factorY} anisotropy={proposal.anisotropy} placeable={proposal.placeable} />
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

/** The factor pair, the anisotropy readout and the placeable flag — the engine's own values, whole
    and unrounded, wherever they are shown (I-159). */
function ScaleFigures({ factorX, factorY, anisotropy, placeable }: { factorX: string; factorY: string; anisotropy: string; placeable: boolean }) {
  return (
    <div className="cx-viewer-scale-figures">
      <span className="cx-viewer-scale-label">{SCALE_COPY.viewer_scale_factor_label}</span>
      <span className="cx-viewer-scale-figure">{fillCopy(SCALE_COPY.viewer_scale_factor_x, { factor: factorX })}</span>
      <span className="cx-viewer-scale-figure">{fillCopy(SCALE_COPY.viewer_scale_factor_y, { factor: factorY })}</span>
      <span className="cx-viewer-scale-figure">{fillCopy(SCALE_COPY.viewer_scale_anisotropy, { ratio: anisotropy })}</span>
      {/* The flag is a word as well as a paint: nothing here is told apart by hue alone (R-UI-060). */}
      <span className="cx-viewer-scale-flag">{placeable ? SCALE_COPY.viewer_scale_placeable : SCALE_COPY.viewer_scale_unplaceable}</span>
    </div>
  );
}

/** The two-point tool (Decision § 1): the picks standing, the distance and unit a person enters, and
    the observations taken here with the check they were judged by. */
function TwoPointTool({ scale, picks, views, onSpent }: ScalePanelProps) {
  const distanceId = useId();
  const unitId = useId();

  return (
    <fieldset className="cx-viewer-scale-tool">
      <legend className="cx-viewer-scale-legend">{SCALE_COPY.viewer_scale_tool_legend}</legend>
      <p className="cx-viewer-scale-hint">{SCALE_COPY.viewer_scale_tool_hint}</p>

      {picks.length === 0 ? (
        <p className="cx-viewer-scale-picks-none">{SCALE_COPY.viewer_scale_picks_none}</p>
      ) : (
        <ol className="cx-viewer-scale-picks">
          {picks.map((pick) => (
            <li className="cx-viewer-scale-pick" key={pick.index}>
              <span className="cx-viewer-scale-label">{fillCopy(SCALE_COPY.viewer_scale_pick, { index: String(pick.index) })}</span>
              <span className="cx-viewer-scale-figure">{pick.sourceKeys.join(" ")}</span>
              <span className="cx-viewer-scale-figure">{`${pick.keyPoint[0]} ${pick.keyPoint[1]}`}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="cx-viewer-scale-fields">
        <label className="cx-viewer-scale-field-label" htmlFor={distanceId}>
          {SCALE_COPY.viewer_scale_distance_label}
        </label>
        {/* R-UI-010's NumberInput is unbuilt, so the field is the core Input asking for a decimal
            keypad and the unit a native select in the house field classes (Decision § 8's IOU). */}
        <Input id={distanceId} data-testid="viewer-scale-distance" inputMode="decimal" value={scale.distance} onChange={(event) => scale.setDistance(event.target.value)} />
        <label className="cx-viewer-scale-field-label" htmlFor={unitId}>
          {SCALE_COPY.viewer_scale_unit_label}
        </label>
        <select
          className="cx-input cx-reticle cx-viewer-scale-unit"
          id={unitId}
          data-testid="viewer-scale-unit"
          value={scale.unit}
          onChange={(event) => scale.setUnit(event.target.value as ScaleUnit)}
        >
          {SCALE_UNITS.map((spelling) => (
            <option key={spelling} value={spelling}>
              {spelling}
            </option>
          ))}
        </select>
      </div>

      <Button variant="secondary" data-testid="viewer-scale-observe" disabled={picks.length < 2} onClick={() => scale.observe({ picks, views, onSpent })}>
        {SCALE_COPY.viewer_scale_observe}
      </Button>

      <FiguredLine
        className="cx-viewer-scale-check"
        testId="viewer-scale-check-verification"
        template={SCALE_COPY.viewer_scale_check_verification}
        slot="tolerance"
        value={scale.tolerances?.verification ?? ""}
      />

      <ol className="cx-viewer-scale-observations" aria-label={SCALE_COPY.viewer_scale_observations_label}>
        {scale.observations.map((row) => (
          <li
            className="cx-viewer-scale-observation"
            data-testid="viewer-scale-observation"
            key={row.id}
            data-axis={row.axis}
            data-drawn={row.drawn}
            data-factor={row.factor}
            data-verified={row.verified ? "verified" : "unverified"}
            data-view-key={row.viewKey ?? ""}
          >
            <span className="cx-viewer-scale-label">{fillCopy(SCALE_COPY.viewer_scale_observation_axis, { axis: row.axis })}</span>
            <span className="cx-viewer-scale-figure">{fillCopy(SCALE_COPY.viewer_scale_observation_drawn, { drawn: row.drawn })}</span>
            <span className="cx-viewer-scale-figure">{row.factor}</span>
            {/* An observation nothing corroborates is shown, never refused: the span and the factor
                are facts, and this is the panel's partial cell (I-155). */}
            <span className="cx-viewer-scale-flag">{row.verified ? SCALE_COPY.viewer_scale_verified : SCALE_COPY.viewer_scale_unverified}</span>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}

/** One line of the table with its one figure standing in mono: the sentence is copy, and the value
    it carries is model data, which never reads as prose (I-25, I-159). */
function FiguredLine({ template, slot, value, className, testId }: { template: string; slot: string; value: string; className: string; testId?: string }) {
  const [before = "", after = ""] = template.split(`{${slot}}`);
  return (
    <p className={className} data-testid={testId}>
      {before}
      <span className="cx-viewer-scale-figure">{value}</span>
      {after}
    </p>
  );
}
