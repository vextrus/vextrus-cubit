# Session 8 ledger — Opus 5.5 orchestrating, branch `dev-lane-and-jev`

A timeline, written as it happened: every run, its command, its verdict line quoted, the owner's
rulings, slips and costs. The handoff (`docs/handoff/session-8.md`) will hold the conclusions; this
holds the proofs.

Tree at the start: `14f88709` on `dev-lane-and-jev`, clean, 0 untracked. Postgres up on 5544; 3210,
3211, 3213 free. The last gate on record: `2026-09-23T12:18:24.510Z on ef3c5a98 · GATE summary —
verify: green 51.59s · … · GATE wall-time 505.59s exit 0`.

## Phase 0 — the ground truth (2026-09-23, from 18:2x +06)

- **R0 / R6 evidence recovered.** Both session-7 journals survive
  (`wf_d6a5de12-0ac`, `wf_96743886-20c`). Their results were extracted to
  `.private/work/session-8/r0/breadth-results.jsonl` (6 results: five family mappers and the
  integrator) and `r6-results.jsonl` (the design and the critic).
- **Gate 0** (`pnpm gate` on `14f88709`, log `.private/work/session-8/gate-0.log`): running.
  - `GATE verify green 50.13s`, `GATE checkup green 0.73s`, `GATE golden green 1.94s`.
- **Workflow `s8-phase0-maps`** (`wf_69160663-2ef`): nine read-only mappers (m4-pdf-raster,
  m4-measure, m4-arch-mep, m4-ask, m4-views-docs, m3-frm3-joint, m3-ties-bbs, m3-frm4-breadth,
  craft-carried), a critic per map, the R0 brief, one synthesis into waves. Running.
- **Gate 0 — GREEN** on `14f88709`: `GATE summary — verify: green 50.13s · checkup: green 0.73s ·
  golden: green 1.94s · db: green 93.73s · e2e: green 99.88s · e2e-j000: green 238.06s · perf: green
  21.08s` — `GATE wall-time 505.57s exit 0`.
- **Read-back of gate 0's J-000** (measure leg's project `fe67f2bc`, `db_read`): column concrete 208
  COMPLETE 93.89289649 m³; column rebar 208 PARTIAL_DECLARED; piles 89 pcs / 1,898.904 m /
  372.84892852 m³ COMPLETE; caps 26 / 128.781275 m³, formwork 254.132613 m² COMPLETE; cap blinding 12
  COMPLETE 4.692188 m³ + 14 PARTIAL; cap excavation 26 PARTIAL; beams 172 objects, 172 + 172 lines
  PARTIAL_DECLARED; `orphan_lines 0, placeholder_lines 0`. **Matches session 7's ground truth exactly.**
- **Workflow `s8-edison-dissection`** (`wf_692a9d32-b48`): five drawing-analysts (one per Edison
  drawing), a leakage auditor per report, a synthesis into F-ARCH / F-MEP specs and reader gaps.
- **Demo 0**: `pnpm demo --no-open` served project `3085638e` (billed; 208 column concrete lines, an
  issued BOQ, 208 bar rows) on 3213, sign-in proved.
- **Workflow `s8-walk0`** (`wf_6136da1c-396`): five serial ux-critic browser walks (a fresh project
  from upload, drawings+viewer, levels+schedules, register+Trace+coverage, bill+docs+settings) and a
  qs-critic on figures and documents; one ranking agent.
- **`3952e672` toolchain**: the cad regeneration proof is content-addressed (path + blob id of the
  bytes read); `tests/toolchain/cad-lane.test.ts` 31/31. The machine's proof was carried to the new
  digest form only after the old function re-derived the stored digest on this exact tree
  (`14fec5ed…` = `14fec5ed…`), provedAt unchanged.
