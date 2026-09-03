// @vitest-environment jsdom
/**
 * AC-3's pattern half — OfferedGroups (L-ACT-02, R-UI-023, R-UI-060, docs/design/offered-group.md).
 *
 * The pattern is observed through the closed test contract of the Decision §7 — four `data-testid`s,
 * the key's own attributes per kind, the count's live region — and through its props. No stylesheet
 * fact is asserted: jsdom lays nothing out, and the paint is the gallery's baselines.
 *
 * The substance of the pattern is an ABSENCE (I-77): membership is the machine's, so a checkbox, a
 * row selection or a select-all anywhere inside it would be L-ACT-02's freeform multi-select, which
 * "does not exist". That absence is asserted here, not merely intended.
 *
 * The file is `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `pnpm verify`'s `tsc` reads
 * it as well as vitest. Elements are built with `React.createElement`, and the pattern is loaded by
 * absolute path so a module the Builder has not written yet fails as an assertion naming it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { galleryEntries, missingEntries } from "../../../src/ui/gallery-derivation";
import { formatUserFigure } from "../../../src/core/format";

const REPO_ROOT: string = process.cwd();

/** The homes the increment's interface list names. */
const BARREL = "src/ui/patterns/offered-group/index.ts";
const STRINGS = "src/ui/strings/offered-group.ts";

/** The gallery address the pattern is published at (increment interfaces). */
const GALLERY_ENTRY = "patterns/offered-group/OfferedGroups";

/** The four ids the Decision closes the contract at. */
const TESTID = {
  root: "offered-groups",
  group: "offered-group",
  count: "offered-group-count",
  confirm: "offered-group-confirm",
} as const;

/** One item the pattern is handed (increment interfaces: `OfferedGroupItem`). */
type Item = { key: { kind: string; discipline: string; drawingId?: string; sheetId?: string }; label: string; count: string };

/** The pattern's props, exactly as the interface list spells them. */
type Props = { groups: Item[]; onConfirm: (key: Item["key"]) => void };

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The pattern itself, as a component this file can mount. */
async function pattern(): Promise<{ OfferedGroups: React.ComponentType<Props>; exports: string[] }> {
  const barrel = await productModule<Record<string, unknown>>(BARREL);
  const found = barrel["OfferedGroups"];
  expect(typeof found, `${BARREL} exports OfferedGroups — the one home for L-ACT-02's offered bulk (B-17)`).toBe("function");
  return { OfferedGroups: found as React.ComponentType<Props>, exports: Object.keys(barrel).filter((name) => name !== "default") };
}

/** The pattern's own copy, read by key from the table the Decision §3 rules. */
async function copy(): Promise<Record<string, string>> {
  const table = await productModule<Record<string, unknown>>(STRINGS);
  const held = Object.values(table).find((value) => typeof value === "object" && value !== null);
  expect(held, `${STRINGS} publishes the pattern's string table (one table per surface, keyed by id)`).toBeTruthy();
  return held as Record<string, string>;
}

