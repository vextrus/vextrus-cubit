// @vitest-environment jsdom
/**
 * Public acceptance for AC-3 of inc-014-density-prefs: `DensityToggle` as a radiogroup
 * (R-UI-005, R-UI-012, Q-11, docs/design/density-and-prefs.md §1).
 *
 * The control is observed through what the increment declares: the `src/ui/shell` barrel's export,
 * the three test ids of the test contract, the `aria-*` hooks the Design Decision fixes, and the
 * copy — read from the strings table's own object, never spelled here, so the Design Decision's
 * wording is the single source and this file cannot drift from it (§3, §7).
 *
 * jsdom lays nothing out and resolves no `var()`, so nothing here grades paint. The reticle is
 * asserted the only way a unit lane honestly can: the option wears the one focus class the tree has
 * (B-17, `cx-reticle` from its single home) — its geometry is graded where it is authored.
 *
 * The last block is graded by `tsc`, not by the runner: "the toggle's Density, the seam's Density
 * and DataTableDensity are one type" is a claim no runtime observation can see. The seam is named
 * in TYPE POSITION only, so the transform erases it and the runtime cases still fail as assertions
 * naming the missing module rather than dying at import resolution.
 *
 * NOTE FOR THE BUILDER: product modules are loaded here by absolute path, so the `@/*` tsconfig
 * alias is never resolved for the specifiers inside them either. Keep imports between src/ files
 * relative.
 */
