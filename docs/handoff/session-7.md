# Session 7 handoff — Opus 5.5 orchestrating Opus 5.5

Branch `dev-lane-and-jev`, from `a46408b0` plus session 6's documents (main `8cf9f11f`, never
touched). Claude Opus 5.5 (`claude-opus-5-5`) orchestrated Opus 5.5 workers through the `Workflow`
tool (dynamic workflows), single background agents and git-worktree isolation. The ledger is
`docs/handoff/session-7-ledger.md`, a timeline of every run, its proof lines and what I did with it.
The workflow scripts that worked are in `docs/handoff/workflows/session-7/`.

Three things were absent or held:
- `mcp__builder__check`, `mcp__builder__scratch_dir` and `mcp__builder__debt_rows` were ABSENT again.
  Every lane ran by shell, and every verdict below is the lane's own line.
- `TYPESAFE_API_KEY` stood in `~/.bashrc`. It was never printed, written or committed.
- Jev was called LIVE once, on the owner's instruction: 241 fixtures re-recorded with the provider's
  own bodies, about $0.023 all told (e78849a5).

## 0. Where the programme stands — sessions 1 to 7

| Session | Model | What it moved |
|---|---|---|
| 1 | — | the dev lane, WSL2 origin/CSP, DWG through the CLI, the viewer's select/pan, Jev's live transport, a key committed to history (removed in 2; **rotated by the owner at session 7's close, the old key disabled**) |
| 2 | Fable 5.1 | real-world DWG healed; F-RCC6-BNBC's viewports kept; the viewer projects model space through paper windows; Jev made lawful |
| 3 | Fable 5.1 | **M0–M2 proved end to end in a browser**; the re-expansion door; the probe, `pnpm gate`, `pnpm e2e:retake`; craft 4 of 18 |
| 4 | Fable 5.1 | the first M3 leg; the BBS export door; Jev logic-point 1; craft 12 of 18 |
| 5 | Fable 5.1 orchestrating Opus 5 | the viewport-caption door and five more; `m3-measure-and-register` green; Jev points 2–7; six craft slices |
| 6 | Opus 5 orchestrating Opus 5; closed on 5.5 | the gate first and every red to a cause; the two M3 doors in code; the Jev confidence contract; the open defect's cause named |
| 7 | Opus 5.5 orchestrating Opus 5.5 | **the register reads the notes (one resolver); the bill leg released as a document leg asserting figures; BNBC's foundations measured COMPLETE (piles, caps by outline, cap formwork, the FDN neck); 72 BNBC beams placed; the craft table 18 of 18 at the bar and looked at; PERF-011 honest at full stage and green; the demo command; Jev pinned at its true rate; the gate green with verify under 60 s** |

What that adds up to, honestly:
- **M0–M2 are proved and green.**
- **M3 walks every leg but one.** Levels and notes, measure and register (asserting the campaign's
  FIGURES per storey), and the bill are green in J-000. The bar-schedule leg stands `test.fixme` on
  one named door: the column ties. They need the beam joint depth, and the vertical beams wait on
  FRM-3.
- **M3 is not complete by the golden.** Of F-RCC6-BNBC's 193 golden cells, the product now compares
  **13 COMPLETE cells**: column concrete FDN and GF..6F, the three pile cells, cap concrete and cap
  formwork. They hold **595.564 m³ of the golden's 1,186.893 m³ of RCC concrete (50.2 %)**, and the
  product measures 595.523 m³ over them. It was 90.834 m³ (7.7 %) at the session's start.
  - The breadth map (ledger, `wf_d6a5de12-0ac`) measures about 78 cells as unreachable from the
    drawing as drawn, and about 15 as disagreeing with it.
  - Both need the owner's ruling (§7, R0).
- **M4 has not started.** It stands on four named `MISSING DOOR` legs (314b90b3).

The finish line of this session's prompt, condition by condition:

1. **M3 walks whole — NOT reached.** `m3-bar-schedule.spec.ts` is the one M3 fixme left, with its door
   named: the ties need FRM-3.
   - The bill leg runs, but not as the prompt's bill clause spelled it ("the BOQ band green over the
     published cells"). The golden band is taken on the MEASURE leg. The bill leg asserts the
     document's fidelity to the register per cell (|Σ stated − exact| ≤ n·½·10⁻ᵖ); its docblock says
     "THE GOLDEN BAND IS NOT TAKEN ON THE DOCUMENT" (`m3-bill-and-schedules.spec.ts`).
2. **The gate is green on the committed tree — REACHED.** The closing `pnpm gate` (§5, gate 8) ran on
   `7d4b69e8`, the final product tree:
   - every lane green, `GATE wall-time 516.95s exit 0`;
   - `verify wall-time 59.01s` against 60 (cad 52.44 s, unit 47.08 s, lint 40.98 s, types 8.49 s,
     build 6.37 s, cold on I-369's source change);
   - unit 565 files / 3,806 tests; db 242 / 1,467 over its two passes; lint 0 errors / 158 warnings;
     tsc 0; the cad lane's ruff "All checks passed!"; the frozen literal-test-id count (69,
     `tests/lint/testid-registry-ratchet.test.ts`) holds;
   - e2e sweep 96.98 s against V-E2E's 12 minutes, its longest journey J-020 at 31.8 s against 90 s;
     J-000 224.95 s, each leg inside its own `test.setTimeout` budget.
   - The commits after it add documents and `03a1ff07`, two lines of test prose, proved by its own lane
     (`tests/journeys`, 13 / 145).
   - The gates before it are in §5: two went red (gate 2, the lost click; gate 6, the in-process
     drift window), and gate 4, the first after the power cut's reboot, read verify at 66.39 s on cold
     caches.
3. **The craft table is at the bar — REACHED, on the final tree.** The craft walk re-ran on
   7d4b69e8's tree over the M3 project (BNBC `1a78eafd`):
   - 72 captures, 0 RED, axe 0/0/0 on every one;
   - 18 of 18 screens at total ≥ 4.67 with no criterion below 3, both themes and both viewports;
   - all 72 looked at by six vision reviewers (`wf_35743067-b04`): 0 below the bar, four lowerings
     (`tokensAndGrid` 5 → 4 three times, `copyDiet` 5 → 4 once) that keep every criterion ≥ 3, 10
     demo-visible defects and 25 polish.
   - The first re-walk on ffdfdb1a had read S-Project at min 1 (`workSurface`): craft wave 3 had made
     its activity table five rows tall. That was the one screen below the bar, and 7d4b69e8 (I-369)
     fixed it (§4).
4. **The demo is real — REACHED, with one caveat stated.** After gate 8, `pnpm demo --no-open`
   (361bc64a, `docs/demo.md`) served project `bfc66e0b` on `http://127.0.0.1:3213` with the worker
   ready. That is gate 8's billed BNBC project: 208 column concrete lines, an issued bill of
   quantities and 208 bar rows, as the demo's own block prints them. The demo printed a sign-in it had
   proved against the stored hash.
   - From Windows, `curl.exe` read 307 → `/sign-in` in 0.040 s, and `/sign-in` 200. **This is reach,
     not the owner's browser:** no session can drive the owner's Windows browser, so the owner opens
     the printed address to see it.
   - `pnpm probe signin` with the printed credentials: `OK signin`.
   - The project home and the register walked at axe 0/0/0 and were looked at. The register reads
     "1,131 of 1,131 lines", totals 89 pcs · 1,898.904 m · 600.215 m³ · 254.13 m². The 600.215 m³ is
     the footer's sum of every m³ line: the 595.523 m³ of COMPLETE RCC concrete plus 4.692 m³ of PCC
     blinding.
   - The store's orphan query reads 0 / 0 on `bfc66e0b`.
   - **The AI spend is true.** 10 Jev calls were replayed from the recorded corpus (fixture
     transport, no live call): 7 proposed, 3 refused MALFORMED, 5,150 input and 1,170 output tokens,
     attributed $0.000216 at the pinned rate.
   - The demo is LEFT RUNNING for the owner; `pnpm demo --stop` ends it and must precede any journey
     or gate.
5. **M4 — NOT reached; standing on named doors.** Four `MISSING DOOR` leg files (314b90b3), each
   naming its doors: S-Measure and S-Ask have no Design Decision (C-13); cad has no PDF or raster
   extractor; F-ARCH is not in the tree. None was worked, and the "work behind each one measured"
   stands as their headers measured it at 689b5d76.

## 1. What was proved, per journey

- **J-000 M0–M2**: green at the close and in every gate from gate 3 on (12 passed, JOURNEY J-000 green).
  They were not green in every run:
  - m2-coverage-grid went red twice in three runs before c6980f0e, and the first all-layout fix took
    J-000 to 7 failed;
  - m2-affirm-scale went red in gate 2 at the prologue's set toggle, before c94b9dc7;
  - the M1–M3 legs failed under C2 (7 failed / 2 skipped / 5 passed) before it was reverted.
- **J-000 `m3-levels-and-notes`**: green. The walk now inserts FDN at ordinal −1, ENTERED 0.6096 m,
  citing S-25's 1D59, and confirms the stack by key (I-311).
- **J-000 `m3-measure-and-register`**: green, and it now asserts FIGURES: per storey FDN, GF..6F,
  count 26, the footer's exact `data-value` inside the golden band, plus the pile, cap and
  cap-formwork bands. Read back from the run's own database (the BNBC project, latest campaign):
  - column concrete: 208 COMPLETE lines, **93.892896 m³** (FDN 3.0596 + GF..6F 90.8333);
  - piles: 89 / 1,898.904 m / 372.848929 m³;
  - caps: 26 / 128.781275 m³, with formwork 254.132613 m²;
  - beams: 172 register objects, one per placement per storey, and 344 lines (172 per kind), every
    line PARTIAL. There are 0 orphans since 2846dcc7. From 788c1e8a until then, every BNBC campaign
    also held 50 lines on `@UNRESOLVED` keys that no register row carried (§2).
- **J-000 `m3-bill-and-schedules`**: RELEASED as a document leg. The draft is emitted DRAFT — UNSIGNED
  and the XLSX is opened and proved faithful to the register per compared cell. The declared cells are
  asserted by name; the FDN column cell is now compared.
- **J-000 `m3-bar-schedule`**: fixme, `MISSING DOOR:` ties (R6 → FRM-3).
- **J-000 `m4-*`**: four fixme files, one named door each.
- **The regression sweep**: 53 passed, 1 skipped in its last runs.
- **PERF-011**: now measures the 100k sheet at the size a reader sees it. It was red at a 53.9 ms
  median frame, and is green after c0011b26.

## 2. What was fixed (commit · clause · proof)

- **9332c203 toolchain(ports).** The owner had switched WSL2 to mirrored networking, and six stale
  `netsh portproxy` rules held 3210/3211. The rules were deleted, the served ports got one home, and
  "held" became a bind probe that attributes Windows listeners.
  - The rules came back at the next logon: vextrus-builder's NAT-era scheduled task
    "WSL localhost sync" re-adds them, elevated.
  - After the session's power cut, the owner ruled: the rules were deleted again and the task
    DISABLED (`schtasks /Change /TN "WSL localhost sync" /ENABLE` reverses it).
- **929a37c2 AUTHOR_TYPICAL_RANGE through the one resolver.** Session 6's open defect: the act was a
  third spelling of the expansion. Now **182 / 90.833 m³**, read back from the store. 8e589aa5 retires
  residue observations whose key the register no longer carries.
- **96478d43 / 84e891a3 (D-001, I-311).** A storey stated in two notations stands at the finer print.
  An offered stack is confirmed by KEY and resolved on the server (GF 3.3528 on two readings).
- **20067339.** A column's storey run is read through the canon, in the drawing's unit.
- **e78849a5 (D-002).** Jev pinned `jev-latest` at $0.042/Mtok input with output free. Claude rates
  corrected to $5/$25 and $2/$10. The corpus re-recorded LIVE with provider bodies (migration 0057).
- **c6980f0e.** The frame's slots are owner-held claims, first claimed in the commit that mounts the
  screen. J-000's register had opened without its tabs row and crumb twice in three runs. Two causes,
  both measured:
  - the transient hydration copy's `set(null)` erased the live one's slot;
  - a passive-effect claim was parked for good under a slow CPU (probe at 6×).
- **04b32acb.** Nine tracked files carried raw control bytes as key separators.
  - Seven held NUL, and the harness's grep (ugrep `-I`) silently skipped each of them as binary.
  - The other two held U+001F or U+0001, which grep still searched: `src/core/campaigns/digests.ts`
    and `db/__tests__/participants-seam.live.test.ts`.
  - All nine now write the byte as its `\u00XX` escape.
- **a6b971cc.** Four db suites imported `db/schema.ts` without the drift lock that
  drift-lane-breaker's sabotage requires. One went red mid-sabotage.
- **057e9e6c.** verify ran the cad lane three times and `eslint src` twice. It went from 70.5 s to
  58.8 s.
- **97d176a8, then c94b9dc7.** The gate's J-000 went red twice at its set-up's set toggle, and the
  store held no member row: the click was LOST.
  - The set page arrives by a full load (`window.location.assign`), so its row is painted by the
    server before the client hydrates. `settled()` reads nothing that says it has.
  - The toggle now waits for the page crumb the set browser claims in a layout effect.
  - The next gate's J-000 walked the prologue a second time, the path that had failed, and was green.
- **36d16d6e.** That gate read verify at 62.55 s, because its build lane compiled cold (10.18 s).
  - Turbopack traced `join(process.cwd(), "storage")` over the 22,737 objects every run had laid down,
    and ONE new object turned the next build cold (5.0 s → 8.2 s, measured).
  - The path is annotated `turbopackIgnore`. A warm build is 3.0 s and stays 3.0–3.2 s as objects are
    added, and a guard test pins it.

- **2846dcc7 (I-368, L-CAD-07).** Found by reading gate 5's J-000 run back: 197 beam lines per kind
  against 172 beam objects.
  - 50 lines sat on `…@UNRESOLVED` keys of S-14's typical beam plan, and no register row carried
    them. Every BNBC campaign since 788c1e8a held them.
  - The cause: the first Measure's frame rail offered the typical plan's beams while they stood in the
    UNRESOLVED slot, the gate published them against L-CAD-07's "UNRESOLVED rows with no line", and
    AUTHOR_TYPICAL_RANGE then re-keyed the rows away from their append-only lines.
    - This was diagnosed read-only (`wf_866d9027-c14`: three investigators, a synthesis, two
      refuters).
  - Once beam lines carry values, the register footer and the BOQ, with its PDF and XLSX, would have
    counted a typical floor twice.
  - The fix: the gate refuses a member in the UNRESOLVED slot with TYPICAL_RANGE_UNSTATED.
  - The implementer's second arm, refusing `@unregistered:` placeholders, was blocked by both
    adversarial reviewers, and I-368 records it as owed:
    - the law reviewer found it an undisclosed under-measure (L-QTY-04);
    - the regression reviewer found that its new code's remedy sends a reader to insert a level that
      already stands.
  - Read back after the fix:
    - beam lines 344 on 172 keys, 0 orphans;
    - every COMPLETE figure unchanged;
    - the first press `refused 50 {TYPICAL_RANGE_UNSTATED: 50}`.
- **21e0e6d5.** One db lane went red in a single suite (sheets/route-render, "expected 500 to be 200"
  three times), and it was green alone.
  - The cause: drift-lane-breaker renames `tenants.name` in tracked source under the drift lock, and
    the shared acceptance build compiled that seam outside the lock.
  - It was reproduced by renaming only during the build.
  - After the fix, a faithful replay of the breaker's window shows the build waiting it out, and the
    suite green.
- **8a950e58 toolchain(db).** The next gate's db lane was red in members-live: its staging had
  imported the renamed seam IN-PROCESS (`insert into "tenants" (…, "title", …)`). A lock only holds
  the readers that take it, and every database suite imports the schema. So the lane now runs its
  batch with drift-lane-breaker excluded, then the breaker alone (`scripts/lib/db-passes.mjs`).
  - The batch reads 241 files / 1,465 tests, and the breaker 1 file / 2 tests in 3.45 s.
  - The wall time is 89.89 s, about 4 s more than before.
- **ffdfdb1a.** The close's fact-check read gate 7's build log: three more Turbopack warnings of
  36d16d6e's class. The mail outbox (10,492 mails) and the recorded-answer fixture root (a pattern over
  10,867 files) were build inputs, so every journey's mail turned the next build cold.
  - Four path calls are annotated `turbopackIgnore`, and the build now reports NO warning (compile
    0.54 s warm, 0.65 s with a mail added).
  - `tests/toolchain/runtime-paths-untraced.test.ts` holds the whole of `src/` to it, red with the
    fix removed.
