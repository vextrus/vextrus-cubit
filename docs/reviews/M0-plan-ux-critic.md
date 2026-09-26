# M0 plan review: the UX critic

26 Sep 2026. The `ux-critic` agent compared docs/plans/M0.md with the accepted prototypes (walked at
1280×800; screenshots private). Verdict: the engine side is specified well; the screens are lists of
nouns, and most of what the owner judged lives only in private prototype code cloud tickets cannot see.

## Blocks the demo
1. **Cloud tickets 03, 16, 20, 22 cannot see the prototypes** (`.private/`). Missing from committed docs:
   the review queue order and "a Proposal counts toward nothing until you confirm it"; the Question
   card's "Answer once", source-named options, number hints, "Keep open, ask the consultant", Q for
   the next Question; the Keys overlay (?); the sheet picker (S, [ ]); the Fonts panel; Engine | Plot |
   Compare. Fix: a committed screen-by-screen behaviour spec with wireframes on invented data.
2. **Step 1 was never prototyped.** Only Step 6 was designed; with a 420 px sheet drawer, the 320 px
   inspector and the 48 px rail, the sheet gets ~490 px at 1280, far below "canvas ≥ 70 %". Fix: a
   short Step 1 prototype on invented sheets, judged by the owner before 22.
3. **Ticket 16 cannot fit "the working view"** (no views until 17/21; cloud sees synthetic sheets
   only), so "a sheet never opens looking empty" cannot be built or checked there. Fix: 16 fits a
   passed-in view box, falling back to the paper; a local follow-up after 17 and 21 proves first-open
   on every Development Set sheet.
4. **The design gate runs after the code, on empty data, and does not know the prototypes'
   rulings** (`ux-critic` never reads screens.md). Fix: a committed seed of an invented project for
   every UI PR; point ux-critic at screens.md and the behaviour spec; review 22's wireframe before it
   is cut; a local gate on 22 with a real set.

## Friction
5. One key map, owned by 03, registered into by 16 and 22 (arrows vs [ ] vs ← → collide).
6. 03 owns `web/src/ui/` (glyphs, Kbd, Empty, Skeleton, ErrorBar, the phone notice).
7. One decode function in 11 for `%%U`, `%%O`, `%%D`, `%%P`, `%%C`, `^J` and MTEXT codes, used by 13
   and 21; a test that no title shows `%%` or `\`.
8. Performance readouts behind a `?perf` flag, never on by default (the post-mortem's "test
   artefacts in the demo").
9. Upload and font reports worded for a QS, not engineers.
10. Every state owned by a ticket: no Plot and why; Compare; the quarantine Question and the
    Bangla-ANSI flag; Step 1 while files still read; the first-open loading state.
11. Step 1's Question rules: which sources count for the pre-pick; the queue's order without money;
    exclusion reasons as a pick list.
12. The MD's read-only state and "who confirmed what" in 22's acceptance.
13. 03 shows only Takeoff and Drawing Set in the top bar; the Drawing Set page lists files and
    reports, sheets live only in Step 1.

## Polish
14. At 1280×800 the Coverage popover covered the Confirm button; one toolbar line at 1280 as an
    acceptance item.
15. The Question card says "Answering confirms…" first, as ruled (the prototype put it below).
