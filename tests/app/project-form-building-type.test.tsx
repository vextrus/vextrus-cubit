// @vitest-environment jsdom
/**
 * The building-type group states its own invalid state (Q-11): a refused submission that chose no
 * type leaves every chip saying it is refused and pointing at the sentence saying why — whichever
 * field the ordered judgement named first — and pressing a type spends it.
 */
import { join } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const FORM = "src/app/(app)/t/[tenant]/home/project-form.tsx";
const ACTIONS = "src/app/(app)/t/[tenant]/actions.ts";

const TENANT = "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88";

interface FormModule {
  ProjectForm: FunctionComponent<{ tenantId: string }>;
}

beforeEach(() => {
  vi.resetModules();
  // The form's module graph reaches the "use server" door; the door itself is not what is judged
  // here, and a blank submission never reaches it.
  vi.doMock(join(REPO_ROOT, ACTIONS), () => ({
    saveProjectAction: async () => ({ saved: true as const }),
  }));
});

afterEach(() => {
  vi.doUnmock(join(REPO_ROOT, ACTIONS));
});

describe("the project form's building-type group", () => {
  test("a refused submission that chose no type marks every chip, and a chosen type clears them", async () => {
    const module = await productModule<FormModule>(FORM);
    const view = render(createElement(module.ProjectForm, { tenantId: TENANT }));
    try {
      const scope = within(view.container);
      const chips = (): HTMLButtonElement[] => Array.from(scope.getByTestId("project-building-type").querySelectorAll("button"));
      expect(chips().length, "the five building types are chips").toBeGreaterThan(0);

      const user = userEvent.setup();
      await user.click(scope.getByTestId("project-form-submit"));

      const sentence = within(scope.getByTestId("project-form-refusal")).getByRole("alert");
      expect(sentence.textContent?.trim(), "a refused submission states one sentence").not.toBe("");
      for (const chip of chips()) {
        expect(chip.getAttribute("aria-invalid"), `chip ${JSON.stringify(chip.textContent)} must say it is refused`).toBe("true");
        const describedBy = chip.getAttribute("aria-describedby") ?? "";
        expect(view.container.ownerDocument.getElementById(describedBy)?.textContent, `chip ${JSON.stringify(chip.textContent)} must point at the sentence on screen`).toBe(sentence.textContent);
      }

      await user.click(chips()[0]);

      for (const chip of chips()) {
        expect(chip.getAttribute("aria-invalid"), "a chosen type leaves nothing unanswered about the group").toBeNull();
        expect(chip.getAttribute("aria-describedby"), "a chosen type leaves nothing unanswered about the group").toBeNull();
      }
      const group = scope.getByTestId("project-building-type");
      expect(group.getAttribute("aria-invalid")).toBeNull();
      expect(group.getAttribute("aria-describedby")).toBeNull();
    } finally {
      view.unmount();
    }
  });
});
