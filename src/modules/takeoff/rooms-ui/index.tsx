"use client";
/**
 * The rooms panel (viewer.md Part 7, I-687): the viewer's left column, under the views/grid
 * panel. Per plan of the drawing, the offer to confirm its rooms in one act — named from their labels,
 * typed from their labels or by Jev where the labels name no type — and every room the offer leaves
 * out, with why and the door to type it on its own. The regions the rooms stage listed and registered
 * no room for are said beneath, with their reasons: measure less, completely, and say so.
 *
 * Markup only. The offer, the refusal, the type control and the dialog are the screen's (ARCH-01: a
 * module reaches no `src/ui` primitive), handed in as slots, so there is one OfferedGroups and one
 * ConsequenceDialog in the product (B-17).
 */
import { formatUserFigure } from "@/core/format";
import { exact } from "@/core/units/canon";
import type { ComponentType, ReactNode } from "react";
import { ROOMS_COPY, fillRoomsCopy } from "./copy";
import type { RoomsPanelPlan, RoomsPanelRoom, RoomsPanelView } from "./view";
import "./rooms.css";

/** The ids this panel publishes, read from `src/ui/testids.ts` by the screen (AM-09 §1, ARCH-01). */
export type RoomsPanelTestIds = {
  readonly panel: string;
  readonly plan: string;
  readonly room: string;
  readonly refused: string;
};

export type RoomsPanelProps = {
  /** Where the reading stands: asked and not answered, answered, or failed. */
  phase: "loading" | "ready" | "failed";
  view: RoomsPanelView | null;
  /** How many rooms are being put to Jev right now (0 when none). */
  asking: number;
  onRetry: () => void;
  /** The one OfferedGroups, over this plan's group, mounted by the screen — or nothing. */
  offer: (plan: RoomsPanelPlan) => ReactNode;
  /** The screen's type control for a room nobody typed: the roster, and the door to confirm it alone. */
  typeControl: (room: RoomsPanelRoom) => ReactNode;
  /** The region's answer slot: one RefusalState, the offline notice or the denial — or nothing. */
  answer: ReactNode;
  /** The shipped EnumLabel (R-UI-082): a room type is an enum, said in a reader's words. */
  EnumLabel?: ComponentType<{ value: string; label?: string; className?: string }>;
  /** EnumLabel's one rule for words, for a reason said inside a sentence. */
  humaniseEnum?: (value: string) => string;
  testIds: RoomsPanelTestIds;
};

/** How many decimal places a room's area is said to — the partition panel's own. */
const AREA_PLACES = 2;

/** The model's confidence as a whole percentage through the figure seam, or null. */
function percentOf(confidence: string | null): string | null {
  if (confidence === null) return null;
  return formatUserFigure(exact(confidence).times(100).toFixed(0));
}

/** How a room's type was read, in a reader's words. */
function basisWords(room: RoomsPanelRoom): string | null {
  if (room.state === "CONFIRMED") return ROOMS_COPY.rooms_confirmed;
  if (room.basis === "LABEL") return ROOMS_COPY.rooms_basis_label;
  if (room.basis === "MODEL") {
    const percent = percentOf(room.confidence);
    return percent === null ? ROOMS_COPY.rooms_basis_model_unsure : fillRoomsCopy("rooms_basis_model", { confidence: percent });
  }
  if (room.basis === "PERSON") return ROOMS_COPY.rooms_basis_person;
  return null;
}

