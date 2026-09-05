/**
 * AC-2(b) and AC-2(c) — the two drawings addresses answer "does this project exist here?" through
 * the module's one door, and the set tab names itself without reading a roster.
 *
 * Both screens today load the workspace's whole project roster — every project, with its quick
 * stats — to compare one id, and the set page does it twice per request because `generateMetadata`
 * runs beside the page. What is judged here is which seam each screen asks and how many times, not
 * how the seam answers: the projects module's own suite judges that.
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so `tsc` reads this file too, and the
 * page functions are called directly rather than rendered — what a criterion about reads asks is
 * which reads happened.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sets as setsStrings } from "../sets/strings";

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const HELD = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";
const ABSENT = "11111111-2222-4333-8444-555555555555";
const SET = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";

const seam = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  projectHeld: vi.fn(async (_scope: { tenantId: string }, projectId: string) => projectId === HELD),
  projectsForHome: vi.fn(async () => [{ projectId: HELD }]),
  sessionOf: vi.fn(async () => ({ userId: "user-1" }) as { userId: string } | null),
  setOf: vi.fn(async () => ({ setId: SET, name: "Tender issue" }) as { setId: string; name: string } | null),
  drawingLineagesOf: vi.fn(async () => []),
  holdsPinSet: vi.fn(async () => true),
  sheetIndexOf: vi.fn(async () => []),
  offeredGroupsOf: vi.fn(async () => []),
  drawingsAwaitingIngestOf: vi.fn(async () => 0),
}));

vi.mock("next/navigation", () => ({ notFound: seam.notFound, redirect: seam.redirect }));
vi.mock("../../../../../../../../modules/spine/projects", () => ({ projectHeld: seam.projectHeld, projectsForHome: seam.projectsForHome }));
vi.mock("../../../../../../../../modules/takeoff/sets", () => ({ setOf: seam.setOf, drawingLineagesOf: seam.drawingLineagesOf, holdsPinSet: seam.holdsPinSet }));
vi.mock("../../../../../../../../modules/takeoff/sheets", () => ({
  sheetIndexOf: seam.sheetIndexOf,
  offeredGroupsOf: seam.offeredGroupsOf,
  drawingsAwaitingIngestOf: seam.drawingsAwaitingIngestOf,
}));
vi.mock("../../../../../../../../server/shell/resolve", () => ({ sessionOf: seam.sessionOf }));
vi.mock("../../../../../../../../server/shell/session", () => ({ presentedSessionToken: async () => "token" }));
vi.mock("../../../../../../../../core/acts", () => ({ permissionsHeld: async () => new Set(["MEASURE"]) }));
vi.mock("../../../../../../../../core/db", () => ({ forTenant: () => ({ transaction: async (work: (tx: unknown) => unknown) => work({}) }) }));
// The two screens themselves are other criteria's; these criteria are about which reads answer the
// address, so the bodies stand in and nothing here depends on their internals.
vi.mock("../sheet-index", () => ({ SheetIndex: () => null }));
vi.mock("../sets/[set]/set-browser", () => ({ SetBrowser: () => null }));

const ProjectDrawings = (await import("../page")).default;
const setPage = await import("../sets/[set]/page");

/** The calls the existence door received, whatever else the screen asked for. */
const existenceCalls = (): readonly unknown[][] => seam.projectHeld.mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
  seam.sessionOf.mockResolvedValue({ userId: "user-1" });
  seam.setOf.mockResolvedValue({ setId: SET, name: "Tender issue" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AC-2(b): the drawings index answers existence through the one door", () => {
  test("AC-2(b): a project the workspace holds is answered by exactly one projectHeld call", async () => {
    await ProjectDrawings({ params: Promise.resolve({ tenant: TENANT, project: HELD }) });

    expect(existenceCalls().length, "one question, asked once — not a roster read").toBe(1);
    expect(existenceCalls()[0], "the door is asked about the address's own two segments").toEqual([{ tenantId: TENANT }, HELD]);
    expect(seam.projectsForHome, "the workspace's whole project roster is not what answers an existence question").not.toHaveBeenCalled();
    expect(seam.notFound, "a project that exists is found").not.toHaveBeenCalled();
  });

  test("AC-2(b): a project the workspace does not hold is an absent address", async () => {
    const rendered = await ProjectDrawings({ params: Promise.resolve({ tenant: TENANT, project: ABSENT }) }).catch(() => null);

    expect(seam.notFound, "an address naming no project of this workspace is answered as absent").toHaveBeenCalled();
    expect(rendered, "nothing renders for an address that does not exist").toBeNull();
    expect(seam.projectsForHome, "and the roster is still not read").not.toHaveBeenCalled();
  });
});

describe("AC-2(b): the set screen answers existence through the one door", () => {
  test("AC-2(b): a held project is answered by exactly one projectHeld call", async () => {
    await setPage.default({ params: Promise.resolve({ tenant: TENANT, project: HELD, set: SET }) });

    expect(existenceCalls().length, "one question, asked once").toBe(1);
    expect(existenceCalls()[0], "the door is asked about the address's own two segments").toEqual([{ tenantId: TENANT }, HELD]);
    expect(seam.projectsForHome, "the roster is not what answers an existence question").not.toHaveBeenCalled();
  });

  test("AC-2(b): a project the workspace does not hold is an absent address", async () => {
    const rendered = await setPage.default({ params: Promise.resolve({ tenant: TENANT, project: ABSENT, set: SET }) }).catch(() => null);

    expect(seam.notFound, "an address naming no project of this workspace is answered as absent").toHaveBeenCalled();
    expect(rendered, "nothing renders for an address that does not exist").toBeNull();
  });
});

describe("AC-2(c): the set tab names itself from the set alone", () => {
  test("AC-2(c): a held set titles the tab by its name, reading the session and the set and nothing else", async () => {
    const titled = await setPage.generateMetadata({ params: Promise.resolve({ tenant: TENANT, project: HELD, set: SET }) });

    expect(titled.title, "a person with several sets open tells them apart by the only thing that distinguishes them").toBe("Tender issue");
    expect(seam.projectsForHome, "naming a tab is not a reason to read the workspace's projects").not.toHaveBeenCalled();
    expect(seam.projectHeld, "the set read is already scoped to the address; asking existence twice per request is the read this row is about").not.toHaveBeenCalled();
    expect(seam.setOf.mock.calls.length, "one set read names the tab").toBe(1);
  });

  test("AC-2(c): no session falls back to the screen's own name, without reading the set", async () => {
    seam.sessionOf.mockResolvedValue(null);

    const titled = await setPage.generateMetadata({ params: Promise.resolve({ tenant: TENANT, project: HELD, set: SET }) });

    expect(titled.title, "a name is not published to a request carrying no session").toBe(setsStrings.sets_heading);
    expect(seam.setOf, "and nothing is read for it").not.toHaveBeenCalled();
    expect(seam.projectHeld, "nor is existence asked").not.toHaveBeenCalled();
  });

  test("AC-2(c): a set the address does not name falls back to the screen's own name", async () => {
    seam.setOf.mockResolvedValue(null);

    const titled = await setPage.generateMetadata({ params: Promise.resolve({ tenant: TENANT, project: HELD, set: "no-such-set" }) });

    expect(titled.title, "an address naming no set the reader holds falls back to the screen's own name").toBe(setsStrings.sets_heading);
    expect(seam.projectsForHome, "still no roster read").not.toHaveBeenCalled();
    expect(seam.projectHeld, "still no second existence read").not.toHaveBeenCalled();
  });
});
