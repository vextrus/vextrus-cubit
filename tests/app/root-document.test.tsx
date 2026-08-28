// @vitest-environment jsdom
/**
 * Public acceptance for the `/` landmark.
 *
 * It carries two guarantees now, and this file is the B-20 re-baseline that says so (inc-013-shell,
 * AC-2). The nameplate stays one screen with two branches (docs/design/shell.md I-19):
 *
 *   - ANONYMOUS — unchanged, and still asserted in full: a real `<main>` landmark, the heading and
 *     the tagline from the string table, and an interactive surface that is exactly the two auth
 *     doors. Nothing about the signed-out nameplate is relaxed by the shell.
 *   - SIGNED-IN — one door in their place, `root-home-workspace-door`, pointing at
 *     `/t/{their tenantId}`: the visible navigation R-UI-031 requires, a link and never a redirect
 *     (J-001a asserts `toHaveURL('/')` after sign-in and must stay green).
 *
 * HOW THE BRANCH IS DRIVEN. `HomePage` resolves it server-side through the increment's declared
 * seam — `workspaceFor` from `src/server/shell/workspace.ts` (interfaces; Decision §1, I-19) — so
 * this file answers for that seam and for `next/headers`, and calls the page as the server calls
 * it: a function returning the tree. Both are framework/seam boundaries the contract names, not
 * internals; a page that reaches for the session some other way is free to, so long as its branch
 * follows `workspaceFor`'s answer.
 *
 * Copy is asserted against the table, never against a literal spelled here — C-SPINE-PLATFORM puts
 * the words in one place and this file reads them from it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, loadStrings, productModule } from "../server/support/wire";
const PAGE_MODULE = "src/app/page.tsx";
const WORKSPACE_MODULE = "src/server/shell/workspace.ts";

/** Anything that can take focus or be activated — the landmark's interactive surface, exactly. */
const INTERACTIVE = "a[href], button, input, select, textarea, summary, [tabindex], [role='button'], [role='link'], [contenteditable='true']";

/** A workspace the seam can answer with, for the signed-in branch. The uuid is `tenants.tenantId`. */
const WORKSPACE = { tenantId: "2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88", name: "Datum Works" } as const;

/** What the answering cookie jar holds for the render under way — set by `mount`, read by the mock. */
let sessionCookie: string | null = null;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (sessionCookie === null ? undefined : { name, value: sessionCookie }),
    getAll: () => (sessionCookie === null ? [] : [{ name: "cubit_session", value: sessionCookie }]),
    has: () => sessionCookie !== null,
  }),
  headers: async () => new Headers(),
}));

interface PageModule {
  default?: unknown;
}

interface Mounted {
  main: HTMLElement;
  strings: Record<string, string>;
  unmount: () => void;
}

/**
 * Render `/` on one of its two branches.
 *
 * The seam is answered only once the Builder has written it: until `src/server/shell/workspace.ts`
 * exists there is nothing to answer for, and the anonymous branch — the whole of `/` before this
 * increment — is judged exactly as it always was.
 */
async function mount(branch: { signedIn: boolean }): Promise<Mounted> {
  sessionCookie = branch.signedIn ? "a-live-session-token" : null;
  const seam = join(REPO_ROOT, WORKSPACE_MODULE);
  if (branch.signedIn) {
    expect(existsSync(seam), `${WORKSPACE_MODULE} is missing from the checkout — the signed-in branch of / resolves through \`workspaceFor\` (interfaces; docs/design/shell.md I-19)`).toBe(true);
  }
  if (existsSync(seam)) {
    vi.doMock(seam, () => ({
      workspaceFor: async () => (branch.signedIn ? { ...WORKSPACE } : null),
      renameWorkspace: async () => ({ renamed: false }),
    }));
  }
  vi.resetModules();

  const page = await productModule<PageModule>(PAGE_MODULE);
  expect(typeof page.default, `${PAGE_MODULE} must default-export HomePage — Next renders the default export`).toBe("function");
  const { strings } = await loadStrings();
  const tree = await (page.default as () => unknown | Promise<unknown>)();
  const view = render(tree as never);
  return { main: within(view.container).getByTestId("root-home-main"), strings, unmount: () => view.unmount() };
}

/** The controls the landmark carries, compared as a set: R-UI-031 fixes which, not in what order. */
function controlsOf(main: HTMLElement): { tag: string; href: string | null; text: string }[] {
  const byHref = (a: { href: string | null }, b: { href: string | null }): number => ((a.href ?? "") < (b.href ?? "") ? -1 : (a.href ?? "") > (b.href ?? "") ? 1 : 0);
  // Sorted by code point — `no-raw-intl` binds this file too, so `localeCompare` is not available.
  return [...main.querySelectorAll(INTERACTIVE)].map((element) => ({ tag: element.tagName, href: element.getAttribute("href"), text: element.textContent?.trim() ?? "" })).sort(byHref);
}

/** A declared string with this exact text, or nothing — "the copy comes from the table" as a fact. */
function keyFor(strings: Record<string, string>, text: string): string | undefined {
  return Object.entries(strings).find(([, value]) => value.trim() === text.trim())?.[0];
}

afterEach(() => {
  vi.doUnmock(join(REPO_ROOT, WORKSPACE_MODULE));
  sessionCookie = null;
});

