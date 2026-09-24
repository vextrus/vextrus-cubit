# Deviations from the Bible

**Authority.** The owner's ruling of session 6 (2026-09-23), carried into `CLAUDE.md` § Law: *the
Bible is a default, not a cage.* Where testing, measurement or research shows a clause of
`docs/specs/cubit.bible.xml` wrong, stale, self-contradictory or harmful to the product, a session
departs from it — and records the departure here, in the same commit as the code that departs.

This file is the one home for those departures. It is not an Interpretation register (an
Interpretation takes the most defensible reading OF a clause and lives in the Design Decision that
applies it); a Deviation says the product does something OTHER than what a clause says, and why.

## The rules

1. **Never silent.** A departure with no row here is a defect, exactly as an unrecorded deviation from
   a Design Decision is (`CLAUDE.md` § Law, the screens bullet). The row and the code land together.
2. **Never an edit to the Bible.** `docs/specs/**` stays locked. The Bible's owner may later fold a
   Deviation into an amendment; until then this row is the current law for the clause it names.
3. **Evidence, not taste.** Every row cites a measurement, a failing or passing test, a fixture, a
   published document, or a customer-visible defect. "It reads better" is not evidence.
4. **Never to pass a gate.** A Deviation may change what the product does; it may never loosen a proof,
   a golden band, a ratchet, a budget or a refusal so that a red lane turns green. A lane that is red
   because the clause is wrong is fixed by departing from the clause AND proving the new behaviour.
5. **Numbered once.** D-001, D-002, … in order; a number is never reused, and a withdrawn Deviation
   stays in the table marked WITHDRAWN with the commit that withdrew it.

## The format

Each Deviation is one row in the table below, and a section beneath it when the evidence needs room:

- **Id** — `D-NNN`.
- **Clause** — the Bible id(s) departed from, quoted in the fewest words that fix it.
- **Evidence** — what showed the clause wrong: file:line, a lane's own verdict line, a measured figure.
- **What the product does instead** — stated as law, the way the clause would have been.
- **Cost** — what is given up, what a reader of the Bible will now find different, what else moves.
- **Commit** — the commit that landed it.

## Register

