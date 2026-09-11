// The server doors' own refusals (ARCH-03, B-21, R-SPINE-062): what `src/server/call.ts` answers a
// caller whose statement this tier could not read at all — a "use server" action's input, a route
// handler's address, header or JSON body, a tRPC procedure's `.input()`.
//
// This area exists because of R-SPINE-062's first rule: one code, one meaning. `MALFORMED` is the
// MODEL transport's code and L-AI-01 fixes its copy at the shape a PROPOSAL takes; a person who
// posted a bad form field must not be answered with a sentence about a proposal they never asked
// for, and a code whose message has to be vague enough to cover both doors tells neither caller
// what happened. So the transports register their own, here, and the two never drift into one.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ServerRefusalCode = "REQUEST_MALFORMED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const SERVER_REFUSALS: RefusalGroup<ServerRefusalCode> = Object.freeze({
  // B-21: a statement this tier cannot read is the caller's, not an outage of ours — understood,
  // and not carried out. The registered copy is about the STATEMENT, because that is all any door
  // knows about it; which part of the statement was unreadable is operator detail that travels
  // beside the code (`src/server/call.ts`'s sentence, which names the field where the schema said
  // one), never in the registry — a registered message is about the product, not about one request
  // (docs/design/refusal-state.md § 3).
  REQUEST_MALFORMED: Object.freeze({
    code: "REQUEST_MALFORMED",
    message: "What arrived is not in the shape this door reads, so it was not acted on.",
    remedy: "Send the request again in the shape the door states, correcting the part named beside this answer — a statement that cannot be read is never guessed at.",
    severity: "error",
    surface: "inline",
  }),
});