describe("AC-4: the Golden Path's first checkpoint renders", () => {
  test("AC-4: / renders a real main landmark carrying the heading and the tagline", async () => {
    const view = await mount({ signedIn: false });
    try {
      expect(view.main.tagName, "root-home-main must be a real <main> element — the landmark axe and the journey both read").toBe("MAIN");
      const scope = within(view.main);
      expect(scope.getByTestId("root-home-heading").tagName, "the product's name is the page's level-1 heading").toBe("H1");
      expect(scope.getByTestId("root-home-tagline"), "the tagline sits inside the landmark").toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  test("AC-4: the heading and the tagline say exactly what the string table says", async () => {
    const view = await mount({ signedIn: false });
    try {
      const scope = within(view.main);
      const title = view.strings["app_title"];
      const tagline = view.strings["home_tagline"];
      expect(title, "strings.app_title must be declared — it is the document title and the heading (C-SPINE-PLATFORM)").toBeTypeOf("string");
      expect(tagline, "strings.home_tagline must be declared").toBeTypeOf("string");
      expect(String(title).trim().length, "strings.app_title must not be empty: the journey asserts a non-empty document title").toBeGreaterThan(0);
      expect(String(tagline).trim().length, "strings.home_tagline must not be empty").toBeGreaterThan(0);

      expect(scope.getByTestId("root-home-heading").textContent?.trim()).toBe(title);
      expect(scope.getByTestId("root-home-tagline").textContent?.trim()).toBe(tagline);
      expect(scope.getByRole("heading", { level: 1, name: String(title) }), "the heading's accessible name is its visible text").toBe(scope.getByTestId("root-home-heading"));
    } finally {
      view.unmount();
    }
  });

  test("AC-4: every word on the anonymous landmark comes from the string table, and its only controls are the two auth links", async () => {
    const view = await mount({ signedIn: false });
    try {
      // C-SPINE-PLATFORM: take the declared copy out of the rendered text and nothing readable
      // may be left over — a slogan spelled in JSX would surface here.
      let remainder = view.main.textContent ?? "";
      for (const value of Object.values(view.strings)) remainder = remainder.split(value).join("");
      expect(remainder.trim(), `the landmark renders copy that is not in the string table: "${remainder.trim()}"`).toBe("");

      const signIn = view.strings["home_sign_in"];
      const signUp = view.strings["home_sign_up"];
      expect(signIn, "strings.home_sign_in must be declared — it is the visible text of /'s link to the sign-in screen (C-SPINE-PLATFORM)").toBeTypeOf("string");
      expect(signUp, "strings.home_sign_up must be declared — it is the visible text of /'s link to the sign-up screen").toBeTypeOf("string");
      expect(String(signIn).trim().length, "strings.home_sign_in must not be empty: a link with no words is not visible navigation").toBeGreaterThan(0);
      expect(String(signUp).trim().length, "strings.home_sign_up must not be empty").toBeGreaterThan(0);

      expect(controlsOf(view.main), "the anonymous / landmark's interactive surface is exactly the two auth links the string table names (R-UI-031, I-19)").toStrictEqual([
        { tag: "A", href: "/sign-in", text: String(signIn) },
        { tag: "A", href: "/sign-up", text: String(signUp) },
      ]);
    } finally {
      view.unmount();
    }
  });
});

describe("AC-2: / is the signed-in visitor's visible door into their workspace", () => {
  test("AC-2: a signed-in visitor sees root-home-workspace-door pointing at /t/{their tenantId}", async () => {
    const view = await mount({ signedIn: true });
    try {
      const door = within(view.main).getByTestId("root-home-workspace-door");
      expect(door.tagName, "the workspace door is a link — a link, never a redirect: J-001a asserts toHaveURL('/') after sign-in (I-19)").toBe("A");
      expect(door.getAttribute("href"), "the door points at the workspace the seam answered with — the URL is the source of truth (R-UI-031)").toBe(`/t/${WORKSPACE.tenantId}`);

      const label = door.textContent?.trim() ?? "";
      expect(label.length, "a door with no words is not visible navigation").toBeGreaterThan(0);
      const key = keyFor(view.strings, label);
      expect(key, `the door's label must come from the string table, not a literal in JSX — "${label}" is in no table`).toBeTypeOf("string");
      expect(String(key).startsWith("shell_"), `shell copy lives under shell_-prefixed keys (interfaces) — the door's label is declared as "${String(key)}"`).toBe(true);
    } finally {
      view.unmount();
    }
  });

  test("AC-2: the signed-in nameplate swaps its doors — the workspace door in place of the two auth links", async () => {
    const view = await mount({ signedIn: true });
    try {
      const controls = controlsOf(view.main);
      expect(controls.length, `the signed-in landmark carries exactly one door (I-19), and it carries: ${JSON.stringify(controls)}`).toBe(1);
      expect(controls[0]?.href, "and that door is the workspace door").toBe(`/t/${WORKSPACE.tenantId}`);

      // Still one screen, still the nameplate: the heading and tagline do not move.
      const scope = within(view.main);
      expect(scope.getByTestId("root-home-heading").textContent?.trim()).toBe(view.strings["app_title"]);
      expect(scope.getByTestId("root-home-tagline").textContent?.trim()).toBe(view.strings["home_tagline"]);

      let remainder = view.main.textContent ?? "";
      for (const value of Object.values(view.strings)) remainder = remainder.split(value).join("");
      expect(remainder.trim(), `the signed-in landmark renders copy that is not in the string table: "${remainder.trim()}"`).toBe("");
    } finally {
      view.unmount();
    }
  });

  test("AC-2: the anonymous nameplate carries no workspace door", async () => {
    const view = await mount({ signedIn: false });
    try {
      expect(within(view.main).queryByTestId("root-home-workspace-door"), "a visitor with no session is offered the auth doors, never a workspace they do not have").toBeNull();
    } finally {
      view.unmount();
    }
  });
});
