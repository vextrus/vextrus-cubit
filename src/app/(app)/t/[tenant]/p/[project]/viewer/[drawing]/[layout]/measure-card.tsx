"use client";
/**
 * The card at a hand measurement's closing point (docs/design/s-measure.md § 2.5, I-373, S6): where
 * Confirm is the act. A shape finished under a picked condition opens it; it is the one
 * ConsequenceDialog, anchored beside the point, previewing RECORD_MANUAL_MEASUREMENT over what was
 * traced — the condition as applied, the level, the readings and the cut-outs' roles — and showing the
 * gate's own figure per kind with its formula (I-384). Confirm commits the act and asks the campaign's
 * measure run for it; the status cell then says it was recorded.
 *
 * What the person may change before confirming — the level (I-377), where a reading comes from (the
 * condition, or a note of the view that states it, TRANSCRIBED, § 2.5), each cut-out's role (I-389) —
 * stands above the consequence as the dialog's controls. Every change is carried into the statement,
 * whose preview is a new function, so the dialog previews again (I-41): what is confirmed is never
 * older than what it was changed to.
 *
 * It lives in the route for the reason the region does: the string table, the primitives, the pattern
 * and the route's server actions are what a module may not reach under ARCH-01.
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { isFoundationClass } from "@/core/catalogue/level-basis";
import { refusalOf, type RefusalCode } from "@/core/errors";
import type { ChestCondition } from "@/core/manual/conditions";
import type { CutoutRole, StatedGeometry, StatedPoint } from "@/core/manual/law";
import type { MeasureCard } from "@/modules/takeoff/measure/card";
import type { Camera } from "@/modules/takeoff/viewer";
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import type { MeasureDraft, MeasurePoint } from "@/modules/takeoff/viewer-measure/gesture";
import { cardAt, closingPointOf, modelPointOf, type CardPlace, type SheetWindow } from "@/modules/takeoff/viewer-measure/scene";
import { viewAt, type MeasureView, type UseMeasure } from "@/modules/takeoff/viewer-measure/use-measure";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { Button, ErrorState, Kbd, Select } from "@/ui/primitives/core";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { participantsRoute } from "@/app/(app)/t/[tenant]/p/[project]/settings/participants/route-address";
import { commitMeasurement, previewMeasurement, readMeasureCard, type MeasureCardAnswer, type MeasurementCommitAnswer, type MeasurementPreviewAnswer } from "./measure-actions";
import { viewerSheetRoute } from "./route-address";

/** The act the card renders, verbatim — the machine identifier the dialog publishes (I-444). */
const RECORD_MANUAL_MEASUREMENT = "RECORD_MANUAL_MEASUREMENT";

/** The lawful-null slot a foundation class stands in whatever is stated (I-377). */
const FOUNDATION = "FOUNDATION";

/** The card's width, as § 2.5 fixes it, and a height the placement plans for before it is laid out. */
const CARD_SIZE = Object.freeze({ width: 320, height: 440 });

/** The Select's value for "the condition's own reading" — no note's source key is empty. */
const FROM_CONDITION = "";

/** The card's three doors: the route's actions, or a mount's own (a jsdom case hands its own). */
export type CardDoors = {
  preview: (request: unknown) => Promise<MeasurementPreviewAnswer>;
  commit: (request: unknown) => Promise<MeasurementCommitAnswer>;
  read: (request: unknown) => Promise<MeasureCardAnswer>;
};

const ROUTE_DOORS: CardDoors = { preview: previewMeasurement, commit: commitMeasurement, read: readMeasureCard };

/** The sheet the card records on: the project, the drawing revision and the sheet whose space the points are in. */
export type CardSheet = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string; readonly sheetName: string };

export type MeasureCardOptions = {
  measure: UseMeasure;
  /** The condition the tool measures under; the card opens only under one (I-497). */
  picked: ChestCondition | null;
  sheet: CardSheet | null;
  views: readonly MeasureView[];
  cameraRef: RefObject<Camera | null>;
  stageRef: RefObject<HTMLElement | null>;
  container?: HTMLElement | null;
  doors?: CardDoors;
};

