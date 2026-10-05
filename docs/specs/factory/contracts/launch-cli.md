# `python -m scripts.factory.launch`: the launcher's command line

Contract (PR f0) for `scripts/factory/launch.py`: `cloud`, `say` and the `local` arguments (PR f1), with
`scripts/factory/local.py` (PR f3) behind `local`. Callers: the orchestrator, `scripts/factory/review_cloud.py`
(PR f4), the watcher's alarms (they read the launch records), and the guard (PR f2), which refuses every raw
`claude ... --cloud` and every raw `claude --bg` so that this is the only door.
Source: `docs/specs/factory.md` 2.1, 2.2 ("Launch, cloud", "Launch, cloud review", "Message a cloud builder",
"Launch, local", "Launch record"), 2.4, 8; ADR 0042 item 3. Today's `scripts/cloud/launch.py` (judge, exit 0 or 2)
moves here and is deleted. Run from the **main checkout** (`/home/riz/vextrus-cubit`) with
`uv run python -m scripts.factory.launch <cloud|say|local> ...`.

## 1. Exit codes (all three subcommands)

| Code | Meaning | First stdout line |
|---|---|---|
| 0 | Launched (or sent) and judged good. | `OK <reason> <session_id>` (`say`: `OK sent <session_id>`) |
| 2 | **Refused.** Either before launch (a precondition failed: nothing was started) or after launch (the log judged it bundled, another repo or another revision: a session exists). | `REFUSED <code>: <reason>` and, if a session was created, ` <session_id>` at the end |
| 3 | The governor refused the unit (`governor.py check <unit>` exited 3). Nothing was started. | `REFUSED governor: <the governor's reason>` |
| 1 | The launcher itself failed (the CLI is missing, a file is unreadable, an unexpected error). | `ERROR <one line>` |
| 64 | Usage error (a missing or unknown argument). | usage text on standard error |

Exit 2 is the existing launcher's REFUSED code (`scripts/cloud/launch.py`: `return 0 if verdict.ok else 2`) and ADR
0042's "the launcher exits 2". Usage errors use 64, not 2, so a REFUSED is never mistaken for a typo
(argparse's default usage code is 2: the launcher's parser overrides it).

**A refused cloud launch keeps running** (VCC:463). When the refusal is after launch and a session id is known, the
launcher at once sends `claude -p "STOP: launched wrongly. Do nothing; push nothing." --cloud <id> --output-format
json < /dev/null`, records the send in the launch record (`stop_sent`) and prints a final line `DELETE <id>` so the
orchestrator adds it to the owner's list to delete in claude.ai/code (O8).

`<code>` in `REFUSED <code>: ...` is one of: `not-main-checkout`, `branch-not-on-origin`, `no-acceptance-commit`,
`prompt-leak`, `leakscan-unavailable`, `bundled`, `wrong-repository`, `wrong-revision`, `no-git-source`,
`no-session`, `wrong-environment` (the log names another environment, or the CLI fell back to the first one),
`launch-timeout` (the CLI did not finish in 180 s and a session exists), `branch-not-rd` (a `--drawings` launch on a branch not starting `rd/`), `duplicate-name` (local),
`merge-conflict` (local, carried branch), `no-preflight` (before f3: neither `--preflight` nor governor),
`send-failed` (`say`: the CLI did not return `ok: true`), `governor` (exit 3: the governor refused the unit). The list is closed: a new code is added here first.

## 2. `launch cloud`

```
launch cloud --branch <branch> --prompt-file <file> --ticket <ticket> --effort <low|medium|high>
             [--model <id>] [--role <builder|acceptance-writer|reviewer|refuter>]
             [--untestable "<why>"] [--preflight "<lines>"] [--usage-checked "<lines>"]
             [--prompt-scanned "<count line>"] [--drawings] [--budget-minutes <n>]
             [--review-file <json>] [--log <path>] [--repository <host/owner/repo>]
```