| Id | Clause | Evidence | What the product does instead | Cost | Commit |
|---|---|---|---|---|---|
| D-001 | L-MEA-07: storey-height readings — "agreeing readings corroborate, disagreeing readings suspend … equality is on canonical metres" | T-NOT-LEVEL (traps.json, S-25 1D90): "levels in both notations resolve to one level stack"; S-25 states 1F as `1F EL +3.353` (1D4C) and `EL +11'-0"` (1D92), 3352.8 mm apart; model.json GF 3352.8; under equality GF would SUSPEND, and on the metric print alone GF column concrete is 16.828852 m³ against the golden's 16.828 — a hard block | A storey is read once PER NOTATION; two PRINTS (TRANSCRIBED, cited, value and unit as written) in DIFFERENT notations agree when the exact one, rounded half-even to the decimal print's written places, equals it; every pair must agree; the finest reading is carried and the rails bind it | A cross-notation disagreement smaller than the decimal print's half-unit is invisible; where the metric figure was the design, the imperial conversion is carried | the commit that adds this row (see §D-001) |
| D-002 | AS-05: "Model ids used in production are `claude-opus-5` for reading/proposals and `claude-sonnet-5` for cheap classification" | All eight closed questions are answered only by TypeSafe Jev (the Claude path answers none: `propose` refuses a Messages content array MALFORMED, `src/core/model/proposal.ts:80-89`); all 240 prior fixtures were answered by `jev-1.13.0` yet billed under a Claude id at the tree's wrong Claude rates — 3.572892 USD against 0.01498665 at Jev's documented rate (docs.typesafe.ai/models, read 2026-09-23) | `MODEL_IDS` = claude-opus-5, claude-sonnet-5, **jev-latest**; one `JEV_MODEL` pinned UNCONDITIONALLY by the eight questions (the id is hashed into every request); rates 5/25, 2/10, 0.042/0 USD per MTok; 0057 re-closes the ledger's CHECK; the corpus re-recorded live with provider bodies | The Bible names two ids, the ledger holds three; every request hash moved (240 fixtures retired, 241 recorded); `jev-latest` moves when TypeSafe ships, so answers can change with no change here (the answering version is recorded per call) | the commit that adds this row (see §D-002) |
| D-003 | L-FRM-05: "closed link … zones each `⌊dist/spacing⌋ + 1`" with no zone distance stated anywhere (the registry states a spacing, never a zone length); L-QTY-04: "Known scope, not measured → declared exclusion + queue item" | Every one of J-000's 208 column rebar lines is PARTIAL_DECLARED `ties: REBAR_TIE_ZONE_UNSTATED` (session 8's ties map, project fe67f2bc): S-11 states `10Ø@100/150 (TIES)` and no zone length, so no column's ties are billed at all; BNBC 2020 §8.3.10.5(a) and §6.4.9.2 state the zones; the rule reproduces the corrected golden's `bars_per_unit` on all 208 rectangular members where the joint is read whole (`column-ties-derived.test.ts`) | A column's ties are DERIVED under `rcc.rebar.synthesis@2`: end zones ℓo = max(largest side, clear/6, 450), the joint zone the deepest framing (never under 450), the middle at the second spacing, one run where the clear height fits the two end zones; where the placed framing only BOUNDS the joint, the count is the exact minimum over every depth the bound leaves open, published COMPLETE with `REBAR_TIE_JOINT_BOUNDED` beside the line; where nothing read bounds it, the ties are omitted `REBAR_TIE_JOINT_UNREAD` (the owner's A′) | A bounded column's ties stand up to 7.14 % under the golden's count on a COMPLETE line (C3 at 3F–5F; 34 cells GF–6F whole-member within −2.42 % before FRM-3), said only by the observation; the zone lengths are the code's, not the drawing's; C6, the FDN necks and the roof stubs bill no ties until their framing is read | the commit that adds this row (see §D-003) |
| D-004 | The stack element's version pins (`cubit.bible.xml:285-308`; AM-08 PART 1): TypeScript "5.9.3 exact", pnpm "10.x", TanStack Table "8.x", Vitest "4.x" | TypeScript 7 (native) type-checks the tree in 2.3 s against 14.8 s; Next 16.3.1 carried three critical advisories fixed in 16.3.3 and 16.3.6; typescript-eslint refuses TypeScript ≥ 7 | The toolchain moves to its current stable majors, TypeScript 7 beside a TypeScript 6 API alias; pg-boss holds at 10.4.2 and Playwright at 1.62.1 | Two TypeScript compilers read the tree; a Bible reader finds older versions | 18b689ab, 70d67aa7 |
| D-005 | L-FRM-04: "Blinding (CC) count × (L + 2p) × (B + 2p) × t; deferred for polygon plans" | S-08's slab on grade (POLYLINE 81D) is a pentagon with a 45° chamfer the projected rectangle cannot express, and the drawn blinding rectangle beside it (824–827) does not follow the chamfer; session 9's refuter rejected I-388's reading (s-measure §11): the clause defers polygon plans outright and names no hand/machine split | A hand measurement of blinding is `pcc.blinding.area@1` = `count × (A_traced − Σ openings − Σ junctions) × t` over a traced outline (the member's own, or a drawn outline that follows it), with no projection p | Blinding has two spellings, each its own rule id; a traced blinding is under the clause's figure by the projection strip (never over); the edition's `blindingProjection` is not applied to it | the commit that adds this row (see §D-005) |
| D-006 | R-UI-040: "level-of-detail hides text below legibility" | Walk 0 (BLOCKS_DEMO): S-10 opened with no caption, no marks and an empty title block, where `drawing_render` letters them at the same size; measured on the true-size mipmapped glyphs, a capital is read from about 3 px (viewer.md I-463), and S-10's marks stand 2.6 px at fit | A drawing's own text is lettered down to a 2 px cap height (`LETTERED_TEXT_PX`), at its true size, and hidden only below that; nothing is drawn larger than the drawing states, and nothing is drawn as a bar | Text between 2 and 3 px is drawn and not readable; the lettering's fill at rest grows with it; every sheet's at-rest picture moves | the commit that adds this row (see §D-006) |
| D-007 | L-REG-03: "discipline is drawing-scoped, machine-proposed, human-confirmed, fails closed: an unconfirmed drawing is not walked" | The structural readers have registered their placements under STRUCTURAL at every re-expansion since M2, confirmed or not: eleven db suites and the M2 and J-021 journeys pin a set before confirming any sheet, and J-000's F-RCC6 leg confirms only the first group offered; closing the rule over them moves every one | The wall lane's rows (a brick wall, an opening) are walked only under the discipline a person confirmed for their sheet, and not at all before (s-takeoff I-592); the structural readers' rows keep the placement law's STRUCTURAL | A structural member drawn on a sheet nobody has confirmed is measured under STRUCTURAL before a person confirms it; and a structural mark an architect's sheet places is sighted STRUCTURAL whatever the sheet was confirmed as — two keys where the engineer's set draws it too. That path stood before this increment and stays open until the structural rows take their sheet; neither fixture draws one (F-ARCH's plans place no structural member) | the commit that adds this row (see §D-007) |
| D-009 | F-RCC6-BNBC (`cubit.bible.xml:723`): "brick walls 250 (perimeter) and 125 (partitions) at 1F–6F with the S-25 lintel schedule"; AM-07: F-RCC6-BNBC's "golden already has BRICKWORK rows by nominal thickness" | BNBC's lump billed 259.425 m³ at 1F..6F from one perimeter and a 60 m partition allowance per floor: it ran through about 18 columns, omitted the grid-A facade and gave 1F the GF height; F-ARCH (ARCH-1) draws the same building's walls wall by wall at GF..6F and bills 538.041 m³ over R0's structure, S-25's lintels deducted — two figures for one quantity in two goldens (B-17) | Brick walls are the architect's members: F-ARCH's golden is brickwork's one home (`goldenRows("arch")`); BNBC mints no BRICK_WALL member and bills no BRICKWORK, keeps its LINTEL rows unchanged, and S-25 still prints the BW250/BW125 wall types; the M3 masonry sample is the pair BNBC + F-ARCH | The M3 brickwork cells need F-ARCH uploaded beside BNBC (J-000 uploads two drawings); a Bible reader finds BRICKWORK absent from BNBC's golden; BNBC's golden loses 12 rows (370 → 358) at R0's baseline | the commit that adds this row (see §D-009) |
| D-010 | C-12: "this tree never gains a script that invokes a model (scope-fence)" | L-AI-01 and Q-08 require a recorded corpus composed by the product's own request builders, and the owner's Q4 ruling (session 8) has Jev route Ask's paraphrases "recorded fixtures in the lanes"; `scripts/model-corpus.ts` has recorded every one of the 368 fixtures in `fixtures/model/` this way since session 7, the ask-route corpus's 60 among them (0.003762738 USD spent recording it); C-12's own subject is the Builder and Claude (its name: "Nothing here runs Claude") | The tree carries ONE script that invokes a model — `scripts/model-corpus.ts record`, run by a person on purpose and by no lane, through the seam's one recording door (`recordFixture`), pinned to `jev-latest`, never printing the key — and the harness's `jev_ask` prototype door; no script invokes Claude | A Bible reader finds a model-invoking script C-12 says the tree never gains; its spend is a person's, ledgered per fixture in `corpus.json` | the commit that adds this row (see §D-010) |

## D-001 — a storey stated in two notations is one storey (session 7, 2026-09-23)

**Clause.** L-MEA-07 (`docs/specs/cubit.bible.xml:223`): `storeyHeightFloorToFloor` "is a set of readings keyed (level, actor, basis,
evidence source key) … agreeing readings corroborate, disagreeing readings suspend (cleared only by re-affirmation, never
precedence) … equality is on canonical metres."

