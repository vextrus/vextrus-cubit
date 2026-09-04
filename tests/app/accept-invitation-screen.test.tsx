// @vitest-environment jsdom
/**
 * AC-1(b): the accept screen spends the rate-limited door before it reads the token.
 *
 * `/accept-invitation?token=…` reads an offer for whatever token an address carries. Unmetered, that
 * is a token oracle: a signed-in account can walk the space of tokens as fast as the screen will
 * render. The tenancyAdmin door — the one docs/design/s-accept-invitation.md already names for the
 * accept itself — is spent on the account BEFORE the read, so the walk meets the same limit the
 * accept does, and the refusal it raises is rendered with the register's own words rather than
 * escaping as a fault.
 *
 * The seams are answered as the contract names them; nothing here reads the page's source.
 */
import { join } from "node:path";
import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const PAGE = "src/app/(app)/accept-invitation/page.tsx";
const RATE_LIMIT = "src/server/auth/rate-limit.ts";
const TENANCY = "src/modules/spine/tenancy/index.ts";
const SESSION = "src/server/shell/session.ts";
const RESOLVE = "src/server/shell/resolve.ts";
const MARKER = "src/core/faults/refusal-marker.ts";

const SESSION_USER = "9c1f0b52-6d3a-4e77-8f21-3a5c9e0d4b16";
const TOKEN = "an-offered-token";

/** Everything the screen asked of its seams, in the order it asked. */
let trail: string[] = [];
/** What `admitAttempt` does when the screen spends the door: nothing, or the refusal it raises. */
let doorRefuses = false;

interface PageModule {
  default: (props: { searchParams: Promise<{ token?: string }> }) => Promise<unknown>;
}

interface MarkerModule {
  refusal: (code: string, message: string) => Error;
}

async function arm(): Promise<void> {
  const { refusal } = await productModule<MarkerModule>(MARKER);
  vi.resetModules();
  vi.doMock("next/navigation", () => ({
    redirect: (path: string) => {
      trail.push(`redirect(${JSON.stringify(path)})`);
    },
    notFound: () => {
      trail.push("notFound()");
    },
    useRouter: () => ({ push: (path: string) => trail.push(`push(${JSON.stringify(path)})`), refresh: () => {} }),
  }));
  vi.doMock(join(REPO_ROOT, SESSION), () => ({ presentedSessionToken: async () => "a-live-session-token", endSession: async () => {} }));
  vi.doMock(join(REPO_ROOT, RESOLVE), () => ({ sessionOf: async () => ({ userId: SESSION_USER }) }));
  vi.doMock(join(REPO_ROOT, RATE_LIMIT), () => ({
    admitAttempt: async (door: string, identity: string) => {
      trail.push(`admitAttempt(${JSON.stringify(door)}, ${JSON.stringify(identity)})`);
      if (doorRefuses) throw refusal("RATE_LIMITED", "too many attempts");
    },
  }));
  // Only the one read the screen makes is answered; the rest of the tenancy module stands, because
  // the screen's own subtree imports other doors from it and a hollow module would break the render
  // for a reason that has nothing to do with the criterion.
  vi.doMock(join(REPO_ROOT, TENANCY), async (importOriginal) => ({
    ...((await importOriginal()) as object),
    offeredInvitation: async () => {
      trail.push("offeredInvitation()");
      return { workspaceName: "Datum Works", workspaceRole: "member" };
    },
  }));
}

beforeEach(() => {
  trail = [];
  doorRefuses = false;
});

afterEach(() => {
  for (const module of [SESSION, RESOLVE, RATE_LIMIT, TENANCY]) vi.doUnmock(join(REPO_ROOT, module));
  vi.doUnmock("next/navigation");
});

describe("AC-1: the accept screen is metered before it reads a token", () => {
  test("AC-1: the tenancyAdmin door is spent on the account before the offer is read", async () => {
    await arm();
    const page = await productModule<PageModule>(PAGE);
    await page.default({ searchParams: Promise.resolve({ token: TOKEN }) });

    expect(trail, `the door must be spent on the signed-in account before the token is read — the screen did: ${JSON.stringify(trail)}`).toStrictEqual([
      `admitAttempt("tenancyAdmin", ${JSON.stringify(SESSION_USER)})`,
      "offeredInvitation()",
    ]);
  });

  test("AC-1: a refused door renders the registered refusal in place of the offer", async () => {
    doorRefuses = true;
    await arm();
    const page = await productModule<PageModule>(PAGE);
    const tree = await page.default({ searchParams: Promise.resolve({ token: TOKEN }) });
    const view = render(tree as never);
    try {
      const scope = within(view.container);
      const refusal = scope.getByTestId("accept-invitation-refusal");
      expect(refusal.querySelector('[data-code="RATE_LIMITED"]') ?? (refusal.getAttribute("data-code") === "RATE_LIMITED" ? refusal : null), "the code travels machine-readably beside the register's own words (R-UI-020, Q-07)").not.toBeNull();
      expect(scope.queryByTestId("accept-invitation-form"), "nothing is left to submit while the door is closed — no disarmed control stands in its place (I-65)").toBeNull();
      expect(trail, "and the token was never read").toStrictEqual([`admitAttempt("tenancyAdmin", ${JSON.stringify(SESSION_USER)})`]);
    } finally {
      view.unmount();
    }
  });
});
