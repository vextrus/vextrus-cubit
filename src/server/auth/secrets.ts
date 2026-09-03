// R-SPINE-001's secrets, and their one home (B-17, ARCH-02): the password verifier, and the digest
// every bearer secret the tree hands out is stored as.
//
// Nothing the identity tables hold can be presented to a door. A password is kept as a salted scrypt
// derivation and a mailed or cookied token as its SHA-256 digest, so a reader of `users`, `sessions`
// or `auth_tokens` holds no credential — which is what makes "revoke" and "reset" mean anything.
// The primitives are node:crypto's; no vendor hashing package is in the tree, and none is needed.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt's cost, stated once. N=2^15 is the interactive-login profile; r and p are the defaults. */
const SCRYPT = { N: 32_768, r: 8, p: 1, keyLength: 64, saltLength: 16 } as const;

/** How a derivation is written down: the parameters it was made with, then the salt, then the key. */
const FORMAT = "scrypt";

/** A bearer secret: 256 bits of randomness, urlsafe, so it survives a mail client and a query string. */
export function mintSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The digest a bearer secret is stored and looked up by. A token is high-entropy already, so it
 * needs no salt and no stretching — it needs to be unguessable from the row, which one pass of
 * SHA-256 over 256 random bits already is.
 */
export function digestOf(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** A fresh salted derivation of this password, in the one format `verifyPassword` reads. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT.saltLength);
  const key = await derive(password, salt);
  return [FORMAT, SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * Does this password derive the stored key? Compared in constant time, and answered `false` for a
 * stored value this format cannot read rather than throwing — an unreadable hash is a credential
 * that does not match, and the door's answer for that is CREDENTIALS_NOT_VALID like any other.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== FORMAT) return false;
  const cost = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const expected = Buffer.from(parts[5] ?? "", "base64url");
  if (salt.length === 0 || expected.length === 0) return false;
  const key = await derive(password, salt, cost, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Spend on this password what verifying a real one costs, and answer nothing. A door that has no
 * stored hash to compare against — an address with no account — calls this instead of returning
 * early, so the time it takes says nothing about whether the address is registered. The decoy is
 * derived once per process from a value nobody holds, so no password can ever match it.
 */
export async function absorbPassword(password: string): Promise<void> {
  await verifyPassword(password, await settledDecoy());
}

/**
 * The decoy, memoised only once it has settled. Held as the promise, a derivation that *failed* —
 * an exhausted machine, a crypto seam that refused — was memoised as a rejection for the life of the
 * process: every later call at the door awaited the same rejected promise, so the one door that
 * exists to spend time instead threw immediately, and an address with no account was answered
 * measurably sooner than a wrong password ever after. A settled value is remembered; a failure leaves
 * nothing behind, and the next call derives again.
 */
let decoy: string | null = null;

/** The first derivation, while it runs: what callers arriving before it settles wait on. */
let deriving: Promise<string> | null = null;

/**
 * The decoy, derived at most once whether the callers arrive one at a time or all at once. The
 * memo of the *settled* value is what a failure must not poison; the in-flight promise is a second,
 * shorter-lived one that only exists between the first call and that value — without it a burst of
 * unknown addresses would each start a full scrypt derivation at the very door whose cost is
 * deliberately high, and the limiter cannot bound that, since every address is its own key.
 */
async function settledDecoy(): Promise<string> {
  if (decoy !== null) return decoy;
  deriving ??= hashPassword(mintSecret());
  try {
    const settled = await deriving;
    decoy = settled;
    return settled;
  } finally {
    // A refused derivation is never remembered as the settled value, and the in-flight promise is
    // dropped here, so any call made after this frame runs derives again. A caller that arrived while
    // the failing derivation was still in flight — including one entering between the rejection and
    // this line — waits on that same rejection and fails with it: it asked during the outage, and that
    // is its truthful answer. What must not happen is the *next* one inheriting it, and it cannot.
    deriving = null;
  }
}

function derive(
  password: string,
  salt: Buffer,
  cost: { N: number; r: number; p: number } = SCRYPT,
  keyLength: number = SCRYPT.keyLength,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // scrypt's memory ceiling is derived from the cost rather than left at the default 32 MiB, which
    // N=2^15 exceeds: 128 · N · r with headroom, so a lawful cost is never refused by its own guard.
    const maxmem = 256 * cost.N * cost.r;
    scrypt(password, salt, keyLength, { N: cost.N, r: cost.r, p: cost.p, maxmem }, (failure, key) => {
      if (failure !== null) reject(failure);
      else resolve(key);
    });
  });
}
