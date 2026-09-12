# The four project pages' choke point — what the change actually did

Correction to commit `d05fe54` ("the four remaining project pages ask the choke point for
themselves"), raised by the branch's adversary.

The commit message says `projectHeld({ tenantId: params.tenant }, project)` armed the row policy
with a workspace the caller may never have been a member of. **That hole was not reachable**:
`src/app/(app)/t/[tenant]/layout.tsx` already refused a segment the account does not hold, and every
one of the four pages renders inside it. The change is a **consolidation**, not a closed hole — one
question, asked once, in one place, with every read below scoped by the answer instead of by the
segment — and behaviour is unchanged (an archived project rendered before and renders now).

What the same commit's pattern DID close is on the viewer: `S-Viewer`'s page asked nothing at all,
and the layout above it never sees the project, so a workspace member on none of its projects got
the screen with a canvas that 403s forever. That page now asks the choke point too (commit
`d4afa1e`), and the refusal has a surface.
