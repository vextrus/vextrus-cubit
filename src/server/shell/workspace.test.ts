// The order the shell picks a workspace in (R-UI-030, R-SPINE-002). "The earliest membership" is
// only an answer if the order is TOTAL: `created_at` alone leaves two memberships written in one
// transaction tied, and an unordered pick would let the frame, the breadcrumb, the `/` door and the
// rename target name a different workspace from run to run.
//
// The order lives in a single statement over `memberships`, and both readings — the one workspace
// and the list the switcher shows — take it from that statement (B-17). It is judged here by reading
// the shipped file rather than by a database: the unit lane has no cluster, and the property at
// stake is which columns the one ORDER BY names and that nothing else picks a row without it.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const WORKSPACE_MODULE = new URL("./workspace.ts", import.meta.url);

/** The file with its comments removed, so prose about ordering cannot stand in for the code. */
function shippedCode(): string {
  return readFileSync(WORKSPACE_MODULE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `.orderBy(...)` the file states, as written. */
function orderings(code: string): string[] {
  return [...code.matchAll(/\.orderBy\(((?:[^()]|\([^()]*\))*)\)/g)].map((found) => found[1] ?? "");
}

describe("the shell's workspace order is total", () => {
  test("the one statement orders by the membership's age and settles the tie by tenant", () => {
    const code = shippedCode();
    const ordered = orderings(code);
    expect(ordered, "the workspaces are read by exactly one ordered statement").toHaveLength(1);

    const order = ordered[0] ?? "";
    const columns = [...order.matchAll(/asc\((\w+)\.(\w+)\)/g)].map((found) => `${found[1] ?? ""}.${found[2] ?? ""}`);
    expect(columns, "age first, then the tenant uuid — two rows of one transaction still order").toEqual([
      "memberships.createdAt",
      "memberships.tenantId",
    ]);
  });

  test("no reading of a workspace picks a row the order did not settle", () => {
    const code = shippedCode();
    // `holdsWorkspace` asks whether a named membership exists at all — a yes/no over an equality on
    // both keys, which no order can change. Every reading that returns a workspace goes through the
    // ordered statement, so none of them takes a row an unordered `limit` handed it.
    const limits = [...code.matchAll(/\.limit\((\d+)\)/g)];
    expect(limits, "the only unordered limit is the membership existence check").toHaveLength(1);
    expect(code).toMatch(/select\(\{ tenantId: memberships\.tenantId \}\)/);

    const earliest = /async function earliestWorkspaceOf\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    expect(earliest, "the one workspace is the first of the ordered list, not a second statement").toMatch(/workspacesOf\(userId\)\)\[0\]/);
  });
});
