# Reviews run by code: `scripts.factory.review run <PR> --round <n>`

Status: accepted 2026-10-05 by the owner (Q3: no model on allowlist-only PRs; docs-only PRs follow below; Q1: effort and models). It
supersedes the review part of ADR 0042 (the `/review-pr` skill run by an agent); the rest of ADR 0042 stands.
The spec is `docs/specs/factory.md` §3.8.

## Decision
1. **One command reviews a PR:** `uv run python -m scripts.factory.review run <PR> --round <n>` (from the main checkout, in
   the background). It reads the head from the PR, claims a slot, picks the tier, runs the lenses, replays the
   findings and writes the ledger record. The orchestrator no longer runs a review by hand. Its siblings are `collect` (one decision from the cloud reviewers' verdicts) and `fix-message` (the builder's fix message from the latest recorded round).
2. **Tiers are allowlists** (`scripts/factory/review_tiers.toml`). A path nobody listed is `normal`. A PR whose
   only change is hash lines added to the leak-scan allowlist is allowlist-only, and a PR whose every changed
   path is a plain-text file on the `docs_only` list (`docs/knowledge/lessons.md`, `docs/notes/**`,
   `docs/research/**`) is docs-only. Both get **no model** and pass by code checks. The owner's Q3 ruling covers
   allowlist-only; docs-only is the session's own choice under S14-R1 (#489), for the owner to confirm or
   revoke. Denylists lost in rounds on PRs #478 and #489, so no tier is decided by what is excluded.
3. **Lens models** follow CLAUDE.md "Effort and models": the adversary lens and the refuter on Sonnet 5.5
   `high`, the depth lens on Opus 5.5 `high`.
4. **A failed `ci` check stops a review.** `review run` refuses a PR whose `ci` check (or any check of the `ci`
   workflow) has failed, read once when the head is resolved. A pending `ci`, or a failed web, e2e or engine check,
   is not refused by the command. `merge_ready` still requires every required check green before a merge.
5. **The cap is unchanged:** two fix rounds, a third only under a recorded exception (ADR 0041).

## Consequences
`/review-pr` stays only until S14-R3 retires it. The command card (`.claude/skills/orchestrate-wave/commands.md`)
and CLAUDE.md name the command.
