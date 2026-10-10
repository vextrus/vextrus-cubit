# Session 20: land Train A and Train B, settle G1's two expectation questions, take M0 to G1 PASS twice

## Session 19's measures (`scripts/factory/measures.py`, 9 Oct 16:06Z to 10 Oct about 02:15Z; about 80 min lost to a second power cut)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 2 | 6 | |
| merge_p50_min | 352.2 | 40.9 | |
| rounds_per_pr | 3.0 | 2.17 | |
| rdlock_min | 155.1 | 184.4 | |
| verify_p50_min | 29.1 | 4.0 | |
| verify_p90_min | 31.1 | 21.2 | 10 |
| ci_wall_p50_min | 9.3 | 17.3 | 10 |

Missed or wrong:
- **verify p50 29 min, p90 31 min against 10: missed and regressed.** Most verifies were full-train or full-ticket
  runs, and the orchestrator re-ran Train A's verify alone five times on flakes (#636). After the power cut this is
  the session's main loss.
- **merge p50 352 min:** two PRs landed (#628 Q1 after its third round and a power cut; #633 S19-F1 after three
  rounds). Train A did not land.
- **CI wall p50 9.3 min against 10: met** (the first full session on #607's parallel CI).
- `crosspr_max_min` (target 5) is still not in the table: unmeasured.

## What is broken (read first)
- **Nothing has ever passed G1.** Main after S18-Q1 (a38a23ba) fails 11 of 16 checks (Edison 7 of 8, Sample 4 of 8;
  `.private/work/session-19/g1-gap-q1.md`). Sample's act timing passes; the 180 s undo timeouts were the walk's own
  timer (fixed by #625) and are gone.
- **Train A (PR #638, branch `s18-train-a`, head 5cf86429) is open and not landed.** Members: S15-Q2+Q3 (s15-q3
  d4b49ce6), E2 (adaf5e87; #627 closed as superseded), E3 (s13-w318 a706025c), W6 (92dae6c0; #557 closed as
  superseded), E6 (s13-w332 592d7559, three w332 tests amended), A2 (s18-a2 19e46707), on main 64427e96 with Q1 and
  S19-F1; t182 amended to 11 (2327a1e1); a stop-signal test bug fixed (167aaca2); Q3's linear-time path made 3.5x
  faster for CI (5cf86429; CI's runners are about 5.5x slower than this machine). Verify on 5cf86429 alone was green
  but crosspr: its union with #598 failed A2's held-row test for undo (over 5 s); an hour earlier the same test
  failed for confirm. **Two act kinds in two runs: read `.private/work/s18-train-a/held-row-diagnosis.md` first** (a
  suspected interaction of Train A's deadlock retries with A2's lock timeout). Then: verify alone, CI, review round 1
  (none recorded: CI was red), the posting run with a judged reason (the no-post table and per-member reasons are in
  the READY commit body, 263ee6d2), the design gate (the words gate passed with no must; its post-status items are in
  `.private/work/session-19/words-638.md`, to post once `web` is green; its mays are #639), land.
- **Verify is unreliable on its own:** its concurrent checks fail load-sensitive tests even alone on a quiet machine
  (#636): ts15a2's 500 ms answer bound and its held-row 5 s bound (A2's acceptance; the held-row one may be a real
  gap in A2's lock timeout: look first), the acceptance-lint test-database test (compares the whole machine's test
  databases), and a stop-signal test (a real test bug, fixed in Train A at 167aaca2). Until #636 is fixed run each
  verify alone, `VEXTRUS_VERIFY_WORKERS=2`, nothing else on the machine. `.github/flaky.txt` cannot take them:
  acceptance tf1 pins that list to the three #245 flakes.
- **One HTTP 500 in G1's walk on main:** a PostgreSQL deadlock between an answer (FOR UPDATE on the Question) and a
  read's commit (a CheckFinding's deferred foreign key on the same Question). Train A's per-project write lock and
  retry close it; no test pins it yet (B6 below). `.private/work/session-19/answer-500.md`.

## Train B (built on Train A's head; each merges main after Train A lands, then verify, review, rd, land)
| ticket | branch, head | state | moves |
|---|---|---|---|
| B1 the owner's number-run ruling (`_agreeing`) | s19-b1 e6d2dfe7 | BLOCKED only on crosspr with the old #628; built, 35 acceptance green | bulk share Edison E/P/G, Sample structural. t182 must be amended again (seed Electrical E-01..03 now agree: 11 -> 14) |
| B2 boundary storey settled by convention (owner's 19:05Z ruling) + R1 | s19-b2b cadf2823 | BLOCKED only on crosspr | questions_per_discipline (Edison 1, Sample 2 convention Questions) |
| B3 stale layout beside model-space Sheets dropped | s19-b3 4f5f5179 | BLOCKED: ts15e4's golden.json pins the stale Layout1 as sheet 6; needs an `acceptance:` amendment (drop sheet 6 from sheet_set_model's four readings) | sheets_match: Edison 221 -> 218 (rd measured) |
| B4 false conflict Questions (E1 sizes, E2 copied titles, E3 layers, E4 septic_tank, E6 pile caps) | s19-b4b (empty) | acceptance redo after a leak not done: rewrite from `.private/work/session-19/structural-conflicts.md` and the writer's notes in `.private/work/session-19/s19-b4-acc/`, every title invented; not built | questions_per_discipline, false_continuations, true_questions_raised (15/16); **changes `tools/scorer/`: the owner's custody re-run before it lands** |
| B5 unbracketed storey line (R1) + ceiling level meaning (R2) | s19-b5 d7a3490f | BLOCKED on verify only (outside its diff); rd measured: Edison continuations -2 | true_questions_raised and false_continuations (A-06/07, P-06/07). Needs a words-only ux-critic on "at ceiling level" |
| B6 deadlock test | none | not written | a two-thread test on Train A's code: an answer against a read's commit that references the same Question; plus a scan for a bare `select_for_update()` outside `writing`/`lock_writes` |
Never push the local branches s19-b2, s19-b2-clean and s19-b4: their history holds drawing text.

## The owner's questions (ask first, one at a time; recommendation first)
1. **Edison E-16/E-17** (a copied title block over a different drawing, G1 lists it as a true Question): title
   blocks, view titles, storeys and subjects are identical; only the drawn content differs (layers, counts). The only
   rule found rests on one case (`.private/work/session-19/stale-pairs.md`, R3). Recommend: keep it a true Question
   and build a content-twin comparison in M1; for M0 the expectation drops it (true_questions_raised 8 of 8,
   false_continuations without it). Without a ruling Edison cannot pass G1.
2. **Cover and contents sheets in sheets_match**: Edison finds 213 numbered + 5 cover_index sheets = 218 (after B3)
   against 217; the 217 holds 4 of the 5 covers. Recommend: covers count as Sheets; add the missing one to the
   expectation, and record a per-sheet list in walk-expect so the check names the extra sheet itself
   (`.private/work/session-19/arch-bulk-and-extra-sheet.md`).

## Measured, no ticket yet
- Edison architectural bulk share: main 0/87 is the whole-Discipline `_without_gap` gate; Train A's title_alike rule
  lifts it to about 74/86 (0.86), 72/86 with B5; the margin over 0.8 is 2-3 sheets. More margin: a page naming several
  sheets takes the number read in its title-block region (A-09, A-89).
- Storeys (Edison 22 wrong, Sample 16) are unmeasured after Train A's E3/E6; "roof"/"top" read as a symbolic end
  (Sample S-15, Edison 04) has no owner.
- needs_toolchain is red on main (11 failed, 3 errors: ezdxf's pure-Python wheel with numpy 2.5's deprecation).

## Finish line (checked by its command; evidence where it says)
1. Train A and Train B merged; G1's script layer on main re-measured after each.
2. M0's finish line met: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. `docs/handoff/session-21-prompt.md` merged, opening with session 20's measures table.
Budget: ask the owner (recommend **12 hours**).

## Lessons from session 19 (binding; `docs/knowledge/lessons.md`, Session 19)
- Run every verify alone (#636) until verify serialises its timing-sensitive checks.
- An acceptance writer working from a drawing analysis invents every title; it scans its own commits before it
  reports (#637), and a hit is redone on a fresh branch (history keeps the text).
- A train's members that are open PRs are closed as superseded when the train is integrated, or crosspr judges the
  train against its own members.
- Session 18's lessons still bind.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full, as in session 19's brief.
