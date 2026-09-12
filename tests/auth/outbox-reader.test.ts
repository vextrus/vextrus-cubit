/**
 * The one outbox reader, judged on the tree the accident actually leaves behind (ARCH-02).
 *
 * On 2026-09-12 a power cut left five zero-byte files in `storage/mail-outbox`, and every reader of
 * the outbox parsed every file it found: J-000 went red in both lanes, eight db-lane tests went red
 * and the rehearsal's gate went red, each of them reporting `SyntaxError: Unexpected end of JSON
 * input` and naming nothing. What is proven here is the shape of a reader that cannot do that: the
 * mails that ARE there are read, and the files that are not mails are named rather than thrown on.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { deliver, outboxDir, resetOutboxSweep } from "../../src/server/auth/mail";
import { readOutbox, skippedNote } from "../support/outbox";

const CALLER = process.cwd();
let stage = "";

beforeEach(() => {
  stage = mkdtempSync(join(tmpdir(), "cubit-outbox-read-"));
  process.chdir(stage);
  resetOutboxSweep();
});

afterEach(() => {
  process.chdir(CALLER);
  rmSync(stage, { recursive: true, force: true });
});

/** A mail the doors would send, to whatever address the case wants. */
const mailTo = (to: string) => ({ to, kind: "magic-link", url: `https://example.test/${to}`, token: `token-${to}` }) as const;

describe("the outbox reader", () => {
  test("two good mails beside a zero-byte file and a half-written one: the mails are read, the two bad files are named", () => {
    deliver(mailTo("first@example.test"));
    // Two mails sent in the same MILLISECOND are ordered by their write time, not by the uuid in
    // their names — a resend arrives that close, and the newest link is the one that must be spent.
    deliver(mailTo("second@example.test"));

    // The two shapes a killed writer leaves: nothing at all, and a document cut off mid-token.
    const empty = "9zzzzzzz-00000000-0000-0000-0000-000000000001.json";
    const torn = "9zzzzzzz-00000000-0000-0000-0000-000000000002.json";
    writeFileSync(join(outboxDir(), empty), "", "utf8");
    writeFileSync(join(outboxDir(), torn), '{\n  "to": "torn@example.test",\n  "kin', "utf8");

    const reading = readOutbox();

    expect(reading.mails.map((mail) => mail.to), "both good mails are read, newest first — a bad neighbour does not hide them").toEqual([
      "second@example.test",
      "first@example.test",
    ]);
    expect(reading.skipped.slice().sort(), "the files that are not mails are reported BY NAME, so the accident can be found on disk").toEqual([empty, torn].sort());
    expect(reading.notes.slice().sort(), "and each is reported as what it is, in words that name the cause").toEqual([skippedNote(empty), skippedNote(torn)].sort());
  });

  test("two mails sent in the same millisecond are still answered newest first", () => {
    const at = Date.now();
    deliver(mailTo("older@example.test"));
    deliver(mailTo("newer@example.test"));
    expect(Date.now() - at, "the two deliveries landed inside one millisecond, which is how close a resend is").toBeLessThan(2);

    expect(readOutbox().mails.map((mail) => mail.to), "the newest is the one a person is told to spend — the name, not the clock, orders them").toEqual([
      "newer@example.test",
      "older@example.test",
    ]);
  });

  test("an outbox nothing has been sent through is empty, not an error", () => {
    const reading = readOutbox();
    expect(reading, "no delivery has created the directory yet").toEqual({ mails: [], skipped: [], notes: [] });
  });

  test("a mail still being written is neither read nor reported", () => {
    deliver(mailTo("whole@example.test"));
    writeFileSync(join(outboxDir(), "zzzzzzzz-0000.json.tmp"), '{ "to": "part', "utf8");

    const reading = readOutbox();
    expect(reading.mails.map((mail) => mail.to), "the whole mail is read").toEqual(["whole@example.test"]);
    expect(reading.skipped, "a delivery in flight is the normal case, not an accident to report").toEqual([]);
  });
});
