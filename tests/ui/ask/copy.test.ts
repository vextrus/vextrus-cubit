// @vitest-environment node
/**
 * S-Ask's copy is ONE text in two places (C-13, R-SPINE-060): every `ask_…` string the Decision's §3
 * writes as `key` **value** is published verbatim by the string table, and every key the table
 * publishes is written in the Decision — directly, or as the `_other` of a documented `_one`, or as a
 * member of an enumerated family (`ask_class_*`, `ask_kind_*`, `ask_trade_*`, `ask_note_kind_*`) whose
 * roster §3 enumerates and `present.test.ts` holds complete.
 *
 * white-box: the criterion is a claim ABOUT THE DECISION'S TEXT, so the design document is read here.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ask } from "@/ui/strings/ask";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DECISION = "docs/design/s-ask.md";

/** Every `key` **value** pair the Decision writes for this screen. */
function decisionCopy(): Map<string, string> {
  const text = readFileSync(resolve(REPO_ROOT, DECISION), "utf8").replace(/\s+/gu, " ");
  const pairs = new Map<string, string>();
  for (const match of text.matchAll(/`((?:ask_|takeoff_nav_ask)[a-z_]*)` \*\*([^*]+)\*\*/gu)) pairs.set(match[1] as string, (match[2] as string).trim());
  return pairs;
}

/** The families §3 enumerates by roster rather than spelling each key. */
const ENUMERATED = /^ask_(class|kind|trade|note_kind)_/u;

describe("S-Ask's copy: the Decision and the table are one text (C-13)", () => {
  test("every string the Decision writes is published verbatim", () => {
    const table = ask as Readonly<Record<string, string>>;
    const documented = decisionCopy();
    expect(documented.size, "the Decision's §3 writes the screen's copy").toBeGreaterThan(50);
    for (const [key, value] of documented) expect(table[key], `${key} — the Decision writes **${value}**`).toBe(value);
  });

  test("every key the table publishes is written in the Decision", () => {
    const documented = decisionCopy();
    const unwritten = Object.keys(ask).filter((key) => !documented.has(key) && !ENUMERATED.test(key) && !(key.endsWith("_other") && documented.has(key.replace(/_other$/u, "_one"))));
    expect(unwritten, "a published string the Decision never states is copy nobody designed").toEqual([]);
  });
});
