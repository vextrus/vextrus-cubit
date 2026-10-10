# Session 21: land Train B, fix G1's last five checks, take M0 to G1 PASS twice

## Session 20's measures (`scripts/factory/measures.py`, 10 Oct 09:13Z to about 19:20Z; a power cut about 10:40Z-11:24Z)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 0 | 3 | |
| merge_p50_min | unmeasured (none merged) | 72.0 | |
| rounds_per_pr | unmeasured | 2.7 | |
| rdlock_min | 172.4 | 155.1 | |
| verify_p50_min | 32.0 | 29.1 | |
| verify_p90_min | 37.4 | 31.1 | 10 |
| ci_wall_p50_min | 9.4 | 8.9 | 10 |

Missed or wrong:
- **Nothing merged.** Train A took four review rounds (the last one only by the owner's leave, as a fresh PR) and
  each found new defects in its fixes; its integrator's fix rounds also had to clear three CI-only timing failures.
- **verify p90 37 min against 10: missed and worse.** Every verify here was a full train verify run alone (#636).
- **CI wall p50 9.4 min: met.**

## Where M0 stands (read first)
- **G1's script layer on Train B's head (0cf962ed, a preview, not main) fails 5 of 16** (main a38a23ba failed 11;
  `.private/work/session-20/g1-gap-trainb.md`). Passing on both sets: reads, sheets (Edison 218 of 218, 0 phantoms),
  true Questions (Edison 9 of 9), false continuations (0 and 0); Edison storeys 0 wrong (was 22); Sample Questions and
  bulk share. Failing, each narrow and diagnosed:
  1. **act_p95_during_read, both sets:** one undo per set refused 503 after 3 s. A read job's finishing step holds
     Step 1's write lock through `set_questions` over the whole set (5-15 s). Fix: find the Questions before the
     lock, keep them under it (`.private/work/session-20/diag-undo-503.md`). p95 itself is 620 / 524 ms.
  2. **questions_per_discipline, Edison architectural 4 (cap 3):** fold `storey_titles.differs` into an open same_title
     conflict when the sheet's title storeys equal its partner's plans (fires on A-07 only); and key `kind_group` on
     the sorted top two kinds (A-46 split off only on Jev's order) (`diag-arch-questions.md`).
  3. **bulk_confirmable_share, Edison structural 45/57 (needs 46):** a Plot page naming several sheets takes the one
     candidate whose title the page reads (+3: 02, 03, 04 -> 48/57) (`diag-struct-bulk.md`).
  4. **storeys_match, Sample S-15:** a range to the roof reads a symbolic `top` nothing resolves; resolve `top` to the
     set's highest numbered floor when Step 1 builds its set view (Edison stays 0 wrong) (`diag-s15-top.md`).
- **Train A is not landed: PR #641 (branch `s20-train-a`, head 133bf426; #638 closed as superseded).** Its gates on
  133bf426 are posted (real-drawings, design-gate); its review round 1 is FIX with four findings in #642, the first a
  70: review 3's fix retires a same-storey Question beside a confirmed sheet at another place. **Start here:** one fix
  round for #642 (its builder's worktree `.claude/worktrees/S18-TRAINA-FIX2`, branch `s18-train-a` = 133bf426;
  push the fix to `s20-train-a`), verify alone, round 2 of #641, re-post real drawings and the design gate on the new
  head, land. Fix rounds left on #641: two (round 3 needs an exception).
- **Train B (branch `s20-train-b`, head 7b312dd0, local integrator in `.claude/worktrees/S20-TRAIN-B`):** S19-B1
  (number run), B2 (boundary storey by convention), B3 (stale layout dropped; ts15e4 amended), B4 (false conflicts;
  **changes `tools/scorer/`: the owner's custody re-run after it lands**), B5 (unbracketed storey line, ceiling
  level), B7 (content twins with a stored layer histogram, drawings migration 0006) merged on Train A's final head;
  suites green; rd no-post: Edison sheets -3, continuations 17 -> 13, conflicts 11 (net). Its verify alone was running at close: read its last commit's Factory-State on
  `s20-train-b` (local; origin holds an earlier head). It merges Train A again after #642's fix round.

## Plan
1. Land Train A if not landed (see above), then Train B: merge main, verify ALONE, PR, review, design gate, the
   posting run with judged reasons (members' rows above), land; then ask the owner for the custody re-run (the
   command is in docs/handoff/session-16-prompt.md, lines 11-13).
2. One fix wave (Train C, acceptance tests first) for the four diagnoses above; their notes hold fixture shapes.
3. G1 on main (script layer, then `/real-set-walk`), a second G1, `scripts.walk.ready origin/main` exit 0, then "walk
   now".

## Finish line (checked by its command)
1. Train A and Train B merged; G1's script layer on main re-measured after each.
2. M0's finish line: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. `docs/handoff/session-22-prompt.md` merged, opening with session 21's measures table.
Budget: ask the owner (recommend **12 hours**).

## Binding from session 20 (`docs/knowledge/lessons.md`, Session 20)
- Verify ALONE (load < 3, rdlock free, `VEXTRUS_VERIFY_WORKERS=2`) until #636 lands; read CI's shard timings before
  landing (CI is about 5.5x slower than this machine).
- Acceptance writers scan their own commits before reporting (#637); a hit is redone on a fresh branch. Never push
  `s19-b2`, `s19-b2-clean`, `s19-b4` or `s19-b7` (their history holds drawing text).
- Every sha typed into a gate comes from `git rev-parse`, never memory.
- Session 18's and 19's lessons still bind.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full.