- **Edison dissection returned** (`wf_692a9d32-b48`, 11 agents, 2.21 M subagent tokens, 77 min; the
  leakage auditors flagged 23 / 8 / 12 / 8 / 15 items for generic rewrites; the clean reports and the
  F-ARCH / F-MEP specs are in `.private/work/session-8/edison/`). Conventions only, stated generically:
  - **The product reads almost nothing of a real set.** Real sets place their sheets in MODEL space as
    scaled title-block inserts (no viewports); the views stage picks captions by one global height
    share, so grid letters become views and 95–99 % of entities land UNASSIGNED, 0 layout plans.
  - Real member labels are font-wrapped MTEXT (`{\f…;<mark>}`); `normaliseMark` strips no MTEXT code, so
    every label reads "no mark" (stripping moves a counterfactual from 0 to 51 placements).
  - Grids bubbled at BOTH ends misorient `axisAlong` (min spacing ≈ 1e-10).
  - Labels carry mark + inch size in one string (`<prefix>-<n> (<b>"X<d>")`), dotted prefixes, prefix-only
    families; beams drawn as closed per-span rectangles with rotated labels BESIDE them.
  - **Law defects today:** comma/ampersand floor LISTS are read as first..last RANGES (silent
    over-measurement, a hard block); core `mtextLines` drops stacked fractions (½" lost); `readFy` /
    `readFc` bind the first figure anywhere (FC proposed from the fy figure); combined bar groups keep
    only the last group; `(t/b)` / `(bundle)` dropped; `TH=` slab thickness in inches unread (and mm
    stamped would be 25× thin).
  - The DWG lane: 2 of 5 real drawings refused `HANDLES_NOT_UNIQUE` (notes: OBJECTS records on content
    handles; architecture: LibreDWG truncates the whole form, then a SILENT minimal-form fallback that
    loses header, layers, INSERTs and DIMENSIONs); anonymous dynamic-block references deleted and
    reported only as `AUDIT_REPAIRED`.
  - The EntityGraph lacks TEXT rotation/attachment, INSERT identity (name, definition hash, transform),
    layer frozen state, DIMENSION override text — one v3 bump folded into FRM-3's.
  - ELECTRICAL's viewer crash was NOT reproduced standalone (415 MB peak heap, 27.5 s load, ~220
    snap-index rebuilds); needs a repro in the product under the e2e browser.
- **`ed29abf0` harness**: the drawing tools open a drawing the product refuses (analysis-only, the
  refusal named) and keep stdout to one JSON document; the skill says one scratch dir per agent.

## The owner's rulings (one AskUserQuestion round, 2026-09-23 evening)

Asked after the Phase 0 maps (`wf_69160663-2ef`: 9 mappers, 9 critics, the R0 brief, a synthesis — 20
agents, 5.92 M subagent tokens, 111 min) and walk-0's first four walks. Answers verbatim:

1. **R0 — "Regenerate and draw all"** (not the recommended split). The golden is regenerated so the 45
   cells that contradict their own drawing follow it, AND the 75 cells with no drawn member are DRAWN:
   brick walls with their openings, lintels stated whole, the tank plans, a slab panel schedule, the
   grade-beam marks, F1 marked, the shear-wall / stair / slab bars stated, MRR's thickness. M3's exit
   keeps every golden cell in scope. The readers follow in value order; any cell not yet reached at the
   close is reported as a failing observation, never trimmed.
2. **Ties — A′ (recommended)**: derive from BNBC 2020 §8.3.10.5 under D-003; publish at the never-over
   bound where placed beams bound the joint; declare by name where no framing is read (C6, the FDN
   necks, the roof stubs) and the FDN cap dowels; the leg compares whole members with the over arm per
   component.
