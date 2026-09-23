# Session 8 — Takeoff, demo-ready: finish M3, build M4, judge the product in the browser

You are the orchestrator of Vextrus Cubit's eighth Claude Code session: Opus 5.5, in the owner's
Claude Code with this checkout's harness (CLAUDE.md § The harness). The owner — CEO and co-founder — is
in the loop for the owner's decisions and away for the rest. This brief is the session's contract. CLAUDE.md is
the law; `docs/handoff/session-7.md` is the ground truth this session starts from; the Bible
(`docs/specs/cubit.bible.xml`) is the destination, read as the default and departed from by Deviation.

## 1. The one goal

**The Takeoff module, finished and demo-ready.** A quantity surveyor sits down with a Bangladeshi
drawing set and, without help, loads it, organises it, gets it to scale, lets the product take off the
structure, measures what the machine could not, reads rooms and finishes, asks the drawings questions,
checks every number against the drawing in one click, and emits a draft BOQ and BBS they would put
their name to. The owner will demo exactly that. Everything else — Book, Estimate, Assure, Bid — waits.

The bar is not "the lanes are green". It is the owner's: *the best software its users have ever
touched*, doing the job the way a QS in Dhaka does it, with every number traceable and every refusal
honest. Where the Bible's text and that bar disagree, the bar wins and a Deviation says why.

## 2. The finish line

Each condition is REACHED only with its evidence; the close states each one plainly.

1. **M3 walks whole.** `m3-bar-schedule` released (no `MISSING DOOR` left in any m3 leg); J-000 green
   through every M3 segment; the read-back matches the golden within band on every cell the owner's R0
   ruling keeps in scope, and every cell it keeps out is a named Deviation.
2. **M4 walks whole.** The four M4 legs (`tests/e2e/journeys/j-000/m4-*.spec.ts`: a PDF sheet ingested
   and corroborated, a manual condition measured, rooms and finishes taken, a question asked of the
   drawings) and J-040…J-043 walk green with no `test.fixme`. M4's exit: PB-5 (PDF, raster) met; F-ARCH
   finishes within band; a QS can measure a sheet with no auto-detection at all.
3. **The product judged in the browser.** Every Takeoff screen and the whole QS flow walked in the
   running product (both themes, 1440x900 and 1280x800) by the `product-review` procedure; zero
   BLOCKS_DEMO defects standing; the FRICTION list worked down and what remains ranked in the handoff;
   session 7's ten demo-visible defects (`docs/handoff/session-7-artifacts/relook-final.json`) fixed. The
   craft table stays at the bar on every screen (≥ 4.0, no criterion < 3), its pictures looked at.
4. **The gate green on the committed tree**, verify ≤ 60 s, every ceiling held.
5. **A demo the owner can give.** `pnpm demo` serves a project that walks the whole flow; `docs/demo.md`
   carries a short script a founder follows (what to click, what to say, what each screen proves); the
   AI spend it shows is true.
6. **An honest close** (`session-close` skill): handoff, ledger, the next brief, a clean tree, pushed.

## 3. Starting state (verify it; don't trust it)

- The session-start hook prints the checkout's state; the gate's last verdict is in
  `node_modules/.cache/cubit/gate/summary.txt`. The demo is NOT running.
- What changed after session 7's close — the harness, the toolchain, the cleanup — is
  `docs/handoff/session-7-harness.md`.
- **The toolchain moved** (D-004): TypeScript 7 native for the types lane (the whole tree in ~2.5 s) with
  a TypeScript 6 API alias; pnpm 11; Next 16.3.6 (after three security releases); React 19.3; Vitest 5;
  TanStack Table 9 behind `DataTableColumnDef`; react-resizable-panels 4 (sizes are `"%"` strings); cad
  pytest on six workers. pg-boss stays on 10.4.2 (no v10→v12 schema migration exists). Playwright
  stays on 1.62.1: on 1.63.0 J-011's hover sweep meets nothing under the pointer (bisected to the test
  runner, not the product; D-004) — a small toolchain item: find why, then move.
- **The harness is new**: the guard hook, the `cubit` MCP (`db_read`, `jev_ask`, `drawing_inventory`,
  `drawing_render`), the `chrome-devtools` MCP on the product's own Chromium, four agents, six skills,
  path-scoped rules. Use them; when one gets in your way, fix it (a `harness:` commit) and say so.
