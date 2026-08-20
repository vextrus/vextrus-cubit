# Atlas — the Foundation increment

What the Foundation increment put in the tree, where each seam lives, and which
decisions a later increment inherits rather than re-makes.

## Why it is one increment

**B-15 / C-06.** The gate's own toolchain is born before the gate arms, in one
reviewed unit. Scattering `package.json` scripts, configs and CI across
twenty-six increments while simultaneously locking them made every second
increment fight its own scaffolding. So the whole toolchain surface lands here —
pins, `tsconfig`, the ESLint flat config with every NEVER as a rule, Vitest,
Playwright, drizzle, the nine `scripts/*.mjs`, the full scripts block, CI — and
the locks then hold it. A later increment may amend it only when its spec is
tagged `toolchain` and names the files.

Gate stages arm progressively during this increment: a lane that does not exist
yet is skipped with the recorded reason `LANE_NOT_YET_BUILT` (`method-hashes`,
`catalogue-drift`, `cad`), printed by name, never silently passed. From
increment one every stage is armed.

`pnpm-workspace.yaml` sits at the root with no member packages, and it is load-
bearing. pnpm walks *up* for a workspace root: a checkout that happens to live
under one — a worktree beside its siblings, a CI job under a monorepo — takes
that outer root instead, and `pnpm install --frozen-lockfile` reports
`Done in 600ms` while writing no `node_modules` at all. The next command then
fails on a missing dependency in a tree where nothing is wrong. The marker makes
this repo its own root wherever it is checked out.

## The seams

### SEAM-TENANT — `src/core/db.ts`

`forTenant(ctx)` and `runAsSystem(reason)` are the only database handles in the
product. `cubit/db-seam-only` bans driver and schema imports everywhere else, and
the seam re-exports the schema (`tables`) and drizzle's operators so the rule is
about *where the door is*, not about dragging every query into one file.

Tenant scope travels as a Postgres session setting on the checked-out connection
— `cubit.tenant_id` — and is reset before the connection returns to the pool. The
policies in `db/migrations/0001` read exactly that setting, so a `cubit_app`
connection carrying none matches nothing and sees nothing. That is the backstop:
the refusal is the database's, not a condition somebody remembered to write.

**System scope is a role, not a setting.** It began as a second session setting,
`cubit.system`, and that made the backstop a formality: any connection may set
its own settings, so one statement arriving as `cubit_app` —
`select set_config('cubit.system','on',false), count(*) from tenant` — read every
tenant in the cluster. Measured against `cubit_dbtest`: 4 tenants before,
0 after. `db/migrations/0003` redefines `cubit_is_system()` as *does this role
bypass RLS*, which no session can grant itself, and `runAsSystem(reason)` makes
its connection as `cubit_migrate` instead of `cubit_app`. `cubit.system` and
`cubit.reason` still ride along on the connection, now purely as the sentence on
the record. The cost is named: a system handle carries the owner's rights, which
is why it costs a reason and why `cubit/db-seam-only` keeps the door in one file.

Three roles, as the Bible names them:

| role | what it is | notes |
| --- | --- | --- |
| `cubit_migrate` | owner; runs DDL | holds `BYPASSRLS` so the migration ledger and the seam tests can read the truth a policy would otherwise hide |
| `cubit_app` | tenant traffic | no `BYPASSRLS`; bounded by the policies; grants are explicit per migration |
| `cubit_auth` | better-auth's identity tables | reaches `user`, `session`, `account`, `verification` and nothing else |

`ALTER DEFAULT PRIVILEGES` is deliberately **not** used: a table added by a later
increment is unreachable by `cubit_app` until that increment grants it, which is
the posture we want. Every table carrying `tenant_id` is discovered by that
column alone in `db/__tests__/rls.spec.ts` — a later table cannot slip past a
hand-written list.

**Not yet proven:** append-only grants. No append-only table exists in this
increment (acts arrive with the assure lane), so the discovery harness asserts it
found at least the spine's tenant-scoped tables rather than passing vacuously.

### SEAM-FORMAT — `src/core/format.ts` (L-FMT-01)

The tree's sole caller of `Intl`, `Intl.Collator` included.
`cubit/no-locale-methods` makes `toLocaleString` and `localeCompare` errors
everywhere else. `BD_DOCUMENT` is a named document-convention record read by
conventionless call sites, never an options bag: `en-IN` numbering so lakh and
crore group as `1,00,00,000`, ASCII digits, `৳` prefixed, `DD MMM YYYY`,
`FY2025-26`, Asia/Dhaka wall clock built from local parts. `en-BD` is not a CLDR
locale and is banned.

