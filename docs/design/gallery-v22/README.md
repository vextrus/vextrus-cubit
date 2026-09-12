# The v22 gallery — one frame, eight screens, two themes

## The lease

> **"v22 U2 re-baseline lease, sanctioned by the integrator under the founder's Bible authority,
> 2026-09-12."**

History is append-only, and a regenerated baseline goes in its own commit whose subject starts
`baseline:` and names the proof (CLAUDE.md). A *whole-tree* re-baseline is a larger act than that: it
throws away every committed picture at once, so nothing in the tree can testify that a change was
lawful. It is therefore taken **once**, by **one** node, under **one** named lease — the sentence
above, which is written in the commit message and here, and nowhere else.

**STATUS, 2026-09-12: THE LEASE IS WRITTEN AND UNEXERCISED.** The four edits it authorises are
prepared, reviewed and staged as `the-lease.patch` beside this file; they are deliberately NOT
committed, because flipping the geometry without re-taking the pictures in the same commit turns
every journey in the wall red against baselines of another world — which is the one thing a
whole-tree re-baseline must never do. The run that takes them needs the two heavy slots for the
length of eleven journeys in two themes, and on 2026-09-12 both were held by other nodes for the
whole of this session. The lease does not expire and it has not been spent: the next node applies
`the-lease.patch`, runs the one `--update-snapshots` walk, and commits the result as the single
commit named below.

What the lease buys, in one commit
(`baseline: v22 U2 — every design baseline re-taken in both themes at the §9.3 geometry (the one lease)`):

1. **§9.3's capture geometry becomes the lane's default** (`playwright.config.ts`): 1440×900 at device
   scale 1, `locale en-GB`, `timezoneId Asia/Dhaka`, `reducedMotion: reduce`, the three Chromium font
   flags (`--font-render-hinting=none --disable-lcd-text --force-color-profile=srgb`), the cursor
   hidden, the whole screen captured and **capped at twice the viewport height**. U1b wired it and
   left it dark; flipping it is this node's act, not that one's.
2. **The dark project becomes the default lane.** Dark is the product's ground (Direction §1), so it
   is the lane's ground. Its baselines live in `tests/e2e/baselines/design-dark/`, the light lane's
   stay in `tests/e2e/baselines/design/`, and a checkpoint's two pictures differ only by that folder.
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
