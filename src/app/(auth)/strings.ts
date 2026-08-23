/**
 * The S-Auth screens' string table (R-SPINE-060).
 *
 * The four public screens meet a reader who is either arriving for the first time or locked
 * out, which is the worst minute to improvise a sentence in. Every value here is
 * `docs/design/s-auth.md` §10, verbatim: copy is design (AM-03 (2)), so a new word is added
 * to the Design Decision before it is added here.
 */
export const AUTH_STRINGS = Object.freeze({
  'auth.brand': 'Cubit',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.newPassword': 'New password',
  'auth.signUp.title': 'Create your account',
  'auth.signUp.submit': 'Create account',
  'auth.signUp.prompt': 'Already have an account?',
  'auth.signIn.title': 'Sign in',
  'auth.signIn.submit': 'Sign in',
  'auth.signIn.prompt': 'No account yet?',
  'auth.link.signIn': 'Sign in',
  'auth.link.signUp': 'Create one',
  'auth.link.magic': 'Email me a sign-in link',
  'auth.link.forgot': 'Forgot your password?',
  'auth.link.password': 'Sign in with a password',
  'auth.link.back': 'Back to sign in',
  'auth.magic.title': 'Sign in with a magic link',
  'auth.magic.lead':
    'A link will be sent to your email. Opening it signs you in without a password.',
  'auth.magic.submit': 'Send sign-in link',
  'auth.reset.title': 'Reset your password',
  'auth.reset.submit': 'Send reset link',
  'auth.reset.newTitle': 'Choose a new password',
  'auth.reset.newSubmit': 'Set password',
  'auth.notice.checkTitle': 'Check your email',
  'auth.notice.verify':
    'A verification link was sent to {email}. Open it to finish creating your account.',
  'auth.notice.verifyAgain':
    'This email is not verified yet. A new verification link was sent to {email}.',
  'auth.notice.magic': 'If an account exists for {email}, a sign-in link is on its way.',
  'auth.notice.reset': 'If an account exists for {email}, a password reset link is on its way.',
  'auth.notice.resetDoneTitle': 'Your password is set',
  'auth.notice.resetDone': 'Sign in with the new password to continue.',
  'auth.error.credentials': 'That email and password do not match. Check both and try again.',
  'auth.error.email': 'Enter a valid email address.',
  'auth.error.passwordLength': 'Passwords need at least 8 characters.',
  'auth.error.emailTaken': 'An account with this email already exists. Sign in instead.',
  'auth.error.rateLimited': 'Too many attempts. Wait a minute, then try again.',
  'auth.error.requestFailed':
    'The request did not complete. Check your connection and try again.',
  'auth.refusal.message': 'This link has expired or was already used.',
  'auth.refusal.remedyForm': 'Request a new link with the form below.',
  'auth.refusal.remedySignIn':
    'Sign in with your email and password; a new verification link will be sent.',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type AuthStringKey = keyof typeof AUTH_STRINGS;

/** Read one string by a key the compiler can check. */
export function aus(key: AuthStringKey): string {
  return AUTH_STRINGS[key];
}

/**
 * Split a template around its `{slot}`, so the slot can be rendered as its own element — the
 * address in `--font-mono`, an identifier rather than a word — without the component
 * composing the sentence.
 */
export function around(key: AuthStringKey, slot: string): readonly [string, string] {
  const template = aus(key);
  const marker = `{${slot}}`;
  const at = template.indexOf(marker);
  if (at === -1) return [template, ''];
  return [template.slice(0, at), template.slice(at + marker.length)];
}