The wall clock is the *document's*, not the host's: `formatDate` and
`formatFiscalYear` read `BD_DOCUMENT.timeZone`, because the dates they render
come from `timestamptz` columns — genuine instants — and a server running in UTC
would otherwise put a session created ten minutes after Dhaka midnight on the
previous calendar day. Playwright gives the *browser* `timezoneId: 'Asia/Dhaka'`;
nothing sets `TZ` for the Node process, and after this nothing needs to.

Money is a two-decimal-place quantity. A value carrying more precision has not
been rounded yet, and rounding it at render time would hide the decision, so it
is refused by name: `PRECISION_NOT_APPLIED`.

### The refusal taxonomy — `src/core/errors.ts` (R-SPINE-062)

Closed. Every code carries an English message, a remedy, a severity and a surface
hint; `refusal()` cannot mint a code that is not registered. Q-07's register test
refuses an orphan — a code neither exercised by name nor listed in
`src/core/refusals.deferred.json` with a reason. One code is deferred today:
`CHARACTER_NOT_COVERED`, which belongs to the document lane.

**A refusal names what happened, or it names nothing.** `refusalFor()`
(`src/app/(auth)/auth-client.ts`) translates better-auth's codes into ours for
five screens, two of which have no password field at all. Its default arm used to
be `AUTH_INVALID_CREDENTIALS`, which meant a mistyped address on `/sign-up` —
every form carries `noValidate`, so the browser hands `rina.surveyor@` straight
to the server, and better-auth answers `VALIDATION_ERROR` — was refused with
"that email and password do not match an account. …try again or reset the
password": no account to match, no password to reset, a remedy that cannot
resolve the situation (R-UI-020). Unreadable addresses now answer
`AUTH_EMAIL_UNREADABLE`, and anything unmapped answers `AUTH_REQUEST_FAILED` —
a fault says it is a fault and carries a code worth reporting.

### Tokens — `src/ui/tokens.ts` (R-UI-001)

One TypeScript source for colour, spacing, radii, elevation, type, motion,
z-layers and breakpoints. `pnpm gen:tokens` emits it as CSS variables into the
sentinel block of `src/app/globals.css` for `:root` and `[data-theme="dark"]`; a
unit test fails if the committed block differs from a fresh emission.
`cubit/no-colour-literals` keeps every other file free of colour.

The basis palette is fixed and each basis carries a glyph (◆ ▣ ƒ ⇩ ✎ ▦ ○) so the
pair survives greyscale and colour-blindness (R-UI-002).

**Type (R-UI-003).** `globals.css` declares `Inter` and `JetBrains Mono` as its
own `@font-face` rules, resolved with `local()`: the gate and dev both run with
no network beyond loopback (C-07), so a font CDN is not a dependency this
product may take. Where the machine carries the real face it is used; where it
does not, the rule falls through to the nearest installed grotesque or mono so
text still renders with a face the page named.

**Known limitation, and it is AC-19's own clause:** the woff2 files themselves
are not vendored — a build session has no web access (C-07) and may add no
dependency, so there is no way to put the real faces in the tree from here. What
ships is therefore an *alias*: this machine carries only DejaVu and Ubuntu, so a
page that says `Inter` renders DejaVu, and J-001's font assertion — a declared
face reaching status `loaded` — is satisfied by that fallback. The committed
Linux baselines are baselines of the stand-in, and CI (`ubuntu-24.04`, no font
install step) can carry different faces again and spend the 0.002 diff budget on
glyphs. Dropping `url('…')` in front of the `local()` sources, with the two
woff2 files beside it, is the whole change and nothing else in the tree moves.

### Auth and tenancy — `src/server/auth.ts`, `src/server/tenant.ts`

better-auth with email + password, verification, magic link, reset, and a session
list with revoke (R-SPINE-001). The active tenant is explicit in the URL:
`/t/{slug}`, with `/t/{slug}/p/{code}` reserved as written (D-01).

