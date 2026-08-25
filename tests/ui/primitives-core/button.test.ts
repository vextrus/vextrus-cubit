// @vitest-environment jsdom
/**
 * AC-2 — Button's variants, the act variant's copper dot and its three act tokens, and the loading
 * state (R-UI-010, R-UI-004, Q-11).
 *
 * jsdom lays nothing out, so the 7 px dot is read where it is authored — the primitives stylesheet
 * — exactly as the increment's risk notes rule. Everything else is behaviour.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, within } from "@testing-library/react";
import {
  BUTTON_VARIANTS,
  COPY,
  CORE_DIR,
  DEFAULT_VARIANT,
  TESTIDS,
  cssRules,
  declarations,
  keyboardUser,
  loadBarrel,
  paletteColourTokens,
  primitiveStylesheets,
  readRepoFile,
  tabTo,
  varRefs,
} from "./support/primitives";
import { el, mount } from "./support/render";

/** The act variant's three tokens (R-UI-010, verbatim): the only colours act rules may read. */
const ACT_TOKENS = ["--act-surface", "--act-500", "--act-600"];

/** A rule that styles the act variant or its dot. Variants select on `data-variant` (Decision §1). */
const isActRule = (selector: string): boolean => /act-dot/.test(selector) || /variant\s*[~|^$*]?=\s*["']?act["']?/.test(selector);

afterEach(() => {
  cleanup();
});

describe("AC-2: Button variants and the act dot", () => {
  test("AC-2: renders a native <button> and defaults to the primary variant", async () => {
    const mod = await loadBarrel();
    const container = mount(el(mod, "Button", {}, COPY.primary));
    const button = container.querySelector("button");
    expect(button, "Button must render a native <button> (interfaces line)").not.toBeNull();
    expect(
      button?.getAttribute("data-variant"),
      "a Button given no variant is the primary variant (interfaces line: default 'primary')",
    ).toBe(DEFAULT_VARIANT);
  });

  test("AC-2: every declared variant renders, and only act wears the copper dot", async () => {
    const mod = await loadBarrel();
    for (const variant of BUTTON_VARIANTS) {
      const container = mount(el(mod, "Button", { variant }, COPY[variant]));
      const button = container.querySelector("button");
      expect(button?.getAttribute("data-variant"), `Button variant=${variant} must report itself as ${variant}`).toBe(variant);
      const dots = within(container).queryAllByTestId(TESTIDS.actDot);
      expect(
        dots.length,
        `R-UI-010: the 7 px copper dot belongs to the act variant and to no other — variant=${variant} rendered ${dots.length} of them`,
      ).toBe(variant === "act" ? 1 : 0);
      if (variant === "act") {
        expect(button?.contains(dots[0] ?? null), "the act dot is rendered inside the act button").toBe(true);
      }
      cleanup();
    }
  });
});

describe("AC-2: the act variant's authored CSS (R-UI-010)", () => {
  test("AC-2: act rules read only the three act tokens", () => {
    const palette = paletteColourTokens();
    const seen = new Set<string>();
    const foreign: string[] = [];
    let actRules = 0;
    for (const file of primitiveStylesheets()) {
      for (const rule of cssRules(readRepoFile(file))) {
        if (!isActRule(rule.selector)) continue;
        if (rule.body.includes("{")) continue;
        actRules += 1;
        for (const name of varRefs(rule.body)) {
          if (!palette.has(name)) continue; // composite tokens (--shadow-…) carry no palette colour
          if (ACT_TOKENS.includes(name)) seen.add(name);
          else foreign.push(`${file} { ${rule.selector} } var(${name})`);
        }
      }
    }
    expect(actRules, `no rule under ${CORE_DIR} styles the act variant or its dot`).toBeGreaterThan(0);
    expect(foreign, "R-UI-010: the act variant is act-surface fill, act-500 border and act-600 text — no other colour").toEqual([]);
    expect([...seen].sort(), "R-UI-010 names all three act tokens; act's rules must read all three").toEqual([...ACT_TOKENS].sort());
  });

  test("AC-2: the act dot is authored at 7px square", () => {
    const sizes = new Map<string, string>();
    for (const file of primitiveStylesheets()) {
      for (const rule of cssRules(readRepoFile(file))) {
        if (!/act-dot/.test(rule.selector)) continue;
        for (const { prop, value } of declarations(rule.body)) {
          if (["width", "inline-size", "height", "block-size"].includes(prop)) sizes.set(prop, value);
        }
      }
    }
    const width = sizes.get("width") ?? sizes.get("inline-size");
    const height = sizes.get("height") ?? sizes.get("block-size");
    expect(width, `R-UI-010: the act dot is authored 7 px wide in the ${CORE_DIR} stylesheet`).toBe("7px");
    expect(height, `R-UI-010: the act dot is authored 7 px tall in the ${CORE_DIR} stylesheet`).toBe("7px");
  });
});

describe("AC-2: the loading Button (Design Decision §3, Q-11)", () => {
  test("AC-2: announces busy, keeps its accessible name, and refuses keyboard activation", async () => {
    const mod = await loadBarrel();
    const user = await keyboardUser("AC-2");

    // Control: an ordinary Button IS activated by the keyboard, so the loading leg below cannot
    // pass vacuously.
    let restingClicks = 0;
    const resting = mount(el(mod, "Button", { onClick: () => { restingClicks += 1; } }, COPY.primary));
    const restingButton = within(resting).getByRole("button", { name: COPY.primary });
    await tabTo(user, restingButton, "an ordinary Button");
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(restingClicks, "control: Enter and Space activate an ordinary Button").toBeGreaterThan(0);
    cleanup();

    let loadingClicks = 0;
    const container = mount(el(mod, "Button", { loading: true, onClick: () => { loadingClicks += 1; } }, COPY.primary));
    const button = within(container).getByRole("button", { name: COPY.primary });
    expect(button.getAttribute("aria-busy"), "a loading Button announces busy state (Design Decision §3)").toBe("true");
    expect(button.getAttribute("data-loading"), "a loading Button reports data-loading (Design Decision §7)").toBe("true");

    await tabTo(user, button, "a loading Button (it stays focusable — focus is never dropped mid-action, Design Decision §3)");
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(loadingClicks, "a loading Button does not invoke onClick on keyboard activation").toBe(0);
  });
});
