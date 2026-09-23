// The shape one S-Ask query takes (docs/design/s-ask.md §1.2): its intent, where it reads from, which
// sources beyond the register and the stack it needs loaded, and the pure reading of them. A leaf the
// registry and every query import, so the registry imports the queries and nothing imports it back.
import type { AskBasis, AskFacts, AskIntent, AskReading, AskRefused, AskSourceNeed, AskSources } from "../law";
import { ASK_REFUSAL_CODES } from "../law";

/** One query of the closed roster: one per intent (the registry's duplicate-key test holds it). */
export type AskQuery = {
  readonly intent: AskIntent;
  readonly basis: AskBasis;
  readonly needs: readonly AskSourceNeed[];
  readonly answer: (reading: AskReading, sources: AskSources) => AskFacts | AskRefused;
};

/** Nothing is measured for what was asked: no campaign, or no line under the question (I-399). */
export function notMeasured(reading: AskReading): AskRefused {
  return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.notMeasured, reading, held: null };
}
