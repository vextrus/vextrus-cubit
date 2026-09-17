/**
 * AC-2 — the bar schedule's page reaches the choke point ITSELF, and reads under what it answered
 * (SEAM-AUTH, `authorizePage`, the idiom tests/app/project-pages-choke-point.test.tsx records).
 *
 * A screen that read first and asked afterwards would answer a stranger with a schedule, and a
 * screen that scoped its read by `params.tenant` would read under a value the CALLER wrote. So the
 * guard and the read are both replaced here and the ORDER between them is what is graded: the guard
 * is asked before the read happens, the read is scoped by the workspace the guard answered (never by
 * the segment — the two are deliberately different strings), and a guard that throws leaves the read
 * uncalled and nothing rendered.
 *
 * The page and its seam are proved to exist FIRST, so a tree that has not written them yet fails by
 * naming the file rather than dying at collection. Nothing here opens a database and nothing here
 * measures time (AM-10 §3).
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The checkout this suite runs in — tests/takeoff/bbs-ui/ is three levels under it. */
const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The two files this criterion drives (test contract: routes, procedures). */
const PAGE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/bbs/page.tsx";
const SERVER = "src/modules/takeoff/bbs-ui/server.ts";
const GUARD = "src/server/authorize-page.ts";

/** The segment a caller typed, and the workspace the project is really in — never the same string. */
const SEGMENT = "tenant-as-typed";
const REAL = "tenant-as-owned";
const PROJECT = "project-1";
const USER = "user-1";

/** A view with nothing in it: this suite grades the ORDER of two calls, not what they answer. */
const EMPTY_VIEW = { campaignId: null, setRevisionId: null, document: null, partial: false };

const guard = { authorizePage: vi.fn() };
const seam = { bbsViewOf: vi.fn() };

/** What the page is handed by the router (Next's own shape: params are a promise). */
const address = { params: Promise.resolve({ tenant: SEGMENT, project: PROJECT }), searchParams: Promise.resolve({}) };

beforeEach(() => {
  vi.resetModules();
  guard.authorizePage.mockReset();
  seam.bbsViewOf.mockReset();
  guard.authorizePage.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: REAL, userId: USER }));
  seam.bbsViewOf.mockImplementation(async () => EMPTY_VIEW);
});

/**
 * The page with its guard and its read replaced, loaded fresh.
 *
 * `doMock` rather than the hoisted `mock`: the modules under test do not exist in the tree yet, and
 * a hoisted factory over a path that resolves to nothing takes the whole file down at collection —
 * the red this criterion is owed names the missing page instead.
 */
async function bbsPage(): Promise<(props: typeof address) => Promise<unknown>> {
  for (const relative of [PAGE, SERVER]) {
    expect(existsSync(resolve(REPO_ROOT, relative)), `${relative} is not in the tree yet — the bar schedule's page does not exist`).toBe(true);
  }
  vi.doMock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
  vi.doMock(resolve(REPO_ROOT, GUARD), () => ({ authorizePage: guard.authorizePage }));
  vi.doMock(resolve(REPO_ROOT, SERVER), () => ({ bbsViewOf: seam.bbsViewOf }));
  const loaded = (await import(resolve(REPO_ROOT, PAGE))) as { default: (props: typeof address) => Promise<unknown> };
  return loaded.default;
}

describe("AC-2: S-BBS asks the choke point for itself, before it reads anything", () => {
  test("AC-2: the guard is asked with the address's own tenant and project, and the read is scoped by what it answered", async () => {
    // The read records WHEN it ran: the guard's own answer is what arms the row policy, so a page
    // that read first has already read under a scope nobody authorised (SEAM-AUTH).
    const order: string[] = [];
    guard.authorizePage.mockImplementation(async () => {
      order.push("guard");
      return { authorized: true, actor: {}, tenantId: REAL, userId: USER };
    });
    seam.bbsViewOf.mockImplementation(async () => {
      order.push("read");
      return EMPTY_VIEW;
    });

    const page = await bbsPage();
    await page(address);

    expect(guard.authorizePage, "the page reaches `authorizePage` itself, with the segment as the assertion the guard checks").toHaveBeenCalledWith({
      tenant: SEGMENT,
      project: PROJECT,
    });
    expect(seam.bbsViewOf, "and reads the schedule for the workspace the guard ANSWERED, never for the segment a caller typed").toHaveBeenCalledWith({
      tenantId: REAL,
      projectId: PROJECT,
    });
    expect(order, "the guard is asked BEFORE the read runs — an authorisation that arrives after the rows have been read authorises nothing").toEqual(["guard", "read"]);
  });

  test("AC-2: a caller the guard refuses gets no read and no screen", async () => {
    guard.authorizePage.mockImplementation(async () => {
      throw new Error("NEXT_NOT_FOUND");
    });

    const page = await bbsPage();
    const rendered = await page(address).catch(() => null);

    expect(rendered, "nothing is built for a caller the guard did not admit").toBeNull();
    expect(seam.bbsViewOf.mock.calls.length, "and the schedule is never read for them — the refusal is the page's own answer, not a 403 behind a rendered grid").toBe(0);
  });
});
