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
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { MAIL_OUTBOX_DIR, OUTBOX_SWEEP_WINDOW_MS, deliver, outboxDir, resetOutboxSweep } from "./mail";
import { AUTH_TOKEN_TTLS } from "./tokens";

const CALLER = process.cwd();
let stage = "";

beforeEach(() => {
  stage = mkdtempSync(join(tmpdir(), "cubit-outbox-"));
  process.chdir(stage);
  resetOutboxSweep();
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
