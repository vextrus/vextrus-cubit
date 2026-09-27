# The revised M0 plan (session 02), attacked: the UX critic

28 Sep 2026. A plan review, no product walked (the 5330 capture timed out; no finding rests on the
session-02 prototypes). Written by the orchestrator from the agent's report.

**U1 · blocks demo · The key map's own rules break layout A's main key; the plan's key test contradicts
the map.** m0-screens §2.1 (257–263): the highest active scope takes a key, region outranks screen; §2.2
(285) binds Space at region:list to add to the selection (03's list) and at screen scope to List ⇄ Sheet
(22), so in Step 1 Space selects and never opens the sheet. §6.19.6 moved multi-select to Shift-click, but
§2.2's rows remain. The exclusion picker binds 1–9 (301) with six reasons (§6.15, 1193), so 7–9 fall
through to "pick an answer" (302). 01b's test "fails when two active scopes bind one key" (plan 409–410)
contradicts the spec's stacked scopes. Fix: 22 registers Space at region scope for list and canvas, the
list's Space-to-select opt-in and off there; the picker claims every digit, ignoring 7–9; 01b's test reads
"two bindings for one key in one scope"; a 22 test: list focus, Space opens the sheet, Space returns.

**U2 · blocks demo · Step 1 and the viewer are built and gated on a seed with no sheets until wave 7.** 22
(wave 5) and 16 (wave 4) are built on the seed, but the seed's files pass through the real read job only
from 21c (wave 7); 14's `seed/drawings.py` and 19a's `seed/takeoff.py` are unspecified. Fix: 14 and 19a
seed KR-01 as rows at §7's state (sheets, views, Proposals, the five Questions, Coverage, render buffers
from 11's synthetic generators); 21c replaces them with the real job and asserts the same counts; 22's
ticket lists the gate states reachable in wave 5.

**U3 · blocks demo · S0 appended a precedence note instead of correcting m0-screens' text.** The body
still gives 03 the key map in `web/src/app/keys` (253) and "20" in the Registered-by column (273–302), 03
`web/src/ui/` (335), `engine/render/text.py` (135) with tests in "16, 20 and 22" (156), seed ownership as
open question 5 (1267), `tests/fixtures/make_dwg.py` (1264; the plan: `engine/fixtures/dwg/<name>.py`),
the AccessChip "for a Vextrus Engineer" only (384), and "Engine | Plot | Compare" (677, 708) though the
owner ruled "As read". Fix: edit each in place; delete the appendix; a doc lint failing on a bare "ticket
20 ", `render/text.py`, `app/keys`, `make_dwg.py`.

**U4 · blocks demo · The Guest has no screens, wording or seed.** The plan requires the Guest's read-only
state (699–702, 776, 874; gap admitted 1128); m0-screens mentions it only in the appendix; §1.4 lists no
Guest; the invite dialog offers "QS | MD | Vextrus Engineer" (513–514); ReadOnlyChip "Read only: MD" (352);
the read-only toast (168) and Step 1 bar (1148) are MD-only; the seed's outsider is a QS (1277); the spec
lists three roles (363); the scoped AccessChip "Access to Shapla Homes Ltd until 26 Oct 2026" (353)
overstates. Fix: the Guest's wording (chip "Read only: Guest"; toast "As a Guest you can look at the
Takeoff but not change it."; the Step 1 bar); invite roles per inviter; a seeded Guest (a contractor's QS,
KR-01 only, with an end date) and a Guest walk in §4.4's gate; a scoped AccessChip naming the project(s):
"Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026".

**U5 · blocks demo · The sheet's rulings are contradicted by system.md and missing from 16's
acceptance.** system.md's 2D section (129–133) puts overlays on a white casing on Paper and draws every
lineweight as a non-scaling stroke, against screens.md rulings 2 and 3 (75–76) and m0-screens §4.6
(684–692); 01b copies `--overlay-casing`; 16's acceptance (plan 707–718) names neither ruling; 18's F1
(728–733) scores the engine's raster, not what WebGL draws. Fix: correct system.md; rulings 1–5 in 16's
acceptance as tests; a pixel test (`tiny-sheet.bin` plus a lineweight ramp in headless Chromium against
the engine raster); commit the prototype's rendering technique (lineweight to alpha and width, text and
outline drawing: our code, not drawing content), or make 16 `local`.

**U6 · friction · Stale wireframes include those the spec treats as authoritative.** The caveat (50–52,
1391) names only step1-shell, drawing-set and members; `step1-list-1280/1440.svg` and
`step1-question-1280.svg` show "Leave out, MEP" and a bulk bar "…or index, MEP"; `sheet-viewer-*.svg`
shows "Engine". Fix: regenerate the ten affected SVGs before 20a, 20b and 22; a check failing on "MEP" as
an exclusion reason or "Engine" in `m0-wireframes/`.

**U7 · friction · The sheet-mode toolbar cannot stay on one line at 1280.** The prototype already fills
912 px with icons for CAD-dark and Fit; the spec adds labelled Paper | CAD-dark, Fit, Zoom to view,
Outlines (§4.6, 675–678) to the 250 px sheet label, "Confirmed 1 / 68, 1 excluded", List | Sheet and As
read | Plot | Compare (977–980); §4.1 forbids switches giving way (397–399). Fix: D, F, Z, O icon-only with
tooltips and Kbd, Z and O to overflow at 1280; a per-item width budget at 1280 in §4.1, tested by 22 with
the longest seeded title.

**U8 · friction · Texts and figures with two or three sources.** Bar width 720 px (6.19.3) vs six reasons
in one row needing 800–820 px (§6.9, §6.18.5); "Confirmed 1 / 68, 1 excluded" (977) vs "accounted for";
the Coverage string (761 vs 1128); the held file's options (6.19.1 vs §5's `file_misread` template at 812
vs §6.7); the seed's "52 assigned" (1300) vs the contract's "proposed" (plan 290–297). Fix: one resolved
table of Step 1 strings and counts; the bar widens to 820 px; the seed's Coverage restated as proposed /
assigned.

**U9 · friction · The market rules cannot fail on any M0 screen.** English and LTR only make "never
mirrored", "isolated LTR" and logical CSS pass trivially; the test Market is LTR; §8 item 10 is invisible
in English; the lint misses inline `style` margins, `translateX`, `scrollLeft`; the Building's default
name is unfixed. Fix: a test-only pseudo-RTL language (never shipped) with assertions in 03's browser tests
and 22's e2e (chrome mirrors, `LtrCanvas` untransformed, sheet screenshot identical both ways, 14′-6″ in
order); a `data-notation` attribute on formatter and `DrawingText` output checked by a DOM test; the lint
extended to inline styles and transforms; the Building's default name fixed.

**U10 · friction · The design gate is still not a merge condition.** The ruleset requires ci, web, engine,
real-drawings (plan 432, 543); the gate is a local read-only step with private screenshots and no PR
record; 03's cloud gate depends on Chromium in the cloud (unverified, 94–95); 01b builds every shared piece
with no gate. Fix: a `design-gate` status posted through the owner's App after ux-critic's pass, carrying
the §8 items passed and failed, required for `web/**`; a specimen route for 01b on invented data, gated;
mark which §8 items are automated and which judged by eye.

**Verdict.** The new rules land in the right tickets, and ticket 22 carries the prototypes' rulings better
than before; but the sheet's rendering rulings (U5), layout A's keystroke (U1), Step 1's seed timing (U2)
and the behaviour spec's stale body, missing Guest and pictures (U3, U4, U6) must be fixed in place before
re-signing. None needs re-planning.