| Option | Meaning |
|---|---|
| `--branch` (required) | The ticket's branch, pushed to origin. |
| `--prompt-file` (required) | The prompt text. Its first lines tell the session to check `git remote get-url origin` and its branch and to stop without pushing if either is wrong (the launcher prepends those lines itself, so a prompt file need not carry them). A builder's prompt begins "Follow `.claude/agents/builder.md`". |
| `--ticket` (required) | The ticket id (`f1`, `t228`), the launch record's key. |
| `--effort` (required) | Passed as `--effort`. Always set explicitly (CLAUDE.md). |
| `--model` | Default `claude-opus-5-5`. |
| `--role` | Default `builder`. Recorded in the launch record; `acceptance-writer` (it makes the acceptance commit), `reviewer` and `refuter` (their branch is a review branch) need no acceptance commit. |
| `--untestable "<why>"` | Waives the acceptance-commit refusal; the reason is recorded. |
| `--preflight "<lines>"` | Before f3's governor exists: the `df`, free and `/usage` lines read by hand, recorded. Ignored once `governor.py` exists. |
| `--usage-checked "<lines>"` | After the orchestrator read `/usage` itself because the governor could not parse it; recorded. |
| `--prompt-scanned "<count line>"` | Before f2's leak scan exists: the interim `lits2` count line, recorded. Ignored once `tools/leakscan` exists. |
| `--drawings` | Tier 2, session 13: a drawing ticket. The branch must start `rd/`; the prompt must forbid PR comments and every push but code; the session runs in the `vextrus-drawings` environment. |
| `--budget-minutes` | The ticket's budget, recorded for the watcher's `BUDGET-PASSED`. |
| `--review-file` | For `--role reviewer` or `refuter` (called by `review_cloud.py`): a JSON file `{"pr": <int>, "head_sha": "<40 hex>", "nonce": "<32 hex>"}`; copied into the launch record's `review` object. The nonce is never taken from the command line. |
| `--log` | Debug-log path; default `.private/work/factory/launches/<ticket>-<utc>.debug.log`; never overwritten. |
| `--repository` | Default `github.com/vextrus/vextrus-cubit`. |

**Refusals, in this order** (the first that applies decides the code; each has a test):

1. `not-main-checkout`: the current directory is not the main checkout (an untrusted folder hung at the trust dialog).
2. `branch-not-on-origin`: `git ls-remote --heads origin <branch>` returns no sha. A stale local `origin/<branch>`
   ref does not count.
3. `no-acceptance-commit`: `origin/<branch>` carries no commit whose message starts `acceptance:`, and neither
   `--untestable` nor a `--role` of `acceptance-writer`, `reviewer` or `refuter` is given.
4. governor (exit 3): `python -m scripts.factory.governor check cloud-session` exits 3 (or, before f3, no
   `--preflight`: `no-preflight`, exit 2).
5. `prompt-leak` or `leakscan-unavailable`: `python -m tools.leakscan text --stdin < <prompt>` exits 1 or non-zero
   (leakscan-cli.md), or, before f2, `--prompt-scanned` is absent.
6. `branch-not-rd`: `--drawings` with a branch not starting `rd/`.

If none refuses, it runs **exactly the proven argv** (`cloud/launch_probe.py:65-72`; the prompt is the last element,
the same text the scan passed):

```
["claude", "--debug-file", <log>, "--model", <m>, "--effort", <e>, "--on-branch", <branch>, "--cloud", <prompt>]
```

(under `script -q -c ... /dev/null`, because the CLI wants a terminal). It then reads the log with `judge()` and
refuses (exit 2, STOP sent) a log that says bundled (`bundled`), another repository (`wrong-repository`), another
revision (`wrong-revision`), no git source (`no-git-source`) or no session (`no-session`). A CLI version not yet in the
private list `.private/work/factory/proven-cli.txt` is allowed one launch, which is judged; OK adds the version.

## 3. `launch say`

```
launch say <session_id> --file <file>
```

Leak-scans the text (`tools/leakscan text --stdin`; a hit is exit 2 `prompt-leak`), prefixes `[elapsed n/m min]` (ADR
0041 item 4, from `stamp elapsed`), sends `claude -p "<msg>" --cloud <session_id> --output-format json < /dev/null`
and reads `{ok}`. Prints `OK sent <session_id>` on `ok: true`, else `REFUSED send-failed: <reason>` with exit 2.
One message per review round. A CLI-sent message has no reply address; two-way exchange is the orchestrator's main
conversation by SendMessage (not this command).

