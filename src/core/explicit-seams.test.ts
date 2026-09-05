/**
 * AC-5 of the src/core debt sweep: explicit where it was implicit (ARCH-02, ARCH-03, B-17, B-21,
 * R-SPINE-021, R-SPINE-030).
 *
 * Three things the tree did silently and now says out loud: the truncation the dead-letter view used
 * to swallow, the directory entry `put` now makes durable, and the idempotence storage's own
 * acceptance now proves by property instead of by a frozen listing.
 *
 * The store is substituted (the runtime's own idiom in src/core/jobs/runtime.test.ts) so the view's
 * bound is judged without a database; `node:fs/promises` is wrapped rather than replaced, so `put`
 * really writes and really links and only the calls it makes are counted.
 *
 * AC-5(a) (the empty-detail sentence) lives in src/core/model/empty-detail-sentences.test.ts:
 * L-AI-01 makes src/core/model/ the one place the seam's interior may be named.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { sourceOf } from "./__tests__/support/read-source";
import { makeStorage } from "./storage";

const JOBS_BARREL = "src/core/jobs/index.ts";
const STORAGE_MODULE = "src/core/storage/index.ts";
const STORAGE_ACCEPTANCE = "src/core/storage/storage.test.ts";

/** What AC-5(d) requires of the acceptance it re-shapes: one assertion becomes three (Q-08). */
const AC1_ASSERTIONS_AT_LEAST = 12;

const STUB_URL = "postgres://stub:stub@127.0.0.1:1/stub";

/** How many dead jobs the substituted store's log holds; a case sets it before it reads the view. */
const store = vi.hoisted(() => ({ dead: 0 }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  let seq = 0;
  const substituted = {
    open: async () => undefined,
    ping: async () => undefined,
    declareQueue: async () => undefined,
    consume: async () => undefined,
    publish: async (_name: string, jobId: string) => jobId,
    queueStateOf: async () => "pending",
    withKeyLock: async (_kind: string, _key: string, _requestId: string, work: () => Promise<unknown>) => await work(),
    liveJobFor: async () => null,
    liveClaims: async () => [],
    claimKey: async () => undefined,
    releaseKey: async () => undefined,
    append: async (draft: Record<string, unknown>) => ({ ...draft, seq: (seq += 1), at: new Date().toISOString() }),
    appendEnding: async (draft: Record<string, unknown>) => ({ ...draft, seq: (seq += 1), at: new Date().toISOString() }),
    read: async () => [],
    // The store honours whatever bound the caller asks for, so the view is free to ask for one more
    // than the limit, or for a count — only the answer it publishes is graded.
    deadLetterRows: async (_statuses: readonly string[], limit: number) =>
      Array.from({ length: Math.min(limit, store.dead) }, (_unused, at) => ({
        seq: at + 1,
        jobId: `dead-job-${String(at).padStart(4, "0")}`,
        kind: "probe",
        key: `dead-key-${at}`,
        step: "finish",
        status: "failed",
        attempt: 1,
        refusalCode: null,
        faultId: null,
        detail: { cause: `job ${at} ran out of attempts` },
        at: new Date().toISOString(),
        elapsedMs: 1,
      })),
    listen: async () => undefined,
    close: async () => undefined,
  };
  return { ...actual, jobsStore: () => substituted };
});

/** Every `open` the seam made, in order, and how often each handle was told to sync. */
const files = vi.hoisted(() => ({ opens: [] as { path: string; syncs: number }[] }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    default: actual,
    open: async (path: Parameters<typeof actual.open>[0], ...rest: unknown[]): Promise<unknown> => {
      const opened = await (actual.open as (...args: unknown[]) => Promise<Awaited<ReturnType<typeof actual.open>>>)(path, ...rest);
      const record = { path: String(path), syncs: 0 };
      files.opens.push(record);
      return new Proxy(opened, {
        get(target, property, receiver): unknown {
          if (property === "sync") {
            return async (): Promise<void> => {
              record.syncs += 1;
              await target.sync();
            };
          }
          const held: unknown = Reflect.get(target, property, receiver);
          return typeof held === "function" ? held.bind(target) : held;
        },
      });
    },
  };
});

let scratchRoot = "";