- **Read-back ground truth** (session 7): column concrete 208 COMPLETE, 93.892896 m³; piles 89 /
  372.848929 m³; caps 26 / 128.781275 m³, formwork 254.132613 m²; beams 172 objects / 344 lines, all
  PARTIAL; no orphan lines. 13 golden cells COMPLETE: 595.523 of 1,186.893 m³ of RCC concrete.
- **The Edison set** is in `.private/reference/edison/` (structural, architectural, plumbing, electrical,
  general notes): a real firm's real drawings — the best evidence this session has of what a Bangladeshi
  set really looks like. `ARCHITECTURE.dwg` refused `HANDLES_NOT_UNIQUE` in an earlier session (LibreDWG
  writes ten LWPOLYLINEs under one handle) and `ELECTRICAL.dwg` crashed the viewer tab under SwiftShader;
  both are real-world robustness work for M4.
- **The carried backlog** is `session-7.md` §6–§7: FRM-3, the ties, FRM-4, the M3 breadth, the debts,
  Jev's live findings "recorded, not built", the unwired Jev passes (`runNoteClausePass`,
  `understandSheet`). R0's per-cell evidence survives in two workflow journals under
  `~/.claude/projects/-home-riz-vextrus-cubit/bbdf46f0-385d-4fc3-97d1-873757ce4017/subagents/workflows/`:
  `wf_d6a5de12-0ac/journal.jsonl` (the breadth map: `goldenAtStake`, `honestReach`) and
  `wf_96743886-20c/journal.jsonl` (the R6 critic: GC-1…GC-4). If they are gone, re-run workflow `c`
  (`docs/handoff/workflows/session-7/c-m3-breadth-map-and-rank.js.txt`).

## 4. The owner's decisions — ONE AskUserQuestion round in your first hours

Recommendation first in each, the evidence in a line or two; keep working on everything that does not
depend on the answers.

1. **R0, the golden reconciliation**: regenerate F-RCC6-BNBC's golden in a `baseline:` commit (fixing the
   ~15 disagreeing cells and GC-1…GC-4, and deciding the ~78 unreachable cells by drawing them or
   dropping them), or Deviations re-scoping AM-01's exit.
2. **The ties** (D-003, reserved): derive them from BNBC 2020's clauses (vendored in
   `docs/reference/bnbc-2020/`) under a Deviation, as the owner ruled in session 7 — or hold them
   DECLARED until the joint depth is read (session 7's R6 ruling, never confirmed with the owner).
3. **The BOQ's shape**: one item per description with its total (how a bill is written) or one line per
   member as today (I-269, `docs/design/s-boq.md`).
4. **A system-two model in the product.** Ask the drawings (R-AI-003), scan reading (R-AI-002) and
   narrative drafting need generation that Jev's closed questions do not do. A low-effort Claude call with
   structured output behind `callModel`, fixture-replayed, is Jev's natural partner — it needs the owner's
   `ANTHROPIC_API_KEY` and a Deviation from the scope fence ("any script that runs Claude"). The
   alternative is Ask on Jev alone (a closed-question router over register queries).
5. **The Edison boundary**: conventions only, never content, in a public repository (recommended; the
   Bible's own reading) — or what the owner has cleared with the drawings' owner.

## 5. The programme

Phases in order; inside a phase, fan out. Each phase ends with its lanes green and its screens looked at.

**Phase 0 — the ground truth (largely parallel).**
- `pnpm gate` on the starting tree — the baseline every later red is measured against.
- A J-000 run and its read-back (`readback`); then `pnpm demo --no-open` and a first `product-review`
  walk of the whole flow in the owner's shoes — the defect list you start from. Stop the demo after.
- An Edison dissection map: `drawing-analyst` agents, one per drawing, each returning its discipline's
  conventions and where F-RCC6-BNBC and the readers fall short (`edison-drawings` skill).
- An M4 map: for each M4 requirement (R-TO-002/003/006/013/015–017/036–038/040–044/055,
  R-SPINE-051/052, R-AI-002/003, R-UI-042, S-Measure, S-Ask, F-ARCH, F-MEP, F-SCAN, A-SHEET-PDF,
  J-040…J-043, X-7): what exists, what is missing, the smallest sequence of vertical slices that walks
  it, the risks. The four `MISSING DOOR` headers in `tests/e2e/journeys/j-000/m4-*.spec.ts` name the
  first doors: no PDF or raster extractor, `DXF_HANDLE` hard-wired in five places, no AGREED exit at the
  gate; no S-Measure Decision, no manual act, no identity for a row with no mark, no method over
  POLYLINE/POLYGON; F-ARCH absent and no room model; no S-Ask Decision and no ai procedure.
- Then the owner's question round (§4).

**Phase 1 — M3, finished.** FRM-3 (TEXT rotation through L-CAD-05: an EntityGraph version bump that
re-keys the corpora in its own `baseline:` commit) places the vertical beams and gives the joint depth →
the ties per the owner's ruling → `m3-bar-schedule` released. FRM-4 (slab thickness per side, lift-core
walls as supports, support faces per storey) → beams COMPLETE where the drawing supports it. The
remaining breadth in the map's order (SLB-1, WLS-1/2, LEV-2, COL-FW). R0 as ruled. N1 (class-scoped
notes) and R2/I-308 (the stated lap) where the bar schedule needs them. Read back after each.