function RoomLine({ room, typeControl, EnumLabel, testId }: { room: RoomsPanelRoom; typeControl: RoomsPanelProps["typeControl"]; EnumLabel: RoomsPanelProps["EnumLabel"]; testId: string }) {
  const area = room.areaM2 === null ? null : fillRoomsCopy("rooms_area", { area: formatUserFigure(exact(room.areaM2).toFixed(AREA_PLACES)) });
  const why = room.why === "NONE_OF_THESE" ? ROOMS_COPY.rooms_untyped_none : room.why === "UNASKED" ? ROOMS_COPY.rooms_untyped_unasked : null;
  const said = basisWords(room);
  return (
    <li className="cx-rooms-row" data-testid={testId} data-room-key={room.roomKey} data-state={room.state} data-type={room.type ?? undefined} data-basis={room.basis ?? undefined}>
      <span className="cx-rooms-line">
        <span className="cx-rooms-name">{room.name}</span>
        {room.type === null ? null : <span className="cx-rooms-type">{EnumLabel === undefined ? room.type : <EnumLabel value={room.type} />}</span>}
      </span>
      <span className="cx-rooms-line cx-rooms-note">
        {area === null ? null : <span className="cx-rooms-figure">{area}</span>}
        {said === null ? null : <span>{said}</span>}
        {why === null ? null : <span>{why}</span>}
      </span>
      {room.state === "WAITING" ? typeControl(room) : null}
    </li>
  );
}

function PlanSection({ plan, props }: { plan: RoomsPanelPlan; props: RoomsPanelProps }) {
  const counts = fillRoomsCopy("rooms_plan_counts", {
    rooms: formatUserFigure(String(plan.rooms.length)),
    confirmed: formatUserFigure(String(plan.confirmed)),
    untyped: formatUserFigure(String(plan.untyped)),
  });
  return (
    <section className="cx-rooms-plan" data-testid={props.testIds.plan} data-view-key={plan.viewKey} data-offered={plan.offered} data-confirmed={plan.confirmed} data-untyped={plan.untyped}>
      <h3 className="cx-rooms-caption">{plan.caption}</h3>
      <p className="cx-rooms-counts">{counts}</p>
      {plan.group === null ? null : props.offer(plan)}
      <ul className="cx-rooms-list">
        {plan.rooms.map((room) => (
          <RoomLine key={room.roomKey} room={room} typeControl={props.typeControl} EnumLabel={props.EnumLabel} testId={props.testIds.room} />
        ))}
      </ul>
      {plan.refused.length === 0 ? null : (
        <>
          <h4 className="cx-rooms-subheading">{ROOMS_COPY.rooms_refused_heading}</h4>
          <ul className="cx-rooms-list">
            {plan.refused.map((region, at) => (
              <li key={`${region.name ?? ""}-${at}`} className="cx-rooms-row cx-rooms-note" data-testid={props.testIds.refused} data-reason={region.reason}>
                <span className="cx-rooms-name">{region.name ?? ROOMS_COPY.rooms_unnamed}</span>
                <span>{props.humaniseEnum === undefined ? region.reason : props.humaniseEnum(region.reason)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function RoomsPanel(props: RoomsPanelProps) {
  const { phase, view, asking, onRetry, answer, testIds } = props;
  const body = (): ReactNode => {
    if (phase === "failed")
      return (
        <p className="cx-rooms-note">
          {ROOMS_COPY.rooms_failed}{" "}
          <button type="button" className="cx-rooms-retry cx-reticle" onClick={onRetry}>
            {ROOMS_COPY.rooms_retry}
          </button>
        </p>
      );
    if (phase === "loading" || view === null) return <p className="cx-rooms-note">{ROOMS_COPY.rooms_loading}</p>;
    if (view.state === "UNREAD") return <p className="cx-rooms-note">{ROOMS_COPY.rooms_unread}</p>;
    if (view.state === "EMPTY") return <p className="cx-rooms-note">{ROOMS_COPY.rooms_empty}</p>;
    return view.plans.map((plan) => <PlanSection key={plan.viewKey} plan={plan} props={props} />);
  };
  return (
    <section className="cx-rooms" data-testid={testIds.panel} data-state={phase} aria-labelledby="cx-rooms-heading">
      <h2 className="cx-rooms-heading" id="cx-rooms-heading">
        {ROOMS_COPY.rooms_heading}
      </h2>
      {asking === 0 ? null : (
        <p className="cx-rooms-note" role="status">
          {fillRoomsCopy("rooms_asking", { count: formatUserFigure(String(asking)) })}
        </p>
      )}
      {answer}
      {body()}
    </section>
  );
}
