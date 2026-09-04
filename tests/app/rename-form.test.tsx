// @vitest-environment jsdom
/**
 * AC-5(c): the rename form submits without JavaScript.
 *
 * React only enhances a `<form action={…}>` progressively when the action it is given is the action
 * itself — the `useActionState` dispatch — because that is what it can render an endpoint for into
 * the served HTML. Wrapping it in an arrow declared in the component body makes the form a
 * client-only control: with the bundle not yet loaded, or not loading at all, pressing Save does
 * nothing at all and says nothing either.
 *
 * The shape is a property of the JSX (marked below); what it must not cost is behaviour, so the
 * second test drives a real typed submission and reads what reached the door.
 */
import { join } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";
import { lexed } from "./support/sources";

const FORM = "src/app/(app)/t/[tenant]/settings/rename-form.tsx";
const ACTIONS = "src/app/(app)/t/[tenant]/actions.ts";

const TENANT = "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88";
const TYPED = "Datum Works Dhaka";

/** The names that reached the door, in the order they were submitted. */
let submitted: (string | null)[] = [];

interface FormModule {
  RenameForm: FunctionComponent<{ tenantId: string; name: string }>;
}

beforeEach(() => {
  submitted = [];
  vi.resetModules();
  vi.doMock(join(REPO_ROOT, ACTIONS), () => ({
    renameWorkspaceAction: async (_shown: unknown, form: FormData) => {
      const name = form.get("name");
      submitted.push(typeof name === "string" ? name : null);
      return { renamed: true };
    },
  }));
});

afterEach(() => {
  vi.doUnmock(join(REPO_ROOT, ACTIONS));
});

describe("AC-5: the rename form is a form the browser can submit on its own", () => {
  test("AC-5: the form's action is the dispatch itself, not a function declared in the render", () => {
    // white-box: AC-5(c) — "progressively enhanceable" is a property of what the JSX attribute is
    // given; a jsdom submit runs the client path either way and cannot tell the two apart.
    const { code } = lexed(FORM);
    const at = code.indexOf("<form");
    expect(at, `${FORM} must render a <form>`).toBeGreaterThan(-1);

    const attribute = /action\s*=\s*\{\s*([^}]*?)\s*\}/.exec(code.slice(at));
    expect(attribute, `the <form> in ${FORM} must carry an action`).not.toBeNull();
    const expression = String(attribute?.[1] ?? "");
    expect(
      /^[A-Za-z_$][\w$]*$/.test(expression),
      `the form's action must be the useActionState dispatch by name — React can only serve a no-JS endpoint for that. It is: ${JSON.stringify(expression)}`,
    ).toBe(true);
  });

  test("AC-5: a typed name still reaches the door on submit", async () => {
    const module = await productModule<FormModule>(FORM);
    // A client component holds hooks, so it is MOUNTED rather than called: calling it would run
    // `useActionState` outside a renderer, which is not the form a person meets.
    const view = render(createElement(module.RenameForm, { tenantId: TENANT, name: "Datum Works" }));
    try {
      const scope = within(view.container);
      const field = scope.getByTestId("shell-rename-input");
      const user = userEvent.setup();
      await user.clear(field);
      await user.type(field, TYPED);
      await user.click(scope.getByRole("button", { name: /.+/ }));

      expect(submitted, `the submission must carry the name as it was typed — the door received ${JSON.stringify(submitted)}`).toStrictEqual([TYPED]);
    } finally {
      view.unmount();
    }
  });
});
