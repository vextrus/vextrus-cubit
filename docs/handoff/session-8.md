# Session 8 handoff — Opus 5.5 orchestrating; Takeoff demo-ready (in progress)

Branch `dev-lane-and-jev`, from `14f88709` (session 7's extension, pushed). The ledger is
`docs/handoff/session-8-ledger.md` (every run, its verdict, the owner's rulings, the slips); the
workflow scripts are `docs/handoff/workflows/session-8/`; the reusable ones are now saved templates
(`.claude/workflows/wave.js`, `chain.js`). Two power cuts on the owner's side and two usage-limit pauses
shaped the session; nothing committed was lost.

## 0. The finish line, condition by condition

1. **M3 walks whole — NOT REACHED.** `m3-bar-schedule` is still `test.fixme`. What moved toward it:
   - the owner's rulings: R0 = regenerate AND draw all; the ties = A′ (derive under D-003, publish at
     the never-over bound where placed framing bounds the joint, declare the rest by name);
   - FRM-3 in two halves: EntityGraph v3 (rotation, alignment, INSERT identity, layer state; FRM3-A) and
     the vertical beams placed off turned marks (FRM3-B: beams 172 → about 356 objects, all PARTIAL);
     R6-U (tie spacings in the declared unit) and R6b-1 (the joint seam as a lower bound) merged;
   - R0's regeneration designed (append pass, 0 Rev B handles lost, the corrections K1…K23, GC-1..4, the
     Rev C drawings) and built in a chain: **R0-G0 merged** (the append pass, byte-identical corpus,
     manifest re-minted); **R0-G1 and R0-G2 held on their branch** (§6) — they only land green together
     with R0-BASE, which moves the golden's cap cells (122.500 m³, 262.773 m²) that the product meets only
     once FND-OWN, OPEN-3's edition and the head-height / recess readers land (wave 3a).
   - The R0-0 refuter confirmed a **standing over-measurement in the demo's own COMPLETE cap concrete**
     (pile heads +1.321 m³, the PC5 lift-pit recess +3.352 m³) and blinding (+0.703 m³). FND-OWN fixes it
     (the cap lines go PARTIAL naming `PILE_HEAD_UNSTATED` instead of over-publishing; blinding COMPLETE
     net of piles) — held for wave 3a with its edition (§6).
