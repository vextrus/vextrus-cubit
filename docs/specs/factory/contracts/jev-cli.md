# `scripts/factory/jev.py`: the factory's Jev client

Contract (PR f0) for the client PR f9 builds and its callers: `.claude/workflows/review-pr.js` (PR f4, through
`ledger` stage 5), `scripts/factory/watch.py` (PR f3, the daily model watch), `real-set-walk.js` (PR f5, later:
dedupe), the cut-item issue filing (session 13). Source: `docs/specs/factory.md` 2.2 "Jev client", 3.14, 8;
ADR 0042 item 10; the product's own client for constants (`vextrus/settings/jev.py`).

**Jev is a function, never an agent or a gate.** It advises, sorts and routes. The guard, `merge_ready`, the ledger
and the leak wall decide. **`Unavailable` always equals the run without Jev**: every caller behaves exactly as if the
call had not been made. A builder's READY or BLOCKED is never read through Jev (trailers.md).

## 1. The Python function

```python
from scripts.factory.jev import ask, Answers, Unavailable

ask(state, questions, *, model="jev-1.13.0") -> Answers | Unavailable
```

| Part | Contract |
|---|---|
| `state` | A string, mapping or list: what Jev reads. Public text only unless the caller is a local step whose text may carry drawing text under the local key (ADR 0013; never from a cloud session until Q23). |
| `questions` | A mapping of question name to a typed question: `{"kind": "noul", "text": ...}`, `{"kind": "choice", "text": ..., "options": {...}}` or `{"kind": "score", "text": ..., "levels": [...]}` (TypeSafe's three primitives: P(yes); a choice among up to 255 options with probabilities and confidence; a score on 2 to 10 ordered levels). Question names are not sent to the model. |
| `model` | Default `jev-1.13.0`, pinned. The aliases `jev-latest` and `jev-preview` are used only by `models-check`. |
| returns `Answers` | A mapping from question name to its answer (`noul`: `p` in 0 to 1; `choice`: the choice, its probabilities and `confidence`; `score`: the score, legend, probabilities and `confidence`), plus `model` (the id the response named), `input_tokens` and `latency_ms`. Every shape is validated against what was asked; an answer that is not an answer to the question is `Unavailable("malformed")`. |
| returns `Unavailable` | Carries `why`, one of the product's closed list: `bad_question`, `no_key`, `cooling_off`, `too_large`, `timed_out`, `unreachable`, `busy`, `key_refused`, `request_refused`, `failed`, `oversized`, `malformed` (`vextrus/platform/services/jev.py`'s `Why`). Never raised as an exception for these. |

Behaviour, each with a test in `scripts/factory/tests/test_jev.py` on recorded answers:

- **Endpoint and constants** are imported from `vextrus.settings.jev` (URL `https://api.typesafe.ai/v1/systemone`,
  deadline `VEXTRUS_JEV_DEADLINE_SECONDS` = 6 s whole-call, backoff, cool-off after 3 failures in a row for 60 s,
  maximum request 32,000 bytes, maximum response 65,536 bytes), over `httpx`; not the product's tenant-bound client.
- **Key:** read at call time from `$TYPESAFE_API_KEY` into the `Authorization` header only; never logged, printed,
  cached or put in an exception text. No key: `Unavailable("no_key")` with no call made.
- **Size:** a request body over the maximum is refused (`too_large`), never cut.
- **Retry:** 429, 529 and a dropped connection retry with backoff inside the one 6 s deadline; past it, `Unavailable`.
- **Deadline:** the 6 s holds for the whole call: each socket wait is cut to what is left of it, and name resolution
  too (a stalled resolver costs the deadline, then `timed_out`). `ask` also takes `client=` (an `httpx.Client`): a test
  seam, never a caller's way around the deadline; a passed client's exchange is held to the same 6 s (`timed_out`
  when it is not done by then).
- **Concurrency:** at most 10 calls at once across the process.
- **Cool-off:** after 3 outages in a row (`timed_out`, `busy`, `failed`, `unreachable`, `malformed`, `oversized`;
  a refusal is not one) every call is `cooling_off` for 60 s, then one call (the probe) tries again while the others
  still cool off; only the probe's own end frees its place, and a probe that fails trips the cool-off again at once.
  The cool-off holds **across processes** (every subcommand is its own short run):
  `.private/work/factory/jev-health.json`, numbers only (`{"failures": <n>, "last_failure_wall": <unix s>,
  "until_wall": <unix s> | null, "probe_wall": <unix s> | null}`), written atomically when an outage changes the
  count or the cool-off, deleted by name when an answer comes, read once at a run's first call. A tripped record
  stays until an answer deletes it: once its cool-off ends, the one run that claims the probe (under
  `jev-health.lock`) marks `probe_wall`, and every other run cools off while that mark is younger than 60 s (a run
  that dies with its probe out costs one cool-off). Failures that never tripped expire after 60 s. A file that is
  unreadable or malformed, or carries a time more than 60 s ahead of the wall clock, is ignored; a write that fails
  is ignored. A refusal before any request (`no_key`, `bad_question`, `too_large`) never touches it.
- **Cache:** every `Answers` is stored under `.private/work/factory/jev-cache/`, named by
  `<sha256(state, questions, model)>` (the sha256 of the canonical JSON of the three, sorted keys, so the same
  questions in any order give one digest): `<digest>.json` when the questions were asked in sorted name order, else
  `<digest>-<first 12 hex of sha256 of the names in the asked order, joined by NUL>.json`, so each order keeps its
  own answers. The file records the names in order and is read only for that order. A cache hit returns without a
  call. A recorded answer is a test fixture (`scripts/factory/tests/fixtures/jev/`, invented text only).
  `Unavailable` is never cached.
