// The order the shell picks a workspace in (R-UI-030, R-SPINE-002). "The earliest membership" is
// only an answer if the order is TOTAL: `created_at` alone leaves two memberships written in one
// transaction tied, and an unordered pick would let the frame, the breadcrumb, the `/` door and the
// rename target name a different workspace from run to run.
//
// RE-BASELINED (B-20, AC-1(b)). This file used to demand that the shell state that order ITSELF,
// which is exactly the second home debt-src-modules-1kuc50w orders removed: the memberships-to-
// workspaces reading now has one home, `workspacesBySeniority` in the tenancy module, and the shell
// asks it under its own recorded reason. So the order is judged where it now lives — in the one
// statement of that module that ANSWERS A WORKSPACE — and what is judged of the shell is that it
// answers through that reading rather than round it, which is a behaviour and is checked by mock.
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";

const TENANCY_MODULE = "../../modules/spine/tenancy";
const SENIORITY_MODULE = new URL("../../modules/spine/tenancy/roles/seniority.ts", import.meta.url);

/** Two workspaces, in the order the one reading answers with them. */
const WORKSPACES = [
  { tenantId: "11111111-1111-4111-8111-111111111111", name: "Earliest" },
  { tenantId: "22222222-2222-4222-8222-222222222222", name: "Later" },
];

const SESSION = { userId: "aaaaaaaa-1111-4222-8333-444444444444" };

const seam = vi.hoisted(() => ({
  workspacesBySeniority: vi.fn<(reason: string, userId: string) => Promise<readonly { tenantId: string; name: string }[]>>(),
  sessionOf: vi.fn<(token: string | null) => Promise<{ userId: string } | null>>(),
}));

vi.mock("../../modules/spine/tenancy", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, workspacesBySeniority: seam.workspacesBySeniority };
});
vi.mock("./resolve", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, sessionOf: seam.sessionOf };
});

const shell = await import("./workspace");

beforeEach(() => {
  vi.clearAllMocks();
  seam.sessionOf.mockImplementation(async () => SESSION);
  seam.workspacesBySeniority.mockImplementation(async () => WORKSPACES);
});

describe("AC-1(b): the shell answers through the one seniority reading", () => {
  test("the frame's list is that reading's answer, asked under a reason the shell states", async () => {
    const listed = await shell.workspacesFor("a live session");

    expect(listed, "the shell adds nothing to what the reading answered, and reorders nothing").toEqual(WORKSPACES);
    expect(seam.workspacesBySeniority, "the memberships-to-workspaces reading has one home, and the shell asks it").toHaveBeenCalledTimes(1);
    const [reason, userId] = seam.workspacesBySeniority.mock.calls[0] ?? [];
    expect(typeof reason === "string" && reason.trim().length > 0, "asked under the shell's own recorded reason — attributable, like every system read").toBe(true);
    expect(userId, "for the account the presented session holds").toBe(SESSION.userId);
  });

  test("the workspace a session lands in is the first of that same answer", async () => {
    const held = await shell.workspaceFor("a live session");

    expect(held, "the earliest membership is the reading's first row, not a second pick of the shell's own").toEqual(WORKSPACES[0]);
  });

  test("an account the reading answers nothing for lands nowhere, and is not invented for", async () => {
    seam.workspacesBySeniority.mockImplementation(async () => []);

    await expect(shell.workspaceFor("a live session"), "no membership is no workspace").resolves.toBeNull();
    await expect(shell.workspacesFor("a live session"), "and an empty list is the honest answer for the switcher").resolves.toEqual([]);
  });

  test("a session that holds nothing never reaches the reading at all", async () => {
    seam.sessionOf.mockImplementation(async () => null);

    await expect(shell.workspaceFor("a dead cookie")).resolves.toBeNull();
    expect(seam.workspacesBySeniority, "a dead cookie is answered by the session seam, not by a membership query").not.toHaveBeenCalled();
  });
});

