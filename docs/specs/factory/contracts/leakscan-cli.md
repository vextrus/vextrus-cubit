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
| `range <base>..<head> [--ref <name>] [--no-stamp]` | **Every commit in the range, one by one** (a push publishes each commit, not only the net diff: text added in one commit and removed in a later one is still sent): each commit's **added lines** (its own diff against its parent, read as text whatever `.gitattributes` says, no textconv; a merge, what it did beyond the automatic merge), the text in each **binary blob** it adds (UTF-16 decoded, gzip and zip opened, PDF streams inflated and their text operators (`Tj`, `TJ`, `'`, `"`) assembled, printable runs), its **commit message** and every **file name** it touches; with `--ref`, the **ref name** being pushed. `<base>` and `<head>` are revisions; the stamp pins both as full shas. (Changed by PR f2's review, round 1; it was the net `git diff <base>..<head>`.) When `<base>` is not an ancestor of `<head>` (the natural `origin/main..HEAD` after another PR landed) and their merge-base is an ancestor of `origin/main`, it scans `<merge-base>..<head>` instead (a superset of what the push publishes) and stamps that (section 4). A clean scan that writes no stamp for any other reason prints one line on standard error, `leakscan: clean, but no stamp written: <base12> is not an ancestor of origin/main and of the head; scan <merge-base12>..<head12>` (the merge-base of `origin/main` and the head; the `; scan ...` part is left out when they have none), unless `--no-stamp`. | yes (name = the full `<head>` sha), unless `--no-stamp` |
| `file <path> [--no-stamp]` | One body file (a `gh ... --body-file` text). | yes (name = the file's sha256), unless `--no-stamp` |
| `text --stdin [--no-stamp]` | The text on standard input: a cloud launch prompt or a `launch.py say` message. `--stdin` is required (text is never taken from the command line, which `ps` shows). | yes (name = the text's sha256), unless `--no-stamp` |
| `pr <number>` | A PR as `merge_ready` re-scans it before every merge: the PR's added lines, commit messages, file names, branch name, title, body and every comment (through `gh`, reads only), and, run from a clone, **each of its commits as `range` scans them** (a commit the clone lacks is fetched from `refs/pull/<n>/head`; one still missing is `cannot-scan gh-failed`). | no |
| `dir <path>` | Every file under a folder (a walk's outputs, `.private/work/walks/<sha40>/`), text files by line, other files by name only; binary files are scanned as bytes for a corpus string. | no |
| `bodies --since <date>` | Every issue and PR body edited since `<date>` (`YYYY-MM-DD` or a UTC timestamp), and their comments. Run each wave. | no |
| `allow [--range <base>..<head>] <location> ...` | Hashes the corpus strings that hit at each location into `tools/leakscan/allowlist.txt` (appends sha256 lines; never prints a string or a hash). A location is `<file>:<line>` (a line of a working-tree file), `commit:<sha>:<line>` (a line of a commit message; `<sha>` is 7 to 40 lower-case hex naming exactly one commit), `name:<i>` (the `<i>`th file name of the range `--range` gives, required, listed as `range` lists it, merge-base substitution included) or `ref:<name>` (a ref name). Each is read as the scan reads it: a commit line, a name and a ref also as a slug (section 8), a file line as written (as an added line is); a line joined with the next one too. Refused (exit 1, nothing appended) if no location hits, a `commit:` sha names no commit, or a `commit:` line or a `name:` index is past the end; a malformed location, or `name:` without `--range`, is a usage error (64). A path that itself starts `commit:`, `name:` or `ref:` is written `./<path>:<line>`. | no |
| `verify-stamp <name>` | Exits 0 if `.private/work/leakscan/ok/<name>` exists, parses and is **valid** (section 4: the corpus hash is current and, for a range stamp, its base is an ancestor of both `origin/main` and `<name>` and its end equals `<name>`); else 1. This is the check the guard performs in its own code; the command exists for tests and humans. | no |

Common options: `--quiet` (print only the summary line), `--json` (print the hit list and summary as one JSON object,
section 3, instead of lines). `--no-stamp` (`range`, `file`, `text` only): scan and exit exactly as without it, but
write no stamp; for a caller that scans for its own decision and must not create or replace the stamp the guard reads
(the watcher, and the pre-push hook, which is the gate itself and never writes a stamp; section 6).

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
| `<path>:<n>`, `<label>:bin:<n>` | the `<n>`th text found in a binary blob (a pushed file, a body file, a file under a folder) |
| `unknown:<line>` | an added line whose path git's name list does not hold (a path is printed only from that list) |

Every run of lines (a file's added lines, a message, a body) is also tested **two adjacent lines at a time, joined** with comment and list markers dropped, so a string wrapped over two lines is found; such a hit counts at the first line.

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
only when all of these hold:

1. its `corpus` equals the sha256 of the corpus file as it is now (so rebuilding the corpus voids every older stamp);
2. its `range`'s end (the part after `..`, or after `sha256:`) equals `<name>`, the head or hash it is checked for;
3. for a range stamp only: its base is an ancestor of both `origin/main` and the head, that is
   `git merge-base --is-ancestor <base40> origin/main` and `git merge-base --is-ancestor <base40> <head40>` both exit 0
   (`<head40>` is the head being pushed, `HEAD` for a plain push). So a stamp for a narrow range (`HEAD~1..HEAD`) never
   vouches for a push that carries unscanned commits not yet on main.

A scan that would write a stamp failing rule 3 still scans and exits as usual, but writes no stamp, and says so in
one line on standard error (section 2; not with `--no-stamp`). **The merge-base substitution:** for `range
<base>..<head>` where `<base>` is not an ancestor of `<head>`, the scan runs on `<m>..<head>`, `<m>` being `git
merge-base <base> <head>`, when `<m>` exists and is an ancestor of `origin/main`: it scans every commit
`<base>..<head>` holds and perhaps more, never fewer, and a clean scan stamps `"<m40>..<head40>"`, which rule 3
holds by construction. Otherwise it scans `<base>..<head>` as asked. Exit codes are the same either way.

**What the guard checks** (a file check and the two `git merge-base --is-ancestor` calls of rule 3; no scan, so it
cannot fail open on the 10 s hook timeout): for a `git push` from the main checkout, the stamp named by the head sha
being pushed is valid (rules 1 to 3); for a `gh` body write, the stamp named
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
| `scripts/git-hooks/pre-push` | `python -m tools.leakscan range <merge-base with origin/main>..<local-sha> --ref <ref> --no-stamp` for each pushed ref, new or existing (a superset of the branch's own unpublished commits and never main's, so a merge of main's added lines are not rescanned; its file names and binary blobs are, since `range` lists a merge's paths against its first parent: a known gap that refuses more, never less; a stale `origin/main` only widens it: fetch first; none refuses). A tag, by name or by sha, or any object that is not a commit, is refused. It runs the main checkout's scanner on the main checkout's corpus (section 8) | the push is refused |
| `merge_ready` | `python -m tools.leakscan pr <PR>` | not ready |
| `watch.py`, each new cloud head | `python -m tools.leakscan range origin/main..<head> --no-stamp` (the watcher only alarms; it never writes a stamp) | `LEAK-HIT` alarm (status.schema.json) |
| `scripts/walk/` | `python -m tools.leakscan dir .private/work/walks/<sha40>/` and `text --stdin` per issue draft | the verdict is not written |
| each wave | `python -m tools.leakscan bodies --since <date>` | the orchestrator edits or deletes the body and files the leak |

Before f2 lands, the interim count is session 11's `lits2.py` (prints a count line only); `launch.py` takes it as
`--prompt-scanned "<count line>"` (launch-cli.md).

## 7. Decided here (the spec is silent)

The spec fixes: the corpus path, the hashed allowlist, what is scanned, "prints `file:line` and a count, never the
text", the stamp's folder, name (`<sha or sha256>`) and content (corpus hash, scanned range), the guard's file check,
and `allow <file:line>` and `bodies --since <date>` and `text --stdin`. This file decides what it leaves open:
the other subcommand names, the exact `<where>` forms, the summary line, the exit codes (0, 1, 2, 64), the stamp's
JSON form, the stamp's validity rules (section 4, including the ancestry rule), `--no-stamp`, the normalisation, the
allowlist's file name, and that a stamp is voided by a rebuilt corpus. PR f2 may
refine them only by changing this file first.

## 8. Test seams (PR f2)

Added by PR f2 as section 7 asks. These exist so tests run in a temporary folder; the harness never sets
them, and the guard refuses any command that sets one inline (`RECORD_FORGED`).

The pre-push hook from a worktree: `core.hooksPath` is relative, so a linked worktree runs its own copy of the hook,
which finds the main checkout as `VEXTRUS_MAIN_CHECKOUT` when set, else the folder holding the repository's common
`.git`, else (that folder holds no scanner and the hook lives in another repository, as when `core.hooksPath` is
absolute) the hook's own checkout. It runs `<main>/.venv/bin/python` (else `python3`) from the pushing folder with
`PYTHONPATH=<main>` and `PYTHONSAFEPATH=1`, so the main checkout's scanner runs, never the pushed branch's, and exports
`VEXTRUS_MAIN_CHECKOUT=<main>` unless set, so the corpus is the main checkout's. No scanner there, or a linked worktree
of the pushing repository as the only candidate, prints one `pre-push: cannot find the main checkout's leak scanner`
line and refuses.

| Seam | Read by | Default | What a test sets it to |
|---|---|---|---|
| `VEXTRUS_MAIN_CHECKOUT` | the guard, the scanner | `/home/riz/vextrus-cubit` | a temporary repository treated as the main checkout |
| `VEXTRUS_LEAKSCAN_HOME` | the guard, the scanner | `<main checkout>/.private/work/leakscan` | a temporary folder holding `corpus` and `ok/` |
| `VEXTRUS_LEAKSCAN_ALLOWLIST` | the scanner | `tools/leakscan/allowlist.txt` beside the tool | a temporary allowlist file |
| `build --source <dir>` (repeatable) | the scanner | the real sources of section 1 | folders of invented text: `*.txt` and `*.md` lines (and Markdown table cells), and every string of a `*.json` file, nested; a missing folder exits 2 with `cannot-scan source-unreadable` |

The guard reads the first two (and `CLAUDE_PROJECT_DIR`, `CLAUDE_CODE_REMOTE`) from its own process
environment, which Claude Code sets and a Bash command cannot change. `build --source` is refused by the
guard in every session (a corpus built from a chosen folder would make every scan clean).

What the real `build` reads, beyond section 1's list: each Markdown table row's cells as well as the whole
line (a drawing's text is often quoted in a table cell), and each TEXT, MTEXT, ATTRIB and ATTDEF both as
stored and as decoded (`engine.text.decode`). `build` also prints, before its last line, one `source <name>:
<r> strings read, <k> kept, <s> files skipped` line per real source (`r` tallied as read, `k` the distinct
strings the source keeps after the corpus filter and the allowlist, `s` the files its skips removed) and one
`leakscan: work folders without a rule: <n>` line; counts only, never a folder name; `--quiet` hides them.

`allow` also takes several locations at once (`allow <file>:<line> <file>:<line> ...`): it loads the corpus once
and hashes every hit on every line given, refusing only when none of the lines hits (a superset of section 2).

What the real `build` leaves out, measured on 5 Oct 2026 (the first build read 85 GB of `.private/work/`, and
every note line became a corpus string: 169,049 strings, 935 of 1,195 hit lines on one branch's diff, against 4
distinct strings from each drawing source): folders of packages and caches (`node_modules`, `.git`, `.venv`,
caches, the leak-scan home), the files a nested git checkout tracks (a walk's or a review's copy of the
repository; their untracked outputs are read), text files over 2 MB, and from the notes every string that does
not read like drawing text (one with a lower-case letter or a code or Markdown character). The DWG, PDF, export
and walk sources are read whole. Result: 5,998 strings, built in about two minutes at 0.55 GB peak.

The notes and walks sources also leave out, whole, the folders and files that hold no drawing text (#311:
review scratch made 10,303 of the notes' strings, and test output quoted invented test literals):
- every folder kind of `.private/work/` has a rule in `sources.WORK_RULES` (a glob on the folder name, `read`
  or `skip`, a reason). Agents' scratch is skipped at any depth: `review`, `review-*`, `reviews`, `scratch`,
  `scratch-*`, `refuter`, `refuter-*`, `writer`, `adversary`, `premerge-*`, `redtree*`, `ledger`, `ledger-*`,
  `launches`, `verdicts`, `jev-cache`, `worktree-leftovers`, `leakscan`, `logs`, `log`. The note kinds are
  read: `session-*` and every topic folder below it, `factory`, `walks`, `walks-smoke`, `walk-expect`,
  `sheets`, `renders`, `proto-*`, `jev-system-one`, `t*-gate`, `.convert`. A top-level kind no rule covers is
  read all the same and counted in `work folders without a rule` (0 on a decided tree);
- a folder holding both `CLAUDE.md` and `pyproject.toml` (a copy of the repository), whatever its name,
  unless it is a nested git checkout (that keeps its rule above);
- test output: a note whose lower-cased stem matches `*pytest*`, `*test-output*`, `*test_output*`, `red`,
  `green`, `red-*`, `green-*`, `*-red`, `*-green`, `*-red-*` or `*-green-*`, or whose text holds a pytest
  header or summary line (`test session starts`, `short test summary info`, `N passed in 0.1s`) or a `node
  --test` summary (`# pass N`).

A skip removes whole folders and files only; a file that is read keeps every drawing-like string.

The walks source reads only drawing-like strings (the notes' filter), and skips `walks/_src` (f5's serving
worktree) and each walk's `public/` and `logs/`: a walk's own closed words (check ids, defect classes, screens)
would otherwise enter the corpus and refuse the next walk's drafts (PR #293's review). `build`, and every
stamping scan, runs only as the orchestrator's `uv run python -m tools.leakscan …` with the main checkout as
its working folder (the guard refuses any other form, so a branch's own scanner code never writes a stamp or
the corpus); option abbreviations are usage errors; an empty corpus is refused (`cannot-scan
corpus-unreadable`), never trusted.

`build --source` writes a corpus only under the test seam `VEXTRUS_LEAKSCAN_HOME` (otherwise exit 64). A
rebuild that would keep fewer than half the current corpus's strings is refused (exit 2) unless `build
--force` is given (run, like every `build`, only from the orchestrator's main-checkout session), and outside
the test seam a corpus under 100 strings is refused by every scan and by the guard (`cannot-scan
corpus-unreadable`). `allow` hashes, from the next line, only strings that span the line break.

**Slug forms, run ids** (T-LEAK-2). A file name, a ref name, a commit message line and a body line (`file`,
`text`, and a PR's or an issue's title, body, comments and branch) is tested as written **and** as its slug
form: a space put at each lower-to-upper and each letter-digit boundary (either way), each run of `-`, `_`,
`.`, `/`, `\` and `+` replaced by one space, then normalised. The slug form is tested for each corpus string and
for that string's own slug form, so the `a-b_c.d/e` and `CamelCase` spellings hit even for a corpus string that
holds `C1` or `Plot-12`.
The count is the union of the strings found either way (never one string twice). An added line of a diff, a line
of a file under `dir` and the text in a binary blob are not slug-read: code is full of such separators. A
normalised string of the shape `<8 digits>T<6 digits>Z-<12 hex>-<4 hex>` (a real-drawing run id, a tool-made
name) is not a corpus string; a longer string holding one still is. Nor is a string holding, as a whole
whitespace-free token, a git object id: hex only (hyphens allowed between hex runs), 7 or more hex characters,
at least one digit and one letter A-F (a commit sha, a sha256; a long number or a word of the letters A-F is not
one). Both rules live in the corpus filter, so a corpus built before them drops those strings on load.

A corpus string's own slug form is matched only when it has two or more words and lies inside the slug form of
one whitespace-free run of the scanned text: a one-word slug form (`WORD.` reads `WORD`) or a match across the
text's own spaces is a respelling, not a slug (T-LEAK-2's measure on the real corpus: 21 such hits in 60 merges
of commit messages, none a slug).
