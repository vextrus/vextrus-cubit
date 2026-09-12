// The mail outbox as a journey reads it (R-SPINE-001, AS-01): the identity doors deliver to
// `storage/mail-outbox` as JSON, so a journey follows a real link without SMTP.
//
// The newest mail for an address and a kind wins: the directory outlives a single run, and a person
// who asks for a second link is meant to use the newest email — the same rule the product's own
// copy states.
import { join } from "node:path";
import { MAIL_OUTBOX_DIR, type OutboxMail } from "../../../src/server/auth/mail";
import { readOutbox } from "../../support/outbox";

/** How long a journey waits for a mail the server writes after it has already answered. */
const WAIT_MS = 10_000;
const POLL_MS = 100;

function outboxDir(): string {
  return join(process.cwd(), MAIL_OUTBOX_DIR);
}

/**
 * Every mail on disk, newest first, read through the product's ONE reader — which skips a zero-byte
 * or torn file (a writer the machine killed) and names it, rather than throwing on it. This reader
 * used to parse every file it found, so five zero-byte files left by a power cut took J-000 red in
 * both lanes with `SyntaxError: Unexpected end of JSON input`, naming nothing.
 */
function delivered(): { mails: OutboxMail[]; notes: string[] } {
  const reading = readOutbox(outboxDir());
  return { mails: reading.mails, notes: reading.notes };
}

/** The newest mail of this kind sent to this address, waited for rather than assumed. */
export async function newestMail(to: string, kind: OutboxMail["kind"]): Promise<OutboxMail> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const reading = delivered();
    const found = reading.mails.find((mail) => mail.to === to.toLowerCase() && mail.kind === kind);
    if (found !== undefined) return found;
    if (Date.now() > deadline) {
      const skipped = reading.notes.length === 0 ? "" : `\n${reading.notes.join("\n")}`;
      throw new Error(`no ${kind} mail for ${to} reached ${outboxDir()} within ${WAIT_MS}ms${skipped}`);
    }
    await new Promise((wake) => setTimeout(wake, POLL_MS));
  }
}