**Phase 2 — M4, the daily QS toolset** (foundations before screens; a Design Decision before each
screen, C-13):
- Fixtures: F-ARCH, F-MEP and F-SCAN by committed generators, synthetic, their goldens authored by the
  generator's own model — shaped by what the Edison set taught (layering, schedules, labels, dirt).
- Lanes: the vector-PDF extractor (pypdfium2, `PDF_OBJECT` keys) and the raster lane (a pinned,
  deterministic classical-CV vectoriser, `RASTER_TRACE`, INTERPRETED with corroboration and the gate's
  AGREED exit); every place that accepts only `DXF_HANDLE` learns the other schemes.
- S-Measure: manual tools (count, linear, area, volume, cutout, typical multiplier) with snaps, every
  measurement an act that offers to the gate; conditions and assemblies; the measurement list; the
  legend; the viewer's Linear/Area/Count tools enabled.
- Rooms and finishes (R-TO-036) with openings from schedules and their deductions (L-MEA-02/03),
  learn-and-count (R-TO-037), MEP runs by size (R-TO-038), split and overlay (R-TO-013), measurement
  overlays and the sheet PDF (R-TO-015/017), dashboards (R-TO-055); search and comments where the demo
  wants them.
- S-Ask (R-AI-003, X-7): answers composed from register queries and sheet text, every number a query
  result rendered by the formatter, every claim cited — Jev for routing and selection, a system-two call
  only if the owner rules it in (§4.4). Jev's live findings from session 7 improve the existing arms.

**Phase 3 — the product judged, in waves** (continuously, not only at the end: a screen built in
Phase 2 is walked the day it lands). Walk the flow in the browser; `ux-critic` agents per area and
`qs-critic` on every figure and document; `refuter` on each finding before it is fixed; fix in waves
(foundation defects first; each fix amends its Design Decision); re-walk after each wave.

**Phase 4 — the demo and the close.** The demo script in `docs/demo.md`; a final gate; the read-back;
the `session-close` skill.

## 6. How to work

- **Effort and pace.** Opus 5.5 runs at xhigh here; spend it on the hard parts (the law, the geometry,
  the design) and move quickly through the mechanical ones. Workflows for fan-out (maps, reviews,
  independent slices on disjoint files); one writer per file. Subagents inherit Opus 5.5 — give each a
  tight scope, the law it needs and a structured return.
- **Turn endings.** The owner has watched sessions end turns while owed work remained: a summary that
  announces the next step instead of taking it, an offer to continue, a list of decisions none of which
  blocks the work, a pause because a milestone felt like a good place to report. Don't. Put status notes
  in the same message as your next tool call and keep going. Stop only when the finish line is reached,
  when nothing can move without the owner (§4, or an irreversible act), or when what blocks you is
  deliberately protected. This never overrides confirmation for risky or destructive actions.
- **Evidence.** Every claim of progress cites a tool result (B-10); a fast green is read with
  `--reporter=verbose`; a screen is judged from a screenshot you looked at; a figure from a read-back.
  Verify adversarially before spending a fix and before reporting done.
- **Durability.** Commit small and often (explicit paths); the hook syncs after each commit. Keep the
  session ledger (`docs/handoff/session-8-ledger.md`) as you go — runs, rulings, slips, costs — so a
  compaction or a power cut loses nothing.
- **The law's ids.** Next free: I-370, D-005 (D-003 reserved for the ties), migration 0062.

## 7. Reporting

Short progress notes as you work: what you did, what you found, what you need. At the close, the
handoff states each finish-line condition as REACHED or NOT with its evidence, every commit in one line,
the gate verbatim, the read-back, what is not done and why, the owner's open items, and the true AI
spend (the product's model ledger plus `node_modules/.cache/cubit/harness/jev-calls.jsonl`).
