// What one closed question's arm of the TypeSafe Jev adapter is (L-AI-01, AM-11).
//
// Jev answers closed questions, so the adapter can only ask the ones this seam spells. Each is an
// ARM: one file, holding the whole of that question — the key set it recognises a request by, the
// task it reads out of the request's canonical content, the guard it refuses to post under, and the
// question it composes with the reading of its answers. `./registry` enumerates them and never
// re-declares one, so a question added to the product is one new file beside this one and one line
// there; two questions never meet in a third file, and no two authors edit the same one.
//
// The wire constants live here rather than in `../typesafe` because every arm speaks them and
// `../typesafe` reads the registry: the arms are the leaf, the adapter the branch, and a cycle
// between them would make the order they are evaluated in matter.
import { JEV_MODEL } from "../../model-ledger.types";
import type { ModelQuestion } from "../questions";
import type { JsonValue } from "../types";

/**
 * Where Jev is reached, and the model asked for — the very id every request is pinned, hashed and
 * billed under (D-002), so what is posted and what is recorded are one spelling.
 */
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = JEV_MODEL;

/** A question as posted, and the reading of its answers into the wire the seam resolves. */
export type TypeSafeQuestion = { body: JsonValue; read: (answers: Record<string, unknown>) => JsonValue };

/** What every arm's task is, at the least: the kind that tells the adapter's callers which one it is. */
export type ArmTask = { readonly kind: string };

/**
 * One closed question, whole. A request is recognised by the exact sorted key set of its canonical
 * JSON content — the same content the request hash is taken over — so what is asked of Jev is a
 * function of the request and of nothing else (L-AI-01 replays deterministically).
 *
 * `recognise` and `compose` are always one arm's: the registry hands a task straight to the arm
 * that recognised it, and no caller holds a task apart from its arm.
 */
export type TypeSafeArm<Task extends ArmTask = ArmTask> = {
  /** The closed question this arm answers, by the name `MODEL_QUESTIONS` files it under. */
  readonly question: ModelQuestion;
  /** The sorted key set of the canonical content this arm recognises, and nothing else recognises. */
  readonly keys: readonly string[];
  /** The task this content is, or null where the key set matched but the content is not that task. */
  recognise(record: Record<string, unknown>): Task | null;
  /**
   * What this arm will not put to Jev at all: it throws, naming the fault, and no question is
   * posted. Infrastructure's fault, never a product decision (B-14). An arm with nothing to refuse
   * states none.
   */
  guard?(task: Task): void;
  /** The question as posted, and the reading of its answers into the wire the seam resolves. */
  compose(task: Task): TypeSafeQuestion;
};

/** The `choice` of one answer, as Jev spelled it, or null where it gave none. */
export function choiceOf(answer: unknown): string | null {
  if (answer === null || typeof answer !== "object") return null;
  const choice = (answer as { choice?: unknown }).choice;
  return typeof choice === "string" ? choice : null;
}