**The personal tenant is minted in the user-create transaction, and no
TypeScript mints it.** R-SPINE-002 and AC-12 name a transaction, and a hook that
runs *after* better-auth's insert cannot be in one: it is a second write, on a
second connection, in a second role, with a window between them where a crash
leaves an account with nowhere to stand. Compensating afterwards — deleting the
user and reporting `TENANT_SLUG_TAKEN` for whatever went wrong — answered a
database outage with "that tenant address is already in use" and a remedy that
could not work. The mint is a trigger on `user` (`db/migrations/0003`,
`SECURITY DEFINER`, owned by `cubit_migrate`), which runs inside the inserting
transaction itself. Proven live against `cubit_dbtest` as `cubit_auth`: a
committed insert lands the tenant and the `OWNER` membership with it; a rolled
back insert leaves neither. `scripts/seed.mjs` therefore plants no personal
tenant of its own — a seeded account gets one the same way a signed-up account
does.

Two sign-ups can derive one address — `ada@one.test` and `ada@two.test` both want
`ada` — and the trigger's loop asks for the next address (`ada-2`) when the
unique index refuses the first. `createTenant()` runs the same race in the open:
it reads the address, then writes it, so two people naming one tenant in the same
moment both find it free. The index is the arbiter there too, and its `23505`
arrives wrapped by drizzle — the cause chain carries the code — so the loser gets
the in-place `TENANT_SLUG_TAKEN` that AC-12 promises rather than a 500. A name no
address can be derived from at all is a different refusal by name:
`TENANT_NAME_UNREADABLE`, because nobody holds that address.

The tenant and its owner are one fact, so `createTenant()` writes them in one
statement: the `tenant_member` row rides out of the tenant's own `INSERT` through
a CTE, atomic by construction. Two statements would let a crash between them
strand a tenant nobody owns while it still holds the address — its creator
refused `TENANT_ACCESS_DENIED` at `/t/{slug}`, everybody else refused
`TENANT_SLUG_TAKEN`, and no screen this increment ships able to undo it. The
trigger path writes both inside the inserting transaction for the same reason.

**What is rate-limited, and what is not.** The contract names one limit —
`10 requests / 60 s / IP` on `/api/auth/sign-in/email` — and it is exact: the
eleventh request inside the window is refused `429`, and the screen renders
`AUTH_RATE_LIMITED` in place with its remedy. Everything else keeps better-auth's
own defaults — three requests per ten seconds under `/sign-in`, `/sign-up` and
`/change-…`, three per minute on the reset and verification senders — with two
named departures and no catch-all. A catch-all would silently lift the senders to
this instance's general limit, and a hundred password-reset mails a minute at any
address somebody names is not something the contract asked for. The departures:
`/sign-up/email` allows ten per minute, because a suite drives sign-ups back to
back and so does an office behind one address (the default's *three per ten
seconds* is up to eighteen a minute, so this is a relaxation of the burst and a
tightening of the minute); `/sign-in/magic-link` allows three per minute, held to
the senders' ration rather than `/sign-in`'s burst, because it is a mail to an
address. Note the shape of the
named limit: it counts requests, not failures, so a suite that spends the window
proving the limit will meet it again on its next sign-in from the same address.

**Known limitation:** better-auth's rate limiting is in-memory and therefore
per-process. The numbers above hold for the single-process deployment this
increment ships; a multi-process deployment needs shared storage before they mean
anything.

Loopback spells itself two ways. `BETTER_AUTH_URL` names `127.0.0.1` (C-07)
while Next's banner invites you to `localhost`, so both origins are trusted —
otherwise a sign-in refuses on the spelling alone. Next's *dev* server keeps its
own list, and refuses to serve its chunks (403) to any spelling but `localhost`
unless told otherwise, which leaves `pnpm dev` at 127.0.0.1 serving markup that
never comes alive; `allowedDevOrigins` names both. `pnpm dev` and `pnpm start`
also move the port of a loopback `BETTER_AUTH_URL` onto `PORT`, so a lane on its
own offset mails links that come back to itself.

The five credential forms are client components that `preventDefault`, and they
also declare `method="post"`: a submit that arrives before hydration must not put
a password in the query string, the browser history and the server log.

That is half the answer; the other half is that the submit *waits* for
interactivity. A native POST to a page path is a `405` from the App Router — a
browser error page, everything typed gone, nothing said — so the control is
disabled until `useHydratedForm` (`src/app/(auth)/hydrated-form.ts`) reports the
form hydrated, and the first thing that hook does is adopt whatever was typed
before React arrived, so the state it takes over with is the person's text rather
than an empty string. `/create-tenant` needs none of this: its form is a server
action, which posts without JavaScript at all.

