// @vitest-environment jsdom
/**
 * AC-1 — the trigger the top bar carries, and the chord that opens the palette from anywhere.
 *
 * Everything is judged through the names the increment's test contract and the committed Design
 * Decision publish: the ten test ids, the ARIA the palette states about itself, and the copy keys of
 * the one string table. Nothing here reads product source.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { ShellTopBar } from "../../../src/ui/shell/shell-top-bar";
import { PALETTE_APP_DIR, TENANT, WORKSPACE, all, copy, hostModule, named, one, paletteHostComponent, stageHost } from "./support/palette-stage";

/** The chord AC-1 names, in both its spellings — the two a real keyboard sends. */
const CHORDS = [
  { name: "Meta+K", init: { key: "k", code: "KeyK", metaKey: true } },
  { name: "Control+K", init: { key: "k", code: "KeyK", ctrlKey: true } },
] as const;

/** The bar's own props (`ShellTopBarProps`), fixed once so every mount below is the same bar. */
const TOP_BAR = {
  workspace: WORKSPACE,
  area: "projects" as const,
  atAreaHome: true,
  email: "rafiq@cubit.test",
  signOut: () => undefined,
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** A focusable element of the frame, so "focus returns to where it was" has somewhere to return to. */
const aFocusable = (): ReturnType<typeof createElement> =>
  createElement("button", { type: "button", "data-testid": "stage-focus-holder" }, "elsewhere");

describe("AC-1 — the trigger is the top bar's occupant, and only inside a provider", () => {
  test("AC-1: the bar carries `shell-command-palette` inside a CommandPaletteProvider and none at all outside one", async () => {
    render(createElement(ShellTopBar, TOP_BAR));
    expect(all(document.body, "shell-topbar").length, "the bar itself renders, so the absence below is the trigger's and not the bar's").toBe(1);
    expect(
      all(document.body, "shell-command-palette").length,
      "a bare `ShellTopBar` mount stands exactly as it did: outside a `CommandPaletteProvider` the trigger renders nothing at all (I-135)",
    ).toBe(0);

    cleanup();

    const { body } = await stageHost({ children: createElement(ShellTopBar, TOP_BAR) });
    expect(all(body, "shell-topbar").length, "the same bar, mounted inside the host").toBe(1);
    expect(all(body, "shell-command-palette").length, "inside a provider the bar carries the trigger (AC-1)").toBe(1);
  });

  test("AC-1: the trigger states the door it opens, the keys that open it and its focus reticle", async () => {
    const { body } = await stageHost({ children: createElement(ShellTopBar, TOP_BAR) });
    const trigger = one(body, "shell-command-palette");

    expect(trigger.tagName, "the trigger is a button — a control that opens a dialog").toBe("BUTTON");
    expect(trigger.getAttribute("aria-haspopup"), "…and says what it opens").toBe("dialog");
    expect(trigger.getAttribute("aria-keyshortcuts"), "…and states its keys to assistive technology (I-140)").toBe("Meta+K Control+K");
    expect([...trigger.classList], "…and wears the one focus reticle the tree has (R-UI-012, B-17)").toContain("cx-reticle");
    expect(
      (trigger.textContent ?? "").replace(/\s+/g, " ").trim(),
      "the visible word is the accessible name, and it is the string table's (R-SPINE-060)",
    ).toContain(copy("command_palette_trigger"));
  });
});

describe("AC-1 — the chord opens the palette on its input, from anywhere in the document", () => {
  for (const chord of CHORDS) {
    test(`AC-1: ${chord.name} pressed on the document opens \`command-palette\` with focus in its input`, async () => {
      const { body } = await stageHost({ children: createElement(ShellTopBar, TOP_BAR) });
      expect(all(body, "command-palette").length, "nothing is open before the chord").toBe(0);

      fireEvent.keyDown(document.body, chord.init);

      const dialog = await waitFor(() => one(body, "command-palette"));
      expect(dialog.getAttribute("role"), "the palette is a dialog").toBe("dialog");
      expect(dialog.getAttribute("aria-label"), "…named by the one string table").toBe(copy("command_palette_label"));

      const input = one(body, "command-palette-input");
      await waitFor(() => expect(document.activeElement, "focus opens inside the input (I-137)").toBe(input));
      expect(input.getAttribute("role"), "the input is the combobox WAI-ARIA keeps focus in").toBe("combobox");
      expect(input.getAttribute("aria-expanded"), "…which is expanded while the palette stands").toBe("true");

      const list = one(body, "command-palette-list");
      expect(list.id, "the list carries an id for the input to name").not.toBe("");
      expect(input.getAttribute("aria-controls"), "…and the input names it").toBe(list.id);
    });
  }

  test("AC-1: the chord opens the palette even while focus is inside an `<input>`", async () => {
    const { body } = await stageHost({ children: createElement("input", { "data-testid": "stage-text-field", type: "text" }) });
    const field = one(body, "stage-text-field") as HTMLInputElement;
    field.focus();
    expect(document.activeElement, "the case begins with focus in a text field").toBe(field);

    fireEvent.keyDown(field, CHORDS[0].init);

    await waitFor(() => one(body, "command-palette"));
    await waitFor(() => expect(document.activeElement, "⌘K is honoured inside a text field (Decision §1)").toBe(one(body, "command-palette-input")));
  });
});

describe("AC-1 — the palette closes the way it opened, and gives focus back", () => {
  test("AC-1: pressing the chord again closes it and focus returns to the element that held it", async () => {
    const { body } = await stageHost({ children: aFocusable() });
    const holder = one(body, "stage-focus-holder");
    holder.focus();

    fireEvent.keyDown(holder, CHORDS[0].init);
    await waitFor(() => one(body, "command-palette"));

    fireEvent.keyDown(one(body, "command-palette-input"), CHORDS[0].init);
    await waitFor(() => expect(all(body, "command-palette").length, "the same chord closes the palette").toBe(0));
    await waitFor(() => expect(document.activeElement, "focus returns to the element that held it before opening").toBe(holder));
  });

  test("AC-1: Escape closes it and focus returns to the element that held it", async () => {
    const { body } = await stageHost({ children: aFocusable() });
    const holder = one(body, "stage-focus-holder");
    holder.focus();

    fireEvent.keyDown(holder, CHORDS[0].init);
    await waitFor(() => one(body, "command-palette"));

    fireEvent.keyDown(one(body, "command-palette-input"), { key: "Escape", code: "Escape" });
    await waitFor(() => expect(all(body, "command-palette").length, "Escape closes the palette").toBe(0));
    await waitFor(() => expect(document.activeElement, "…and focus returns to where it was").toBe(holder));
  });

  test("AC-1: the trigger opens the same dialog the chord does", async () => {
    const { body } = await stageHost({ children: createElement(ShellTopBar, TOP_BAR) });
    fireEvent.click(one(body, "shell-command-palette"));
    await waitFor(() => expect(one(body, "command-palette").getAttribute("aria-label")).toBe(copy("command_palette_label")));
  });
});

describe("AC-1 — the host is the app layer's, mounted over the workspace it stands in", () => {
  test("AC-1: `PaletteHost` is published by the palette route directory and takes the workspace it stands in", async () => {
    const host = await paletteHostComponent();
    expect(typeof host, `${PALETTE_APP_DIR}/ publishes \`PaletteHost\``).toBe("function");

    const bag = await hostModule();
    const searchAction = named<unknown>(bag, "searchWorkspaceAction", PALETTE_APP_DIR);
    expect(typeof searchAction, "the app layer normalises the transport into the one envelope the pattern reads (risk note 3)").toBe("function");

    const { body } = await stageHost({ tenantId: TENANT, children: createElement(ShellTopBar, TOP_BAR) });
    expect(all(body, "command-palette").length, "the host mounts closed — a palette is opened by a person, never by a render").toBe(0);
  });
});
