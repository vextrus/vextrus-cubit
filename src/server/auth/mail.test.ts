/**
 * The outbox's retention sweep, judged where it lives (R-SPINE-001, ARCH-02).
 *
 * A sweep is a `readdir` plus a `stat` per file taken on the thread answering somebody's sign-up, and
 * it enforces a retention measured in hours — so it is due at most once a window, not once a
 * delivery. What is proven here is that a second delivery inside the window takes no pass at all, and
 * that `resetOutboxSweep` arms the next one.
 *
 * The outbox is repo-relative, so each case runs in a directory of its own and the working directory
 * is put back afterwards; no case touches the tree's own outbox.
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MAIL_OUTBOX_DIR, OUTBOX_SWEEP_WINDOW_MS, deliver, outboxDir, resetOutboxSweep } from "./mail";
import { AUTH_TOKEN_TTLS } from "./tokens";

/**
 * Every write and every rename the mail writer makes, recorded as it makes it — the only way to see
 * from outside that a mail is PUT somewhere else and moved into place, rather than grown in place
 * where a reader can already see it. Hoisted, because the mock below is.
 */
const traced = vi.hoisted(() => ({ wrote: [] as string[], renamed: [] as { from: string; to: string }[] }));

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    writeFileSync: ((file: Parameters<typeof real.writeFileSync>[0], data: Parameters<typeof real.writeFileSync>[1], options?: Parameters<typeof real.writeFileSync>[2]) => {
      traced.wrote.push(String(file));
      return real.writeFileSync(file, data, options);
    }) as typeof real.writeFileSync,
    renameSync: ((from: Parameters<typeof real.renameSync>[0], to: Parameters<typeof real.renameSync>[1]) => {
      traced.renamed.push({ from: String(from), to: String(to) });
      return real.renameSync(from, to);
    }) as typeof real.renameSync,
  };
});

const CALLER = process.cwd();
let stage = "";

beforeEach(() => {
  stage = mkdtempSync(join(tmpdir(), "cubit-outbox-"));
  process.chdir(stage);
  resetOutboxSweep();
  traced.wrote.length = 0;
  traced.renamed.length = 0;
});

afterEach(() => {
  process.chdir(CALLER);
  rmSync(stage, { recursive: true, force: true });
});

/** A mail on disk already, aged past anything its credential could still buy. */
function plantSpentMail(name: string): string {
  const directory = outboxDir();
  mkdirSync(directory, { recursive: true });
  const path = join(directory, name);
  writeFileSync(path, "{}\n", "utf8");
  const longAgo = (Date.now() - Math.max(...Object.values(AUTH_TOKEN_TTLS)) * 2) / 1000;
  utimesSync(path, longAgo, longAgo);
  return name;
}

/** One mail the doors would send. */
const MAIL = { to: "someone@example.test", kind: "magic-link", url: "https://example.test/x", token: "t" } as const;

describe("the outbox is swept at most once a window", () => {
  test("the window is shorter than the retention it enforces", () => {
    expect(Number.isFinite(OUTBOX_SWEEP_WINDOW_MS) && OUTBOX_SWEEP_WINDOW_MS > 0, "a sweep window is a real duration").toBe(true);
    expect(
      OUTBOX_SWEEP_WINDOW_MS,
      "a sweep no coarser than the retention it enforces, so a spent credential is dropped within its own resolution",
    ).toBeLessThan(Math.max(...Object.values(AUTH_TOKEN_TTLS)));
  });

  test("a delivery that is due drops spent mail; the next delivery inside the window takes no pass", () => {
    expect(outboxDir().startsWith(stage), `the outbox under test is this case's own: ${outboxDir()}`).toBe(true);
    expect(MAIL_OUTBOX_DIR, "the outbox is repo-relative, which is what makes that so").not.toMatch(/^\//);

    const first = plantSpentMail("spent-first.json");
    deliver({ ...MAIL });
    expect(readdirSync(outboxDir()), "the due delivery swept the spent mail and left its own").not.toContain(first);
    expect(readdirSync(outboxDir()).filter((name) => name.endsWith(".json")).length, "the mail just sent is there").toBe(1);

    const second = plantSpentMail("spent-second.json");
    deliver({ ...MAIL });
    expect(readdirSync(outboxDir()), "a second delivery inside the window takes no pass over the directory").toContain(second);

    resetOutboxSweep();
    deliver({ ...MAIL });
    expect(readdirSync(outboxDir()), "and the sweep armed again drops it").not.toContain(second);
  });
});

/**
 * A mail is a file a reader opens the moment it appears, and every reader of this outbox parses
 * EVERY file it finds. So a mail that is written where readers look is visible while it is still
 * half a mail: a reader that arrives mid-write parses a truncated document and throws, and a writer
 * killed mid-write (the power went at 10:38) leaves that half behind for good. Neither is a fact
 * about the product, and both are read as one.
 *
 * The repair is that no reader ever sees a partial file: the bytes are put down under a name no
 * reader looks at and MOVED into place, and a rename within a directory is atomic — the mail's name
 * either does not exist or names the whole mail.
 */
describe("a mail becomes visible whole or not at all", () => {
  test("the bytes are written under a name no reader reads, then renamed into place", () => {
    deliver({ ...MAIL });

    const landed = readdirSync(outboxDir()).filter((name) => name.endsWith(".json"));
    expect(landed.length, "one delivery, one mail").toBe(1);
    const final = join(outboxDir(), landed[0] as string);

    expect(
      traced.wrote.filter((file) => file.endsWith(".json")),
      "the writer wrote straight to a name readers parse — a reader arriving mid-write reads half a mail",
    ).toEqual([]);
    expect(traced.renamed.map((move) => move.to), "the mail arrived by rename, which is atomic within a directory").toContain(final);

    const moved = traced.renamed.find((move) => move.to === final);
    expect(traced.wrote, "the bytes were written to the very name that was then moved into place").toContain(moved?.from);
  });

  test("no half-written scratch file is left where a reader could find it", () => {
    deliver({ ...MAIL });
    deliver({ ...MAIL });

    const left = readdirSync(outboxDir()).filter((name) => !name.endsWith(".json"));
    expect(left, "a clean delivery leaves nothing behind but the mails it sent").toEqual([]);
  });
});
