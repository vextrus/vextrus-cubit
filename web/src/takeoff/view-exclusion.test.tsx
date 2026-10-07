/*
 * S15-W9's fix round: X on a view already left out opens no picker (a second exclusion would take the
 * first one's place, m0-screens §6.6/§6.9). Ticket 22's fake, S-04 given one view the API left out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { page } from "vitest/browser";
import { FakeApi, PEOPLE, mountApp } from "@/app/testing";
import { FakeStep1 } from "@/acceptance/t22/step1.fixture";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T06:00:00Z"));
  await page.viewport(1440, 900);
});
afterEach(() => vi.useRealTimers());

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[⁦-⁩‎‏]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const VIEW = "f9150000-0000-4000-8000-000000000002";

describe("X on a view already left out", () => {
  it("opens no exclusion picker", async () => {
    const api = new FakeApi();
    const step1 = new FakeStep1(api);
    const s04 = step1.proposals.find((p) => p.number === "S-04")!;
    Object.assign(s04, {
      views: [
        {
          id: VIEW,
          ordinal: 1,
          kind: "section",
          title: "BEAM SECTION 1-1",
          stated_scale: "",
          not_to_scale: true,
          storeys: [],
          storeys_as_stated: "",
          storeys_meaning: null,
          steps: ["beams"],
          part: null,
          proposed_exclusion: null,
          decision: "excluded",
          excluded_reason: "duplicate",
          box: ["70", "10", "90", "30"],
        },
      ],
    });
    await mountApp("/p/KR-01/takeoff/1", { as: PEOPLE.qs, api });
    await waitFor(() =>
      expect(clean(document.body.textContent)).toContain("Confirmed 0 / 24"),
    );
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[role="row"]'),
    ].filter((r) => clean(r.textContent).includes("S-04"));
    await userEvent.click(within(rows.at(-1)!).getByText("S-04"));
    await userEvent.keyboard(" ");
    await screen.findByRole("group", { name: /S-04/ });
    await waitFor(() =>
      expect(document.querySelectorAll("[data-outline]")).toHaveLength(1),
    );
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(
        document.querySelector('[data-outline][aria-pressed="true"]'),
      ).not.toBeNull(),
    );
    await userEvent.keyboard("x");
    await new Promise((r) => setTimeout(r, 200));
    expect(clean(document.body.textContent)).not.toMatch(
      /Exclude (the view|S-04)/,
    );
    expect(step1.calls()).not.toContain("POST /exclude");
  });
});
