'use client';

import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';
import type { RefusalCode } from '../../core/errors';

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });

export interface ClientError {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

/**
 * R-SPINE-062 — better-auth's error codes translated into our closed taxonomy.
 * A screen never renders a library's wording: it renders a registered refusal
 * with a remedy somebody wrote (R-UI-020).
 */
export function refusalFor(error: ClientError | null | undefined): RefusalCode {
  if (error?.status === 429) return 'AUTH_RATE_LIMITED';

  switch (error?.code) {
    case 'EMAIL_NOT_VERIFIED':
      return 'AUTH_EMAIL_NOT_VERIFIED';
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'AUTH_TOKEN_EXPIRED';
    // better-auth's own spelling, and ours from the sign-up guard (AC-25)
    case 'USER_ALREADY_EXISTS':
    case 'AUTH_EMAIL_TAKEN':
      return 'AUTH_EMAIL_TAKEN';
    case 'TENANT_SLUG_TAKEN':
      return 'TENANT_SLUG_TAKEN';
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return 'AUTH_PASSWORD_REJECTED';
    default:
      return 'AUTH_INVALID_CREDENTIALS';
  }
}
