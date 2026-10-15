# Reviews run by code: `scripts.factory.review run <PR> --round <n>`

Status: accepted 2026-10-05 by the owner (Q3: no model on allowlist-only PRs; docs-only PRs follow below; Q1: effort and models). It
supersedes the review part of ADR 0042 (the `/review-pr` skill run by an agent); the rest of ADR 0042 stands.
The spec is `docs/specs/factory.md` §3.8.

## Decision
1. **One command reviews a PR:** `uv run python -m scripts.factory.review run <PR> --round <n>` (from the main checkout, in
   the background). It reads the head from the PR, claims a slot, picks the tier, runs the lenses, replays the
   findings and writes the ledger record. The orchestrator no longer runs a review by hand. Its siblings are `collect` (one decision from the cloud reviewers' verdicts) and `fix-message` (the builder's fix message from the latest recorded round).
2. **The no-model tiers are allowlists** (`scripts/factory/review_tiers.toml`). A path nobody listed gets a
   model (amended 14 Oct 2026, below: one lens or two by the risk list). A PR whose
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

## Amendment, 14 Oct 2026 (S29-F7; the owner's rulings Q5, Q15 and Q21)
The model tiers are `ordinary` and `risk`; `small` and `normal` are gone, and size no longer decides.
- **Risk** (Q5, Q15: "the full panel on a risk tier written down as paths"): a PR with any path on
  `review_tiers.toml`'s `[risk]` list (the engine, takeoff, money, access and members, migrations, the
  factory's gate code with that list and its reader, the hooks, settings and agents, the scorer) gets lens A
  and lens B, and the refuter on every head. So does a path on no `[ordinary]` glob: risk is the default
  (S29-F7-R; PR #884's review found a missed gate file in each of two rounds). `scripts/factory/tiers.py`
  reads both lists for the review and the landing; a list that cannot be read makes every path risk.
- **Ordinary**: a PR whose every path is plain product work (`[ordinary] paths`: `web/src`, the modules
  off the risk list, `docs`) and none on `[risk]` gets lens B alone, plus CI. The refuter runs on one ordinary head in five,
  decided by code from the PR and its head (`tiers.refuter_sampled`).
- **The bar** (Q21: "a finding blocks only with a reproduction on that head"): on an ordinary head the
  refuter does not sample, a finding no replay of its own test confirmed is UNPROVEN and filed; a replayed
  one blocks. The lens brief says so, and to judge intent and user impact.

This list names walls, which item 2 said no tier does. The owner's rulings choose it; the risk it carries is
bounded: a wall the list misses still gets one lens, CI, the replay of every reproduction and the refuter
on one head in five, never no model. The words lens is unchanged.

**Amended 15 Oct 2026 (S30-F7, issue #898):** the `[ordinary]` list is gone (its folders gave four access files
one lens, PR #896's round 1): a path is ordinary only on the bar's lax set (`[lax]` less `[strict]`, `ledger.on_strict_path`
false) and on no `conftest.py`, `[risk]` or `[docs_only] never` glob; `[risk]` names the web views that reach access.

## Consequences
`/review-pr` stays only until S14-R3 retires it. The command card (`.claude/skills/orchestrate-wave/commands.md`)
and CLAUDE.md name the command.
