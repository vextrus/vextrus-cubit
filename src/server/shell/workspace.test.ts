// The order the shell picks a workspace in (R-UI-030, R-SPINE-002). "The earliest membership" is
// only an answer if the order is TOTAL: `created_at` alone leaves two memberships written in one
// transaction tied, and an unordered pick would let the frame, the breadcrumb, the `/` door and the
// rename target name a different workspace from run to run.
//
// The rule judged here is per-statement, not per-file: EVERY statement that answers a workspace
// carries that total order, and a statement that bounds its rows may do so only under it. A later
// reading that lawfully joins memberships for something other than a workspace — an invitation
// lookup, a switcher's own count — is none of this rule's business. It is judged by reading the
// shipped file rather than by a database: the unit lane has no cluster, and the property at stake
// is which columns the order names.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const WORKSPACE_MODULE = new URL("./workspace.ts", import.meta.url);

/** The file with its comments removed, so prose about ordering cannot stand in for the code. */
function shippedCode(): string {
  return readFileSync(WORKSPACE_MODULE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The fields a `Workspace` carries, read from the shipped interface rather than transcribed. */
function workspaceFields(code: string): string[] {
  const body = /export interface Workspace \{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
  return [...body.matchAll(/^\s*(\w+)\s*:/gm)].map((found) => found[1] ?? "");
}

/** The balanced argument of the first `name(` at or after `from`, or null when the call is absent. */
function argumentOf(code: string, name: string): string | null {
  const at = code.indexOf(`${name}(`);
  if (at === -1) return null;
  const open = at + name.length;
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return null;
}

/** One `.select(...)` chain, from the projection to the `;` that ends the statement. */
interface Statement {
  /** The keys the projection names — a workspace reading names at least the Workspace fields. */
  projects: string[];
  /** The `asc(table.column)` columns of the chain's order, in the order written. */
  orderedBy: string[];
  /** Does the chain take only some of the rows its where clause matched? */
  bounded: boolean;
}

/** Every `.select(...)` statement the file states, as written. */
function statements(code: string): Statement[] {
  const found: Statement[] = [];
  for (let at = code.indexOf(".select("); at !== -1; at = code.indexOf(".select(", at + 1)) {
    let depth = 0;
    let end = code.length;
    for (let i = at; i < code.length; i += 1) {
      const ch = code[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === ";" && depth === 0) {
        end = i;
        break;
      }
    }
    const text = code.slice(at, end);
    const projection = argumentOf(text, ".select") ?? "";
    const order = argumentOf(text, ".orderBy") ?? "";
    found.push({
      projects: [...projection.matchAll(/(\w+)\s*:/g)].map((key) => key[1] ?? ""),
      orderedBy: [...order.matchAll(/asc\((\w+)\.(\w+)\)/g)].map((column) => `${column[1] ?? ""}.${column[2] ?? ""}`),
      bounded: /\.limit\(/.test(text),
    });
  }
  return found;
}

/** The one total order every workspace reading owes: the membership's age, tie-broken by tenant. */
const TOTAL_ORDER = ["memberships.createdAt", "memberships.tenantId"];

/** A statement answers a workspace when its projection names every field a `Workspace` carries. */
function answersWorkspace(statement: Statement, fields: string[]): boolean {
  return fields.length > 0 && fields.every((field) => statement.projects.includes(field));
}

describe("the shell's workspace order is total", () => {
  test("every statement that answers a workspace orders by the membership's age, then the tenant", () => {
    const code = shippedCode();
    const fields = workspaceFields(code);
    const readings = statements(code).filter((statement) => answersWorkspace(statement, fields));

    expect(fields.length, "the Workspace shape is read from the file, so a reading can be recognised").toBeGreaterThan(0);
    expect(readings.length, "the shell reads a workspace somewhere — otherwise this scan judges nothing").toBeGreaterThan(0);
    for (const reading of readings) {
      expect(reading.orderedBy, "age first, then the tenant uuid — two rows of one transaction still order").toEqual(TOTAL_ORDER);
    }
  });

  test("a statement that takes only some of its rows takes them under that order", () => {
    const code = shippedCode();
    const fields = workspaceFields(code);
    const all = statements(code);

    expect(all.length, "the scan reaches the file's statements").toBeGreaterThan(0);
    // A bounded statement hands back whichever row the planner reached first unless an order settles
    // which row that is. Bounding is lawful for a question no order can change — `holdsWorkspace`
    // asks whether a named membership exists at all, an equality on both keys — so the rule binds
    // the bounded statements that answer a workspace, which are the ones a caller renders.
    for (const statement of all) {
      if (!statement.bounded || !answersWorkspace(statement, fields)) continue;
      expect(statement.orderedBy, "a bounded workspace reading names which row it takes").toEqual(TOTAL_ORDER);
    }
  });
});
