// @vitest-environment jsdom
/**
 * AC-3 — one roster, three readers: the `?` sheet, the palette's shortcut rows and the key handler
 * all take `SHORTCUTS`, so a documented key and a bound key cannot differ (R-UI-032, I-147).
 *
 * Every expectation is derived from the roster the tree publishes, in both directions — no row
 * without an entry, no entry without a row — so the day a twentieth shortcut lands the suite moves
 * with it (B-19). The one written-down list is the clause's own: the shortcuts R-UI-032 names.
 */
import { createElement, type ReactNode } from "react";
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

/**
 * A field of the stage's own, mounted inside the frame beside the top bar. The rule AC-3 states is
 * about the TARGET being editable — "outside a text field" — not about which fields the product
 * happens to ship today, so the case holds the handler to a control it has never heard of (B-19).
 */
const FIELD_LABEL = "a field the reader is typing in";

const editableField = (tag: "input" | "textarea" | "div", extra: Record<string, unknown> = {}): ReactNode =>
  createElement(tag, { "aria-label": FIELD_LABEL, ...extra } as never);

/** The editable hosts the platform gives typed text to — input, textarea, and a contenteditable box. */
const EDITABLE_HOSTS: readonly { readonly what: string; readonly node: ReactNode }[] = [
  { what: "a text input", node: editableField("input", { type: "text" }) },
  { what: "a textarea", node: editableField("textarea") },
  { what: "a contenteditable box", node: editableField("div", { contentEditable: true, suppressContentEditableWarning: true, role: "textbox" }) },
];

/** The stage's field, as it stands on the screen. */
const stageField = (): HTMLElement => {
  const found = document.body.querySelector(`[aria-label="${FIELD_LABEL}"]`);
  expect(found, "the stage's own editable field is on the screen").not.toBeNull();
  return found as HTMLElement;
};

