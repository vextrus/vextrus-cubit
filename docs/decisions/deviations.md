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
storey stands at model.json's height; F-RCC6's proposal byte-identical). **Not yet in the product path**: a J-000 run
(session 7) stored the proposal's `132 in @1D90` row and still stood GF at 3.353 — confirming an offered stack posts
the register view's `{label, ordinal}` back to `INSERT_LEVEL` and drops the stack's readings (the browser assembles
what L-ACT-02 says is offered). The slice that confirms by group key, resolved on the server, carries the readings and
the journey's GF-at-3.3528 assertion.

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
