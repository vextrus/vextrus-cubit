import { toNextJsHandler } from 'better-auth/next-js';
import { auth, replayedVerification } from '../../../../server/auth';

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

export const POST = handler.POST;