// white-box: AC-1(b) — which columns an order names is a property of the SQL, and the unit lane has
// no cluster to observe it on. The scan follows the statement to its new home (B-20).
describe("AC-1(b): and that reading states the total order", () => {
  /** The file with its comments removed, so prose about ordering cannot stand in for the code. */
  function shippedCode(at: URL): string {
    expect(existsSync(at), `${at.pathname} is missing from the checkout — the product does not provide it yet`).toBe(true);
    // white-box: AC-1(b) — which columns an order names is a property of the SQL, and the unit lane
    // has no cluster to observe it on; the scan follows the statement to its new home (B-20).
    return readFileSync(at, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /** One `.orderBy(...)` a file states: the statement carrying it, and the columns it names. */
  interface StatedOrder {
    readonly shape: string;
    readonly columns: readonly string[];
  }

  /**
   * Every `.orderBy(...)` a file states, each with the statement it belongs to.
   *
   * Anchored on the `.orderBy(` itself, so no order can be missed, and the shape is read back to the
   * `.select(` that opened the statement — which is what says WHAT the ordered statement answers.
   * Both directions are harvested: a `desc` tie-break settles a tie as surely as an `asc` one, and a
   * scan that only knew `asc` would let one past.
   */
  function ordersOf(code: string): StatedOrder[] {
    return [...code.matchAll(/\.orderBy\(([\s\S]*?)\)\s*(?:;|\.limit)/g)].map((found) => {
      const before = code.slice(0, found.index ?? 0);
      const opened = before.lastIndexOf(".select(");
      return {
        shape: opened === -1 ? "" : before.slice(opened),
        columns: [...(found[1] ?? "").matchAll(/(?:asc|desc)\((\w+)\.(\w+)\)/g)].map((column) => `${column[1] ?? ""}.${column[2] ?? ""}`),
      };
    });
  }

  /**
   * The statements that answer a WORKSPACE, told by the clause's own discriminators: the reading is
   * joined to `tenants` for the name and projects the pair a switcher row is made of (AC-1(b)).
   *
   * This filter IS the carve-out (B-17, AC-1(b)). What has one home is the memberships-to-workspaces
   * derivation, not this file's inventory of statements: a later reading here that lawfully joins
   * memberships for something else — a switcher count, a paged variant — is none of this rule's
   * business, and pinning the population would red a passing test on a question it cannot answer.
   */
  function answersWorkspace(order: StatedOrder): boolean {
    return /join\(\s*tenants\b/i.test(order.shape) && /\btenantId\s*:/.test(order.shape) && /\bname\s*:/.test(order.shape);
  }

  test("the seniority reading orders by the membership's age, then the tenant uuid", () => {
    const orders = ordersOf(shippedCode(SENIORITY_MODULE));

    const workspaceOrders = orders.filter(answersWorkspace);
    expect(workspaceOrders.length, "one statement answers a workspace, and it is the one this shell asks").toBe(1);
    expect(workspaceOrders[0]?.columns, "age first, then the tenant uuid — two memberships written in one transaction still order").toEqual([
      "memberships.createdAt",
      "memberships.tenantId",
    ]);

    // Whatever else this file grows, no reading of memberships here may name the age without the
    // uuid that settles it: that, and not the count of statements, is the rule the order carries.
    const openTies = orders.filter((order) => {
      const age = order.columns.indexOf("memberships.createdAt");
      return age !== -1 && order.columns[age + 1] !== "memberships.tenantId";
    });
    expect(openTies.map((order) => order.columns), "no reading of memberships here leaves the one-transaction tie open").toEqual([]);
  });

  test("and the shell spells no order of its own for it", () => {
    const code = shippedCode(new URL("./workspace.ts", import.meta.url));

    const overMemberships = ordersOf(code).filter((order) => order.columns.some((column) => column.startsWith("memberships.")));
    expect(overMemberships, `the shell asks ${TENANCY_MODULE} for the order rather than restating it (B-17)`).toEqual([]);
  });
});
