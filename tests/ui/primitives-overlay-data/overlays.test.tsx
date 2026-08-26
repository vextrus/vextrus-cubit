// @vitest-environment jsdom
/**
 * AC-2 / AC-3 — Dialog, Sheet, Popover, DropdownMenu and ContextMenu, observed the way Q-11 asks:
 * the journey begins on the keyboard (Tab travel reaches the trigger), activation is a keyboard
 * gesture, and the response is read as roles, aria state and focus destination — never as a count
 * of painted nodes.
 *
 * Portalling is asserted as the thing it is: the content lives under `document.body` and OUTSIDE
 * the container it was rendered into, which is what lets the root `[data-theme]` theme it and what
 * stops an ancestor's overflow clipping it (Design Decision §1).
 */
import * as React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import type { Barrels, KeyboardUser } from "./support/primitives";
import {
  COPY,
  TESTIDS,
  accessibleName,
  byTestId,
  keyboardActivate,
  keyboardUser,
  loadBarrels,
  openContextMenu,
  ov,
  requireTestId,
  textOf,
  triggerByCopy,
} from "./support/primitives";
import { mount, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

const dialogTree = (b: Barrels): React.ReactElement =>
  ov(
    b,
    "Dialog",
    {},
    ov(b, "DialogTrigger", {}, COPY.dialogTrigger),
    ov(
      b,
      "DialogContent",
      {},
      ov(b, "DialogTitle", {}, COPY.dialogTitle),
      React.createElement("p", null, COPY.dialogBody),
      ov(b, "DialogClose", { "aria-label": COPY.dialogClose }),
    ),
  );

const sheetTree = (b: Barrels, side?: "left" | "right"): React.ReactElement =>
  ov(
    b,
    "Sheet",
    {},
    ov(b, "SheetTrigger", {}, COPY.sheetTrigger),
    ov(
      b,
      "SheetContent",
      side ? { "aria-label": COPY.sheetLabel, side } : { "aria-label": COPY.sheetLabel },
      React.createElement("h2", null, COPY.sheetHeading),
      React.createElement("p", null, COPY.sheetBody),
    ),
  );

const waitForTestId = async (id: string, what: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(byTestId(document.body, id), what).toBeTruthy();
  });
  return requireTestId(document.body, id, what);
};

const waitForGone = async (id: string, what: string): Promise<void> => {
  await waitFor(() => {
    expect(byTestId(document.body, id), what).toBeNull();
  });
};

/** Tab travel to the named trigger, then Enter — the opening gesture AC-2/AC-3 require. */
async function openFromKeyboard(
  container: HTMLElement,
  user: KeyboardUser,
  copy: string,
  id: string,
): Promise<{ trigger: Element; content: HTMLElement }> {
  const trigger = triggerByCopy(copy);
  expect(container.contains(trigger), `the \`${copy}\` trigger is not in the mounted tree`).toBe(true);
  await keyboardActivate(user, trigger, `the \`${copy}\` trigger`);
  const content = await waitForTestId(id, `keyboard activation of \`${copy}\` did not open [data-testid="${id}"]`);
  return { trigger, content };
}

const assertPortalled = (container: HTMLElement, content: Element, what: string): void => {
  expect(document.body.contains(content), `${what} is not in the document`).toBe(true);
  expect(
    container.contains(content),
    `${what} renders inside its consumer's subtree — Design Decision §1: overlay content portals to document.body so the root [data-theme] themes it and no ancestor can clip it`,
  ).toBe(false);
};

