// @vitest-environment jsdom
/**
 * Public acceptance for S-Auth (R-SPINE-001/002/007, R-UI-020, docs/design/s-auth.md): AC-8's
 * routing and its two-different-answers half, and AC-1's "no vendor sign-up endpoint exists".
 *
 * What is asserted here is what a unit lane can honestly see: which routes the app tree mounts, and
 * how `SignInForm` answers a settled attempt when the Decision's own injection point (`perform`) is
 * used. The screens' layout, copy, motion and axe results are the journey's and the design gallery's
 * to judge — jsdom lays nothing out.
 *
 * This file is `.ts`, not `.tsx`: tsconfig includes `src/**\/*.ts`, so `pnpm verify`'s `tsc` reads it
 * too. Elements are therefore built with `React.createElement`.
 *
 * `next/navigation` is stubbed because the Decision (§2, §7) makes `SignInForm` renderable under
 * jsdom with an injected `perform`; a form that also reaches for the router must still mount when no
 * Next request scope exists. The stub adds nothing the assertions read.
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { REFUSALS } from "../../../core/errors";
import type { SignInForm as SignInFormComponent } from "../sign-in/sign-in-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/sign-in",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => undefined,
}));

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The home the increment's interfaces name for the injectable form. */
const SIGN_IN_FORM_MODULE = "src/app/(auth)/sign-in/sign-in-form.tsx";
const APP_DIR = "src/app";

/** The routes of the test contract. */
const SCREEN_ROUTES = ["/sign-up", "/sign-in", "/verify", "/magic-link", "/reset", "/sessions"] as const;
const VENDOR_ENDPOINT = "/api/auth/sign-up";
const TRPC_ENDPOINT_PATH = "/api/trpc/spine.auth.signUp";

/** The ids of the closed test contract this file touches. */
const TESTIDS = { email: "s-auth-email", password: "s-auth-password", submit: "s-auth-submit", refusal: "s-auth-refusal", fault: "s-auth-fault" } as const;

/** The refusal a wrong credential answers with (AC-2, AC-8). */
const CREDENTIALS_NOT_VALID = "CREDENTIALS_NOT_VALID";

/**
 * AC-8's "optional `perform` prop", compile-time half: `tsc` (`pnpm verify`) refuses this assignment
 * if a caller must pass `perform` — which is what makes the real screens' plain `<SignInForm />` and
 * this file's injected render the same component (Decision §2).
 */
type SignInFormProps = React.ComponentProps<typeof SignInFormComponent>;
type PerformOptionality = Record<never, never> extends SignInFormProps ? "optional" : "required";
const PERFORM_IS: PerformOptionality = "optional";

type ModuleBag = Record<string, unknown>;

interface RegisteredRefusal {
  message: string;
  remedy: string;
}

/** The registered entry for a code, or a loud absence — the four codes are AC-2's to register. */
function registered(code: string): RegisteredRefusal {
  const entry = (REFUSALS as Record<string, RegisteredRefusal | undefined>)[code];
  expect(entry, `${code} is registered in src/core/errors.ts with a message and a remedy (AC-2, R-SPINE-062)`).toBeTruthy();
  return entry as RegisteredRefusal;
}

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------ *
 * The routing table Next mounts from the app tree.
 * ------------------------------------------------------------------ */

/** Every route the app tree mounts as `page.*` or `route.*`; `(group)` and `@slot` name no segment. */
function mountedRoutes(kind: "page" | "route"): string[] {
  const appDir = join(REPO_ROOT, APP_DIR);
  if (!existsSync(appDir)) return [];
  const found: string[] = [];
  const walk = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name === "__tests__" || entry.name === "node_modules") continue;
        const grouping = entry.name.startsWith("(") || entry.name.startsWith("@");
        walk(join(dir, entry.name), grouping ? segments : [...segments, entry.name]);
      } else if (/^(page|route)\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && entry.name.startsWith(`${kind}.`)) {
        found.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(appDir, []);
  return found;
}

