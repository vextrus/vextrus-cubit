// The mailed single-use tokens R-SPINE-001 runs on: verifying an address, standing in for a
// password once, and authorising one password reset. Issuing and spending them is one concern with
// one home (B-17, ARCH-02) — a door asks for a token or spends one, and never writes `auth_tokens`
// itself.
//
// A token is a bearer secret, so the row holds only its digest (`./secrets`): a reader of the table
// cannot present anything. Spending is a single conditional UPDATE rather than a read followed by a
// write, so two callers racing one link cannot both be admitted.
import { and, authTokens, eq, gt, isNull, type SystemDb, type TenantTx } from "../../core/db";
import type { MailKind } from "./mail";
import { digestOf, mintSecret } from "./secrets";
import { tokenNotValid } from "./refusals";

/**
 * How long each kind of link lives. A verification link is followed at leisure from an inbox, while
 * the two that hand out a session on their own are short: a magic link is used within the minutes
 * it takes to switch to the mail client, and a reset is given the length of an interruption.
 */
export const AUTH_TOKEN_TTLS: Readonly<Record<"verifyEmail" | "magicLink" | "passwordReset", number>> = Object.freeze({
  verifyEmail: 24 * 60 * 60_000,
  magicLink: 15 * 60_000,
  passwordReset: 60 * 60_000,
});

/** What a token authorises — the compiler's own list, so a purpose cannot be spelled by a typo. */
export type AuthTokenPurpose = keyof typeof AUTH_TOKEN_TTLS;

/**
 * A purpose and the mail that carries it are the same fact under two names, so the row's `kind`
 * column is spelled in the mail's vocabulary: a token in the table and the message that delivered
 * it read alike, and nobody has to hold two glossaries.
 */
export const TOKEN_KINDS: Readonly<Record<AuthTokenPurpose, MailKind>> = Object.freeze({
  verifyEmail: "verify-email",
  magicLink: "magic-link",
  passwordReset: "password-reset",
});

/** The handles a token may be written through: a system-scoped one, or a transaction's own. */
type Writer = SystemDb | TenantTx;

/**
 * Mint a token for this account and write its digest down. The secret is answered, never stored —
 * this return value is the only time the tree holds it, which is what the mail then carries.
 */
export async function issueToken(db: Writer, userId: string, purpose: AuthTokenPurpose): Promise<string> {
  const secret = mintSecret();
  await db.insert(authTokens).values({
    userId,
    kind: TOKEN_KINDS[purpose],
    tokenHash: digestOf(secret),
    expiresAt: new Date(Date.now() + AUTH_TOKEN_TTLS[purpose]),
  });
  return secret;
}

/**
 * Spend a token, or refuse. Unknown, expired, already consumed and issued-for-something-else are one
 * answer (TOKEN_NOT_VALID): a door that distinguished them would say which links exist. The row is
 * claimed by the UPDATE's own predicate, so the first of two racing callers gets the account and the
 * second gets the refusal.
 */
export async function consumeToken(db: Writer, secret: string, purpose: AuthTokenPurpose): Promise<{ userId: string }> {
  const now = new Date();
  const claimed = await db
    .update(authTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, digestOf(secret)),
        eq(authTokens.kind, TOKEN_KINDS[purpose]),
        isNull(authTokens.consumedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .returning({ userId: authTokens.userId });

  const row = claimed[0];
  if (row === undefined) throw tokenNotValid(TOKEN_KINDS[purpose]);
  return { userId: row.userId };
}
