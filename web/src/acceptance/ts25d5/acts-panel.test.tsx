/*
 * Ticket S25-D5 (#719; G1 walk 1's f-5, FL10): the Members and access "Acts" side panel names the sheet a
 * Vextrus Engineer confirmed back in and the reason it was excluded before (docs/design/m0-screens.md
 * §4.4: "'Acts' ... opens, in a side panel, the Engineer's acts from the event log in words, newest
 * first ("Confirmed S-07 back in, excluded before as superseded · Kadam Residence · 26 Sep 2026,
 * 15:42")"). The reason's words are §6's short forms ("superseded", "duplicate", "for information").
 *
 * The API's act is crafted here as the backend's acceptance tests (vextrus/takeoff/tests/acceptance/
 * ts25d5) pin it: `params.excluded_before`, one `{sheet, reason}` per sheet, the reason a code. §4.4
 * gives the one-sheet sentence only; for several sheets its exact words are the builder's (and the words
 * gate's): these tests ask that each sheet and its reason are named, never a bare count.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeApi, PEOPLE, mountApp } from "@/app/testing";

const SHAPLA = "Shapla Homes Ltd";
const CONFIRMED_BACK_IN = "takeoff.step1.confirmed_back_in";
const AT = "2026-09-26T09:42:00Z"; // 15:42 in Dhaka

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T06:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Visible text: without the isolates the message layer puts round every value, spaces plain. */
const text = (el: Element | null | undefined) =>
  (el?.textContent ?? "")
    .replace(/[\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ");
const named = (re: RegExp) => (name: string) =>
  re.test(name.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " "));

type BackIn = { sheet: string; reason: string };

/** The seed's API, Arif Rahman (the seed's Vextrus Engineer) having confirmed `sheets` back in on
 * Kadam Residence at 15:42 on 26 Sep 2026; the act's params as the backend sends them. */
function apiWith(sheets: BackIn[]): FakeApi {
  const api = new FakeApi();
  const arif = api.user(PEOPLE.engineer);
  const kr01 = api.projects.find((p) => p.code === "KR-01")!;
  api.addAct(
    api.developer(SHAPLA).id,
    CONFIRMED_BACK_IN,
    arif.id,
    null,
    AT,
    kr01.id,
  );
  const actId = api.acts.at(-1)!.id;
  const real = api.handle;
  api.handle = async (request: Request) => {
    const response = await real(request);
    if (
      request.method !== "GET" ||
      new URL(request.url).pathname !== "/api/activity" ||
      !response.ok
    )
      return response;
    const acts = (await response.json()) as {
      id: string;
      params: Record<string, unknown>;
    }[];
    for (const act of acts)
      if (act.id === actId)
        act.params = {
          ...act.params,
          sheets: sheets.length,
          excluded_before: sheets,
        };
    return new Response(JSON.stringify(acts), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return api;
}

/** The MD opens Arif Rahman's acts on Members and access: the panel's lines. */
async function actsLines(api: FakeApi): Promise<string[]> {
  await mountApp("/members", { as: PEOPLE.md, api });
  const access = await screen.findByRole("table", {
    name: named(/^Vextrus access$/),
  });
  const arif = within(access)
    .getAllByRole("row")
    .find((r) => text(r.querySelector("td")) === "Arif Rahman")!;
  await userEvent.click(
    within(arif).getByRole("button", {
      name: named(/ acts, last .*, by Arif Rahman$/),
    }),
  );
  const panel = await screen.findByRole("region", {
    name: named(/^Arif Rahman \(Vextrus\)$/),
  });
  await waitFor(() =>
    expect(within(panel).getAllByRole("listitem").length).toBeGreaterThan(2),
  );
  return within(panel)
    .getAllByRole("listitem")
    .map((li) => text(li));
}

it('reads "Confirmed S-07 back in, excluded before as superseded · Kadam Residence · 26 Sep 2026, 15:42"', async () => {
  const lines = await actsLines(
    apiWith([{ sheet: "S-07", reason: "superseded" }]),
  );

  expect(lines).toContain(
    "Confirmed S-07 back in, excluded before as superseded · Kadam Residence · 26 Sep 2026, 15:42",
  );
});

it("names each of several sheets confirmed back in with its own earlier reason, never a bare count", async () => {
  const lines = await actsLines(
    apiWith([
      { sheet: "S-07", reason: "superseded" },
      { sheet: "A-24", reason: "for_information" },
    ]),
  );

  const line = lines.find((l) => l.includes("S-07"));
  expect(line, lines.join("\n")).toBeDefined();
  expect(line).toMatch(/^Confirmed /);
  expect(line).toMatch(/ · Kadam Residence · 26 Sep 2026, 15:42$/);
  expect(line).toContain("A-24");
  expect(line).toContain("superseded");
  expect(line).toContain("for information");
  expect(line).not.toContain("for_information");
  expect(line).not.toMatch(/\b2 sheets\b/);
});