- **7d4b69e8 (I-369).** The re-walk on the final tree found S-Project below the bar (§4). The activity
  table takes the room main leaves and holds up to twenty acts; the empty state keeps its own height.
- **03a1ff07.** The ties door cited D-002, the Jev pin, in two test files; it now cites D-003, the
  Deviation reserved for it.

## 3. What was built

**M3 doors on F-RCC6-BNBC.** Each measured door was read back from J-000's own database. The sheet-title
change (3265b9ce) was measured on the fixtures' proposals: F-RCC6 moves 0 of 9 layouts, and every BNBC
paper sheet reads its title block.
- **FND-1 (9bbc2598).** Piles typed by the paper-captioned schedule 200A, the bare-prefix `P` family
  corroborated by NOS and DIA, and dimensions stored (0058). 89 / 1,898.904 m / 372.849 m³.
- **FND-2 (da18f37c).** Caps placed by their OUTLINE (26, not 89): the MTEXT header read, containment
  gated by the scheduled size, and the plan stored (0059). 128.781 m³ against 128.821. I-330..I-334.
- **BEARS-1 + FND-3 + LEV-1 (f99cdb97).** The bears relation reconciled (0060). Cap formwork, sides
  only, by the carried perimeter (new methods, edition 2027.04, 0061): 254.133 m² against 254.211. The
  FDN neck stood under every GF vertical: 3.0596 m³ against 3.060. I-336..I-339.
