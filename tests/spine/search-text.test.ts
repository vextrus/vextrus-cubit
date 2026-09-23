/**
 * SRCH-1 — `spine.search` inside a project: the marks its register holds and the words its sheets
 * show, judged at the door itself, live, against a scratch database the committed migrations built
 * (V-DB; docs/design/command-palette.md I-475, I-476).
 *
 * Every entry point carries a live-database test that a caller without the permission is refused BY
 * NAME: this door's project legs are a participant's reading (L-ACT-03), so a member of the
 * workspace who is not on the project is answered `PERMISSION_NOT_HELD` beside the workspace's own
 * names — and nothing of the project is read for them — while a stranger to the workspace is refused
 * `WORKSPACE_PERMISSION_NOT_HELD` outright, as before.
 *
 * The campaign is the register workspace's own stage (`stageRegisterCampaign`): three columns C1–C3
 * sighted in a model-space layout plan that one paper sheet's window frames, each placed with the
 * outline and the mark it was read off — production's key shapes (VD-1). Every expectation is read off
 * that stage (B-19); nothing is transcribed. The door is called through the router's own caller, with
 * a context minted by the shipped `createContext` off a request carrying the person's real cookie.
 */
import { afterAll, describe, expect, test } from "vitest";
import { joinWorkspace, stagePerson } from "../takeoff/support/sheets-stage";
import { closeStage, principalOf, productModule, stageRegisterCampaign, stageReviewer, type Person, type StagedRegisterCampaign } from "../takeoff/register-ui/support/register-ui-stage";

const SPINE_ROUTER_MODULE = "src/server/routers/spine.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";
const SEARCH_MODULE = "src/server/spine/search.ts";
const SHEETS_MODULE = "src/modules/takeoff/sheets/index.ts";

/** A hit as the door answers one — loose, so this file typechecks against the tree, not through it. */
interface Hit {
  kind: string;
  label: string;
  projectId: string;
  drawingId?: string | null;
  layoutName?: string | null;
  sourceKey?: string | null;
  selection?: readonly string[] | null;
  sheetLabel?: string | null;
  elementType?: string | null;
  count?: number | null;
}
interface Answer {
  hits: readonly Hit[];
  refusal?: string | null;
}
type Search = (input: { tenantId: string; query: string; projectId?: string | null }) => Promise<Answer>;

afterAll(async () => {
  await closeStage();
});

let staging: Promise<StagedRegisterCampaign> | undefined;
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("search-text"));

/** The shipped door, as this person's live session reaches it. */
async function searchAs(person: Person): Promise<Search> {
  const { createContext } = await productModule<{ createContext(opts: { req: Request }): Promise<unknown> }>(CONTEXT_MODULE);
  const { spineRouter } = await productModule<{ spineRouter: { createCaller(ctx: unknown): { search: Search } } }>(SPINE_ROUTER_MODULE);
  const request = new Request("http://127.0.0.1/api/trpc/spine.search", { headers: { cookie: person.cookie } });
  return spineRouter.createCaller(await createContext({ req: request })).search;
}

/** The register's own spelling of a code this door answers with (B-17). */
async function code(name: string): Promise<string> {
  const { REFUSALS } = await productModule<{ REFUSALS: Readonly<Record<string, { code: string }>> }>(ERRORS_MODULE);
  const spelled = REFUSALS[name]?.code ?? "";
  expect(spelled, `the register publishes ${name}`).not.toBe("");
  return spelled;
}

/** What the door threw, read as the registered code it carries — the refusal named, never a fault. */
async function thrownCode(work: Promise<unknown>, what: string): Promise<string | null> {
  const [settled] = await Promise.allSettled([work]);
  if (settled?.status !== "rejected") expect.fail(`${what} must be refused, and the door answered with ${JSON.stringify(settled?.status === "fulfilled" ? settled.value : null)}`);
  const { refusalCodeOf } = await productModule<{ refusalCodeOf(error: unknown): string | null }>(MARKER_MODULE);
  return refusalCodeOf((settled as PromiseRejectedResult).reason);
}

