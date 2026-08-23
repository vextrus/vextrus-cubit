/**
 * The rate limit for the auth acts that are *not* better-auth endpoints (R-SPINE-001,
 * "rate-limited auth endpoints"; Q-12).
 *
 * better-auth's own limiter wraps `/api/auth/*` and nothing else, and this product's sign-up
 * is deliberately a Server Action rather than `/sign-up/email` (R-SPINE-002's "in the
 * user-create transaction"). Left alone, the one door a person actually uses is the one door
 * with no limit on it: an attacker could mint accounts — and personal tenants, and `tenants`
 * rows — as fast as the box allows, and could read the distinct `auth.error.emailTaken` reply
 * as an unmetered account-existence oracle against a wordlist, while `/sign-in`, `/magic-link`
 * and `/reset-password` are all deliberately existence-neutral (docs/design/s-auth.md §4).
 *
 * It is the same shape as the limiter it stands beside, on purpose: the same window, a fixed
 * counter per client per act, in memory because M0 is one instance (risk note 1). The client
 * is the address `x-forwarded-for` carries — `next start` fills that header from the socket's
 * remote address when the request brings none, which is what makes the bucket per client
 * rather than one shared bucket for everyone.
 */
import { headers } from 'next/headers';

/** The window every auth rule shares: a minute is what `auth.error.rateLimited` promises. */
const WINDOW_MS = 60_000;

/** The client a request could not be attributed to — one shared bucket, deliberately. */
const UNATTRIBUTED = 'no-trusted-ip';

/** Entries older than this are dropped on the next look, so the map cannot grow forever. */
const SWEEP_EVERY = 512;

interface Bucket {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, Bucket>();

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

/**
 * The address this request came from, as the forwarded header reports it. The leftmost entry
 * of a multi-hop chain is whatever the client wrote, so a chain is not attributed at all —
 * the deployment that has a proxy names it to better-auth, and both limiters read the same
 * header.
 */
async function clientOf(): Promise<string> {
  const forwarded = (await headers()).get('x-forwarded-for');
  if (forwarded === null) return UNATTRIBUTED;
  const hops = forwarded
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop !== '');
  return hops.length === 1 ? (hops[0] ?? UNATTRIBUTED) : UNATTRIBUTED;
}

/**
 * Count one attempt at `act` from this client. `false` means the attempt is over the limit
 * and the caller must refuse it — the caller says so in `auth.error.rateLimited`, the same
 * copy a 429 from the mounted API produces (§2).
 */
export async function withinRateLimit(act: string, max: number): Promise<boolean> {
  const now = Date.now();
  if (buckets.size >= SWEEP_EVERY) sweep(now);

  const key = `${await clientOf()}|${act}`;
  const bucket = buckets.get(key);
  if (bucket === undefined || bucket.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