export type UseMeasureCard = {
  /** The card, while a finished shape stands under a picked condition — null otherwise. */
  dialog: ReactNode;
  /** The act the last Confirm recorded, until the next shape is started: the status cell says so. */
  recorded: string | null;
  /** The hairline from the card to its closing point, in stage pixels, where the card was pushed away from it (§ 2.5). */
  leader: CardPlace["leader"];
};

/**
 * The geometry the recipe measures, from the shape the grammar finished (I-374: the trace is the
 * recipe's own geometry). Each point is told the act as the point and the source keys it was snapped
 * on (§ 2.11) — in the space the act is told, so a point placed on a paper sheet is carried back
 * through its window into model space first (I-620).
 */
export function geometryOf(draft: MeasureDraft, recipe: ChestCondition["geometry"], roles: readonly CutoutRole[], windows: readonly SheetWindow[] = []): StatedGeometry {
  const stated = (point: MeasurePoint): StatedPoint => {
    const [x, y] = modelPointOf(windows, point.at);
    return { x, y, cites: [...point.sourceKeys] };
  };
  const outer = draft.outer.map(stated);
  if (recipe === "POLYLINE") return { geometry: "POLYLINE", run: outer };
  if (recipe === "POINT_SET") return { geometry: "POINT_SET", points: outer };
  return { geometry: "POLYGON", outer, cutouts: draft.cutouts.map((ring, at) => ({ role: roles[at] ?? "OPENING", ring: ring.map(stated) })) };
}

/** The level stated (I-377): the FOUNDATION slot for a foundation class, the chosen or the caption's level otherwise, or none. */
export function levelOf(picked: ChestCondition, chosen: string | null, card: MeasureCard | null): { levelId: string } | { slot: string } | null {
  if (isFoundationClass(picked.elementClass)) return { slot: FOUNDATION };
  const levelId = chosen ?? card?.levelId ?? null;
  return levelId === null ? null : { levelId };
}

/** Where each reading comes from: the condition (ENTERED) or a note the view offers (TRANSCRIBED, citing it). */
export function readingsOf(picked: ChestCondition, sources: Readonly<Record<string, string>>, card: MeasureCard | null): ChestCondition["readings"] {
  return picked.readings.map((reading) => {
    const note = card?.notes.find((offered) => offered.attribute === reading.attribute && offered.sourceKey === sources[reading.attribute]);
    if (note === undefined) return { ...reading, basis: "ENTERED", sourceKey: null };
    return { attribute: reading.attribute, valueAsWritten: note.valueAsWritten, unitAsWritten: note.unitAsWritten, basis: "TRANSCRIBED", sourceKey: note.sourceKey };
  });
}

/** A fault of the card's preview or commit (not a refusal) lands here: the card's own ErrorState, the outline kept (§ 3). */
class CardBoundary extends Component<{ children: ReactNode; onRetry: () => void; onClose: () => void }, { failed: boolean; reportId: string }> {
  override state = { failed: false, reportId: "" };

  // The server's fault seam names a failed action by the digest it recorded it under (the chest's reading).
  static getDerivedStateFromError(thrown: unknown): { failed: boolean; reportId: string } {
    const digest = (thrown as { digest?: unknown } | null)?.digest;
    return { failed: true, reportId: typeof digest === "string" ? digest : "" };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="cx-viewer-measure-card-failed">
        <ErrorState
          heading={strings.measure_card_failed}
          reportId={this.state.reportId === "" ? undefined : this.state.reportId}
          retryLabel={strings.measure_retry}
          onRetry={() => {
            this.setState({ failed: false, reportId: "" });
            this.props.onRetry();
          }}
          data-testid={TESTIDS.measure.cardRetry}
        />
        <Button variant="secondary" onClick={this.props.onClose}>
          {strings.consequence_dialog_cancel}
        </Button>
      </div>
    );
  }
}

