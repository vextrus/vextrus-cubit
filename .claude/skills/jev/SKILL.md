---
name: jev
description: Design, prototype and ship an AI judgment in Vextrus Cubit — a TypeSafe Jev System One question (Choice, Noul, Score) behind the product's model seam, prototyped live with the cubit MCP jev_ask tool, recorded as fixtures, and composed with code (and, only where reasoning or generation is truly needed, a low-effort Claude call with structured output behind the same seam). Use whenever a feature needs the machine to read, classify, rank, propose or explain.
---
# Jev in the product

**The division of labour** (L-AI-01…03, L-FRM-08): the model reads, classifies, proposes and explains;
code computes every billable number from human-confirmed inputs; a human disposes. A proposal cites
resolvable source keys or it is refused (UNSOURCED, SOURCE_UNRESOLVED, MALFORMED).

**Why Jev**: it answers closed questions with typed answers and probabilities — fast (~0.5–0.7 s),
cheap ($0.042 per million input tokens, output free), and it cannot hallucinate a value outside the
options it was given. Session 7's measured spend: a full J-000 demo's calls cost $0.000216.

**Design a judgment** (read the `typesafe:typesafe-ai` skill and the live docs at docs.typesafe.ai
first — they are the source of truth for request shapes and primitives):
1. Start from what the screen will show, select or change. Keep rules, lookups and arithmetic in code;
   use a judgment only where ordinary code needs semantic understanding (is this caption a plan? which
   of these candidate texts is the schedule's title? does this note state a lap length?).
2. Candidates come from code (the EntityGraph, the partition); the judgment SELECTS among them — never
   generates a value. Include a no-match option. One narrow question per judgment; ask independent
   questions over the same state in one request.
3. Prototype live: `jev_ask` with `{ body: { state, questions }, purpose }` (the model is pinned; cost is
   ledgered in `node_modules/.cache/cubit/harness/jev-calls.jsonl`). Try real states from the fixtures AND
   from the Edison set (in `.private/`); measure agreement and probability calibration; pick thresholds
   from data, and route low-confidence answers to a human (a queue item or a proposal awaiting confirm).
4. Ship: one ARM file under `src/core/model/typesafe-arms/` (key set, task, guard, compose, read) plus
   one line in its registry; a `MODEL_QUESTIONS` entry; the consumer turns the proposal into an offer, a
   reading for disposition, or a held classification; record fixtures with
   `node --import tsx scripts/model-corpus.ts record --question <q> … --out <dir>`, read them, then
   `file --from <dir>`; tests replay them (verify is network-free).
5. Show cost and disclosure: per-project AI spend on the project home, model ids on the certificate
   (R-AI-005).

**Where a Claude call belongs**: only for work Jev's closed questions cannot do — composing an answer
from tool results for Ask-the-drawings (R-AI-003: every number in the answer is a query result rendered
by the formatter), reading illegible scans (R-AI-002), drafting narrative prose a human edits. It goes
through the same `callModel` seam (the live transport already speaks Anthropic where
`ANTHROPIC_API_KEY` is set), at low effort, with structured output validated by Zod, recorded as
fixtures like any other call. It needs the owner's API key and a Deviation (the scope fence bars a
script that runs Claude in this repository; AS-05/D-002 pin the ids) — ask the owner before building it.
