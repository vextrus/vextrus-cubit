// The identity lane as a browser reaches it: one POST (or, for a query, one GET) against the tRPC
// mount, and the answer or the failure that came back. The session cookie is the browser's to send
// and the server's to set, so nothing about it is spelled here (R-SPINE-001).
//
// A failure is re-thrown carrying the envelope's own `data` — the shape src/server/trpc.ts stamps
// with which of ARCH-03's answers it is — so the screen decides between a refusal and a fault from
// what the server decided, never from a status code or a message it re-reads.

/** The doors of the identity lane (R-SPINE-001, R-SPINE-002), named so a typo is a compile error. */
export type AuthProcedure =
  | "signUp"
  | "signIn"
  | "signOut"
  | "verifyEmail"
  | "requestMagicLink"
  | "consumeMagicLink"
  | "requestPasswordReset"
  | "resetPassword"
  | "listSessions"
  | "revokeSession";

/** The mount, and the lane under it: `src/app/api/trpc/[trpc]/route.ts` serves this prefix. */
const LANE = "/api/trpc/spine.auth.";

/** The envelope tRPC answers with: a result, or the error the formatter shaped (src/server/trpc.ts). */
interface Envelope {
  result?: { data?: unknown };
  error?: { message?: string; data?: unknown };
}

/**
 * The answer, or the failure as this tier must see it. `data` travels onto the thrown value so the
 * refusal code or the fault id survives the throw; nothing else of the envelope does, because a
 * fault's internals belong on the sink and never on a screen (ARCH-03).
 *
 * A body that is not the tRPC envelope — Next's own 500 page, a proxy's error page, a 404 from a
 * mount that moved — is still a server that answered. Reading it with `.json()` and letting the
 * SyntaxError escape would make it indistinguishable from a fetch that never arrived, and the screen
 * would tell the person to check their connection for a machine that replied. Decision I-12 rules
 * the *unreachable* variant for a transport failure, and this is not one, so the failure is stamped
 * with the fault answer's own `kind`: the server was reached, and it carried no id to quote.
 */
async function answerOf(response: Response): Promise<unknown> {
  const envelope = await envelopeOf(response);
  const failure = envelope.error;
  if (failure !== undefined) throw Object.assign(new Error(failure.message ?? ""), { data: failure.data });
  return envelope.result?.data;
}

/** The envelope this response carries — or the failure of a server that answered something else. */
async function envelopeOf(response: Response): Promise<Envelope> {
  const body = await response.text();
  try {
    return JSON.parse(body) as Envelope;
  } catch {
    throw Object.assign(new Error(`the server answered ${response.status} with a body that is not a tRPC envelope`), {
      data: { kind: "fault", faultId: null },
    });
  }
}

/** A door that changes something. */
export function mutate(procedure: AuthProcedure, input: unknown): Promise<unknown> {
  return fetch(`${LANE}${procedure}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  }).then(answerOf);
}

/** A door that only reads. tRPC serves a query over GET, which is what makes it cacheable at all. */
export function query(procedure: AuthProcedure): Promise<unknown> {
  return fetch(`${LANE}${procedure}`, { method: "GET", credentials: "same-origin" }).then(answerOf);
}
