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

Scope travels as a Postgres session setting on the checked-out connection —
`cubit.tenant_id`, or `cubit.system` plus `cubit.reason` — and is reset before the
connection returns to the pool. The policies in `db/migrations/0001` read exactly
those two settings, so a connection carrying neither matches nothing and sees
nothing. That is the backstop: the refusal is the database's, not a condition
somebody remembered to write.

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

Money is a two-decimal-place quantity. A value carrying more precision has not
been rounded yet, and rounding it at render time would hide the decision, so it
is refused by name: `PRECISION_NOT_APPLIED`.

### The refusal taxonomy — `src/core/errors.ts` (R-SPINE-062)

Closed. Every code carries an English message, a remedy, a severity and a surface
hint; `refusal()` cannot mint a code that is not registered. Q-07's register test
refuses an orphan — a code neither exercised by name nor listed in
`src/core/refusals.deferred.json` with a reason. One code is deferred today:
`CHARACTER_NOT_COVERED`, which belongs to the document lane.

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

**Known limitation:** the woff2 files themselves are not vendored — a build
session cannot fetch them. Dropping `url('…')` in front of the `local()` sources
is the whole change, and nothing else in the tree moves; until then the two
families render with a stand-in on machines without Inter installed, and the
committed Linux baselines are baselines of that stand-in.

### Auth and tenancy — `src/server/auth.ts`, `src/server/tenant.ts`

better-auth with email + password, verification, magic link, reset, and a session
list with revoke (R-SPINE-001). A personal tenant is minted with the user
(R-SPINE-002) as a single statement, so a half-made membership cannot survive a
crash between the two rows. The active tenant is explicit in the URL: `/t/{slug}`,
with `/t/{slug}/p/{code}` reserved as written (D-01).

Two sign-ups can derive one address — `ada@one.test` and `ada@two.test` both want
`ada` — and both can read it free before either writes. The unique index is the
arbiter and the loser asks for the next address (`ada-2`); the driver's error
arrives wrapped by drizzle, so it is the cause chain that carries `23505`. If the
tenant cannot be minted even so, the user row written a moment earlier is
withdrawn and the screen refuses `TENANT_SLUG_TAKEN`: an account never exists
without somewhere to stand, and it never answers a 500 either.

**What is rate-limited, and what is not.** The contract names one limit —
`10 requests / 60 s / IP` on `/api/auth/sign-in/email` — and it is exact: the
eleventh request inside the window is refused `429`, and the screen renders
`AUTH_RATE_LIMITED` in place with its remedy. Every other auth endpoint carries
this instance's general limit of 100 per 60 s, declared rather than inherited:
better-auth's own defaults are *three requests per ten seconds* on anything under
`/sign-in` and `/sign-up` and three per minute on the reset and verification
senders, which refuse ordinary traffic — a suite driving sign-ups back to back, an
office behind one address — with a refusal nobody asked for. Note the shape of the
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
`.env` first and fills whatever is still unset from `.env.example`, so a clone
with no `.env` runs `pnpm checkup`, `pnpm verify`, `pnpm dev` and the journeys
out of the box against C-07's fixed local cluster. Anything already exported —
a real `.env`, CI's job env — wins over both.

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
already held reads `NOT_REQUIRED`: that is a fact about this machine, not a
broken toolchain. `next dev` and `next build` are also kept from writing
`AGENTS.md` and `CLAUDE.md` into the tree (`agentRules: false`), because a
toolchain that dirties the working tree makes every drift check a lie.

## Journeys

- **J-001** — sign up, verify, sign in, magic link, reset, sessions, revoke.
  Invite-accept is *not* here: it arrives with R-SPINE-003 / J-002.
- **J-000** — the whole-product journey. This increment delivers its seed
  segment only: sign up → verify → create tenant. Later milestones extend it.
