# Design Decision — S-Auth

The identity spine's screens: `/sign-up`, `/sign-in`, `/magic-link`, `/reset-password`, and the
signed-in landing `/t/{tenantSlug}` with `/t/{tenantSlug}/sessions` (R-SPINE-001, R-SPINE-002,
J-001). "Minimal, branded, fast": one small card on a calm canvas, Datum's compact control
metric throughout, no illustration, no marketing. Token names are `docs/design/datum-tokens.md`;
component anatomy is `datum-primitives.md` and `datum-patterns.md`; no colour literal anywhere
(R-UI-001).

Interpretations recorded:

1. **Invite accept is deferred.** S-Auth's "accept invitation" and J-001's "invite accept" are
   owned by a later increment (no membership-granting model beyond the personal mint exists);
   this document designs no invitation surface.
2. **Session revoke and sign-out act without a ConsequenceDialog** (R-UI-021). The consequence
   is one session — the row the reader is looking at, self-scoped, already stating device and
   time. R-UI-021's server-computed preview and digest machinery is for acts whose blast radius
   the reader cannot see (voided signatures, widened denominators); here the row *is* the
   preview, and interposing a dialog would restate it verbatim.
3. **The expired-link refusal is card-local.** The REFUSALS register (`src/core/errors/**`) is
   closed by test and outside this increment's ownership, so `RefusalState` cannot carry an
   auth code. The refusal renders with RefusalState's exact anatomy and tokens (§3), code
   `AUTH_LINK_EXPIRED`, copy from AUTH_STRINGS; the resolving control R-UI-020 asks to be
   linked is the live form rendered directly beneath the block. Folding the code into the
   register belongs to the increment that owns `src/core`.
4. **A non-member gets 404, not PermissionDenied.** Naming the permission and its holder
   (R-UI-050) would confirm to a non-member that the tenant exists — enumeration Q-12 forbids.
   The guard answers exactly as it does for a slug that does not exist; the 404 screen is §7.
5. **No `loading.tsx` exists anywhere under `/t`.** A skeleton above the guard streams the page
   shell past the redirect; the loading state of the `/t` screens is the browser's own
   navigation, and the guard answers before any byte of tenant content.

## 1. The auth surface (shared by the four public screens)

Page background `--graphite-50` filling the viewport; a centred column (flex, `min-height:
100dvh`, padding `--space-6`). Stacked, centred: the wordmark "Cubit" (`--text-20`,
`--weight-heading`, `--graphite-950` — a `div`, never the `h1`), `--space-6`, then **the card**:
width `min(360px, calc(100vw - var(--space-8)))`, background `--graphite-0`, hairline border
`--graphite-200`, `--radius-8`, padding `--space-6` — no shadow (hairlines carry the edge),
then `--space-4` and the under-card link lines.

Inside the card: the screen's `h1` (`--text-16`, `--weight-heading`, `--graphite-950` — exactly
one h1 per page), an optional lead line (`--text-13`, `--graphite-600`, `--space-2` below the
h1), `--space-4`, then the field stack. Each field: a `<label>` (`--text-13`,
`--weight-body-medium`, `--graphite-700`) `--space-1` above its full-width Datum Input;
`--space-4` between fields. Email inputs are `type="email" autocomplete="email"`
(`data-testid="auth-email"`); password inputs carry `data-testid="auth-password"` with
`autocomplete="current-password"` on /sign-in and `"new-password"` on /sign-up and the reset
form. `--space-4` below the stack, the submit: a full-width primary Button
(`data-testid="auth-submit"`).

Under-card links: `--text-13`; prompts in `--graphite-600`, anchors `--cobalt-500`, underlined
always, hover `--cobalt-600`, `datum-focus-ring`; one line per link, `--space-2` between lines,
centred.

