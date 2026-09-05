// @vitest-environment jsdom
/**
 * Two S-Auth rows about what a screen reader is told, judged on the rendered document.
 *
 * The brand mark's wrapper borrowed the page `<h1>` for its accessible name, so a reader moving by
 * heading and by image met the product's name twice — once as an image saying the heading's words,
 * once as the heading itself. The mark is decoration and the heading is the name (I-10).
 *
 * The sessions answer slot wrapped its answer in `aria-live="polite"`. Both things that can occupy
 * that slot are alerts — an alert announces on insertion by definition — so the wrapper nested an
 * assertive region inside a polite one, the one shape the announcement algorithm has no single
 * answer for: the changed node resolves against the nearest `aria-live` from itself upward, and the
 * two politenesses disagree (Q-11, R-UI-012).
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so `tsc` reads this file too, and
 * elements are built with `createElement` (the `s-auth.test.ts` precedent).
 */
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { strings } from "../../../ui/strings";

const seam = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
}));
// The wire is the server's; these cases only decide what it answers, so the screen's own document
// is what is judged (ARCH-02).
vi.mock("../transport", () => ({ query: seam.query, mutate: seam.mutate }));

const { AuthFrame } = await import("../auth-frame");
const { SessionList } = await import("../sessions/session-list");

/** One device this account is signed in on, and one it is not calling from — so a revoke stands. */
const ROWS = [
  { id: "session-here", deviceLabel: "Chrome on Linux", createdAt: new Date(2026, 0, 1).toISOString(), current: true },
  { id: "session-elsewhere", deviceLabel: "Safari on iPhone", createdAt: new Date(2026, 0, 2).toISOString(), current: false },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** The frame as an unauthenticated route mounts it: the mark stands, the heading names the page. */
function mountFrame(): HTMLElement {
  const { container } = render(createElement(AuthFrame, { title: "auth_sign_in_title", children: createElement("p", null, "the body") }));
  return container;
}

test("the mark is decoration: nothing in the frame is an image with a name", () => {
  mountFrame();

  expect(screen.queryAllByRole("img"), "the brand is decoration here — an image saying the heading's own words is the name said twice").toEqual([]);
});

test("the page is named once, by its heading", () => {
  mountFrame();

  const headings = screen.getAllByRole("heading");
  expect(headings.length, "one heading names the page").toBe(1);
  expect(headings[0]?.getAttribute("id"), "and it keeps the id the frame's parts point at").toBe("s-auth-title");
  expect(headings[0]?.textContent, "which is the screen's own title, from the table").toBe(strings.auth_sign_in_title);
});

test("the mark's wrapper is hidden rather than labelled", () => {
  const container = mountFrame();

  const mark = container.querySelector(".cx-auth-mark");
  expect(mark, "the unauthenticated frame renders the mark").not.toBeNull();
  expect(mark?.getAttribute("aria-hidden"), "the wrapper is hidden from the accessibility tree, images and all").toBe("true");
  expect(mark?.getAttribute("role"), "it claims to be nothing").toBeNull();
  expect(mark?.getAttribute("aria-labelledby"), "and it borrows no name").toBeNull();
});

test("a revoke that comes back faulted announces once, inside no second live region", async () => {
  const person = userEvent.setup();
  seam.query.mockResolvedValue(ROWS);
  seam.mutate.mockRejectedValue(new Error("the revoke never landed"));

  const { container } = render(createElement(SessionList));
  await act(async () => {
    await Promise.resolve();
  });

  await person.click(screen.getByTestId("s-auth-session-revoke"));
  const fault = await screen.findByTestId("s-auth-fault");

  expect(fault.getAttribute("role"), "the answer announces itself — that is what an alert is").toBe("alert");
  expect(fault.closest("[aria-live]"), "and no live region stands over it: a polite region around an alert is two politenesses for one insertion").toBeNull();
  expect(container.querySelectorAll("[aria-live]").length, "the list authors no live region of its own at all").toBe(0);
  expect(screen.getByTestId("s-auth-signout"), "and the surface stays: a settled attempt is not a failed load").toBeDefined();
});
