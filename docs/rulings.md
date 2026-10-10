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

Session 18, the owner (9 Oct 2026), on G1's bulk-confirmable share: "Number run counts (Recommended)": when a
Discipline has no drawing list and no PDF, an unbroken run of sheet numbers counts as the second source; a sheet in
that run with no open Question can be confirmed in bulk.

ruling: step1.second_source.no_list_no_pdf = unbroken-number-run

Session 19, the owner (9 Oct 2026), on the boundary storey: "Settle by convention (Recommended)": when two column
or shear-wall plans state storey ranges that share an end, Vextrus settles it by the Dhaka convention that the
first plan's columns stop at that slab (`excludes_storey`), records both titles as Trace and asks no Question; it
asks only when a third plan of the same subject also claims that storey. A meeting counts only when both views
state a two-ended "X to Y" range; a list or a "below ground" phrase never meets.

ruling: step1.boundary_storey.two_plans = settle-by-convention
