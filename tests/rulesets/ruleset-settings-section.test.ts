// @vitest-environment jsdom
/**
 * Public acceptance for AC-4 — the project rule-set settings screen, against its committed Design
 * Decision `docs/design/s-settings-ruleset.md`.
 *
 * The section is mounted with @testing-library/react over two views: a pinned one built from the
 * exported seed content and identity, its digest computed by `editionDigest` rather than spelled
 * (Decision §7), and the no-pin shape. What is graded is what the Decision rules — the seven test
 * ids on the elements it names, the three lineage steps in platform → tenant → project order, one
 * row per parameter carrying `data-param`, the value put through `formatUserFigure` and the unit
 * shown from the view, and an honest absence notice for the no-pin shape with a way onward.
 *
 * Painted facts (tokens, type ramps, hairlines) are not graded here: this lane has no styles.
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so this file is typechecked too, and the
 * element tree is built with `createElement` rather than JSX.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import {
  DESIGN_DECISION,
  LINEAGE_SCOPES,
  PAGE_MODULE,
  REPO_ROOT,
  ROUTE_DIR,
  SECTION_MODULE,
  TESTID_DIGEST,
  TESTID_IDENTITY,
  TESTID_LINEAGE,
  TESTID_LINEAGE_STEP,
  TESTID_PARAMETER_ROW,
  TESTID_PARAMETER_TABLE,
  TESTID_UNPINNED,
  loadEditionDigest,
  loadSeedContent,
  parameterRaw,
  parameterUnit,
  pinnedView,
  productModule,
  unpinnedView,
  type PinnedViewLike,
  type RulesetViewLike,
} from "./support/editions";

/** The seam that formats a figure for a person (Decision I-27: grouping is the seam's). */
const FORMAT_MODULE = "src/core/format.ts";

interface Rtl {
  render(ui: unknown): { container: HTMLElement };
  cleanup(): void;
}

interface SectionModule {
  RulesetSettingsSection?: unknown;
}

interface FormatModule {
  formatUserFigure?: (value: string) => string;
}

/** The library under the mount, loaded once. */
async function rtl(): Promise<Rtl> {
  return (await import("@testing-library/react")) as unknown as Rtl;
}

/** The section, proven exported before anything is rendered. */
async function section(): Promise<unknown> {
  const module = await productModule<SectionModule>(SECTION_MODULE);
  expect(typeof module.RulesetSettingsSection, `${SECTION_MODULE} must export RulesetSettingsSection({ view }) — the section the page renders and jsdom mounts (Decision §1)`).toBe("function");
  return module.RulesetSettingsSection;
}

/** Mount the section over a view and hand back its container. */
async function mount(view: RulesetViewLike): Promise<HTMLElement> {
  const { render } = await rtl();
  const Section = await section();
  return render(createElement(Section as (props: { view: RulesetViewLike }) => ReactNode, { view })).container;
}

/** Every element carrying a test id, under the container. */
function all(container: HTMLElement, testid: string): HTMLElement[] {
  return [...container.querySelectorAll(`[data-testid="${testid}"]`)] as HTMLElement[];
}

/** The one element carrying a test id — the Decision puts each of these on exactly one element. */
function one(container: HTMLElement, testid: string): HTMLElement {
  const found = all(container, testid);
  expect(found.length, `exactly one [data-testid="${testid}"] is owed by the Design Decision §7; found ${found.length}`).toBe(1);
  return found[0] as HTMLElement;
}

/** An element's text, with runs of whitespace flattened so line breaks in the markup do not matter. */
function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A pinned view over the seed, with a real digest (Decision §7: never a spelled hex literal). */
async function seededPinnedView(): Promise<PinnedViewLike> {
  const content = await loadSeedContent();
  const digest = await loadEditionDigest();
  return pinnedView(content, digest(content));
}

afterEach(async () => {
  (await rtl()).cleanup();
});

describe("AC-4: the screen is implemented against its committed Design Decision", () => {
  test("AC-4: the Decision is committed and the route directory holds the page it rules", () => {
    expect(existsSync(join(REPO_ROOT, DESIGN_DECISION)), `${DESIGN_DECISION} is the contract this screen is built against — it is committed before the screen (AC-4)`).toBe(true);
    expect(existsSync(join(REPO_ROOT, ROUTE_DIR)), `${ROUTE_DIR} is the home of /t/{tenantId}/p/{projectId}/settings/ruleset, under the membership guard in t/[tenant]/layout.tsx`).toBe(true);
  });

  test("AC-4: the page is a thin server component over projectRulesetView", async () => {
    const module = await productModule<{ default?: unknown }>(PAGE_MODULE);
    expect(typeof module.default, `${PAGE_MODULE} must default-export the page Next renders at the route`).toBe("function");
  });
});

