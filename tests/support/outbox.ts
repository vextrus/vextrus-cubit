// The ONE reader of the mail outbox (ARCH-02). `src/server/auth/mail.ts` writes it; everything that
// reads it — the journeys' mail-link reader (tests/e2e/support/outbox.ts), the db lane's door
// acceptance (db/__tests__/auth-door.test.ts), the invitations suites — reads it through here, so
// the rules about what a mail directory can contain are stated once.
//
// It lives in the shared test tree rather than beside the writer because the outbox has no product
// reader: the product WRITES mail and a suite, a journey or a developer reads it. It is also where
// a reader that answers a torn file by naming it may be written at all — `cubit/fault-or-refusal`
// binds every server-layer catch to a fault report or a refusal, and neither is what a test harness
// owes when the machine it runs on lost power.
//
// The rule that had to be stated: a file in the outbox is not always a mail. A writer killed
// mid-write leaves a torn file; a power cut leaves a zero-byte one (five of them, at 10:38 on
// 2026-09-12). Every reader of the outbox used to `JSON.parse` every file it found, so each of them
// threw `SyntaxError: Unexpected end of JSON input` — an environment's accident read as the
// product's verdict, in a message that named neither the file nor the outbox.
//
// So a file that is not a mail is SKIPPED and NAMED, never thrown on. The mails a run needs are
// still there; the accident is still reported, by name, as what it is. `./mail` now delivers
// atomically, which is what keeps this path empty in a healthy tree — this reader is the second
// half of that repair, for the trees where the accident already happened.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type OutboxMail, outboxDir } from "../../src/server/auth/mail";

/** What a read of the outbox found: the mails, and the files that were not mails. */
export interface OutboxReading {
  /** Every mail the directory holds, NEWEST FIRST — the names carry the instant they were written at. */
  mails: OutboxMail[];
  /** The names of the files that could not be read as mail, in the order they were met. */
  skipped: string[];
  /** One line per skipped file, ready to put in an assertion message: what was skipped and why it happens. */
  notes: string[];
}

/** What a skipped file is reported as, in one home so a suite and a journey report it the same way. */
export function skippedNote(name: string): string {
  return `outbox: skipped ${name} — empty or torn (a crashed writer?)`;
}

/**
 * Read the outbox. A directory that does not exist is an outbox nothing has been sent through yet,
 * not an error: the first delivery creates it.
 *
 * Newest first by name, because the writer names a mail with the base-36 instant it was written at
 * followed by a uuid — so the lexical order is the chronological one, and two mails sent in the same
 * millisecond still cannot collide.
 */
export function readOutbox(directory: string = outboxDir()): OutboxReading {
  const reading: OutboxReading = { mails: [], skipped: [], notes: [] };
  if (!existsSync(directory)) return reading;

  for (const name of readdirSync(directory).sort().reverse()) {
    // `.json.tmp` is a mail still being written: not a file this reader has an opinion about, and
    // not one worth reporting either — the writer is mid-delivery, which is the normal case.
    if (!name.endsWith(".json")) continue;
    const path = join(directory, name);
    const size = statSync(path, { throwIfNoEntry: false })?.size;
    if (size === undefined) continue; // Swept out from under us by a concurrent delivery.
    let mail: OutboxMail | undefined;
    if (size > 0) {
      try {
        mail = JSON.parse(readFileSync(path, "utf8")) as OutboxMail;
      } catch {
        mail = undefined;
      }
    }
    if (mail === undefined) {
      reading.skipped.push(name);
      reading.notes.push(skippedNote(name));
      continue;
    }
    reading.mails.push(mail);
  }
  return reading;
}
