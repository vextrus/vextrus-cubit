import { toNextJsHandler } from 'better-auth/next-js';
import { auth, duplicateSignUp, replayedVerification } from '../../../../server/auth';

const handler = toNextJsHandler(auth);

/**
 * R-SPINE-001 — every better-auth endpoint, including /api/auth/sign-in/email.
 *
 * A verification link that has already been spent is answered here rather than by
 * better-auth, which would walk it to the success screen a second time.
 */
export async function GET(request: Request): Promise<Response> {
  return (await replayedVerification(request)) ?? handler.GET(request);
}

/**
 * A sign-up for an address that already has an account is refused here rather
 * than answered with better-auth's fabricated success (AC-12).
 */
export async function POST(request: Request): Promise<Response> {
  return (await duplicateSignUp(request)) ?? handler.POST(request);
}