/** Does this mounted pattern serve that path? `[x]` takes one segment, `[...x]` takes the rest. */
function serves(pattern: string, path: string): boolean {
  const source = pattern
    .split("/")
    .map((segment) => {
      if (/^\[\[?\.\.\..+\]?\]$/.test(segment)) return ".*";
      if (/^\[.+\]$/.test(segment)) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${source}$`).test(path);
}

describe("AC-8: the S-Auth routes are mounted", () => {
  test("AC-8: /sign-up, /sign-in, /verify, /magic-link, /reset and /sessions are pages of the app tree", () => {
    const pages = mountedRoutes("page");
    for (const route of SCREEN_ROUTES) {
      expect(
        pages.some((mounted) => serves(mounted, route)),
        `AC-8: ${route} is a page of src/app (docs/design/s-auth.md §2) — mounted pages: ${pages.join(", ") || "none"}`,
      ).toBe(true);
    }
  });
});

describe("AC-1: no vendor sign-up endpoint exists", () => {
  test("AC-1: POST /api/auth/sign-up is served by no route — the transactional procedure is the only user-creating door", () => {
    const pages = mountedRoutes("page");
    expect(
      pages.some((mounted) => serves(mounted, "/sign-up")),
      "AC-1: the S-Auth sign-up screen is mounted, so this tree is the one the vendor door must be absent from",
    ).toBe(true);

    const routes = mountedRoutes("route");
    expect(
      routes.some((mounted) => serves(mounted, TRPC_ENDPOINT_PATH)),
      "AC-1: the tRPC transport is mounted — the door sign-up is taken through (test contract: procedures)",
    ).toBe(true);
    expect(
      routes.filter((mounted) => serves(mounted, VENDOR_ENDPOINT)),
      `AC-1: no route handler under src/app serves ${VENDOR_ENDPOINT}, so the conventional vendor path answers 404 — an account that belongs nowhere is unrepresentable (R-SPINE-002)`,
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * SignInForm: a refusal and a fault are two different answers (R-SPINE-007).
 * ------------------------------------------------------------------ */

/**
 * A settlement shaped like the transport's own. The wire answer carries `data: { kind, refusalCode |
 * faultId }` and a message that is the code or the fault id (src/server/trpc.ts's formatter), and a
 * refusal additionally carries the settled marker `refusalCodeOf` reads — so a form that maps by any
 * of those readings sees the same answer.
 */
function refusalFailure(code: string): Error {
  const data = { kind: "refusal", refusalCode: code };
  return Object.assign(new Error(code), { refusalCode: code, data, shape: { data }, cause: { refusalCode: code } });
}

function faultFailure(faultId: string, requestId: string): Error {
  const data = { kind: "fault", faultId, requestId };
  return Object.assign(new Error(faultId), { data, shape: { data } });
}

/** Render the named export with an injected `perform`, fill the credentials and submit. */
async function submitWith(perform: () => Promise<unknown>): Promise<void> {
  const bag = await productModule<ModuleBag>(SIGN_IN_FORM_MODULE);
  const SignInForm = bag["SignInForm"];
  expect(typeof SignInForm, `${SIGN_IN_FORM_MODULE} exports SignInForm as a named export (increment interfaces)`).toBe("function");

  render(React.createElement(SignInForm as React.ComponentType<{ perform?: (input: unknown) => Promise<unknown> }>, { perform: () => perform() }));

  const user = userEvent.setup();
  await user.type(screen.getByTestId(TESTIDS.email), "someone@cubit.test");
  await user.type(screen.getByTestId(TESTIDS.password), "a-password-typed-in");
  await user.click(screen.getByTestId(TESTIDS.submit));
}

describe("AC-8: SignInForm answers a refusal and a fault differently", () => {
  test("AC-8: a settled CREDENTIALS_NOT_VALID renders inline at s-auth-refusal with the registered message and remedy", async () => {
    const entry = registered(CREDENTIALS_NOT_VALID);
    await submitWith(() => Promise.reject(refusalFailure(CREDENTIALS_NOT_VALID)));

    const refusal = await screen.findByTestId(TESTIDS.refusal);
    const shown = refusal.textContent ?? "";
    expect(
      shown.includes(entry.message),
      `AC-8: the refusal slot shows the registered message "${entry.message}" (perform is ${PERFORM_IS} by the component's type) — got "${shown}"`,
    ).toBe(true);
    expect(shown.includes(entry.remedy), `AC-8: the refusal slot shows the registered remedy "${entry.remedy}" — got "${shown}"`).toBe(true);
    expect(screen.queryByTestId(TESTIDS.fault), "AC-8: a wrong credential is not a server fault — the fault surface stays away (R-SPINE-007)").toBeNull();
  });

  test("AC-8: a non-refusal failure renders the distinct fault surface at s-auth-fault, carrying its fault id", async () => {
    const faultId = "flt-9d3c1a7e-verifier";
    await submitWith(() => Promise.reject(faultFailure(faultId, "req-verifier-1")));

    const fault = await screen.findByTestId(TESTIDS.fault);
    expect((fault.textContent ?? "").includes(faultId), `AC-8: the fault surface quotes the fault id "${faultId}" — got "${fault.textContent ?? ""}"`).toBe(true);
    await waitFor(() => {
      expect(screen.queryByTestId(TESTIDS.refusal), "AC-8: a server fault is not dressed as a refusal — the two answers never share a surface (R-SPINE-007)").toBeNull();
    });
  });
});
