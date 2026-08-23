/**
 * The M0 mail seam: outbound auth mail is a row, not an SMTP conversation.
 *
 * The e2e lane serves a production build against a cold database on a machine with no
 * network beyond loopback, so a link that only exists inside a mail provider is a link no
 * journey can follow. Every verification, magic-link and reset mail this product sends lands
 * in `public.auth_mail_outbox` with the absolute, actionable url; J-001 reads the newest row
 * for an address and opens it. A real delivery driver is a later increment reading the same
 * rows — the table is the seam, not a test fixture.
 */
import { runAsSystem } from '../core/db';

/** The whole of `kind ∈ {…}`: the three mails the identity spine sends (R-SPINE-001). */
export type AuthMailKind = 'verify' | 'magic-link' | 'reset';

/**
 * Record one outbound mail. Unscoped on purpose: an address that has no account yet belongs
 * to no tenant, and the reset and magic-link answers are deliberately existence-neutral.
 */
export async function sendAuthMail(
  kind: AuthMailKind,
  toEmail: string,
  url: string,
): Promise<void> {
  const db = runAsSystem('auth mail: an address has no tenant until it has an account');
  await db.insert(db._.fullSchema.authMailOutbox).values({ toEmail, kind, url });
}