**Submit lifecycle.** Submit puts the button in the primitive's loading state (`aria-busy`,
busy bar, activation blocked, still focusable); fields stay enabled and the layout does not
move. The response either navigates, swaps in the notice (§2), or surfaces the error (§2).
A signed-in visitor to any of the four screens is redirected (303) to `/t/{activeTenantSlug}`.

## 2. Error and notice (shared behaviour)

- **auth-error** (`data-testid="auth-error"`): one line per card, `role="alert"`, `--text-13`
  `--danger`, rendered between the field stack and the submit with `--space-3` gaps, arriving
  with a `--motion-state-duration` fade. Every failure routes through it — wrong credentials,
  validation, HTTP 429 (`auth.error.rateLimited`), a request that never completed
  (`auth.error.requestFailed`). A field the error names sets `aria-invalid="true"` (danger
  border per primitives §3) and `aria-describedby` pointing at the line. A new submit clears it.
- **auth-notice** (`data-testid="auth-notice"`): replaces the card's entire contents (h1
  included) with a `--motion-state-duration` fade. Title (`--text-14`, `--weight-body-medium`,
  `--graphite-900`), body `--space-2` below (`--text-13`, `--graphite-600`, `--leading-ui`);
  the `{email}` slot renders the address in `--font-mono` `--graphite-700` (an identifier).
  The container is `role="status"` with `tabIndex={-1}` and receives focus on mount — the
  submit it replaced held focus, and focus is never stranded on `<body>`.
- **Offline**: the browser's `offline`/`online` events mount/unmount the patterns
  `OfflineBanner` above the card (card width). Submission stays possible; an attempt while
  offline fails into `auth.error.requestFailed`.

## 3. The expired-link refusal (R-UI-020)

An expired, used or malformed link from any auth mail lands on the screen that can mint a new
one, carrying `?error=link-expired`: a verify link on `/sign-in`, a magic link on
`/magic-link`, a reset link on `/reset-password`. That screen renders, above its h1 inside the
card with `--space-4` below it, the refusal block (`data-testid="auth-refusal"`): background
`--graphite-50`, hairline border `--graphite-200`, `--radius-8`, padding `--space-4`, stacked
with `--space-2` gaps — the code `AUTH_LINK_EXPIRED` (`--font-mono`, `--text-12`,
`--graphite-600`), the message `auth.refusal.message` (`--text-13`, `--graphite-900`), the
remedy (`--text-13`, `--graphite-600`): `auth.refusal.remedySignIn` on /sign-in,
`auth.refusal.remedyForm` on the other two. The form beneath stays fully live — it is the
remedy. Never a toast.

## 4. The four public screens

- **/sign-up** — h1 `auth.signUp.title`; Email + Password; submit `auth.signUp.submit`;
  under-card `auth.signUp.prompt` + anchor `auth.link.signIn` → /sign-in. Failures:
  `auth.error.email`, `auth.error.passwordLength`, `auth.error.emailTaken`. Success swaps in
  the notice `auth.notice.checkTitle` / `auth.notice.verify`. The verification link signs the
  user in and lands on `/t/{slug}` directly — no interstitial screen.
- **/sign-in** — h1 `auth.signIn.title`; Email + Password; submit `auth.signIn.submit`;
  under-card, three lines: anchor `auth.link.magic` → /magic-link; anchor `auth.link.forgot` →
  /reset-password; `auth.signIn.prompt` + anchor `auth.link.signUp` → /sign-up. A wrong
  password **and** an unknown email both show `auth.error.credentials` — one copy, no account
  enumeration — and establish no session. Correct credentials on an unverified account swap in
  the notice `auth.notice.checkTitle` / `auth.notice.verifyAgain` (better-auth re-sends the
  verification mail on that attempt). Success redirects to `/t/{activeTenantSlug}`.
- **/magic-link** — h1 `auth.magic.title`; lead `auth.magic.lead`; Email only; submit
  `auth.magic.submit`; under-card anchor `auth.link.password` → /sign-in. Success always swaps
  in `auth.notice.checkTitle` / `auth.notice.magic` — the same answer whether or not the
  account exists (no user is minted for an unknown email, and the copy confirms nothing).
