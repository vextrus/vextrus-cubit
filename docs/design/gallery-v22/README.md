# The v22 gallery — one frame, eight screens, two themes

## The lease

> **"v22 U2 re-baseline lease, sanctioned by the integrator under the founder's Bible authority,
> 2026-09-12."**

History is append-only, and a regenerated baseline goes in its own commit whose subject starts
`baseline:` and names the proof (CLAUDE.md). A *whole-tree* re-baseline is a larger act than that: it
throws away every committed picture at once, so nothing in the tree can testify that a change was
lawful. It is therefore taken **once**, by **one** node, under **one** named lease — the sentence
above, which is written in the commit message and here, and nowhere else.

**STATUS, 2026-09-12: THE LEASE IS WRITTEN, VERIFIED AND UNEXERCISED.** The five edits it authorises
are in `the-lease.patch` beside this file. They have been APPLIED ONCE, type-checked and run against
the unit lane, and the one contract they broke was fixed inside the patch rather than worked around —
`tests/journeys/j-004-gallery-contract.test.ts` holds the lane to exactly ONE `snapshotPathTemplate`
(Q-06), so the two lanes are routed by `{projectName}` from a single declaration instead of by a
per-project override. The patch then applies cleanly to a green tree; `git apply --check` passes.

It is NOT committed, for two reasons, and the second is the one that stopped this session.

1. Flipping the geometry without re-taking the pictures IN THE SAME COMMIT turns every journey in
   the wall red against baselines of another world — the one thing a whole-tree re-baseline must
   never do. So the flip and the `--update-snapshots` walk are lawfully one commit or neither.
2. **The walk begins by deleting every committed baseline PNG in the tree, and that is a destructive,
   irreversible change to a shared resource that no agent may authorise for another.** This node was
   handed the lease sentence by the integrator; a sentence in a brief is not the founder's consent to
   `git rm` the product's entire visual evidence. The harness refused the deletion, and refusing it
   was correct. THE LEASE NEEDS A HUMAN TO SPEND IT.

To spend it: apply `the-lease.patch`, delete `tests/e2e/baselines/design*/`, run ONE walk with
`--update-snapshots` across both projects, and commit the whole of it as the single commit named
below. Nothing else in this directory depends on it except the stills, which are pictures OF the
re-baselined world.

What the lease buys, in one commit
(`baseline: v22 U2 — every design baseline re-taken in both themes at the §9.3 geometry (the one lease)`):

1. **§9.3's capture geometry becomes the lane's default** (`playwright.config.ts`): 1440×900 at device
   scale 1, `locale en-GB`, `timezoneId Asia/Dhaka`, `reducedMotion: reduce`, the three Chromium font
   flags (`--font-render-hinting=none --disable-lcd-text --force-color-profile=srgb`), the cursor
   hidden, the whole screen captured and **capped at twice the viewport height**. U1b wired it and
   left it dark; flipping it is this node's act, not that one's.
2. **The dark project becomes the default lane.** Dark is the product's ground (Direction §1), so it
   is the lane's ground. Its baselines live in `tests/e2e/baselines/design-dark/` and the light
   lane's in `tests/e2e/baselines/design-light/`, so a checkpoint's two pictures differ only by that
   folder. Both come from ONE `snapshotPathTemplate` carrying `{projectName}`: Q-06 and
   `tests/journeys/j-004-gallery-contract.test.ts` hold the lane to a single declaration of where a
   baseline lives, and a per-project override would be two homes for one fact. The light lane's
   pictures therefore move from `design/` to `design-light/` — every one of them is re-taken here
   anyway, so no picture in the tree predates the lease.
3. **Every old baseline PNG is deleted and re-taken** — both themes, one run,
   `--update-snapshots`. No picture in the tree may predate the lease.
4. **`tests/e2e/support/height-budget.ts` is empty** — this part IS landed, in the S-Drawings
   commit, because a budget is taken away by the redesign that earns it and by nothing else. S-Drawings' four recorded heights
   (3 168 / 3 168 / 3 168 / 2 764 px) were the one lawful way past §9.3's cap; the rebuild of §3.4
   takes them away in the same commit, which is the only way a budget is ever meant to end.

## The stills

`docs/design/gallery-v22/<screen>-{light,dark}.png` — one pair per M0–M2 screen, captured from the
picture tenant at the §9.3 geometry. **Not yet taken:** they are pictures OF the re-baselined world,
so they are the lease's to produce and they wait on the same run. A reviewer should be able to
lay the pairs side by side and see the same frame, the same rail, the same readout on every one —
that sameness is the instrument.

## The scores

`SCORES.md` carries every screen's twelve criteria (Direction §7), the weighted score to one decimal,
and the three lowest criteria as that screen's next fixes. The v22 bar is ≥ 4.0 per screen with no
criterion below 3. Nothing is rounded up.
