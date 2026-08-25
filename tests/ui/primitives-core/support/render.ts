/**
 * The rendering half of inc-004's acceptance support: the Design Decision §4 composition, built
 * from the barrel's own exports, and the two theme roots every criterion is asserted under.
 *
 * The composition's document order IS the Tab order the Decision fixes, so the same tree serves
 * the keyboard criteria and the axe criteria without a second, divergent fixture.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { expect } from "vitest";
import { BARREL, BASES, COPY, COVERAGE_SAMPLE } from "./primitives";

type AnyComponent = React.ComponentType<Record<string, unknown>>;

/** One element from the barrel, asserting the export is a component before it is used. */
export function el(
  mod: Record<string, unknown>,
  name: string,
  props: Record<string, unknown> = {},
  ...children: React.ReactNode[]
): React.ReactElement {
  const component = mod[name];
  expect(typeof component, `${BARREL} does not export a component named \`${name}\``).toBe("function");
  return React.createElement(component as AnyComponent, props, ...children);
}

/** A no-op handler: `Chip` is interactive only when a consumer passes `onClick` (Decision §3). */
export const noop = (): void => undefined;

/** Sample data for one export, per the Design Decision §4. Every barrel export must have one. */
export function sampleElement(mod: Record<string, unknown>, name: string): React.ReactElement {
  switch (name) {
    case "Button":
      return el(mod, "Button", {}, COPY.primary);
    case "Input":
      return el(mod, "Input", { "aria-label": COPY.inputLabel, placeholder: COPY.inputPlaceholder });
    case "Textarea":
      return el(mod, "Textarea", { "aria-label": COPY.textareaLabel, placeholder: COPY.textareaPlaceholder });
    case "Badge":
      return el(mod, "Badge", {}, COPY.badge);
    case "Chip":
      return el(mod, "Chip", { onClick: noop }, COPY.chip);
    case "BasisChip":
      return el(mod, "BasisChip", { basis: BASES[0] });
    case "CoverageChip":
      return el(mod, "CoverageChip", { value: COVERAGE_SAMPLE });
    case "UnitBadge":
      return el(mod, "UnitBadge", { unit: COPY.unit });
    case "Kbd":
      return el(mod, "Kbd", {}, COPY.kbd);
    case "Skeleton":
      return el(mod, "Skeleton", {});
    case "Tooltip":
      return el(mod, "Tooltip", { content: COPY.tooltip }, el(mod, "Button", { variant: "ghost" }, COPY.tooltipTrigger));
    default:
      return expect.fail(
        `no sample data for the barrel export \`${name}\` — the Design Decision §4 composition must cover every export of ${BARREL}`,
      );
  }
}

/**
 * The Design Decision §4 composition, in the document order the Decision fixes (which is also the
 * Tab order it fixes). Every one of the barrel's primitives appears at least once.
 */
export function composition(mod: Record<string, unknown>): React.ReactElement {
  return React.createElement(
    React.Fragment,
    null,
    el(mod, "Button", {}, COPY.primary),
    el(mod, "Button", { variant: "secondary" }, COPY.secondary),
    el(mod, "Button", { variant: "ghost" }, COPY.ghost),
    el(mod, "Button", { variant: "danger" }, COPY.danger),
    el(mod, "Button", { variant: "act" }, COPY.act),
    el(mod, "Button", { loading: true }, COPY.primary),
    el(mod, "Button", { variant: "secondary", disabled: true }, COPY.secondary),
    el(mod, "Input", { "aria-label": COPY.inputLabel, placeholder: COPY.inputPlaceholder }),
    el(mod, "Textarea", { "aria-label": COPY.textareaLabel, placeholder: COPY.textareaPlaceholder }),
    el(mod, "Badge", {}, COPY.badge),
    el(mod, "Chip", { onClick: noop }, COPY.chip),
    ...BASES.map((basis) => el(mod, "BasisChip", { basis, key: basis })),
    el(mod, "CoverageChip", { value: COVERAGE_SAMPLE }),
    el(mod, "UnitBadge", { unit: COPY.unit }),
    el(mod, "Kbd", {}, COPY.kbd),
    el(mod, "Skeleton", {}),
    el(mod, "Tooltip", { content: COPY.tooltip }, el(mod, "Button", { variant: "ghost" }, COPY.tooltipTrigger)),
  );
}

/**
 * The dark theme is an ancestor attribute and nothing else (interfaces line: the mechanism already
 * in src/ui/theme/globals.css) — so "under the dark theme" is the same tree inside one wrapper.
 */
export function themed(children: React.ReactNode): React.ReactElement {
  return React.createElement("div", { "data-theme": "dark" }, children);
}

/** Render into a fresh container attached to the document, returning that container. */
export function mount(ui: React.ReactElement): HTMLElement {
  return render(ui).container;
}