describe("AC-2: Dialog", () => {
  test("AC-2: Tab reaches the trigger, Enter opens a named modal dialog portalled to document.body", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-2 Dialog");
    const container = mount(dialogTree(b));

    const { content } = await openFromKeyboard(container, user, COPY.dialogTrigger, TESTIDS.dialogContent);

    expect(content.getAttribute("role"), "AC-2: dialog-content carries role=\"dialog\"").toBe("dialog");
    expect(content.getAttribute("aria-modal"), "AC-2: dialog-content carries aria-modal=\"true\"").toBe("true");
    assertPortalled(container, content, "dialog-content");
    expect(
      accessibleName(content),
      "AC-2: DialogContent requires an accessible name — its DialogTitle or an aria-label (Design Decision §1)",
    ).not.toBe("");
    await waitFor(() => {
      expect(
        content.contains(document.activeElement),
        "AC-2: opening moves focus into the dialog",
      ).toBe(true);
    });
  });

  test("AC-2: Escape closes the dialog and returns focus to the trigger", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-2 Dialog escape");
    const container = mount(dialogTree(b));

    const { trigger } = await openFromKeyboard(container, user, COPY.dialogTrigger, TESTIDS.dialogContent);
    await user.keyboard("{Escape}");

    await waitForGone(TESTIDS.dialogContent, "AC-2: Escape closes the dialog");
    await waitFor(() => {
      expect(document.activeElement, "AC-2: closing returns focus to the trigger").toBe(trigger);
    });
  });
});

describe("AC-2: Sheet", () => {
  test("AC-2: Enter opens a named modal side panel portalled to document.body, defaulting to the right", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-2 Sheet");
    const container = mount(sheetTree(b));

    const { content } = await openFromKeyboard(container, user, COPY.sheetTrigger, TESTIDS.sheetContent);

    expect(content.getAttribute("role"), "AC-2: sheet-content carries role=\"dialog\"").toBe("dialog");
    expect(content.getAttribute("aria-modal"), "AC-2: sheet-content carries aria-modal=\"true\"").toBe("true");
    assertPortalled(container, content, "sheet-content");
    expect(accessibleName(content), "AC-2: SheetContent exports no title part, so it requires an aria-label").toBe(
      COPY.sheetLabel,
    );
    expect(
      content.getAttribute("data-side"),
      'AC-2: side defaults to "right" and is reflected as data-side',
    ).toBe("right");
    await waitFor(() => {
      expect(content.contains(document.activeElement), "AC-2: opening moves focus into the sheet").toBe(true);
    });
  });

  test("AC-2: side=\"left\" is reflected as data-side, and Escape closes returning focus", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-2 Sheet side");
    const container = mount(sheetTree(b, "left"));

    const { trigger, content } = await openFromKeyboard(container, user, COPY.sheetTrigger, TESTIDS.sheetContent);
    expect(content.getAttribute("data-side"), 'AC-2: side="left" is reflected as data-side').toBe("left");

    await user.keyboard("{Escape}");
    await waitForGone(TESTIDS.sheetContent, "AC-2: Escape closes the sheet");
    await waitFor(() => {
      expect(document.activeElement, "AC-2: closing returns focus to the trigger").toBe(trigger);
    });
  });
});

describe("AC-3: DropdownMenu", () => {
  test("AC-3: arrows move the active menuitem; Enter invokes exactly that item once and closes", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-3 DropdownMenu");
    const spies = new Map(COPY.dropdownItems.map((label) => [label, vi.fn()]));

    const container = mount(
      ov(
        b,
        "DropdownMenu",
        {},
        ov(b, "DropdownMenuTrigger", {}, COPY.dropdownTrigger),
        ov(
          b,
          "DropdownMenuContent",
          {},
          ...COPY.dropdownItems.map((label) =>
            ov(b, "DropdownMenuItem", { key: label, onSelect: spies.get(label) }, label),
          ),
        ),
      ),
    );

    const { trigger, content } = await openFromKeyboard(
      container,
      user,
      COPY.dropdownTrigger,
      TESTIDS.dropdownContent,
    );
    expect(content.getAttribute("role"), "AC-3: dropdown-content carries role=\"menu\"").toBe("menu");
    assertPortalled(container, content, "dropdown-content");

    const isMenuItem = (node: Element | null): boolean => node?.getAttribute("role") === "menuitem";
    await waitFor(() => {
      expect(
        isMenuItem(document.activeElement),
        "AC-3: opening a menu from the keyboard puts the active state on a role=\"menuitem\"",
      ).toBe(true);
    });
    const first = document.activeElement as HTMLElement;

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(document.activeElement, "AC-3: ArrowDown moves the active menuitem").not.toBe(first);
    });
    expect(isMenuItem(document.activeElement), "AC-3: ArrowDown lands on another menuitem").toBe(true);

    await user.keyboard("{ArrowUp}");
    await waitFor(() => {
      expect(document.activeElement, "AC-3: ArrowUp moves the active menuitem back").toBe(first);
    });

    const chosen = textOf(document.activeElement);
    expect(spies.has(chosen), `the active menuitem reads \`${chosen}\`, which is not one of the declared items`).toBe(true);

    await user.keyboard("{Enter}");
    await waitForGone(TESTIDS.dropdownContent, "AC-3: Enter closes the menu");

    for (const [label, spy] of spies) {
      expect(
        spy.mock.calls.length,
        `AC-3: Enter invokes the ACTIVE item's onSelect exactly once — \`${label}\` was called ${spy.mock.calls.length} time(s), active was \`${chosen}\``,
      ).toBe(label === chosen ? 1 : 0);
    }
    await waitFor(() => {
      expect(document.activeElement, "AC-3: closing the menu returns focus to the trigger").toBe(trigger);
    });
  });
});