- **/reset-password** — two phases on one route, split by the `token` query param.
  *Request* (no token): h1 `auth.reset.title`; Email; submit `auth.reset.submit`; under-card
  anchor `auth.link.back` → /sign-in; success swaps in `auth.notice.checkTitle` /
  `auth.notice.reset` (existence-neutral, as the magic notice is). *Set* (`?token=`): h1
  `auth.reset.newTitle`; one field labelled `auth.newPassword` (`auth-password`,
  `autocomplete="new-password"`); submit `auth.reset.newSubmit`; too-short fails with
  `auth.error.passwordLength`; success swaps in the notice `auth.notice.resetDoneTitle` /
  `auth.notice.resetDone` with, `--space-3` below the body, an anchor `auth.link.signIn` →
  /sign-in styled as the under-card links.

The two baselined screens (`auth/sign-up.png`, `auth/sign-in.png`) render nothing
time-dependent or random — the card is deterministic by construction.

## 5. Signed-in chrome (shared by the two `/t` screens)

R-UI-030's full shell (left rail, project switcher, ⌘K, inspector) belongs to the workspace
increments; S-Auth ships the minimal top bar only. Sticky (`top: 0`,
`z-index: var(--z-sticky)`), 48 px, background `--graphite-0`, hairline bottom border,
padding `0 var(--space-6)`, contents vertically centred. Left: the wordmark "Cubit"
(`--text-14`, `--weight-heading`, `--graphite-950`), `--space-3`, a 16 px vertical Separator,
`--space-3`, the tenant name (`--text-13`, `--weight-body-medium`, `--graphite-700`). Right,
gap `--space-3`: an anchor `tenant.nav.sessions` → `/t/{slug}/sessions` (`--text-13`,
`--graphite-700`, hover `--graphite-950`, focus ring, 28 px line box, no underline at rest —
navigation chrome), then a ghost Button `tenant.signOut` (`data-testid="auth-sign-out"`),
which enters its loading state, ends the session via fetch, and navigates to `/sign-in`.

Main column on both screens: `max-width: 720px`, centred, padding `--space-6`.

## 6. /t/{tenantSlug} — the landing

Guard first, before any byte: no session → 303 redirect to `/sign-in`; a session without a
membership row for the slug → 404 (§7); a member renders the page. The main column carries
`data-testid="tenant-home"`: the `h1` is the tenant name (`--text-20`, `--weight-heading`,
`--graphite-950`), `--space-2` below it the slug in `--font-mono` `--text-12` `--graphite-600`
(the identifier the URL speaks), `--space-6`, then the patterns `EmptyState` — title
`tenant.home.empty.title`, teach `tenant.home.empty.teach`, action `tenant.home.empty.action`
navigating to `/t/{slug}/sessions`. (R-UI-033's "upload a drawing" teaching arrives with the
project screens; at M0 the sessions list is the one real next action.)

## 7. The 404 and the error boundary

- **Not found** (`src/app/t` not-found, HTTP 404 — nonexistent slug and non-member alike): the
  top bar is omitted (nothing tenant-scoped to show); on the `--graphite-50` canvas, the
  patterns `EmptyState` centred — title `tenant.notFound.title`, teach `tenant.notFound.teach`,
  action `tenant.notFound.action` navigating to `/sign-in`.
- **Error** (`src/app/t` error boundary): the patterns `ErrorState` in the main column,
  `reportId` = the boundary error's digest (the literal `AUTH-0000` when the runtime provides
  none); retry calls the boundary's reset.

## 8. /t/{tenantSlug}/sessions

Same guard and chrome. Main column: h1 `tenant.sessions.title` (`--text-20`,
`--weight-heading`, `--graphite-950`), lead `tenant.sessions.lead` (`--text-13`,
`--graphite-600`) `--space-2` below, `--space-4`, then the list: background `--graphite-0`,
hairline border `--graphite-200`, `--radius-8`, rows divided by hairlines.

