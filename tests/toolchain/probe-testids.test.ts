// The probe reads test ids from the registry, never spelling one (AM-09 §1). Its reader parses
// `src/ui/testids.ts` as text, so the thing worth proving is that the text reading and the module
// agree on every id — a registry entry the parser cannot read would be a name the probe cannot find.
import { describe, expect, test } from "vitest";
import { TESTIDS as REGISTRY } from "../../src/ui/testids";
import { TESTIDS as PARSED, idOf, parseRegistry, sel } from "../../scripts/probe/lib/testids.mjs";

function flatten(tree: unknown, prefix = ""): [string, string][] {
  const out: [string, string][] = [];
  if (tree === null || typeof tree !== "object") return out;
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") out.push([path, value]);
    else out.push(...flatten(value, path));
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

describe("the probe's registry reading is the registry", () => {
  test("every id the module publishes is read from the text, byte for byte, and no id is invented", () => {
    const fromModule = flatten(REGISTRY);
    const fromText = flatten(PARSED);
    expect(fromText.length, "the parser reads as many ids as the module publishes").toBe(fromModule.length);
    expect(fromText).toEqual(fromModule);
  });

  test("idOf answers by dotted key and refuses a key the registry does not carry; sel spells the tree's selector", () => {
    expect(idOf("shell.main")).toBe(REGISTRY.shell.main);
    expect(sel("shell.main")).toBe(`[data-testid="${REGISTRY.shell.main}"]`);
    expect(() => idOf("shell.nowhere")).toThrow(/declares no TESTIDS\.shell\.nowhere/);
    expect(() => idOf("shell")).toThrow(/is a group, not an id/);
  });

  test("the parser reads a nested literal and stops at its end", () => {
    const parsed = parseRegistry(`const before = 1;\nexport const TESTIDS = {\n  // a comment\n  a: {\n    b: "a-b", // trailing\n    c: "a-c",\n  },\n  d: "d",\n} as const;\nexport const AFTER = { z: "z" };\n`);
    expect(parsed).toEqual({ a: { b: "a-b", c: "a-c" }, d: "d" });
  });
});