**Evidence.** The Bible contradicts itself here: AM-01 makes `fixtures/rcc6-bnbc/traps.json` the register of the drawing's
deliberate disagreements with their expected behaviour, and **T-NOT-LEVEL** (S-25, handle 1D90, sample
`P.L= +0'-0"  E.G.L (-1'-6")  EL +11'-0"  +3.353`) expects "levels in both notations resolve to one level stack". The
section (partition view `MEMBER_SECTION:DXF_HANDLE:1D96`) draws `1D4A "GF EL +0.000"` at y −1199880.0, `1D4C "1F EL
+3.353"` at y −1196527.2 (Δ 3352.8), `1D4E "2F EL +6.401"` at y −1193479.2 (Δ 3048.0), and `1D90 "P.L= +0'-0""` /
`1D92 "EL +11'-0""` each 180 above its storey's metric mark. 11'-0" is exactly 3.3528 m; the metric marks are the
imperial design rounded to 3 dp (3.3528→3.353 … 21.6408→21.641). `model.json` holds GF 3352.8 and 1F–6F 3048.0. Under
exact equality GF's two readings (3.353 m @1D4C, 132 in @1D90) suspend (STOREY_HEIGHT_CONTESTED) and every GF line goes
PARTIAL_DECLARED; on the metric reading alone GF column concrete is 16.828852 m³ against the golden's 16.828 — beyond
the golden's printed half-unit, a hard block under the tree's arbitrated band rule
(`tests/takeoff/rails/support/slab-wall-stair-stage.ts:1236-1266`).

