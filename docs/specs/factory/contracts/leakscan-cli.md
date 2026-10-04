# `python -m tools.leakscan`: the leak scan's command line

Contract (PR f0) for the tool PR f2 builds (`tools/leakscan/`) and for every caller: the guard's stamp check (PR f2),
`scripts/git-hooks/pre-push` (PR f2), `scripts/factory/launch.py` (PR f1: every cloud prompt and `say` message),
`scripts/factory/watch.py` (PR f3: each new cloud head), `scripts/merge_ready.py` (PR f4: the PR re-scan),
`scripts/ledger.py` (PR f4: the text it posts), `scripts/walk/` (PR f5: walk outputs and issue drafts).
Source: `docs/specs/factory.md` 5 "How walk outputs and drawing text stay out of git", 2.2, 3.6, 3.7, 3.9.
Run from the main checkout, as the owner's Unix user, with `uv run python -m tools.leakscan ...`.

**The rule that never bends: the tool never prints the text it found.** It prints a location and a count. Its output,
its stamps and its allowlist hold locations, counts and hashes, never a corpus string, a line of the scanned text, or
a file name that matched.

## 1. Data it reads and writes

| Path | What | In git? |
|---|---|---|
| `.private/work/leakscan/corpus` | The literal corpus: normalised strings of 8 or more characters taken from every TEXT, MTEXT and ATTRIB entity of each DWG under `.private/reference/`, the Plot PDFs' text, `~/.cache/vextrus-real-drawings/exports/`, `.private/work/walks/*/` and `.private/work/**/*.md`. One file; built by `build`. | never |
| `tools/leakscan/allowlist.txt` | One sha256 hex per line of a normalised generic string that may appear (never the string). Added only by `allow`. | yes |
| `.private/work/leakscan/ok/<name>` | The stamps (section 4). | never |

**Normalisation** (one function, used to build the corpus and to scan): Unicode NFKC, runs of whitespace collapsed to
one space, trimmed, upper-cased. A corpus string is a normalised string of 8 or more characters containing at least
three consecutive letters. A string whose sha256 is in `allowlist.txt` is not a hit. Every line, message and name is
normalised the same way and tested for containing any corpus string.

## 2. Subcommands

Each scan subcommand prints hit lines and one summary line (section 3) and exits with a code (section 5).