describe("AC-4: a pinned view renders identity, digest, lineage and the parameter table", () => {
  test("AC-4: identity shows scope, name and version, and the digest shows whole and separately", async () => {
    const view = await seededPinnedView();
    const container = await mount(view);

    const identity = textOf(one(container, TESTID_IDENTITY));
    for (const field of [view.identity.scope, view.identity.name, view.identity.version]) {
      expect(identity, `${TESTID_IDENTITY} must show all three identity fields (scope, name, version); "${field}" is not in "${identity}"`).toContain(field);
    }

    const digest = textOf(one(container, TESTID_DIGEST));
    expect(digest, "the digest renders whole — a truncated digest compares nothing (Decision I-26)").toBe(view.digest);
    expect(identity, "identity and digest are shown as separate fields; neither substitutes for the other (L-MEA-01)").not.toContain(view.digest);
  });

  test("AC-4: the lineage is the view's chain, platform → tenant → project, each step naming itself", async () => {
    const view = await seededPinnedView();
    const container = await mount(view);

    const lineage = one(container, TESTID_LINEAGE);
    const steps = all(container, TESTID_LINEAGE_STEP);
    expect(steps.length, `${TESTID_LINEAGE} must hold one ${TESTID_LINEAGE_STEP} per step the view answers`).toBe(view.lineage.length);
    for (const step of steps) {
      expect(lineage.contains(step), `every ${TESTID_LINEAGE_STEP} sits inside ${TESTID_LINEAGE}`).toBe(true);
    }
    expect(
      steps.map((step) => step.getAttribute("data-scope")),
      "the steps render in the view's order, platform → tenant → project (Decision §7: data-scope is the order's hook)",
    ).toStrictEqual([...LINEAGE_SCOPES]);

    view.lineage.forEach((expected, index) => {
      const rendered = textOf(steps[index]);
      for (const field of [expected.scope, expected.name, expected.version, expected.digest]) {
        expect(rendered, `lineage step ${index + 1} shows its own (scope, name, version) and its digest; "${field}" is not in "${rendered}"`).toContain(field);
      }
    });
  });

  test("AC-4: every parameter is a row carrying data-param, with its value and unit", async () => {
    const view = await seededPinnedView();
    const format = await productModule<FormatModule>(FORMAT_MODULE);
    expect(typeof format.formatUserFigure, `${FORMAT_MODULE} must export formatUserFigure — the seam grouping belongs to (Decision I-27)`).toBe("function");
    const formatUserFigure = format.formatUserFigure as (value: string) => string;

    const container = await mount(view);
    const table = one(container, TESTID_PARAMETER_TABLE);
    const rows = all(container, TESTID_PARAMETER_ROW);
    const keys = Object.keys(view.parameters);

    expect(
      rows.map((row) => row.getAttribute("data-param")),
      "one row per parameter the view answers, in the view's order, each carrying data-param=<key>",
    ).toStrictEqual(keys);

    for (const row of rows) {
      expect(table.contains(row), `every ${TESTID_PARAMETER_ROW} sits inside ${TESTID_PARAMETER_TABLE}`).toBe(true);
      const key = row.getAttribute("data-param") ?? "";
      const rendered = textOf(row);
      const value = view.parameters[key];
      const figure = formatUserFigure(parameterRaw(key, value));
      expect(rendered, `the row for ${key} shows its value through formatUserFigure — "${figure}" is not in "${rendered}"`).toContain(figure);
      const unit = parameterUnit(value);
      if (unit !== undefined) {
        expect(rendered, `the row for ${key} shows the unit the edition carries, "${unit}" (Decision I-27: the screen invents no unit)`).toContain(unit);
      }
      expect(row.querySelector('th[scope="row"]'), `the row for ${key} names the parameter in a row header (Decision §1)`).toBeTruthy();
    }

    expect(all(container, TESTID_UNPINNED).length, "a pinned view shows no absence notice").toBe(0);
  });
});

describe("AC-4: a view reporting no pin renders an honest absence notice", () => {
  test("AC-4: the no-pin shape renders ruleset-unpinned and nothing that pretends to be a pin", async () => {
    const tenantId = "1f0d4f42-2b0a-4d0f-9d2f-5a2b6c1e8a90";
    const container = await mount(unpinnedView(tenantId));

    const notice = one(container, TESTID_UNPINNED);
    expect(textOf(notice).length, "the absence notice says why the screen is empty — a blank panel teaches nothing (R-UI-020)").toBeGreaterThan(0);

    for (const testid of [TESTID_IDENTITY, TESTID_DIGEST, TESTID_LINEAGE, TESTID_LINEAGE_STEP, TESTID_PARAMETER_TABLE, TESTID_PARAMETER_ROW]) {
      expect(all(container, testid).length, `${testid} must not render for a view that reports no pin — an empty edition panel would be a lie`).toBe(0);
    }

    const onward = [...notice.querySelectorAll("a[href]")].map((anchor) => anchor.getAttribute("href"));
    expect(onward, `the absence notice offers the way onward to /t/${tenantId} — the no-pin shape carries the workspace it was asked about (Decision I-28)`).toContain(`/t/${tenantId}`);
  });
});
