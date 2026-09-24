# Session 9 — Takeoff, demo-ready: land what is held, finish M3, walk M4, judge it in the browser

You are the orchestrator of Vextrus Cubit's ninth Claude Code session: Opus 5.5 at `high` effort in the
owner's Claude Code. CLAUDE.md is the law (read its "Spend like the owner pays" first);
`docs/handoff/session-8.md` is the ground truth this session starts from; the Bible is the destination,
read as the default and departed from by Deviation.

## 1. The one goal (unchanged)

**The Takeoff module, finished and demo-ready.** A quantity surveyor sits down with a Bangladeshi drawing
set and, without help, loads it, organises it, gets it to scale, lets the product take off the structure,
measures what the machine could not, reads rooms and finishes, asks the drawings questions, checks every
number against the drawing in one click, and emits a draft BOQ and BBS they would put their name to. The
owner will demo exactly that. Everything else — Book, Estimate, Assure, Bid — waits.

The bar is not "the lanes are green". It is the owner's: *the best software its users have ever touched*,
doing the job the way a QS in Dhaka does it, with every number traceable and every refusal honest. Where
the Bible's text and that bar disagree, the bar wins and a Deviation says why.

## 2. The finish line (the same six conditions as session 8; state each REACHED or NOT with evidence)

1. M3 walks whole: `m3-bar-schedule` released; J-000 green through every M3 segment; the read-back within
   band on every golden cell (the owner ruled R0 = regenerate and draw all, so all of them).
2. M4 walks whole: the four `m4-*` legs and J-040…J-043 green with no `test.fixme`; PB-5; F-ARCH finishes
   within band; a QS measures a sheet with no auto-detection.
3. The product judged in the browser (`product-review`, both themes, 1440x900 and 1280x800): zero
   BLOCKS_DEMO standing — walk-0's 22 (session 8) re-walked first, since none of their fixes has been
   seen in the running product.
4. The gate green on the committed tree, verify ≤ 60 s, every ceiling held.
5. A demo the owner can give: `pnpm demo` walks the whole flow; `docs/demo.md` a founder's script; the AI
   spend it shows is true.
6. An honest close (`session-close`).

A session that closes some of these fully beats one that touches all of them. Order below.

## 3. Starting state (verify it; don't trust it)

- HEAD and the closing gate: `docs/handoff/session-8.md` §5; `node_modules/.cache/cubit/gate/summary.txt`.
- **Held branches** (session-8.md §6): FND-OWN, S2, ARCH-2, RES-1 (worktrees `wf_dc4bf718-221-{1,10,12,5}`),
  R0-G1 + R0-G2 (worktree `wf_9c4650fd-ab3-1`, commits after `560e95dc`). Their specs, designs and
  results: `.private/work/session-8/{slices,r0,w2}/`.
- The owner's rulings in force: R0 = regenerate and draw all (masonry drawn in F-ARCH, one wall layout);
  ties A′ under D-003; the bill one item per description with a details-of-measurement appendix, the BBS
  one mark per floor with its member count; Ask on Jev alone, live in the demo (no Claude composer);
  Edison = conventions only. GC-3 (C7's hoops) is formula (iii) by AM-03(d) — not an owner question.
- Next free law ids: I-538, D-007 (D-003 reserved for the ties), migration 0065.

## 4. The programme, in order

0. **Verify's budget, before any wave lands.** Session 8 closed at 59.51 s against 60 (unit ~56 s, lint
   ~49 s are the walls; the ranking and the five longest files are in session-8.md §5). Take back
   enough headroom for the waves below — a lane over its ceiling is a red, not a warning. And name the
   slice that moved the pile_cap register from 89 objects to 26 (§5's read-back) before 26 is ground
   truth.
1. **Wave 3a — the edition and the held work (one writer: seed/index.ts, the edition migration).**
   OPEN-3 (slice spec `.private/work/session-8/slices/OPEN-3.json`): mint the edition citing S2's,
   ARCH-2's and FND-OWN's pairs with the in-force selector; then merge S2, ARCH-2, FND-OWN on top
   (`scripts/harness/integrate-slice.py`). FND-OWN's cap concrete publishes PARTIAL (`PILE_HEAD_UNSTATED`)
   until the head-height and recess readers land — write those next (S-05's cut-off against the FDN neck;
   S-07's PC5 recess view from R0-G2).
2. **R0 to the baseline.** Merge R0-G1 and R0-G2 from their branch, then R0-G3 (masonry one home in
   F-ARCH), R0-REC (the model recordings over the regenerated corpus, live Jev, < $0.05) and R0-BASE (one
   `baseline:` commit) in the same integration window as FND-OWN and its readers. One J-000 read-back
   after: cap concrete ≈ 122.47 m³ against 122.500, formwork ≈ 262.69 m² against 262.773; columns and piles
   unchanged; beams ≈ 356 objects.
3. **The ties and `m3-bar-schedule`** (A′): R6b (synthesis@2 under D-003, the stated lap, dispatch by
   edition), OPEN-4, R6-LEG; N1 (class-scoped notes: the pile f'c no longer suspends the column lap —
   walk-0's BLOCKS_DEMO).
4. **M4 to the legs:** S3 → S5 → S6 (the manual leg walks), ASK-1b + ASK-2 + ASK-3 (the ask leg walks),
   M4P-2…M4P-7 (the PDF/raster leg), ARCH-4 → ARCH-5 → ARCH-6 → ARCH-78 (rooms and finishes). The slice
   specs are in `.private/work/session-8/slices/` (the programme's waves 3b–7b), each stamped with the
   owner's rulings.
5. **The browser, continuously:** re-walk walk-0's 22 blockers first; walk every screen a wave changes
   the day it lands; `ux-critic` / `qs-critic` per area, `refuter` before a fix.
6. **The demo script** (`docs/demo.md`) and the close.

## 5. How to work this session

- **Effort and tokens** (CLAUDE.md "Spend like the owner pays"): the main loop at `high`; workflow
  agents with explicit effort — `medium` by default, `low` for mechanical work, `high` for law/geometry
  judgment. The owner opts in to fan-out HERE, scoped: **use the saved `wave` and `chain` workflow
  templates for implementation waves of ≤ 10–12 slices, and a single read-only mapper or critic where a
  question is genuinely wide; no per-map critics; a `refuter` review only for slices that touch law,
  figures, migrations or security.** Everything else in one context. Pass file paths and short specs;
  read results through compact extractions.
- **Merging:** `scripts/harness/integrate-slice.py` per slice; verify, then the gate; look at every moved
  picture (every picture is `expect.soft` now: one run shows them all); the read-back after any rail,
  gate, level or partition change.
- **Turn endings, evidence, durability:** as session 8's brief said — status notes in the same message as
  the next tool call; every claim cites a tool result; commit small; keep the ledger
  (`docs/handoff/session-9-ledger.md`) as you go.
- The owner's decisions: one AskUserQuestion round early if any are genuinely theirs; none is expected.

## 6. Reporting

Short progress notes as you work. At the close: each finish-line condition REACHED or NOT with its
evidence, every commit in one line, the gate verbatim, the read-back, what is not done and why, the
owner's open items, and the true AI spend (the product's model ledger plus
`node_modules/.cache/cubit/harness/jev-calls.jsonl`) — and this session's own token spend by workflow.