export function useMeasureCard({ measure, picked, sheet, views, cameraRef, stageRef, container, doors = ROUTE_DOORS }: MeasureCardOptions): UseMeasureCard {
  const draft = measure.draft;
  const standing = draft.phase === "closed" && picked !== null && sheet !== null;
  const firstPoint = draft.outer[0];
  const view = firstPoint === undefined ? null : viewAt(views, firstPoint.at);
  const viewKey = view?.viewKey ?? null;

  const [card, setCard] = useState<{ key: string; answer: MeasureCard | null } | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [sources, setSources] = useState<Readonly<Record<string, string>>>({});
  const [roles, setRoles] = useState<readonly CutoutRole[]>([]);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // What the card offers is read once per view and recipe, while the card stands (§ 2.5).
  const cardKey = standing && viewKey !== null ? `${viewKey}|${picked.conditionId}` : null;
  useEffect(() => {
    if (cardKey === null || sheet === null || picked === null || viewKey === null) return;
    let live = true;
    const asked = { projectId: sheet.projectId, drawingId: sheet.drawingId, sheetName: sheet.sheetName, viewKey, kinds: picked.kinds.map((entry) => entry.kind), attributes: picked.readings.map((reading) => reading.attribute) };
    doors
      .read(asked)
      .then((answer) => {
        if (live) setCard({ key: cardKey, answer: answer.read ? answer : null });
      })
      // A read that could not be made offers nothing: the card still previews, and the act answers by name.
      .catch(() => {
        if (live) setCard({ key: cardKey, answer: null });
      });
    return () => {
      live = false;
    };
  }, [cardKey, doors, picked, sheet, viewKey]);

  // A new shape starts with the defaults again, and a recorded note gives way to what is drawn next.
  const drawing = draft.phase === "drawing";
  useEffect(() => {
    if (!drawing) return;
    setLevel(null);
    setSources({});
    setRoles([]);
    setRecorded(null);
  }, [drawing]);

  const offered = card !== null && card.key === cardKey ? card.answer : null;
  const ready = cardKey === null ? standing : card !== null && card.key === cardKey;

  const statement = useMemo(() => {
    if (!standing || picked === null || sheet === null) return null;
    return {
      projectId: sheet.projectId,
      drawingId: sheet.drawingId,
      // The space the points are in: model space for a paper sheet's windows (I-620), else the sheet.
      layoutName: offered?.space ?? sheet.sheetName,
      viewKey: viewKey ?? "",
      recipe: {
        conditionId: picked.conditionId,
        conditionName: picked.name,
        geometry: picked.geometry,
        elementClass: picked.elementClass,
        kinds: picked.kinds.map((entry) => ({ kind: entry.kind, ruleId: entry.ruleId })),
        readings: readingsOf(picked, sources, offered),
      },
      level: levelOf(picked, level, offered),
      geometry: geometryOf(draft, picked.geometry, roles, offered?.windows ?? []),
      replaces: null,
    };
  }, [draft, level, offered, picked, roles, sheet, sources, standing, viewKey]);

  const evidenceFor = useCallback(
    (code: RefusalCode): { href: string; label: string } => {
      if (sheet === null) return { href: "/", label: strings.viewer_partition_evidence_reload };
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(sheet.tenantId, sheet.projectId), label: strings.viewer_partition_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: viewerSheetRoute(sheet.tenantId, sheet.projectId, sheet.drawingId, sheet.sheetName), label: strings.viewer_partition_evidence_reload };
    },
    [sheet],
  );
  const refusedAnswer = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const preview = useCallback(async () => {
    if (statement === null) throw new Error("the card previewed with no finished shape under a condition");
    // A ring standing in no view of the partition is off every view: said by the act's own name, before it is asked (I-375).
    if (statement.viewKey === "") throw refusedAnswer("MANUAL_RING_OFF_VIEW");
    const answer = await doors.preview({ input: statement });
    if (!answer.previewed) throw refusedAnswer(answer.refusal);
    return { consequence: answer.consequence, consequenceDigest: answer.consequenceDigest };
  }, [doors, refusedAnswer, statement]);

  const commit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (statement === null) throw new Error("the card committed with no finished shape under a condition");
      const answer = await doors.commit({ input: statement, consequenceDigest });
      if (!answer.committed) throw refusedAnswer(answer.refusal);
      return { actId: answer.actId };
    },
    [doors, refusedAnswer, statement],
  );

  const input = measure.input;
  const settle = measure.settle;
  // Cancel or Escape keeps the outline on the sheet, as a draft (I-373); Confirm records it and clears
  // it. The dialog closes itself after a commit too, and that close is not an Escape: an Escape with
  // nothing in progress would leave the tool (I-372), and the QS measures on with it armed.
  const committed = useRef(false);
  const onOpenChange = useCallback(
    (open: boolean): void => {
      if (open) return;
      if (committed.current) {
        committed.current = false;
        return;
      }
      input({ kind: "escape" });
    },
    [input],
  );
  const onCommitted = useCallback(
    ({ actId }: { actId: string }): void => {
      committed.current = true;
      setRecorded(actId);
      settle();
    },
    [settle],
  );

  // X on the card cuts out of the outline (Area only): the card gives way to the cut-out ring, and
  // finishing it opens the card again over the outline less what was cut (§ 2.5, I-372).
  const canCut = picked?.geometry === "POLYGON";
  const cutOut = useCallback((): void => input({ kind: "cutout" }), [input]);
  useEffect(() => {
    if (!standing || !canCut) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "x" && event.key !== "X") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      cutOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canCut, cutOut, standing]);

  const place = useMemo((): CardPlace | null => {
    const camera = cameraRef.current;
    const stage = stageRef.current;
    const closing = closingPointOf(draft);
    if (!standing || camera === null || stage === null || closing === null) return null;
    const [x, y] = screenAt(camera, closing);
    const inset = Number.parseFloat(getComputedStyle(stage).getPropertyValue("--space-3")) || 0;
    return cardAt({ x, y }, CARD_SIZE, { width: stage.clientWidth, height: stage.clientHeight }, inset);
  }, [cameraRef, draft, stageRef, standing]);
  const anchor = useMemo(() => {
    const stage = stageRef.current;
    if (place === null || stage === null) return null;
    const box = stage.getBoundingClientRect();
    return { left: Math.round(box.left + place.at.x), top: Math.round(box.top + place.at.y) };
  }, [place, stageRef]);

  const controls =
    !standing || picked === null ? null : (
      <CardControls picked={picked} card={offered} level={level} onLevel={setLevel} sources={sources} onSource={(attribute, source) => setSources((held) => ({ ...held, [attribute]: source }))} cutouts={draft.cutouts.length} roles={roles} onRole={(at, role) => setRoles((held) => Object.assign([...held], { [at]: role }))} canCut={canCut} onCutOut={cutOut} />
    );

  const dialog = !standing ? null : (
    <CardBoundary onRetry={() => setAttempt((held) => held + 1)} onClose={() => onOpenChange(false)}>
      {/* A retried fault mounts the dialog afresh, which previews again (§ 3). */}
      <ConsequenceDialog key={attempt} open={ready} actType={RECORD_MANUAL_MEASUREMENT} preview={preview} commit={commit} onOpenChange={onOpenChange} onCommitted={onCommitted} container={container} controls={controls} anchor={anchor} />
    </CardBoundary>
  );

  return { dialog, recorded, leader: ready ? (place?.leader ?? null) : null };
}

