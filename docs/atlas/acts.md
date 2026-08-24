# Atlas — the act seam (`src/core/acts`)

SEAM-ACT: *the act seam is the sole writer of the act log and of every human-authored state
change; it checks the permission map, requires the consequence digest, writes act + state in one
transaction, and refuses non-human actors by type.*

Founded by inc-013. This is the map of what is here, why it is shaped this way, and what a later
increment has to do to add an act.

## The one door

`src/core/acts/index.ts` is the module's whole import surface. Everything above it — the tRPC
namespace in `src/server/routers/acts.ts`, and the screens that will come — reaches the seam
through the barrel and never past it. What does *not* leave the directory is the write path: the
three tables, the statements that write them and the `sql` tag those statements are built with.
`db/__tests__/acts.test.ts` scans `src/**` for both halves of that.

| Export | What it is |
| --- | --- |
| `ACT_TYPES` · `PERMISSIONS` · `ROLE_BUNDLES` | the closed vocabulary, frozen, keys unquoted |
| `ACT_TYPE` · `PERMISSION` · `ROLE` | the same names as values, for code that must say one |
| `ACT_PERMISSIONS` | the total map act type → permission (L-ACT-03) |
| `previewAct` / `commitAct` | L-ACT-02's pair, over any act type |
| `foundPrincipal` | the bootstrap J-003 composes into project creation |
| `listParticipantHistory` | R-SPINE-011's "role history visible" |
| `ActSeamRefusal` · `refusalCodeOf` | the one thing the seam throws, and how to read it |

## The three tables

```
participants        (tenant_id, project_id, user_id)   unique (project_id, user_id)
participant_roles   (tenant_id, project_id, user_id, role, act_id → acts.id, created_at)
acts                … + project_id, composite FK (project_id, actor_id) → participants
```

Participation is a database fact, not a convention: the composite key means an act on a project
by somebody who takes no part in it cannot be written at all, by any code path, including one
that never learned to check. The key is `MATCH SIMPLE`, so the project-less act rows inc-010
writes stay legal.

`cubit_app` holds `SELECT` and `INSERT` on all three and neither `UPDATE` nor `DELETE`. That
grant is what makes the log append-only, so a demotion is a **new** `participant_roles` row and
the current role of a `(project, user)` is the last row of its history — never a column somebody
overwrote. RLS is enabled and FORCEd on both new tables with the inc-001 two-arm policy.

## One statement, not one transaction

L-ACT-01: *act row and state change commit in one transaction or neither.* The write is a single
data-modifying CTE in `participation.ts` — participation, then the act, then the grant that cites
it — because drizzle pins a connection only for a client whose class name says "Pool", and a
`handle.transaction` whose statements travel on different connections commits the first write and
loses the rest. One statement cannot be split, and `src/core/db.ts` already wraps every statement
it runs in a transaction of its own.

Postgres checks the composite foreign key at the *end* of the statement, which is why
`foundPrincipal` can insert the participation and the act that names it in the same CTE. Proven
on live Postgres in `db/__tests__/acts.test.ts`, not assumed.

The `sql` tag itself is borrowed off the relational reader (`operators.ts`) rather than imported,
because `drizzle-orm` is lint-banned outside `src/core/db.ts` (SEAM-TENANT).

## The guard is the project's, so the guard holds a lock

L-ACT-03's *the last PRINCIPAL cannot be removed* is a claim about the project's state, not about
one request's arithmetic. One statement makes the write atomic; it does not make the **read that
decided it** and the write one thing. `commitAct` therefore runs the whole of it —
permission, recomputed Consequence, guard, digest, write — inside `underProjectLock`
(`participation.ts`): one drizzle transaction (`ScopedPool.connect()` pins it and carries the
scope), opened with `pg_advisory_xact_lock` keyed on the project.

The lock is its own statement, **ahead of** the read. Under READ COMMITTED each statement takes
its own snapshot, so a lock taken in the same statement as the read would be acquired after that
statement's snapshot was already fixed: the callers would queue and the second would still read
stale rows. Taken first, the second caller's read sees the first one's committed write and the
guard refuses — the sequential outcome, which is the one the law describes. Without it, two
principals demoting each other each read "one would remain" and the project ends with none; since
`ADMINISTER_PROJECT` is bundled by `PRINCIPAL` alone and the log is append-only, no act could ever
put one back. `db/__tests__/inc-013-act-seam-breaker.test.ts` runs the two commits together.