beforeAll(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), "cubit-explicit-seams-"));
});

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe("AC-5: explicit where it was implicit", () => {
  test("AC-5(b): deadLetterView says whether it truncated, and deadLetters is its projection", async () => {
    const jobs = (await import("./jobs/index")) as Record<string, unknown>;
    const limit = jobs["DEAD_LETTER_LIMIT"] as number;
    expect(limit, "the bound an operator's view is read under is unchanged").toBe(200);

    const deadLetters = jobs["deadLetters"] as () => Promise<{ jobId: string }[]>;
    const startJobsRuntime = jobs["startJobsRuntime"] as (url: string) => Promise<void>;
    const stopJobsRuntime = jobs["stopJobsRuntime"] as () => Promise<void>;

    await startJobsRuntime(STUB_URL);
    try {
      // The substituted store answers whatever bound it is asked for, and the runtime really is
      // reading through it — proved before anything the sweep has yet to build is reached for.
      store.dead = 2;
      expect((await deadLetters()).length, "the runtime reads its dead letters through the store this case substituted").toBe(2);

      expect(typeof jobs["deadLetterView"], `${JOBS_BARREL} exports deadLetterView — a view that truncates silently answers a question nobody asked (R-SPINE-030)`).toBe("function");
      const deadLetterView = jobs["deadLetterView"] as () => Promise<{ letters: { jobId: string }[]; truncated: boolean }>;

      store.dead = limit + 1;
      const truncated = await deadLetterView();
      expect(truncated.letters.length, "the view never answers more than the bound it is read under").toBe(limit);
      expect(truncated.truncated, "…and says so when the log holds more dead jobs than the bound").toBe(true);
      expect(await deadLetters(), "deadLetters is exactly the view's letters — one derivation, one answer (ARCH-02)").toEqual(truncated.letters);

      store.dead = limit;
      const whole = await deadLetterView();
      expect(whole.letters.length, "a log holding exactly the bound is answered whole").toBe(limit);
      expect(whole.truncated, "…and nothing was left out, so nothing is claimed to have been").toBe(false);

      store.dead = 3;
      const few = await deadLetterView();
      expect(few.letters.length, "a short log answers every dead job it holds").toBe(3);
      expect(few.truncated, "…with no truncation to disclose").toBe(false);
      expect(await deadLetters(), "…and deadLetters still answers that same array").toEqual(few.letters);
    } finally {
      store.dead = 0;
      await stopJobsRuntime();
    }
  });

  test("AC-5(c): put opens the tenant prefix directory and syncs it after the link", async () => {
    const root = mkdtempSync(join(scratchRoot, "objects-"));
    const storage = makeStorage({ root, signingSecret: randomBytes(32).toString("hex") });
    const tenantId = randomUUID();
    files.opens.length = 0;

    const stored = await storage.put(tenantId, new Uint8Array(randomBytes(64)));

    // The prefix is derived from what the put laid down, never transcribed from the seam's rule.
    const prefixes = readdirSync(root);
    expect(prefixes.length, "the put laid down exactly one tenant prefix").toBe(1);
    const prefixDir = join(root, prefixes[0] ?? "");
    expect(readdirSync(prefixDir), "…holding the object at its own address").toContain(stored.sha256);

    const directoryOpens = files.opens.filter((opened) => opened.path === prefixDir);
    expect(directoryOpens.length, "put opens the tenant prefix DIRECTORY — an object whose directory entry is not durable is a promise the seam cannot keep (R-SPINE-021)").toBe(1);
    expect(directoryOpens[0]?.syncs, "…and tells that handle to sync, once, after the link").toBe(1);

    // white-box: AC-5(c) — "its comment claims exactly that durability" is a property of the text:
    // a comment that overclaims is invisible to every call the seam makes.
    const comments = sourceOf(STORAGE_MODULE, "AC-5(c) reads the seam's own durability claim")
      .split("\n")
      .filter((line) => line.trimStart().startsWith("//") || line.trimStart().startsWith("*"))
      .join(" ");
    expect(
      comments,
      `${STORAGE_MODULE} ties the DIRECTORY entry to durability in its own words — the old comment claimed the file's bytes and said nothing of the entry that names them (Q-17)`,
    ).toMatch(/(director(y|ies)[^.]{0,200}?(fsync|sync|durab|flush))|((fsync|sync|durab|flush)[^.]{0,200}?director(y|ies))/i);
  });

  test("AC-5(d): storage's own AC-1 proves idempotence by property, and its assertion count does not fall", () => {
    // white-box: AC-5(d) — the criterion is about the SHAPE of an existing acceptance's assertions
    // (Q-08's structural diff), which no call into the product can observe.
    const lines = sourceOf(STORAGE_ACCEPTANCE, "AC-5(d) reads the acceptance whose AC-1 the sweep re-shapes").split("\n");
    const opens = lines.findIndex((line) => line.includes('test("AC-1:'));
    expect(opens, `${STORAGE_ACCEPTANCE} declares an AC-1 case`).toBeGreaterThan(-1);
    const indent = " ".repeat((lines[opens] ?? "").length - (lines[opens] ?? "").trimStart().length);
    const closes = lines.findIndex((line, at) => at > opens && line === `${indent}});`);
    expect(closes, "…that a same-indent close bounds").toBeGreaterThan(opens);
    const body = lines.slice(opens, closes).join("\n");

    expect(body.split("expect(").length - 1, `AC-1 keeps at least ${AC1_ASSERTIONS_AT_LEAST} assertions — one whole-listing equality becomes three properties, so the count rises rather than falls (Q-08)`).toBeGreaterThanOrEqual(
      AC1_ASSERTIONS_AT_LEAST,
    );
    expect(body, "AC-1 no longer freezes the tenant prefix's whole listing").not.toMatch(/entriesUnder\([\s\S]{0,200}?\)\.toEqual\(/);
    expect(body, "…it asserts the stored address is among the prefix's entries").toMatch(/\)\.toContain\(/);
    expect(body, "…that no entry is a staging copy left behind").toContain(".staging");
    expect(body.split("ADDRESS_SHAPE").length - 1, "…and that exactly one entry is an address at all, beside the answer's own shape check").toBeGreaterThanOrEqual(2);
  });
});
