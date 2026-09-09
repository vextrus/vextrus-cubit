// @vitest-environment jsdom
/**
 * AC-4 — `SHORTCUTS` is the one home of every R-UI-032 binding, and the three surfaces that read it
 * — the global handler, the palette's shortcuts group and the ? sheet — are one list.
 *
 * Every expectation over the roster is an enumeration of the roster itself: the rows the sheet owes,
 * the items the palette owes and the keys a chord is driven with are all read from `SHORTCUTS` and
 * `shortcutById` at test time, never transcribed (B-19). The ids R-UI-032 fixes are asserted to be
 * PRESENT, never to be all there is — a later increment that binds a tenth viewer key extends the
 * roster and must not redden this.
 */
import { cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import {
  PALETTE_CHORD,
  PROJECT,
  SHORTCUTS_DIR,
  TENANT,
  all,
  copy,
  eventForStep,
  group,
  named,
  one,
  openPalette,
  press,
  pressSteps,
  rosterModule,
  routeBuilders,
  shellHref,
  stageHost,
  text,
  type MatchesStep,
  type ShortcutKeyEventLike,
} from "./support/palette-stage";

/** The scopes the interfaces close `ShortcutScope` over. */
const SCOPES = ["global", "viewer", "table"];

/** The ids R-UI-032 fixes, as the increment's interfaces spell them, in the order they are listed. */
const FIXED_IDS = [
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
] as const;

interface Shortcut {
  readonly id: string;
  readonly scope: string;
  readonly keys: readonly string[];
  readonly label: string;
}

interface Roster {
  SHORTCUTS: readonly Shortcut[];
  shortcutById: (id: string) => Shortcut;
  matchesStep: MatchesStep;
  keyWords: (entry: Shortcut) => readonly string[];
  CHORD_TIMEOUT_MS: number;
}

async function roster(): Promise<Roster> {
  const bag = await rosterModule();
  const shortcuts = named<readonly Shortcut[]>(bag, "SHORTCUTS", SHORTCUTS_DIR);
  expect(Array.isArray(shortcuts), `${SHORTCUTS_DIR}/ publishes \`SHORTCUTS\` as a roster`).toBe(true);
  return {
    SHORTCUTS: shortcuts,
    shortcutById: named(bag, "shortcutById", SHORTCUTS_DIR),
    matchesStep: named(bag, "matchesStep", SHORTCUTS_DIR),
    keyWords: named(bag, "keyWords", SHORTCUTS_DIR),
    CHORD_TIMEOUT_MS: named(bag, "CHORD_TIMEOUT_MS", SHORTCUTS_DIR),
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AC-4 — the roster is one list, and every entry is whole", () => {
  test("AC-4: every entry has a unique id, a scope, keys and a label the one string table states", async () => {
    const { SHORTCUTS, shortcutById } = await roster();
    expect(SHORTCUTS.length, "the roster names bindings").toBeGreaterThan(0);

    const ids = SHORTCUTS.map((entry) => entry.id);
    expect(new Set(ids).size, "no id is declared twice — an id is what every surface reads a binding by").toBe(ids.length);
    for (const entry of SHORTCUTS) {
      expect(entry.id.length, "an entry is named").toBeGreaterThan(0);
      expect(SCOPES, `${entry.id} states one of the three scopes`).toContain(entry.scope);
      expect(Array.isArray(entry.keys) && entry.keys.length > 0, `${entry.id} states the keys it binds`).toBe(true);
      for (const step of entry.keys) expect(typeof step === "string" && step.length > 0, `${entry.id}'s steps are spelled`).toBe(true);
      expect(copy(entry.label).length, `${entry.id} is named by its own line of the one string table`).toBeGreaterThan(0);
      expect(shortcutById(entry.id), `shortcutById answers ${entry.id} with the roster's own entry`).toEqual(entry);
    }
  });

  test("AC-4: `shortcutById` throws for an id the roster lacks", async () => {
    const { shortcutById, SHORTCUTS } = await roster();
    const absent = `not-a-binding-${SHORTCUTS.length}`;
    expect(() => shortcutById(absent), "an id nobody bound is a mistake, not a silent undefined").toThrow();
  });

  test("AC-4: the roster names every binding R-UI-032 fixes, and binds each to a key the product itself recognises", async () => {
    const { SHORTCUTS, shortcutById, matchesStep } = await roster();
    const ids = SHORTCUTS.map((entry) => entry.id);
    for (const id of FIXED_IDS) expect(ids, `R-UI-032's \`${id}\` is one of the roster's bindings`).toContain(id);

    const palette = shortcutById("palette");
    expect(palette.keys.length, "⌘K is one step").toBe(1);
    expect(
      matchesStep({ key: PALETTE_CHORD.key, metaKey: true } as ShortcutKeyEventLike, palette.keys[0] as string),
      "the roster's `palette` step is the very chord AC-1 opens the palette with (B-17: one list, one binding)",
    ).toBe(true);

    const sheet = shortcutById("shortcut-sheet");
    expect(sheet.keys.length, "? is one step").toBe(1);
    expect(matchesStep({ key: "?" } as ShortcutKeyEventLike, sheet.keys[0] as string), "…and the ? sheet's step is `?`").toBe(true);

    for (const id of ["go-projects", "go-drawings", "go-takeoff", "go-estimate", "go-bid"]) {
      const entry = shortcutById(id);
      expect(entry.keys.length, `${id} is a sequence: G, then its own letter`).toBe(2);
      expect(matchesStep({ key: "g" } as ShortcutKeyEventLike, entry.keys[0] as string), `${id} begins with G`).toBe(true);
    }
  });
});

describe("AC-4 — the ? sheet is the roster, rendered", () => {
  test("AC-4: `?` outside a text field opens `shortcut-sheet`, holding one row per entry in roster order", async () => {
    const { SHORTCUTS, keyWords, matchesStep } = await roster();
    const { body } = await stageHost();

    press(eventForStep("?", matchesStep), document.body);
    const sheet = await waitFor(() => one(body, "shortcut-sheet"));
    expect(sheet.getAttribute("role"), "the sheet is a dialog").toBe("dialog");
    expect(sheet.getAttribute("aria-label"), "…named by the one string table").toBe(copy("shortcut_sheet_label"));

    const rows = all(sheet, "shortcut-sheet-row");
    expect(
      rows.map((row) => row.getAttribute("data-shortcut")),
      "exactly one row per roster entry, in the roster's own order (B-19: the sheet is the roster, enumerated)",
    ).toEqual(SHORTCUTS.map((entry) => entry.id));

    for (const [at, row] of rows.entries()) {
      const entry = SHORTCUTS[at] as Shortcut;
      expect(text(row), `the row for ${entry.id} shows the words the string table states for it`).toContain(copy(entry.label));
      const keys = within(row).getByTestId("shortcut-sheet-keys");
      const caps = [...keys.querySelectorAll("kbd")];
      expect(caps.length, `${entry.id} draws one keycap per word of keyWords(entry)`).toBe(keyWords(entry).length);
      for (const cap of caps) expect(text(cap).length, `${entry.id}'s keycaps each say something`).toBeGreaterThan(0);
    }
  });

  test("AC-4: the palette's footer control opens the same sheet", async () => {
    const { body } = await stageHost();
    const dialog = await openPalette(body);
    const footer = within(dialog).getByRole("button", { name: (accessibleName: string) => accessibleName.includes(copy("command_palette_footer_shortcuts")) });

    await userEvent.setup().click(footer);
    await waitFor(() => expect(one(body, "shortcut-sheet").getAttribute("role")).toBe("dialog"));
  });

  test("AC-4: the palette's shortcuts group holds one item per roster entry", async () => {
    const { SHORTCUTS } = await roster();
    const { body } = await stageHost();
    await openPalette(body);

    const shortcuts = group(body, "shortcuts");
    expect(shortcuts, "a blank query lists the shortcuts group (Decision §2)").not.toBeNull();
    const items = all(shortcuts as HTMLElement, "command-palette-item");
    expect(
      items.map((item) => item.getAttribute("data-shortcut")).sort(),
      "one row per roster entry, and no row for a binding the roster does not name",
    ).toEqual(SHORTCUTS.map((entry) => entry.id).sort());
    for (const item of items) expect(item.getAttribute("data-kind"), "each is kinded as the shortcut it stands for").toBe("shortcut");
  });
});

describe("AC-4 — a go chord is driven from the roster, and never from inside a text field", () => {
  test("AC-4: the keys of `go-projects` reach the workspace's projects home", async () => {
    const { shortcutById, matchesStep, CHORD_TIMEOUT_MS } = await roster();
    expect(typeof CHORD_TIMEOUT_MS === "number" && CHORD_TIMEOUT_MS > 0, "a sequence's window is stated once, in the roster's home").toBe(true);

    const { navigation } = await stageHost({ projectId: null });
    pressSteps(shortcutById("go-projects").keys, matchesStep, document.body);

    await waitFor(() =>
      expect(navigation.hrefs, "G then P leads to the workspace's projects home, by the address home that owns it").toEqual([shellHref(TENANT, "projects")]),
    );
  });

  test("AC-4: inside a project, the keys of `go-drawings` reach that project's drawings", async () => {
    const routes = await routeBuilders();
    const { shortcutById, matchesStep } = await roster();

    const { navigation } = await stageHost({ projectId: PROJECT });
    pressSteps(shortcutById("go-drawings").keys, matchesStep, document.body);

    await waitFor(() => expect(navigation.hrefs, "G then D leads to this project's drawings").toEqual([routes.drawingsRoute(TENANT, PROJECT)]));
  });

  test("AC-4: the same keys typed into a text field navigate nowhere, and open nothing", async () => {
    const { shortcutById, matchesStep } = await roster();
    const { body, navigation } = await stageHost({
      projectId: PROJECT,
      children: createElement("input", { "data-testid": "stage-text-field", type: "text" }),
    });

    const field = one(body, "stage-text-field") as HTMLInputElement;
    field.focus();
    expect(document.activeElement, "the case begins with focus in a text field").toBe(field);

    pressSteps(shortcutById("go-drawings").keys, matchesStep, field);
    press(eventForStep("?", matchesStep), field);

    await waitFor(() => expect(navigation.hrefs, "a go chord typed into a field is text, never a move (Decision §1)").toEqual([]));
    expect(all(body, "shortcut-sheet").length, "…and `?` typed into a field is a question mark, not the sheet").toBe(0);
    expect(all(body, "command-palette").length, "…and nothing else opened either").toBe(0);
  });
});
