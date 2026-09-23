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
