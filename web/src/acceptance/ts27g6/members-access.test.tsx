/*
 * Ticket S27-G6 (G1 walk 1, M0-FL10): Members and access tell the truth (docs/design/m0-screens.md §4.4),
 * on the seed served by the in-memory API, as the MD.
 *
 * - f-7 (#831): the invite form refuses, at invite time, a Vextrus Engineer invitation for an email with
 *   no Vextrus staff account, under the Email field as every refusal about the email is ("Email already a
 *   member: Under the field"), in the words the triage gives ("No Vextrus account has this email…"; the
 *   rest of the sentence is the words gate's), and no link is made or listed under "Invitations not used
 *   yet". The API's refusal is pinned in vextrus/platform/tests/acceptance/ts27g6.
 * - f-13/f-19 (#669, #323): an Ended row (the seed's Jamal Hossain, "Ended 20 Sep 2026") offers
 *   "Renew 30 days" only, never "Revoke".
 * - f-18 (#323): each access row shows the acts done under it ("12 acts, last 26 Sep 2026"), an earlier
 *   access row included; today only a person's first row is counted and the others read "—". The rows
 *   are crafted here as the API sends them (its per-row `acts` is pinned in the backend's tests).
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

/** Visible text: without the isolates the message layer puts round every value, spaces plain. */
const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
const text = (el: Element | null | undefined) => clean(el?.textContent);
const named = (re: RegExp) => (name: string) => re.test(clean(name));

async function members(api = new FakeApi()) {
  await mountApp("/members", { as: PEOPLE.md, api });
  await screen.findByRole("table", { name: named(/^People at /) });
  return api;
}

function rowsOf(tableName: RegExp) {
  return within(screen.getByRole("table", { name: named(tableName) }))
    .getAllByRole("row")
    .slice(1);
}

function row(tableName: RegExp, first: string) {
  const found = rowsOf(tableName).filter(
    (r) => text(r.querySelector("td")) === first,
  );
  if (found.length !== 1)
    throw new Error(
      `expected one row ${first} in ${String(tableName)}, found ${found.length}`,
    );
  return found[0]!;
}

function buttons(r: HTMLElement) {
  return within(r)
    .queryAllByRole("button")
    .map((b) => text(b));
}

describe("f-7: a Vextrus Engineer is invited only by the email of a Vextrus account", () => {
  it("refuses the invitation under the Email field and makes no link", async () => {
    const api = await members();
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    const dialog = await screen.findByRole("dialog", {
      name: named(/^Invite someone to /),
    });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Vextrus Engineer" }),
    );
    const email = within(dialog).getByLabelText("Email");
    await userEvent.type(email, "nobody@vextrus.example");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create link" }),
    );

    await waitFor(() =>
      expect(email, "the Email field is refused").toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    const error = document.getElementById(
      email.getAttribute("aria-describedby")!.split(" ")[0]!,
    );
    expect(text(error)).toMatch(/^No Vextrus account has this email/);
    expect(text(dialog)).not.toMatch(/Copy this link/);
    expect(text(document.body), "a message code on screen").not.toMatch(
      /\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/,
    );
    expect(
      api.memberships.some((m) => m.invitedEmail === "nobody@vextrus.example"),
    ).toBe(false);
    // Behind the dialog, nothing is listed under "Invitations not used yet" (the API was read again, or not).
    expect(
      text(
        screen.getByRole("table", {
          name: named(/^Invitations not used yet$/),
          hidden: true,
        }),
      ),
    ).not.toContain("nobody@vextrus.example");
  });
});

describe("f-13, f-19: an Ended row offers Renew only", () => {
  it('offers "Renew 30 days" and no "Revoke" on the Ended guest’s row', async () => {
    await members();
    const jamal = row(/^People at /, "Jamal Hossain");
    expect(text(jamal)).toContain("Ended 20 Sep 2026");
    expect(buttons(jamal)).toEqual(["Renew 30 days"]);
  });

  it('still offers "Renew 30 days" and "Revoke" on a current row', async () => {
    await members();
    expect(buttons(row(/^People at /, "Farhana Kabir"))).toEqual([
      "Renew 30 days",
      "Revoke",
    ]);
  });
});

describe("f-18: each access row counts the acts done under it", () => {
  /** The seed's API with Arif Rahman's Vextrus access given as two rows: the current one (since 26 Sep,
   * 3 acts, the last on 27 Sep) and an earlier one he was revoked from (2 acts, the last on 12 Sep), each
   * row's `acts` and `last_act_at` as the API counts them per access period. */
  function twoPeriods(): FakeApi {
    const api = new FakeApi();
    const real = api.handle;
    api.handle = async (request: Request) => {
      const response = await real(request);
      if (
        request.method !== "GET" ||
        new URL(request.url).pathname !== "/api/members" ||
        !response.ok
      )
        return response;
      const body = (await response.json()) as {
        vextrus_access: Record<string, unknown>[];
      };
      const current = body.vextrus_access.find(
        (p) => p.name === "Arif Rahman",
      )!;
      const earlier = {
        ...current,
        membership_id: "00000000-0000-4000-8000-0000000000e1",
        since: "2026-09-08T04:00:00Z",
        until: "2026-10-08T17:59:00Z",
        ended_at: "2026-09-14T06:00:00Z",
        how_ended: "revoked",
        revoked_by: "Kamal Uddin",
        acts: 2,
        last_act_at: "2026-09-12T09:42:00Z",
        actions: [],
      };
      Object.assign(current, { acts: 3, last_act_at: "2026-09-27T09:42:00Z" });
      body.vextrus_access = [
        current,
        earlier,
        ...body.vextrus_access.filter((p) => p !== current),
      ];
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    };
    return api;
  }

  it("shows each of a person’s rows its own acts, the earlier row’s too", async () => {
    await members(twoPeriods());
    const arif = rowsOf(/^Vextrus access$/).filter(
      (r) => text(r.querySelector("td")) === "Arif Rahman",
    );
    expect(arif).toHaveLength(2);
    const acts = arif.map((r) => text(r));
    expect(acts[0]).toContain("3 acts, last 27 Sep 2026");
    expect(
      acts[1],
      "the earlier access row counts the acts done under it",
    ).toContain("2 acts, last 12 Sep 2026");
  });
});