3. **The bill — one item per description (recommended)**: a section plus a full description (grade,
   diameter, member; level where PWD's floor rate applies), rounded once from the register sum; the
   per-member lines in a "Details of measurement" appendix; the BBS states each mark once per floor with
   its member count (BS 8666); the draft states what it leaves out.
4. **Ask — Jev alone, live in the demo (recommended)**: code composes every figure through the
   formatter, Jev routes paraphrases; `pnpm demo` answers from fixtures first, then live Jev; the home
   shows live and replayed spend apart. No Claude composer, no ANTHROPIC_API_KEY. OCR waits.
5. **Not asked — the Edison boundary**: "conventions only, never content" is L-CAD-09's own reading and
   nothing waits on it; it stands.

**My reading of ruling 1 for masonry** (recorded; the owner may correct it): brick walls are
ARCHITECTURAL by law (`src/core/catalogue/maps.ts:40`), so they are drawn in the architect's set of the
SAME building (F-ARCH, which the project uploads beside the structural set) from one authored wall
layout, and F-RCC6-BNBC's BRICKWORK and LINTEL cells are reconciled with that drawing. Everything else
the 75 cells lack is drawn in F-RCC6-BNBC itself, appended so that no existing handle moves.

## Wave 1, a power cut, and the recovery

- **Wave 1 launched** (`wf_c9f20248-789`, base `ed29abf0`): 20 slices in worktrees (VD-1, FRM3-A,
  ARCH-1, S0, ASK-0, SCALE-1, BOQ-1, DLG-1, C1, C2, C3, C5, C6a, C7, H1, RANGE-LIST, R6-U, R6b-1,
  JEV-1, REG-FILT), each implement → refuter review → fix; the R0-0 refuter alongside. The R0 design
  (`wf_41dfbc28-79c`) launched after the owner's round.
- **A POWER CUT on the owner's side** stopped all three workflows mid-flight. After the restart:
  `git fsck --full --no-dangling` clean, HEAD `95269c4b` intact, tree clean; Postgres came back on
  5544 (the session hook ran before it did). Wave 1's journal held 9 finished results (C1, C2, C3, C6a,
  C7, H1, BOQ-1, R6-U, the R0-0 refuter); every review stage was cut off. The 20 worktrees survived:
  ASK-0 had committed its Decision without returning; SCALE-1 had one commit plus 11 dirty files;
  VD-1, FRM3-A, S0, DLG-1, C5, RANGE-LIST, R6b-1, JEV-1 and REG-FILT held partial uncommitted work;
  ARCH-1's worktree held nothing.
- **Recovery, not a blind resume.** A resume re-runs every interrupted agent from scratch in a NEW
  worktree (and a changed prompt re-runs everything after it), so wave 1 continues through
  `wf_81525490-bcd` (`.private/work/session-8/wave-recover.js`): the 8 finished slices go straight to
  review → fix; the 11 interrupted ones continue IN their own worktrees from the partial work (commits
  and dirt judged first); ARCH-1 starts fresh in its empty worktree. Walk-0 (`wf_6136da1c-396`) and the
  R0 design (`wf_41dfbc28-79c`) resumed from their journals with their exact scripts. The demo was
  restarted for walk-0's last walk (same project `3085638e`, same proved sign-in).
- **R0-0 refuter verdicts** (finished before the cut; `.private/work/session-8/w1/R0-0.refute.json`):
  - CONFIRMED: pile heads sit 75.6 mm inside every cap and are billed twice — **the COMPLETE cap concrete
    128.781 m³ is +1.321 m³ over** (L-MEA-09: pile > cap). Pile concrete is right (the pile owns the head).
  - CONFIRMED (magnitude corrected): the lift pit is a recess inside PC5 — **+3.352 m³** by the drawing's
    own pit section (not 4.989); the golden also double-counts the pit walls and slab. Cap concrete is
    therefore **over by 4.67–6.31 m³ in total — a hard block standing in the product today.**
  - CONFIRMED: COMPLETE cap blinding 4.692 m³ is +0.703 m³ over (piles pass through it) — needs an
    Interpretation that L-MEA-09 governs L-FRM-04's formula.
  - REFUTED: "482.826 kg of cap side bars stated nowhere" — S-26 states PC3's (98.570 kg); only 384.256
    kg is unstated. UNCLEAR: the 2-inch cap cover (the drawing contradicts itself: S-01's note vs S-26's
    cutting at 75) — an Interpretation.
  - CONFIRMED: the SOG is drawn (81D, closed, 328.838 m²); the drawn blinding outline 824-827 is the
    bounding box + 75 (billing it literally would over-measure); golden.py:434's manhole fallback is
    wrong for the pit and the ramp.
  - GC-2's 3F–ROOF removal (554.960 kg) holds under both readings of S-12.
  - **Consequence:** FND-OWN (pile heads, the pit recess, blinding through piles) moves to the head of
    wave 2 — it removes a standing over-measurement from the demo's own figures.
