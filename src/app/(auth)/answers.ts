// R-SPINE-007 and ARCH-03 on the screen side: a settled call is one of three things, and the screen
// must be able to tell them apart before it renders anything. A registered refusal is an answer and
// renders as one; anything else is a fault of the machine and renders as a fault, with the id when
// the envelope carries one and as the unreachable variant when it does not (Decision I-12).
//
// The marker itself is not re-read here: `core/faults/refusal-marker` is its one reader (ARCH-02),
// and this file only adds the two places the *wire* puts the same code — the error envelope's data,
// and the tRPC shape that carries it — before asking the closed taxonomy whether the code is real.
import { REFUSALS, type RefusalCode, type RefusalEntry } from "../../core/errors";
import { refusalCodeOf } from "../../core/faults/refusal-marker";
import { strings } from "../../ui/strings";
import { AUTH_ROUTES, type AuthRoute } from "./routes";

/** What the screen renders: the registered refusal, or the fault surface (R-SPINE-007). */
export type Answer = { kind: "refusal"; refusal: RefusalEntry } | { kind: "fault"; faultId: string | null };

/** A call that has settled, without a rejection anybody has to catch. */
export type Settled<T> = { ok: true; value: T } | { ok: false; answer: Answer };

/**
 * Settle a call into a value or an answer. The rejection is taken through `then`'s second argument
 * rather than a catch: this layer records no faults and refuses nothing of its own — it renders what
 * the server already decided — and a catch clause here would be a mapping with neither (ARCH-03).
 */
export function settle<T>(work: Promise<T>): Promise<Settled<T>> {
  return work.then<Settled<T>, Settled<T>>(
    (value) => ({ ok: true, value }),
    (failure: unknown) => ({ ok: false, answer: answerOf(failure) }),
  );
}

/** Which of R-SPINE-007's two answers this failure is. */
export function answerOf(failure: unknown): Answer {
  const code = registeredCodeIn(failure);
  if (code !== null) return { kind: "refusal", refusal: REFUSALS[code] };
  return { kind: "fault", faultId: faultIdIn(failure) };
}

/** Anything with named fields, as a bag; anything else carries no fields to read. */
function bagOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** A non-empty string under `key`, or nothing — an empty id is no id and an empty code no code. */
function stringAt(source: unknown, key: string): string | null {
  const value = bagOf(source)[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The refusal code this failure carries, and only if the closed taxonomy registers it (R-SPINE-062):
 * an unregistered code is not an answer the product knows how to give, so the failure stays a fault
 * rather than becoming a refusal with no message.
 */
function registeredCodeIn(failure: unknown): RefusalCode | null {
  const bag = bagOf(failure);
  const wire = [bag["data"], bagOf(bag["shape"])["data"]];
  const codes = [refusalCodeOf(failure), ...wire.map((carrier) => stringAt(carrier, "refusalCode"))];
  for (const code of codes) {
    if (code !== null && Object.hasOwn(REFUSALS, code)) return code as RefusalCode;
  }
  return null;
}

/** The id the operator quotes, when the fault envelope reached the screen with one (ARCH-03). */
function faultIdIn(failure: unknown): string | null {
  const bag = bagOf(failure);
  for (const carrier of [bag["data"], bagOf(bag["shape"])["data"]]) {
    const faultId = stringAt(carrier, "faultId");
    if (faultId !== null) return faultId;
  }
  return null;
}

/** Where a refusal is resolved: a place, named in the button voice (R-UI-020, Decision § 3). */
export interface RefusalEvidence {
  href: string;
  label: string;
}

/**
 * The evidence link each code takes on each screen. A rate limit resolves at the door that refused
 * — after the window, the same door is the resolving place — and a dead link resolves wherever a
 * fresh one is issued, which is the route the person is standing on unless that route only reads
 * tokens it cannot re-issue.
 */
export function evidenceFor(code: RefusalCode, route: AuthRoute): RefusalEvidence {
  if (code === "RATE_LIMITED") return { href: route, label: strings.auth_evidence_try_again };
  if (code === "CREDENTIALS_NOT_VALID") return { href: AUTH_ROUTES.reset, label: strings.auth_evidence_reset_password };
  if (code === "TOKEN_NOT_VALID" && route !== AUTH_ROUTES.verify) return { href: route, label: strings.auth_evidence_request_new_link };
  return { href: AUTH_ROUTES.signIn, label: strings.auth_evidence_go_to_sign_in };
}
