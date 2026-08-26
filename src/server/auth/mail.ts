// The outbox transport, and the only one this tree ships. Every mail the identity doors send is
// written as one JSON file under `storage/mail-outbox`, so a journey, a test or a developer reads
// the token out of the tree instead of standing up SMTP (AS-01). `storage/` is
// gitignored, so what the doors send never dirties the working tree.
//
// A mail is a fact about what was sent, not a template: it carries the address, what the link is
// for, the link itself and the token inside it. Rendering a message is a later concern with a real
// provider behind it; nothing here pretends to be one.
import { chmodSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { AUTH_TOKEN_TTLS, type MailKind } from "./tokens";

/** The outbox's one home (ARCH-02), repo-relative so it resolves inside whatever tree is running. */
export const MAIL_OUTBOX_DIR = "storage/mail-outbox";

/** What a mailed link is for, declared with the purposes it names (`./tokens`) and re-exported here. */
export type { MailKind };

/** One mail, exactly as the file on disk spells it. */
export interface OutboxMail {
  to: string;
  kind: MailKind;
  url: string;
  token: string;
}

/** Where the outbox actually is: the repo-relative directory, resolved against the running process. */
export function outboxDir(): string {
  return isAbsolute(MAIL_OUTBOX_DIR) ? MAIL_OUTBOX_DIR : resolve(process.cwd(), MAIL_OUTBOX_DIR);
}

/**
 * What is inside a mail, and therefore how it is kept.
 *
 * Every mail carries a live single-use credential: a magic link is a session, a reset link is a
 * password change, a verification link is a proven address. Anyone who can read the file holds them
 * — so the outbox is the sending account's alone (`0o700`), each mail is readable only by it
 * (`0o600`), and neither is left to whatever the umask of the process that first created the
 * directory happened to be.
 */
const OUTBOX_MODE = 0o700;
const MAIL_MODE = 0o600;

/**
 * How long a mail is kept: exactly as long as the longest-lived credential one can contain. Past its
 * TTL the token inside is spent as far as `consumeToken` is concerned, and the file is then a
 * credential-shaped thing on disk that can buy nothing and that nothing else would ever remove — so
 * the seam that writes them is the seam that ends them. Read from `AUTH_TOKEN_TTLS` rather than
 * restated, so a TTL changed there changes what the outbox keeps (ARCH-02).
 */
const OUTBOX_RETENTION_MS = Math.max(...Object.values(AUTH_TOKEN_TTLS));

/** Drop every mail whose credential can no longer be spent. `force` so a concurrent send racing us is not an error. */
function dropSpentMail(directory: string, now: number): void {
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) continue;
    const path = join(directory, name);
    const at = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
    if (at !== undefined && now - at > OUTBOX_RETENTION_MS) rmSync(path, { force: true });
  }
}

/**
 * Send a mail: one file, named so that two mails sent in the same millisecond cannot collide and so
 * that a reader can take the newest by modification time. Written whole rather than appended — a
 * half-written JSON file is a mail nobody can read.
 *
 * The spent mail is dropped before the new one is written, so a delivery that fails is a delivery
 * that failed rather than one that also left the outbox unswept.
 */
export function deliver(mail: OutboxMail): void {
  const directory = outboxDir();
  mkdirSync(directory, { recursive: true, mode: OUTBOX_MODE });
  // `mkdir`'s mode only applies to a directory it creates: an outbox already on disk from an earlier
  // run keeps whatever it was made with, so the mode is stated on every send rather than once.
  chmodSync(directory, OUTBOX_MODE);
  dropSpentMail(directory, Date.now());
  writeFileSync(join(directory, `${Date.now().toString(36)}-${randomUUID()}.json`), `${JSON.stringify(mail, null, 2)}\n`, {
    encoding: "utf8",
    mode: MAIL_MODE,
  });
}