/** The finds of an answer — the kinds only a project search answers. */
const finds = (answer: Answer): Hit[] => answer.hits.filter((hit) => hit.kind === "mark" || hit.kind === "text");

describe("spine.search inside a project — a participant finds the register's marks and the sheets' words", () => {
  test("the QS's C2: the mark in the register and its text on the plan sheet, each opening on the member", async () => {
    const it = await staged();
    const search = await searchAs(principalOf(it));
    const { SEARCH_KINDS } = await productModule<{ SEARCH_KINDS: readonly string[] }>(SEARCH_MODULE);
    expect(SEARCH_KINDS, "the roster names the two finds").toEqual(expect.arrayContaining(["mark", "text"]));

    const answer = await search({ tenantId: it.tenantId, projectId: it.projectId, query: "C2" });
    expect(answer.refusal ?? null, "a participant is refused nothing").toBeNull();
    const member = it.drawn.members["C2"] as { outlineKey: string; markKey: string };

    const marks = answer.hits.filter((hit) => hit.kind === "mark");
    expect(marks.length, `one mark find for C2 on the one sheet it stands on: ${JSON.stringify(marks)}`).toBe(1);
    const mark = marks[0] as Hit;
    expect(mark.label, "the mark as the register holds it").toBe("C2");
    expect(mark.count, "one register row stands under it").toBe(1);
    expect(mark.drawingId, "on the drawing the campaign pinned").toBe(it.drawn.drawingId);
    expect(mark.layoutName, "on the paper sheet whose window frames the plan — core's resolver, not model space").toBe(it.drawn.planSheet);
    expect([...(mark.selection ?? [])].sort(), "selecting the member's outline and mark (the Trace's own reading, I-421)").toEqual([member.outlineKey, member.markKey].sort());

    const texts = answer.hits.filter((hit) => hit.kind === "text");
    expect(texts.map((hit) => [hit.sourceKey, hit.layoutName]), "and the text C2, on that same sheet, under its own key").toEqual([[member.markKey, it.drawn.planSheet]]);
    expect(texts[0]?.selection, "a text find selects the text itself").toEqual([member.markKey]);
    for (const hit of finds(answer)) expect(hit.projectId, "every find names the project searched").toBe(it.projectId);
  });

  test("a mark is matched whole, as the drawing's marks are compared: 'c-2' is C2, and 'C' is no mark", async () => {
    const it = await staged();
    const search = await searchAs(principalOf(it));
    const spelled = await search({ tenantId: it.tenantId, projectId: it.projectId, query: "c-2" });
    expect(spelled.hits.filter((hit) => hit.kind === "mark").map((hit) => hit.label), "`c-2` reads as C2 (dotless upper, L-CAD-07)").toEqual(["C2"]);
    const partial = await search({ tenantId: it.tenantId, projectId: it.projectId, query: "C" });
    expect(partial.hits.filter((hit) => hit.kind === "mark"), "a letter shared by every mark names none of them").toEqual([]);
  });

  test("the sheet's words are found whole: 'COLUMN LAYOUT PLAN' answers the caption, framed by its sheet", async () => {
    const it = await staged();
    const search = await searchAs(principalOf(it));
    const answer = await search({ tenantId: it.tenantId, projectId: it.projectId, query: "column layout plan" });
    const texts = answer.hits.filter((hit) => hit.kind === "text");
    expect(texts.map((hit) => hit.sourceKey), "the plan's caption and the plan sheet's own title").toEqual(expect.arrayContaining([it.drawn.view.captionAnchorSourceKey]));
    const caption = texts.find((hit) => hit.sourceKey === it.drawn.view.captionAnchorSourceKey);
    expect(caption?.layoutName, "the caption is drawn in model space and shown on the plan sheet").toBe(it.drawn.planSheet);
  });

  test("the sheet leg reads the names off the stored records: the same sheets, in the same order, as the sheet index (I-478)", async () => {
    const it = await staged();
    const scope = { tenantId: it.tenantId, projectId: it.projectId };
    const { sheetNamesOf } = await productModule<{ sheetNamesOf(scope: { tenantId: string; projectId: string }): Promise<{ sheetId: string; drawingId: string; layoutName: string }[]> }>(SEARCH_MODULE);
    const { sheetIndexOf } = await productModule<{ sheetIndexOf(scope: { tenantId: string; projectId: string }): Promise<{ sheetId: string; drawingId: string; layoutName: string }[]> }>(SHEETS_MODULE);
    const indexed = (await sheetIndexOf(scope)).map((card) => [card.sheetId, card.drawingId, card.layoutName]);
    expect(indexed.length, "the staged record lists sheets — the case this judges").toBeGreaterThan(1);
    expect((await sheetNamesOf(scope)).map((card) => [card.sheetId, card.drawingId, card.layoutName]), "card for card, the sheet index's own").toEqual(indexed);

    const search = await searchAs(principalOf(it));
    const answer = await search({ tenantId: it.tenantId, projectId: it.projectId, query: it.drawn.planSheet });
    expect(
      answer.hits.filter((hit) => hit.kind === "sheet").map((hit) => [hit.drawingId, hit.layoutName]),
      "the plan sheet, asked by its name through the door, with no sheet index injected",
    ).toEqual([[it.drawn.drawingId, it.drawn.planSheet]]);
  });

  test("a reviewer on the project finds as the principal does — a read is a participant's, not a permission's", async () => {
    const it = await staged();
    const reviewer = await stageReviewer(it, "search-reviewer");
    const answer = await (await searchAs(reviewer))({ tenantId: it.tenantId, projectId: it.projectId, query: "C2" });
    expect(answer.refusal ?? null).toBeNull();
    expect(finds(answer).length, "the mark and its text").toBe(2);
  });
});

