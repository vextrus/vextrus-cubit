# Vextrus — how we build (the AI-native SDLC)

Agreed by the owner on 25 Sep 2026 (ADR 0025). Evidence: docs/research/sdlc-claude-code.md. The
harness is configuration and prose, not code. It must never become the product (docs/postmortem.md,
cause 3).

## Per milestone
1. **Grill** the milestone locally (`/grill-with-docs`) at medium effort, raised to high only for
   hard parts. Write `docs/specs/M<n>.md`; the owner signs it off.
2. **Plan** in plan mode: `docs/plans/M<n>.md` (modules, order, test seams, risks).
3. **Ticket** with `/to-tickets` into GitHub Issues: vertical slices that own disjoint files, with
   blocking links. Issues are the only work state. Labels:
   - the five triage states;
   - **`cloud`**: fully provable by committed tests;
   - **`local`**: needs real drawings or the owner's eyes (reading, recognition, model assembly).
4. **Build each ticket:** `/implement`, then `/tdd`, then the fast check (the module's tests, mypy,
   `lint-imports`), then `/code-review`, then a PR that closes the issue. The PR body states what was
   verified, how, and what was **not**.
5. **Gate each PR:**
   - CI is green;
   - a `local` PR also passes the real-drawing check on the Sample Project and the Edison set, run
     locally, and reports pass/fail and counts only;
   - `/code-review ultra` runs on risky PRs (money, geometry, the data spine);
   - **the owner merges.** Only the owner. Claude never approves its own work.
6. **Close the milestone:** the owner and the team walk the running product on real drawings and
   compare with the Hand Takeoff. Only that walk says "done".

## Parallelism
- The built-in Workflow tool launches a wave of ready tickets, each in its own worktree or cloud
  session, each ending in a PR. It is a launcher, not an engine: no custom orchestration code, no
  state of its own, no autonomous merge.
- A wave's size is set by how many independent tickets the milestone has and how fast the owner can
  review. Tokens are not the constraint (ADR 0019).
- The $250 cloud credit is spent only on `cloud` tickets, 3–5 at a time at first, widening once
  review keeps pace. Planning, research and real-drawing work stay local.

## Rules against the Builder's failure modes
- **The harness stays small.** Two hooks of about 200 lines together; no orchestrator, ledger, state
  store, locked paths, held-out tests (Held-out Sets are drawings the owner scores, ADR 0005, not hidden tests) or evidence packs. A harness change needs an owner-approved
  issue and should remove as much as it adds.
- **Green is not done.** CI is necessary, never sufficient; the owner's walk decides.
- **Real drawings from M0.** Synthetic fixtures only for unit mechanics, never offered as proof.
- **Plan one milestone at a time.** Everything later stays rough until its turn.
- **One implementing session per ticket,** plus three read-only reviewers (`refuter`, `qs-critic`,
  `ux-critic`); `drawing-analyst` for local work only. Reviewers flag only correctness and
  stated-requirement gaps.
- **No learning machinery.** A mistake Claude makes twice goes into the one-page `CLAUDE.md`.
- **The stop rule.** A ticket that fails its checks after two continuations goes back to
  `needs-triage` for a human re-spec. No retry loops.
- **Pinned model and effort** (medium) in the committed settings, so cloud sessions inherit them.
- **Every external fact** in the product (a price, an API shape, a rate) cites a source.
- **Reports lead with what is broken or unmeasured.** Cost per merged PR is recorded in the
  milestone's issue.

## The harness after the reset
- **`CLAUDE.md`** under one page, with `CONTEXT.md`, `docs/adr/`, `docs/intent.md`,
  `docs/architecture.md`, `docs/milestones.md` and this file.
- **Hooks:** a self-contained guard (secrets printed; staging everything at once; `.private/`
  staged; deleting untracked files; history rewrite and force-push; skipping hooks; PowerShell) and a
  small SessionStart status that also runs in the cloud; keep `sync` after commit.
- **Skills:** Matt's planning and building set (`grill-with-docs`, `grilling`, `domain-modeling`,
  `to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `tdd`, `diagnosing-bugs`,
  `codebase-design`, `prototype`, `research`, `handoff`, `resolving-merge-conflicts`,
  `writing-for-agents`, `wizard`, `ask-matt`, `improve-codebase-architecture`).
  - Matt's `code-review` is renamed `spec-review`, so the built-in `/code-review` and ultrareview
    are reachable.
  - `product-review` is rewritten for the new product, and `edison-drawings` becomes
    `real-drawings`.
  - The Cubit skills (`lanes`, `readback`, `session-close`, `jev`, `chain`, `wave`), rules and
    workflows are dropped.
- **MCP:** `chrome-devtools` re-pointed at its published package; the `cubit` server removed.
- **Jev:** used in the product per ADR 0011, and in development sessions where a closed question
  helps (the owner's wish).