Each row (`data-testid="session-row"`, 36 px — comfortable rhythm, padding
`0 var(--space-3)`): left, the device summary parsed from the user agent — browser then
platform, e.g. "Chrome on Windows"; unparseable → `tenant.sessions.unknownDevice` — in
`--text-13` `--graphite-800`; the current session's row carries `data-current="true"` and,
`--space-2` after the device, a neutral Badge `tenant.sessions.current`. Right-aligned, gap
`--space-4`: `tenant.sessions.signedIn` with the session's creation time in the slot
(device-local, `YYYY-MM-DD HH:mm`, `.numeric` `--text-12` `--graphite-600`), then — on every
row except the current one — a secondary Button `tenant.sessions.revoke`
(`data-testid="session-revoke"`). The current row has no revoke button; the top bar's sign-out
is that act.

**Revoke** is a fetch, never a navigation: the button enters its loading state, the revoke
call resolves, the row is removed (no animation — the list reflows), and a visually hidden
`role="status"` region announces `tenant.sessions.revoked`. A failed revoke restores the
button and renders `tenant.sessions.revokeFailed` in a `role="alert"` line (`--text-13`,
`--danger`, `data-testid="auth-error"`) directly above the list, cleared by the next attempt.
A revoked device's next request to `/t/{slug}` meets the guard's 303 to `/sign-in`.

## 9. States roster (R-UI-050)

| State | Auth card screens | /t screens |
|---|---|---|
| loading | submit button's busy state; layout still | none streamed — the guard answers before any byte (Interpretation 5); navigation is the wait |
| empty | n/a — a form is never a list | landing: the §6 EmptyState; sessions: structurally absent (viewing requires a session, so ≥ 1 row always renders) |
| error | `auth-error` line, §2 | error boundary → ErrorState with report id, §7 |
| refusal | `auth-refusal` block, §3 | none minted at M0; acts refused upstream land as §8's alert line |
| partial | n/a — one record per submit | n/a — one query, one list; nothing is part-refused at M0 |
| offline | OfflineBanner above the card, §2 | OfflineBanner above the main column's content; revoke attempts fail into §8's alert |
| permission-denied | n/a — public screens | the 404, deliberately (Interpretation 4) |

## 10. Copy, verbatim

`src/app/(auth)/strings.ts` exports `AUTH_STRINGS`; `src/app/t/strings.ts` exports
`TENANT_STRINGS` — both frozen and typed as the existing tables are; no string literal in JSX
except test ids and the codes `AUTH_LINK_EXPIRED` / `AUTH-0000`.

