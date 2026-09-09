// SEAM-GATE's closed vocabularies, as law: why a scope is deferred rather than measured. It stands
// apart from the gate itself because the store's CHECK is written from this roster too, and the gate
// reaches the seam — a roster the schema could not import would be a roster spelled twice (B-17).
//
// Importing this file is not importing the gate: it holds no writer and reaches no store. The ban
// the committed scan beside it enforces is on `src/core/gate` as a MODULE, and the schema that
// carries the queue's own CHECK is core, which the ban never governed (SEAM-GATE, ARCH-01).
import { REFUSALS } from "../errors";

/**
 * Why a queue item stands (L-QTY-04). "The same taxonomy serves machine refusals and human
 * deferrals", so a cause is a registered code read from the register rather than a prose string, and
 * the store admits the causes something can actually write: interpreted geometry nothing
 * corroborates is a declared exclusion with a queue item, and never a line.
 */
export const QUEUE_ITEM_CAUSES = [REFUSALS.INTERPRETED_UNCORROBORATED.code] as const;

/** One queue-item cause, drawn from the closed roster above. */
export type QueueItemCause = (typeof QUEUE_ITEM_CAUSES)[number];