2. **M4 walks whole — NOT REACHED.** The four `m4-*` legs are still `MISSING DOOR`s, now with their
   foundations built: S-Measure's Decision (I-370…I-394, D-005), the manual act + markless key + store
   (S1, migration 0062) and Linear/Area/Count armed with snaps and the gesture grammar (S4); S-Ask's
   Decision (I-395…I-407; Jev alone, the owner's ruling) and its engine and door (ASK-1a); vector PDF
   ingested with `PDF_OBJECT` keys and pypdfium2 shipped (M4P-1, migration 0064); F-ARCH — the
   architect's set of the same building with a 766-row two-path golden (ARCH-1) — and its door/window,
   wall-type and room-finish schedules read (ARCH-3, migration 0063). Held: S2 (manual methods) and
   ARCH-2 (the finish vocabulary), which need OPEN-3's edition.
3. **The product judged in the browser — NOT REACHED.** Walk-0 (five ux-critic walks and a qs-critic)
   ranked **22 BLOCKS_DEMO · 56 FRICTION · 21 POLISH** and said plainly that a QS could not run the demo
   flow unaided. Most blockers now have their fixes merged (the Trace lands on the member both ways;
   scale on a fresh DWG upload; the filters; the dialog in words; the draft's zeros and repudiated
   objects; the levels FDN row; coverage states the whole building; the bill in its ruled shape; the BBS
   counted per floor and laid out as a document; legible sheets with `%%C` resolved). **None of it has
   been re-walked in the browser** — the lanes and the looked-at pictures are the only evidence.
4. **The gate green on the committed tree — REACHED** at `be543bfb` (§5): every lane green, verify's own
   wall-time 59.51 s against 60 — at the edge; session 9's first care (§5).
5. **A demo the owner can give — NOT REACHED.** `docs/demo.md` is session 7's; the M4 steps cannot be
   shown; the flow was not re-walked.
6. **An honest close — this document**, the ledger, `session-9-prompt.md`, the harness changes (§4).

## 1. What was built (merged, by wave)

**Toolchain / harness first:** `3952e672` the cad regeneration proof content-addressed; `ed29abf0` the
drawing tools read a drawing the product refuses; `d7abe245` the craft probe measures the frame's slots;
`21ad25f0` the token discipline and the wave toolkit (§4).

**Wave 1** (20 slices; `wf_c9f20248-789` + the recovery `wf_81525490-bcd` after the power cut), each
integrated as one commit (I-370…I-457, D-005):
S0 `e2c6e4df` · ASK-0 `fd20a143` · H1 `d7abe245` · JEV-1 `e76a3089` · RANGE-LIST `55205658` (a listed
floor set is never read as a range — a silent over-measurement closed) · R6-U `6175439d` · R6b-1
`ac91ae3e` · FRM3-A `b8eeae02` + `1815db21` · SCALE-1 `507e939a` (a DWG's dimensions reach the artifact;
two agreeing observations per axis) · VD-1 `bf608729` (the Trace) · C1 `b4401c7b` · C2 `b885fb95` · C3
`e1ebc279` · C5 `21b10716` · C6a `55f81325` · C7 `56fcea51` · REG-FILT `6ee88c9e` · DLG-1 `a7f5f786` ·
BOQ-1 `7a166b93` + `b447e98a` · ARCH-1 `635d3888` + three baselines.

**Wave 2** (18 slices; `wf_dc4bf718-221`; 15 merged, I-458…I-537, D-006): REAL-1 `fa03085b` (one MTEXT
stripper in core, stacked fractions kept) · FRM3-B `82388034` · VIEW-TXT `ee44502d` (legible sheets;
D-006) · C4′ `3a177711` · SRCH-1 `72636df2` (⌘K finds sheet text and marks — **reverted** at the close, see §6) · HONEST-SCOPE `5a126db2`
(measure never silent; coverage states every declared class) · ASK-1a `9e488229` + `166417e8` · S1
`ffa5859c` (0062) · S4 `e4bc2e06` · ARCH-3 `a24d5198` + `634ec440` (0063) · M4P-1 `f36accef` + two
baselines (0064) · C8 `493b4304` · BOQ-SHAPE `be7fd083` + three baselines · L4 `e3be537c` +
`ca26d902`. Held: FND-OWN, S2, ARCH-2, RES-1, and SRCH-1 after its revert (§6).

**R0:** R0-G0 `5b5cc983`…`22b7c76f` + `baseline: 17140e5b`.

**Integration repairs** (each a real defect the worktrees could not see): `374e5d03` V-DOCS goldens
declared; `227a8cfe` a stand-in extractor still writing EntityGraph v2; `8e9595d3` the register stage's
`v:` key; `cb3936e6` J-003's mask over the dialog's buttons; `db960dcd` the aggregates re-frozen
(26 refusals added, 0 changed, proved against `9ebdf29a`) and `text.ts` reading through core's one
stripper (B-17); `570ce2d5` a client component pulling `pg` into the browser bundle; `b3806a6a` the
DataTable's last-column resize handle under the Columns tool (axe), J-033's zero read, and the COV-ALL
assertion moved from the F-RCC6 leg to the BNBC leg; `b6c03d8a` F-ARCH re-minted for ARCH-3's trap; `b00dfb76` the coverage masks painted over the inspector; `f312a024` J-021's double class chip after the
history step; `fc9fb85e` **the extractor's timeout now kills its whole process group** — node's own
timeout killed `uv run` alone and left python running and holding the pipe, so an ingest neither
stopped nor answered until python finished (the unit lane's 30.5 s file, now 0.5 s); the closing
re-takes `e29c3fb5`, `7e6c4f00`, `be543bfb`.

## 2. The law this session wrote

I-370…I-537 (168 Interpretations, every one defined in the Design Decision its slice amended; the
renumbering table is `.private/work/session-8/law-ids.tsv`), D-005 (S-Measure: blinding by a traced
outline, held on the refuter), D-006 (VIEW-TXT). Next free: **I-538, D-007 (D-003 reserved), migration
0065.** Several of the Interpretations were written by implementers and are still "OWED a refuter
verdict" in their own Decisions (s-measure.md §11 lists them) — the next session's first law pass.

## 3. Evidence

- Gate 0 (start, `14f88709`): every lane green, `GATE wall-time 505.57s exit 0`.
- Gate 1/2 (wave 1): reds found and fixed (ledger); gate 2 `db: green 101.34s`, `e2e-j000: green`.
- Gate 3 (wave 2): verify green 58.85 s; db green 110.22 s; e2e / J-000 / perf red — every cause fixed
  in `b3806a6a` and the perf miss (16.80 against 16.75 ms, under concurrent agent load) green twice alone.
- Gates 4–6: reds were moved pictures found one checkpoint at a time, J-021's double chip, and verify
  at 60.23 s once (ledger). **Gate 7, the closing gate: §5.**
- Read-backs: gate 0 and gate 2 matched session 7's ground truth exactly (column 208 / 93.892896 m³;
  piles 89 / 1,898.904 m / 372.848929 m³; caps 128.781275 m³ / 254.132613 m²; beams 172 objects, all
  PARTIAL; 0 orphans). The closing read-back is §5.

## 4. The harness, improved (the owner asked; `21ad25f0` and user settings)

- **Effort** (the Opus 5.5 docs: `medium` is the default and matches Opus 5 at `high`; lowering effort
  is the surest lever): `~/.claude/settings.json` `modelSettings."claude-opus-5-5".effortLevel` xhigh →
  **high** for the main session; every workflow agent now takes an explicit effort (`medium` default,
  `low` mechanical, `high` only for law/geometry/design).
- **Workflows opt-in:** `ultracode` true → **false**, `workflowSizeGuideline` large → **medium**. This
  session's two waves alone spent ~26 M subagent tokens (wave 1 recovery 9.0 M, wave 2 17.2 M); the
  review-per-slice and a critic per map were the multipliers. The saved `wave` template reviews only
  where a slice sets `review` (law, figures, migrations, security).
- **Prompt caching** (automatic in Claude Code): CLAUDE.md and the agents' system prompts are the shared
  cached prefix — kept stable and lean; effort held constant within a session; subagent cache TTL 1 h.
- **Merging:** `scripts/harness/integrate-slice.py` does in one command what cost this session its
  slips (per-commit renumbering conflicts, letters out of order, a migration amended into a `baseline:`
  commit that AC-3 then refused and a local rebase repaired, a blind digest re-freeze).
- **Worktrees** no longer share `cad/.venv` (user settings `worktree.symlinkDirectories`): a shared venv
  let worktree agents swap the main checkout's extractor under the gate.
- CLAUDE.md's "Spend like the owner pays" and "Workflows and merging"; the lanes skill's new red shapes
  (the poisoned Turbopack cache, dev-DB drift after migrations, perf clearing `test-results/`).
- **Soft pictures** (`aebf7b61`): every `toHaveScreenshot` is `expect.soft`, so one run reports every
  moved picture of a walk — chained checkpoints cost three gates this session. The AC-3 guard and the
  J-000 roster count `expect.soft` as an assertion.
- **The named agents carry their effort** (`4164407c`: `refuter` high, the critics and the analyst
  medium) and CLAUDE.md says how to prompt an agent the Opus 5.5 way (goal and why, finish line,
  constraints, return shape; calm words).

## 5. The closing gate and read-back

Gate 7 on `be543bfb` (`.private/work/session-8/gate7.log`):

`GATE summary — verify: green 61.40s · checkup: green 0.80s · golden: green 20.22s · db: green 120.55s · e2e: green 137.10s · e2e-j000: green 213.93s · perf: green 19.58s`
`GATE wall-time 573.61s exit 0` — verify's own `verify wall-time 59.51s`.

**Verify's budget is session 9's first care.** It read 58.31, 60.23, 61.75 (with the JSON report),
59.52 and 59.51 s across the close. The wall is the unit lane (~56 s; lint ~49 s): 629 files, ~500 s
of file time. The longest files after `fc9fb85e`: `src/ui/semantic-alias.test.ts` 27.9 s,
`tests/lint/import-depth.test.ts` 27.7 s, `tests/takeoff/viewer-measure/measure-screen.test.tsx`
16.3 s, `tests/journeys/retrying-read-steady.test.ts` 15.2 s, `tests/refusal-register/register.test.ts`
13.3 s (`CUBIT_VERIFY_REPORT_JSON=<file> pnpm verify` gives the ranking). Any wave adds tests; take
the budget back before the next one lands.

**Read-back** (gate 7's J-000, project `cf71d9ff-d401-49a8-87d5-736c8b86d0b9`) — equal to the ground
truth: column concrete 208 COMPLETE / 93.89289649 m³ (rebar 208 PARTIAL); piles 89 bored / 1,898.904 m
/ 372.848929 m³ COMPLETE; caps concrete 26 COMPLETE / 128.781275 m³ (still over-measured by the pile
heads and the PC5 recess — FND-OWN, held), formwork 254.132613 m², excavation 26 PARTIAL; blinding 12
COMPLETE / 4.692188 m³ and 14 PARTIAL; beams 356 objects (1 unlevelled), 355 + 355 lines PARTIAL;
orphan_lines 0, placeholder_lines 0. Observed, not yet attributed: **pile_cap register objects 89 → 26**
(session 7's run `37c17af3…` registered 89; this one registers the 26 caps the lines already counted —
lines and totals unchanged). Piles stand unlevelled (89/89) as they did in session 7. Session 9 names
the slice that moved the caps before it treats 26 as ground truth.

## 6. Held, not merged — the next session's first work

| Branch (worktree) | What | Why it waits |
|---|---|---|
| `worktree-wf_dc4bf718-221-1` | FND-OWN (10 commits) | needs OPEN-3's edition citing its 7 new pairs; J-000's cap leg red without it |
| `worktree-wf_dc4bf718-221-10` | S2 manual methods | edition-drift red until OPEN-3 |
| `worktree-wf_dc4bf718-221-12` | ARCH-2 finish vocabulary (migration) | edition-drift red until OPEN-3; migration becomes 0065+ |
| `worktree-wf_dc4bf718-221-5` | RES-1 residue per key | a semantic merge with HONEST-SCOPE: redo on top |
| `worktree-wf_dc4bf718-221-7` | SRCH-1 ⌘K sheet text and marks (merged, then reverted) | its own journey: a mark find fell back to the register instead of opening the viewer on the staged project (the hit's drawing/layout/selection unresolved; suspected: the stage pins before writing the members' placements, so the pinned record's standing lacks them) — unproven end to end |
| `worktree-wf_9c4650fd-ab3-1` (after `560e95dc`) | R0-G1 (corrections) + R0-G2 (Rev C drawings) | land only with R0-G3, R0-REC and R0-BASE together with FND-OWN; its W-28 still calls GC-3 "the owner's" — overruled: formula (iii) is the only form AM-03(d) admits |

The other 35 worktrees under `.claude/worktrees/` are integrated; removing them (≈ several GB) is the
owner's (`git worktree remove`/`rm -r` ask).

## 7. The owner's open items

- History rewrite is not needed; nothing was pushed mid-session. **The push of this branch** is at the
  close (asked).
- The Edison project's name already stood in tracked files from earlier sessions (skills, cad tests,
  old handoffs — the drawing file names); nothing new entered. Scrubbing history is the owner's call.
- The corrupt Turbopack cache set aside at `.private/work/session-8/turbopack-cache-corrupt` (660 MB)
  may be deleted.
- The user-settings changes (§4) — backups in `.private/work/session-8/user-settings.*.json`.
- Walk-0's remaining FRICTION/POLISH list (`.private/work/session-8/walk0/ranked.md`) and the Edison
  real-set gaps (REAL-3…REAL-8 specs written, not built).
