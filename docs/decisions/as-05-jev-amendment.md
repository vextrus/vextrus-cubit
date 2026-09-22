# Proposed amendment to AS-05 — TypeSafe Jev System One as a pinned model (unnumbered, a proposal)

**Status:** proposal, unnumbered. Nothing here is law until the Bible's owner adds it under
`<amendments>`; this file records what the owner would add and why, and nothing in the tree acts
on it. AS-05 stands as written: the ledger's closed ids are `claude-opus-5` and `claude-sonnet-5`,
and every Jev call is recorded under the id the request pinned (the objection recorded in
`docs/handoff/fable-5.1-session-3.md` §"Jev's rate" and carried here).

**Clauses affected:** AS-05 (the closed model ids and their rates), L-AI-01 (one path, every call a
ledger row, fixture replay inside verify), L-AI-02 (Proposal or refusal), L-AI-03 (what the model may
do), R-AI-005 (per-project spend, calls and outcomes on the project home), Q-08 (every committed
fixture is deliberate corpus), C-07 / AM-09 (no lane reaches the network).

## 1. What exists today, and why an amendment is owed

`src/core/model/typesafe.ts` speaks TypeSafe's HTTP contract (`POST https://api.typesafe.ai/v1/systemone`,
bearer key, `{model, state, questions}` in, `{answers, usage, model}` out) behind `TYPESAFE_API_KEY`,
and the live transport reaches it only where that key is set. Jev answers CLOSED questions with typed
answers and probabilities and generates nothing, which is exactly the posture L-AI-02 asks of a model:
it selects among candidates code found, cites the candidate's own key, and never invents a value.

Two things AS-05 fixes cannot be said of Jev today:

- **The id.** `MODEL_IDS` is closed over two Claude ids. A Jev call is therefore recorded under the
  Claude id the request pinned — `claude-opus-5` for the sheet reading, `claude-sonnet-5` for the
  caption class — and the ledger's `model_id` column, CHECK-closed over the same const, could hold
  nothing else. Session 4 records what actually answered beside the row (`judgment.provider`, the
  versioned id TypeSafe reports, e.g. `jev-1.13.0`), so the attribution is auditable; but the pinned
  id is still not the model.
- **The rate.** `MODEL_RATES` prices the two Claude ids in USD per million tokens of each direction.
  Jev's cost, as its documentation states it, is charged per INPUT token only and output is free:
  "$42 / $0.042 — per Btok / per Mtok. Charged per input token. Output tokens are free."
  (https://docs.typesafe.ai/models, read 2026-09-21). The ledger's derivation `modelCallCost` takes a
  rate per direction, so a Jev call attributed under a Claude id is attributed at a Claude rate — the
  project home's spend (R-AI-005) is then a number about a rate nobody charged.

## 2. The amendment the owner would add

> **AM-NN — TypeSafe Jev System One is a pinned model.** AS-05's closed const gains the id
> `jev-latest` (the alias the live transport posts; the versioned id the provider reports is
> recorded beside the row as `judgment.provider`). Its rate is the one its documentation states on
> the day the amendment lands — input `0.042` USD per million tokens, output `0` — and the ledger's
> `MODEL_RATES` carries exactly those two figures, so `modelCallCost` bills input and prices output
> at nothing. The sheet-reading request pins `jev-latest` where the environment holds the TypeSafe
> key and `claude-opus-5` otherwise; the view-caption request pins `jev-latest` and
> `claude-sonnet-5` the same way; every later closed question pins `jev-latest`. `model_calls.model_id`
> is re-closed over the three ids by a migration that supersedes, never edits, `0013`.
>
> The fixture corpus's home is `fixtures/model/` (flat, `<requestHash>.json`, `corpus.json` the
> roster), recorded once from the live provider by `scripts/model-corpus.ts` and replayed in every
> lane (L-AI-01); a fixture's `judgment` is what the provider said of its answer and the ledger
> records it whole. The per-question calibration line (`src/core/model-calibration.ts`: proposed,
> refused, confirmed, overruled, repudiated, affirmed, awaiting, and the mean confidence where a
> person agreed against where a person did not) is read on S-Audit and quoted in every handoff, and
> a threshold the product acts on is evaluated on that line before it moves.