- **Walk-0 complete** (`wf_6136da1c-396`, 7 agents; the bill+docs walk and the ranking ran after the
  resume): **22 BLOCKS_DEMO · 56 FRICTION · 21 POLISH** (`.private/work/session-8/walk0/ranked.md`).
  Verdict: "No. A QS cannot run the demo flow unaided today." Fresh upload stops at scale (0 proposals on
  a DWG upload; the two-point door can never open); Measure then publishes 0 lines naming no reason; on
  the demo project every Trace lands on "no sheet by that name" and the sheet side says "No published
  line cites this selection"; filters cannot open; sheets open illegible with `%%C` painted literally;
  the bill and BBS print `0.000 kg`, UUID headers and raw register keys, never say what they leave out,
  and the BBS overprints its figures; the FC contest from the pile note; the levels FDN row leaves out
  piles and caps; the schedules all stack under "Model sp…". Each is mapped to a slice (VD-1, SCALE-1,
  MEASURE-REFUSE, VIEW-TXT, REG-FILT, BOQ-1, COV-ALL, N1, C5, C6b, DLG-1, BBS-DOC, BOQ-SHAPE,
  BOQ-DESC, FND-OWN); N1, C6b and the new BBS-DOC move up into wave 2.
- Demo stopped after walk-0 so the worktree agents' db lane can run.
- **R0 design returned** (`wf_41dfbc28-79c`: design, refuter critic, final — 1.19 M subagent tokens;
  `.private/work/session-8/r0/design.md`). The critic REFUTED three claims of the first draft ("only
  corrected entities change", a core redraw that broke its own proof rule, ~40 content-keyed model
  recordings missed) and the final design applies them.
  - **Handles:** the generator mints in creation order; a "Rev C append pass" (tagged scenes/views,
    composed after every Rev B sheet) keeps them. Proved in scratch: the empty pass regenerates both DXFs
    byte-identical; corrections + stubs lose 0 handles; all 52 trap handles survive. Proof test:
    `cad/tests/rcc6_bnbc/test_rcc6_bnbc_revision.py` (Rev B maps pinned by blob id).
  - **Corrections** (value-only where possible): EGL −457.2 (excavations 445.875 → 377.279 m³); CS1 150
    constant; S-20 draws the ducts (golden unchanged); CB1–4 250×450; LB1 filed where drawn; the SOG
    reveals; edge ownership per L-MEA-09's owned shape; TG1's side; cap cover 2" (S-26 regenerated at
    50.8, the drawing agreeing with itself); GC-1/2/4 and C7 hoops (−1,394.383 kg of column ties); pile
    heads (−1.332 m³) and the PC5 recess (−4.989 m³) off cap concrete.
  - **Drawn (Rev C):** S-01 cover lines; S-05 pile bars; S-06 F1 marked + cap side bars; S-07 PC5 with
    the lift-pit recess; S-08 42 grade-beam marks + the ramp section; S-12 "sections typical for every
    band" + the C7 section; the lift-core legs grid-centred + leg D; S-15 the seventh LB1, the SRR grid;
    S-19/20/21 slab panel schedules, the ducts, MRR 150; S-22 landings; S-23 SW bars; S-24 three tank
    plans; S-25 lintels stated whole.
  - **Masonry:** F-ARCH (ARCH-1, committed in its worktree) already authors BW250/BW125 walls with
    openings and bills brickwork (538.041 m³ over GF..6F) with S-25's lintels deducted; so BNBC stops
    minting BRICK_WALL rows (the 259.425 m³ lump retires) and keeps LINTEL; one home (B-17).
  - **COMPLETE cells:** column concrete (8) and piles (3) do not move; cap concrete golden 128.821 →
    122.500, cap formwork 254.211 → 262.773 — so FND-OWN lands in the same window as the baseline.
  - **Chain:** R0-G0 (append pass, no content) → R0-G1 (corrections) → R0-G2 (Rev C drawings, XL) →
    R0-G3 (masonry one home, after ARCH-1) → R0-REC (model recordings, live Jev) → R0-BASE (baseline:,
    with FND-OWN) ∥ R0-DOCS; then the readers (WLS-1, F1-1, TANK-1, STAIR-RB, SLAB-RB, PILE-RB, CAP-RB,
    TIE-1, LNT-1, SLB-1).

## Wave 1 integrated; gate 1; the owner's pause

- **Wave 1 recovery finished** (`wf_81525490-bcd`: 43 agents, 9.01 M subagent tokens): 20 slices,
  8 reviews PASS on first read, 11 fixed after FIX_REQUIRED. ARCH-1 (F-ARCH) PASS.
