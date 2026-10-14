/*
 * S25-D5 fix after review round 1: the acts panel's "confirmed back in" sentence keeps every sheet (a
 * numberless one is named by its title, as the Step 1 list does) so the count stays true, and words each
 * reason to read after "excluded before as" (REASON_SHORT is made for "S-20 excluded: superseded").
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

type BackIn = { sheet: string; reason: string; title?: string };

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


const FIRST_LINE = (lines: string[]) => lines.find((l) => /^Confirmed /.test(l) && l.includes("Kadam Residence"))!;

it("names a numberless sheet by its title and keeps the count true", async () => {
  const lines = await actsLines(
    apiWith([
      { sheet: "S-07", reason: "superseded" },
      { sheet: "", title: "Cover sheet", reason: "cover_index" },
      { sheet: "A-24", reason: "superseded" },
    ]),
  );
  const line = FIRST_LINE(lines);
  expect(line, lines.join("\n")).toBeDefined();
  expect(line).toContain("S-07");
  expect(line).toContain("A-24");
  expect(line).toContain("Cover sheet");
  expect(line).toContain("a cover or index");
});

it("names a sheet with neither number nor title, never dropping it", async () => {
  const lines = await actsLines(
    apiWith([
      { sheet: "S-07", reason: "superseded" },
      { sheet: "", reason: "blank" },
    ]),
  );
  expect(FIRST_LINE(lines)).toContain("a sheet with no number or title");
});

it("with many sheets leads with the true count and names every sheet", async () => {
  const sheets = ["S-01", "S-02", "S-03", "S-04", "S-05"].map((sheet) => ({ sheet, reason: "duplicate" }));
  sheets.push({ sheet: "", reason: "other", title: "Index" } as never);
  const line = FIRST_LINE(await actsLines(apiWith(sheets)));
  expect(line).toMatch(/^Confirmed 6 sheets back in, excluded before:/);
  for (const n of ["S-01", "S-02", "S-03", "S-04", "S-05", "Index"]) expect(line).toContain(n);
  expect((line.match(/excluded before/g) ?? []).length).toBe(1);
});

it.each([
  ["superseded", "superseded"],
  ["duplicate", "a duplicate"],
  ["cover_index", "a cover or index"],
  ["for_information", "for information"],
  ["by_others", "the work of others"],
  ["blank", "blank"],
  ["other", "something else"],
  ["not_a_code", "something Vextrus has no words for yet"],
])("words the reason %s so it reads after 'excluded before as'", async (reason, words) => {
  const line = FIRST_LINE(await actsLines(apiWith([{ sheet: "S-07", reason }])));
  expect(line).toContain(`S-07 back in, excluded before as ${words} · `);
});
