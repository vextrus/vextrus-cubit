// @vitest-environment jsdom
/**
 * AC-1 — ⌘K on the signed-in frame: the trigger the top bar holds, the dialog either chord opens,
 * where focus lands, and where it returns (R-SPINE-050, R-UI-012, R-UI-032, shell I-135).
 *
 * Driven from the keyboard, because that is what the clause promises: the palette is opened by a
 * chord, read as a role, and dismissed by Escape. Nothing here reads product source.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  CONTROL_K,
  META_K,
  TESTID,
  all,
  maybe,
  mountBareTopBar,
  mountFrame,
  one,
  openPalette,
  settle,
  unmountAll,
} from "./support/palette-stage";

afterEach(() => {
  unmountAll();
});

/** The two chords AC-1 names, as `aria-keyshortcuts` spells a chord (WAI-ARIA 1.2). */
const KEYSHORTCUTS = ["Meta+K", "Control+K"];

describe("AC-1: the palette opens on ⌘K and closes to where it came from", () => {
  test("AC-1: the top bar holds the trigger, and it says which keys open the palette", async () => {
    await mountFrame();

    const trigger = one(TESTID.trigger);
    const bar = one(TESTID.topBar);
    expect(bar.contains(trigger), `\`${TESTID.trigger}\` stands in the top bar (shell I-135)`).toBe(true);
    expect(trigger.tagName.toLowerCase(), `\`${TESTID.trigger}\` is a button`).toBe("button");
    expect(trigger.getAttribute("aria-haspopup"), "the trigger says it opens a dialog").toBe("dialog");

    const said = (trigger.getAttribute("aria-keyshortcuts") ?? "").split(/\s+/).filter((token) => token.length > 0);
    for (const chord of KEYSHORTCUTS) {
      expect(said, `aria-keyshortcuts names ${chord} (AC-1)`).toContain(chord);
    }
    expect([...trigger.classList], "every interactive element wears the focus reticle (R-UI-012)").toContain("cx-reticle");
  });

  test("AC-1: Meta+K opens the dialog with focus in the combobox, and Escape returns it to the trigger", async () => {
    const frame = await mountFrame();
    const trigger = one(TESTID.trigger);

    const palette = await openPalette(frame, META_K);
    expect(palette.getAttribute("role"), `\`${TESTID.palette}\` is a dialog`).toBe("dialog");

    const input = one(TESTID.input);
    expect(input.getAttribute("role"), `\`${TESTID.input}\` is the combobox (WAI-ARIA, § 1)`).toBe("combobox");
    expect([...input.classList], "focus lives in the input, so the reticle is drawn there (R-UI-012, I-137)").toContain("cx-reticle");
    expect(document.activeElement, "opening the palette puts focus in its input (AC-1)").toBe(input);

    await frame.user.keyboard("{Escape}");
    await settle();
    expect(maybe(TESTID.palette), "Escape closes the palette (AC-1)").toBeNull();
    expect(document.activeElement, "closing returns focus to the trigger it came from (AC-1)").toBe(trigger);
  });

  test("AC-1: Control+K opens it too — the chord is Meta or Control, whichever the machine has", async () => {
    const frame = await mountFrame();
    await openPalette(frame, CONTROL_K);
    expect(document.activeElement, "the Control chord lands focus in the input just as the Meta one does").toBe(one(TESTID.input));
  });

  test("AC-1: activating the trigger opens the same dialog", async () => {
    const frame = await mountFrame();
    const trigger = one(TESTID.trigger);

    trigger.focus();
    await frame.user.keyboard("{Enter}");
    await settle();

    expect(maybe(TESTID.palette), "activating the trigger opens the palette (AC-1)").not.toBeNull();
    expect(document.activeElement, "however it is opened, focus lands in the input").toBe(one(TESTID.input));
  });

  test("AC-1: the trigger is provider-gated — a bare ShellTopBar renders none of it", async () => {
    // Inside the frame the bar holds the trigger …
    await mountFrame();
    expect(all(TESTID.trigger).length, "the frame's bar holds the trigger (AC-1)").toBe(1);
    unmountAll();

    // … and mounted bare, with no CommandPaletteProvider above it, the bar renders nothing of it,
    // which is what keeps the existing bare-mount test and the shell gallery entry standing (I-135).
    const bare = await mountBareTopBar();
    expect(all(TESTID.trigger, bare).length, "a bare ShellTopBar renders no command-palette trigger (AC-1)").toBe(0);
    expect(all(TESTID.trigger).length, "and none anywhere else in the document either").toBe(0);
  });
});
