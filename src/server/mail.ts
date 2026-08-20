import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { env } from '../core/env';

/**
 * AC-11 — outbound mail in dev and test. `MAIL_TRANSPORT=file` writes one JSON
 * document per message into `MAIL_OUTBOX_DIR`, which is what a journey reads to
 * follow a verification, magic-link or reset link. `none` drops the message.
 *
 * There is deliberately no SMTP transport yet: nothing in this increment sends
 * mail to a real address, and a transport nobody has configured is a transport
 * nobody has tested.
 */
export type MailKind = 'verify' | 'magic-link' | 'reset';

export interface OutboundMail {
  to: string;
  subject: string;
  kind: MailKind;
  url: string;
}

function outboxDir(): string {
  const configured = env.MAIL_OUTBOX_DIR;
  // The outbox is named by the environment, so this join cannot be statically
  // scoped. Left as it is, the bundler reads it as evidence that the server
  // reaches anywhere under the working directory and traces the entire project
  // into the output — a warning on every build, and a build that carries the
  // whole tree. The outbox is written at run time and never traced.
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function sendMail(message: OutboundMail): void {
  if (env.MAIL_TRANSPORT === 'none') return;

  const dir = outboxDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${Date.now()}-${message.kind}-${randomUUID()}.json`),
    `${JSON.stringify(message, null, 2)}\n`,
  );
}
