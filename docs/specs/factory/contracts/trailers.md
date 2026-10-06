# Commit and PR-body lines the factory reads

Contract (PR f0) for `docs/specs/factory.md` 2.2 "Builder's finish", 3.3 (`acceptance-writer`), 3.4 (`verify`),
3.6 (the guard), 5 (definition of done). Producers: a builder (by `.claude/agents/builder.md`) and `verify`
(PR f4). Consumers: the guard's READY push gate (PR f2), `scripts/factory/watch.py` (PR f3),
`.claude/hooks/stop-gate.mjs` (PR f6), `tools/lint/acceptance.py` (PR f4), `scripts/merge_ready.py` (PR f4). Every
consumer's test asserts the ten cases at the end of this file.

**READY and BLOCKED are these exact trailers, never a reading of free text** (Jev read "All checks pass but I am
blocked on review" literally; spec 2.2 and 3.14).

## 1. The builder's finish trailers

Three trailer keys, in git's trailer form (`Key: value`, one per line), in the paragraph the factory reads: **the last
paragraph holding a `Factory-*` line among the message's last two** (issue #448). So the Factory block may end the
message, sit among the attribution trailers `Co-Authored-By` and `Claude-Session` (which the factory ignores), or sit
just before a paragraph of them, a blank line between (the T-W317 shape). Every consumer reads it with one reader:
`scripts/factory/trailers.py` (the watcher's) and `.claude/hooks/trailers.mjs` (the stop gate imports it; the guard,
which is self-contained, carries the same block byte for byte), written to agree on every input and tested so
(`scripts/factory/tests/test_trailers.py`, `.claude/hooks/trailers.extra.test.mjs`).

Never silence: a `Factory-*` line (or a loose `Factory-State` line: `factory_state`, `Factory State`, a leading space,
any case, ASCII case folding) in any other paragraph makes the head **malformed** with the reason "factory trailer not
in the last paragraph", whatever it says. A READY-looking `Factory-State` line (a loose key, a value containing
`ready`) in the last two paragraphs **gates** the head: the guard's push gate and the stop gate treat it as READY,
and on a head that does not read as READY it is malformed too (`READY-NO-VERIFY` to the watcher). A READY line further
back is alarmed but not gated, since prose quoting the trailer may sit in a body.

| Key | Value (exact) | Meaning |
|---|---|---|
| `Factory-State` | `READY` or `BLOCKED` | The builder has finished (READY) or cannot go on (BLOCKED). |
| `Factory-Verify` | `<tree> ok` | `<tree>` is 40 lowercase hex characters: the tree id `verify` printed, equal to the tree of this very commit. |
| `Factory-Reason` | one line of text | Why the builder is blocked. |

