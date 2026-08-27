// The mail outbox as a journey reads it (R-SPINE-001, AS-01): the identity doors deliver to
// `storage/mail-outbox` as JSON, so a journey follows a real link without SMTP.
//
// The newest mail for an address and a kind wins: the directory outlives a single run, and a person
// who asks for a second link is meant to use the newest email — the same rule the product's own
// copy states.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MAIL_OUTBOX_DIR, type OutboxMail } from "../../../src/server/auth/mail";

/** How long a journey waits for a mail the server writes after it has already answered. */
const WAIT_MS = 10_000;
const POLL_MS = 100;

function outboxDir(): string {
  return join(process.cwd(), MAIL_OUTBOX_DIR);
}

/** Every mail on disk, newest first — the file names carry the instant they were written at. */
function delivered(): OutboxMail[] {
  const directory = outboxDir();
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")) as OutboxMail);
}

/** The newest mail of this kind sent to this address, waited for rather than assumed. */
export async function newestMail(to: string, kind: OutboxMail["kind"]): Promise<OutboxMail> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const found = delivered().find((mail) => mail.to === to.toLowerCase() && mail.kind === kind);
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`no ${kind} mail for ${to} reached ${outboxDir()} within ${WAIT_MS}ms`);
    await new Promise((wake) => setTimeout(wake, POLL_MS));
  }
}
