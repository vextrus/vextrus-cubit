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
| `modelId`      | `"claude-opus-5"` or `"claude-sonnet-5"` | the pinned id the request named (AS-05) |
| `payload`      | any JSON value       | the provider's `content` as it was answered               |
| `inputTokens`  | whole number ≥ 0     | the provider's `usage.input_tokens`                       |
| `outputTokens` | whole number ≥ 0     | the provider's `usage.output_tokens`                      |

A file that exists but does not fit this shape, or whose `requestHash` or `modelId` disagrees with
the request it is filed under, is a corpus defect: the seam fails plainly rather than replaying it.

Every fixture committed here is deliberate corpus (Q-08); acceptance mints its own under a
temporary root instead of writing into this directory.
