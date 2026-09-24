// @vitest-environment jsdom
/**
 * SRCH-1 — a project's finds on the screen (docs/design/command-palette.md I-628…e): the host
 * asks the seam about the project it stands inside, a register mark and a sheet's text become rows
 * of the navigate group with a second line composed from the string table and the format seam, Enter
 * opens the viewer at what the find names — selected, with no camera, so the sheet flies to it — and
 * a refusal the transport carries BESIDE the hits stands under them (the partial state, I-142).
 *
 * The addresses are never transcribed: each is built by the function that owns it —
 * `selectionAddress` (the Trace's), `registerRoute` (the register's) — read from its home (B-17,
 * B-19). A query no area, action or shortcut label carries keeps the navigate group the seam's alone.
 */
import { cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DRAWING, PROJECT, TENANT, all, aHit, copy, fill, openPalette, paletteInput, productModule, rowsOf, stageHost, text, visibleRows, type SearchHit } from "./support/palette-stage";

/** A token no label of the palette's own chrome carries, so only answered hits can match it. */
const TOKEN = "Zzq";

/** The sheet and drawing the finds below stand on, as a staged BNBC set would name them. */
const LAYOUT = "S-10 COLUMN LAYOUT PLAN";
const SHEET = "S-10";
const DRAWING_NAME = "rcc6-bnbc.dxf";

const TRACE_ADDRESS_MODULE = "src/modules/takeoff/trace/address.ts";
const REGISTER_ROUTE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/register/route-address.ts";
const FORMAT_MODULE = "src/core/format.ts";
const ENUM_LABEL_MODULE = "src/ui/primitives/core/enum-label.tsx";
const SEARCH_ACTION_MODULE = "src/app/(app)/t/[tenant]/palette/search-action.ts";

type Selection = { drawingId: string; layoutName: string; sourceKeys: readonly string[] };
const selectionAddress = async (): Promise<(tenantId: string, projectId: string, sheet: Selection) => string> =>
  (await productModule<{ selectionAddress: (tenantId: string, projectId: string, sheet: Selection) => string }>(TRACE_ADDRESS_MODULE)).selectionAddress;

/** A text find on the column layout plan, under its own key. */
function textHit(key: string, over: Partial<SearchHit> = {}): SearchHit {
  return aHit({ kind: "text", label: `${TOKEN} C2`, drawingId: DRAWING, layoutName: LAYOUT, sheetLabel: SHEET, sourceKey: key, selection: [key], drawingName: DRAWING_NAME, ...over });
}

