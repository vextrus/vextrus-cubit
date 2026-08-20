import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The file mail transport (AC-11): with MAIL_TRANSPORT=file every outbound
 * message lands in MAIL_OUTBOX_DIR as one JSON document.
 */
export interface OutboxMessage {
  to: string;
  subject: string;
  kind: 'verify' | 'magic-link' | 'reset';
  url: string;
}

export function outboxDir(): string {
  const configured = process.env.MAIL_OUTBOX_DIR ?? '.mail-outbox';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function readOutbox(): OutboxMessage[] {
  let entries: string[];
  try {
    entries = readdirSync(outboxDir());
  } catch {
    return [];
  }
  const messages: OutboxMessage[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      messages.push(JSON.parse(readFileSync(path.join(outboxDir(), entry), 'utf8')) as OutboxMessage);
    } catch {
      // a half-written file on the next poll, not a failure
    }
  }
  return messages;
}

export function messagesFor(to: string, kind?: OutboxMessage['kind']): OutboxMessage[] {
  return readOutbox().filter(
    (m) => m.to?.toLowerCase() === to.toLowerCase() && (kind === undefined || m.kind === kind),
  );
}

/** Waits for the newest message of `kind` addressed to `to` and returns it. */
export async function waitForMail(
  to: string,
  kind: OutboxMessage['kind'],
  options: { timeoutMs?: number; after?: number } = {},
): Promise<OutboxMessage> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const after = options.after ?? 0;
  const deadline = Date.now() + timeoutMs;
  let seen = 0;
  while (Date.now() < deadline) {
    const found = messagesFor(to, kind);
    seen = found.length;
    if (found.length > after) {
      const message = found[found.length - 1] as OutboxMessage;
      if (typeof message.url === 'string' && message.url.length > 0) return message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `no "${kind}" mail for ${to} in ${outboxDir()} after ${timeoutMs}ms ` +
      `(saw ${seen}, needed more than ${after}) — MAIL_TRANSPORT=file must write ` +
      '{to, subject, kind, url} per message',
  );
}