| Key | Value |
|---|---|
| `auth.brand` | Cubit |
| `auth.email` | Email |
| `auth.password` | Password |
| `auth.newPassword` | New password |
| `auth.signUp.title` | Create your account |
| `auth.signUp.submit` | Create account |
| `auth.signUp.prompt` | Already have an account? |
| `auth.signIn.title` | Sign in |
| `auth.signIn.submit` | Sign in |
| `auth.signIn.prompt` | No account yet? |
| `auth.link.signIn` | Sign in |
| `auth.link.signUp` | Create one |
| `auth.link.magic` | Email me a sign-in link |
| `auth.link.forgot` | Forgot your password? |
| `auth.link.password` | Sign in with a password |
| `auth.link.back` | Back to sign in |
| `auth.magic.title` | Sign in with a magic link |
| `auth.magic.lead` | A link will be sent to your email. Opening it signs you in without a password. |
| `auth.magic.submit` | Send sign-in link |
| `auth.reset.title` | Reset your password |
| `auth.reset.submit` | Send reset link |
| `auth.reset.newTitle` | Choose a new password |
| `auth.reset.newSubmit` | Set password |
| `auth.notice.checkTitle` | Check your email |
| `auth.notice.verify` | A verification link was sent to {email}. Open it to finish creating your account. |
| `auth.notice.verifyAgain` | This email is not verified yet. A new verification link was sent to {email}. |
| `auth.notice.magic` | If an account exists for {email}, a sign-in link is on its way. |
| `auth.notice.reset` | If an account exists for {email}, a password reset link is on its way. |
| `auth.notice.resetDoneTitle` | Your password is set |
| `auth.notice.resetDone` | Sign in with the new password to continue. |
| `auth.error.credentials` | That email and password do not match. Check both and try again. |
| `auth.error.email` | Enter a valid email address. |
| `auth.error.passwordLength` | Passwords need at least 8 characters. |
| `auth.error.emailTaken` | An account with this email already exists. Sign in instead. |
| `auth.error.rateLimited` | Too many attempts. Wait a minute, then try again. |
| `auth.error.requestFailed` | The request did not complete. Check your connection and try again. |
| `auth.refusal.message` | This link has expired or was already used. |
| `auth.refusal.remedyForm` | Request a new link with the form below. |
| `auth.refusal.remedySignIn` | Sign in with your email and password; a new verification link will be sent. |
| `tenant.nav.sessions` | Sessions |
| `tenant.signOut` | Sign out |
| `tenant.home.empty.title` | No projects in this workspace yet. |
| `tenant.home.empty.teach` | This is where your projects will appear. Review your active sessions in the meantime. |
| `tenant.home.empty.action` | View sessions |
| `tenant.sessions.title` | Sessions |
| `tenant.sessions.lead` | Every device signed in to your account. Revoking a session signs that device out immediately. |
| `tenant.sessions.current` | This device |
| `tenant.sessions.revoke` | Revoke |
| `tenant.sessions.signedIn` | Signed in {time} |
| `tenant.sessions.unknownDevice` | Unknown device |
| `tenant.sessions.revoked` | Session revoked. |
| `tenant.sessions.revokeFailed` | The session could not be revoked. Try again. |
| `tenant.notFound.title` | This workspace could not be found. |
| `tenant.notFound.teach` | Check the address, or sign in with an account that belongs to it. |
| `tenant.notFound.action` | Sign in |

Calm, concrete, sentence case, no exclamation marks, no build or internal vocabulary — the
mail seam, tables and tokens are never named on screen.

## 11. Motion (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| auth-error arrival, notice swap, refusal-block arrival | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Button loading (busy bar, per primitive) | `--motion-panel-duration` (240 ms) | `--motion-ease` |

Nothing else animates: navigation redirects are instant, the revoked row is removed without
transition, banners mount plainly. Reduced motion: token durations zero via tokens.css;
primitives.css stills the busy bar.

## 12. Both themes

Every rule reads role-stable tokens — no forked CSS in `src/app/(auth)/**` or `src/app/t/**`.
The card on the `--graphite-50` canvas reads white-on-paper in light and near-black-on-black
in dark with hairline edges in both, exactly as the gallery's cards do; `--danger`, the badge
and the mono identifiers all carry their own dark values with contrast held by the token sheet
(secondary text and identifiers sit at `--graphite-600`+, per the placeholder-contrast
amendment's floor).

## 13. Test hooks (C-05)

Routes: `/sign-up`, `/sign-in`, `/magic-link`, `/reset-password` (phases via `?token=`),
`/t/{tenantSlug}`, `/t/{tenantSlug}/sessions`; the query `?error=link-expired` on /sign-in,
/magic-link and /reset-password (§3). Test ids: `auth-email`, `auth-password`, `auth-submit`
(§1); `auth-error`, `auth-notice` (§2, §8); `auth-refusal` (§3, the one id this document
introduces beyond the increment contract); `auth-sign-out` (§5); `tenant-home` (§6);
`session-row` (with `data-current="true"` on the current session) and `session-revoke` (§8).
