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

/** Whether a validation refusal is one about the address the person typed. */
function namesTheAddress(error: ClientError | null | undefined): boolean {
  return /e-?mail|address/i.test(error?.message ?? '');
}

/**
 * R-SPINE-062 — better-auth's error codes translated into our closed taxonomy.
 * A screen never renders a library's wording: it renders a registered refusal
 * with a remedy somebody wrote (R-UI-020).
 *
 * Every arm below is a code better-auth actually raises. What is *not* here
 * matters as much: an unrecognised code answers AUTH_REQUEST_FAILED, not a
 * credentials refusal. This function serves five screens, two of which have no
 * password field at all — "that email and password do not match an account,
 * try resetting the password" is a remedy that cannot resolve a magic-link or a
 * forgot-password fault, and R-UI-020 exists to forbid exactly that.
 */
export function refusalFor(error: ClientError | null | undefined): RefusalCode {
  if (error?.status === 429) return 'AUTH_RATE_LIMITED';

  switch (error?.code) {
    // the password sign-in's own refusal: an account and a password that
    // disagree, whichever of the two is wrong
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
    case 'USER_NOT_FOUND':
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'AUTH_INVALID_CREDENTIALS';
    // zod refuses the body before better-auth reads it — most often because the
    // address cannot be parsed at all (every form carries noValidate, so the
    // browser hands a mistyped address straight to the server)
    case 'INVALID_EMAIL':
      return 'AUTH_EMAIL_UNREADABLE';
    case 'VALIDATION_ERROR':
    case 'MISSING_FIELD':
      return namesTheAddress(error) ? 'AUTH_EMAIL_UNREADABLE' : 'AUTH_REQUEST_FAILED';
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
      // a fault nobody mapped is a fault, and says so — it is never turned into
      // a story about a password the screen may not even have asked for
      return 'AUTH_REQUEST_FAILED';
  }
}
