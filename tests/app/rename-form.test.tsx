// @vitest-environment jsdom
// The workspace rename form (src/app/(app)/t/[tenant]/settings/rename-form.tsx). A `<form action>`
// that is the dispatch itself is submitted by the browser whether or not the client bundle ever
// arrives; wrapping it in a closure trades that away for bookkeeping the form can do elsewhere.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { codeOf } from "./support/source-facts";

const RENAME_FORM = "src/app/(app)/t/[tenant]/settings/rename-form.tsx";

const sent = vi.hoisted(() => ({ forms: [] as FormData[] }));

vi.mock("../../src/app/(app)/t/[tenant]/actions", () => ({
  renameWorkspaceAction: vi.fn(async (_shown: unknown, form: FormData) => {
    sent.forms.push(form);
    return { renamed: true, tenantId: String(form.get("tenantId") ?? ""), name: String(form.get("name") ?? "") };
  }),
}));

const { RenameForm } = await import("../../src/app/(app)/t/[tenant]/settings/rename-form");

afterEach(() => {
  sent.forms.length = 0;
  cleanup();
});

/** The expression a JSX attribute holds, read from the code channel by balancing its braces. */
function attributeExpression(code: string, tag: string, attribute: string): string {
  const tagAt = code.search(new RegExp(`<${tag}\\b`));
  if (tagAt === -1) throw new Error(`${RENAME_FORM} renders no <${tag}>`);
  const opens = code.indexOf(`${attribute}={`, tagAt);
  if (opens === -1) throw new Error(`the <${tag}> carries no ${attribute}={…}`);
  let depth = 0;
  for (let at = opens + attribute.length + 1; at < code.length; at += 1) {
    if (code.charAt(at) === "{") depth += 1;
    else if (code.charAt(at) === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(opens + attribute.length + 2, at).trim();
    }
  }
  throw new Error(`the ${attribute} expression is never closed`);
}

test("AC-5(c): the form's action is the dispatch itself, so a submission needs no client bundle", () => {
  // white-box: AC-5(c) — under jsdom every form has JavaScript, so "the no-JS path survives" can
  // only be judged where it is decided: whether the action attribute is the action or a closure.
  const expression = attributeExpression(codeOf(RENAME_FORM), "form", "action");

  expect(/^[A-Za-z_$][\w$]*$/.test(expression), `the form's action is an expression, not the dispatch: ${expression}`).toBe(true);
});

test("AC-5(c): a filled submission still dispatches the typed name", async () => {
  const person = userEvent.setup();
  render(<RenameForm tenantId="tenant-1" name="Ashuganj Works" />);

  const field = screen.getByTestId("shell-rename-input");
  await person.clear(field);
  await person.type(field, "Ashuganj Yard");
  await person.click(screen.getByTestId("shell-rename-submit"));

  expect(sent.forms.length, "the submission reached the action").toBe(1);
  expect(sent.forms[0]?.get("name"), "the name on the wire is the name that was typed").toBe("Ashuganj Yard");
  expect(sent.forms[0]?.get("tenantId"), "and it names the workspace the form was rendered for").toBe("tenant-1");
});