- **FRM-1 + FRM-2 (788c1e8a).** Runs read in the drawing's one unit and addressed per axis
  orientation. The beam grammar; bound-xref layers ignored; long-section strips as member types; the
  stated-width pairing. 72 beams placed, none billed. I-340..I-344.
- **70b899ba.** A `1ST`-named placeholder is carried onto 1F by the rebuild: 172 beam objects, not
  195. I-366, I-367.
- **3265b9ce.** Sheet titles from the title block's numbered line. F-RCC6 moves 0 of 9 layouts; every
  BNBC paper sheet is retitled. I-364, I-365.

**The bill and the golden:**
- **9d2180a2.** The golden's half-unit and the product-to-golden kind map have one home.
- **45549bca / 689b5d76.** The measure leg asserts figures; the bill leg is released; the BBS leg
  stands on its own door.

**Toolchain:**
- ee2fdf93: method hashes cover implementation closures.
- 361bc64a: `pnpm demo`.
- 314b90b3: M4 split into four named doors.
- 2f09d906: BNBC 2020's column clauses vendored.

**The viewer at full size (c0011b26, I-345/346).** The measured cause was the fill of legible
lettering, ~39 of ~48 ms per frame under SwiftShader. In motion the sheet is drawn from its settled
frame; at rest in full, bit-identical (0 of 816,480 pixels differ at four cameras).

### The law — Interpretations and Deviations of session 7

Session 7 defined **59 Interpretations (I-307…I-369, less I-308, I-310, I-312 and I-329) and two Deviations (D-001, D-002)**. Each Interpretation here was matched by `grep -rnE "\*\*I-3NN\b" docs/design docs/decisions`, which requires a bullet that opens with the id in bold, and by `git log -S"**I-3NN" --reverse a46408b0..HEAD -- docs/design docs/decisions`. For every defined id, the commit that first cites it under `docs/design`/`docs/decisions` is also the commit that defines it, so nothing there was cited before it was defined. Paths below are relative to `docs/design/` unless they say otherwise.

| Id | Where defined | Commit | Gist |
|---|---|---|---|
| I-307 | `s-bbs.md:81` | `20067339` | a vertical's bars are cut to the canon's conversion of the level's height, in whatever unit the drawing stated it |
| I-309 | `s-levels.md:67` | `929a37c2` | AUTHOR_TYPICAL_RANGE writes the one resolver's rows; one rule says which plan owns a storey |
| I-311 | `s-takeoff.md:243` | `84e891a3` | an offered level stack is confirmed as its KEY; its membership is the offer standing now (L-ACT-02, L-MEA-07, D-001) |
| I-313 | `primitives-core.md:20` | `98194855` | a control in a 28 px row is a 24 px target; the row does not grow (CR-A) |
| I-314 | `primitives-data.md:34` | `98194855` | a grid is one Tab stop; a cell's controls are reached through the cell (CR-A) |
| I-315 | `primitives-data.md:50` | `98194855` | a grouped list is windowed over its items (CR-A) |
| I-316 | `primitives-data.md:65` | `98194855` | a group's own sum is a figure, written through the one figure seam (CR-A) |
| I-317 | `viewer.md:144` | `45f33d80` | an address that names no camera is a FITTED sheet until the reader moves it; the fit is never written |
| I-318 | `viewer.md:1251` | `45f33d80` | an axis is drawn where THIS sheet shows it, or not at all |
| I-319 | `viewer.md:1272` | `45f33d80` | this sheet first; the other sheets are one disclosure |
| I-320 | `s-schedules.md:178` | `e6db2f42` | a schedule captioned by a paper-layout text reads its own model texts top-down |
| I-321 | `s-schedules.md:187` | `e6db2f42` | a mark cell that is exactly a class prefix is a family, typing numbered placements only where the schedule corroborates them |
| I-322 | `s-schedules.md:195` | `e6db2f42` | a schedule's dimension columns are read per class, only where the class's methods use them |
| I-323 | `s-drawings.md:169` | `5025cd50` | the index answers the craft look: one header row, words for enums, a card the height of its readings |
| I-324 | `s-drawings-sets.md:110` | `5025cd50` | the set browser's grid takes the height the column leaves; the pin and its evidence stand beside it (amends I-286, I-106) |
| I-325 | `s-settings-ruleset.md:151` | `6305ff3f` | the root states the truth, the scope reads in words, the primary stands first |
| I-326 | `s-settings-ruleset-author.md:118` | `6305ff3f` | one spelling per fact, one right edge per column, the version beside its door |
| I-327 | `s-settings-site-facts.md:110` | `6305ff3f` | a fact is deferred exactly where the rail defers it |
| I-328 | `s-settings-participants.md:155` | `6305ff3f` | the list, the act and the record on one screen |
| I-330 | `s-schedules.md:204` | `da18f37c` | an MTEXT is read as its lines; an un-ruled header takes its columns from where the rows stand (FND-2) |
| I-331 | `s-schedules.md:214` | `da18f37c` | a bar schedule mints no family; a family two schedules name binds nothing |
| I-332 | `s-schedules.md:219` | `da18f37c` | a pile cap's DEPTH is read only from a schedule whose rows are all one class |
| I-333 | `s-schedules.md:224` | `da18f37c` | a mark inside closed rings names the smallest ring its schedule's size fits; each placed ring's plan is stored (migration 0059) |
| I-334 | `s-schedules.md:237` | `da18f37c` | the plan's SHAPE is the drawing's, its SIZE the schedule's where the two agree (I-304) |
| I-335 | `primitives-data.md:76` | `98194855` | a hovered row carries no caption ink; a sort control is a whole target |
| I-336 | `s-coverage.md:243` | `f99cdb97` | the bears relation says what a class lawfully holds, not what a rail publishes today (BEARS-1, migration 0060) |
| I-337 | `s-schedules.md:341` | `f99cdb97` | a foundation is formed along its SIDES only, over the plan its concrete is measured over (FND-3; IS1200_IN @ 2027.04, migration 0061) |
| I-338 | `s-levels.md:95` | `f99cdb97` | a vertical continues down to the foundation neck beneath GF, sized by the band covering GF (LEV-1) |
| I-339 | `s-levels.md:120` | `f99cdb97` | the neck's storey is ENTERED, 0.6096 m, citing the foot of the section's column lines |
| I-340 | `s-schedules.md:244` | `788c1e8a` | a run is read in the drawing's one unit; a support is addressed off each axis by its own orientation (FRM-1) |
| I-341 | `s-schedules.md:263` | `788c1e8a` | a floor-by-floor set's framed prefixes are beams by exact prefix; a storey digit keys a beam to its floor |
| I-342 | `s-schedules.md:278` | `788c1e8a` | a bound xref's layers are another drawing's background; no member is read off them |
| I-343 | `s-schedules.md:289` | `788c1e8a` | a long-section strip's label is a member type, banded by its sheet's title (FRM-2) |
| I-344 | `s-schedules.md:311` | `788c1e8a` | a pair wider than the pairing band is a member only where its gap is its naming mark's stated width |
| I-345 | `viewer.md:174` | `c0011b26` | a sheet in motion is drawn from its settled frame; a sheet at rest in full (PERF-011, no budget moved) |
| I-346 | `viewer.md:216` | `c0011b26` | the glyph atlas is an alpha texture; a glyph is still its whole cell |
| I-347 | `s-audit.md:129` | `2796da06` | the presenter reads what the log actually cites; a row never shows one name twice (amends I-38, I-146) |
| I-348 | `s-documents.md:52` | `2796da06` | the issuer is a person, the row's door fits at 1280, the root states itself |
| I-349 | `s-settings-ruleset.md:166` | `2796da06` | the column's bound is the field the frame leaves; each grid states that it rendered (corrects I-325's bound) |
| I-350 | `s-takeoff.md:323` | `685c674d` | the register reads as a QS reads it: every total on the face, every clip marked, a member's lines together |
| I-351 | `s-coverage.md:268` | `685c674d` | one kind, one spelling; every header in full; no build word in a sentence (withdraws I-25/I-cov-4 for kinds) |
| I-352 | `s-levels.md:268` | `685c674d` | a roll-up column says its kind in words; every figure reads down its column at one precision |
| I-353 | `s-schedules.md:400` | `dc8c0a33` | the registry: bands from the ground up, one grid headed once, model space said in words |
| I-354 | `s-bbs.md:135` | `dc8c0a33` | the BBS reads from the ground up; a partial schedule says WHAT it leaves out and where that is settled |
| I-355 | `s-boq.md:166` | `dc8c0a33` | the taxonomy is named by its edition, a lawful-null level is a word, a member's mark is muted |
| I-356 | `primitives-data.md:92` | `d3e3aafd` | a group's sum stands in the column it sums |
| I-357 | `primitives-data.md:122` | `d3e3aafd` | a grid's bands stand on `--surface-band`; the header stays on the field |
| I-358 | `primitives-core.md:33` | `d3e3aafd` | the page crumb names the page in full and reads as the page |
| I-359 | `s-drawings.md:237` | `134aeaed` | a card says which answer its views line is; the thumbnail is the sheet as it plots (amends I-87, I-323) |
| I-360 | `s-drawings-sets.md:138` | `134aeaed` | one name for the pin's fingerprint, one helper line a screen, navigation spelled once (amends I-99, I-285, I-96, I-324) |
| I-361 | `viewer.md:229` | `632e62a2` | a layer row is its switch, name and count; the three controls stand over its end, out of its flow |
| I-362 | `viewer.md:268` | `632e62a2` | the frame is shell-main's PADDING box; every edge is one seam |
| I-363 | `viewer.md:1289` | `632e62a2` | a grid axis is read on L-REG-04's lattice, its bubble lettered wherever the ring holds a legible label |
| I-364 | `s-drawings.md:293` | `3265b9ce` | a card is named by the title block's numbered line, never by text the set repeats on every sheet |
| I-365 | `s-drawings.md:329` | `3265b9ce` | the `S` of `S-01` names the discipline |
| I-366 | `s-levels.md:131` | `70b899ba` | a placeholder the caption's word left is carried onto the storey the resolver reads that word as, never stood beside it |
| I-367 | `s-levels.md:161` | `70b899ba` | what the rebuild never carries |
| I-368 | `s-levels.md:171` | `2846dcc7` | a member in the UNRESOLVED slot carries no line and no queue item |
| I-369 | `s-project.md:220` | `7d4b69e8` | the activity table takes the room main leaves and twenty acts fill it (amends I-132, I-147) |
| D-001 | `docs/decisions/deviations.md:44` (register row :41) | `96478d43` | L-MEA-07: a storey stated in two notations is one storey; readings agree within the decimal print's places and the finest is carried |
| D-002 | `docs/decisions/deviations.md:95` (register row :42) | `e78849a5` | AS-05: TypeSafe Jev (`jev-latest`) is a pinned model at its published rate; the corpus is re-recorded live; migration 0057 |
| D-003 | defined nowhere; **reserved** | — | the BNBC 2020 / ACI 318-19 column-ties ruling (session-7-ledger.md:595; session-7.md:318; session-8-prompt.md:29, :62). The clauses are vendored at `2f09d906`; the ties slice R6 has not landed |