The rate is cited, not invented: the two figures above are the documentation's, and the amendment
names the page and the day. Should the page state another figure on the day the amendment lands,
that figure is the one to write.

## 3. What session 4 built without the amendment, lawfully

- The ledger records the closed question a call put (`model_calls.question`) and what the model said
  of its answer (`model_calls.judgment`: provider, per-answer confidence and probabilities, the call's
  confidence as the weakest answer's) — both nullable, because the ledger predates them.
- The outcome column: `model_call_outcomes`, one append-only row per person's judgment of a proposed
  call (CONFIRMED, OVERRULED, REPUDIATED, AFFIRMED), keyed to the call by the composite (tenant,
  call) key, written by the disposition (`recordDisposition`) and by the acts that carry a judgment
  (`CONFIRM_VIEW_TYPE`), never by a screen.
- The calibration read: `calibrationLinesOf(calls, outcomes)`, pure; S-Audit's model ledger panel
  lists the newest calls with their outcome and the line per question (Decision I-37).
- The two existing questions brought to the documented contract: instructions name the state by
  backticked field path, carry the question's whole meaning, and offer the no-match outcome where
  nothing may fit; the judgment is read as the contract spells it and never supplied where absent.
- The corpus recorder `scripts/model-corpus.ts` and the roster `fixtures/model/corpus.json`, kept
  in step by `tests/ai/model-corpus-roster.test.ts`.

### 3.1 What session 5 built without the amendment, on the same footing

- The adapter enumerates one arm per question (`src/core/model/typesafe-arms/registry.ts`, AM-11's
  split-registry shape) and the recorder one recorder per question (`scripts/model-corpus/registry.ts`);
  `MODEL_QUESTIONS` names eight. Every arm below is pinned to `claude-sonnet-5` through the seam's
  one `TYPESAFE_MODEL` and billed at the Claude rate, exactly as view-caption is; nothing adds
  `jev-latest` or a Jev rate to AS-05.
- `schedule-cell` (logic-point 2): a Choice per contested cell over the grammar's own candidates +
  NOT_STATED, and a Noul on the row's standing; judged through `judgeCellReading`; no pass asks it
  yet. Corpus: 80 contested rows of F-RCC6-BNBC's five schedules.
- `note-clause` (point 3): a Choice over NOTE_KINDS + NONE_OF_THESE and a Noul on whether the lap
  governs the table; the offer stored (migration 0055) and judged by TRANSCRIBE_SHEET_NOTES; the pass
  exists and is unwired. Corpus: 38 clauses of S-01/S-02.
- `coverage-cause` (point 4): a Choice over SCOPE_DECLARATION_CAUSES + NOTHING_TO_DECLARE, gated
  and floored by code, judged by the two boundary acts. Corpus: nine hand-authored states, every
  one of which answers NOTHING_TO_DECLARE.
- `boq-line-description` (point 5): a Choice over the closed item-description catalogue +
  NONE_OF_THESE and a Noul on whether the attributes separate; confirmed at the draft's issue; the
  screen asks nothing. Corpus: four line states.
- `outline-corroboration` (point 6): a criteria-less Noul over the numbers code finds; the acts name
  the call they judged; no store yet. Corpus: F-RCC6's 72 mark-anchored outlines, whose probabilities
  (0.54–0.76) the 0.30/0.70 band does not separate.
- `sheet-revision-recency` (point 7, part (a)): a Choice for the evidence and a five-level Score;
  no act, no store. Corpus: BNBC's 27 sheets, all at REV B.
- Every cost line the session-5 handoff quotes carries the same sentence as session 4's: a Jev call
  is billed under the pinned Claude id `claude-sonnet-5` until the owner's amendment lands, with the
  provider's documented rate printed beside it by the recorder itself.

## 4. What stays the owner's

Adding `jev-latest` to `MODEL_IDS`, its rate to `MODEL_RATES`, the migration that re-closes the
column, and the request builders' pin — each a consequence of the amendment and none of them made
here. Until then a Jev call is billed at the pinned Claude rate and the handoff says so beside every
cost line it quotes.
