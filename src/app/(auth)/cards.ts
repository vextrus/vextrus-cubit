/**
 * Which of the five cards a page is asking for (docs/design/s-auth.md §4).
 *
 * It lives beside the card rather than inside it because the card is a client component, and
 * every export of a client module reaches a server component as a client *reference*, not as
 * the value: a page that read `CARD.signUp` off the card itself would hand the component
 * `undefined` and render nothing.
 */

/** The five cards. `reset-set` is /reset-password's second phase, split by `?token=`. */
export type AuthScreenKind = 'sign-up' | 'sign-in' | 'magic-link' | 'reset-request' | 'reset-set';

/**
 * The five kinds, named. A page says `kind={CARD.signUp}` rather than spelling the value: a
 * discriminator is the component's own vocabulary, not copy, and naming it keeps the two
 * apart at the one place a reader could confuse them (R-SPINE-060).
 */
export const CARD = Object.freeze({
  signUp: 'sign-up',
  signIn: 'sign-in',
  magic: 'magic-link',
  resetRequest: 'reset-request',
  resetSet: 'reset-set',
} as const) satisfies Readonly<Record<string, AuthScreenKind>>;
