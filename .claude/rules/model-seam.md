---
paths:
  - "src/core/model/**"
  - "src/core/model-ledger*"
  - "scripts/model-corpus*"
  - "scripts/model-corpus/**"
  - "fixtures/model/**"
  - "tests/ai/**"
  - "src/modules/**/proposal*"
---
# The model seam (L-AI-01…03, D-002)

- `callModel` in core is the only path to a model; importing a provider elsewhere is a lint error. It
  returns `Proposal<T>` (payload + resolvable source keys) or a `Refusal` — never a quantity, never a
  rate, never an act. AI proposes; code resolves; a human disposes. Every billable number comes from
  pinned methods over human-confirmed inputs (L-FRM-08).
- **Jev (TypeSafe System One)** answers the product's closed questions: Choice, Noul (a probability of
  yes and NO confidence), Score. A call's confidence is the minimum over the answers that state one.
  Each question is one ARM file under `src/core/model/typesafe-arms/`, enumerated by its registry. Jev is
  pinned `jev-latest` at its published rate (D-002); the ledger's Claude rates are $5/$25 and $2/$10.
  The live transport also speaks Anthropic where `ANTHROPIC_API_KEY` is set.
- Lanes replay: verify and the journeys read `fixtures/model/` (241 fixtures, re-recorded live with the
  provider's own bodies). A new question is a new arm plus fixtures recorded ON PURPOSE with
  `node --import tsx scripts/model-corpus.ts record --question <q> … --out <dir>` then `file --from <dir>`;
  a missing fixture is `FIXTURE_MISSING`, never a network call.
- Prototype a question live with the `cubit` MCP tool `jev_ask` before writing its arm: it pins the
  model, never echoes the key, and ledgers the cost. `TYPESAFE_API_KEY` is never printed, written or
  committed. The `jev` skill is the design procedure (Jev for fast typed judgments; a low-effort Claude
  call with structured output only where a judgment needs reasoning or generation, and only behind the
  same seam, the same ledger and the same fixture discipline).