**GAPS**

- **I-306: allocated, never minted.** The ledger allocates it at `session-7-ledger.md:206` ("so it is an Interpretation (I-306), not a Deviation") and `:228` ("I-306 formwork (L-MEA-09 governs vertical formwork)"). It is defined nowhere in `docs/design` or `docs/decisions`, and `git log -S"I-306" a46408b0..HEAD -- docs` returns nothing. `src/` and `tests/` do not cite it. The number is spent. The ledger's finding (session 6's "L-FRM-03 is 4.49 % over" is really +11.13 %, and L-MEA-09's form reproduces all nine COLUMN|FORMWORK cells at 848.559 m²) stands only in the untracked ledger. Critic's lead confirmed.
- **I-308: cited as law, defined nowhere.** The ledger allocates it at `session-7-ledger.md:229` ("a stated lap stands outside the grade contest") and defers it at `:283` ("R2 (I-308) rides with R6's synthesis bump"). It is cited at `tests/e2e/journeys/j-000/m3-bar-schedule.spec.ts:4` and `tests/journeys/fixme-roster.test.ts:36`; both lines were written in `689b5d76`. No bold definition exists, and `git log -S"I-308" … -- docs` is empty. Critic's lead confirmed.
- **I-310: never minted, still cited.** The ledger decides this deliberately at `session-7-ledger.md:230` ("**I-310 never minted**"). It is still cited as `I-310-a` at `tests/e2e/journeys/j-032-schedules-notes.spec.ts:324`. That is **:324, not the :319** recorded in session 6 (`session-6.md:206`; the session-6 workflow scripts); the line has moved. `git blame` gives `94056277` (2026-09-19, "M3: S-BBS and A-BBS-PDF (inc-310-bbs-view)"), which predates the range. That `-a` is an increment-local label rather than an Interpretation is an inference from that subject line, not verified. Critic's lead confirmed, with the line corrected.
- **I-312: drafted, reverted, defined only in an artifact.** It was minted for C2 ("a screen DRAWS its part of the frame in place"). C2 was reverted after `pnpm e2e` went `7 failed / 1 skipped / 46 passed` (`session-7-ledger.md:657–667`). The definition survives only in `docs/handoff/session-7-artifacts/c2-frame-regions-drawn-in-place.REVERTED.patch:48` and the kept test artifact. `docs/design/shell.md` does not carry it. No rule on record says whether a reverted number may be reused.
- **I-329: skipped.** It is mentioned nowhere in `docs`, `src`, `tests`, `cad`, `scripts` or `fixtures`, including the workflow scripts and artifacts. The numbering jumps from I-328 (`6305ff3f`) to I-330 (`da18f37c`).
- **Duplicates: none in the law.** Each defined id has exactly one bold opening under `docs/design` + `docs/decisions`. The only second bold hit is `docs/handoff/session-7.md:330` ("**I-368's owed arm.**"), a handoff reference, not a second definition.
- **Stale D-002 citations: FIXED at the close (`03a1ff07`).** `m3-bar-schedule.spec.ts:4` and `fixme-roster.test.ts:36` said "the ties slice (R6, D-002)". D-002 is the Jev pin, and the ties Deviation is D-003. Both lines came from `689b5d76`, written after the renumber in the plan's first allocation. They now cite D-003, and the roster marks I-308 as reserved and not yet minted.
- **D-003 reserved, not in the register.** `docs/decisions/deviations.md` holds D-001 and D-002 only (rows :41–42). The reservation is recorded only in the untracked handoff files (`session-7-ledger.md:595`, `session-7.md:318`, `session-8-prompt.md:29, :62`).
- **The next free ids:** I-370, D-004 (D-003 reserved), migration 0062. Nothing in `docs`, `src` or `tests` cites I-370 or higher.
- **The register's Commit column names no hash.** Rows D-001 and D-002 read "the commit that adds this row (see §D-00N)" (`deviations.md:41–42`). The commits are `96478d43` and `e78849a5`.

## 4. The craft table

- **The first LOOK** (`wf_017ab585-9bc`) found 8 screens below the bar and 8 not demo-ready (119
  defects).
- **Seven craft slices** landed in the integrated window (98194855..6305ff3f, plus 23 pictures in
  b1e93f36).
- **The walk then read 16/18**. ac61aded fixed participants' work surface and the set browser's hidden
  overflow, giving **18 of 18 at the bar** (every route ≥ 4.67 total, min ≥ 3).
- **The re-look** (`wf_d92183cc-5d3`, 6 vision reviewers, all 72 captures): **0 blocks, 34
  demo-visible, 33 polish**. Reviewer lowerings kept every criterion ≥ 3.
- **Craft wave 3** (`wf_d95baa34-4c1`, five slices, d3e3aafd..134aeaed, plus 17 pictures in 38611671)
  and **the final wave** (632e62a2, 3265b9ce, plus ef6d3444) worked the demo-visible list.