**What the product does instead.** (a) A storey height is read once PER NOTATION: the levels proposal reads an unlabelled
feet-and-inches elevation (`EL`, `P.L`; never `E.G.L`, the SITE fact) in a section, binds it to the storey whose mark it
is strictly nearest on the section's own vertical axis (never beyond half a storey past the section's foot or top), and
the distance between two such marks of adjacent storeys is a second TRANSCRIBED reading of the lower storey, in inches,
citing that storey's own imperial mark. A height is never a metric mark minus an imperial one; the storey is proposed
once. (b) Two current readings agree when equal in canonical metres, OR when both are PRINTS (TRANSCRIBED, citing a
source, value and unit kept as written) in two notations and the exact one, rounded half-even to the decimal print's
stated places (its written decimals plus its unit's power of ten), equals the decimal print. Every pair must agree. An
AGREED height is carried at the reading stated to the most places, and the rails bind and cite that reading. Two prints
in one notation, ENTERED figures, and readings carrying only metres keep L-MEA-07's equality — so 3.048 against 3.2
still suspends, and so do two metric prints 3.353 and 3.3528.

**Cost.** A cross-notation disagreement smaller than the decimal print's half-unit (0.5 mm on a 3 dp print) is no longer
visible — and nothing in the printed statements can tell it apart. Where the metric figure was the design and the
imperial one the rounded print (3.000 m printed as 9'-10⅛"), the product carries the imperial conversion (3.000375 m),
an error the prints cannot settle. Agreement at a print's places is not transitive (3.353 m and 3.3528 m each agree with
11'-0" but not with each other), so a set suspends if any pair disagrees: a third reading can corroborate, never clear, a
contest. On such a storey a line's H cites the imperial mark in inches (132 in @1D90) and the gate converts it.
`proposed_levels` holds one row per MARK, so a two-notation storey is two rows, folded back by `offeredLevelsOf`.

**Proof.** `src/core/levels/standing-notations.test.ts`; `tests/takeoff/partition/levels-two-notations.test.ts` (every S-25
storey stands at model.json's height; F-RCC6's proposal byte-identical). **The product path (session 7, A3b)**: a J-000
run stored the proposal's `132 in @1D90` row and still stood GF at 3.353. The reason was that confirming an offered stack
posted the register view's `{label, ordinal}` back to `INSERT_LEVEL`, which dropped the stack's readings: the browser
assembled what L-ACT-02 says is offered. Now a person confirms the stack by its `PROPOSED_LEVEL_STACK` key alone, and
the takeoff lane resolves the offer on the server with its readings (`levelsOfferedUnder`), for the preview and the
commit alike. A reading a client states beside a level is refused REQUEST_MALFORMED. `tests/takeoff/register-ui/offered-stack.test.ts`
confirms S-25's offer by key through the doors, transcribes 3.353 m @1D4C as J-000 does, and reads GF AGREED at 3.3528
on two readings. Confirming F-RCC6's offer by key gives the old list's Consequence, digest and levels, with no reading. And the journey, read back: a J-000 run (session 7, 04:16) walked `m3-levels-and-notes` green with GF at `data-metres`
3.3528 on its two readings, and the run's store holds GF `132 in @1D90` (3.3528) and `3.353 m @1D4C`; that campaign's
column concrete is 182 COMPLETE lines summing 90.83328779985… m³ — model.json's unrounded golden, 90.833288.
The journey's GF-at-3.3528 assertion (`m3-levels-and-notes`) has not been run yet.

## D-002 — TypeSafe Jev System One is a pinned model (session 7, 2026-09-23)

**Clause.** AS-05 (`docs/specs/cubit.bible.xml:873`): "Model ids used in production are `claude-opus-5` for
reading/proposals and `claude-sonnet-5` for cheap classification; fixtures make verify network-free." The ledger's
closed ids (`MODEL_IDS`) and their rates (`MODEL_RATES`) spelled it.

**Evidence.** (1) The eight closed questions (`MODEL_QUESTIONS`) are answered only by TypeSafe Jev: each goes through
`propose`, whose wire reading refuses the Anthropic Messages content array MALFORMED, so the Claude path answers none of
them in production. (2) All 240 prior corpus fixtures were answered by `jev-1.13.0` and billed under a Claude id —
3.572892 USD at the tree's rates against 0.01498665 USD at Jev's, about 238× over. (3) The tree's Claude rates
($15/$75, $3/$15 per MTok) were themselves wrong against the published $5/$25 and $2/$10 (AS-05 names ids, not rates).
(4) https://docs.typesafe.ai/models.md, read 2026-09-23: "Jev 1.13 `jev-1.13.0` … $42 / $0.042 [per Btok / per Mtok] …
Charged per input token. Output tokens are free"; alias `jev-latest` → `jev-1.13.0`. The owner ruled on 2026-09-23 that
Jev is used live and the corpus re-recorded ("use Live Jev most of the time … I'm willingly to spend … to get the
highest quality"). The proposal this acts on is `docs/decisions/as-05-jev-amendment.md`.

**What the product does instead.** `MODEL_IDS` is claude-opus-5, claude-sonnet-5 and `jev-latest`; `MODEL_RATES` is
5/25, 2/10 and 0.042/0 USD per million tokens in/out. One `JEV_MODEL`; the eight questions' pins and the posted `model`
point at it UNCONDITIONALLY — the model id is part of every request hash (`src/core/model/canonical.ts`), so a pin
chosen by environment would ask a different request in the lane that replays than in the one that recorded. Migration
0057 re-closes `model_calls_model_id_closed` over the three ids and touches nothing else. A fixture keeps the provider's
answer BODY and replay re-derives through today's seam (a legacy fixture replays as filed), so a change to how an answer
is read is provable against the corpus at last. The corpus was re-recorded live under the pin: 241 fixtures, 357,430
input tokens, 0.01501206 USD.

**Cost.** The Bible names two ids and the ledger holds three. The Claude ids stay closed and priced so historical rows
stay admitted and billed; no request pins them. Every request hash moved: 240 fixtures, the sheet-understanding
subdirectory file and two `arms-bodies` hashes were retired and re-recorded. `jev-latest` moves when TypeSafe ships, so
answers can change with no change here; the version that answered is recorded per call (`judgment.provider`), and
pinning `jev-1.13.0` is the owner's option once thresholds are tuned. Departs from the proposal's conditional pin (its
§2). A `jev-latest` request in an environment holding only `ANTHROPIC_API_KEY` is now posted to Anthropic and faults —
before, every such call was refused MALFORMED, so no working path is lost.

**Proof.** `src/core/model-ledger.types.test.ts` (three ids, the new rates, the corpus figure 0.01498665);
`src/core/model/transports.test.ts` (a body fixture replays today's derivation; a legacy fixture byte-for-byte; a seam
change moves a body fixture's replay); `tests/ai/view-caption-recorder.test.ts` (the recorder asks exactly the
captions the product asks — one selection, imported); `tests/takeoff/partition/view-caption-corpus.test.ts` (db lane:
the partition job over BNBC finds every caption request in the corpus, none FIXTURE_MISSING, all `jev-latest`);
`pnpm db:drift --scratch` clean.

## D-003 — a column's ties are derived from BNBC 2020 and published at the joint's never-over bound (session 9, R6b; the owner's ruling A′)

**Clauses.** L-FRM-05 (`docs/specs/cubit.bible.xml:256`): "closed link legs to the outer bend line
(b−2c, d−2c) … zones each `⌊dist/spacing⌋ + 1`" — a count over a zone DISTANCE that no clause and no
schedule states; the product read it as "the registry states spacing, never a zone length" and declared
every column's ties unstated. L-QTY-04 (`:198`): "Known scope, not measured → declared exclusion + queue
item" — a joint whose depth the placed framing only bounds is known scope not wholly measured.

**Evidence.** Session 8's ties map (read-back of J-000's project fe67f2bc): all 208 column `rcc.rebar`
lines PARTIAL_DECLARED with `ties: REBAR_TIE_ZONE_UNSTATED`, so the bar schedule billed no column tie at
all and `m3-bar-schedule` could not walk. S-11 states the spacing pair `10Ø@100/150 (TIES)` and S-01 the
code the set is detailed under; BNBC 2020 states the zones (`docs/reference/bnbc-2020/…clauses.txt`):
§8.3.10.5(a) ℓo = max(clear/6, largest section dimension, 450) at each joint face at the first spacing;
§6.4.9.2 joint ties "for a depth not less than that of the deepest connection". With the joint read off
every beam the model frames a column with, the rule reproduces the corrected golden (R0's W-28
GC-1..GC-4) member for member — 208 of 208 rectangular column tie rows
(`tests/takeoff/rails/rebar/column-ties-derived.test.ts`). The joint's depth is read by R6b-1's seam off
the framing the partition PLACED (s-bbs I-413), which is a lower bound D_lo and never the joint: the
axis-y beams, CB1–4, LB1 and TG1 wait on FRM-3, EB2 and PB on D13. The count N(D) is not monotonic in D
(a deeper joint can need fewer sets), so N(D_lo) alone could read over; the exact minimum over every
depth the bound leaves open never can.

**What the product does instead.** Under `rcc.rebar.synthesis@2` (`src/core/rulesets/methods/rebar/
synthesis-v2.ts`; s-bbs I-656, I-659):
- A column whose schedule states its tie spacings and no zone length is tied in BNBC's zones: two end
  zones ℓo at the first spacing, the joint zone at the first spacing through max(D, 450), the middle at
  the second spacing; one run at the first spacing over the storey where the clear height (h − joint)
  fits inside the two end zones or the two spacings are one (GC-1). Each zone is counted by L-FRM-05's
  own rule `⌊(distance + 0.5 mm)/spacing⌋ + 1`. A zone the schedule DOES state a length for is counted
  over that length, as before: the drawing outranks the clause.
- Where the placed framing bounds the joint (BOUNDED, D_lo), the count is the exact minimum of N over
  [max(D_lo, 450), h) — D_lo, every breakpoint, one depth inside every open interval and the last — and
  the line binds `ties` COMPLETE and says so beside itself: `REBAR_TIE_JOINT_BOUNDED`, whose detail cites
  the method, the two clauses, the bound, the member it was read off and the joint depth that attains
  the count. Whatever the joint's true depth, the true count is at least this: under, never over.
- Where nothing read bounds the joint (UNREAD: no framing placed on the level above cites the column,
  or no level above stands), the ties are omitted `REBAR_TIE_JOINT_UNREAD` — the owner's A′: C6 (framed
  only by the slanted beams), the foundation necks, the roof stubs. A round column's ties are hoops the
  BS 8666 roster does not hold and are omitted `BAR_SHAPE_NOT_HELD` until CH joins it with its method.

**The readings this rests on** (s-bbs I-656). *§8.3.10 applies, not §8.3.5.* §8.3.10.1 puts an
intermediate moment frame under SDC C; S-01 states no site class, and Table 6.2.18 gives zone 2
(Dhaka, Z = 0.20), occupancy II, SDC C on site class SA and D on SD–S2. The drawing's own detailing
reads as IMF: its first spacing of 100 passes §8.3.10.5(a)'s so in all 19 rectangular schedule bands
and fails SMF's §8.3.5.4(b) limit in 17 of 19 (16 of 18 with C5's identical bands once; the ties map's
`smf.py`). *§6.4.9.2's four-sided exemption does not apply.* It excuses only "connections not part of a
primary seismic load-resisting system that are restrained on four sides by beams or slabs of
approximately equal depth"; the frame is the primary system, and the store cannot know a joint is
framed on four sides (no census), so every joint is tied. *The joint is tied at the first spacing* —
the drawing's closer spacing carried through, as the golden reads it (W-28), rather than §6.4.9.2's
Av,min reading at 150. *The joint zone is never under 450* — the golden's I-605: a zone longer than the
deepest connection is still "not less than" it, so it is lawful, and it is the depth the committed
golden tied every joint through before GC-4.

