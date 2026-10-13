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

Session 19, the owner (9 Oct 2026, 19:05Z), on the boundary storey: "Settle by convention (Recommended)": when two
column or shear-wall plans state storey ranges that share an end ("foundation to 3rd" and "3rd to 6th"), Vextrus
settles it by the Dhaka convention that the first plan's columns stop at that slab (`excludes_storey`), records both
titles as Trace and asks no Question; it asks only when a third plan of the same subject also claims that storey.
A meeting counts only when both views state a two-ended "X to Y" range; a list or a "below ground" phrase never
meets. This narrows m0-screens 6.7's boundary-storey card. One ruling, recorded twice: by the session-19 close and by
S19-B2, which built it and amended the documents (Train B).

ruling: takeoff.boundary_storey.shared_end = excludes_storey
ruling: takeoff.boundary_storey.meets_only = two-ended ranges

Session 20, the owner (10 Oct 2026, 09:16Z), on Edison E-16/E-17 (a copied title block over a different drawing that
only the drawn content tells apart): "Keep it in M0": build a content comparison now; G1's expectation is unchanged.
Built as S19-B7 (content twins: each sheet of the pair has a near twin in its file by weighted layer overlap of 0.9 or
more, the twins' title stems differ, and each sheet is closer to its twin than to its partner).

ruling: g1.edison.e16_e17 = true-question, content-twins

Session 20, the owner (10 Oct 2026, 09:19Z), on cover and contents sheets in G1's sheets_match: "Covers count
(Recommended)": a cover or contents sheet is a Sheet the QS sees and confirms or leaves out; Edison's expected count is
218 (the walk expectation, kept under .private/).

ruling: g1.sheets_match.covers = count

Session 20, the owner (10 Oct 2026, 18:37Z), on Train A after its third review round: "Allow one round 4
(Recommended)". The ledger caps rounds at three, so the extra round was run as round 1 of a fresh PR on the same head
(#641 for #638); the cap itself is unchanged.

ruling: review.round4.train_a = allowed-once

Session 25, the owner (13 Oct 2026), on the review bar (Q13 and the session's opening answers): a finding blocks at 75,
or at 50 when a QS or MD would meet it (user-facing) or when it sits on a trust boundary (a tenant wall, a parser of
hostile input, a gate, a ledger); an edge or rule-only finding of 50-74 off a trust boundary is filed with its owed check.

ruling: review.bar.block_at = 75
ruling: review.bar.user_facing_block_at = 50
ruling: review.bar.trust_boundary_block_at = 50

Session 25, the owner (13 Oct 2026, 07:16Z), on the save state after a lost act: "New words, no retry": once the
connection is back the status bar reads "Not saved: your last change did not reach Vextrus. Do it again."; nothing
re-sends the act.

ruling: web.save_state.lost_after_reconnect = Not saved: your last change did not reach Vextrus. Do it again.
ruling: web.save_state.lost_act_resent = never

Session 25, the owner (13 Oct 2026, 08:20Z), on G1's items: every real defect in an M0 finish-line item fails that
item, whether or not a critic marks it misleading.

ruling: g1.item_fails_on = any real defect in the item

Session 25, the owner (13 Oct 2026, 09:36Z), on member-mark ranges: two ranges that share exactly one boundary mark (one
member's section continued on the next sheet) continue one another.

ruling: recognise.member_range.touching_one_mark = one continuation

Session 25, the owner (13 Oct 2026, 07:46Z-07:52Z), on the factory: at the round cap, a fix-only delta review (only the
fix's own diff and the earlier rounds' attack tests), not a cut; the design gate is "not applicable" when every web/**
path a PR changes is a test; verify re-runs a web test file that failed only by timing out, alone; the factory mod may
submit one batched, rate-capped wake prompt into the orchestrator's session.

ruling: review.round_cap = delta-review
ruling: design_gate.test_only_web = not-applicable
ruling: verify.web_timeout = rerun-alone
ruling: factory_mod.wake = prompt-submit

Session 25, the owner (13 Oct 2026, 09:58Z), on landing M0's last engine tickets: each passes review on its own PR, then
they land together as one integration PR with one no-post run judged per ticket and one posting run; and no G1 walk
starts until every G1-path ticket has merged.

ruling: m0.last_engine_tickets.land = one-integration-run
ruling: g1.walk_starts_after = every-g1-path-ticket-merged
