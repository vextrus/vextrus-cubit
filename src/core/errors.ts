/**
 * R-SPINE-062 — the closed refusal taxonomy. Every code the product can refuse
 * with is registered here with an English message, a remedy hint, a severity and
 * a surface hint. The register is closed: `refusal()` cannot mint a code that is
 * not in the table, and Q-07's register test refuses an orphan — a code neither
 * exercised by name nor listed in `refusals.deferred.json` with a reason.
 */

/** How loudly a refusal reads. `refusal` is the product's own register of "no". */
export type RefusalSeverity = 'info' | 'warn' | 'error' | 'fatal' | 'refusal';

/** Where the refusal belongs on screen (R-UI-020: never a toast alone). */
export type RefusalSurface = 'in-place' | 'field' | 'page' | 'job' | 'document';

export interface RefusalEntry {
  readonly code: string;
  readonly message: string;
  readonly remedy: string;
  readonly severity: RefusalSeverity;
  readonly surface: RefusalSurface;
}

export const REFUSALS = {
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'That email and password do not match an account.',
    remedy: 'Check the address, then try again or reset the password.',
    severity: 'refusal',
    surface: 'in-place',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    message: 'This address has not been verified yet.',
    remedy: 'Open the verification link sent to the address, then sign in again.',
    severity: 'refusal',
    surface: 'in-place',
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'That link has expired or has already been used.',
    remedy: 'Request a fresh link and open it within the hour.',
    severity: 'refusal',
    surface: 'in-place',
  },
  AUTH_RATE_LIMITED: {
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many attempts from this address.',
    remedy: 'Wait a minute before trying again.',
    severity: 'refusal',
    surface: 'in-place',
  },
  AUTH_EMAIL_TAKEN: {
    code: 'AUTH_EMAIL_TAKEN',
    message: 'An account already uses that email address.',
    remedy: 'Sign in with it instead, or reset its password.',
    severity: 'refusal',
    surface: 'field',
  },
  AUTH_PASSWORD_REJECTED: {
    code: 'AUTH_PASSWORD_REJECTED',
    message: 'That password does not meet the length the product requires.',
    remedy: 'Use between 12 and 128 characters.',
    severity: 'refusal',
    surface: 'field',
  },
  TENANT_ACCESS_DENIED: {
    code: 'TENANT_ACCESS_DENIED',
    message: 'This account is not a member of that tenant.',
    remedy: 'Switch to a tenant you belong to, or ask its owner for an invitation.',
    severity: 'refusal',
    surface: 'page',
  },
  TENANT_SLUG_TAKEN: {
    code: 'TENANT_SLUG_TAKEN',
    message: 'That tenant address is already in use.',
    remedy: 'Choose a different name — the address is derived from it.',
    severity: 'refusal',
    surface: 'field',
  },
  SYSTEM_REASON_REQUIRED: {
    code: 'SYSTEM_REASON_REQUIRED',
    message: 'A system-scoped database handle was asked for without a reason.',
    remedy: 'Pass runAsSystem(reason) a sentence naming why the tenant scope is being left.',
    severity: 'fatal',
    surface: 'job',
  },
  PRECISION_NOT_APPLIED: {
    code: 'PRECISION_NOT_APPLIED',
    message: 'A money value arrived carrying more precision than it may be shown with.',
    remedy: 'Round the value to 2 decimal places before it reaches the format seam.',
    severity: 'error',
    surface: 'in-place',
  },
  CHARACTER_NOT_COVERED: {
    code: 'CHARACTER_NOT_COVERED',
    message: 'The document font does not cover a character in this text.',
    remedy: 'Use a covered script, or add the face that covers it to the document lane.',
    severity: 'refusal',
    surface: 'document',
  },
  FIXTURE_MISSING: {
    code: 'FIXTURE_MISSING',
    message: 'A fixture the run depends on is not on disk.',
    remedy: 'Run pnpm gen:fixtures, then re-run the lane.',
    severity: 'fatal',
    surface: 'job',
  },
} as const satisfies Record<string, RefusalEntry>;

export type RefusalCode = keyof typeof REFUSALS;

/** A refusal in flight. Carries its whole register entry so a surface can render it. */
export class RefusalError extends Error {
  readonly code: RefusalCode;
  readonly remedy: string;
  readonly severity: RefusalSeverity;
  readonly surface: RefusalSurface;
  readonly detail: string | undefined;

  constructor(entry: RefusalEntry, detail?: string) {
    super(`${entry.code}: ${entry.message}`);
    this.name = 'RefusalError';
    this.code = entry.code as RefusalCode;
    this.remedy = entry.remedy;
    this.severity = entry.severity;
    this.surface = entry.surface;
    this.detail = detail;
  }
}

export function isRefusalCode(code: string): code is RefusalCode {
  return Object.hasOwn(REFUSALS, code);
}

/**
 * Mints a refusal. The taxonomy is closed: an unregistered code throws rather
 * than inventing an entry nobody has written a remedy for.
 */
export function refusal(code: RefusalCode, detail?: string): RefusalError {
  if (!isRefusalCode(code)) {
    throw new Error(`Unregistered refusal code "${code}" — add it to src/core/errors.ts first.`);
  }
  return new RefusalError(REFUSALS[code], detail);
}
