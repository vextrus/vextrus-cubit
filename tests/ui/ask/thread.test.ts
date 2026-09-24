// @vitest-environment node
/**
 * The conversation kept in the tab (docs/design/s-ask.md I-403): newest first, at most twenty answers,
 * the oldest leaving; a store written by another shape read as empty, never guessed at; how a kept
 * answer stands; and what "Ask again" re-runs — the kept reading, never a model.
 */
import { describe, expect, test } from "vitest";
import type { AskAnswer, AskReading } from "@/modules/takeoff/ask/law";
import { askStateOf } from "../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/states";
import { THREAD_CAP, articleStateOf, keep, keptReading, previousReading, readThread, threadKey, writeThread, type KeptAnswer } from "../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/thread";
import { memoryStorage } from "./support/storage";


const READING: AskReading = { intent: "COUNT", class: "column", kind: null, mark: "C1", level: "GF", by: null, noteKind: null, discipline: null, unitAsked: null };

function kept(id: string, answer: AskAnswer | null = null, extra: Partial<KeptAnswer> = {}): KeptAnswer {
  return { id, question: `question ${id}`, askedAt: "2026-09-24T06:00:00.000Z", stamp: "s1", answer, refusal: null, fault: null, previous: null, declined: false, ...extra };
}

const ANSWERED: AskAnswer = {
  outcome: "ANSWERED",
  routedBy: "GRAMMAR",
  reading: READING,
  followUp: false,
  facts: { statement: { intent: "COUNT", count: { value: "1", unit: null, kind: null, places: 0, at: [] }, struck: 0, typical: null }, partial: null, places: [], records: { lines: [], objects: [], readings: [], cells: [], sheets: [] }, basis: "REGISTER" },
};

describe("the thread is kept in the tab, per reader and project (I-403)", () => {
  test("what is written is read back, newest first, under a key naming the reader, the workspace and the project", () => {
    const storage = memoryStorage();
    const key = threadKey("u1", "t1", "p1");
    expect(key).toContain("u1");
    expect(key).not.toBe(threadKey("u1", "t1", "p2"));
    const thread = keep(keep([], kept("old")), kept("new"));
    writeThread(storage, key, thread);
    expect(readThread(storage, key).map((one) => one.id)).toEqual(["new", "old"]);
    expect(readThread(storage, threadKey("u2", "t1", "p1")), "another reader's tab holds nothing of this one's").toEqual([]);
  });

  test("the twenty-first answer sends the oldest out", () => {
    let thread: KeptAnswer[] = [];
    for (let i = 0; i < THREAD_CAP + 1; i += 1) thread = keep(thread, kept(`a${i}`));
    expect(thread.length).toBe(THREAD_CAP);
    expect(thread[0]?.id).toBe(`a${THREAD_CAP}`);
    expect(thread.map((one) => one.id)).not.toContain("a0");
  });

  test("a store holding something else is read as an empty thread, never guessed at", () => {
    const storage = memoryStorage();
    storage.setItem("k", "{not json");
    expect(readThread(storage, "k")).toEqual([]);
    storage.setItem("k", JSON.stringify([{ id: 1 }, kept("fine")]));
    expect(readThread(storage, "k").map((one) => one.id)).toEqual(["fine"]);
    expect(readThread(null, "k")).toEqual([]);
  });

  test("clearing removes the kept thread", () => {
    const storage = memoryStorage();
    writeThread(storage, "k", [kept("a")]);
    writeThread(storage, "k", []);
    expect(storage.getItem("k")).toBeNull();
  });
});

describe("how a kept answer stands, and what asking it again re-runs", () => {
  test("each article state", () => {
    expect(articleStateOf(kept("a"), true)).toBe("answering");
    expect(articleStateOf(kept("a", ANSWERED), false)).toBe("answered");
    expect(articleStateOf(kept("a", null, { fault: "report-1" }), false)).toBe("failed");
    expect(articleStateOf(kept("a", null, { refusal: "REQUEST_MALFORMED" }), false)).toBe("refused");
    expect(articleStateOf(kept("a", { outcome: "CLARIFY", lead: "AMBIGUOUS", offered: [] }), false)).toBe("clarify");
    expect(articleStateOf(kept("a", { outcome: "CLARIFY", lead: "AMBIGUOUS", offered: [] }, { declined: true }), false), "None of these stands it refused").toBe("refused");
    const partial: AskAnswer = { ...ANSWERED, facts: { ...ANSWERED.facts, partial: { lines: 1, codes: [], objects: 0, reasons: [] } } } as AskAnswer;
    expect(articleStateOf(kept("a", partial), false)).toBe("partial");
  });

  test("Ask again re-runs the reading the answer stood on; a clarify has none", () => {
    expect(keptReading(kept("a", ANSWERED))).toEqual(READING);
    expect(keptReading(kept("a", { outcome: "CLARIFY", lead: "AMBIGUOUS", offered: [] }))).toBeNull();
    expect(previousReading([kept("b", { outcome: "REFUSED", code: "ASK_NOT_UNDERSTOOD", reading: null, held: null }), kept("a", ANSWERED)])).toEqual(READING);
  });
});

describe("the screen's state, first holding wins (§2)", () => {
  const base = { loading: false, denied: false, offline: false, readFailed: false, campaign: true, newest: null } as const;
  test("each cell", () => {
    expect(askStateOf({ ...base, loading: true, denied: true })).toBe("loading");
    expect(askStateOf({ ...base, denied: true, offline: true })).toBe("denied");
    expect(askStateOf({ ...base, offline: true, readFailed: true })).toBe("offline");
    expect(askStateOf({ ...base, newest: "failed" })).toBe("error");
    expect(askStateOf({ ...base, newest: "refused" })).toBe("refused");
    expect(askStateOf({ ...base })).toBe("empty");
    expect(askStateOf({ ...base, campaign: false, newest: "answered" })).toBe("empty");
    expect(askStateOf({ ...base, newest: "partial" })).toBe("partial");
    expect(askStateOf({ ...base, newest: "clarify" }), "a clarify is a question back, not a partial answer").toBe("ready");
    expect(askStateOf({ ...base, newest: "answered" })).toBe("ready");
  });
});