A sign-up with a blank name is refused in place before better-auth answers
(`unnamedSignUp`). The field is marked `required` and every form here carries
`noValidate`, so that promise is the server's to keep — and it is not cosmetic:
the personal tenant minted in the user-create transaction takes the account's
name, so a blank one mints a tenant with no name and an address nobody typed.
The refusal is `TENANT_NAME_UNREADABLE`, the same code `/create-tenant` gives an
underivable name.

**What each mailed link can do.** A magic link signs in; it is never a way to an
account. Left to itself the plugin mints a user for whatever address follows a
link, so anyone who typed a stranger's address had them mailed a working sign-in
and a verified flag nobody earned — `disableSignUp` closes that, and an address
with no account is not mailed at all. The screen answers "sent" either way, so
the form is not an oracle for who holds an account here. A verification link
works once: better-auth's token is a signed JWT it never spends, so replaying the
URL would report success for as long as the token lived; a link whose address is
already proven is refused in place, by name, with the way to get a fresh one.
The same is true of a spent reset link and a spent magic link — a dead link says
so and offers the next step, rather than a form nobody can submit.

**Signing up on an address that already has an account** refuses in place, by
name (`AUTH_EMAIL_TAKEN`), and writes nothing. Left to itself better-auth answers
a duplicate sign-up with a fabricated success — it declines to say who holds an
account here — and the screen then tells the reader to open a mail nobody sent,
which is exactly the dead end R-UI-020 forbids. The duplicate is refused in the
route before better-auth answers, in the shape its client already reads.

That is deliberately not the magic-link posture two paragraphs above, and the
difference is who is asking. Anyone may ask for a way into anyone's mailbox, so
the magic-link form must never answer *whether* an address is registered. A
sign-up is the one screen where the person is claiming the address as their own,
and the answer they need is the one every product gives: this one is taken. No
second user and no second tenant is written either way, and the account holder's
mailbox stays quiet.

**The six states each owned screen defines (R-UI-050).** Refusal is
`RefusalState` in place with code, message and remedy; permission-denied is one
of those refusals by name (`TENANT_ACCESS_DENIED` on `/t/{slug}`); empty teaches
the next action (`/t/{slug}`, `sessions-empty`). The other three are the shell's,
because they belong to every screen equally: `loading.tsx` renders a skeleton
that keeps the layout — never a spinner (R-UI-004) — for the auth screens,
`/account/sessions` and the tenant home; `error.tsx` catches a *fault* (as
distinct from a refusal the product decided) with a retry and a report id, the
server's digest where there is one and a fresh id where there is not; and the
offline banner in the layout says the screen has gone read-only rather than
letting a form fail silently. Partial (some rows refused, shown not hidden) has
nothing to be partial about yet: no screen here renders a list that can be
refused row by row.

**The device list** cannot be empty in the literal sense — reading it takes a
session. `sessions-empty` therefore says what the reader came to find out: that
nothing *else* is signed in. The list always shows this device with its badge;
the note appears beside it when no other device holds a session.

**Revoke is a document POST, not a server action.** It is the one control on
these screens whose promise is about a *different* browser: when it answers, that
device is out. A server action's submit is a background fetch, so the click is
over as soon as the request is dispatched — the row disappears from this page a
moment later, and in that moment the revoked device's next navigation still finds
a live session. Nothing in the flow ordered the two. `/account/sessions/revoke`
is a plain `<form method="post">` to a route handler that revokes and answers
`303`: the browser is still navigating while the server works, so the session is
gone before the click returns and the redirect brings back a page that says so.
The handler sends a *relative* `Location` and compares the form's `Origin`
against the `Host` the request arrived at — `request.url` reports `localhost`
whichever spelling of loopback the browser used, so both an absolute redirect and
an origin check built from it would answer the wrong machine.

**The document title is rendered, not exported.** Next streams exported
`metadata` inside a boundary it tears down and rebuilds on every re-render:
measured on the device list, one `<title>` removal per revoke, nine across eight.
Anything reading the page in that window sees an untitled document — an
accessibility scan included (R-UI-060, Q-11). Rendered in the layout's tree,
React hoists title and description into the head once and reconciles them in
place; the same measurement gives zero.

## The environment

`.env.example` is the contract, and it is also the default. Every script loads
`.env` first, then this machine's `.env.local`, and fills whatever is still unset
from `.env.example`, so a clone with no `.env` runs `pnpm checkup`, `pnpm verify`,
`pnpm dev` and the journeys out of the box against C-07's fixed local cluster.
Anything already exported — a real `.env`, CI's job env — wins over all three.