- **The close re-walked the table on the final tree, and it had regressed.** S-Project read 4.5 /
  min 1 at all four captures (`workSurface`: "datatable 20% of shell-main"). Craft wave 3
  (`2796da06`) had made its activity table as tall as its five rows to cure an empty grid band, and
  was integrated on its e2e lanes without a re-walk.
  - 7d4b69e8 (I-369): the table takes the room main leaves and holds up to twenty acts; a project
    with none keeps its empty state at its own height (J-010's picture unchanged).
  - Re-walked: 18 of 18, and the final re-look (`wf_35743067-b04`) is condition 3's record.
- **The final re-look's defects, for session 8's first craft wave** (the whole list, each with its
  law and a named fix, is `docs/handoff/session-7-artifacts/relook-final.json`). Four screens are at the
  bar but not demo-ready: drawings, register, levels, schedules. The ten demo-visible defects:
  - audit: at 1280 a folded row loses its `+k` count off the cell;
  - drawings: the model-space card is titled by its tallest text ("COLUMN SCHEDULE", no number);
  - viewer: the readout lost its mono face (2cad2aaa);
  - register: the Source chip leads with the layout name "Model" and cuts the view class;
  - register: the Bases cell says "Transcribed" twice;
  - register: the index tree opens every class, so the sections below it fall past the fold;
  - levels: three kinds overflow the roll-up columns at both widths;
  - schedules: the Band column prints a strip family's whole sheet title;
  - schedules: the sheet rail's name gives way with its holdings;
  - site facts: the pinned parameters carry two names on neighbouring screens.
- **Still recorded, not done:**
  - the BOQ as one item per description (the owner's call);
  - identical BBS members counted at the door;
  - "Bored" beside "Boring";
  - the settings frame's seam;
  - GROUND_LEVEL_UNSTATED's wording (a Deviation from L-MEA-06's sentence);
  - the status bar's viewer cells on non-canvas screens (a Direction deviation);
  - `m3` against `m³` (the core Decision says unit verbatim).

## 5. The gate, verbatim

The closing gate (gate 8), run alone on a warm machine: HEAD `7d4b69e8`, the final product tree, with
CLAUDE.md's standing facts and this close's documents uncommitted. The commit after it,
`03a1ff07`, changes two lines of test prose (the D-003 citations), proved by `pnpm vitest run
tests/journeys`: 13 files / 145 tests. Verify's own counts come from its log: unit 565 files /
3,806 tests, lint `✖ 158 problems (0 errors, 158 warnings)`, the cad lane's ruff "All checks
passed!". The sweep's longest journey was J-020 at 31.8 s, against the 90 s ceiling.

```
GATE verify: pnpm verify
LANE typegen 0.20s
cad: fixture regeneration skipped — its inputs digest fc28483ca5ae, the tree a green regeneration proved at 2026-09-22T14:43:02.124Z (node_modules/.cache/cubit/cad-regeneration.json; the golden lane still checks the committed corpus)
LANE catalogue-drift 0.03s
LANE method-hash 0.35s
LANE schema-drift 2.52s
LANE golden 3.36s
LANE types 8.49s
LANE lint 40.98s
LANE unit 47.08s
LANE cad 52.44s
LANE build 6.37s
verify wall-time 59.01s
GATE verify green 62.17s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/verify.log)
GATE checkup: pnpm checkup
checkup wall-time 0.36s
GATE checkup green 0.60s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/checkup.log)
GATE golden: pnpm test:golden
 Test Files  4 passed (4)
      Tests  16 passed (16)
104 passed in 1.44s
GATE golden green 2.13s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/golden.log)
GATE db: pnpm test:db
test:db: 2 passes — the batch, then each suite that rewrites tracked source alone
 Test Files  241 passed (241)
      Tests  1465 passed (1465)
 Test Files  1 passed (1)
      Tests  2 passed (2)
test:db wall-time 90.97s
GATE db green 95.71s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/db.log)
GATE e2e: pnpm e2e
  1 skipped
  53 passed (1.6m)
e2e (regression sweep, J-000 excluded) workers=4 wall-time 96.98s
GATE e2e green 101.85s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/e2e.log)
GATE e2e-j000: pnpm e2e --journeys J-000
  5 skipped
  12 passed (3.7m)
JOURNEY J-000 green workers=4
e2e J-000 workers=4 wall-time 224.95s
GATE e2e-j000 green 235.66s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/e2e-j000.log)
GATE perf: pnpm test:perf
  2 passed (18.3s)
e2e PERF- workers=4 wall-time 18.59s
GATE perf green 18.80s (log /home/riz/vextrus-cubit/node_modules/.cache/cubit/gate/perf.log)
GATE summary — verify: green 62.17s · checkup: green 0.60s · golden: green 2.13s · db: green 95.71s · e2e: green 101.85s · e2e-j000: green 235.66s · perf: green 18.80s
GATE wall-time 516.95s exit 0
```

**Every gate of the session**, each lane's own lines in the ledger:
- **Phase 0.2, the opening gate** (01:30): `GATE summary — verify: RED exit=1 55.67s · checkup: RED exit=1
  0.59s · golden: green 2.13s · db: green 90.97s · e2e: RED exit=1 36.90s · e2e-j000: RED exit=1 21.85s ·
  perf: RED exit=1 21.80s` — `GATE wall-time 229.92s exit 1`. Every red was the environment: the stale
  portproxy rules held 3210/3211 (EADDRINUSE), and a seam test assumed an instant ECONNREFUSED that
  mirrored networking does not give (`expected 'CONNECT_TIMEOUT' to be 'ECONNREFUSED'`). The same tree's
  served lanes were green on a port override: `GATE wall-time 278.19s exit 0`.
- **Gate 1**: `verify wall-time 70.52s` (`LANE unit 61.35s`), e2e-j000 red at `establishBnbc`'s set toggle →
  057e9e6c.
- **Gate 2**: verify 58.93 s; e2e-j000 RED at the set toggle, the lost click; `GATE wall-time 526.56s exit
  1` → c94b9dc7.
- **Gate 3** (c94b9dc7's working tree): every lane green, `GATE wall-time 527.30s exit 0`; verify 62.55 s,
  the build lane cold on storage/ → 36d16d6e.
- **Gate 4** (36d16d6e, the first after the reboot): every lane green, `GATE wall-time 517.67s exit 0`;
  verify 66.39 s on cold caches (two warm verifies after it: 56.53 s, 52.90 s).
- **Gate 5** (36d16d6e): every lane green, `GATE wall-time 509.76s exit 0`; verify 53.08 s.
- **Gate 6** (2846dcc7): db RED in members-live, the in-process drift window → 8a950e58; `GATE
  wall-time 499.98s exit 1`.
- **Gate 7** (8a950e58): every lane green, `GATE wall-time 509.81s exit 0`; verify 56.81 s.
- **Gate 8** (7d4b69e8), above: the closing gate.

## 6. Not done, and why

- **The bar-schedule leg** (condition 1). Column ties need the beam joint depth. The joint depth is in
  the store for a column whose framing beams are all placed. The 22 vertical beams per typical floor,
  CB1–4, LB1 and TG1 wait on FRM-3: TEXT rotation carried through the L-CAD-05 seam, which is an
  EntityGraph version bump that re-keys the corpora.
- **R0, the golden reconciliation.** About 78 cells are not reachable from the drawing as drawn: brick
  walls, lintels, tank walls and slabs, slab, wall and stair rebar, the unmarked footing F1, 42 of 47
  grade-beam spans unmarked, and slab on grade. About 15 disagree with it: slab 1F..6F 257.481 m³,
  shear wall 3F, cap excavation's EGL. The owner must choose a `baseline:` regeneration of the golden
  or Deviations re-scoping AM-01's exit.
  - The ledger's breadth map gives the groups, with examples and each group's total.
  - Its per-cell files (`scratchpad/breadth/result.json`, `rank.txt`) were lost with `/tmp` in the power
    cut.
  - The per-cell evidence survives in the run's journal:
    `~/.claude/projects/-home-riz-vextrus-cubit/bbdf46f0-385d-4fc3-97d1-873757ce4017/subagents/workflows/wf_d6a5de12-0ac/journal.jsonl`.
    It holds the five family mappers' `goldenAtStake` and the integrator's `honestReach`.
- **M4.** Not started beyond its four named doors.
- **C2**, the frame drawn in place, was reverted (artifacts in `docs/handoff/session-7-artifacts/`).
  The slots are safe now (c6980f0e), so it is no longer urgent.

## 7. What remains, ranked — the next session's backlog

1. **R0**: ask the owner, once, with the breadth map's per-cell evidence.
   - By the breadth map's `honestReach`, a faithful reader reaches about 69.4 % of RCC concrete without
     the ruling: beams, the slabs outside 1F..6F, the shear walls except 3F, and the stairs.
   - Everything past that compares against cells R0 rules on, and the ruling would lift the reach to
     about 91.5 %.
   - These are the map's estimates, not measurements.
2. **FRM-3, then R6 ties.** TEXT rotation through the L-CAD-05 seam (cad model.py, the TS mirror, an
   EntityGraph version bump), so a mark on its axis names its member. That places the vertical beams,
   CB, LB1 and TG1, which gives the column joint depth. Then derive the ties from BNBC 2020's clauses
   (vendored, 2f09d906; D-003 is reserved for that ruling) and release `m3-bar-schedule`.
3. **FRM-4.** Slab thickness per side (SLB-1 first), lift-core walls as supports (17 clears are over
   the golden until then), support faces per storey, slanted pairs (D13).
4. **The remaining M3 breadth** in the map's order: SLB-1, WLS-1/2, LEV-2 (SRR, roof stubs), COL-FW
   (column formwork, L-FRM-03 vs L-MEA-09).
5. **M4's four doors.**
6. **The debts:**
   - INSERT_LEVEL's carry should ask the resolver (I-366);
   - the row-count copying hook exists in five places;
   - the rebar placement label;
   - identical BBS members;
   - the cad lane's own wall, now verify's longest;
   - **I-368's owed arm.** An `@unregistered:<label>` placeholder still publishes, so a line measured
     on one before its level is authored would orphan the same way. Refusing it needs a durable
     disclosure first: the rails observing placeholders, or the gate recording the refusal as a rail
     observation.
   - **F-RCC6-BNBC campaigns measured from 788c1e8a up to 2846dcc7 keep their 50 orphan beam lines**
     (append-only): S-14's 25 typical beams × concrete and formwork, on `@UNRESOLVED` keys.
     - BNBC campaigns from before 788c1e8a placed no beams.
     - F-RCC6 campaigns author the typical range before Measure, so they hold no orphans.
     - The readers that SUM by campaign alone want one reader that joins the register:
       `register-ui/server.ts` and `boq/server.ts`, each with its own `linesOfCampaign`, which the
       register footer and the BOQ draft, PDF and XLSX sum.
     - `trace/index.ts` `linesCiting` also reads without the join (it drops only struck objects), but
       it lists lines rather than summing them.
   - **Unverified, from I-368's implementer.** On its synthetic plan, `runs.ts` `plateOf` took a grid
     bubble as the slab outline, and beams published COMPLETE b×D×clear with no soffit deduction.
     That may be an L-QTY-06 over-measure; check it on BNBC before FRM-4.
   - `settled()` reads no hydration, so every click after a full load is exposed to c94b9dc7's lost
     click. Only the set toggle waits for a client-only fact today.

### Standing, the owner's

Only the owner can do or decide each item below. Each was checked read-only at drafting (2026-09-23 15:46 +06, HEAD `7d4b69e8`).

**Carried from earlier sessions**

- **The TypeSafe key: ROTATED by the owner at session 7's close.** The value committed to history in session 1 (`.env.example`, `d4bc0da3` and `61a9632b`; the literal removed by `2249e8b3`) was, until then, the live key in `~/.bashrc`: an equality test by a drafter at 15:46, with nothing printed. The owner then reported: "I have rotated the typesafe API key at my bashrc file with a new one and I disabled the last one". The key in history is therefore disabled. Its objects still stand in history, in the power-cut backup and in the agent worktrees' shared object store; rewriting history is optional and the owner's call.
- **`ARCHITECTURE.dwg` refuses `HANDLES_NOT_UNIQUE`.** LibreDWG writes ten LWPOLYLINEs twice under one handle (`fable-5.1-session-2.md:28,129-130`). Session 6 carried it (`session-6.md:210`). The session-7 ledger never mentions it, and no session-7 commit touches the refusal (`git log -S HANDLES_NOT_UNIQUE 639f37d6..HEAD` is empty). The drawing is in the owner's reference set, which is never committed (`fable-5.1-session-5-prompt.md:77`). Whether it should be repaired is the owner's call. It was not re-run this session.
- **Nine migrations sit on the branch's base, and the integration script can only refuse them.** The branch adds `0053`–`0061` against main `8cf9f11f` (`git diff --diff-filter=A main...HEAD -- db/migrations`; main is untouched and 166 commits behind HEAD).
  - `scripts/db-regenerate-migration.mjs:67` exits with `db:regenerate-migration FAIL — this branch added 9 migrations (…) — a branch carries at most ONE migration generated on its base`. It does this before it deletes anything: line 67 comes before the `rmSync` at line 69.
  - So session 6's line "the integrator regenerates one from the combined schema" (`session-6.md:211-212`) is not something this script does for this branch.
  - Three of the nine hold hand-written `INSERT`s: `ruleset_editions` in `0056:66` and `0061:31`, and `bears` in `0060:27`. Seven hold policy or grant lines, and no schema file declares a `pgPolicy` (grep of `src/core/db`). A `drizzle-kit generate` from `db/schema.ts` would not be expected to emit any of these. That is a prediction; it was not tried.
  - The owner or the integrator decides: land the chain renumbered onto main's head, or squash it by hand.

**New this session**

- **The `.git` backup at `~/vextrus-cubit-git-backup-20260923-poweroff`** (124 MB, outside the repo). It is the `.git` as the power cut left it, copied before the repair (ledger "A power cut", 1037). The repaired repo reads `git fsck --full --no-dangling` clean (ledger 1049). The owner may delete the backup. It also holds the committed key.
- **`C:\Users\riz\.wslconfig`: one comment was edited, no setting changed.** Lines 16–25 now explain mirrored mode: keep `netsh interface portproxy show all` empty, and an unbound `127.0.0.1` hangs while `127.0.0.2` refuses. The file's mtime is 2026-09-23 02:51:50 +06 (ledger 122-124, 199-201). `networkingMode=mirrored` itself was the owner's own change (ledger 37-40). The file is his.
- **vextrus-builder's scheduled task "WSL localhost sync" is DISABLED.**
  - `schtasks.exe /Query` reads `Status: Disabled`, and `netsh interface portproxy show all` is empty (both read at drafting).
  - The task is `scripts/windows/wsl-localhost-install.ps1` in vextrus-builder. It re-adds the NAT-era rules elevated at every logon, and under mirrored networking those rules take 3210, 3211 and 47390 from WSL (ledger 43-50, 1052-1056).
  - `schtasks /Change /TN "WSL localhost sync" /ENABLE` reverses it. Doing so brings the `EADDRINUSE` back while mirrored stands.
- **R0, the golden reconciliation. It has never been asked** (`session-7.md` §6, §7 item 1).
  - From the breadth map (`wf_d6a5de12-0ac`, ledger 509-515):
    - About 78 cells cannot be reached from the drawing as drawn. They hold 101.093 m³ of RCC concrete.
    - About 15 cells disagree with the drawing: slab 1F..6F 257.481 m³; SW 3F; cap excavation's EGL, −152.4 in the golden against the drawing's −1'-6" (−457.2); the CS1 and CB tapers; the S-20 ducts; SW 200 "ABOVE 4F"; LB1 rebar one level up.
    - A faithful reader reaches about 100 cells (69.4 % of RCC concrete) without a ruling and about 91.5 % with one.
  - The R6 critic's golden corrections join the same question (`wf_96743886-20c`, ledger 584-591):
    - **GC-1, the FDN neck's ties.** 609.6 mm is one run of 7 ties, not 16–20: **−295 kg**. The generator contradicts its own member length. The BNBC research agent put the same over-count at ≈ 371 kg, 6.1 % of column ties (ledger 321). The two figures disagree and should be settled before the owner sees them.
    - **GC-2, C4's cross-ties.** S-12 draws one hoop. On the design's own band reading only FDN–2F is carried by the drawing. **3F–ROOF is 554.96 kg** and must rest on a RECORDED reading of S-12.
    - **GC-3, C7 circular hoops.** The drawing says TIES, and the committed spiral fails the code four ways. The hoop is formula (iii), **πA + 2C − 2(0.5r + d) = 1322.39 mm**, the only form AM-03(d) admits.
    - **GC-4, the joint depth.** The joint is the deepest drawn framing member, and only where **D > 450**. This raises the golden.
    - Named tuning risk: the joint spacing reading (**265.804 kg**) is a ruling, not a copy of `model.py`.
  - The designer reproduced the corrected golden in 42/42 cells when D comes from the drawn framing.
  - The owner's choice is either a `baseline:` regeneration of the golden or Deviations that re-scope AM-01's exit.
  - **The per-cell evidence may be lost.** The full outputs were written to scratch: `scratchpad/breadth/result.json` and `scratchpad/r6/result.json` (ledger 498, 575). Neither was found on disk at drafting (`find / -path '*scratchpad/breadth/result.json'` returned nothing). `/tmp` was wiped at the power cut (ledger 1031). The ledger keeps only the summaries above, so the question may need workflow `c` re-run (`docs/handoff/workflows/session-7/c-m3-breadth-map-and-rank.js.txt`).
- **The code-compliance findings.**
  - The ledger records two findings: the drawing's C1–C6 sections fail §8.1.9.4(c), and its spacings fail SMF (ledger 596-597). Telling the drawing's designer is the owner's call.
  - **The ruling to record them "in DECISIONS.md, not billed" was the orchestrator's, not the owner's.** It is item (4) under "My rulings (law, not taste)" (ledger 593).
  - **It was not carried out.** The only `DECISIONS.md` outside `node_modules` and `.claude/worktrees` is `fixtures/gen/rcc6_bnbc/DECISIONS.md`, the generator's. Its last commit is `36f00aa8` of 2026-09-21, and it holds no §8.1.9.4 or SMF text. `docs/reference/bnbc-2020/README.md:43` names §8.1.9.4 only as a clause index.
  - The ledger states the SMF count two ways: "16 of 17 bands" (320) and "17 of 19 bands" (597). That needs settling first.
- **The BOQ as one item per description.** Today the bill prints "twenty-six numbered items for one description — a member per line, where a bill states one item per description with its total". The design records this as "a bill-shape question for the owner (numbering and emission, I-269)" (`docs/design/s-boq.md:186-190`; `session-7.md:218`; ledger 924).
- **Bible amendments are the owner's alone.**
  - The AS-05 proposal is "kept for the owner's amendment" (`docs/decisions/as-05-jev-amendment.md:10`).
  - Pinning `jev-1.13.0` instead of `jev-latest` is "the owner's option once thresholds are tuned" (`deviations.md:124`).
  - D-001 and D-002 may be folded into the Bible by its owner (`deviations.md:16`).
- **Harness and leftovers.**
  - `skillOverrides["code-review"] = "off"` in `~/.claude/settings.json` keeps `/code-review ultra` unavailable until the owner lifts it (ledger 18).
  - 30 agent worktrees stand under `.claude/worktrees/`: 2.8 GB, each with its own branch (`git worktree list`). `.claude/**` is locked to every session, so pruning them is the owner's.
  - An untracked `cov.html` appeared in the repo root during wave 2 and was not the orchestrator's (ledger 655). It is still untracked (`git status`).

**The owner's rulings of this session, and whether each was carried out**

| Ruling (source) | Carried? |
|---|---|
| Mid-turn, not asked through AskUserQuestion: "take the best option for us that will balance WSL2 and windows always" (ledger 100) | **Yes.** Mirrored networking kept; the six stale rules deleted; the `.wslconfig` comment corrected; `9332c203` toolchain(ports). |
| 0.6(1) Bar schedule: derive ties from the cited code under a recorded Deviation; the leg compares whole members (ledger 210-212) | **No.** The orchestrator's later R6 ruling holds column ties DECLARED until the joint depth is read. It cites L-QTY-04 (known scope, not measured, is a declared exclusion) and the critic's L-QTY-06 objection to whole-member netting (ledger 580-583, 593-599). The owner was not re-asked. D-003 is reserved and not written: `deviations.md` holds D-001 and D-002 only. `m3-bar-schedule.spec.ts:91` stands `test.fixme`. |
| 0.6(2) Scope: M3 breadth first, after the legs, gate, craft and demo; M4 on named MISSING DOORs only (ledger 213-214) | **Yes.** `9bbc2598`, `da18f37c`, `f99cdb97`, `788c1e8a`, `70b899ba`; M4 in `314b90b3`. |
| 0.6(3) Live Jev: re-record, "use Live Jev most of the time", load `typesafe-ai` (ledger 215-218) | **Partly.** One live recording (`e78849a5`: 241 fixtures, 357,430 in / 18,603 out = 0.01501206 USD, plus 0.007998102 USD of measurements) and the skill loaded (ledger 268). The lanes replay fixtures by L-AI-01. The live findings were "recorded, not built" (ledger 445). |
| 0.6(4) Demo on the owner's screen: 127.0.0.1, its own port, no LAN (ledger 219) | **Yes.** `361bc64a`; `docs/demo.md:3-5`; port 3213; proved from Windows (ledger 1207-1212). |
| Second ruling, the code source: "Fetch BNBC 2020 publicly"; ACI 318-19 not vendored (ledger 263-266) | **Yes.** `2f09d906`, `docs/reference/bnbc-2020/`, gazette sha256 `b4a1efbc…6dd0` (ledger 312-317). |
| Power-cut repair: rebuild commit `c94b9dc7`, a write the classifier had denied (ledger 1047-1048) | **Yes.** Hash matched at 1790141198; `fsck` clean (ledger 1044-1049). |
| Port rules after the cut: delete the rules again and disable the task (ledger 1054) | **Yes.** Verified at drafting as above. |

### Carried from session 6, and the ledger's own debts

**Session 6's §6 and §7, item by item** (`session-6.md:143-216`)

- **§7.1, the register ignores the notes: CLOSED** by `929a37c2` (AUTHOR_TYPICAL_RANGE through the one resolver; I-309) and `8e589aa5` (residue on retired keys).
  - Read back at 182 lines / 90.834 m³ (ledger 453-456).
  - The exact sum is 90.83328779985339 m³, equal to `model.json`'s unrounded golden (ledger 490-492).
- **§7.2, release the BOQ leg: CLOSED** by `689b5d76`.
  - The BBS test moved whole to `m3-bar-schedule.spec.ts`, and the bill file holds no `MISSING DOOR:` (grep).
  - The proposed `(n + 1) × ½ulp` slack was **not** given. The critic showed it breaks the arbitrated band rule (ledger 185-192). Instead D-001 (`96478d43`, `84e891a3`) read GF at 3.3528, and every storey now passes on the golden's half-unit alone (ledger 490-492). "1.37" no longer appears in the M3 specs.
- **§7.3, assert what the band cannot see: CLOSED.**
  - `689b5d76` names the declared cells; ROOF is asserted by name at `m3-bill-and-schedules.spec.ts:88,311`.
  - `f99cdb97` measures FDN, and the leg now COMPARES it (TEST_AMENDED, spec line 82).
- **§7.4, the rebar schedule reader: RE-NAMED, and the door stands.**
  - S-11 is read. The real blocker was `REBAR_STOREY_RUN_UNSTATED ×189` (ledger 177-184), cleared by `20067339` (R1, I-307).
  - The leg now stands on the ties (`m3-bar-schedule.spec.ts:4,91`) and the preconditions listed below.
- **§7.5, the gate green and the craft table walked: CLOSED.** Gate 8, the closing gate on `7d4b69e8`, is quoted in §5. 18 of 18 screens are at the bar on the final tree (§0 condition 3).
- **§7.6, the frame's effect-handover slots: PARTLY.**
  - `c6980f0e` made the slots owner-held claims.
  - C2, the regions drawn in place, went red in the product and was reverted (ledger 657-668). Its artifacts are kept, and `session-7.md` §6 carries it.
  - `useShellPage(` is called in 16 files (`grep -l`).
- **§7.7, the viewer on a 100k-entity sheet: PARTLY.**
  - PERF-011 is green at the size a reader sees (`c0011b26`).
  - **ELECTRICAL.dwg crashing the tab under SwiftShader STANDS.** No session-7 commit message or ledger line names it, and it was not re-measured. The 41 / 80 ms medians for PLUMBING and the Structural drawing were not re-measured either.
- **§7.8, the model ledger's rates: CLOSED** by `e78849a5`: $5/$25, $2/$10, and Jev $0.042/$0 (`model-ledger.types.ts:46-48`); `jev-latest` pinned (0057). **`claude-opus-5-5` STANDS unpinned:** `MODEL_IDS` is `["claude-opus-5", "claude-sonnet-5", "jev-latest"]` (`model-ledger.types.ts:16`).
- **§7.9, a demo from Windows without a relay: CLOSED** by the owner's mirrored switch plus `361bc64a`. **Not done: "seeded demo data".** The demo serves the newest J-000 project from `cubit_e2e`, so a J-000 run must come first (`docs/demo.md:3,10,22,37`).
- **P2, Jev's five unwired passes: STAND.**
  - The only session-7 commit under `src/modules/ai` or `src/modules/takeoff/notes` is `e78849a5`, the pin.
  - `runNoteClausePass` has no caller outside its barrel (`notes/index.ts:18`).
  - `understandSheet` has no caller outside `sheet-understanding/index.ts:64`.
  - `proposalGoverns` does not exist in `src`.
  - The corpus re-record with bodies is CLOSED (`e78849a5`).
- **P3, the debts: most STAND.**
  - `SEED_VERSION` in four places: **CLOSED** by `f99cdb97`. All four now import `tests/rulesets/support/editions.ts:73`.
  - `CONTROL_CODES` twice: stands (`entitygraph/notation.ts:17`, `notation/grammar.ts:70`).
  - **`NAMED_LEVELS` twice and still disagreeing:** `grammar.ts:187-191` maps `FOOTING: "FDN"` and `notation/index.ts:392-405` does not.
  - `STOREY_WORDS` twice: stands (`index.ts:389`, `grammar.ts:199`). Its own comment says "nothing yet tests that they agree (recorded debt, B-17)" (`grammar.ts:196-198`).
  - The one-word `STARTS` roster: stands (`placement/law.ts:288`).
  - The uncited note key: stands. Only `measure/setup.ts:284` carries `noteKey`, and no rail reads it.
  - I-310: stands. It is cited at `j-032-schedules-notes.spec.ts:324` (was 319) and defined nowhere; the ledger says "never minted" (229).
  - `register-workspace` resolving twice: stands. C2's probe found the frame's context is not the cause (ledger 644-645).
- **Session 6's "Standing, the owner's"** is re-stated above with this session's figures. **M4** stands on four named doors (`314b90b3`) and has not started.

**The ledger's debts that `session-7.md` §4 and §7 do not list**

- **The outbox flake, `tests/auth/outbox-reader.test.ts:62`.** It asserts `expect(Date.now() - at).toBeLessThan(2)`: a wall-clock bound that fails under load and was 3/3 green alone. The ledger says "recorded to fix" (729-731). The file has not changed since `b94122bd`.
- **I-309's two IOUs** (`docs/design/s-levels.md:84-95`; ledger 353, 388-390):
  - The surplus declaration: `STOREY_PLAN_DRAWS_FEWER`, an `expansion_yields` store (a migration), and a residue reader. None of the three exists in `src` or `db` (grep). Until then a surplus falls back to the pre-ruling grid rule.
  - The cross-DRAWING gap: the resolver resolves one drawing at a time.
- **Two feet-and-inches parsers disagree on a sign.** `parseFeetInches` (`notation/index.ts:97`) refuses a leading sign and reads `-6"` as six inches; `feetInchesMm` (`grammar.ts:279`) reads the sign. `tests/takeoff/partition/notation/feet-inches-readers.test.ts` pins only where the two agree (ledger 376-377).
- **The tree primitive is not windowed.** `src/ui/primitives/data/tree.tsx` has no windowing (grep); CR-A called it "larger than a slice" (ledger 724).
- **Sign-in has no return path.** The owner must open the address again (ledger 697-698). There is no `returnTo`, `redirectTo` or `callbackUrl` under `src/app/(auth)` (grep).
- **The bar-schedule leg's preconditions besides the ties:**
  - **N1, class-scoped notes.** "f'c = 3000 psi (BORED PILES)" is read project-wide, so FC is SUSPENDED for columns (ledger 183-184, 292-296). The fix is `notes_readings.scope_class`, a migration. No `scope_class` exists in `src` or `db` (grep).
  - **R2/I-308, the stated lap outside the grade contest.** It needs `rcc.rebar.synthesis@2` (today `"version": "1"`, `rebar.methods.json:22-23`), a new edition and a migration (ledger 279-283). I-308 is recorded in no Design Decision (grep of `docs/design`).
  - **Editions do not choose the synthesis code.** `bars.ts` imports the synthesis functions directly and never dispatches on the pinned edition, so after a bump the older campaigns would run @2's code. @1 must stay beside @2 (ledger 288-291).
  - **R6-U, tie spacings in the declared unit.** `bars.ts:384` keeps only zones whose `spacingUnit === MM` (ledger 603).
- **The disclosure gap for classes the product does not place.** "A class the product does not PLACE is disclosed on NO product surface … That is a gap in the product's disclosure, recorded here, not a licence" (`m3-bill-and-schedules.spec.ts:25-28`; the critic, ledger 193-195).
- **The bar-schedule door cites the wrong Deviation.** `m3-bar-schedule.spec.ts:4` names "(R6, D-002)", but D-002 is Jev (`deviations.md:95`) and the ties Deviation is reserved as D-003 (ledger 595). The line also says the ties are derived "per the owner's session-7 ruling", which the R6 ruling above holds back.
- **I-306 was allocated and never written.** It says L-MEA-09 governs vertical formwork (ledger 206, 228), and it appears nowhere in `docs/design` (grep). `session-7.md` §7 item 4 carries only the substance (COL-FW).
- **drift-lane-breaker still rewrites tracked source** (`db/__tests__/drift-lane-breaker.test.ts:32`). `8a950e58` contains it by ordering (`scripts/lib/db-passes.mjs:18,49`). The durable fix is owed: the breaker mutates a COPY, which needs `scripts/db-drift.mjs` to take a schema root. Today the root is fixed from `INPUT_ROOTS` (`db-drift.mjs:23`; ledger 1171-1174).
- **Two band shapes stand in the tree:** foundations, masonry and rebar floor at 0.97·printed; the arbitrated slab band is 0.97·G − a. They were "reported, not changed" (ledger 536-537).
- **Why the passive claim batch parked under 6× CPU is "not known"** (ledger 850). The equal-state IOU on the same line is closed: `data-table.tsx:464` keeps an equal remembered state (`98194855`, ledger 847-848). The ledger's line 850 is stale on that point.
- **Jev's live findings, "recorded, not built"** (ledger 427-445):
  - view-caption: confidence does not separate right from wrong (0.613 vs 0.703), and "PILE SET-OUT TABLE → LAYOUT_PLAN" is dangerous if confirmed;
  - schedule-cell: ask per attribute;
  - note-clause: the `lap_governs` criterion;
  - boq-line: compute the pit depth in code;
  - outline-corroboration: the checks move to code;
  - coverage-cause: no positive case in the corpus.
  - Also, the demo's replay refused 3 of 10 calls MALFORMED (ledger 1212), and the ledger records no cause.
- **One server log line, not chased:** `⨯ Error: The destination stream closed early` (digest 3453181992) during M1's viewer leg (ledger 492-494).
- **Craft deferrals missing from `session-7.md` §4:**
  - the schedules "wall of links" (ledger 734-735);
  - the schedules section split (ledger 924);
  - three polish IOUs (ledger 824-828): site facts' Derived chip shifts fact names 80 px; "500 MPa MPa"; the rule-set checkpoint captures a hovered row. No session-7 commit message names a fix for any of them. Levels "1 lines" is CLOSED (`04b32acb`).
- **A Windows-side TIME_WAIT on 127.0.0.1:3211 held the next bind** for about 20 s (ledger 829-831). The gate refuses a held port and does not wait for it (`scripts/gate.mjs:150-159`).

## 8. Reproducing each proof

- The gate: `pnpm gate` (logs under `node_modules/.cache/cubit/gate/`).
- J-000's figures: `pnpm e2e:clean && pnpm e2e --journeys J-000`, then read `cubit_e2e` scoped to the
  newest run file's `bnbc.projectId`. The perf lane deletes the run files, so after a gate find the
  project by name, newest first. `docs/handoff/session-7-readback.sql` holds the query:
  `psql "$URL" -v pid=<project> -f docs/handoff/session-7-readback.sql`, with `cubit.system_reason`
  set inside it.
- The craft table: `pnpm probe:server`, then `PROBE_SHEET="S-10 COLUMN LAYOUT PLAN" bash
  scripts/probe/craft-walk.sh test-results/j-000-golden-run.dark.w<N>.json <out> bnbc`, with a run
  file whose BNBC project holds a document.
- The demo: `pnpm demo` (docs/demo.md); `pnpm demo --stop`.
- The session's central db-lane proofs, each through the product's doors:
  - the typical-range act through the one resolver (929a37c2):
    `pnpm test:db tests/takeoff/partition/placement/typical-range-noted.test.ts`;
  - I-368, no line on the UNRESOLVED slot:
    `pnpm test:db tests/takeoff/coverage/placeholder-lines.test.ts`. Its teeth: with 36d16d6e's
    `src/core/gate/evaluate.ts`, three cases are red.
- Jev's corpus, re-recorded live with the owner's key (never printed): `node --import tsx
  scripts/model-corpus.ts record --question <question> [--drawing <path.dxf>] --out <dir>` (the
  script's header lists every question). The lanes only replay what it records.

## 9. How the session was orchestrated

- **One orchestrator on Opus 5.5 with Opus 5.5 workers.** Fourteen workflows, their scripts in
  `docs/handoff/workflows/session-7/` (`a`..`n`), each run named in the ledger:
  - `a` map and refute (`wf_9b624fed-fb5`); `b` the ties design and critic (`wf_96743886-20c`); `c` the M3-breadth map
    (`wf_d6a5de12-0ac`); `d` the craft LOOK (`wf_017ab585-9bc`); `e` craft wave 2 (`wf_fa3a0de5-33c`); `f` the re-look
    (`wf_d92183cc-5d3`); `g` craft wave 3 (`wf_d95baa34-4c1`); `h` the final wave (`wf_a73c0953-355`);
  - at the close: `i` the fact-check of these documents (`wf_89d8471a-1a1`, 47 agents: 547 claims
    checked, 24 corrections upheld and applied, 16 overturned); `j` the orphan-lines diagnosis
    (`wf_866d9027-c14`, 6 agents); `k` its fix with two adversarial reviews (`wf_03d79ecf-8e3`, 3
    agents); `l` the final re-look (`wf_35743067-b04`, 6 vision reviewers); `m` the drafts of the law,
    the owner's standing and the prompt's missing sections (`wf_23b20281-215`, 3 agents, each draft
    checked before it was used); `n` a second fact-check over the sections written after `i`
    (`wf_8473d582-26a`), STOPPED at the owner's word before it reported, so those sections carry no
    second check.
- **Single background agents, most in worktrees**, for the slices a workflow did not hold: T0, A1/A2,
  R1/R2, A3 and A3b, A4/A5, J, the BNBC 2020 research, CR-A, CR-B, D0, FND-1/2, the foundations
  stretch, FRM, PERF, T-MH, C1 and C2. Each one's return is in the ledger.
- **Every slice was integrated by me.** Patches were applied with `git apply --3way` (it STAGES:
  unstage before committing), conflicts resolved, and every lane run by shell. Every moved picture was
  looked at before `pnpm e2e:retake -- --write`. Every door was read back from the journey's own
  database. The exception was the P0 door, A1 (929a37c2), committed with A2 (8e589aa5) at 03:38 on the
  unit, db and golden lanes; the journey's database proved it in the J-000 run of 03:39–03:45.
- **What paid most:**
  - read-backs caught what the lanes missed: the 1F beams registered twice, and 50 orphan beam lines;
  - looking at the pictures caught what the scores missed: 34 demo-visible defects at 18 of 18;
  - re-walking the final tree caught a screen a craft wave had pushed below the bar;
  - the honest perf proof exposed a speck-sized green;
  - the close's fact-check caught 24 claims its author had written wrong.
- **What cost:**
  - C2 was green in jsdom and red in the journeys, and was reverted;
  - one `git apply --3way` swept 152 staged files into a lint commit;
  - parallel implementers collided on Interpretation ids twice, and I-306, I-308, I-310, I-312 and
    I-329 are the law's gaps;
  - craft wave 3 landed without a re-walk and cost S-Project its work surface;
  - one command reached `powershell.exe`, which this project denies (it ran only `exit`; recorded in
    the ledger);
  - the power cut, below.
- **A power cut, near the close,** emptied the seven loose objects of the newest commit (c94b9dc7)
  and wiped `/tmp` (the scratchpad's drafts).
  - The blob and trees were rewritten from the intact index and worktree, byte-identical.
  - The commit object was rebuilt from `COMMIT_EDITMSG` at the second its hash names (11:26:38 +06),
    on the owner's approval.
  - The zeroed reflog tails were rewritten with the missing 333-byte entry (97d176a8 → c94b9dc7).
    That is exactly the HEAD log's NUL run; the branch log's tail was a 38-byte NUL run, the file cut
    at 53,248 = 13 × 4,096.
  - `git fsck --full` is clean. The `.git` as the cut left it is kept at
    `~/vextrus-cubit-git-backup-20260923-poweroff`, outside the repo.
