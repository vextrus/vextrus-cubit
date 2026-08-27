/**
 * The identity doors' answers against the closed register (R-SPINE-062, Q-07, ARCH-03).
 *
 * Every answer these doors give instead of a session travels as the settled marker carrying a code
 * the taxonomy holds — so a code renamed in one home and not the other fails here, rather than
 * reaching a person as an answer the renderer cannot look up.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS, type RefusalCode } from "../../core/errors";
import { refusalCodeOf } from "../../core/faults/refusal-marker";
import { accountAlreadyExists, credentialsNotValid, linkNotSendable, rateLimited, signedOut, tokenNotValid } from "./refusals";

/** Each door's refusal, beside the code it claims. */
const ANSWERS: ReadonlyArray<readonly [RefusalCode, Error]> = [
  ["CREDENTIALS_NOT_VALID", credentialsNotValid()],
  ["TOKEN_NOT_VALID", tokenNotValid("magic-link")],
  ["ACCOUNT_ALREADY_EXISTS", accountAlreadyExists()],
  ["RATE_LIMITED", rateLimited("spine.auth.signIn", 1_000)],
  ["SIGNED_OUT", signedOut()],
  ["LINK_NOT_SENDABLE", linkNotSendable("magic-link")],
];

describe("the identity doors' refusals", () => {
  test("each one is registered, and marked with the code the seam reads (R-SPINE-062)", () => {
    for (const [code, answer] of ANSWERS) {
      expect(Object.hasOwn(REFUSALS, code), `${code} is registered in src/core/errors.ts — a code the registry lacks is not an answer`).toBe(true);
      expect(refusalCodeOf(answer), `the door's error is marked ${code}, so the transport answers a refusal rather than a fault`).toBe(code);
    }
  });

  test("the message a door carries is operator detail, never the copy a person reads", () => {
    for (const [code, answer] of ANSWERS) {
      const entry = REFUSALS[code];
      expect(answer.message.trim().length, `${code} carries the operator detail that says which door refused and why`).toBeGreaterThan(0);
      expect(answer.message, `${code}'s user-facing copy comes from the register, rendered by the one renderer — not from the thrown error`).not.toBe(
        entry?.message,
      );
    }
  });
});