import { createElement, type ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { productModule } from "../../server/support/wire";

/* ------------------------------------------------------------------ the declared homes */

const SHELL_BARREL = "src/ui/shell/index.ts";
const SHELL_STRINGS = "src/ui/strings/shell.ts";

/** The test contract's three ids, and nothing else is reached for. */
const TOGGLE_TESTID = "density-toggle";
const OPTION_TESTID: Readonly<Record<string, string>> = {
  comfortable: "density-option-comfortable",
  compact: "density-option-compact",
};

/** The strings key that names each part of the control (test contract; copy fixed by §3). */
const LABEL_KEY = "shell_density_label";
const OPTION_KEY: Readonly<Record<string, string>> = {
  comfortable: "shell_density_comfortable",
  compact: "shell_density_compact",
};

/** R-UI-005's two modes, in the order the test contract fixes. */
const MODES = ["comfortable", "compact"] as const;
type Mode = (typeof MODES)[number];

/** The other one — with two modes, "activate the option that is not checked" is total. */
const other = (mode: Mode): Mode => (mode === "comfortable" ? "compact" : "comfortable");

/** The one focus class the tree has, from its single home (B-17, R-UI-012). */
const RETICLE_CLASS = "cx-reticle";

/* ------------------------------------------------------------------ the product, as declared */

type AnyComponent = (props: Record<string, unknown>) => unknown;

let Toggle: AnyComponent;
let copy: Record<string, string>;

/**
 * Lazy and memoised rather than a hook: a throwing `beforeAll` leaves every case reported as one
 * that never ran, and a criterion nothing ran for is a criterion nothing judged.
 */
let loading: Promise<void> | undefined;
const load = (): Promise<void> =>
  (loading ??= (async () => {
    const barrel = await productModule<Record<string, unknown>>(SHELL_BARREL);
    expect(
      typeof barrel["DensityToggle"],
      `${SHELL_BARREL} must export DensityToggle — the interfaces line makes the shell barrel its only home`,
    ).toBe("function");
    Toggle = barrel["DensityToggle"] as AnyComponent;

    const strings = await productModule<Record<string, unknown>>(SHELL_STRINGS);
    const table = strings["shell"];
    expect(typeof table, `${SHELL_STRINGS} must export the shell string table`).toBe("object");
    copy = table as Record<string, string>;
    for (const key of [LABEL_KEY, ...Object.values(OPTION_KEY)]) {
      expect(
        typeof copy[key],
        `${SHELL_STRINGS} must carry ${key} — the Design Decision §3 fixes this control's copy there, and the JSX may spell no string of its own (R-SPINE-060)`,
      ).toBe("string");
      expect(copy[key], `${key} must not be empty — a control with no name is not a named control (R-UI-012)`).not.toBe("");
    }
  })());

afterEach(() => {
  cleanup();
});

interface Mounted {
  container: HTMLElement;
  action: ReturnType<typeof vi.fn>;
  group: HTMLElement;
  option: (mode: Mode) => HTMLElement;
}

/** The control as its one consumer mounts it: a stored mode in, an action to write the next one. */
async function mount(density: Mode): Promise<Mounted> {
  await load();
  const action = vi.fn(() => Promise.resolve());
  const element = createElement(Toggle as unknown as (props: { density: Mode; action: (next: Mode) => Promise<void> }) => ReactElement, {
    density,
    action: action as unknown as (next: Mode) => Promise<void>,
  });
  const { container } = render(element);
  const group = container.querySelector(`[data-testid="${TOGGLE_TESTID}"]`);
  expect(group, `DensityToggle must render its radiogroup as [data-testid="${TOGGLE_TESTID}"] (test contract)`).not.toBeNull();
  return {
    container,
    action,
    group: group as HTMLElement,
    option: (mode: Mode): HTMLElement => {
      const found = container.querySelector(`[data-testid="${OPTION_TESTID[mode]}"]`);
      expect(found, `DensityToggle must render the ${mode} option as [data-testid="${OPTION_TESTID[mode]}"] (test contract)`).not.toBeNull();
      return found as HTMLElement;
    },
  };
}

/** A keyboard, or a loud statement that the declared dependency it needs is not installed. */
async function keyboardUser(criterion: string): Promise<{ tab: () => Promise<void>; keyboard: (keys: string) => Promise<void>; click: (el: Element) => Promise<void> }> {
  const specifier = "@testing-library/user-event";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — ${criterion} (${String(cause)})`);
  });
  const bag = mod as { default?: { setup: (o: object) => unknown }; setup?: (o: object) => unknown };
  const setup = bag.default?.setup ?? bag.setup;
  expect(typeof setup, `${specifier} exposes no setup()`).toBe("function");
  const owner = bag.default ?? bag;
  return (setup as (o: object) => unknown).call(owner, {}) as {
    tab: () => Promise<void>;
    keyboard: (keys: string) => Promise<void>;
    click: (el: Element) => Promise<void>;
  };
}

/* ------------------------------------------------------------------ AC-3, at run time */

describe("AC-3: DensityToggle is a named radiogroup of exactly the two modes", () => {
  test("AC-3: the group and its two options carry the contract's ids and the radiogroup roles", async () => {
    const view = await mount("comfortable");
    expect(view.group.getAttribute("role"), `${TOGGLE_TESTID} must be a radiogroup — membership of an exclusive set is what a density is (Decision I-31)`).toBe("radiogroup");
    for (const mode of MODES) {
      const option = view.option(mode);
      expect(option.getAttribute("role"), `${OPTION_TESTID[mode]} must be a radio inside the group`).toBe("radio");
      expect(view.group.contains(option), `${OPTION_TESTID[mode]} must live inside ${TOGGLE_TESTID}`).toBe(true);
    }
    expect(
      view.group.querySelectorAll('[role="radio"]').length,
      "the group offers exactly the two modes R-UI-005 names — a third option would be a mode the store cannot hold",
    ).toBe(MODES.length);
  });

  test("AC-3: the group and both options are named from the strings table", async () => {
    const view = await mount("comfortable");
    expect(
      accessibleName(view.group, view.container),
      `the radiogroup's accessible name must be the ${LABEL_KEY} value — the strings table is the copy's single home (§3)`,
    ).toBe(copy[LABEL_KEY]);
    for (const mode of MODES) {
      expect(
        accessibleName(view.option(mode), view.container),
        `the ${mode} option must be named by ${OPTION_KEY[mode]} — the seam's raw value is never rendered (§3)`,
      ).toBe(copy[OPTION_KEY[mode] as string]);
    }
  });

  test("AC-3: the option matching the density prop is the checked one, and it is the only one", async () => {
    for (const mode of MODES) {
      const view = await mount(mode);
      expect(
        view.option(mode).getAttribute("aria-checked"),
        `given density=${mode}, ${OPTION_TESTID[mode]} must report aria-checked="true" — the toggle renders the stored mode, never a default that corrects itself after mount (I-33)`,
      ).toBe("true");
      expect(
        view.option(other(mode)).getAttribute("aria-checked"),
        `given density=${mode}, ${OPTION_TESTID[other(mode)]} must report aria-checked="false" — exactly one member of an exclusive set is checked`,
      ).toBe("false");
      cleanup();
    }
  });

  test("AC-3: activating the other option calls the action once with the other mode, and the control reflects it", async () => {
    const user = await keyboardUser("AC-3 activates the unchecked option");
    for (const mode of MODES) {
      const view = await mount(mode);
      const next = other(mode);
      await user.click(view.option(next));

      expect(view.action.mock.calls.length, `activating ${OPTION_TESTID[next]} must call the handed action exactly once`).toBe(1);
      expect(view.action.mock.calls[0], `the action must be told the mode that was chosen, and nothing else`).toStrictEqual([next]);
      expect(
        view.option(next).getAttribute("aria-checked"),
        `after activating ${OPTION_TESTID[next]} the checked state must move to it — the checked option moving IS the answer (I-33)`,
      ).toBe("true");
      expect(view.option(mode).getAttribute("aria-checked"), `${OPTION_TESTID[mode]} must give up the checked state`).toBe("false");
      cleanup();
    }
  });

  test("AC-3: activating the already-checked option writes nothing", async () => {
    const user = await keyboardUser("AC-3 re-activates the checked option");
    const view = await mount("comfortable");
    await user.click(view.option("comfortable"));
    expect(view.action.mock.calls.length, "re-activating the checked option changes nothing, so it must not write (Design §1)").toBe(0);
    expect(view.option("comfortable").getAttribute("aria-checked"), "and the checked option stays checked").toBe("true");
  });

  test("AC-3: both options are keyboard-operable — Tab reaches the group and an arrow selects the other mode", async () => {
    const user = await keyboardUser("AC-3 operates the control from the keyboard (R-UI-012)");
    for (const mode of MODES) {
      const view = await mount(mode);
      const next = other(mode);

      await user.tab();
      expect(
        document.activeElement,
        `Tab must reach the group's one tab stop, the checked ${mode} option — R-UI-012: every interactive element is keyboard reachable, and the radiogroup pattern makes the checked member the stop`,
      ).toBe(view.option(mode));

      await user.keyboard("{ArrowRight}");
      expect(document.activeElement, `ArrowRight must move focus to ${OPTION_TESTID[next]} (Design §1: roving tabindex, selection follows focus)`).toBe(view.option(next));
      expect(view.action.mock.calls, `and selecting it from the keyboard must write it exactly once, like a click`).toStrictEqual([[next]]);
      expect(view.option(next).getAttribute("aria-checked"), "the checked state follows the keyboard too").toBe("true");
      cleanup();
    }
  });

  test("AC-3: a focused option is activated by Space, and writes once", async () => {
    const user = await keyboardUser("AC-3 activates a focused option from the keyboard");
    const view = await mount("comfortable");
    view.option("compact").focus();
    await user.keyboard(" ");
    expect(view.action.mock.calls, "Space on a focused option must write that mode exactly once (Design §1)").toStrictEqual([["compact"]]);
  });

  test("AC-3: both options carry the focus reticle idiom (R-UI-012)", async () => {
    const view = await mount("comfortable");
    for (const mode of MODES) {
      expect(
        view.option(mode).classList.contains(RETICLE_CLASS),
        `${OPTION_TESTID[mode]} must wear .${RETICLE_CLASS} — the tree has exactly one focus indicator and it comes from its single home (B-17, R-UI-012); a visible focus indicator is never optional`,
      ).toBe(true);
    }
  });

  test("AC-3: the seam's Density, the toggle's Density and DataTableDensity are one type (graded by tsc)", async () => {
    // The runtime anchor for the compile-time block below: the seam must be a real module with the
    // two functions and the roster its type is derived from.
    const seam = await productModule<Record<string, unknown>>("src/core/prefs/index.ts");
    expect(typeof seam["densityFor"], "src/core/prefs/index.ts must export densityFor").toBe("function");
    expect(typeof seam["setDensity"], "src/core/prefs/index.ts must export setDensity").toBe("function");
    expect([...((seam["DENSITIES"] ?? []) as readonly string[])], "DENSITIES is exactly R-UI-005's two modes, in the contract's order").toStrictEqual([...MODES]);
  });
});

