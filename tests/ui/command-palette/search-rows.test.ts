// @vitest-environment jsdom
/**
 * AC-3 — the seam's answer, on the screen: what is asked, what stands while it is pending, what a
 * hit becomes, where Enter goes, what an unmatched query says, and what a chosen row leaves behind.
 *
 * The addresses are never transcribed: each expectation is built by the very functions the four
 * kinds map through (`projectHomeRoute` · `drawingsRoute` · `viewerSheetRoute` · `setRoute`), read
 * from the homes that already own them (B-17, B-19).
 *
 * A query no area, action or shortcut label carries is used wherever the case is about the navigate
 * group alone, so the rows on the screen are exactly the hits the seam answered.
 */
import { cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import {
  DRAWING,
  LAYOUT,
  OTHER_TENANT,
  PROJECT,
  SET,
  TENANT,
  aHit,
  all,
  copy,
  fill,
  hrefOf,
  one,
  openPalette,
  paletteInput,
  paletteNames,
  routeBuilders,
  rowsOf,
  stageHost,
  text,
  visibleRows,
  type SearchHit,
} from "./support/palette-stage";

/** A token no label of the workspace's own chrome carries, so only answered hits can match it. */
const TOKEN = "Zzq";

/** One hit of each kind, each carrying the ids its address is built from. */
const HITS: readonly SearchHit[] = [
  aHit({ kind: "project", label: `${TOKEN} Terminal`, projectId: PROJECT }),
  aHit({ kind: "drawing", label: `${TOKEN} Elevation`, projectId: PROJECT, drawingId: DRAWING }),
  aHit({ kind: "sheet", label: `${TOKEN} ${LAYOUT}`, projectId: PROJECT, drawingId: DRAWING, layoutName: LAYOUT }),
  aHit({ kind: "set", label: `${TOKEN} Tender Set`, projectId: PROJECT, setId: SET }),
];

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** Open, type, and wait until the seam has been asked for exactly this query. */
async function ask(body: HTMLElement, asked: string[], query: string): Promise<HTMLInputElement> {
  const user = userEvent.setup();
  await openPalette(body);
  const input = paletteInput(body);
  await user.type(input, query);
  await waitFor(() => expect(asked, `the host asks the seam for the query as typed (AC-3): asked ${JSON.stringify(asked)}`).toContain(query));
  return input;
}

describe("AC-3 — the query travels to the seam, and the wait is shown in the list's place", () => {
  test("AC-3: while the answer is pending `command-palette-loading` stands where the list was", async () => {
    const { body, search } = await stageHost();
    search.hold();

    await ask(body, search.queries, TOKEN);

    const loading = await waitFor(() => one(body, "command-palette-loading"));
    expect(loading.getAttribute("aria-busy"), "the pending list says it is busy (Decision §2)").toBe("true");
    expect(all(body, "command-palette-list").length, "…and it stands in the list's place, never beside it").toBe(0);

    search.settle({ hits: HITS });
    await waitFor(() => expect(all(body, "command-palette-loading").length, "the wait ends when the answer arrives").toBe(0));
    await waitFor(() => expect(visibleRows(body).length, "…and the answered rows take its place").toBe(HITS.length));
  });
});

describe("AC-3 — an answered hit is an option of the navigate group", () => {
  test("AC-3: every hit renders as a kinded, available option inside `command-palette-group[data-group=\"navigate\"]`", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: HITS });

    await ask(body, search.queries, TOKEN);
    await waitFor(() => expect(rowsOf(body, "navigate").length, "one row per answered hit").toBe(HITS.length));

    const rows = rowsOf(body, "navigate");
    expect(
      rows.map((row) => [row.getAttribute("role"), row.getAttribute("data-kind"), row.getAttribute("data-available")]),
      "each row is an option, kinded by the hit's own kind, and reachable",
    ).toEqual(HITS.map((hit) => ["option", hit.kind, "true"]));
    for (const [at, row] of rows.entries()) {
      expect(text(row), `the row carries the hit's stored name as it stands: ${HITS[at]?.label ?? ""}`).toContain(HITS[at]?.label ?? "");
    }
  });
});

