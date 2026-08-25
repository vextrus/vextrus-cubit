// @vitest-environment jsdom
/**
 * AC-3 — the focus reticle has ONE home (B-17, R-UI-012).
 *
 * Two halves. The geometry half reads `src/ui/primitives/core/reticle.css` as authored text,
 * because jsdom lays nothing out and the increment's risk notes rule the constants are asserted
 * where they are written. The single-home half is a claim about the tree, so it reads the tree.
 * The behavioural half is observed: whatever Tab reaches must wear the reticle's class.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, within } from "@testing-library/react";
import {
  COPY,
  CORE_DIR,
  RETICLE_CLASS,
  RETICLE_CSS,
  cssRules,
  declarations,
  requireCoreFiles,
  keyboardUser,
  loadBarrel,
  readRepoFile,
  productSrcFiles,
  tabOrder,
  varRefs,
} from "./support/primitives";
import { composition, mount } from "./support/render";

/** Any focus-state selector, in any of CSS's spellings. */
const FOCUS_SELECTOR = /:focus(-visible|-within)?\b/;

afterEach(() => {
  cleanup();
});

describe("AC-3: reticle.css is the reticle's only home (B-17)", () => {
  test("AC-3: no other stylesheet in src/ declares focus-indicator styling", () => {
    readRepoFile(RETICLE_CSS); // the home itself must exist before "only home" means anything
    const offenders: string[] = [];
    for (const file of productSrcFiles().filter((f) => f.endsWith(".css") && f !== RETICLE_CSS)) {
      for (const rule of cssRules(readRepoFile(file))) {
        if (FOCUS_SELECTOR.test(rule.selector) || rule.selector.includes(RETICLE_CLASS)) {
          offenders.push(`${file} { ${rule.selector} }`);
          continue;
        }
        for (const { prop } of declarations(rule.body)) {
          if (prop === "outline" || prop.startsWith("outline-")) offenders.push(`${file} { ${rule.selector} } ${prop}`);
        }
      }
    }
    expect(
      offenders,
      `B-17: the focus reticle exists exactly once — ${RETICLE_CSS} — and no other stylesheet in src/ re-declares a focus indicator`,
    ).toEqual([]);
  });

  test("AC-3: no component module under src/ui/primitives/core re-declares focus styling", () => {
    const offenders: string[] = [];
    for (const file of requireCoreFiles().filter((f) => /\.(ts|tsx|mts)$/.test(f))) {
      const text = readRepoFile(file);
      if (/focus-visible|focus-within/.test(text)) offenders.push(`${file}: a focus-state style`);
      if (/\boutline(-[a-z]+)?\s*:/.test(text)) offenders.push(`${file}: an outline declaration`);
    }
    expect(offenders, `B-17: nothing under ${CORE_DIR} re-declares a focus indicator — it lives solely in ${RETICLE_CSS}`).toEqual([]);
  });
});

