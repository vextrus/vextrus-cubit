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
