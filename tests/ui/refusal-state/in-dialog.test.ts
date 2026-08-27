// @vitest-environment jsdom
/**
 * R-UI-020: one RefusalState serves every surface *including inside dialogs* — so the composition
 * is proved, not assumed. The refusal renders in the dialog's own content flow, between the body
 * copy and the actions, announcing itself on mount while the dialog stays open (Decision § 2). It
 * brings no chrome of its own and the overlay primitive is not touched to host it (B-17).
 *
 * This file is `.ts`, not `.tsx`, so `tsc` typechecks it too — tsconfig's include covers
 * `tests/**\/*.ts` only. Elements are therefore built with `React.createElement`.
 */
import * as React from "react";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { refusalOf } from "../../../src/core/errors";
import { Dialog, DialogContent, DialogTitle } from "../../../src/ui/primitives/overlay";
import { RefusalState } from "../../../src/ui/patterns/refusal-state";

const EVIDENCE = { href: "/settings/documents", label: "Open document settings" } as const;

afterEach(() => {
  cleanup();
});

function openDialogWithRefusal(code: Parameters<typeof refusalOf>[0]): HTMLElement {
  render(
    React.createElement(
      Dialog,
      { open: true },
      React.createElement(
        DialogContent,
        { "aria-describedby": undefined },
        React.createElement(DialogTitle, null, "Confirm the document"),
        React.createElement("p", null, "The figures below are written into the document."),
        React.createElement(RefusalState, { refusal: refusalOf(code), evidence: { ...EVIDENCE } }),
      ),
    ),
  );
  const content = document.body.querySelector('[data-testid="dialog-content"]');
  expect(content, "the dialog's content is on the page").toBeTruthy();
  return content as HTMLElement;
}

describe("R-UI-020: the one renderer inside the product's Dialog, and the hints it reflects", () => {
  test("the refusal renders inside the open dialog's content, whole", () => {
    const entry = refusalOf("PRECISION_NOT_APPLIED");
    const content = openDialogWithRefusal("PRECISION_NOT_APPLIED");
    const state = within(content).getByTestId("refusal-state");

    expect(state.getAttribute("role"), "an alert inside a dialog announces on mount (Decision § 2)").toBe("alert");
    // The code is machine-readable and never copy — on this surface as on every other (AC-3 of the
    // auth-hardening leaf, R-SPINE-062; B-20 re-baseline of the chip this line used to assert).
    expect(state.getAttribute("data-code"), "the card carries its code as data, inside the dialog too").toBe(entry.code);
    expect(within(state).queryByTestId("refusal-code"), "no visible code chip is rendered inside the dialog").toBeNull();
    expect(
      (content.textContent ?? "").includes(entry.code),
      "the taxonomy code appears in no text the dialog renders — the register's message and remedy are what is shown",
    ).toBe(false);
    expect(within(state).getByTestId("refusal-message").textContent).toBe(entry.message);
    expect(within(state).getByTestId("refusal-remedy").textContent).toBe(entry.remedy);

    const link = within(state).getByTestId("refusal-evidence-link");
    expect(link.getAttribute("href"), "the evidence link travels into the dialog unchanged").toBe(EVIDENCE.href);

    // The answer sits between what was asked and what can be done next, in the dialog's own flow —
    // not portalled elsewhere and not floated over it (R-UI-020).
    expect(state.parentElement, "the refusal is a child of the dialog content, not of the body").toBe(content);
    const dialog = content.closest('[role="dialog"]') ?? content;
    expect(dialog.contains(state), "the dialog stays open around the refusal").toBe(true);
  });

  test("the entry's own severity and surface are what the renderer reflects, code by code", () => {
    for (const code of ["PRECISION_NOT_APPLIED", "CHARACTER_NOT_COVERED", "SIGNED_OUT"] as const) {
      const entry = refusalOf(code);
      const { container } = render(React.createElement(RefusalState, { refusal: entry, evidence: { ...EVIDENCE } }));
      const state = within(container).getByTestId("refusal-state");
      expect(state.getAttribute("data-code"), `${code}: the container names its code`).toBe(entry.code);
      expect(state.getAttribute("data-severity"), `${code}: severity comes from the taxonomy, never from the call site (Decision I-8)`).toBe(entry.severity);
      expect(state.getAttribute("data-surface"), `${code}: so does the surface hint`).toBe(entry.surface);
      cleanup();
    }
  });
});
