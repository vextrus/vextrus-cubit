import { table } from './index';

/** S-Auth: sign in / sign up / magic link / reset / verify / sessions. */
export const strings = table({
  signUpTitle: 'Create your account',
  signUpLede: 'One account, as many tenants as you build for.',
  signUpName: 'Full name',
  signUpEmail: 'Work email',
  signUpPassword: 'Password',
  signUpPasswordHint: 'At least 12 characters.',
  signUpSubmit: 'Create account',
  signUpHasAccount: 'Already have an account?',

  signInTitle: 'Sign in',
  signInLede: 'Pick up where the drawings left off.',
  signInEmail: 'Email',
  signInPassword: 'Password',
  signInSubmit: 'Sign in',
  signInNoAccount: 'No account yet?',
  signInForgot: 'Forgot your password?',
  signInMagicLink: 'Sign in with a magic link',

  verifyTitle: 'Verify your email',
  verifySentLede: 'A verification link is on its way. Open it to finish signing up.',
  verifySuccess: 'Your email is verified. You can sign in now.',
  verifyError: 'That verification link did not work.',
  verifyGoToSignIn: 'Go to sign in',

  magicLinkTitle: 'Magic link',
  magicLinkLede: 'We will email you a link that signs you in — no password needed.',
  magicLinkEmail: 'Email',
  magicLinkSubmit: 'Send the link',
  magicLinkSent: 'Check your inbox. The link works once and expires within the hour.',
  magicLinkBack: 'Back to sign in',

  forgotTitle: 'Reset your password',
  forgotLede: 'We will email you a link to choose a new password.',
  forgotEmail: 'Email',
  forgotSubmit: 'Send the reset link',
  forgotSent: 'If that address has an account, a reset link is on its way.',

  resetTitle: 'Choose a new password',
  resetLede: 'This link works once.',
  resetPassword: 'New password',
  resetPasswordConfirm: 'Repeat the new password',
  resetSubmit: 'Set the password',
  resetMismatch: 'Those two passwords are not the same.',
  resetDone: 'Your password is set. Sign in with it.',

  sessionsTitle: 'Signed-in devices',
  sessionsLede: 'Every device holding a live session. Revoking one signs it out at once.',
  sessionsEmpty: 'No other device holds a session. Sign in elsewhere and it will appear here.',
  sessionsCurrent: 'This device',
  sessionsRevoke: 'Revoke',
  sessionsRevokeLabel: 'Revoke this session',
  sessionsSeenAt: 'Signed in',
  sessionsUnknownDevice: 'Unknown device',

  signOut: 'Sign out',

  mailVerifySubject: 'Verify your VEXTRUS CUBIT email',
  mailMagicLinkSubject: 'Your VEXTRUS CUBIT sign-in link',
  mailResetSubject: 'Reset your VEXTRUS CUBIT password',
});