**Cost.** A bounded column's ties stand under their true count on a COMPLETE line, and only the
observation says so (a reader of the line alone sees COMPLETE); the worst tie count is C3 at 3F–5F, 26
sets against the golden's 28 (−7.14 %). Before
FRM-3 the 34 bounded (level, mark) cells of C1–C5 at GF–6F stand within −2.42 % of the golden whole
(worst 5F C3; `column-ties-derived.test.ts`), which nets the tie component's under against exact mains —
L-QTY-06's "no netting" is R6-LEG's to grade per component. The zone lengths are the code's reading, not
the drawing's, and a reader who wants them on the row waits for R6-SHOW. C6, the necks, the roof stubs
and C7 bill no ties until their framing (FRM-3, D13, LEV-2) or CH is read. Pinned campaigns do not move:
@1 stands and is still what every edition up to `IS1200_IN @ 2027.05` cites (I-658); @2 is in force
only from `IS1200_IN @ 2027.06`, the edition OPEN-4 mints (I-653).

**Proof.** `src/core/rulesets/methods/rebar/synthesis-v2.test.ts` (the count and its never-over minimum
against a brute-force oracle in whole 1/240 mm, over a sweep that crosses every regime);
`tests/takeoff/rails/rebar/column-ties-derived.test.ts` (the golden member for member; the placed bound
never over it; the rail's lines and declarations over every column of the model; the 34-cell forecast);
`tests/takeoff/rails/rebar/rcc6-bnbc-column-band.test.ts` (db lane: the same under the real job and gate);
`tests/takeoff/rails/rebar/rebar-engine-breaker.test.ts` (the attacks).

## D-004 — the toolchain moves to its current stable majors (session 7's extension, 2026-09-23)

**Clause.** The stack element (`docs/specs/cubit.bible.xml:285-308`) as corrected by AM-08 PART 1: TypeScript
"5.9.3 exact", pnpm "10.x, exact via corepack", TanStack Table "8.x", Vitest "4.x", Playwright "1.6x", pg-boss
"10.x". AM-08 also makes every dependency save-exact and names `decimal.js ^10.6.0` a standing violation.

**Evidence.** (1) TypeScript 7.0 (the native compiler) is the current stable release (npm `latest` 7.0.2);
on this tree it type-checks everything in 2.3 s where 5.9.3 took 14.8 s, and it found one real narrowing
defect (`scripts/db-regenerate-migration.mjs`: a `never` const arrow) and one dead `?? []`. TypeScript 7
ships no compiler API, and typescript-eslint throws on TypeScript ≥ 7 ("run typescript-eslint using the TS
6 API", the TypeScript 7 announcement's side-by-side section). (2) Next 16.3.1 carried two critical RCEs
fixed in 16.3.3 (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4) and a next/og RCE fixed in 16.3.6
(GHSA-vcvr-r3jv-pc5j); 16.3.4 is the first Next that resolves the aliased TypeScript's `tsc6`. (3) pnpm 11
is the maintained line (12 is a days-old Rust rewrite that downloads a native binary at runtime). (4)
TanStack Table 9, Vitest 5 and react-resizable-panels 4 are the current majors; the
migrations were measured before they were made (the DataTable's DOM, the viewer split's geometry to the
sub-pixel, the gallery's widths unchanged). (5) pg-boss 12 cannot migrate a v10 schema ("Automatic
migration from v10 or lower is not supported", 11.0.0) and would rewrite the security-reviewed queue
installer (migrations 0018/0019); 10.4.2 is npm's maintained `maint-v10` release.

**What the product does instead.** `@typescript/native` is `typescript@7.0.2` and is the types lane's `tsc`
(`scripts/verify.mjs`); `typescript` is `@typescript/typescript6` (its compiler pinned to 6.0.3 by
`pnpm-workspace.yaml`'s override) for typescript-eslint, Next's build-time check and the tree's five
readers of the compiler API. `tsconfig.json` drops `baseUrl` (removed in TypeScript 7; `paths` resolve from
the config). pnpm 11.27.1 with its settings in `pnpm-workspace.yaml`; Next 16.3.6; React 19.3.0; Vitest
5.0.1 with Vite 8.3.0 as its declared peer; ESLint 10.11.0 and
typescript-eslint 8.70.1; TanStack Table 9.2.4 behind `DataTableColumnDef`; react-resizable-panels 4.13.2
(sizes as `"%"` strings); zod 4.6.5; tRPC 11.19.0; every dependency save-exact (the carets pinned at their
current versions, `decimal.js` among them). The cad lane's dev group moves to pytest 9.1.1 and ruff 0.16.8
and gains pytest-xdist 3.8.0 (the lane runs on six workers); ezdxf, LibreDWG and Typst do not move (their
versions are corpus and document identity). pg-boss stays at 10.4.2. Playwright stays at 1.62.1 (Chromium r1234):
1.63.0 was tried and J-011's hover sweep met no entity under the pointer on 1.63.0 with either Chromium (r1243 or
r1234), while J-011 walked green on 1.62.1 with every other move of this row in place — bisected over
react-resizable-panels (v2 restored), Chromium, zod (4.4.3) and Next (16.3.4), none of which moved the verdict. The
1.63.0 release notes name no mouse or input change; finding the cause is owed before the move.

**Cost.** Two TypeScript compilers read the tree: the types lane is TypeScript 7 while `next build`'s
check and typescript-eslint's types are TypeScript 6, so an error only one of them reports could split
their verdicts (none does at this commit). TypeScript 7.1 is expected to ship a new API; typescript-eslint
follows it, and the alias goes then. Playwright is one minor behind its latest until J-011's sweep is
explained. A reader of the Bible's stack finds older
versions than the tree runs; this row is the current law until the owner folds it into an amendment.

**Proof.** The gate on the toolchain commit (every lane, quoted in the extension's handoff notes and in
`node_modules/.cache/cubit/gate/summary.txt`); `tests/toolchain/cad-lane.test.ts` (six workers).

## D-005 — blinding traced by hand is measured over the traced outline, with no projection (session 9, entered on the refuter's verdict)

**Clause.** L-FRM-04 (`docs/specs/cubit.bible.xml:255`): "Blinding (CC) count × (L + 2p) × (B + 2p) × t;
deferred for polygon plans".

**Evidence.** S-Measure's I-388 read the clause's deferral as covering only the projection of a polygon,
so that a traced outline "projects nothing". Session 9's refuter (s-measure §11) rejected that reading:
the clause defers polygon plans outright, states the projection for every blinding, and makes no
distinction between a machine rectangle and a hand trace. The method (`src/core/rulesets/methods/manual/
traced-plate.ts`) drops p for every class; the one pairing S2 offers (a slab on grade) agrees with
F-RCC6-BNBC's golden only because the golden's model sets p = 0 under a slab on grade and a ramp
(`fixtures/gen/rcc6_bnbc/golden.py`), while the edition in force states `blindingProjection` = 3 in.
The case that needs a hand measurement at all is a polygon: S-08's slab on grade (POLYLINE 81D) is a
pentagon with a 45° chamfer, which the clause's projected rectangle cannot express, and the blinding
rectangle drawn beside it (824–827, note 828) does not follow the chamfer, so it is not the ring (I-393).

**What the product does instead.** A hand measurement of blinding is `pcc.blinding.area@1` =
`count × (A_traced − Σ openings − Σ junctions) × t` over a traced outline — the member's own ring, or a
drawn blinding outline that follows it — with no projection. It is cited by the platform edition
`IS1200_IN @ 2027.05` (migration 0066). The machine's rectangle keeps L-FRM-04 exactly
(`pcc.blinding_rect@1`, and `pcc.blinding_rect_piled@1` under a piled cap).

**Cost.** Blinding has two spellings, each named by its rule id. A traced blinding stands under the
clause's figure by the projection strip wherever the drawing projects one — an under-measurement, never
an over-measurement — and the line's basis and act say a person traced it. The guard that refuses a
drawn blinding outline running past its member (Rev B's 824–827 against 81D) is built (MANUAL-LAW,
session 9): a blinding ring with any net area outside the drawn closed outline that covers most of it
is refused `MANUAL_BLINDING_PAST_MEMBER`, naming that outline (s-measure I-614). A member drawn
with no closed outline gives the guard nothing to hold a ring to; there the ring stays the QS's reading,
checkable by the entity it cites (I-388).

## D-007 — a structural reader's sightings are walked before a confirmation (session 9, ARCH-4)

**Clause.** L-REG-03 (`docs/specs/cubit.bible.xml:186`): "Discipline is drawing-scoped,
machine-proposed, human-confirmed, fails closed: an unconfirmed drawing is not walked."

**Evidence.** Every register pass since M2 has written the structural readers' rows under the
placement law's constant `STRUCTURAL` (`partition/expansion/store.ts`), with no confirmation read.
The suites and journeys that stand on it pin a set before a person confirms any sheet — among them
`tests/takeoff/partition/expansion/reexpand-live.test.ts`, `…/placement/expansion-carry-storey.test.ts`,
`…/placement/typical-range-noted.test.ts`, `…/schedules/schedules.test.ts`,
`…/grid/grid-backbone.test.ts`, `tests/takeoff/coverage/placeholder-lines.test.ts`,
`tests/takeoff/register-ui/offered-stack.test.ts` and the M2 legs — and J-000's
`m1-confirm-disciplines` confirms only the first group the reading offers. Closing the rule over the
structural rows changes what all of them register, in a slice about the architect's walls.

**What the product does instead.** The rule is applied where this increment introduces the rows it
governs: a brick wall and an opening are sighted under the discipline a person confirmed for the
sheet their plan was captioned on, the newest confirmation first, and are not walked before one
stands (s-takeoff I-592); confirming a discipline re-expands the project. The structural readers'
rows keep `STRUCTURAL`, confirmed or not, as they have since M2.

**Cost.** A structural member drawn on a sheet nobody has confirmed stands in the register before a
person has said what the sheet is. And the path this leaves open is the one that stood before the
increment: a structural mark placed off an ARCHITECTURAL sheet is still sighted STRUCTURAL, so where
the engineer's set draws the same member the two sightings are two keys, and KIND_DISCIPLINE — which
closes the cross-discipline count for the wall lane (I-595) — cannot see it. Neither fixture draws
such a member: F-ARCH's plans place no structural member (the placement stage's F-ARCH digest held
none before the wall lane), and F-RCC6-BNBC's bound architectural xref is read by nobody (I-342).
Closing it is its own increment: the structural readers name their sheet as the wall lane does
(which re-pins the byte-frozen placement digests of `bnbc-pile-schedule.test.ts`), and every suite
above confirms its sheets before it pins.

**Proof.** `tests/takeoff/partition/arch-walls-register.test.ts` (the wall lane walks nothing before a
confirmation, registers ARCHITECTURAL after one, and a STRUCTURAL-confirmed sheet's walls bill no
brickwork); the db lane's structural suites unchanged.

## D-006 — a drawing's text is lettered from a 2 px cap height (session 8, VIEW-TXT)

**Clause.** R-UI-040 (`docs/specs/cubit.bible.xml:645`): "level-of-detail hides text below legibility".

**Evidence.** Walk 0 (`.private/work/session-8/walk0/walk-drawings-viewer.json`, BLOCKS_DEMO): at the
fitted camera S-10 COLUMN LAYOUT PLAN showed an empty title block, no `COLUMN LAYOUT PLAN SCALE 1:100`
caption, no dimension strings and no C1–C7 marks — "an unlabelled grid of red squares" — while the
product's own DWG lane (`drawing_render`, same layout, same box) letters all of it. Part of that was the
painter drawing glyphs at 0.56 of their height; the rest is this clause. S-10 is an A1 sheet fitted to
a 1190 × 804 stage at 1.289 px per unit: its caption stands 5.2 px, its sheet name 4.1, its firm 3.35,
its column marks 2.6 and its title block labels 1.7–2.3. Measured on the atlas's true-size mipmapped
glyphs (viewer.md I-463; harness pictures in `.private/work/session-8/view-txt/`), a capital reads
from about 3 px; at 2.6 px a mark is a word-shaped smudge in its place, and at 1.7 px nothing. Hiding
everything under legibility leaves the fitted plan without a single mark or note; every PDF and CAD
viewer a QS uses (and every plot) draws them there.

**What the product does instead.** A drawing's own text — TEXT and MTEXT, on the sheet and seen
through its windows — is lettered at its true cap height wherever that height is at least
`LETTERED_TEXT_PX` = 2 px on screen (`src/modules/takeoff/viewer/client.ts`), and is not drawn at all
below it. Between 2 and 3 px it is drawn and is not readable: it stands in its place as the drawing's
own glyphs, filtered from the atlas's mipmaps, and a zoom sharpens it rather than making it appear.
Nothing is ever drawn larger than the drawing states to make it readable at fit, and no text is
replaced by a bar. The product's OWN lettering (the partition overlay's bubble labels) keeps
`LEGIBLE_TEXT_PX` = 6 and is dropped, not shrunk, below it.

**Cost.** Text between 2 and 3 px is on the sheet and cannot be read there — the "smudge" viewer.md §1
had ruled out; the Decision now says so. The lettering's fill at rest grows by the sub-legible text
(small beside the large notes that carry nearly all of it) and every sheet's picture at rest moves
once with this build. On PERF-011's synthetic sheet the 2.5-unit rung is lettered at the fitted scale
(2.64 px) where it was hidden; no rung crosses the floor within the lane's scripted zoom (1.057 to
1.139 px per unit), so the settled frame stands for the gesture as before (I-345).

