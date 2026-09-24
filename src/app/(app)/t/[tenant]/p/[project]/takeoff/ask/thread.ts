// The conversation, kept in the tab (docs/design/s-ask.md I-403): newest first, at most twenty
// answers, in the tab's `sessionStorage` under the reader, the workspace and the project — so Back
// re-asks nothing and bills nothing, and a return from the viewer restores the thread with no request.
//
// Each kept answer holds its facts, the reading it stands on (what "Ask again" re-runs — never a
// model), and the STAMP the page was read at; a kept answer whose stamp is not the page's says so.
// Pure over a `Storage`, so the suite hands in its own.
import type { AskAnswer, AskReading } from "@/modules/takeoff/ask/law";
import { readKept, writeKept } from "@/ui/tab-store";
import { isPartial } from "./present";
import type { AskArticleState } from "./states";

/** The most answers a tab keeps; the oldest leaves when one more is asked (I-403). */
export const THREAD_CAP = 20;

/** The version of the kept shape: a store written by another shape is read as empty, never guessed at. */
const VERSION = "cubit.ask.v1";

/** One answer as the thread keeps it. */
export type KeptAnswer = {
  readonly id: string;
  readonly question: string;
  /** When it was asked, as an ISO instant (the `ask-asked` RelativeTime reads it). */
  readonly askedAt: string;
  /** The stamp of what the page read when it was asked (I-403). */
  readonly stamp: string;
  /** What the door answered, where it answered. */
  readonly answer: AskAnswer | null;
  /** A registered code the door refused the statement with (`REQUEST_MALFORMED`, `PERMISSION_NOT_HELD`). */
  readonly refusal: string | null;
  /** The report id of the fault a question met, where it met one. */
  readonly fault: string | null;
  /** The previous answer's reading the question was asked against, if any (a follow-up). */
  readonly previous: AskReading | null;
  /** The person's choice in a clarify was "None of these". */
  readonly declined: boolean;
};

/** The key a tab keeps one reader's conversation on one project under. */
export function threadKey(userId: string, tenantId: string, projectId: string): string {
  return `${VERSION}:${userId}:${tenantId}:${projectId}`;
}

function isKept(value: unknown): value is KeptAnswer {
  if (typeof value !== "object" || value === null) return false;
  const kept = value as Record<string, unknown>;
  return typeof kept["id"] === "string" && typeof kept["question"] === "string" && typeof kept["askedAt"] === "string" && typeof kept["stamp"] === "string";
}

/** The kept thread, newest first — empty where nothing is kept or the store cannot be read. */
export function readThread(storage: Storage | null, key: string): KeptAnswer[] {
  const parsed = readKept(storage, key);
  return Array.isArray(parsed) ? parsed.filter(isKept).slice(0, THREAD_CAP) : [];
}

/** Keep the thread, newest first, at most `THREAD_CAP` of it; an empty thread takes the key away. */
export function writeThread(storage: Storage | null, key: string, thread: readonly KeptAnswer[]): void {
  writeKept(storage, key, thread.length === 0 ? null : thread.slice(0, THREAD_CAP));
}

/** The answer a reader last followed a link from, kept beside the thread (I-403). */
export function originKey(key: string): string {
  return `${key}:origin`;
}

/** Read the kept origin: an answer's id, or null. */
export function readOrigin(storage: Storage | null, key: string): string | null {
  const held = readKept(storage, originKey(key));
  return typeof held === "string" ? held : null;
}

/** Keep, or clear, the origin. */
export function writeOrigin(storage: Storage | null, key: string, id: string | null): void {
  writeKept(storage, originKey(key), id);
}

/** A new answer at the head of the thread, the oldest leaving past the cap (I-403). */
export function keep(thread: readonly KeptAnswer[], answer: KeptAnswer): KeptAnswer[] {
  return [answer, ...thread.filter((one) => one.id !== answer.id)].slice(0, THREAD_CAP);
}

/** How a kept answer stands (`ask-answer[data-answer]`, §1.1). */
export function articleStateOf(kept: KeptAnswer, answering: boolean): AskArticleState {
  if (answering) return "answering";
  if (kept.fault !== null) return "failed";
  if (kept.refusal !== null || kept.declined) return "refused";
  if (kept.answer === null) return "answering";
  if (kept.answer.outcome === "REFUSED") return "refused";
  if (kept.answer.outcome === "CLARIFY") return "clarify";
  return isPartial(kept.answer) ? "partial" : "answered";
}

/**
 * The reading "Ask again" re-runs (I-403): the one the answer stood on — the grammar's, the person's
 * choice or the machine's — so asking again never asks a model again. Null where no reading was made,
 * and the question itself is asked again.
 */
export function keptReading(kept: KeptAnswer): AskReading | null {
  const answer = kept.answer;
  if (answer === null) return null;
  if (answer.outcome === "ANSWERED") return answer.reading;
  if (answer.outcome === "REFUSED") return answer.reading;
  return null;
}

/** The reading a follow-up is read against: the newest answer that stood on one. */
export function previousReading(thread: readonly KeptAnswer[]): AskReading | null {
  for (const kept of thread) {
    if (kept.answer !== null && kept.answer.outcome === "ANSWERED") return kept.answer.reading;
  }
  return null;
}
