// @vitest-environment jsdom
/**
 * AC-3 — one roster, three readers: the `?` sheet, the palette's shortcut rows and the key handler
 * all take `SHORTCUTS`, so a documented key and a bound key cannot differ (R-UI-032, I-147).
 *
 * Every expectation is derived from the roster the tree publishes, in both directions — no row
 * without an entry, no entry without a row — so the day a twentieth shortcut lands the suite moves
 * with it (B-19). The one written-down list is the clause's own: the shortcuts R-UI-032 names.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  GROUP,
  PROJECT,
  TENANT,
  TESTID,
  all,
  copy,
  exportedFn,
  itemsOf,
  maybe,
  mountFrame,
  one,
  openPalette,
  productModule,
  rosterModule,
  settle,
  strings,
  text,
  unmountAll,
  DRAWINGS_ROUTE_MODULE,
  SHELL_ROUTES_MODULE,
} from "./support/palette-stage";

afterEach(() => {
  unmountAll();
});

/** The shortcuts R-UI-032 names, in the clause's own order — the floor the roster must hold. */
const CLAUSE_SHORTCUTS: readonly string[] = [
  "palette",
  "shortcut-sheet",
  "go-projects",
  "go-drawings",
  "go-takeoff",
  "go-estimate",
  "go-bid",
  "viewer-select",
  "viewer-pan",
  "viewer-measure",
  "viewer-count",
  "viewer-linear",
  "viewer-area",
  "viewer-snap",
  "viewer-fit",
  "viewer-escape",
  "table-move",
  "table-edit",
  "table-next",
];

/** The way a chord reads once whitespace is normalised — `chordOf` joins its steps with spaces. */
const said = (value: string): string => value.replace(/\s+/g, " ").trim();

describe("AC-3: the roster, the ? sheet and the palette's shortcut rows", () => {
  test("AC-3: the roster names every shortcut R-UI-032 documents, each with a scope, keys and a label the table states", async () => {
    const roster = await rosterModule();
    const table = await strings();
    const ids = roster.SHORTCUTS.map((entry) => entry.id);

    for (const id of CLAUSE_SHORTCUTS) {
      expect(ids, `SHORTCUTS names \`${id}\` — R-UI-032 documents it (AC-3)`).toContain(id);
    }
    expect(new Set(ids).size, "a shortcut id is named once").toBe(ids.length);

    for (const entry of roster.SHORTCUTS) {
      expect(roster.SHORTCUT_SCOPES, `\`${entry.id}\` stands in a declared scope`).toContain(entry.scope);
      expect(Array.isArray(entry.keys) && entry.keys.length > 0, `\`${entry.id}\` states the keys that reach it`).toBe(true);
      expect(typeof copy(table, entry.label), `\`${entry.id}\`'s label is a key of the one string table`).toBe("string");
      expect(said(roster.chordOf(entry)).length, `\`${entry.id}\` reads as a chord a person can say (I-149)`).toBeGreaterThan(0);
    }
  });

  test("AC-3: ? opens the sheet, holding one row per roster entry in roster order, with its chord and its label", async () => {
    const frame = await mountFrame();
    const roster = await rosterModule();
    const table = await strings();

    await frame.user.keyboard("?");
    await settle();

    const sheet = maybe(TESTID.sheet);
    expect(sheet, "pressing ? outside a text field opens the shortcut sheet (AC-3)").not.toBeNull();
    expect((sheet as HTMLElement).getAttribute("role"), `\`${TESTID.sheet}\` is a dialog`).toBe("dialog");
    expect((sheet as HTMLElement).getAttribute("aria-label"), "the sheet is labelled by the one string table (AC-3)").toBe(
      copy(table, "shortcut_sheet_label"),
    );

    const rows = all(TESTID.sheetRow, sheet as HTMLElement);
    expect(
      rows.map((row) => row.getAttribute("data-shortcut")),
      "one row per roster entry and one entry per row, in roster order (AC-3, B-19)",
    ).toEqual(roster.SHORTCUTS.map((entry) => entry.id));

    for (const [index, entry] of roster.SHORTCUTS.entries()) {
      const row = rows[index] as HTMLElement;
      expect(row.getAttribute("data-scope"), `\`${entry.id}\`'s row says where the key works (AC-3)`).toBe(entry.scope);
      expect(said(text(all(TESTID.sheetKeys, row)[0] ?? null)), `\`${entry.id}\`'s row reads its chord (AC-3)`).toBe(said(roster.chordOf(entry)));
      expect(text(row), `\`${entry.id}\`'s row reads its label from the one table (AC-3)`).toContain(copy(table, entry.label));
    }
  });

  test("AC-3: the open palette's shortcuts group holds the same roster, row for row", async () => {
    const frame = await mountFrame();
    const roster = await rosterModule();

    await openPalette(frame);

    const rows = itemsOf(GROUP.shortcuts);
    expect(
      rows.map((row) => row.getAttribute("data-shortcut")),
      "the palette's shortcut rows are the roster, in both directions and in its order (AC-3)",
    ).toEqual(roster.SHORTCUTS.map((entry) => entry.id));
    for (const row of rows) {
      expect(row.getAttribute("data-kind"), "a shortcut row says what kind of thing it is (AC-3)").toBe("shortcut");
    }
  });

  test("AC-3: g then p goes to the workspace's projects, and g then d to the project's drawings", async () => {
    const shell = await productModule<Record<string, unknown>>(SHELL_ROUTES_MODULE);
    const shellHref = exportedFn(shell, "shellHref", SHELL_ROUTES_MODULE) as (tenantId: string, area: string) => string;
    const drawings = await productModule<Record<string, unknown>>(DRAWINGS_ROUTE_MODULE);
    const drawingsRoute = exportedFn(drawings, "drawingsRoute", DRAWINGS_ROUTE_MODULE) as (tenantId: string, projectId: string) => string;

    const outside = await mountFrame({ projectId: null });
    await outside.user.keyboard("gp");
    await settle();
    expect(outside.navigated, "g then p opens the workspace's projects (AC-3)").toEqual([shellHref(TENANT, "projects")]);
    unmountAll();

    const inside = await mountFrame({ projectId: PROJECT });
    await inside.user.keyboard("gd");
    await settle();
    expect(inside.navigated, "g then d inside a project opens its drawings (AC-3)").toEqual([drawingsRoute(TENANT, PROJECT)]);
  });

  test("AC-3: the chord is a sequence, and its steps are matched by the roster's own matcher", async () => {
    const roster = await rosterModule();
    expect(roster.CHORD_TIMEOUT_MS, "a chord has a window a person can type inside (increment interfaces)").toBeGreaterThan(0);

    const goProjects = roster.SHORTCUTS.find((entry) => entry.id === "go-projects");
    expect(goProjects, "the roster names `go-projects`").toBeDefined();
    const steps = (goProjects as { keys: readonly string[] }).keys;
    expect(steps.length, "`go-projects` is a two-step sequence (R-UI-032: G then P)").toBe(2);
    for (const step of steps) {
      expect(
        roster.matchStep({ key: step, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, step),
        `matchStep answers for the step it was given (\`${step}\`)`,
      ).toBe(true);
    }
  });
});