describe("AC-3 — the arrows walk the rows and Enter takes the active one's address", () => {
  test("AC-3: ArrowDown moves `aria-selected` and `aria-activedescendant` down the visible rows", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: HITS });

    const input = await ask(body, search.queries, TOKEN);
    await waitFor(() => expect(visibleRows(body).length).toBe(HITS.length));

    const rows = visibleRows(body);
    const first = rows[0] as HTMLElement;
    expect(first.getAttribute("aria-selected"), "a query re-activates the first option (Decision §1)").toBe("true");
    expect(input.getAttribute("aria-activedescendant"), "…and the input names it").toBe(first.id);

    const user = userEvent.setup();
    await user.keyboard("{ArrowDown}");

    const second = visibleRows(body)[1] as HTMLElement;
    await waitFor(() => expect(second.getAttribute("aria-selected"), "ArrowDown moves the active option down").toBe("true"));
    expect(first.getAttribute("aria-selected"), "…and only one option is active").not.toBe("true");
    expect(paletteInput(body).getAttribute("aria-activedescendant"), "…and the input names the new one").toBe(second.id);
  });

  for (const hit of HITS) {
    test(`AC-3: Enter on a ${hit.kind} row navigates once to the address its kind names, and closes`, async () => {
      const routes = await routeBuilders();
      const { body, search, navigation } = await stageHost();
      search.answers({ hits: [hit] });

      await ask(body, search.queries, TOKEN);
      await waitFor(() => expect(visibleRows(body).length, "the one answered hit is the one row").toBe(1));

      const user = userEvent.setup();
      await user.keyboard("{Enter}");

      await waitFor(() =>
        expect(navigation.hrefs, `a ${hit.kind} row leads where its own route builder says (B-17)`).toEqual([hrefOf(routes, TENANT, hit)]),
      );
      await waitFor(() => expect(all(body, "command-palette").length, "…and the palette closes behind it").toBe(0));
    });
  }
});

describe("AC-3 — a query nothing matches says so, and offers the way back", () => {
  test("AC-3: `command-palette-empty` reads the filled sentence and clears the query when asked", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [] });

    const unmatched = `${TOKEN}qqx`;
    const input = await ask(body, search.queries, unmatched);

    const empty = await waitFor(() => one(body, "command-palette-empty"));
    expect(text(empty), "the empty block says what was searched for (R-UI-020: an empty list says why it is empty)").toContain(
      fill(copy("command_palette_empty"), { query: unmatched }),
    );

    const clear = within(empty).getByRole("button", { name: copy("command_palette_empty_action") });
    const user = userEvent.setup();
    await user.click(clear);

    await waitFor(() => expect(paletteInput(body).value, "the action clears the query").toBe(""));
    await waitFor(() => expect(all(body, "command-palette-empty").length, "…and the groups a blank query lists come back").toBe(0));
    expect(all(body, "command-palette-list").length, "…in the list's place").toBe(1);
    expect(input.isConnected, "the palette stays open — clearing a search is not leaving it").toBe(true);
  });
});

describe("AC-3 — the row a person chose is remembered, per workspace", () => {
  /** Choose one hit through the palette, exactly as a person does. */
  async function choose(body: HTMLElement, asked: string[], hit: SearchHit): Promise<void> {
    await ask(body, asked, hit.label);
    await waitFor(() => expect(visibleRows(body).length).toBeGreaterThan(0));
    await userEvent.setup().keyboard("{Enter}");
    await waitFor(() => expect(all(body, "command-palette").length).toBe(0));
  }

  test("AC-3: the chosen row stands first in the recent group on the next blank open, keyed per tenant", async () => {
    const names = await paletteNames();
    const storageKey = names["RECENT_STORAGE_KEY"];
    expect(typeof storageKey, "the recents' storage key has one home, keyed by workspace (I-141)").toBe("function");
    const keyFor = storageKey as (tenantId: string) => string;

    const chosen = HITS[1] as SearchHit;
    const { body, search } = await stageHost();
    search.answers({ hits: [chosen] });
    await choose(body, search.queries, chosen);

    await openPalette(body);
    const recent = rowsOf(body, "recent");
    expect(text(recent[0] ?? null), "the row just chosen stands first among the recents").toContain(chosen.label);
    expect(window.localStorage.getItem(keyFor(TENANT)), "…stored under this workspace's own key").not.toBeNull();
    expect(window.localStorage.getItem(keyFor(OTHER_TENANT)), "…and under no other workspace's").toBeNull();
  });

  test("AC-3: the recent group never holds more than `RECENT_LIMIT` rows, newest first", async () => {
    const names = await paletteNames();
    expect(typeof names["RECENT_LIMIT"], "the cap is stated once and read from there (B-19)").toBe("number");
    const limit = names["RECENT_LIMIT"] as number;
    expect(limit, "a cap of at least two is what 'newest first' can be judged on").toBeGreaterThan(1);

    const { body, search } = await stageHost();
    const picked: SearchHit[] = [];
    for (let at = 0; at <= limit; at += 1) {
      const hit = aHit({ kind: "project", label: `${TOKEN}${at} Terminal`, projectId: `${at}`.padStart(8, "0") + "-2222-4222-8222-b1b1b1b1b1b1" });
      picked.push(hit);
      search.answers({ hits: [hit] });
      await choose(body, search.queries, hit);
    }

    await openPalette(body);
    const rows = rowsOf(body, "recent");
    expect(rows.length, `the recent group holds at most RECENT_LIMIT (${limit}) rows`).toBe(limit);
    const newestFirst = picked.slice(-limit).reverse();
    for (const [at, row] of rows.entries()) {
      expect(text(row), `recent row ${at} is the ${at === 0 ? "newest" : `${at + 1}th newest`} choice`).toContain(newestFirst[at]?.label ?? "");
    }
  });
});
