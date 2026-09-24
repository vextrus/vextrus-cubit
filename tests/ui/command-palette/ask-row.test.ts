// @vitest-environment jsdom
/**
 * ASK-3 — "Ask the drawings: <typed>" (docs/design/command-palette.md I-679): inside a project the
 * words typed are offered as a question to its drawings, in their own `ask` group last, under every find, area, action and shortcut,
 * leading to S-Ask's own address with the question on `?q=` (`askRoute`, read from its home, B-17).
 * The offer is not a match: the footer counts what the search found, and words no find answers
 * leave the offer the one row rather than the empty cell. Outside a project, beside a refusal of the
 * project, and for words longer than a question takes, nothing is offered.
 */
import { cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { PROJECT, TENANT, aHit, all, copy, fill, foundRows, openPalette, paletteInput, productModule, rowsOf, stageHost, text } from "./support/palette-stage";

const ASK_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/route-address.ts";
const ASK_LAW_MODULE = "src/modules/takeoff/ask/law.ts";

const askRoute = async (): Promise<(tenantId: string, projectId: string, question?: string) => string> =>
  (await productModule<{ askRoute: (tenantId: string, projectId: string, question?: string) => string }>(ASK_ROUTE_MODULE)).askRoute;

/** A question no chrome label of the palette carries. */
const QUESTION = "How many piles are there?";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** Open, type, and wait until the seam has been asked for exactly this query. */
async function type(body: HTMLElement, queries: string[], query: string): Promise<void> {
  const user = userEvent.setup();
  await openPalette(body);
  await user.type(paletteInput(body), query);
  await waitFor(() => expect(queries).toContain(query));
}

/** The footer's status line. */
function status(body: HTMLElement): string {
  return text(body.querySelector(".cx-palette-status"));
}

describe("the palette offers the words typed as a question to the project's drawings (I-679)", () => {
  test("words no find answers: the offer is the one row, in the `ask` group, and Enter opens S-Ask asking them", async () => {
    const { body, search, navigation } = await stageHost();
    search.answers({ hits: [] });
    await type(body, search.queries, QUESTION);

    const [row, ...rest] = await waitFor(() => rowsOf(body, "ask"));
    expect(rest, "one offer").toEqual([]);
    expect(row?.getAttribute("data-kind")).toBe("ask");
    expect(text(row ?? null)).toContain(fill(copy("command_palette_ask"), { question: QUESTION }));
    expect(text(row ?? null)).toContain(copy("command_palette_ask_meta"));
    expect(all(body, "command-palette-empty").length, "the empty cell does not stand over an offer").toBe(0);
    expect(status(body), "the offer matched nothing, and the footer says so").toBe(copy("command_palette_status_none"));
    expect(text(body.querySelector('[data-group="ask"] .cx-palette-group-label'))).toBe(copy("command_palette_group_ask"));

    await userEvent.setup().keyboard("{Enter}");
    const route = await askRoute();
    await waitFor(() => expect(navigation.hrefs).toEqual([route(TENANT, PROJECT, QUESTION)]));
    expect(navigation.hrefs[0], "the question travels on ?q=").toContain(`?q=${encodeURIComponent(QUESTION)}`);
  });

  test("beside a find, the find is first and the offer stands under it, uncounted", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [aHit({ kind: "project", label: "Zzq Terminal", projectId: PROJECT })] });
    await type(body, search.queries, "Zzq");

    await waitFor(() => expect(rowsOf(body, "ask").length).toBe(1));
    const groups = all(body, "command-palette-group").map((group) => group.getAttribute("data-group"));
    expect(groups.indexOf("navigate"), "Go to stands above Ask").toBeLessThan(groups.indexOf("ask"));
    expect(foundRows(body)[0]?.getAttribute("aria-selected"), "Enter still takes the find").toBe("true");
    expect(status(body)).toBe(copy("command_palette_status_one"));
  });

  test("words that name a project area or action: that row is the first Enter, and the offer stands last", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [] });
    await type(body, search.queries, "Takeoff");

    await waitFor(() => expect(rowsOf(body, "ask").length).toBe(1));
    const areas = rowsOf(body, "areas");
    expect(areas.length, "the Takeoff area matches").toBeGreaterThan(0);
    const groups = all(body, "command-palette-group").map((group) => group.getAttribute("data-group"));
    expect(groups.at(-1), "Ask stands under every row that goes to or does something").toBe("ask");
    expect(areas[0]?.getAttribute("aria-selected"), "Enter still opens the area").toBe("true");
    expect(rowsOf(body, "ask")[0]?.getAttribute("aria-selected")).not.toBe("true");
  });

  test("nothing is offered at a workspace address, beside a refusal of the project, or for words longer than a question", async () => {
    const outside = await stageHost({ projectId: null });
    outside.search.answers({ hits: [] });
    await type(outside.body, outside.search.queries, QUESTION);
    await waitFor(() => expect(all(outside.body, "command-palette-empty").length).toBe(1));
    expect(outside.body.querySelector('[data-group="ask"]')).toBeNull();
    cleanup();

    const refused = await stageHost();
    refused.search.answers({ hits: [aHit({ kind: "project", label: "Zzq Terminal", projectId: PROJECT })], refusal: "PERMISSION_NOT_HELD" });
    await type(refused.body, refused.search.queries, "Zzq");
    await waitFor(() => expect(foundRows(refused.body).length).toBe(1));
    expect(refused.body.querySelector('[data-group="ask"]'), "a project that did not answer is not offered").toBeNull();
    cleanup();

    const { ASK_QUESTION_MAX } = await productModule<{ ASK_QUESTION_MAX: number }>(ASK_LAW_MODULE);
    const long = await stageHost();
    long.search.answers({ hits: [] });
    const words = "c".repeat(ASK_QUESTION_MAX + 1);
    await openPalette(long.body);
    // Pasted, not typed: a question this long is one gesture.
    paletteInput(long.body).focus();
    await userEvent.setup().paste(words);
    await waitFor(() => expect(long.search.queries).toContain(words));
    await waitFor(() => expect(all(long.body, "command-palette-empty").length).toBe(1));
    expect(long.body.querySelector('[data-group="ask"]')).toBeNull();
  });
});