/** The mark C2 of the register, standing on the plan with two members' outlines and marks. */
const MEMBERS = ["DXF_HANDLE:A1", "DXF_HANDLE:A2", "DXF_HANDLE:B1", "DXF_HANDLE:B2"];
function markHit(over: Partial<SearchHit> = {}): SearchHit {
  return aHit({ kind: "mark", label: `${TOKEN}2`, drawingId: DRAWING, layoutName: LAYOUT, sheetLabel: SHEET, sourceKey: MEMBERS[0] ?? null, selection: MEMBERS, elementType: "column", count: 1200, ...over });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

/** Open, type, and wait until the seam has been asked for exactly this query. */
async function ask(body: HTMLElement, queries: string[], query: string): Promise<void> {
  const user = userEvent.setup();
  await openPalette(body);
  await user.type(paletteInput(body), query);
  await waitFor(() => expect(queries, `the host asks the seam for ${query}`).toContain(query));
}

/** Enter on the one answered row, and the address the host was asked to go to. */
async function enterOn(body: HTMLElement, hrefs: string[]): Promise<string> {
  await waitFor(() => expect(visibleRows(body).length).toBe(1));
  await userEvent.setup().keyboard("{Enter}");
  await waitFor(() => expect(hrefs.length, "Enter navigates once").toBe(1));
  return hrefs[0] as string;
}

describe("the host asks about the project it stands inside (I-629)", () => {
  test("inside a project the seam is asked with its id; at a workspace address with none", async () => {
    const inside = await stageHost({ projectId: PROJECT });
    await ask(inside.body, inside.search.queries, TOKEN);
    expect(inside.search.requests.at(-1), "the request names the workspace, the query and the project").toMatchObject({ tenantId: TENANT, query: TOKEN, projectId: PROJECT });
    cleanup();

    const outside = await stageHost({ projectId: null });
    await ask(outside.body, outside.search.queries, TOKEN);
    expect((outside.search.requests.at(-1) as { projectId?: unknown }).projectId ?? null, "a workspace address names no project").toBeNull();
  });

  test("the input says what it searches: a project's marks and sheet text inside one, the workspace's names outside", async () => {
    const inside = await stageHost({ projectId: PROJECT });
    await openPalette(inside.body);
    expect(paletteInput(inside.body).getAttribute("placeholder")).toBe(copy("command_palette_placeholder_project"));
    cleanup();
    const outside = await stageHost({ projectId: null });
    await openPalette(outside.body);
    expect(paletteInput(outside.body).getAttribute("placeholder")).toBe(copy("command_palette_placeholder"));
  });
});

describe("a sheet's text, as a row (I-628)", () => {
  test("a `text` option says what the sheet says, then its sheet number and drawing; Enter opens the viewer at it, selected", async () => {
    const key = "DXF_HANDLE:99F";
    const { body, search, navigation } = await stageHost();
    search.answers({ hits: [textHit(key)] });
    await ask(body, search.queries, TOKEN);

    const [row] = rowsOf(body, "navigate");
    expect(row?.getAttribute("data-kind"), "the kind word is the enum's own").toBe("text");
    expect(text(row ?? null), "the words the sheet shows").toContain(`${TOKEN} C2`);
    expect(text(row ?? null), "and where: the sheet's number, then the drawing").toContain(fill(copy("command_palette_meta_text"), { sheet: SHEET, drawing: DRAWING_NAME }));

    const address = await selectionAddress();
    expect(await enterOn(body, navigation.hrefs), "the viewer at the text, selected, with no camera (I-85)").toBe(address(TENANT, PROJECT, { drawingId: DRAWING, layoutName: LAYOUT, sourceKeys: [key] }));
  });

  test("a text in model space says so in words, and a clipped one is marked where it was cut", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [textHit("DXF_HANDLE:D3D", { sheetLabel: null, layoutName: "model", clippedStart: true, clippedEnd: true })] });
    await ask(body, search.queries, TOKEN);
    const [row] = rowsOf(body, "navigate");
    const elided = copy("command_palette_elision");
    expect(text(row ?? null), "cut at both ends, and said so at both").toContain(`${elided}${TOKEN} C2${elided}`);
    expect(text(row ?? null), "model space is named, never the extractor's layout name").toContain(fill(copy("command_palette_meta_text"), { sheet: copy("command_palette_model_space"), drawing: DRAWING_NAME }));
  });

  test("two texts on one sheet are two rows, each its own option — a row key their sheet alone would share", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [textHit("DXF_HANDLE:99F"), textHit("DXF_HANDLE:9A0")] });
    await ask(body, search.queries, TOKEN);
    await waitFor(() => expect(rowsOf(body, "navigate").length, "both texts stand").toBe(2));
    const ids = rowsOf(body, "navigate").map((row) => row.id);
    expect(new Set(ids).size, `each row is its own option, so the combobox can name either: ${JSON.stringify(ids)}`).toBe(2);
  });

  test("two hits under one key are one row — they open the same thing — and the arrows reach the row after them", async () => {
    const warned = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { body, search } = await stageHost();
    // A title block's reference paints SHEET TITLE and SHEET NO. under its one key; another sheet's block after it.
    search.answers({
      hits: [textHit("DXF_HANDLE:1E48", { label: `${TOKEN} SHEET TITLE` }), textHit("DXF_HANDLE:1E48", { label: `${TOKEN} SHEET NO.` }), textHit("DXF_HANDLE:1F2E", { label: `${TOKEN} SHEET TITLE` })],
    });
    await ask(body, search.queries, TOKEN);
    await waitFor(() => expect(visibleRows(body).length, "the answer is on the screen").toBeGreaterThan(0));

    const ids = visibleRows(body).map((row) => row.id);
    expect(ids.length, `every row is its own option, so aria-activedescendant names one thing: ${JSON.stringify(ids)}`).toBe(new Set(ids).size);
    expect(ids.length, "the key's first hit stands for it, and the other block's is its own row").toBe(2);
    expect(text(visibleRows(body)[0] ?? null), "the first hit under the key is the row shown").toContain(`${TOKEN} SHEET TITLE`);
    expect(warned.mock.calls.filter((call) => String(call[0]).includes("same key")), "React is never handed two children keyed alike").toEqual([]);

    const user = userEvent.setup();
    for (let step = 1; step < ids.length; step += 1) await user.keyboard("{ArrowDown}");
    const last = ids[ids.length - 1] as string;
    await waitFor(() => expect(paletteInput(body).getAttribute("aria-activedescendant"), "ArrowDown walks to the last row").toBe(last));
    expect(visibleRows(body).filter((row) => row.getAttribute("aria-selected") === "true").map((row) => row.id), "and only it is active").toEqual([last]);
    warned.mockRestore();
  });
});

