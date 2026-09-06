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
- `50f7c938….json` — the recorded answer to the question that sheet asks: a reading of number,
  title, discipline and view captions, citing the three blocks it was read out of.

## Re-recording

The request hash is derived from the question `sheetUnderstandingRequest` builds, so a change to
that request — its system prompt, the evidence it carries, the artifact itself — files the answer
under a different name and the old file answers nothing. Mint the new name with
`requestHash(sheetUnderstandingRequest(graph, layoutName))` and rename the recording to match; a
request no recording answers is `FIXTURE_MISSING`, never a network call.
