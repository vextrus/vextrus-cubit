// @vitest-environment jsdom
/**
 * Public acceptance for the single RefusalState renderer (R-UI-020, B-17, ARCH-01/02): AC-4 of the
 * pattern's own increment, re-baselined by AC-3 of the auth-hardening leaf (B-20).
 *
 * The re-baseline: a refusal surface shows the register's message and remedy (R-SPINE-062), and the
 * taxonomy code is never user-facing copy. The code is machine-readable only — `data-code` on the
 * container — so this file asserts its ABSENCE from the rendered text as strictly as it used to
 * assert the chip that carried it. Nothing else about the renderer changes: the props, the
 * `role="alert"`, `data-severity` and `data-surface` are all still asserted below, and no check that
 * survived the re-baseline was weakened.
 *
 * The renderer is observed through the closed test contract only — the `data-testid`s of
 * docs/design/refusal-state.md §7 and the container's `role="alert"` (Decision I-7). No stylesheet
 * fact is asserted: jsdom lays nothing out, and the tints, borders and banner geometry are the
 * gallery leaf's baselines (Decision §7).
 *
 * The component is loaded by absolute path so a module the Builder has not written yet fails as an
 * assertion naming the file. The *type-only* import beside it is the other half of AC-4's last
 * sentence: `evidence` is required BY THE TYPE, which no runtime render can observe — `tsc`
 * (`pnpm verify`) is that assertion's runner, through EVIDENCE_REQUIREDNESS below.
 *
 * This file is `.ts`, not `.tsx`, on purpose: tsconfig's `include` covers `tests/**\/*.ts` only, so
 * a `.tsx` acceptance would run under vitest and never reach `tsc` — and the compile-time half
 * would silently never be checked. Elements are therefore built with `React.createElement`.
 *
 * Nothing here freezes the roster (B-19): every case is derived from whatever `REFUSALS` holds, so
 * a code added later is rendered and asserted by this file without an edit.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { RefusalState as RefusalStateComponent } from "../../../src/ui/patterns/refusal-state";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const PATTERN_DIR = "src/ui/patterns/refusal-state";
const PATTERN_BARREL = `${PATTERN_DIR}/index.ts`;
const ERRORS_MODULE = "src/core/errors.ts";

/** The ids of the closed contract (test contract, Decision §7). */
const TESTIDS = {
  state: "refusal-state",
  message: "refusal-message",
  remedy: "refusal-remedy",
  evidenceLink: "refusal-evidence-link",
} as const;

/** The id the removed chip carried. Named here so its absence is asserted, never merely unasserted. */
const REMOVED_CODE_CHIP = "refusal-code";

/** The Decision §7 sample evidence — a place, verb-first label. */
const EVIDENCE = { href: "/settings/documents", label: "Open document settings" } as const;

/**
 * AC-4, compile-time half: "optional" if a caller may omit `evidence`. `tsc` refuses the assignment
 * below when that is so, which is how R-UI-020's "always carries the evidence link" is enforced by
 * the compiler rather than by review (Decision §4).
 */
type RefusalStateProps = React.ComponentProps<typeof RefusalStateComponent>;
type EvidenceRequiredness = { refusal: RefusalStateProps["refusal"] } extends RefusalStateProps ? "optional" : "required";
const EVIDENCE_REQUIREDNESS: EvidenceRequiredness = "required";

interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

interface ErrorsModule {
  REFUSALS: Record<string, RefusalEntryShape>;
  refusalOf: (code: string) => RefusalEntryShape;
}

type ModuleBag = Record<string, unknown>;

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${relative} is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** The exported names a bag actually carries at runtime (type exports are erased). */
const exportNames = (mod: ModuleBag): string[] =>
  Object.keys(mod).filter((name) => name !== "default" && name !== "__esModule");

const textOf = (node: Element): string => (node.textContent ?? "").trim();

afterEach(() => {
  cleanup();
});

