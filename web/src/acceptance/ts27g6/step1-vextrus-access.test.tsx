/*
 * Ticket S27-G6, part f-17 (G1 walk 1, M0-FL10): the MD's Step 1 top bar shows who from Vextrus has
 * access, with "Revoke" (docs/design/m0-screens.md §6.12, the MD: "The top bar shows who from Vextrus has
 * access: 'TA Vextrus Tanvir Ahmed, Vextrus Engineer, has access until 26 Oct 2026' with 'Revoke'.").
 * On the seed the Vextrus Engineer is Arif Rahman, until 26 Oct 2026. Revoke there is §4.4's act, in its
 * words: the dialog "End Arif Rahman's access now? Their next click is refused. What they did stays under
 * their name." [End access] [Cancel], then the toast "Arif Rahman's access has ended.".
 * A Guest's top bar carries "nothing about Vextrus's access" (§6.12, the Guest).
 * The "TA Vextrus" chip's form is not pinned here (no chip of that form exists yet): only the words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeApi, PEOPLE, mountApp } from "@/app/testing";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T06:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
const text = (el: Element | null | undefined) => clean(el?.textContent);

const NOTICE = "Arif Rahman, Vextrus Engineer, has access until 26 Oct 2026";

function topBar(): HTMLElement {
  const bar = document.querySelector<HTMLElement>('[data-region="top-bar"]');
  if (!bar) throw new Error("no top bar");
  return bar;
}

async function step1(as: string, api = new FakeApi()) {
  await mountApp("/p/KR-01/takeoff/1", { as, api });
  await waitFor(() =>
    expect(document.querySelector('[data-region="top-bar"]')).not.toBeNull(),
  );
  return api;
}

describe("§6.12: the MD’s top bar on Step 1", () => {
  it('shows who from Vextrus has access, until when, with "Revoke"', async () => {
    await step1(PEOPLE.md);
    await waitFor(() =>
      expect(
        text(topBar()),
        "the Vextrus access notice in the top bar",
      ).toContain(NOTICE),
    );
    expect(
      within(topBar()).getByRole("button", { name: /Revoke/ }),
    ).toBeVisible();
  });

  it("revokes from there in §4.4’s words, and the notice goes", async () => {
    const api = await step1(PEOPLE.md);
    await waitFor(() =>
      expect(
        text(topBar()),
        "the Vextrus access notice in the top bar",
      ).toContain(NOTICE),
    );
    await userEvent.click(
      within(topBar()).getByRole("button", { name: /Revoke/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: (name) => clean(name) === "End Arif Rahman’s access now?",
    });
    expect(text(dialog)).toContain(
      "Their next click is refused. What they did stays under their name.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "End access" }),
    );
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          text(el) === "Arif Rahman’s access has ended.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(text(topBar())).not.toContain("has access until"),
    );
    expect(
      api.memberships.find(
        (m) => m.role === "vextrus_engineer" && m.revokedAt !== null,
      ),
    ).toBeDefined();
  });
});

describe("§6.12: a Guest’s top bar", () => {
  it("carries nothing about Vextrus’s access", async () => {
    await step1(PEOPLE.guest);
    await waitFor(() =>
      expect(text(topBar())).toContain(
        "Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026",
      ),
    );
    expect(text(topBar())).not.toContain("has access until");
    expect(
      within(topBar()).queryByRole("button", { name: /Revoke/ }),
    ).toBeNull();
  });
});
