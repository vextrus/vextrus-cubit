# Recorded model answers

The corpus the model seam (`src/core/model`) replays from under its fixture transport (L-AI-01,
F-MODEL). Verify is network-free: a request whose answer is recorded here is answered from the
file, and one whose answer is not is refused `FIXTURE_MISSING` — never sent to a provider.

## Where a fixture lives

One file per request, named by the request's own identity: `<requestHash>.json`, where
`requestHash` is the lowercase sha256 hex the seam's `requestHash(request)` derives — sha256 over the
canonical JSON of `{ modelId, system, messages, params }` (keys sorted by code unit at every depth,
no whitespace, absent `params` as `{}`). The seam reads this directory by default when the process
runs under test; `CUBIT_MODEL_FIXTURE_ROOT` points it at another root.

## What a fixture holds

The `ModelFixture` shape, as JSON:

| field          | type                 | meaning                                                   |
| -------------- | -------------------- | --------------------------------------------------------- |
| `requestHash`  | string, 64 hex chars | the hash the file is named by — the two must agree        |
| `modelId`      | one of `MODEL_IDS` — `"jev-latest"` for every closed question (D-002) | the pinned id the request named |
| `payload`      | any JSON value       | the wire the seam read out of the provider's answer on the day it was recorded |
| `inputTokens`  | whole number ≥ 0     | the provider's `usage.input_tokens`                       |
| `outputTokens` | whole number ≥ 0     | the provider's `usage.output_tokens`                      |
| `judgment`     | object or null, optional | what a System One model said of its answer, as the seam read it on the day it was recorded — `provider` (the versioned id it reported), `confidence` (the weakest stated one; a Noul states none), and `answers` keyed by question id, each `{type, value, confidence, probabilities}`; absent or null for a generative provider |
| `body`         | object or null, optional | the provider's own answer, exactly as it arrived (`model`, `answers`, `usage`) |

Where a fixture keeps its `body`, the body is the record: replay reads it again through the seam as
it stands (`readTypeSafeBody` — the same arm that asks the question, the same judgment reading), so
the `payload` and `judgment` a lane is answered with are TODAY's reading of what the provider said,
and the file's own `payload` and `judgment` are the record-day reading, kept for a person reading
the corpus. A change to how an answer is read therefore moves every replay it should move. A
fixture recorded before bodies were kept has none and replays exactly as it was filed.

A file that exists but does not fit this shape, whose `requestHash` or `modelId` disagrees with the
request it is filed under, or whose kept body the seam cannot read or whose usage the file does not
count, is a corpus defect: the seam fails plainly rather than replaying it.

Every fixture committed here is deliberate corpus (Q-08); acceptance mints its own under a
temporary root instead of writing into this directory.

## The corpus's roster

`corpus.json` beside this file lists every fixture in this root: the request hash, the closed
question it answers (`MODEL_QUESTIONS` in `src/core/model/questions.ts`), the subject it was asked
about, the day it was recorded and the ledger's cost line for the call. It is written by the
recorder (`scripts/model-corpus.ts`, run by a person with the key, never by a lane) and kept in
step with the files by `tests/ai/model-corpus-roster.test.ts`: a fixture the roster does not name,
or a roster line with no fixture, fails. The subdirectory `sheet-understanding/` is that
increment's own corpus root, addressed by its acceptance by path; the product's lanes read this
root, flat.

Recording: `node --import tsx scripts/model-corpus.ts record --question <name> --out <dir>` mints
under a temporary root from the live provider behind `TYPESAFE_API_KEY`, prints what came back and
the cost line, and never writes here; `node --import tsx scripts/model-corpus.ts file --from <dir>`
moves what a person has read into this root and re-derives `corpus.json`. Each filing is its own
commit quoting the cost line (Q-08).