/** Three groups a consumer would offer: two keyed on a proposed discipline, one on a single sheet. */
function items(): Item[] {
  return [
    { key: { kind: "PROPOSED_DISCIPLINE", drawingId: "8f3a0f0e-3f7d-4a2f-9d40-1a2b3c4d5e6f", discipline: "STRUCTURAL" }, label: "STRUCTURAL proposed from the title block on rcc6.dxf", count: formatUserFigure("9") },
    { key: { kind: "PROPOSED_DISCIPLINE", drawingId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", discipline: "ARCHITECTURAL" }, label: "ARCHITECTURAL proposed from the title block on tower-arch.dxf", count: formatUserFigure("1234") },
    { key: { kind: "SHEET", sheetId: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e:S-104", discipline: "STRUCTURAL" }, label: "STRUCTURAL proposed for S-104 — Typical column schedule", count: formatUserFigure("1") },
  ];
}

/** Every element carrying a test id, in document order. */
function all(testId: string): Element[] {
  return [...document.querySelectorAll(`[data-testid="${testId}"]`)];
}

afterEach(() => {
  cleanup();
});

describe("AC-3: the OfferedGroups pattern renders the groups the machine offers", () => {
  test("AC-3: one offered-group per group, carrying its own typed key as data attributes", async () => {
    const { OfferedGroups } = await pattern();
    const groups = items();
    render(React.createElement(OfferedGroups, { groups, onConfirm: () => undefined }));

    expect(all(TESTID.root).length, "the pattern renders one region for the offer").toBe(1);
    const rows = all(TESTID.group);
    expect(rows.length, "one row per group it was handed — no group is folded into another").toBe(groups.length);

    rows.forEach((row, at) => {
      const item = groups[at] as Item;
      expect(row.getAttribute("data-kind"), `row ${at} publishes the kind of fact its group is keyed on (L-ACT-02: a typed grouping key over a closed enum)`).toBe(item.key.kind);
      expect(row.getAttribute("data-discipline"), `row ${at} publishes the discipline its key names`).toBe(item.key.discipline);
      if (item.key.drawingId !== undefined) expect(row.getAttribute("data-drawing"), `row ${at} publishes the drawing its key names`).toBe(item.key.drawingId);
      if (item.key.sheetId !== undefined) expect(row.getAttribute("data-sheet"), `row ${at} publishes the sheet its key names`).toBe(item.key.sheetId);
      expect(row.textContent, `row ${at} renders the consumer's sentence verbatim (I-79)`).toContain(item.label);
    });
  });

  test("AC-3: the membership count renders as the consumer formatted it, in a polite live region", async () => {
    const { OfferedGroups } = await pattern();
    const groups = items();
    render(React.createElement(OfferedGroups, { groups, onConfirm: () => undefined }));

    const counts = all(TESTID.count);
    expect(counts.length, "one live membership count per group (R-UI-023)").toBe(groups.length);
    counts.forEach((count, at) => {
      const item = groups[at] as Item;
      expect(count.textContent, `the count of row ${at} is the string the consumer produced through SEAM-FORMAT, character for character (I-78)`).toBe(item.count);
      expect(count.getAttribute("aria-live"), "the count is the live region, because it is the only thing that moves while the row stands (I-80)").toBe("polite");
    });
  });

  test("AC-3: the confirm door hands back exactly the key it was given", async () => {
    const { OfferedGroups } = await pattern();
    const groups = items();
    const carried: unknown[] = [];
    render(React.createElement(OfferedGroups, { groups, onConfirm: (key) => carried.push(key) }));

    const doors = all(TESTID.confirm);
    expect(doors.length, "one door per group — the only door there is").toBe(groups.length);
    fireEvent.click(doors[1] as Element);
    expect(carried.length, "one call per activation").toBe(1);
    expect(carried[0], "the door hands back the item's own key object — never a copy and never a derived string").toBe((groups[1] as Item).key);
  });

  test("AC-3: nothing inside the offer can assemble a set of subjects", async () => {
    const { OfferedGroups } = await pattern();
    render(React.createElement(OfferedGroups, { groups: items(), onConfirm: () => undefined }));
    const root = all(TESTID.root)[0] as Element;

    expect(root.querySelectorAll('input[type="checkbox"]').length, 'L-ACT-02: "a freeform multi-select does not exist" — the pattern renders no checkbox').toBe(0);
    expect(root.querySelectorAll('[role="checkbox"]').length, "nor anything wearing a checkbox's role").toBe(0);
    expect(root.querySelectorAll("input").length, "membership is resolved in the Consequence, so there is nothing here for a person to type or tick (I-77)").toBe(0);
    expect(/select all/i.test(root.textContent ?? ""), "there is no select-all over heterogeneous rows (R-UI-023)").toBe(false);
  });

  test("AC-3: with no groups the pattern says so in one sentence from its own table", async () => {
    const { OfferedGroups, exports } = await pattern();
    const strings = await copy();
    const sentence = strings["offered_group_empty"];
    expect(typeof sentence, "the empty sentence is a key of the pattern's own string table (I-24's class)").toBe("string");

    render(React.createElement(OfferedGroups, { groups: [], onConfirm: () => undefined }));
    expect(all(TESTID.root).length, "the region still stands").toBe(1);
    expect(all(TESTID.group).length, "there is no row").toBe(0);
    expect(all(TESTID.confirm).length, "the pattern has no action to offer when nothing is grouped (I-82)").toBe(0);
    expect((all(TESTID.root)[0] as Element).textContent, "it renders the registered sentence rather than silence (R-UI-020)").toContain(sentence);

    expect(exports, "the barrel exports the pattern and nothing else").toEqual(["OfferedGroups"]);
  });

  test("AC-3: the gallery publishes the pattern, and no shipped component is left unmounted", async () => {
    await pattern();
    expect(Object.keys(galleryEntries), `the /design gallery publishes ${GALLERY_ENTRY} (R-UI-011: a pattern nobody can see is a pattern nobody maintains)`).toContain(GALLERY_ENTRY);
    expect(missingEntries(), "every component the gallery's barrels export has an entry").toEqual([]);
  });
});
