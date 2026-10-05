# `python -m tools.jevleak`: Jev's leak advice beside the literal wall

Contract (ticket T-JEV-LEAK, issue #259) for `tools/jevleak/` and every caller. Source: `docs/specs/factory.md` 3.14,
row J-e. The literal wall is `python -m tools.leakscan` (`leakscan-cli.md`); this tool runs the same literal pass
first and then asks Jev, TypeSafe's judgement model, whether the strings the wall cannot see look like a real
drawing's text. Run from the main checkout or a worktree, as the owner's Unix user, with
`uv run python -m tools.jevleak ...`.

**Advice is never a gate.** No Jev answer changes the wall's decision, drops a hit or yields a pass: a literal hit
exits 1 whatever Jev would say, and advice alone exits 0.

**The tool never prints text.** Like the wall it prints locations, counts and fixed words: never a candidate, a
context window, a corpus string, a line of the draft, a path given on the command line or an exception's words.

## 1. Commands

| Command | Reads |
|---|---|
| `file <path> [--no-jev]` | one draft file (a PR body, an issue body, a commit message) |
| `text --stdin [--no-jev]` | the draft on standard input (text is never taken from the command line) |

`--no-jev` runs the literal pass and the candidate extraction and asks nothing (`jev=off`). Anything else is a usage
error (exit 64).

**Local only.** With `CLAUDE_CODE_REMOTE` set to anything but empty, `false` or `0` (fail closed) the tool prints `jevleak: skipped local-only` and exits 0 before it
reads the draft or loads the corpus: no cloud session holds the corpus or the drawings, and Jev is asked only under
the owner's local key (ADR 0013). The key is read by the Jev client from `TYPESAFE_API_KEY` at call time, never
printed; without it the run ends `jev=unavailable:no_key`.

**It writes nothing of the wall's:** no stamp, no corpus, no allowlist. (The Jev client keeps its own log line,
labelled `task=leak-advice`, and its answer cache under the factory folder; neither holds the state sent.)

## 2. What it does, in order

1. The literal pass: `tools.leakscan.scan.scan_lines` over the draft, exactly as `leakscan file|text` runs it. Its
   `HIT <where> <n>` lines are printed as the wall prints them. **If it finds any hit, nothing is sent anywhere**:
   the summary is printed with `candidates=0 asked=0 jev=off` (no candidate is looked for) and the exit code is 1.
2. Candidates (`tools.jevleak.candidates.extract`), from the first 256 KiB of the draft (the literal pass reads all
   of it; the rest is not read for candidates), with linear-time patterns only:
   - codes holding letters and digits (`RC-14B`, `7B`, `DWG-2231-04`), member sizes (`450 x 230`, `450x230`) and
     signed levels (`+3.150`);
   - runs of two or more capitalised words (`Willowbrook Tannery Annex`);
   - single capitalised words, of two letters or more.

   Left out: a capitalised word alone that is a function word (`candidates.FUNCTION_WORDS`, English's closed
   classes: articles, pronouns, prepositions, conjunctions, auxiliaries, determiners) or a title (`Mr`, `Engr`,
   `Md`, ...), wherever it stands, and a function word leading a run (`The Thistlewood Granary`); a single
   letter alone; and an everyday word (`candidates.START_WORDS`) standing alone at a true sentence start (a line's
   first word after list markers, or after `.`, `!`, `?`; never after a label's colon or a table bar, and never in
   a run). A run of two or more capitalised words is always asked. Tokens are cut at whitespace, `/` and `\`;
   a whitespace token holding `/` or `\` is also read whole as a code (`S/101`, `QX/2026/014`).
   Also left out: git shas, issue numbers, ISO dates, versions (a `v` prefix or a lower-case word's: `v1.2`, `jev-1.13.0`; `A-1.01` is a sheet number), words listed in
   `tools/jevleak/known.txt` (the factory's own words, one per line, committed), any candidate whose
   `sha256(normalise(text))` is in the wall's allowlist, and tokens longer than 64 characters. Candidates are
   deduplicated by their normalised form (spaces dropped) and ranked: codes, sizes and levels first, then
   multi-word nouns, then single words; within a class, by first place in the draft. The ranking is deterministic.
   A window holding a corpus string is never sent (a line can be clean under NFKC while a cut of it is not, as
   when a combining mark follows the string): then nothing is asked.
3. **At most `MAX_ASKED = 40`** candidates are asked, in **one batched call**
   `jev.ask(state, questions, task="leak-advice")`: `state` is a list of context windows, one per question, each at
   most **160 characters** of the candidate's own line around it (never the whole draft); question `q<i>` is a
   `noul` whose text is a fixed rubric naming candidate `i` and its window. Fewer are asked when the encoded request
   would pass `VEXTRUS_JEV_MAX_REQUEST_BYTES`. The rest are counted in `candidates=` and never sent.
4. An answer advises a candidate when its `p` is a real number (not a bool), finite, from 0 to 1, and
   **`p >= 0.8`**. Every asked question must have such an answer; anything else (a missing or extra name, `p` out of
   range, `nan`, a string, a subclass of a number, a non-mapping, an answer that raises while it is read) is
   `unavailable:malformed` and advises nothing. `Unavailable(<why>)` is
   `unavailable:<why>`; an exception raised by the call is `unavailable:failed`. Each of these runs exactly as
   `--no-jev` does, but for the `jev=` field.

## 3. Output

```
HIT <where> <n>          the literal pass's hits, as leakscan prints them
ADVISE <where> <n>       <where> = file:<line> | stdin:<line>; <n> = advised candidates on that line
jevleak: hits=<H> scanned=<M> advise=<A> candidates=<C> asked=<Q> jev=<ok|off|unavailable:<why>>
```

`ADVISE` is printed for every line (within the part read for candidates) holding an advised candidate, in line
order. The last line is always the summary: `H` the total of the hits' `<n>`, `M` the lines examined by the literal
pass, `A` the number of advised candidates, `C` the candidates found, `Q` the candidates chosen to ask (sent unless
`--no-jev`; so a run without Jev prints what a run with it prints, but for `jev=`), and `jev=` `ok` (Jev answered), `off` (not asked: `--no-jev`, a literal hit, or no candidate) or `unavailable:<why>` (`<why>` one of the
Jev client's words: `no_key`, `timed_out`, `malformed`, `failed`, ...).

When it cannot scan: `jevleak: cannot-scan <reason>` on standard output and `jevleak: cannot scan (<reason>)` on
standard error, `<reason>` one of the wall's words (`no-corpus`, `corpus-unreadable`, `source-unreadable`). An
unexpected error prints `jevleak: cannot-scan source-unreadable` and a fixed line on standard error, never a
traceback.

## 4. Exit codes

| Code | Meaning |
|---|---|
| 0 | clean, or advice only (advice is never a gate), or skipped in the cloud |
| 1 | a literal hit (the wall's) |
| 2 | cannot scan |
| 64 | usage |