describe("a register mark, as a row (I-628)", () => {
  test("a `mark` option names its class, how many rows the register holds and its sheet; Enter selects its members on that sheet", async () => {
    const { body, search, navigation } = await stageHost();
    search.answers({ hits: [markHit()] });
    await ask(body, search.queries, TOKEN);

    const { formatUserFigure } = await productModule<{ formatUserFigure: (value: string) => string }>(FORMAT_MODULE);
    const { humaniseEnum } = await productModule<{ humaniseEnum: (value: string) => string }>(ENUM_LABEL_MODULE);
    const [row] = rowsOf(body, "navigate");
    expect(row?.getAttribute("data-kind")).toBe("mark");
    expect(text(row ?? null), "the class in words, the count through the format seam (1,200), the sheet's number").toContain(
      fill(copy("command_palette_meta_mark"), { class: humaniseEnum("column"), count: formatUserFigure("1200"), sheet: SHEET }),
    );

    const address = await selectionAddress();
    expect(await enterOn(body, navigation.hrefs), "the viewer at every member of the mark on that sheet").toBe(address(TENANT, PROJECT, { drawingId: DRAWING, layoutName: LAYOUT, sourceKeys: MEMBERS }));
  });

  test("a mark no pinned drawing places leads to the register it is filed in, and says only what it knows", async () => {
    const { body, search, navigation } = await stageHost();
    search.answers({ hits: [markHit({ drawingId: null, layoutName: null, sheetLabel: null, selection: [], sourceKey: null, count: 3 })] });
    await ask(body, search.queries, TOKEN);
    const { registerRoute } = await productModule<{ registerRoute: (tenantId: string, projectId: string) => string }>(REGISTER_ROUTE_MODULE);
    const { humaniseEnum } = await productModule<{ humaniseEnum: (value: string) => string }>(ENUM_LABEL_MODULE);
    const [row] = rowsOf(body, "navigate");
    expect(text(row ?? null)).toContain(fill(copy("command_palette_meta_mark_unplaced"), { class: humaniseEnum("column"), count: "3" }));
    expect(await enterOn(body, navigation.hrefs), "the register, where the mark's rows are").toBe(registerRoute(TENANT, PROJECT));
  });
});

describe("a refusal beside the hits (I-629, I-142)", () => {
  test("the palette shows the workspace's names and, under them, why the project was not searched", async () => {
    const { body, search } = await stageHost();
    search.answers({ hits: [aHit({ label: `${TOKEN} Terminal` })], refusal: "PERMISSION_NOT_HELD" });
    await ask(body, search.queries, TOKEN);
    await waitFor(() => expect(rowsOf(body, "navigate").length, "the answered name stands").toBe(1));
    expect(all(body, "command-palette-refusal").length, "and the registered refusal stands beside it").toBe(1);
  });

  test("the transport carries the project and hands a refusal answered beside the hits on, unchanged", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({ result: { data: { hits: [aHit({ label: `${TOKEN} Terminal` })], refusal: "PERMISSION_NOT_HELD" } } }), { status: 200 });
    });
    const { searchWorkspaceAction } = await productModule<{ searchWorkspaceAction: (request: unknown) => Promise<{ hits: readonly unknown[]; refusal?: string | null }> }>(SEARCH_ACTION_MODULE);
    const answer = await searchWorkspaceAction({ tenantId: TENANT, projectId: PROJECT, query: TOKEN });
    expect(JSON.parse(decodeURIComponent((asked[0] ?? "").split("input=")[1] ?? "{}")), "the project travels in the door's input").toMatchObject({ projectId: PROJECT });
    expect(answer.hits.length, "the names stand").toBe(1);
    expect(answer.refusal, "and the refusal beside them travels on").toBe("PERMISSION_NOT_HELD");
  });
});
