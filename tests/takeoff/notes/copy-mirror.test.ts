/**
 * AC-7 (the copy half) — S-Schedules says the sentences its Design Decision rules, and the module's
 * mirror says them word for word (docs/design/s-schedules.md §3, §7, B-17, C-13).
 *
 * ARCH-01 leaves a module no way to read `src/ui/strings`, so the workspace mirrors the table it
 * says; a mirror can drift, and this file is what makes it a mirror rather than an improvisation
 * (the precedent is tests/takeoff/levels-ui/copy-mirror.test.ts). Both sides are loaded by path so a
 * table the Builder has not written yet reds as the missing module it is rather than killing
 * collection.
 *
 * The Decision is read as a DOCUMENT, not as source: §3 states this screen's copy verbatim, and a
 * screen whose strings differ from the Decision that rules them is a deviation (the product's law).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { COPY_MIRROR_MODULE, REPO_ROOT, STRINGS_MODULE } from "./support/bnbc-notes";
import { productModule } from "./support/notes-doors";

/** The Decision this screen is built against. */
const DECISION = "docs/design/s-schedules.md";

/** Whitespace as a document wraps it is not a difference in a sentence (§3 wraps its lines). */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The copy table a module publishes: its one exported record of sentences, whatever it is named. */
function copyTableOf(module: Record<string, unknown>, where: string): Record<string, string> {
  const tables = Object.values(module).filter(
    (value): value is Record<string, string> =>
      typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string"),
  );
  const table = tables.find((one) => Object.keys(one).length > 0);
  expect(table, `${where} publishes a table of sentences`).toBeTruthy();
  return table as Record<string, string>;
}

/** Every `key` **sentence** pair §3 of the Decision states, collapsed onto one line each. */
function decisionCopy(): Record<string, string> {
  const text = readFileSync(join(REPO_ROOT, DECISION), "utf8");
  const section = text.split(/^## 3\. /m)[1]?.split(/^## 4\. /m)[0] ?? "";
  expect(section.length, `${DECISION} carries its §3 copy table`).toBeGreaterThan(0);
  const pairs: Record<string, string> = {};
  for (const match of section.matchAll(/`([a-z][a-z0-9_]*)`\s+\*\*([^*]+)\*\*/g)) {
    pairs[match[1] as string] = oneLine(match[2] as string);
  }
  expect(Object.keys(pairs).length, `${DECISION} §3 states this screen's sentences by key`).toBeGreaterThan(0);
  return pairs;
}

describe("AC-7: the screen's copy is the Decision's, and the module's mirror is the registry's", () => {
  test("AC-7: every sentence the Decision rules stands in the registry, verbatim", async () => {
    const registry = copyTableOf(await productModule<Record<string, unknown>>(STRINGS_MODULE), STRINGS_MODULE);
    const ruled = decisionCopy();
    for (const [key, sentence] of Object.entries(ruled)) {
      expect(oneLine(registry[key] ?? ""), `${STRINGS_MODULE} says \`${key}\` as ${DECISION} §3 rules it`).toBe(sentence);
    }
    expect(
      Object.keys(registry).sort(),
      `and says nothing ${DECISION} §3 does not rule: copy verbatim is a two-way table, so a sentence on the screen that no Decision states is a deviation`,
    ).toEqual(Object.keys(ruled).sort());
  });

  test("AC-7: the module's mirror and the registry carry the same keys and the same words", async () => {
    const registry = copyTableOf(await productModule<Record<string, unknown>>(STRINGS_MODULE), STRINGS_MODULE);
    const mirror = copyTableOf(await productModule<Record<string, unknown>>(COPY_MIRROR_MODULE), COPY_MIRROR_MODULE);

    expect(Object.keys(mirror).sort(), "neither table can gain a sentence the other never hears (B-17)").toEqual(Object.keys(registry).sort());
    for (const [key, mirrored] of Object.entries(mirror)) {
      expect(registry[key], `the mirror says \`${key}\` in the registry's own words`).toBe(mirrored);
    }
  });
});