| Command | Scans | Writes a stamp |
|---|---|---|
| `build` | Rebuilds the corpus from its sources (locally; through the engine's own DWG reader). Prints `corpus: <n> strings, sha256 <first 12 hex>` and exits 0, or 2 if a source cannot be read. | no |
| `range <base>..<head> [--ref <name>]` | The range's **added lines** (`git diff <base>..<head>`, new side), its **commit messages**, its **changed file names** and, with `--ref`, the **ref name** being pushed. `<base>` and `<head>` are revisions; the stamp pins both as full shas. | yes (name = the full `<head>` sha) |
| `file <path>` | One body file (a `gh ... --body-file` text). | yes (name = the file's sha256) |
| `text --stdin` | The text on standard input: a cloud launch prompt or a `launch.py say` message. `--stdin` is required (text is never taken from the command line, which `ps` shows). | yes (name = the text's sha256) |
| `pr <number>` | A PR as `merge_ready` re-scans it before every merge: the PR's added lines, commit messages, file names, branch name, title, body and every comment (through `gh`, reads only). | no |
| `dir <path>` | Every file under a folder (a walk's outputs, `.private/work/walks/<sha40>/`), text files by line, other files by name only; binary files are scanned as bytes for a corpus string. | no |
| `bodies --since <date>` | Every issue and PR body edited since `<date>` (`YYYY-MM-DD` or a UTC timestamp), and their comments. Run each wave. | no |
| `allow <file>:<line>` | Hashes the corpus strings that hit on that line of that file into `tools/leakscan/allowlist.txt` (appends sha256 lines; never prints a string). Refused if the line has no hit. | no |
| `verify-stamp <name>` | Exits 0 if `.private/work/leakscan/ok/<name>` exists, parses, its `corpus` equals the current corpus hash and its `range` is consistent with `<name>`; else 1. This is the check the guard performs in its own code; the command exists for tests and humans. | no |

Common options: `--quiet` (print only the summary line), `--json` (print the hit list and summary as one JSON object,
section 3, instead of lines).

## 3. Output

One line per hit, on standard output:

```
HIT <where> <n>
```

`<n>` is the number of corpus strings found at that place (1 or more). `<where>` is one of:

| `<where>` | Names |
|---|---|
| `<path>:<line>` | an added line: the path in the new tree and the 1-based line number in the new file. (A path that itself matched is printed as `name:<i>` instead, below.) |
| `commit:<sha12>:<line>` | line `<line>` (1-based) of that commit's message |
| `name:<i>` | the `<i>`th changed file name (0-based, in `git diff --name-only <range>` order); never the name |
| `ref` | the ref name |
| `stdin:<line>` / `file:<line>` | a line of the text on standard input / of the body file |
| `pr:<n>:title`, `pr:<n>:body:<line>`, `pr:<n>:comment:<id>:<line>`, `pr:<n>:branch` | parts of a PR |
| `issue:<n>:body:<line>`, `issue:<n>:comment:<id>:<line>` | parts of an issue |
| `dir:<relative path>:<line>` | a line under a scanned folder (`name:<i>` as above if the name matched) |

The **last line** is always one summary line:

```
leakscan: hits=<N> scanned=<M> corpus=<12 hex>
```

`N` is the total of the `<n>` values, `M` the number of lines, messages and names examined, and `corpus` the first 12
hex characters of the corpus hash. When it cannot scan: `leakscan: cannot-scan <reason>`, where `<reason>` is one of
`no-corpus`, `corpus-unreadable`, `bad-range`, `gh-failed`, `source-unreadable` (a fixed word, never text). In a cloud
session (`CLAUDE_CODE_REMOTE=true`) with no corpus the line is `leakscan: skipped no-corpus (cloud)` and the exit code
is 0 with **no stamp written** (spec 5, item 8: the corpus never goes to CI or the cloud).

`--json` prints exactly one object: `{"hits": [{"where": "<where>", "n": <int>}, ...], "summary": {"hits": <N>,
"scanned": <M>, "corpus": "<12 hex>", "status": "clean|hits|cannot-scan|skipped", "reason": "<word or null>"}}`.

## 4. The stamp

A clean scan by `range`, `file` or `text` writes `.private/work/leakscan/ok/<name>`, atomically (temp file in the
folder, then rename). `<name>` is the full 40-hex head sha for `range`, and the sha256 (64 hex) of the file's or
text's bytes for `file` and `text`. The content is one JSON object with exactly two fields, the corpus hash and the
scanned range:

```json
{"corpus": "<sha256 hex of the corpus file's bytes>", "range": "<base40>..<head40>"}
```

`range` is `"<base40>..<head40>"` for a `range` scan and `"sha256:<64 hex>"` for `file` and `text`. A stamp is **valid**
when its `corpus` equals the sha256 of the corpus file as it is now (so rebuilding the corpus voids every older
stamp) and its `range`'s last part equals `<name>`.

**What the guard checks** (a file check; no scan, so it cannot fail open on the 10 s hook timeout): for a `git push`
from the main checkout, the stamp named by the head sha being pushed is valid; for a `gh` body write, the stamp named
by the sha256 of the `--body-file`'s bytes is valid; inline `--body` text longer than a short title is refused outright.
The guard computes the corpus file's sha256 itself. Only `python -m tools.leakscan` writes a stamp: a hand-written
file, a `tee` or a redirect to that folder is refused (f2's `permissions.deny` and guard rules).

## 5. Exit codes

| Code | Meaning |
|---|---|
| 0 | Clean (`hits=0`; a stamp is written where section 2 says), or `skipped` in a cloud session with no corpus, or `build`/`allow`/`verify-stamp` succeeded. |
| 1 | One or more hits (`hits` above 0), or `verify-stamp` found the stamp missing or invalid. No stamp is written. |
| 2 | Cannot scan: no corpus, an unreadable corpus or source, a bad range, `gh` failed. Fails closed: a caller treats it as a hit. |
| 64 | Usage error (unknown subcommand, missing argument, `text` without `--stdin`). |

Callers must treat anything but 0 as "refuse". A non-zero exit prints the summary line to standard output and a
one-line reason to standard error; neither holds scanned text.

## 6. How callers use it

| Caller | Command | On non-zero |
|---|---|---|
| `launch.py cloud` and `launch.py say` | `python -m tools.leakscan text --stdin < <prompt>` | refuse the launch or message (launch-cli.md exit 2) |
| the orchestrator, before `git push` | `python -m tools.leakscan range <merge-base>..<head> --ref <branch>` | the guard refuses the push |
| the orchestrator, before `gh ... --body-file f` | `python -m tools.leakscan file f` | the guard refuses the write |
| `scripts/git-hooks/pre-push` | `python -m tools.leakscan range <remote-sha-or-merge-base>..<local-sha> --ref <ref>` for each pushed ref | the push is refused |
| `merge_ready` | `python -m tools.leakscan pr <PR>` | not ready |
| `watch.py`, each new cloud head | `python -m tools.leakscan range origin/main..<head>` (no stamp is needed to scan; none is written for a scan the watcher does not own) | `LEAK-HIT` alarm (status.schema.json) |
| `scripts/walk/` | `python -m tools.leakscan dir .private/work/walks/<sha40>/` and `text --stdin` per issue draft | the verdict is not written |
| each wave | `python -m tools.leakscan bodies --since <date>` | the orchestrator edits or deletes the body and files the leak |

Before f2 lands, the interim count is session 11's `lits2.py` (prints a count line only); `launch.py` takes it as
`--prompt-scanned "<count line>"` (launch-cli.md).

## 7. Decided here (the spec is silent)

The spec fixes: the corpus path, the hashed allowlist, what is scanned, "prints `file:line` and a count, never the
text", the stamp's folder, name (`<sha or sha256>`) and content (corpus hash, scanned range), the guard's file check,
and `allow <file:line>` and `bodies --since <date>` and `text --stdin`. This file decides what it leaves open:
the other subcommand names, the exact `<where>` forms, the summary line, the exit codes (0, 1, 2, 64), the stamp's
JSON form, the normalisation, the allowlist's file name, and that a stamp is voided by a rebuilt corpus. PR f2 may
refine them only by changing this file first.
