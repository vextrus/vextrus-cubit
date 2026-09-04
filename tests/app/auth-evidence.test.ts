/**
 * AC-1(c): a refusal that arrives on a token-bearing screen keeps the token in its way onward.
 *
 * DETAIL_NOT_GIVEN is answered by the screen the person is standing on — they left a field empty and
 * the remedy is to fill it in — but the answer today points at `/reset` bare, dropping the very token
 * that made `/reset` usable. The evidence link becomes a dead door. So the evidence takes the
 * screen's own search string, and DETAIL_NOT_GIVEN resolves back onto the same address.
 *
 * The rest of the register is out of this sweep's scope: n2d7g9's RATE_LIMITED/TOKEN_NOT_VALID token
 * drop is excluded, so the RULE this file pins for every other code is that the new argument changes
 * nothing for them — derived by asking the shipped function both ways rather than by transcribing a
 * table of hrefs a later increment may lawfully move (B-19).
 */
import { describe, expect, test } from "vitest";
import { productModule } from "../server/support/wire";

const ANSWERS = "src/app/(auth)/answers.ts";
const ROUTES = "src/app/(auth)/routes.ts";
const ERRORS = "src/core/errors.ts";
const STRINGS = "src/ui/strings/index.ts";

/** The search a mailed link leaves on the address — what a re-try of the same screen needs. */
const SEARCH = "?token=abc";

interface Evidence {
  href: string;
  label: string;
}

interface AnswersModule {
  evidenceFor: (code: string, route: string, search?: string) => Evidence;
}

describe("AC-1: the evidence link keeps the token the screen was reached with", () => {
  test("AC-1: DETAIL_NOT_GIVEN resolves back onto the same address, token and all", async () => {
    const { evidenceFor } = await productModule<AnswersModule>(ANSWERS);
    const { AUTH_ROUTES } = await productModule<{ AUTH_ROUTES: Record<string, string> }>(ROUTES);
    const { strings } = await productModule<{ strings: Record<string, string> }>(STRINGS);

    const reset = String(AUTH_ROUTES["reset"]);
    expect(evidenceFor("DETAIL_NOT_GIVEN", reset, SEARCH), "a field left empty is fixed on the screen that asked for it — and the screen is only usable with its token").toStrictEqual({
      href: `${reset}${SEARCH}`,
      label: strings["auth_evidence_try_again"],
    });
  });

  test("AC-1: a screen reached with no search still answers a bare route", async () => {
    const { evidenceFor } = await productModule<AnswersModule>(ANSWERS);
    const { AUTH_ROUTES } = await productModule<{ AUTH_ROUTES: Record<string, string> }>(ROUTES);

    const signIn = String(AUTH_ROUTES["signIn"]);
    expect(evidenceFor("DETAIL_NOT_GIVEN", signIn).href, "a screen that carries no token is linked to as itself, with no empty query left hanging on it").toBe(signIn);
  });

  test("AC-1: every other registered code answers exactly as it does without the search", async () => {
    const { evidenceFor } = await productModule<AnswersModule>(ANSWERS);
    const { AUTH_ROUTES } = await productModule<{ AUTH_ROUTES: Record<string, string> }>(ROUTES);
    const { REFUSALS } = await productModule<{ REFUSALS: Record<string, unknown> }>(ERRORS);

    const codes = Object.keys(REFUSALS).filter((code) => code !== "DETAIL_NOT_GIVEN");
    expect(codes.length, "the closed taxonomy has other codes to hold still").toBeGreaterThan(0);

    for (const route of Object.values(AUTH_ROUTES)) {
      for (const code of codes) {
        expect(evidenceFor(code, route, SEARCH), `${code} on ${route} is out of this sweep's scope — the new search argument must change nothing for it`).toStrictEqual(evidenceFor(code, route));
      }
    }
  });
});