/** Render one entry standalone and return the container element the contract names. */
function renderRefusal(RefusalState: unknown, entry: RefusalEntryShape): HTMLElement {
  const component = RefusalState as React.ComponentType<{ refusal: RefusalEntryShape; evidence: { href: string; label: string } }>;
  const { container } = render(React.createElement(component, { refusal: entry, evidence: { ...EVIDENCE } }));
  return within(container).getByTestId(TESTIDS.state);
}

describe("AC-4: the refusal renders in place, with its evidence link", () => {
  test("AC-4: RefusalState is the sole export of src/ui/patterns/refusal-state", async () => {
    const bag = await productModule<ModuleBag>(PATTERN_BARREL);
    expect(
      exportNames(bag).sort(),
      "the pattern's barrel exports the one renderer and nothing else — one invariant, one home (B-17, ARCH-02)",
    ).toEqual(["RefusalState"]);
    expect(typeof bag.RefusalState, "RefusalState is a component").toBe("function");
  });

  test("AC-4: every registered refusal renders message, remedy and evidence inside one alert container", async () => {
    const { RefusalState } = await productModule<ModuleBag>(PATTERN_BARREL);
    const errors = await productModule<ErrorsModule>(ERRORS_MODULE);

    const codes = Object.keys(errors.REFUSALS);
    expect(codes.length, "there is at least one registered refusal to render").toBeGreaterThan(0);

    for (const code of codes) {
      const entry = errors.refusalOf(code);
      const state = renderRefusal(RefusalState, entry);

      expect(state.getAttribute("role"), `${code}: the refusal announces itself as an alert (Decision I-7)`).toBe("alert");

      const parts = within(state);
      expect(textOf(parts.getByTestId(TESTIDS.message)), `${code}: the registry's message is what is shown`).toBe(entry.message);
      expect(textOf(parts.getByTestId(TESTIDS.remedy)), `${code}: the registry's remedy is what is shown`).toBe(entry.remedy);

      const link = parts.getByTestId(TESTIDS.evidenceLink);
      expect(link.tagName, `${code}: evidence is a place, so the affordance is an anchor (Decision §1)`).toBe("A");
      expect(
        link.getAttribute("href"),
        `${code}: the link points at the given evidence — it is never omitted (evidence is ${EVIDENCE_REQUIREDNESS} by the component's type, R-UI-020)`,
      ).toBe(EVIDENCE.href);
      expect(textOf(link), `${code}: the link reads as the caller's label`).toBe(EVIDENCE.label);

      // The code travels machine-readably and nowhere else (AC-3, R-SPINE-062): a person is shown
      // what happened and what resolves it, and an operator — or a test — reads the taxonomy off
      // the attribute. `textContent` is jsdom's honest reading of the rendered text: it lays
      // nothing out, so a code hidden by a stylesheet would still be caught here.
      expect(state.getAttribute("data-code"), `${code}: the container carries its code machine-readably`).toBe(entry.code);
      expect(
        document.body.querySelector(`[data-testid="${REMOVED_CODE_CHIP}"]`),
        `${code}: the visible code chip is gone — the code is not copy (AC-3)`,
      ).toBeNull();
      expect(
        (document.body.textContent ?? "").includes(entry.code),
        `${code}: the taxonomy code appears in no rendered text — the surface shows the register's message and remedy instead (R-SPINE-062)`,
      ).toBe(false);

      cleanup();
    }
  });

  test("AC-4: every part lives inside the refusal container — the answer renders in place, never as a toast", async () => {
    const { RefusalState } = await productModule<ModuleBag>(PATTERN_BARREL);
    const errors = await productModule<ErrorsModule>(ERRORS_MODULE);
    const firstCode = Object.keys(errors.REFUSALS)[0] as string;
    const state = renderRefusal(RefusalState, errors.refusalOf(firstCode));

    for (const id of [TESTIDS.message, TESTIDS.remedy, TESTIDS.evidenceLink]) {
      const part = document.body.querySelector(`[data-testid="${id}"]`);
      expect(part, `"${id}" is rendered`).toBeTruthy();
      expect(
        state.contains(part),
        `"${id}" sits inside the refusal container — a refusal is never carried somewhere else on the page (R-UI-020)`,
      ).toBe(true);
    }
  });
});