/**
 * The accessible name of an element, computed the way a screen reader computes it: an
 * `aria-labelledby` chain first, then `aria-label`, then the element's own text.
 */
function accessibleName(element: HTMLElement, root: HTMLElement): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null && labelledBy.trim() !== "") {
    return labelledBy
      .split(/\s+/)
      .map((id) => root.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
      .filter((part) => part !== "")
      .join(" ");
  }
  const label = element.getAttribute("aria-label");
  if (label !== null && label.trim() !== "") return label.trim();
  return (element.textContent ?? "").trim();
}

/* ------------------------------------------------------------------ AC-3, at compile time */

type Assignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;

/** The three names the criterion says are one type. Type position only — the transform erases them. */
type TableDensity = import("../../../src/ui/primitives/data/index").DataTableDensity;
type SeamDensity = import("../../../src/core/prefs/index").Density;
type SeamRoster = (typeof import("../../../src/core/prefs/index"))["DENSITIES"][number];
type ToggleProps = import("react").ComponentProps<(typeof import("../../../src/ui/shell/index"))["DensityToggle"]>;
type ShellProps = import("../../../src/ui/shell/index").AppShellProps;

/**
 * AC-3: mutually assignable in both directions is "exactly", and the two negatives are what keep
 * that from being satisfied by `any` or by `string` — a widened Density would let a forged mode
 * reach the CHECK, which is the fault I-34 exists to prevent.
 */
export type _AC3_OneDensityType = [
  Expect<Assignable<SeamDensity, TableDensity>>,
  Expect<Assignable<TableDensity, SeamDensity>>,
  Expect<Assignable<SeamRoster, TableDensity>>,
  Expect<Assignable<TableDensity, SeamRoster>>,
  Expect<Assignable<ToggleProps["density"], TableDensity>>,
  Expect<Assignable<TableDensity, ToggleProps["density"]>>,
  Expect<Not<Assignable<string, SeamDensity>>>,
  Expect<Not<Assignable<"roomy", ToggleProps["density"]>>>,
];

/** AC-3: the toggle takes the write as a handed action, and the frame takes the mode optionally. */
export type _AC3_ControlContract = [
  Expect<Assignable<ToggleProps["action"], (density: TableDensity) => Promise<void>>>,
  Expect<Assignable<undefined, ShellProps["density"]>>,
  Expect<Assignable<TableDensity, NonNullable<ShellProps["density"]>>>,
];