- **Log:** one line per call appended to `.private/work/factory/jev.log`:
  `<UTC> task=<name> model=<id the response named, or the requested id> status=<ok|unavailable:<why>> latency_ms=<n> input_tokens=<n> cache=<hit|miss>`.
  `task` is the caller's label (`triage`, `same-issue`, `models-check`). **Never the state, a question or an answer.**

## 2. The command line

`uv run python -m scripts.factory.jev <subcommand>`. Every subcommand is advisory, so no gate's decision depends on
it. **`triage` and `same-issue` exit 0 whether Jev answered or not** (an unavailable answer prints `unavailable
<why>` and writes nothing). **`models-check` is the one exception:** it exits 0, 1 or 2 by its own table below, and
only the watcher's alarm reads that code (an unexpected error inside it prints `unavailable failed` and exits 2). Exit
64: usage error, for every subcommand. Exit 1 from `triage` or `same-issue`: an unexpected error in the client itself
(the caller ignores it).

### `triage --from <file>`

Review triage in shadow (J-b). `<file>` is JSON `{"pr": <int>, "head_sha": "<40 hex>", "findings": [...]}` with the
findings in `review-verdict.schema.json`'s shape. One call per file: two questions per finding (a `noul` "is this
finding real" and a `score` or `choice` for severity). Writes the **sidecar**
`.private/work/factory/ledger-jev/<pr>-<head_sha>.json`:

```json
{"schema_version": 1, "pr": 250, "head_sha": "<40 hex>", "model": "jev-1.13.0", "written_at": "<UTC>",
 "findings": [{"index": 0, "p_real": 0.93, "severity": "high"}]}
```

`index` is the finding's position in the input; `p_real` is 0 to 1; `severity` is one of `low`, `medium`, `high`,
`critical`. Prints `triage <pr> <head_sha8> <n> findings` and exits 0. `Unavailable`: prints `unavailable <why>`,
**writes no sidecar**, exits 0. **Nothing reads the sidecar for a decision:** `ledger decide` and `merge_ready` give
the same result with or without it (`scripts/tests/test_ledger_jev.py`). Routing findings to a refuter by Jev starts
only after a shadow wave: at least 90 % agreement with refuter verdicts on at least 30 findings, recorded in ADR
0042's History. Jev never drops a finding or yields PASS.

### `same-issue --text <text> --issues <file>`

Walk and cut-item dedupe (J-d), called only after the exact (defect class, screen) rule found no match. `--issues` is
JSON `[{"number": <int>, "title": "<public title>"}, ...]`, the open issues' numbers and titles. One call, one `noul`
per issue title ("is the same defect as: ..."). Prints one JSON object:

```json
{"decision": "comment", "issue": 123, "p": 0.87, "jev": "ok"}
```

`decision` is `comment` when the best `p` is 0.8 or more (`issue` = that issue), `possible` when it is 0.3 to below
0.8 (open a new issue saying "possibly the same as #<issue>"), `new` when it is below 0.3 or there are no issues, and
`new` with `"jev": "unavailable"` (`issue` null, `p` null) when Jev was unavailable. Exit 0 whether or not Jev
answered.

### `models-check`

The Jev model watch (J-c); `watch.py` runs it once a day. It makes one one-question `jev-latest` call and reads the
response's `model` field, and reads `GET https://api.typesafe.ai/v1/models` for the release date of `jev-latest`
(the list names only the aliases `jev-latest` and `jev-preview`, never a version). The pinned version is the one in
`docs/knowledge/jev-nodes.md` (the node table's `model` column). Prints one line and exits:

| Output | Exit |
|---|---|
| `jev-model ok <version>` | 0 |
| `JEV-MODEL-MOVED <pinned> -> <seen>` (the `model` field left the pin) or `JEV-MODEL-MOVED release-date <old> -> <new>` | 1 |
| `unavailable <why>` | 2 (no alarm either way) |

The line is printed before the record (`jev-models.json`) is written, and the exit code follows the line: a record
that cannot be written is only a lost record, never exit 2 or a second line.

On exit 1 `watch.py` raises the `JEV-MODEL-MOVED` alarm (status.schema.json) and adds a "re-run `jev_spot_check`" item
to the milestone issue (ADR 0011 rule 3). `models-check` also reads the `model` field of every factory call in
`jev.log` for the same comparison (a call that came back with another version is the earliest sign).
This is the only subcommand that exits non-zero for a reason other than a usage or internal error.

## 3. Decided here (the spec is silent)

The spec fixes: the signature `ask(state, questions, *, model="jev-1.13.0") -> Answers | Unavailable`, `httpx`, the
constants' source, the key rule, the cache path, the log line's content (task, model id, latency, input tokens;
never the state), the 6 s deadline and cool-off after 3 failures, at most 10 concurrent calls, the three
subcommands, the sidecar folder, the same-issue thresholds (0.8, 0.3) and the model watch's two readings and alarm
name. This file decides what it leaves open: the question dict shapes, the sidecar's file name and fields, the
severity words, `same-issue`'s arguments and output, the exit codes and the `models-check` output lines.
PR f9 may refine them only by changing this file first.