Grammar of the values, as regular expressions on the value alone (after git's trimming of the space after the colon):

- `Factory-State`: `^(READY|BLOCKED)$`. Upper case; no other word means anything.
- `Factory-Verify`: `^[0-9a-f]{40} ok$`. One space, the word `ok`, nothing after.
- `Factory-Reason`: `^[^\r\n]{1,200}$`. One line, 1 to 200 characters, public words (a reason is leak-scanned like
  every other message: no drawing text).

Which keys go together:

| Head's `Factory-State` | `Factory-Verify` | `Factory-Reason` |
|---|---|---|
| `READY` | **required** | **must be absent** |
| `BLOCKED` | optional | **required** |
| (no `Factory-State`) | must be absent | must be absent |

A head that breaks the table, repeats a key (each key appears at most once), or whose `Factory-Verify` tree differs
from `git rev-parse <head>^{tree}` is **malformed**: every consumer treats a malformed head as carrying no trailer at
all and, where it raises alarms, raises `READY-NO-VERIFY` (status.schema.json) when a READY-looking `Factory-State`
is on it, or when a factory line sits outside the read paragraph (above). The gates gate a head by the READY-looking
line rule above.
Key spelling: producers write the keys exactly as above; a parser may match the key case-insensitively (git does) but
the values stay case-sensitive.

**Only the branch tip counts.** A consumer reads the trailers of the tip commit (`HEAD` of the builder's branch).
A trailer on an older commit means nothing, with one exception in `scripts/factory/watch.py`: a tip with no factory
trailer that is only clean merges of main (two parents, the second on origin/main, the tree `git merge-tree` makes
from them) on the head the watcher last saw READY (the lander's merge) stays READY, with no new READY event.

### What each consumer does with them

- **The guard's READY push gate** (`.claude/hooks/guard.mjs`): for a push whose head's message carries
  `Factory-State: READY`, requires `<git-common-dir>/vextrus/verify-<HEAD^{tree}>.json` to exist with every
  `exit_code` 0 (verify-record.schema.json). A head with BLOCKED, or with no trailer, is not gated by this rule. A
  malformed head carrying `READY` is gated too (so a mistyped trailer cannot dodge the gate).
- **`scripts/factory/watch.py`**: a new branch tip is fetched and its trailers read. READY with a matching
  `Factory-Verify` raises the READY event (the builder's state is `ready`); READY with no matching tree raises
  `READY-NO-VERIFY`; BLOCKED shows the builder as `blocked` with its reason in `events.log` (public words only); a
  READY head unmerged for 10 minutes raises `READY-WAITING`. It also fires for a READY head already present when it
  starts. A local builder (never an acceptance-writer, nor one whose PR is closed) that has committed, whose head is
  neither READY nor BLOCKED, and whose `claude agents` row has read idle for 10 minutes (`status: idle`, or its
  session ended: no pid, state done, stopped or failed) raises `LOCAL-IDLE` (a builder that stopped without its
  trailer). A re-read of seen heads (a new trailer reading) keeps a READY inherited onto clean merges of main.
- **`.claude/hooks/stop-gate.mjs`** (builder sessions only): a stop with uncommitted tracked changes and no trailer,
  or a READY or malformed (`READY-NO-VERIFY`) head with no green verify record (a malformed one: always), is blocked
  once with the text "commit with explicit paths and run
  verify, or finish `Factory-State: BLOCKED` with a reason".
- **`verify`** prints exactly one line, `Factory-Verify: <tree> ok`, when every check's `exit_code` is 0, and prints
  nothing of that form otherwise.

### Example (a builder's last commit)

```
feat(launch): the cloud launcher refuses a branch origin does not list

Not verified: the live launch (needs the owner's cloud session).
Verify: pytest 0, ruff 0, mypy 0, lint-imports 0.

Factory-State: READY
Factory-Verify: 0f3c1d5e7a9b2c4d6e8f1a3b5c7d9e0f2a4b6c8d ok
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_example
```

```
fix(launch): stop wait loop

Factory-State: BLOCKED
Factory-Reason: the acceptance tests for the refusal cannot pass: the spec names no exit code
```

## 2. The body of that commit is the PR body

The builder's last commit's body becomes the PR body (spec 2.2). Three machine-read parts, all in public words:

1. **What was not verified comes first,** then the verify summary (each check's name and exit code).
2. **`## Cut`, `## Not done`, `## Deferred`:** a heading with exactly one of these three titles (any heading level)
   starts a section. `scripts/merge_ready.py` refuses a PR whose body has, under any of them, a list item that does
   not contain a link to an issue of this repository that is open (`#<n>` or a `github.com/vextrus/vextrus-cubit/issues/<n>`
   URL). A section with no list items passes.
3. **`Harness net: +<a> / −<r>`** (a PR that changes `.claude`, `scripts`, `tools` or `.github`): `a` and `r` are the
   added and removed line totals of `git diff --numstat origin/main...HEAD -- .claude scripts tools .github` (three
   dots: the PR's own changes since its merge base, not main's later commits). The minus
   sign is U+2212 as written here; a parser also accepts ASCII `-`.

## 3. The acceptance commit's counts

An acceptance commit's message starts `acceptance:` and changes only files under the acceptance paths
(`tools/lint/acceptance.py`). From PR f4 its message also carries two lines, each on its own line, anywhere in the
message body:

| Line (exact form) | Regular expression | Meaning |
|---|---|---|
| `red-on-main: <n> failed` | `^red-on-main: ([0-9]+) failed$` | The writer ran the new tests on `origin/main`: `n` failed. Must be 1 or more. |
| `green-on-throwaway: <n> passed` | `^green-on-throwaway: ([0-9]+) passed$` | On a throwaway implementation the same tests passed: `n`, equal to the count of tests written. Must be 1 or more. |

An `acceptance:` commit without both lines fails the lint, unless its full sha is in
`tools/lint/acceptance_legacy.txt` (the carried branches' older commits). An untestable ticket carries no acceptance
commit and says why in the launch (`--untestable "<why>"`, launch-cli.md).

From S14-AL the message also states why each file is red and what values the tests pin, each on its own line
anywhere in the message, read by the acceptance lint (`python -m tools.lint.acceptance_lint <base> <branch>...`,
which the orchestrator runs on each acceptance commit before launching its builder; not a CI check):

| Line (exact form) | Regular expression | Meaning |
|---|---|---|
| `red-for: <path> <reason>` | `^red-for:[ \t]+(\S+)[ \t]+(\S.*?)[ \t]*$` | `<path>` is a test file the acceptance commits add, as in the commit. Every test of it red on the base fails with an error line (pytest's `E` lines or the failure's message, never the quoted source) containing `<reason>` (one line per reason; any one may match; a reason `No module named '<module>'`, the module one the test or a helper beside it imports (or loads by name with `importlib.import_module` or `__import__`) or a parent of one, also matches the same error naming a parent package of it, which Python names when the package is new too). A Python test file with a red test and no `red-for:` line fails the lint; a file a later `acceptance:` commit deletes keeps no reason; a web file's line is recorded, not checked. |
| `pin: <key> = <value>` | `^pin:[ \t]+([^=\s]+)[ \t]*=[ \t]*(\S.*?)[ \t]*$` | The tests pin `<key>` to `<value>` (a dotted name the writer chooses, e.g. `review.allowlist_only_tier`). Across the branches linted together (the first judged in full, the others read for their pins only), two pins of one key to different values fail, naming both branches and the key; so does a pin against a `ruling: <key> = <value>` line in `docs/rulings.md` at the base (no register, no rulings). |

The lint also refuses a test file that does not collect as it is. The one collection failure allowed is an import
of a module of the tree's own packages that does not exist yet (or a name missing from one): such a file is
printed as a note, "collects after build: <module>", and its setup is not planned, so a misspelt fixture in it
is found only when the builder runs it (#513). A file that collects has its setup planned, so a fixture pytest
does not have, or a test with an empty parameter set, is refused. It refuses too a test file that collects no test, has no test red on the base, or has a test skipped or xfail there
(under either user), a `pin:` or `red-for:` line not in its form, `lint-imports` or `mypy` failing on the acceptance files, and a test red for
another reason as a non-root user (`nobody` when the lint runs as root) or as root (`unshare -r` when the lint
does not). An amendment (`scripts.factory.amend`) replaces: per file, the newest `acceptance:` commit stating
`red-for:` reasons for it wins, and per key the newest `pin:`; an older malformed or mistyped declaration is
superseded the same way (a `pin:` line by a newer pin of its key, a `red-for:` line by a newer commit stating
`red-for:` lines). The lint's pytest runs carry their own `-m`, so a base's addopts deselecting the opt-in
marks (`needs_toolchain`, `needs_bwrap`) do not hide a marked file: it is judged, except where its mark cannot
run (`needs_toolchain` without `/opt/vextrus`, `needs_bwrap` without `bwrap`): those tests are named "not judged
here", never refused. A test marked `live` is refused, named, and never run: CI's acceptance check never runs a
live test, so the built branch would fail it as deselected. Laying out the tree never writes through a
symlink. The test database a run makes (its name hashes
the run's own tree) is dropped by name after it. It exits 0 clean and 1 with each problem printed. Commits before S14-AL carry no `red-for:` line and
fail its stated-reason check: run it on new acceptance commits.

## 4. Fixtures every consumer tests against

Only PR f3 commits trailer fixture files: one commit message per case, under `scripts/factory/tests/fixtures/trailers/`.
PR f2 (the guard's READY push gate) and PR f6 (`stop-gate.mjs`) commit none, and nothing goes under
`.claude/hooks/tests/fixtures/trailers/`: each generates the ten cases inside its own tests, from this table. Each
consumer's test asserts the outcome in this table:

| Case | Message ends with | Parsed as |
|---|---|---|
| ready-ok | `Factory-State: READY` + `Factory-Verify: <tree of the commit> ok` | READY, verified |
| ready-no-verify | `Factory-State: READY` only | malformed READY (gated by the guard; alarm) |
| ready-wrong-tree | READY + `Factory-Verify: <another tree> ok` | malformed READY (gated; alarm) |
| ready-with-reason | READY + verify + `Factory-Reason: x` | malformed READY (gated; alarm) |
| blocked-ok | `Factory-State: BLOCKED` + `Factory-Reason: <text>` | BLOCKED |
| blocked-no-reason | `Factory-State: BLOCKED` only | malformed (treated as no trailer) |
| repeated-key | two `Factory-State` lines | malformed |
| lowercase-value | `Factory-State: ready` | malformed (a READY-looking word is gated as READY) |
| none | no factory trailer | no trailer |
| older-commit-only | READY on the parent, none on the tip | no trailer |
