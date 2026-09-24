// @vitest-environment jsdom
/**
 * The rooms panel as a reader meets it (viewer.md Part 7, I-687): per plan, the offer to confirm
 * its rooms in one act, every room with the type read and how it was read, the rooms the offer leaves
 * out with why and a type control of their own, and the regions registered as no room, with their
 * reasons. Markup only: the offer and the control are the screen's slots, and this judges where the
 * panel places them and what it says around them.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RoomsPanel } from "../../../src/modules/takeoff/rooms-ui";
import type { RoomsPanelView } from "../../../src/modules/takeoff/rooms-ui/view";

afterEach(cleanup);

const IDS = { panel: "rp", plan: "rp-plan", room: "rp-room", refused: "rp-refused" };

const VIEW: RoomsPanelView = {
  state: "READ",
  unasked: 0,
  plans: [
    {
      viewKey: "v:plan",
      caption: "TYPICAL FLOOR PLAN (1ST TO 6TH)",
      group: { kind: "PROPOSED_ROOMS", drawingId: "d", viewKey: "v:plan" },
      offered: 2,
      confirmed: 1,
      untyped: 1,
      refused: [{ name: "GUARD ROOM", reason: "SURFACE_NOT_CLOSED" }],
      rooms: [
        { roomKey: "a", name: "BED-01", areaM2: "23.9", state: "OFFERED", type: "BED", basis: "LABEL", confidence: null, why: null },
        { roomKey: "b", name: "LIVING / DINING", areaM2: "45.123", state: "OFFERED", type: "LIVING", basis: "MODEL", confidence: "0.99", why: null },
        { roomKey: "c", name: "KITCHEN", areaM2: null, state: "CONFIRMED", type: "KITCHEN", basis: "LABEL", confidence: null, why: null },
        { roomKey: "d", name: "PUMP ROOM", areaM2: "4", state: "WAITING", type: null, basis: null, confidence: null, why: "NONE_OF_THESE" },
      ],
    },
  ],
};

function mount(view: RoomsPanelView | null, phase: "loading" | "ready" | "failed" = "ready") {
  const offered: string[] = [];
  const controlled: string[] = [];
  render(
    <RoomsPanel
      phase={phase}
      view={view}
      asking={0}
      onRetry={() => undefined}
      offer={(plan) => {
        offered.push(plan.viewKey);
        return <div data-testid="offer-slot">{plan.offered}</div>;
      }}
      typeControl={(room) => {
        controlled.push(room.roomKey);
        return <div data-testid="type-slot" />;
      }}
      answer={null}
      testIds={IDS}
    />,
  );
  return { offered, controlled };
}

describe("the rooms panel (viewer.md Part 7)", () => {
  test("offers the plan's group once, lists every room with how its type was read, and gives only the untyped a control", () => {
    const { offered, controlled } = mount(VIEW);
    expect(offered, "one offer, for the plan whose group stands").toEqual(["v:plan"]);
    expect(controlled, "a type control for the room nobody typed, and none for the rest").toEqual(["d"]);
    const rows = screen.getAllByTestId(IDS.room);
    expect(rows.map((row) => [row.getAttribute("data-room-key"), row.getAttribute("data-state"), row.getAttribute("data-type")])).toEqual([
      ["a", "OFFERED", "BED"],
      ["b", "OFFERED", "LIVING"],
      ["c", "CONFIRMED", "KITCHEN"],
      ["d", "WAITING", null],
    ]);
    expect(within(rows[0] as HTMLElement).getByText("From its label")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("Proposed by Jev, 99 % sure"), "the model's confidence through the figure seam").toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("45.12 m²")).toBeTruthy();
    expect(within(rows[2] as HTMLElement).getByText("Confirmed")).toBeTruthy();
    expect(within(rows[3] as HTMLElement).getByText("Jev read no type in its label"), "the room left out says why").toBeTruthy();
    expect(screen.getByText("4 rooms · 1 confirmed · 1 to type")).toBeTruthy();
  });

  test("says the regions it registered no room for, with their reasons — never silently", () => {
    mount(VIEW);
    const refused = screen.getAllByTestId(IDS.refused);
    expect(refused.map((row) => row.getAttribute("data-reason"))).toEqual(["SURFACE_NOT_CLOSED"]);
    expect(within(refused[0] as HTMLElement).getByText("GUARD ROOM")).toBeTruthy();
  });

  test("offers nothing on a plan whose rooms are all confirmed or untyped", () => {
    const plan = VIEW.state === "READ" ? VIEW.plans[0] : undefined;
    if (plan === undefined) throw new Error("the fixture view has a plan");
    const { offered } = mount({ state: "READ", unasked: 0, plans: [{ ...plan, group: null, offered: 0 }] });
    expect(offered).toEqual([]);
  });

  test("says which emptiness it is: not read yet, no rooms, or reading", () => {
    mount({ state: "UNREAD" });
    expect(screen.getByText("This drawing has not been read yet, so no room stands on it.")).toBeTruthy();
    cleanup();
    mount({ state: "EMPTY" });
    expect(screen.getByText("The plans of this drawing enclose no room the product could read.")).toBeTruthy();
    cleanup();
    mount(null, "loading");
    expect(screen.getByTestId(IDS.panel).getAttribute("data-state")).toBe("loading");
  });
});
