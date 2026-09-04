// Where an S-Auth refusal says a person can resolve it (src/app/(auth)/answers.ts). A screen that
// only reads a mailed token cannot re-issue one, so the way onward has to keep the token the person
// arrived with — otherwise "Try again" lands them on a form with nothing to submit.
import { expect, test } from "vitest";
import { REFUSALS, type RefusalCode } from "../../src/core/errors";
import { evidenceFor } from "../../src/app/(auth)/answers";
import { AUTH_ROUTES, type AuthRoute } from "../../src/app/(auth)/routes";
import { strings } from "../../src/ui/strings";

/** The reading this criterion asks for: the same answer, with the search the screen was reached by. */
type EvidenceReader = (code: RefusalCode, route: AuthRoute, search?: string) => { href: string; label: string };
const evidence: EvidenceReader = evidenceFor;

/** A code the closed taxonomy does not register (R-SPINE-062), which is what makes it this branch. */
const UNREGISTERED = "DETAIL_NOT_GIVEN" as RefusalCode;

test("AC-1(c): DETAIL_NOT_GIVEN resolves on the screen the person is standing on, token and all", () => {
  expect(Object.hasOwn(REFUSALS, UNREGISTERED as string), "the case only exists for a code the register does not hold").toBe(false);

  expect(evidence(UNREGISTERED, AUTH_ROUTES.reset, "?token=abc")).toEqual({
    href: `${AUTH_ROUTES.reset}?token=abc`,
    label: strings.auth_evidence_try_again,
  });
});

test("AC-1(c): every registered code answers exactly what it answered before the search was offered", () => {
  for (const code of Object.keys(REFUSALS) as RefusalCode[]) {
    for (const route of Object.values(AUTH_ROUTES)) {
      expect(evidence(code, route, "?token=abc"), `${code} on ${route} changed when a search was passed`).toEqual(evidence(code, route));
    }
  }
});
