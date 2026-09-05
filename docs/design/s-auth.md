# Design Decision — S-Auth (sign-up, sign-in, verify, magic-link, reset, sessions)

Routes: `/sign-up`, `/sign-in`, `/verify`, `/magic-link`, `/reset`, `/sessions` under
`src/app/(auth)/`. Law: R-SPINE-001/002/007/062, R-UI-001/003/004/012/020/030/033/050/060/070,
B-17, Q-07, Q-11. The accept-invitation panel is out of scope (the J-001b leaf owns it).
Every convention of the primitives-core Decision binds: `cx-` classes, tokens-only colour and
motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored CSS
except as I-10 rules. Interpretations I-1–I-9 of the earlier Decisions remain in force. All
copy lives in `src/ui/strings/auth.ts` (keys `auth_…`), spread into the `strings` table by
`src/ui/strings/index.ts`; the JSX carries no string literal beyond test ids and fixed
attribute values. The shipped primitives are the only chrome: core Button/Input/Badge/
Skeleton, and the one `RefusalState` renderer — a screen-local refusal block is a defect.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-10 — the spark mark belongs to the whole unauthenticated surface, and its theme swap
  is an asset swap.** R-UI-070 allows the full spark mark "only on sign-in and on
  certificates"; S-Auth's five unauthenticated routes are one sign-in surface (a user who
  lands on /reset is signing in the long way). Ruling: `/sign-up`, `/sign-in`, `/verify`,
  `/magic-link`, `/reset` render the full mark at 48 px; `/sessions` (a signed-in product
  page) renders no mark. Brand colours are founder-fixed sRGB per LOGO-SPEC.md, not tokens,
  and the geometry is never redrawn — so the light/dark difference cannot travel through
  token values. The one lawful `[data-theme]` rule in `s-auth.css` display-toggles the
  vendored pair `vextrus-mark.svg` / `vextrus-mark-dark.svg`; both `<img>`s render with
  `alt=""` `aria-hidden="true"` inside a wrapper that is itself `aria-hidden="true"` and carries
  no `role` and no `aria-labelledby` — the brand is decoration here, and the heading alone names
  the page. (Amended: the wrapper previously took `role="img"` labelled by the `<h1>`, which
  said the product's name twice to a reader moving by heading — once as an image borrowing the
  heading's words, once as the heading. `TITLE_ID` stays `s-auth-title` on the `<h1>`.)
- **I-11 — "workspace" is the user-facing word for tenant.** "Tenant" is model vocabulary
  (schema, URL slugs, the Bible); registry copy rules ban build vocabulary in user copy.
  Sign-up's third field is labelled **Workspace name** and every auth string says
  "workspace"; the procedure input remains `tenantName`.
- **I-12 — unreachable is a fault, not a refusal.** R-UI-050's offline state has no shell
  banner to live in yet, and a failed fetch carries no fault id. Ruling: a transport failure
  renders the fault surface's unreachable variant (§2, no fault-id line) — offline is a
  fault of reachability, never silence and never an impersonated refusal.
- **I-13 — no client-side credential rules.** The closed taxonomy has no password-strength
  or email-format code, so the screens invent no local validation copy; the fields submit as
  entered and the server's answer (a registered refusal or a fault) is the only judge. The
  inputs still declare `type`/`autocomplete` so the browser and password managers behave, and
  every field a door takes carries `required`. Requiredness is not a credential rule: it
  invents no copy and judges no value, it only keeps the browser from sending a form the
  person has not filled in. Without it a blank submit is answered by the fault surface —
  R-SPINE-007's "the machine failed" shown for an empty box, with an operator fault record
  filed behind it (ARCH-03 / B-21).
- **I-14 — the door's side of I-13: a creating door takes the value as presented.** The
  taxonomy is closed (R-SPINE-062, B-06) and registers no code for a detail left blank, and
  CREDENTIALS_NOT_VALID cannot stand in for one on `/sign-up` or on the token half of
  `/reset`: "the email and password do not match an account" is false of a person who is
  making one, and its remedy sends them to reset a password they have not got. Ruling: the
  doors that *create* an account or *set* a password judge nothing about what a string says
  — sign-up names the personal workspace with what it was given (R-SPINE-002) and hashes the
  password presented, there being no password policy in the law to break — while the doors
  that *identify* somebody answer CREDENTIALS_NOT_VALID for a value that names no account,
  where the entry is true. So the whitespace `required` admits is never the fault card
  (R-SPINE-007) and never a refusal the registry does not hold.

Recorded IOU — the one-time re-key of `users.email`. Closing the identity fold (inc-020)
changed the key every door writes and reads: an address the column can carry is now stored
as `as presented <address>` where it was previously stored verbatim, so that a presented
value can never meet a folded one (R-SPINE-001; `src/server/auth/folded-key.ts`). Rows
written before that change carry the untagged form, and no door reads it: `signIn` would
answer CREDENTIALS_NOT_VALID for an account that exists, `requestPasswordReset` and
`requestMagicLink` would miss the lookup and still answer `{ sent: true }` (non-disclosure,
so the person gets no signal), and `signUp`'s ACCOUNT_ALREADY_EXISTS pre-check would miss
the row while the UNIQUE index still holds it — surfacing the duplicate as an unmarked
23505 fault instead of the registered refusal. No deployment carries such rows today:
`db/migrations/0002_identity.sql` created the column in the immediately preceding commit
(inc-009-auth-core), inside the same unreleased milestone. This Decision therefore records
the debt rather than paying it — DB schema and migrations are out of inc-020's scope, and
a compatibility read that also accepted the untagged key would re-open the very overlap the
increment closes. **Owed by the first increment that deploys onto rows written before
inc-020:** a migration that rewrites every `users.email` the column can carry to
`as presented <address>`, leaving the over-long rows alone — their key, `digest of <hex>`,
is unchanged by inc-020.

## 1. Layout and hierarchy — the auth frame

The five unauthenticated routes share one frame: a single centred column, width
`min(380px, calc(100vw - var(--space-8)))`, on the bare `var(--graphite-0)` page ground —
no card, no border, no shadow (minimal, branded, fast: the page is the card). Block padding
top `var(--space-12)` doubled (96 px) on ≥ sm, `var(--space-8)` below sm — and that padding is
the **floor**, not the resting place. The page ground is `display: flex`,
`justify-content: center`, `align-items: safe center`, `min-height: 100vh`,
`padding: var(--space-8) var(--space-4)`, with the ≥ 640px rule adding
`padding-block-start: calc(var(--space-12) * 2)`: the column sits in the middle of whatever
height is spare rather than glued to the top of a tall empty viewport. `safe` is the ruling and
plain `center` is refused — on a viewport shorter than the column, plain centring overflows both
ways and the top of the card (the mark, the heading, the first field) goes out of reach above
the scroll origin, whereas `safe` falls back to the start edge and the floor above stands.
Vertical order,
gaps in `var(--space-…)`: mark (48 px, per I-10) · 6 · `<h1>` title `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)` · 5 · the body (form or token panel) · 4 ·
footer links. Fields stack at gap `var(--space-4)`; a field is label over input at gap
`var(--space-1)` — label `<label for…>` `var(--text-13)` `var(--weight-body-medium)`
`var(--graphite-700)`, then the core Input, full width. The submit is a full-width core
Button, `data-variant="primary"`, submitting the native `<form>` (Enter submits).

**The answer slot** sits between the last field and the submit — the answer to the previous
attempt reads before the retry (the RefusalState in-dialog ruling, transposed). Exactly one
of three things may occupy it:

- `<div data-testid="s-auth-refusal">` wrapping exactly one `RefusalState` (the component's
  own ids live inside; the wrapper adds none). Surface and severity come from the registry
  entry (I-8); evidence per §3.
- `<div data-testid="s-auth-fault" role="alert">` — the fault card, the *distinct* answer
  R-SPINE-007 demands: fill `var(--graphite-50)`, border 1 px solid `var(--graphite-300)`,
  radius `var(--radius-4)`, padding `var(--space-3)` `var(--space-4)`. Content: title
  `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`, body `var(--text-13)`
  `var(--graphite-700)`, and — server-fault variant only — the fault id line in
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`,
  reading the label `auth_fault_id_label` then the id. Graphite chrome on purpose: semantic
  tints belong to refusals; a fault is the machine's failure, not an answer, and it dresses
  in no meaning colour.
- `<div data-testid="s-auth-notice" role="status">` — the outcome notice: fill
  `var(--info-surface)`, border 1 px solid `var(--info)`, radius `var(--radius-4)`, padding
  `var(--space-3)` `var(--space-4)`, text `var(--text-13)` `var(--graphite-900)`. In "sent"
  and "done" states the notice **replaces** the form (nothing is left to submit;
  re-submission only invites RATE_LIMITED) and the footer links remain.

Footer links are real `<a>`s in the evidence-link idiom: `var(--text-13)`
`var(--weight-body-medium)` `var(--beam-600)` underlined at rest, hover `var(--beam-500)`
over `var(--motion-state)` `var(--ease)`, reticle on focus. A footer line that pairs prose
with a link sets the prose in `var(--graphite-600)` weight 400.

While a submit is in flight the Button takes core's `loading` state (`aria-busy`, no
spinner) and the fields set `disabled`; the answer slot clears. On a refusal or fault the
form re-enables with values intact — RATE_LIMITED included; the remedy says when to retry
and the screen never disarms the retry.

## 2. The routes — flow and copy, verbatim

### /sign-up — title **Create your account**
Fields: **Email** (`type="email"` `autocomplete="email"`, testid `s-auth-email`) ·
**Password** (`type="password"` `autocomplete="new-password"`, `s-auth-password`) ·
**Workspace name** (`autocomplete="organization"`,
`s-auth-tenant-name`) with hint line under the label, `var(--text-12)`
`var(--graphite-600)`: **Your company or team — you can rename it later in settings.**
(R-UI-033: sign-up names the tenant; rename lives in settings.)

No field on any S-Auth route carries a placeholder. Three empty boxes in a column read as one
control repeated; giving one of them grey text inside and the other two nothing makes the row
uneven for no gain, and a placeholder that survives into a filled field is a label that
disappears exactly when it is being relied on. The one field that needs saying more than its
label says — the workspace, which names a thing the person has not met yet — says it in the hint
line under the label, where it stays legible while they type and where `aria-describedby` reads
it out. Submit **Create account**
(`s-auth-submit`). Success → the heading becomes **Check your email** over the sent notice: **We sent a
verification link to {email}.** (a heading names what the screen is showing, and the form it
named is gone; the notice then says only what the heading has not, and names the address the
mail went to — repeating "Check your email" two lines under itself is dead weight, and a
person who mistyped can only catch it if the screen shows what they typed. `{email}` is the
submitted field, filled by the string seam's `fill`.) Refusals here: ACCOUNT_ALREADY_EXISTS, RATE_LIMITED. Footer:
**Already have an account?** **Sign in** → `/sign-in`.

### /sign-in — title **Sign in to Vextrus**
The form is the `SignInForm` named export (`sign-in-form.tsx`), optional `perform` prop
replacing the tRPC transport (jsdom acceptance); given `perform`, the form calls it and maps
the settlement identically: a registered refusal → the refusal slot; anything else → the
fault card, with the id line when the fault envelope carries one. Fields: **Email**
(`autocomplete="email"`) · **Password** (`autocomplete="current-password"`). Submit
**Sign in**. Success navigates to `/`. Refusals: CREDENTIALS_NOT_VALID, RATE_LIMITED.
Footer links, in order: **Email me a sign-in link** → `/magic-link` · **Forgot your
password** → `/reset` · the pair **New to Vextrus?** **Create account** → `/sign-up`.

### /verify — title **Verify your email**
No form. With `?token=`: on mount call `verifyEmail(token)`; while pending, one Skeleton
block 48 px tall in the body slot (layout kept, no spinner). Done → heading **Your email is verified** over notice **Your email is
verified — sign in to continue.** with footer link **Go to sign-in** → `/sign-in`. An
invalid token → TOKEN_NOT_VALID in the refusal slot. Without `?token=`: notice **This page
needs the verification link from your email — open the link to continue.**

### /magic-link — title **Sign in with a magic link**
Without `?token=`: field **Email** (`autocomplete="email"`) · submit **Email me a link**.
Success → heading **Check your email** over notice **Your sign-in link is on its way.** Refusals:
RATE_LIMITED, LINK_NOT_SENDABLE (requesting a link for an unknown email still answers the sent
notice — the outbox stays silent, the screen never confirms which emails exist). With `?token=`: the
/verify pattern — Skeleton while `consumeMagicLink(token)` runs, success navigates to `/`,
an invalid token → TOKEN_NOT_VALID. Footer: **Use a password instead** → `/sign-in`.

### /reset — title **Reset your password**
Without `?token=`: field **Email** · submit **Email me a reset link** · success heading
**Check your email** over notice **A reset link is on its way.** (same non-disclosure as magic-link).
With `?token=`: field **New password** (`type="password"` `autocomplete="new-password"`,
testid `s-auth-password`) · submit **Set new password** · success heading **Your password is set** over
notice **Your password is set and your other devices were signed out.** with footer link **Continue** → `/` —
R-SPINE-001's revocation, said plainly. Refusals: TOKEN_NOT_VALID, RATE_LIMITED, and
LINK_NOT_SENDABLE on the mailing half. Footer
(both modes): **Back to sign-in** → `/sign-in`.

### /sessions — title **Sessions**, caption **Everywhere you are signed in.**
The signed-in page: same centred column at `min(560px, calc(100vw - var(--space-8)))`, no
mark (I-10); caption `var(--text-13)` `var(--graphite-600)` under the `<h1>`. The body is
the session list from `listSessions`, rendered in answer order: rows (`s-auth-session-row`)
at `var(--row-comfortable)` height, hairline dividers (`var(--hairline)` bottom), no zebra.
Row anatomy: left, the device label `var(--text-13)` `var(--graphite-900)` over **Signed in
{date}** in `var(--font-mono)` `var(--text-12)` `var(--graphite-600)` `tabular-nums
slashed-zero` — the date is `createdAt` through the `src/core/format` date seam (DD MMM
YYYY, L-FMT-01). Right: the current row carries the core Badge **This device**
(`s-auth-session-current`) and no revoke control; every other row carries a core Button
`data-variant="danger"` **Revoke** (`s-auth-session-revoke`) — danger, never copper: ending
a session is destructive, not an act. Revoke takes the Button's loading state; on success
the row leaves the list with no animation. Below the list, `var(--space-5)` above, a
secondary Button **Sign out** (`s-auth-signout`); success navigates to `/sign-in`.
Recorded IOU: R-UI-031's visible navigation to `/sessions` is owed by the shell increment
(inc-013) — until then the route is journey- and URL-reachable, and this Decision records
that as the shell's debt, not this screen's.

## 3. Registry entries (R-SPINE-062) — the new codes, verbatim

Copy obeys the refusal-state Decision's rules: one present-tense sentence of what was
refused; remedy verb-first; no "sorry", no "please", no exclamation marks.

| code | severity | surface | message | remedy |
|---|---|---|---|---|
| CREDENTIALS_NOT_VALID | error | inline | **The email and password do not match an account.** | **Check both and try again, or reset your password.** |
| TOKEN_NOT_VALID | error | inline | **This link is no longer valid — it may have expired or already been used.** | **Request a fresh link and use the newest email.** |
| RATE_LIMITED | warning | inline | **Too many attempts in a short time, so this one was not tried.** | **Wait a minute, then try again.** |
| ACCOUNT_ALREADY_EXISTS | error | inline | **An account with this email already exists.** | **Sign in instead, or reset the password if you have lost it.** |
| LINK_NOT_SENDABLE | error | inline | **No link was sent, because this installation has not been given the web address its links point back to.** | **Ask an operator to set the address this installation answers at, then ask for the link again.** |

LINK_NOT_SENDABLE is the mailing doors' answer when the deployment has named no address of
its own (R-SPINE-001): a link can only point back at an address the installation actually
answers at, and the address a request carries is written by whoever sent it — so an
installation that named none sends nothing rather than mailing a live credential to a link
nobody can follow. It is `error`: refused, and needing a correction only an operator can
make. The refusal is the same for every address, decided before the address is looked up,
so it discloses no more than the sent notice does.

RATE_LIMITED is `warning` by the fixed severity rule: refused but expected and recoverable
in stride. Evidence (caller-supplied, per screen): CREDENTIALS_NOT_VALID
`{ href: "/reset", label: "Reset your password" }` · ACCOUNT_ALREADY_EXISTS
`{ href: "/sign-in", label: "Go to sign-in" }` · TOKEN_NOT_VALID points at the route that
issues a fresh token — `/magic-link` **Request a new link** on magic-link, `/reset`
**Request a new link** on reset, `/sign-in` **Go to sign-in** on verify · RATE_LIMITED
`{ href: <the current route>, label: "Try again" }` — after the window, the same door is
the resolving place · LINK_NOT_SENDABLE `{ href: "/sign-in", label: "Go to sign-in" }` — no
mailed link is coming, so the password door is the way in that remains. On `/sessions`, a dead or missing session answers SIGNED_OUT: the
registered banner entry renders in the refusal wrapper **in place of the list**, full
region width, evidence `{ href: "/sign-in", label: "Go to sign-in" }`.

Fault strings (`auth.ts`): `auth_fault_title` **Something went wrong on our side** — the
key is an alias of `spine.error_title`, not a second spelling of it, so "the root-boundary
voice, kept" is kept by construction (B-17) ·
`auth_fault_body` **The fault has been recorded for the operators — try again.** ·
`auth_fault_unreachable_body` **We could not reach the server — check your connection and
try again.** (I-12) · `auth_fault_id_label` **Fault id**. The root-boundary voice, kept.

## 4. The R-UI-050 matrix, ruled

Form routes (sign-up, sign-in, magic-link request, reset request): loading = the submit's
`aria-busy` leg (§1; nothing loads before input, so no page skeleton) · empty = the pristine
form itself (it teaches by asking; R-UI-033's next action) · error = the fault card, both
variants · refusal = §3 in the slot · partial = impossible (one procedure, one answer) ·
offline = I-12 · permission-denied = impossible (these doors exist to be anonymous). Token
panels (verify, magic-link/reset consume): loading = the 48 px Skeleton · empty = the
missing-token notice · the rest as above. /sessions: loading = three Skeleton rows at
`var(--row-comfortable)` (layout kept) · empty = impossible by construction — viewing
requires the session that would be listed · error = fault card in place of the list ·
refusal/permission-denied = SIGNED_OUT banner (§3; the permission is a live session, held
by signing in) · partial = impossible (one query, own rows) · offline = I-12.

## 5. Motion (R-UI-004)

Route transitions, none. Refusal, fault and notice appear with no entrance (the RefusalState
ruling: theatre in front of an answer reads as apology). The only motion: link and Button
colour over `var(--motion-state)` `var(--ease)`, the reticle draw in its single home, and
the Skeleton pulse — every duration a token zeroed at source under reduced motion, with the
reticle's and Skeleton's explicit reduce branches already in core.

## 6. Themes

`s-auth.css` carries exactly one `[data-theme]` rule — the I-10 mark swap. Everything else
flips through token values: page ground, graphite text roles, the fault card's graphite
chrome, `info-surface`/`info` on the notice, beam links, danger Revoke. Contrast holds on
the founder values in both themes: `graphite-600` captions ≥ 4.5:1 on `graphite-0`,
`graphite-700` labels likewise, `beam-600` on `graphite-0` and on `info-surface` ≥ 4.5:1,
the semantic pairs per the refusal-state ruling.

## 7. Test hooks (closed contract, C-05)

Routes: the six of §2; `POST /api/auth/sign-up` answers 404 (server-side law, no screen).
Test ids, exactly the eleven: `s-auth-email` · `s-auth-password` · `s-auth-tenant-name` ·
`s-auth-submit` (each on the core Input / Button element itself) · `s-auth-refusal` (wrapper
of one RefusalState; the component's five ids nest inside) · `s-auth-fault` · `s-auth-notice`
· `s-auth-session-row` · `s-auth-session-current` (the Badge) · `s-auth-session-revoke`
(each non-current row's Button) · `s-auth-signout`. Behavioural hooks without new ids:
`role="alert"` on the fault card, `role="status"` on the notice, `aria-busy` on the loading
submit, `data-code`/`data-surface` on the nested RefusalState, the `<h1>` per route as
titled in §2. jsdom acceptance renders `SignInForm` with an injected `perform`: a settled
CREDENTIALS_NOT_VALID appears inside `s-auth-refusal` with the §3 message and remedy; a
rejected `perform` renders `s-auth-fault` with the fault-id line — two different answers,
never one (R-SPINE-007). Journey checkpoints (axe serious/critical = 0 at each):
`s-auth-sign-up` on `/sign-up`, `s-auth-signed-in-sessions` on `/sessions` with the current
row marked, `s-auth-reset-done` after the reset flow.
