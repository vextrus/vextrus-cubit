# Sheet understanding — recorded answers

The corpus `understandSheet` (`src/modules/ai/sheet-understanding`) replays from (R-AI-001, L-AI-01).
The file format and the naming rule are the parent's — one `<requestHash>.json` per request, in the
`ModelFixture` shape — so read `../README.md` first.

## What stands here

- `artifacts/silent-title-block.graph.json` — an EntityGraph v2 sheet the deterministic title-block
  grammar is **silent** on: its one paper layout carries no readable `TEXT`/`MTEXT` of its own (the
  single `TEXT` on it is a whitespace placeholder), and what the sheet is stands in the block
  attributes of its title block and in the paint exploded out of its two view-title blocks. That is
  the case R-AI-001 reaches a model for; every layout the grammar reads is answered without one.
- `c4db95e3….json` — the recorded answer to the question that sheet asks, pinned to `jev-latest`
  (D-002) and recorded live from TypeSafe Jev System One on 2026-09-23 with the provider's own body
  kept: a reading of number, title and discipline citing the title block it was read out of. It is
  the same recording, byte for byte, as the flat corpus's sheet-reading fixture of the same name —
  one request, one answer, filed in both roots because this increment's acceptance addresses this
  one by path. (The file it replaces, `50f7c938…`, was an answer filed under a Claude id; under the
  pin no request hashes to it.)

## Re-recording

The request hash is derived from the question `sheetUnderstandingRequest` builds, so a change to
that request — its system prompt, the evidence it carries, the artifact itself — files the answer
under a different name and the old file answers nothing. Mint the new name with
`requestHash(sheetUnderstandingRequest(graph, layoutName))` and rename the recording to match; a
request no recording answers is `FIXTURE_MISSING`, never a network call.