describe("AC-3: the reticle as authored (R-UI-012)", () => {
  test("AC-3: draws on focus-visible over var(--motion-reticle) with an ease-out curve", () => {
    const css = readRepoFile(RETICLE_CSS);
    const rules = cssRules(css);
    const focusRules = rules.filter((r) => FOCUS_SELECTOR.test(r.selector) && r.selector.includes(RETICLE_CLASS));
    expect(focusRules.length, `${RETICLE_CSS} must draw the reticle on .${RETICLE_CLASS}:focus-visible`).toBeGreaterThan(0);
    expect(
      varRefs(css),
      "R-UI-012: the reticle draws over the reticle motion token (120 ms, zeroed at source under reduced motion)",
    ).toContain("--motion-reticle");
    expect(
      /var\(\s*--ease\s*\)|ease-out/.test(css),
      "R-UI-012: the draw is ease-out — var(--ease) is the token that carries the curve",
    ).toBe(true);
  });

  test("AC-3: four corner ticks, 2px beam stroke, 8px arms, 4px outside the box", () => {
    const css = readRepoFile(RETICLE_CSS);
    const arms = css.match(/\b8px\b/g) ?? [];
    expect(
      arms.length,
      "R-UI-012: four corner ticks with 8 px arms — each corner is authored, so 8px appears once per arm",
    ).toBeGreaterThanOrEqual(4);
    expect(/\b2px\b/.test(css), "R-UI-012: the beam stroke is 2 px").toBe(true);
    expect(
      /-4px|\b4px\b/.test(css),
      "R-UI-012: the reticle sits 4 px outside the element's box (an inset of -4px, or an offset of 4px)",
    ).toBe(true);
  });

  test("AC-3: carries the documented 2px-beam-outline-at-2px-offset fallback", () => {
    const fallbacks = cssRules(readRepoFile(RETICLE_CSS)).filter((rule) => {
      const decls = declarations(rule.body);
      const outline = decls.find((d) => d.prop === "outline" || d.prop === "outline-color" || d.prop === "outline-width");
      const offset = decls.find((d) => d.prop === "outline-offset");
      return (
        outline !== undefined &&
        offset !== undefined &&
        /\b2px\b/.test(outline.value) &&
        outline.value.includes("var(--") &&
        /\b2px\b/.test(offset.value)
      );
    });
    expect(
      fallbacks.map((r) => r.selector),
      "R-UI-012: where corner ticks cannot render the fallback is a 2 px beam outline at 2 px offset — it is documented in reticle.css, not left to the UA",
    ).not.toEqual([]);
  });

  test("AC-3: a prefers-reduced-motion branch makes the draw instant", () => {
    const reduced = cssRules(readRepoFile(RETICLE_CSS)).filter(
      (rule) => /prefers-reduced-motion\s*:\s*reduce/.test(rule.selector) && !rule.body.includes("{"),
    );
    expect(reduced.map((r) => r.selector), `${RETICLE_CSS} carries no prefers-reduced-motion branch (R-UI-012, R-UI-004)`).not.toEqual([]);
    const instant = reduced.some((rule) =>
      declarations(rule.body).some(
        ({ prop, value }) =>
          (prop === "animation" || prop.startsWith("animation-") || prop === "transition" || prop.startsWith("transition-")) &&
          (value === "none" || /\b0m?s\b/.test(value)),
      ),
    );
    expect(instant, "R-UI-012: under prefers-reduced-motion the reticle appears instantly — the branch must zero or drop the draw").toBe(true);
  });
});

describe("AC-3: every focusable primitive wears the reticle", () => {
  test("AC-3: Button, Input, Textarea, an interactive Chip and the Tooltip trigger carry cx-reticle", async () => {
    const mod = await loadBarrel();
    const user = await keyboardUser("AC-3");
    const container = mount(composition(mod));
    const queries = within(container);

    const named: [string, Element][] = [
      ["Button", queries.getAllByRole("button", { name: COPY.primary })[0] as Element],
      ["Input", queries.getByLabelText(COPY.inputLabel)],
      ["Textarea", queries.getByLabelText(COPY.textareaLabel)],
      ["an interactive Chip", queries.getByRole("button", { name: COPY.chip })],
      ["the Tooltip trigger", queries.getByRole("button", { name: COPY.tooltipTrigger })],
    ];
    for (const [what, element] of named) {
      expect(
        element.classList.contains(RETICLE_CLASS),
        `R-UI-012 + B-17: ${what} must carry class ${RETICLE_CLASS} — a visible focus indicator is never optional`,
      ).toBe(true);
    }

    // Derived, not declared: whatever Tab actually reaches in the composition wears the reticle.
    const reached = await tabOrder(user);
    expect(reached.length, "Tab reached nothing in the composition — the keyboard check would be vacuous").toBeGreaterThan(0);
    const bare = reached.filter((element) => !element.classList.contains(RETICLE_CLASS)).map((element) => element.outerHTML.slice(0, 120));
    expect(bare, `R-UI-012: every element the keyboard reaches carries class ${RETICLE_CLASS}`).toEqual([]);
  });
});
