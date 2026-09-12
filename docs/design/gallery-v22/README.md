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

---

## SESSION 2, 2026-09-12 — the lease is still unspent, and the suspect was the wrong one

`cubit-u2b` ran the lane on `v22/u2-lease-unspent` (c1c46d1) and read the failures. The record:

### The frozen clock is REFUTED as the cause

`freezeClock()` is installed by `pictureTest`, and `tests/e2e/gallery-v22.spec.ts` is **the only file
in the tree that imports it** (`grep -rl pictureTest tests/e2e`). No acting journey — J-004, J-010,
J-021, the golden path — ever meets the pinned clock. The sign-up and mail-link legs run on real
time under the lease exactly as they did without it. The clock is not why they are red.

The "one switch, three readers, two spellings" reading is also already settled ON THIS COMMIT:
`global-setup.ts:14` and `picture-tenant.ts` both go through `pictureLane()`. One reader, one
spelling. Nothing to unify.

### What IS red, and why — 34 reds over 96 tests (48 per lane), symmetric in both lanes

A full walk with `CUBIT_HEIGHT_BUDGET_SEED=1` (which suppresses only the height assertion, never the
capture — `Math.min(content, cap)` is applied either way, so every PNG is the PNG the walk would
write) and `--update-snapshots` ran 94/96 in 995 s before it was killed at the 900 s test timeout two
golden-path legs sat on. Every red falls into four causes and **none of them is the lease's geometry**:

1. **U2's screens moved and the journeys were never repointed** (the largest group, and the one that
   matches the handoff's "J-004/J-010/J-021 and the upload leg"). The viewer's inspector is now
   absent at width 0 until something is selected (SCORES.md's own Viewer C1 = 5 rests on exactly
   that), so `getByTestId('viewer-inspector')` and `viewer-inspector-tab` are gone from the DOM at
   the moment four journeys assert them: `j-011-viewer`, `j-020-scale`, `j-020-snapping`,
   `j-000/m1-upload-and-open`. The same shape elsewhere: `register-object-key` (`register.spec.ts`),
   `shell-empty-action` (`shell.spec.ts`, J-004), the S-Home card filter (`j-000/m0-workspace-and-
   project`), the offered group (`j-000/m1-confirm-disciplines`), the register workspace
   (`j-021-column-slice`, `j-022-coverage`). **U2 rebuilt eight screens and ran no browser** —
   SCORES.md says so in as many words — so this was waiting on the first run, lease or no lease.
2. **Four real axe SERIOUS findings (C9), in both themes.** Verbatim, from the checkpoints' own
   attachments: `target-size` at `li[data-crumb="…"]` (5 checkpoints) and at `div[data-cursor="…"]`
   (4); `color-contrast` at `.cx-auth-foot > span:nth-child(1)` and at `.cx-accept-foot-where`.
   These are C9 defects of the foundation's breadcrumb and of the auth/accept feet — they are the
   reason SCORES.md may not write C9 = 4 anywhere until they are fixed, and they are unearned in
   both directions until then.
3. **Two specs still name the OLD baseline directory as a literal** — this one IS the lease's, and
   it is the only red the lease itself caused: `tests/e2e/journeys/j-003-projects.spec.ts:171` and
   `tests/e2e/participants.e2e.ts:28` read `tests/e2e/baselines/design/<name>.png` off the
   filesystem to prove a picture was regenerated (B-20). The lease moved that directory to
   `design-light/` and `design-dark/`, so both now read a path that does not exist (`ENOENT …
   design/shell-light.png`). **Six more sites in the unit lane do the same** and will redden
   `pnpm verify` the moment the lease is committed: `tests/ui/shell/journey-lane.test.ts:27`,
   `tests/ui/s-audit/journey-lane.test.ts:27`, `tests/ui/command-palette/baselines.test.ts:67,72,79`,
   `tests/ui/density-prefs/ruleset-baseline-pin.test.ts:2`, `tests/invitations/journeys.test.ts:15`.
   A B-20 proof that names a directory is a second home for where a baseline lives (Q-06); the lane
   has one — `snapshotPathTemplate` — and these eight must be made to read it rather than restate it.
4. **§9.3's height cap, which U2's S-Drawings rebuild did NOT earn.** `j-010-timeline-done` measures
   **2 989 px** of `[data-testid="shell-main"]` against a cap of 1 800 (2 × the lease's 900 px
   viewport). The rebuild took 3 168 → 2 989 px, and commit 5f2ad06 emptied
   `tests/e2e/support/height-budget.ts` on the strength of it. Note the direction: the lease's taller
   viewport makes the cap MORE generous (1 800 against the 1 440 a 720 px default viewport gives),
   so this red is not the lease's either — it is older than it and was hidden by the entries U2
   deleted. Either S-Drawings loses another 1 189 px, or the budget entries come back at their
   measured heights with the debt named.

### What this leaves

The lease's five edits stand and are still the right ones; what stands between them and a green
two-lane wall is (1), (2) and (4) above — U2's own screens — plus the eight literal directory names
in (3). **The lease remains UNSPENT.** Nothing in `tests/e2e/baselines/` was re-taken or committed by
this session; the stray PNGs the diagnostic walk wrote were removed (`git clean -fd`) so that no
picture in the tree predates the lease when it is finally spent.