**Proof.** `tests/takeoff/viewer/text-rotation.test.ts` ("level of detail (D-006)": S-10's
2-unit marks lettered at 1.2886 px per unit, a 1.3-unit label not; the mark samples the mipmaps);
`tests/takeoff/viewer/settled-frame.test.ts` (the LOD cut at `LETTERED_TEXT_PX`); PERF-011 and the
e2e sweep with every moved viewer picture looked at and re-taken by the gate.

## D-009 — masonry has one home, F-ARCH (session 9, R0-G3)

**Clause.** F-RCC6-BNBC (`docs/specs/cubit.bible.xml:723`) draws "brick walls 250 (perimeter) and 125
(partitions) at 1F–6F with the S-25 lintel schedule", and AM-07 (`:954`) rests M3's masonry scope on
its golden's "BRICKWORK rows by nominal thickness".

**Evidence.** BNBC's generator minted one BW250 and one BW125 member per floor — a perimeter less the
balcony front, and a 60 m partition allowance — and billed 259.425 m³ of BRICKWORK at 1F..6F. The lump
ran through about 18 columns, left the grid-A facade out and gave 1F the GF storey height. ARCH-1
(`fixtures/gen/arch/`) authors the same building's walls wall by wall at GF..6F, clear between their
owners, to the soffit, openings over 0.1 m² deducted and S-25's lintels deducted (F-ARCH A-10, A-11):
538.041 m³. Two goldens billing one quantity two ways is a copy (ARCH-02, B-17), and the better one is
the architect's. Over R0's structure, F-ARCH's 766 golden rows regenerate identical, byte for byte.