describe("AC-3: ContextMenu", () => {
  test("AC-3: a contextmenu event on the trigger opens a portalled role=\"menu\"", async () => {
    const b = await loadBarrels();
    const container = mount(
      ov(
        b,
        "ContextMenu",
        {},
        ov(b, "ContextMenuTrigger", {}, COPY.contextTrigger),
        ov(
          b,
          "ContextMenuContent",
          {},
          ...COPY.contextItems.map((label) => ov(b, "ContextMenuItem", { key: label }, label)),
        ),
      ),
    );

    expect(byTestId(document.body, TESTIDS.contextmenuContent), "AC-3: the context menu starts closed").toBeNull();
    await openContextMenu(triggerByCopy(COPY.contextTrigger));

    const content = await waitForTestId(
      TESTIDS.contextmenuContent,
      "AC-3: a contextmenu event on the trigger opens contextmenu-content",
    );
    expect(content.getAttribute("role"), "AC-3: contextmenu-content carries role=\"menu\"").toBe("menu");
    assertPortalled(container, content, "contextmenu-content");
    expect(
      content.querySelectorAll('[role="menuitem"]').length,
      "AC-3: the context menu renders its items as role=\"menuitem\"",
    ).toBe(COPY.contextItems.length);
  });
});

describe("AC-3: Popover", () => {
  test("AC-3: trigger activation toggles popover-content; Escape closes it and returns focus", async () => {
    const b = await loadBarrels();
    const user = await keyboardUser("AC-3 Popover");
    const container = mount(
      ov(
        b,
        "Popover",
        {},
        ov(b, "PopoverTrigger", {}, COPY.popoverTrigger),
        ov(b, "PopoverContent", {}, COPY.popoverBody),
      ),
    );

    expect(byTestId(document.body, TESTIDS.popoverContent), "AC-3: the popover starts closed").toBeNull();
    const { trigger, content } = await openFromKeyboard(
      container,
      user,
      COPY.popoverTrigger,
      TESTIDS.popoverContent,
    );
    assertPortalled(container, content, "popover-content");
    expect(textOf(content), "AC-3: the popover shows the content its consumer passed").toContain(COPY.popoverBody);

    // The journey began on the keyboard; the trigger is re-focused here only so the second
    // activation is a keyboard gesture on it rather than a click on a focused element (Q-11).
    (trigger as HTMLElement).focus();
    await user.keyboard("{Enter}");
    await waitForGone(TESTIDS.popoverContent, "AC-3: activating the trigger again toggles the popover closed");

    await user.keyboard("{Enter}");
    await waitForTestId(TESTIDS.popoverContent, "AC-3: activating the trigger opens the popover again");
    await user.keyboard("{Escape}");
    await waitForGone(TESTIDS.popoverContent, "AC-3: Escape closes the popover");
    await waitFor(() => {
      expect(document.activeElement, "AC-3: closing returns focus to the trigger").toBe(trigger);
    });
  });
});