`foundPrincipal` takes the same lock, and under it asks whether the project has participants yet.
It skips the permission check because the bootstrap has nobody to ask — on a project that already
has participants there *is* somebody, so it is an ordinary assignment and answers to
`ACT_PERMISSIONS` like any other. Otherwise the hook, which is exported, would mint a `PRINCIPAL`
on any project id for any caller.

## Ids, order and tenant

Three smaller things the seam decides rather than the driver:

- **Ids are uuids at the border.** `identity.ts` refuses a `projectId` or `userId` that is not
  one, with the same `TypeError` the seam already raised for a missing id. Left to the driver it
  arrives as `22P02 invalid input syntax for type uuid`, which is no refusal a caller can branch
  on — `refusalCodeOf` does not know it, so the router rethrows and the caller is told the server
  broke. The router types them `z.uuid()` for the same reason, one border earlier.
- **History order is insertion order.** `created_at` defaults to `now()`, the *transaction's*
  timestamp, so grants written at one instant tie — and the tie was broken by `id`, a random
  uuid, which makes "the current role" a coin toss between a promotion and the demotion that
  replaced it. `participant_roles.seq` is a `bigserial`, monotonic per insert; every ordering is
  `created_at` then `seq`. Nothing above the seam reads it.
- **A participation belongs to its project's tenant.** `tenant_id` comes from the writer's scope
  and `project_id` is a plain foreign key, and foreign keys are checked without RLS — so the two
  could disagree. `participation_belongs_to_tenant` (0005) is an AFTER INSERT trigger on both
  tables, after the policy's `WITH CHECK` so a plainly cross-tenant row is still refused as one.
  Binding participation to *tenant membership* as well is not done: `db/__tests__/acts.test.ts`
  mints participants for users who hold no `tenant_memberships` row.

## Adding an act type

1. Add the name to `ACT_TYPES` in `vocabulary.ts` — an **unquoted identifier key**, never a
   string-literal union and never a `z.enum([...])` with the spelling in it (Q-07's orphan scan
   reads every screaming-snake literal under `src/` as a refusal code).
2. Give it its permission in `ACT_PERMISSIONS`. It `satisfies Record<ActType, Permission>`, so
   forgetting is a compile error.
3. Write the pair — `preview(ctx, input) → Consequence`, `commit(ctx, consequence)` — in its own
   file, and register it in `ACT_RENDERINGS` in `seam.ts`. That map `satisfies
   Record<ActType, ActRendering>` too: L-ACT-02's "a type without a rendering is a compile error".
4. Write its state change through one CTE in `participation.ts`'s style. Nothing outside this
   directory may write the log.
5. Mount the pair with `actPair` in `src/server/routers/acts.ts`.

The Consequence is what the digest is taken over, so every member of it is state the commit must
still find true. `digest.ts` serialises canonically (keys sorted, `undefined` dropped) and hashes
with SHA-256; the same primitive lives in `src/server/trpc.ts` for the inc-011 pair, duplicated
rather than imported because `src/core/acts` must not import from `src/server`.

## The refusals

Three, registered in `src/core/errors/acts.ts` and spelled nowhere else under `src/`:

- `PERMISSION_NOT_HELD` — carries the act type and the missing permission (L-ACT-03), so a reader
  learns what would have to be granted. Transported as `FORBIDDEN`.
- `CONSEQUENCES_NOT_CARRIED` — the digest carried in is not the one current state produces, so
  the human confirmed a state that is no longer there. Transported as `CONFLICT`.
- `PROJECT_WOULD_HAVE_NO_PRINCIPAL` — the last principal cannot be demoted away. Checked on the
  preview, and so on the commit that recomputes it. Transported as `CONFLICT`.

The code is the TRPCError *message*, verbatim (the spine.ts convention).

## What is not here yet

R-UI-021's ConsequenceDialog and the role-history screen (they land with their screens; this is
the seam they call), bulk grouping offers, before-image rejection and the corroborate/repudiate
machinery, and every act type beyond `ASSIGN_PARTICIPANT_ROLE`. `spine.members.setRole` keeps its
own inc-011 convention and has not been rewired onto this seam.
