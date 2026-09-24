/**
 * S-Ask's page reaches the choke point ITSELF, and reads under what it answered (SEAM-AUTH,
 * `authorizePage`; docs/design/s-ask.md §2 Denied, I-406) — the bar schedule's idiom.
 *
 * The guard, the participation reading and the arrival read are replaced, and the ORDER between them
 * is what is graded: the guard is asked before anything is read, the reads are scoped by the
 * workspace the guard answered (never by the segment a caller typed), a member who is not a
 * participant is stood denied with nothing of the project read, and a guard that throws leaves every
 * read uncalled. Nothing here opens a database.
 */
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";

const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCREEN_DIR = "src/app/(app)/t/[tenant]/p/[project]/takeoff/ask";
const PAGE = `${SCREEN_DIR}/page.tsx`;

const SEGMENT = "tenant-as-typed";
const REAL = "tenant-as-owned";
const PROJECT = "project-1";
const USER = "user-1";

const order: string[] = [];
const guard = { authorizePage: vi.fn() };
const acts = { participatesIn: vi.fn() };
const arrival = { askArrivalOf: vi.fn() };

const address = (q?: string) => ({ params: Promise.resolve({ tenant: SEGMENT, project: PROJECT }), searchParams: Promise.resolve(q === undefined ? {} : { q }) });

beforeEach(() => {
  vi.resetModules();
  order.length = 0;
  guard.authorizePage.mockReset().mockImplementation(async () => {
    order.push("guard");
    return { authorized: true, actor: {}, tenantId: REAL, userId: USER };
  });
  acts.participatesIn.mockReset().mockImplementation(async () => {
    order.push("participation");
    return true;
  });
  arrival.askArrivalOf.mockReset().mockImplementation(async () => {
    order.push("arrival");
    return { campaign: { campaignId: "c", setRevisionId: "r" }, stamp: "s", example: null };
  });
});

type Rendered = { props: Record<string, unknown> };

async function askPage(): Promise<(props: ReturnType<typeof address>) => Promise<Rendered>> {
  vi.doMock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn(), useRouter: vi.fn(), usePathname: vi.fn() }));
  vi.doMock(resolve(REPO_ROOT, "src/server/authorize-page.ts"), () => ({ authorizePage: guard.authorizePage }));
  vi.doMock(resolve(REPO_ROOT, "src/core/acts/index.ts"), () => ({ participatesIn: acts.participatesIn }));
  vi.doMock(resolve(REPO_ROOT, "src/core/db.ts"), () => ({ forTenant: (ctx: { tenantId: string }) => ({ transaction: (work: (tx: unknown) => unknown) => work({ tenantId: ctx.tenantId }) }) }));
  vi.doMock(resolve(REPO_ROOT, "src/modules/takeoff/ask/arrival.ts"), () => ({ askArrivalOf: arrival.askArrivalOf }));
  vi.doMock(resolve(REPO_ROOT, `${SCREEN_DIR}/actions.ts`), () => ({ askTheDrawings: vi.fn() }));
  vi.doMock(resolve(REPO_ROOT, `${SCREEN_DIR}/ask.css`), () => ({}));
  const loaded = (await import(resolve(REPO_ROOT, PAGE))) as { default: (props: ReturnType<typeof address>) => Promise<Rendered> };
  return loaded.default;
}

describe("S-Ask asks the choke point for itself, before it reads anything (SEAM-AUTH, I-406)", () => {
  test("the guard first, then participation and the arrival read, both scoped by the workspace the guard answered", async () => {
    const page = await askPage();
    const rendered = await page(address("How many C3 columns are on 5F?"));
    expect(guard.authorizePage).toHaveBeenCalledWith({ tenant: SEGMENT, project: PROJECT });
    expect(acts.participatesIn).toHaveBeenCalledWith({ tenantId: REAL }, PROJECT, USER);
    expect(arrival.askArrivalOf).toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT });
    expect(order).toEqual(["guard", "participation", "arrival"]);
    expect(rendered.props["participant"]).toBe(true);
    expect(rendered.props["question"], "the address's question is handed to the screen to ask once").toBe("How many C3 columns are on 5F?");
  });

  test("a member with no place on the project is stood denied, and nothing of the project is read", async () => {
    acts.participatesIn.mockImplementation(async () => false);
    const page = await askPage();
    const rendered = await page(address());
    expect(rendered.props["participant"]).toBe(false);
    expect(rendered.props["arrival"]).toBeNull();
    expect(arrival.askArrivalOf).not.toHaveBeenCalled();
  });

  test("a caller the guard refuses gets no read and no screen", async () => {
    guard.authorizePage.mockImplementation(async () => {
      throw new Error("NEXT_NOT_FOUND");
    });
    const page = await askPage();
    const rendered = await page(address()).catch(() => null);
    expect(rendered).toBeNull();
    expect(acts.participatesIn).not.toHaveBeenCalled();
    expect(arrival.askArrivalOf).not.toHaveBeenCalled();
  });

  test("a read that fails is a fault with a report id, never a denial", async () => {
    arrival.askArrivalOf.mockImplementation(async () => {
      throw new Error("the store is down");
    });
    const page = await askPage();
    const rendered = await page(address());
    expect(rendered.props["participant"]).toBe(true);
    expect(typeof rendered.props["reportId"]).toBe("string");
  });
});
