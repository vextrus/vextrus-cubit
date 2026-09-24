// S-Viewer's rooms panel as a journey drives it (viewer.md Part 7 § 7): the closed test ids, and the
// gestures J-042 walks — spelled once so no journey writes a selector twice (C-05, B-17). The sheet,
// its camera and its status line are `tests/e2e/viewer/s-viewer.page.ts`'s.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The group kind a plan's rooms are offered under (L-ACT-02's closed enum, viewer.md I-687). */
const PROPOSED_ROOMS = "PROPOSED_ROOMS";

export class SRoomsPage {
  constructor(private readonly page: Page) {}

  get panel(): Locator {
    return this.page.getByTestId(TESTIDS.rooms.panel);
  }

  get plans(): Locator {
    return this.page.getByTestId(TESTIDS.rooms.plan);
  }

  /** The plan whose caption opens with these words. */
  plan(caption: string): Locator {
    return this.plans.filter({ has: this.page.getByRole("heading", { level: 3, name: caption }) });
  }

  /** The rows of one plan's rooms. */
  rooms(plan: Locator): Locator {
    return plan.getByTestId(TESTIDS.rooms.room);
  }

  /** The door that opens one plan's confirmation — the offer's own, never the act (offered-group I-81). */
  offerDoor(plan: Locator): Locator {
    return plan.locator(`${testIdSelector(TESTIDS.offered.group)}[data-kind="${PROPOSED_ROOMS}"]`).getByTestId(TESTIDS.offered.groupConfirm);
  }

  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }

  get subjectRows(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.subjectRow);
  }

  get confirm(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.confirm);
  }

  /** A plan's `data-` count, as a number. */
  async count(plan: Locator, name: "data-offered" | "data-confirmed" | "data-untyped"): Promise<number> {
    const raw = await heldAttribute(plan, name);
    expect(raw, `the plan publishes ${name} (viewer.md Part 7 § 7)`).not.toBeNull();
    return Number(raw);
  }
}