**The one value `.env.example` does not carry is the signing secret.** A
committed `BETTER_AUTH_SECRET` that stands in for an unset one is a deployment
whose session cookies are signed with a value anyone can read in this repository,
and — just as bad for a report whose whole job is to say what this machine is — it
makes an unconfigured machine indistinguishable from a configured one. So the
example leaves it commented out, and `scripts/lib/run.mjs` mints 32 random bytes
into the gitignored `.env.local` when nothing else set it: one secret per
workspace, shared by every process in the lane, surviving a restart. `checkup`
says which it is — `ENV BETTER_AUTH_SECRET OK` when something configured it,
`MINTED` when the toolchain stood in, and `DEFAULTED` on the lines `.env.example`
answered.

**A tree that arrives without its `.git`.** Two tests ask git what this workspace
holds rather than trusting a glob: the refusal register walks `git ls-files` for
the corpus it searches (Q-07), and the migration ledger walks `git log` for the
history it forbids rewriting (AC-08). An export — a copy, a tarball, an unpacked
artefact — has no answer to give, and `pnpm verify` then fails at its vitest
stage with `Command failed: git ls-files`, which says nothing about the code.
`scripts/vitest-global-setup.mjs` makes a workspace that is not a checkout into
one before the files run, and stages what is there, so `git ls-files` lists
exactly this tree. It commits nothing: history is not ours to invent, and a test
that reads history must still meet the truth. In a checkout it does nothing.

**A port that somebody else is holding** is worth a look before blaming the code.
`pnpm dev` and `pnpm start` bind `PORT` and exit `EADDRINUSE` if it is taken —
loudly, but only in *their* log. A server left behind by an earlier run answers
on that port with an earlier build, an earlier database and an earlier outbox,
and everything driven against it fails in ways that look like product faults.
`pnpm checkup` reports each port it can bind, which is the cheapest way to find
this before a suite runs.

## Composition, pre-wired (AS-A1)

`src/server/router.ts` mounts `spine` plus `takeoff`, `assure`, `book`,
`estimate`, `bid` and `ai`; `db/schema/index.ts` composes `spine.ts` plus the five
per-area stub files. Both are written once, here. An increment that fills a
module in adds procedures and tables to its own files and never edits
composition, so two increments never collide in the same lines.

## The lanes and what runs them

| lane | command | what it proves |
| --- | --- | --- |
| verify | `pnpm verify` | typegen → tsc → eslint → vitest → schema drift → (skipped stages) → cold build |
| database | `pnpm test:db` | RLS per table, cross-tenant refusal, the migration ledger — live, on 127.0.0.1:5544 |
| journeys | `pnpm e2e --journey J-001 --journey J-000` | J-001 auth end to end; J-000's seed segment; axe at every checkpoint; visual baselines |
| machine | `pnpm checkup` | pins, Postgres, roles, ledger, ports, storage, env |

**`verify` reports on one stream.** Its summary line is contractually last, and a
reader that captures stdout and stderr separately — as the gate does — sees
everything on stderr *after* everything on stdout, however the two were
interleaved in time. A single warning from `next build` was enough to put a line
after `VERIFY OK`. So verify says everything with `console.log`, including its
failure line, and every stage runs with its stderr wired to verify's own stdout:
one ordered stream, an empty stderr, and the summary genuinely last. The wall
time in that summary is whole seconds; the per-stage lines keep their tenths.

`checkup` reports C-07's two fixed ports — 3210 and 3211 — whatever lane it is
run in, and adds this lane's own offsets when they differ. A report that changed
which ports it reported with the environment would be no report at all. A port
already held reads `IN_USE`: that is a fact about this machine, not a broken
toolchain, so it does not fail the report — but it is not `NOT_REQUIRED` either,
which means "no lane has asked for this yet". A reader scanning for trouble must
not meet one word for a tool nothing needs and for the port their next `pnpm dev`
cannot have. `next dev` and `next build` are also kept from writing
`AGENTS.md` and `CLAUDE.md` into the tree (`agentRules: false`), because a
toolchain that dirties the working tree makes every drift check a lie.

## Journeys

- **J-001** — sign up, verify, sign in, magic link, reset, sessions, revoke.
  Invite-accept is *not* here: it arrives with R-SPINE-003 / J-002.
- **J-000** — the whole-product journey. This increment delivers its seed
  segment only: sign up → verify → create tenant. Later milestones extend it.