type CardControlsProps = {
  picked: ChestCondition;
  card: MeasureCard | null;
  level: string | null;
  onLevel: (levelId: string) => void;
  sources: Readonly<Record<string, string>>;
  onSource: (attribute: string, source: string) => void;
  cutouts: number;
  roles: readonly CutoutRole[];
  onRole: (at: number, role: CutoutRole) => void;
  canCut: boolean;
  onCutOut: () => void;
};

/**
 * What the person may change before confirming (§ 2.5): the level (a Select over the live stack, the
 * caption's level chosen until another is), where each reading comes from (the condition, or a note
 * of the view that states it), each cut-out's role, and Cut out.
 */
function CardControls({ picked, card, level, onLevel, sources, onSource, cutouts, roles, onRole, canCut, onCutOut }: CardControlsProps): ReactNode {
  const foundation = isFoundationClass(picked.elementClass);
  const levels = card?.levels ?? [];
  const chosen = level ?? card?.levelId ?? "";
  const levelLabel = foundation ? strings.consequence_dialog_measurement_foundation : (levels.find((held) => held.levelId === chosen)?.label ?? "");
  return (
    <>
      <div className="cx-viewer-measure-card-row">
        <span className="cx-viewer-measure-card-label" id="measure-card-level-label">
          {strings.consequence_dialog_measurement_level}
        </span>
        {foundation ? (
          <span data-testid={TESTIDS.consequence.measurementLevel} data-level={FOUNDATION}>
            {strings.consequence_dialog_measurement_foundation}
          </span>
        ) : (
          <Select
            aria-labelledby="measure-card-level-label"
            data-testid={TESTIDS.consequence.measurementLevel}
            options={levels.map((held) => ({ value: held.levelId, label: held.label }))}
            value={chosen}
            placeholder={strings.consequence_dialog_measurement_level_pick}
            onChange={onLevel}
          />
        )}
      </div>
      {picked.readings.map((reading) => {
        const notes = card?.notes.filter((note) => note.attribute === reading.attribute) ?? [];
        if (notes.length === 0) return null;
        return (
          <div key={reading.attribute} className="cx-viewer-measure-card-row">
            <span className="cx-viewer-measure-card-label" id={`measure-card-reading-${reading.attribute}`}>
              {reading.attribute}
            </span>
            <Select
              aria-labelledby={`measure-card-reading-${reading.attribute}`}
              data-testid={TESTIDS.consequence.measurementReadingChoice}
              options={[
                { value: FROM_CONDITION, label: `${strings.consequence_dialog_measurement_reading_condition} · ${reading.valueAsWritten} ${reading.unitAsWritten}` },
                ...notes.map((note) => ({ value: note.sourceKey, label: `${fill(strings.consequence_dialog_measurement_reading_note, { note: note.text })} · ${note.valueAsWritten} ${note.unitAsWritten}` })),
              ]}
              value={sources[reading.attribute] ?? FROM_CONDITION}
              onChange={(source) => onSource(reading.attribute, source)}
            />
          </div>
        );
      })}
      {Array.from({ length: cutouts }, (_, at) => (
        <div key={`cutout-${at + 1}`} className="cx-viewer-measure-card-row">
          <span className="cx-viewer-measure-card-label" id={`measure-card-cutout-${at + 1}`}>
            {fill(strings.consequence_dialog_measurement_cutout_role, { n: String(at + 1) })}
          </span>
          <Select
            aria-labelledby={`measure-card-cutout-${at + 1}`}
            data-testid={TESTIDS.consequence.measurementCutoutRole}
            options={[
              { value: "OPENING", label: strings.consequence_dialog_measurement_role_opening },
              { value: "MEMBER", label: strings.consequence_dialog_measurement_role_member },
            ]}
            value={roles[at] ?? "OPENING"}
            onChange={(role) => onRole(at, role as CutoutRole)}
          />
        </div>
      ))}
      {levelLabel === "" ? null : <p className="cx-viewer-measure-card-scope">{fill(strings.consequence_dialog_measurement_scope, { level: levelLabel })}</p>}
      {canCut ? (
        <Button variant="secondary" data-testid={TESTIDS.consequence.measurementCutout} onClick={onCutOut}>
          {strings.consequence_dialog_measurement_cutout}
          <Kbd>X</Kbd>
        </Button>
      ) : null}
    </>
  );
}
