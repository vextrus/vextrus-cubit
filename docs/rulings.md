# The owner's rulings, as keyed values

The register `tools/lint/acceptance_lint.py` reads at the base: each line `ruling: <key> = <value>` records one
ruling of the owner that a test can pin. An acceptance commit's `pin: <key> = <value>` line
(`docs/specs/factory/contracts/trailers.md` 3) that gives one of these keys another value fails the lint, naming
the ticket and the key. Any other text here is free; the source of each ruling is the line above it.

Add a ruling when the owner makes one that a test could pin; change one only on the owner's later ruling, and
keep the old line's source in the new line's note. Public words only: no drawing text, no key value.

## 5 Oct 2026

Session 14's Q3, the light review path: an allowlist-only PR (only 64-hex lines added) gets code checks and no
model (`docs/handoff/session-14-prompt.md`, owner questions 3).

ruling: review.allowlist_only_tier = no-model

The review cap: a third review only when every finding left at round 2 was introduced by fix round 1, as its
refuter confirms; never more than three (ADR 0041, amended; the owner: "Allow a fix-regression round").

ruling: review.max_reviews = 3
ruling: review.round3_exception.fix_regression = allowed

The governor refuses a new launch only at a used-up limit (`docs/specs/factory.md`, Usage; #404: "make them 100%
both").

ruling: governor.refuse_at.session_percent = 100
ruling: governor.refuse_at.week_percent = 100

Q23, "Yes, now": cloud sessions may send the two Development Sets' text to Jev under the cloud key, and no other
set's (ADR 0013, amended).

ruling: jev.cloud_key.drawing_text = development-sets-only

The orchestrator runs plain Opus 5.5 at `medium` for the whole session, never `xhigh`
(`docs/handoff/session-14-prompt.md`, "Starting the session" 2).

ruling: orchestrator.effort = medium