- **Integrated** (`.private/work/session-8/integrate2.py`: a slice's commits cherry-picked together,
  placeholders renumbered once in letter order, one commit per slice plus its `baseline:` commits):
  S0 `e2c6e4df` (I-370…I-394, D-005) · ASK-0 `fd20a143` (I-395…I-407) · H1 `d7abe245` · JEV-1
  `e76a3089` (I-408) · RANGE-LIST `55205658` (I-409…I-411) · R6-U `6175439d` (I-412) · R6b-1
  `ac91ae3e` (I-413, I-414) · FRM3-A `b8eeae02` + baseline `1815db21` (I-415…I-417) · SCALE-1
  `507e939a` (I-418…I-420) · VD-1 `bf608729` (I-421…I-426; one hand merge with SCALE-1 in the partition
  stage) · C1 `b4401c7b` (I-427, I-428) · C2 `b885fb95` (I-429) · C3 `e1ebc279` (I-430…I-432) · C5
  `21b10716` (I-433…I-435) · C6a `55f81325` (I-436, I-437) · C7 `56fcea51` (I-438…I-441) · REG-FILT
  `6ee88c9e` (I-442, I-443; hand merges in s-takeoff.md §0.5 and J-021) · DLG-1 `a7f5f786`
  (I-444…I-448) · BOQ-1 `7a166b93` + baseline `b447e98a` (I-449…I-451) · ARCH-1 `635d3888` + three
  baselines (I-452…I-457). The first per-commit renumbering attempt conflicted on its own placeholders
  and allocated out of letter order; S0 was re-integrated by amend before anything built on it.
- **Gate 1** (after the integration): `GATE summary — verify: green 53.96s · checkup: green 0.80s ·
  golden: green 11.04s · db: RED exit=1 94.84s · e2e: RED exit=1 133.60s · e2e-j000: green 229.19s ·
  perf: green 19.72s` — `GATE wall-time 543.18s exit 1`. Causes, each fixed:
  - verify (before the gate): AC-3 "a baseline: commit carries baselines and nothing else" — the draft
    BOQ's V-DOCS goldens were never declared re-baselines → `374e5d03`.
  - db, 23 tests in 5 files: the register workspace's stand-in extractor still wrote EntityGraph v2,
    which the ingest door now refuses as a stale extractor's → `227a8cfe` (5/5 files, 32/32 green).
    **And a harness hazard:** the owner's `~/.claude/settings.json` symlinked `cad/.venv` into every
    worktree, so each worktree's `uv run` re-installed the SHARED editable `vextrus-cad` from its own
    source — the R0 chain (based before FRM3-A) kept putting a v2 extractor under the main checkout.
    Removed `cad/.venv` from `worktree.symlinkDirectories` (backup
    `.private/work/session-8/user-settings.backup.json`); worktrees now build their own env from uv's
    cache; the running R0 worktree was given its own.
  - e2e, 11: five journeys on `stageRegister` looked for a `v:`-prefixed key in `partition_views`
    (VD-1's stage, written where no journey runs) → `8e9595d3`; J-003's dialog mask painted over the
    footer's buttons once the digest folded into Details → `cb3936e6`; eight pictures moved lawfully,
    each looked at (DLG-1's words, VD-1's title-block sheet number and member Trace, C1, C6a's
    "MPa MPa" fix, C7's names, C3's drawer) → `baseline: e82c627d`.
  - Noted for VD-2: the Trace block shows a raw placement key as the count's source and says
    "1 lines cite this selection". POLISH: the schedules rail clips "Schedule · Def…".
- **Gate 2** started on `e82c627d` (log `.private/work/session-8/gate-2.log`).
- **Wave 2 launched** (`wf_456f194d-b7f`, 18 slices from `e82c627d`: FND-OWN, FRM3-B, VIEW-TXT, C4',
  RES-1, HONEST-SCOPE, SRCH-1, ASK-1a, S1, S2, S4, ARCH-2, ARCH-3, M4P-1, C8, BOQ-SHAPE, L4 (+BBS-DOC),
  REAL-1) — then **STOPPED minutes later at the owner's word ("pause for 30 minute as limit will reset
  and continue")**, together with the R0 chain (`wf_9c4650fd-ab3`, R0-G0 in its worktree
  `.claude/worktrees/wf_9c4650fd-ab3-1`). Both resume by the recovery pattern (continue in the
  worktrees), not a blind resume.
