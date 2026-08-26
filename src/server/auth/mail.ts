// The outbox transport, and the only one this tree ships. Every mail the identity doors send is
// written as one JSON file under `storage/mail-outbox`, so a journey, an acceptance suite or a
// developer reads the token out of the tree instead of standing up SMTP (AS-01). `storage/` is
// gitignored, so what the doors send never dirties the working tree.
//
// A mail is a fact about what was sent, not a template: it carries the address, what the link is
// for, the link itself and the token inside it. Rendering a message is a later concern with a real
// provider behind it; nothing here pretends to be one.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";

/** The outbox's one home, repo-relative as the increment's interfaces state it. */
export const MAIL_OUTBOX_DIR = "storage/mail-outbox";

/** What a mailed link is for. One kind per door that sends one (R-SPINE-001). */
export type MailKind = "verify-email" | "magic-link" | "password-reset";

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
 * Send a mail: one file, named so that two mails sent in the same millisecond cannot collide and so
 * that a reader can take the newest by modification time. Written whole rather than appended — a
 * half-written JSON file is a mail nobody can read.
 */
export function deliver(mail: OutboxMail): void {
  const directory = outboxDir();
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${Date.now().toString(36)}-${randomUUID()}.json`), `${JSON.stringify(mail, null, 2)}\n`, "utf8");
}
