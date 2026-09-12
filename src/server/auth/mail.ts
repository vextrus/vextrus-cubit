// The outbox transport, and the only one this tree ships. Every mail the identity doors send is
// written as one JSON file under `storage/mail-outbox`, so a journey, a test or a developer reads
// the token out of the tree instead of standing up SMTP (AS-01). `storage/` is
// gitignored, so what the doors send never dirties the working tree.
//
// A mail is a fact about what was sent, not a template: it carries the address, what the link is
// for, the link itself and the token inside it. Rendering a message is a later concern with a real
// provider behind it; nothing here pretends to be one.
import { chmodSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { oncePerWindow } from "./once-per-window";
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

/**
 * How often the outbox is swept. A sweep is a `readdir` plus a `stat` per file, taken synchronously
 * on the thread that is answering somebody's sign-up: run per delivery it is a cost that grows with
 * the number of mails already sent, paid by the person waiting for the next one. The retention it
 * enforces is measured in hours (`OUTBOX_RETENTION_MS`), so a minute's resolution enforces it exactly
 * as well — at most one pass a minute, whoever delivers.
 */
export const OUTBOX_SWEEP_WINDOW_MS = 60_000;

/** That schedule, from the one home of "at most once a window per process" (`./once-per-window`, ARCH-02). */
const sweep = oncePerWindow("outbox-sweep", OUTBOX_SWEEP_WINDOW_MS);

/** Arm the sweep again, so the next delivery takes a pass. */
export function resetOutboxSweep(): void {
  sweep.reset();
}

/**
 * The suffix a mail wears while it is still only half of one. No reader looks at it (`readOutbox`
 * and the sweep both want `.json`), so a mail is invisible until it is whole — and a writer killed
 * mid-write leaves its litter here rather than in the readers' way.
 */
const PARTIAL_SUFFIX = ".tmp";

/** Drop every mail whose credential can no longer be spent. `force` so a concurrent send racing us is not an error. */
function dropSpentMail(directory: string, now: number): void {
  for (const name of readdirSync(directory)) {
    // The sweep is also what ends the litter of a killed writer: a `.json.tmp` past the retention is
    // nobody's half-written mail any more, and nothing else would ever remove it.
    if (!name.endsWith(".json") && !name.endsWith(`.json${PARTIAL_SUFFIX}`)) continue;
    const path = join(directory, name);
    const at = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
    if (at !== undefined && now - at > OUTBOX_RETENTION_MS) rmSync(path, { force: true });
  }
}

/**
 * Send a mail: one file, named so that two mails sent in the same millisecond cannot collide and so
 * that a reader can take the newest by modification time.
 *
 * The mail arrives ATOMICALLY: the bytes are put down under `<name>.json.tmp`, which no reader
 * looks at, and `rename`d into place — a rename within a directory either happened or did not, so
 * the mail's own name never denotes half a mail. Written whole was not enough: every reader of this
 * outbox parses every file it finds, so between the `open` and the last byte the file is already
 * visible and already unparseable, and a writer that dies in that window (a power cut, an OOM kill)
 * leaves a torn file behind for good — which every reader then throws on, reporting an environment's
 * accident as the product's verdict.
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
  const now = Date.now();
  if (sweep.due(now)) dropSpentMail(directory, now);
  const path = join(directory, `${Date.now().toString(36)}-${randomUUID()}.json`);
  const partial = `${path}${PARTIAL_SUFFIX}`;
  writeFileSync(partial, `${JSON.stringify(mail, null, 2)}\n`, { encoding: "utf8", mode: MAIL_MODE });
  renameSync(partial, path);
}