/** What a field says, whichever kind of editable host it is. */
const saidIn = (field: HTMLElement): string => {
  const valued = field as HTMLElement & { value?: unknown };
  return typeof valued.value === "string" ? valued.value : (field.textContent ?? "");
};

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
    }
  });

  test("AC-3: a chord is drawn from the entry's steps — one step per key, the platform's modifier, and no two sequences reading alike", async () => {
    const roster = await rosterModule();
    const drawn = new Map<string, string>();

    for (const entry of roster.SHORTCUTS) {
      const chord = said(roster.chordOf(entry));
      expect(chord.length, `\`${entry.id}\` reads as a chord a person can say (I-149)`).toBeGreaterThan(0);

      // The chord is a display form of the STEPS: the same keys under another id and another label
      // read the same, so nothing about the entry's naming can stand in for the keys it documents.
      const renamed = { ...entry, id: `renamed-${entry.id}`, label: `renamed_${entry.label}` };
      expect(
        said(roster.chordOf(renamed)),
        `\`${entry.id}\`'s chord is drawn from its keys, not from its id or its label (increment interfaces: chordOf is the steps' display form)`,
      ).toBe(chord);

      // A sequence reads as its steps in order, joined by the word the interfaces fix.
      const steps = chord.split(" then ");
      expect(steps.length, `\`${entry.id}\` reads one step per key, joined by " then " (increment interfaces)`).toBe(entry.keys.length);

      for (const [index, key] of entry.keys.entries()) {
        const step = (steps[index] ?? "").toLowerCase();
        const modified = key.toLowerCase().startsWith("mod+");
        const letter = modified ? key.slice(key.indexOf("+") + 1) : key;
        if (modified) {
          expect(
            /⌘|ctrl|control|cmd|command/i.test(step),
            `\`${entry.id}\`'s \`${key}\` step names this platform's command key (increment interfaces: ⌘/Ctrl by platform) — it read "${steps[index] ?? ""}"`,
          ).toBe(true);
        }
        if (letter.length === 1) {
          expect(step, `\`${entry.id}\`'s \`${key}\` step reads the key a person presses — it read "${steps[index] ?? ""}"`).toContain(
            letter.toLowerCase(),
          );
        }
      }

      // Two entries documenting different sequences cannot be documented by the same chord: a
      // reader who saw one would press the other.
      const sequence = entry.keys.join(" ");
      const already = drawn.get(chord);
      expect(
        already === undefined || already === sequence,
        `\`${entry.id}\` (${sequence}) reads as "${chord}", which another entry (${already ?? ""}) already reads as (AC-3)`,
      ).toBe(true);
      drawn.set(chord, sequence);
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

  test("AC-3: `?` inside the palette's own input is a character, not the sheet's key", async () => {
    const frame = await mountFrame();
    const palette = await openPalette(frame);
    const input = one(TESTID.input) as HTMLInputElement;

    // Where a person typing a query has their hands: in the palette's own combobox.
    await frame.user.click(input);
    expect(document.activeElement, "the case types where the reader types (AC-1)").toBe(input);

    await frame.user.keyboard("?");
    await settle();

    expect(maybe(TESTID.sheet), "`?` typed into a text field opens no shortcut sheet over it — AC-3's key is `?` OUTSIDE a text field").toBeNull();
    expect(input.value, "and the character went to the field the reader was typing in (AC-3)").toContain("?");
    expect(all(TESTID.palette).length, "the palette the reader was in is still the only dialog on the screen").toBe(1);
    expect(palette.isConnected, "and it is the same one, not re-opened under the sheet").toBe(true);

    // The same stage, with no field holding focus, DOES open the sheet — so the assertion above is a
    // rule about where focus was and not a stage in which nothing could ever open.
    await frame.user.keyboard("{Escape}");
    await settle();
    expect(maybe(TESTID.palette), "Escape closes the palette (AC-1)").toBeNull();
    await frame.user.keyboard("?");
    await settle();
    expect(maybe(TESTID.sheet), "`?` outside a text field opens the shortcut sheet (AC-3)").not.toBeNull();
  });

  test("AC-3: a global shortcut that is also a character opens nothing while an editable control holds focus", async () => {
    const roster = await rosterModule();

    // Every global entry a reader could type into a field — steps that are bare printable keys,
    // taken from the roster rather than listed here, so a new one is held to the same rule (B-19).
    const typeable = roster.SHORTCUTS.filter(
      (entry) => entry.scope === "global" && entry.keys.every((key) => key.length === 1 && key.trim() === key),
    );
    expect(
      typeable.map((entry) => entry.id),
      "the roster documents `shortcut-sheet` as a bare printable key — AC-3's `?` (increment interfaces)",
    ).toContain("shortcut-sheet");

    for (const host of EDITABLE_HOSTS) {
      const frame = await mountFrame({ children: host.node });
      const field = stageField();
      field.focus();
      expect(document.activeElement, `focus stands in ${host.what}`).toBe(field);

      for (const entry of typeable) {
        const typed = entry.keys.join("");
        const before = saidIn(field);
        await frame.user.keyboard(typed);
        await settle();

        expect(
          maybe(TESTID.sheet),
          `\`${typed}\` (\`${entry.id}\`) typed into ${host.what} opens no shortcut sheet — a global key is not armed while an editable control holds focus (AC-3)`,
        ).toBeNull();
        expect(maybe(TESTID.palette), `\`${typed}\` typed into ${host.what} opens no palette (AC-3)`).toBeNull();
        expect(frame.navigated, `\`${typed}\` typed into ${host.what} takes the reader nowhere (AC-3)`).toEqual([]);
        expect(saidIn(field), `\`${typed}\` landed in ${host.what} as the text the reader meant it to be (AC-3)`).toBe(`${before}${typed}`);
      }

      // And with that field blurred, the very same keys reach the sheet — the guard is about focus.
      field.blur();
      const sheetEntry = roster.SHORTCUTS.find((entry) => entry.id === "shortcut-sheet");
      await frame.user.keyboard((sheetEntry as { keys: readonly string[] }).keys.join(""));
      await settle();
      expect(maybe(TESTID.sheet), `with ${host.what} blurred, the sheet's own key opens it (AC-3)`).not.toBeNull();

      unmountAll();
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
