// How a statement becomes an answer (docs/design/s-ask.md I-396, I-398): the grammar reads the
// question — or the reading a person chose is resolved against the project again — and the one query
// of the reading's intent reads the sources. Pure: the server reads the sources (`./index.ts`), and a
// unit test hands the read-back's own.
//
// No model is called here and no ledger row is written: a grammar-routed or person-routed answer is
// code's alone (I-406). The machine's closed choice over what the grammar cannot settle is made by the
// server (`./index.ts`, `./route-question.ts`) and joins this path as a reading routed MODEL.
import { blankReading, readQuestion, resolveReading } from "./grammar";
import type { AskAnswer, AskReading, AskRoutedBy, AskSources, AskStatement } from "./law";
import { queryFor } from "./queries/registry";
import { vocabularyOf, type AskVocabulary } from "./vocabulary";

/** A statement routed: the reading an answer will stand on and who made it, or the answer it already is. */
export type Routed =
  | { readonly outcome: "READ"; readonly reading: AskReading; readonly routedBy: AskRoutedBy; readonly followUp: boolean; readonly callId?: string }
  | Exclude<AskAnswer, { outcome: "ANSWERED" }>;

/**
 * Route one statement: a reading the person chose (a clarify's choice, a kept reading asked again) is
 * resolved against the project and routed PERSON; otherwise the grammar reads the question, against
 * the previous answer's reading where it names only a subject. A previous reading that does not
 * resolve against the project is not read against — the question is read on its own.
 */
export function routeStatement(statement: AskStatement, vocabulary: AskVocabulary): Routed {
  if (statement.reading !== undefined) {
    const resolved = resolveReading(statement.reading, vocabulary);
    return resolved.outcome === "READ" ? { outcome: "READ", reading: resolved.reading, routedBy: "PERSON", followUp: false } : resolved;
  }
  const previous = statement.previous === undefined ? null : resolveReading(statement.previous, vocabulary);
  const read = readQuestion(statement.question, vocabulary, previous !== null && previous.outcome === "READ" ? previous.reading : null);
  return read.outcome === "READ" ? { outcome: "READ", reading: read.reading, routedBy: "GRAMMAR", followUp: read.followUp } : read;
}

/** Answer a reading from the sources, through the one query of its intent. */
export function answerReading(routed: Extract<Routed, { outcome: "READ" }>, sources: AskSources): AskAnswer {
  const facts = queryFor(routed.reading.intent).answer(routed.reading, sources);
  if ("outcome" in facts) return facts;
  return { outcome: "ANSWERED", routedBy: routed.routedBy, reading: routed.reading, followUp: routed.followUp, facts, ...(routed.callId === undefined ? {} : { callId: routed.callId }) };
}

/** One statement, answered from sources already read — the whole engine, pure. */
export function answerStatement(statement: AskStatement, sources: AskSources): AskAnswer {
  const routed = routeStatement(statement, vocabularyOf(sources));
  return routed.outcome === "READ" ? answerReading(routed, sources) : routed;
}

export { blankReading };
