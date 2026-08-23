/**
 * `/api/auth/*` — better-auth's own router, mounted (R-SPINE-001).
 *
 * Every endpoint the identity spine speaks lives behind this one handler: sign-up, sign-in,
 * the magic link, verification, reset, the session list and revoke. The rate limiter that
 * Q-12 asks to be tested runs inside it, which is why the 429 an attacker meets is the same
 * 429 the acceptance meets.
 */
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../server/auth';

export const dynamic = 'force-dynamic';

export const { GET, POST } = toNextJsHandler(auth);