describe("spine.search inside a project — a caller not on it is refused by name", () => {
  test("a member of the workspace who is not on the project is refused PERMISSION_NOT_HELD beside the names, and nothing of the project is read", async () => {
    const it = await staged();
    const permission = await code("PERMISSION_NOT_HELD");
    const { person: outsider } = await stagePerson("search-outsider");
    joinWorkspace(it.tenantId, outsider.userId);

    const search = await searchAs(outsider);
    const answer = await search({ tenantId: it.tenantId, projectId: it.projectId, query: "C2" });
    expect(answer.refusal, "the project's reading is refused by name (L-ACT-03)").toBe(permission);
    expect(finds(answer), "no mark and no word of a project this person is not on").toEqual([]);

    const unscoped = await search({ tenantId: it.tenantId, query: "C2" });
    expect(unscoped.refusal ?? null, "the same person searching the workspace alone is refused nothing").toBeNull();
  });

  test("a stranger to the workspace is refused WORKSPACE_PERMISSION_NOT_HELD, project or not", async () => {
    const it = await staged();
    const workspace = await code("WORKSPACE_PERMISSION_NOT_HELD");
    const { person: stranger } = await stagePerson("search-stranger");
    const search = await searchAs(stranger);
    expect(await thrownCode(search({ tenantId: it.tenantId, projectId: it.projectId, query: "C2" }), "a stranger naming the workspace and its project"), "refused at the workspace, before any project is asked").toBe(workspace);
  });

  test("a project of another workspace, named from one's own, is refused by name and nothing of it is read", async () => {
    const it = await staged();
    const permission = await code("PERMISSION_NOT_HELD");
    const { person: stranger } = await stagePerson("search-foreign");
    const answer = await (await searchAs(stranger))({ tenantId: stranger.tenantId, projectId: it.projectId, query: "C2" });
    expect(answer.refusal, "a project another workspace holds is no project of this one").toBe(permission);
    expect(finds(answer)).toEqual([]);
  });
});