**What the product does instead.** Brick walls are the architect's members, drawn and billed in the
architect's set. F-ARCH's golden is brickwork's one home: BRICK_WALL × BRICKWORK is read from
`goldenRows("arch")`, GF..6F, components BW250/BW125. BNBC mints no BRICK_WALL member and bills no
BRICKWORK row; it keeps its LINTEL members and rows unchanged (F-ARCH reads them and deducts them), and
S-25 still prints the two wall types from `model.WALL_TYPES`, so its drawing is unchanged byte for
byte. The M3 masonry sample is the pair BNBC + F-ARCH.

**Cost.** The M3 brickwork cells need F-ARCH uploaded into the BNBC project (J-000 uploads two
drawings, ARCH-8); until the brickwork rail reads F-ARCH's walls (ARCH-4) they are failing
observations, never trimmed. BNBC's golden loses its 12 BRICKWORK rows (370 → 358) at R0's baseline,
and `tests/takeoff/rails/masonry-finishes/rcc6-bnbc-band.test.ts`, which reads BNBC's brick-wall
members and rows, moves to F-ARCH's with that baseline.

**Proof.** A scratch regeneration (`python -m fixtures.gen.rcc6_bnbc`) before and after: the paper,
frames, twin DXFs and the vector PDF byte-identical; the 30 LINTEL rows byte-equal; no BRICK_WALL or
BRICKWORK row; the other 358 rows identical. `python -m fixtures.gen.arch` over the new BNBC:
`takeoff.golden.json` byte-identical to the committed one (766 rows, brickwork 538.041 m³).

