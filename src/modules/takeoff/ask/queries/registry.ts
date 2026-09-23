// The closed query roster (docs/design/s-ask.md §1.2): one query per intent, assembled by
// enumeration (B-19). A second query claiming an intent throws where the roster is assembled, and an
// intent no query answers fails tsc here (the record's annotation is total) and the unit lane's
// duplicate-key test beside it (tests/ai/ask/registry.test.ts).
import { ASK_INTENTS, type AskIntent } from "../law";
import { COUNT_QUERY } from "./count";
import { LEVEL_HEIGHT_QUERY } from "./level-height";
import { MARKS_QUERY } from "./marks";
import { MEASURED_SO_FAR_QUERY } from "./measured-so-far";
import { MEMBER_TYPE_QUERY } from "./member-type";
import { NOTE_QUERY } from "./note";
import { QUANTITY_QUERY } from "./quantity";
import type { AskQuery } from "./registry-law";
import { SHEET_LIST_QUERY } from "./sheet-list";
import { WHY_NOT_MEASURED_QUERY } from "./why-not-measured";

export type { AskQuery } from "./registry-law";

/** Every query, in the roster's order — the list the registry is assembled from. */
export const ASK_QUERY_LIST: readonly AskQuery[] = Object.freeze([
  COUNT_QUERY,
  MARKS_QUERY,
  QUANTITY_QUERY,
  MEASURED_SO_FAR_QUERY,
  WHY_NOT_MEASURED_QUERY,
  MEMBER_TYPE_QUERY,
  NOTE_QUERY,
  LEVEL_HEIGHT_QUERY,
  SHEET_LIST_QUERY,
]);

/**
 * The registry of a list of queries, keyed by intent. A second query for one intent is a mistake in
 * the roster, never a choice between two readings, so it throws naming the intent; an intent no query
 * answers throws too, because the roster is closed and a question read as it would have no answer.
 */
export function registryOf(queries: readonly AskQuery[]): Readonly<Record<AskIntent, AskQuery>> {
  const held = new Map<AskIntent, AskQuery>();
  for (const query of queries) {
    if (held.has(query.intent)) throw new Error(`the ask query roster answers ${query.intent} twice — one query per intent (§1.2, B-19)`);
    held.set(query.intent, query);
  }
  for (const intent of ASK_INTENTS) {
    if (!held.has(intent)) throw new Error(`the ask query roster answers no ${intent} — every intent of the roster has its query (§1.2)`);
  }
  return Object.freeze(Object.fromEntries(held)) as Readonly<Record<AskIntent, AskQuery>>;
}

/** The one registry. */
export const ASK_QUERIES: Readonly<Record<AskIntent, AskQuery>> = registryOf(ASK_QUERY_LIST);

/** The query an intent is answered by. */
export function queryFor(intent: AskIntent): AskQuery {
  return ASK_QUERIES[intent];
}