## 4. `launch local`

```
launch local --branch <branch> --prompt-file <file> --ticket <ticket> --name <name> --effort <low|medium|high>
             [--model <id>] [--role <builder|acceptance-writer>] [--budget-minutes <n>]
```

`launch.py` parses it and `scripts/factory/local.py` (PR f3) runs it: the governor first (`check local-agent`: exit 3
when it refuses); `git fetch origin`; a worktree at `origin/<branch>` under `.claude/worktrees/<ticket>`; if the branch
lacks `.claude/agents/builder.md`, `origin/main` is merged into it first as a recorded merge commit (`merge-conflict`,
exit 2, on a conflict); `ensure_database` for the worktree; `duplicate-name` (exit 2) if a live session already has
`--name`. From inside the worktree it runs `claude --bg --agent builder --name <name> --effort <e> --settings
/home/riz/vextrus-cubit/scripts/factory/builder.settings.json "<prompt>"` with the child environment
`VEXTRUS_ROLE=builder`, and without `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` and `CLAUDE_CODE_PLUGIN_DIRS`. It never
passes `--plugin-dir`. First stdout line: `OK launched <name> <session_id>`. A local builder is never started by a raw
`claude --bg` (the guard refuses it once `scripts/factory/local.py` exists).

## 5. The launch record

Both paths write `.private/work/factory/launches/<ticket>-<utc>.json` (`<utc>` = `YYYYMMDDTHHMMSSZ`) and, beside it,
`<ticket>-<utc>.agents.json` (the output of `claude agents --json --all`). Append-only: never overwritten. The
launcher prints a last line `record: <path>`. Fields (the watcher, `review_cloud.py` and `ledger.py fetch-verdict`
read them):

| Field | Type | Notes |
|---|---|---|
| `ticket`, `branch` | string | |
| `where` | `"cloud"` or `"local"` | |
| `role` | string | as `--role` |
| `effort`, `model` | string | |
| `budget_minutes` | integer or null | |
| `session_id` | string or null | `session_...` for cloud, the full UUID for local; null if refused before launch |
| `cli_version` | string | `claude --version`'s version |
| `started_at` | UTC string | |
| `governor` | object | the governor's reading (or the `--preflight` / `--usage-checked` lines) |
| `leak_scan` | object | `{"status": "clean" or "interim", "line": "<summary or --prompt-scanned line>"}` |
| `judge` | object | `{"ok": bool, "code": "<code>", "reason": "<text>"}` (cloud) |
| `stop_sent` | boolean | true if a STOP message was sent after a refusal |
| `untestable` | string or null | the `--untestable` reason |
| `review` | object or null | present only for `review_cloud.py` launches: `{"pr": int, "head_sha": "<40 hex>", "nonce": "<32 hex>", "branch": "review/<pr>-<nonce8>"}`. **Only this record and that reviewer's prompt hold the nonce** (review-verdict.schema.json). |

The record holds no prompt text and no key. (The nonce is a launch-time secret between the launcher and one reviewer;
it is not a drawing or an API key but is still never printed in a PR or a log.)

## 6. Decided here (the spec is silent)

The spec fixes: the proven argv, the refusal list (branch on origin, main checkout, acceptance commit or
`--untestable`, governor or `--preflight`, leak scan or `--prompt-scanned`), the STOP message and its text, `--usage-checked`,
`--drawings`, `say <session> --file <f>`, the local `claude --bg ...` line, the child environment, the record's
fields, and exit 2 for a bad launch (ADR 0042). This file decides what it leaves open: the other option names
(`--ticket`, `--role`, `--budget-minutes`, `--review-file`, `--log`), exit 3 for the governor (the governor's own code), 64 for usage
and 1 for the launcher's own failure, the `REFUSED <code>` words, the `OK`/`REFUSED` first line (from today's launcher),
and the record's exact keys. PR f1 may refine them only by changing this file first.