## D-010 — the corpus recorder invokes Jev, on purpose, by a person (session 9, ASK-2)

**Clause.** C-12 (`docs/specs/cubit.bible.xml:799`), "Nothing here runs Claude": "… this tree never gains a script
that invokes a model (scope-fence)."

**Evidence.** L-AI-01 has every lane replay recorded answers and Q-08 has the corpus composed by the product's own
request builders — a recording nobody's script composed would answer a question the product does not ask. The owner's
Q4 ruling (session 8, `docs/handoff/session-8-ledger.md`, "The owner's rulings", item 4) has S-Ask's paraphrases routed
by Jev with "recorded fixtures in the lanes". `scripts/model-corpus.ts` has recorded the whole corpus this way since
session 7 (D-002's re-record, 241 fixtures), with no row here; ASK-2 recorded its 60 ask-route fixtures through it, spending
0.003762738 USD in two passes (`fixtures/model/corpus.json`). C-12's subject, by its name and its first sentence, is the Builder and
Claude; the model the script invokes is TypeSafe Jev, a closed-question provider that generates no text.

**What the product does instead.** The tree carries exactly one script that invokes a model:
`scripts/model-corpus.ts record`, run by a person on purpose and by no lane (every lane hands the seam a fixture root, so
none could), through the seam's one recording door `recordFixture`, pinned to `jev-latest` (D-002), minting under a
scratch directory a person reads before `file` moves it into `fixtures/model`, reading the key from the environment and
printing it nowhere. The harness's `jev_ask` door is the other live door, for prototyping, and it too ledgers its cost.
Nothing in the tree invokes Claude.

**Cost.** A reader of the Bible finds a model-invoking script where C-12 says there is none. Its spend is a person's,
stated per fixture in `corpus.json` (`providerCost`); a recording is minted once and never overwritten.

**Proof.** `tests/ai/model-corpus-roster.test.ts` (every fixture rostered, every roster line filed, each answering a
closed question the product asks); `tests/ai/ask/route-corpus.test.ts` (the recorder composes what the door composes,
and every one of its requests replays with no network).
