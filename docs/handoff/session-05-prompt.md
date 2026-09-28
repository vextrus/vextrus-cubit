# Session 05: M0 wave 3

You are the orchestrator of the third build session of the new Vextrus, **run on account B for everything,
local and cloud** (the owner's ruling, 28 Sep 2026: "From the next session the local and all cloud sessions will
be run on Account B until I told you to switch").

Session 04 (28 Sep 2026) did the following, every PR reviewed and fixed before the owner merged it:
- **Wave 2a merged:** 07 (#70), 08 (#68), 09 (#71), 28 (#69).
- **Wave 1's remedies merged:** #72, #76, #78.
- **The first posts of both App statuses.**
- **Wave 2b merged:** 10 (#79), 11 (#81), 12 (#80).
- **Docs merged:** #83.

Its record, measures and every ruling are in the M0 milestone issue, **#45**. Its lessons are in
`docs/knowledge/lessons.md` ("Session 04"). **This session builds wave 3**: 13, 14, 15, 19b, 20a. Effort is `high`.

## The owner's rulings that frame this session (all 28 Sep 2026; #45 has them in full)
- **Accounts:** everything on **B** (`CLAUDE_CONFIG_DIR=~/.claude-b`, default environment `vextrus`) until the
  owner says to switch.
  - Account A's promotional credit is spent ($154 → $2 over wave 2a and 2b's start).
  - Cloud sessions continue on the subscription.
- **Cost is not the constraint; quality is** (session 03, in force). **Continuations** need no asking.
- **Access:**
  - A Vextrus Engineer must be staff ("Require staff").
  - Staff reach in the admin is accepted for M0 ("Accept, record it"; #74 limits it before the beta).
  - The activity API is for the MD and the QS ("MD and QS").
  - The unusable-link words name no Developer ("07's words; amend §4.2").
- **Reading:**
  - A DWG read by one reader shows 4.5's "Failed" row.
  - An item the second reader provably cannot read holds the file ("Hold it").
  - `failed_stages` counts a killed file ("Count it").
  - BLAS runs on one thread in each file's process ("Pin to 1 thread").

## Read first, in this order
1. `CLAUDE.md` (it gained: "a backend ticket that words codes in `web/src/messages/` gets a `ux-critic` review
   of those words before its PR"), `docs/sdlc.md` ("Waves": everything on B), `docs/knowledge/lessons.md`
   (sessions 03 and 04: read them all before launching anything).
2. **#45:** waves 2a and 2b, their tables, measures and continuations, both App posts, every ruling.
3. `docs/plans/M0.md`:
   - "Wave 3" and every ticket entry in it, with what each names;
   - "Labels" (a backend PR's words are gated);
   - "The contracts fixed here" (Placement now carries 11's final `mtext.height` signature);
   - "The real-drawing check".
4. The session-04 working files (outside git), under `.private/work/session-04/`:
   - `wave2b/common.md`: the shared ticket prompt, with every lesson so far;
   - `wave2a/review-brief.md`: the reviewer's brief;
   - one ticket prompt for the shape (`wave2b/10.md`);
   - the `fix-*.md` files, for how review findings were sent back, one combined message per round.

## What is broken, unmeasured or waiting (read before acting)
- **Wave 2b's gate was not met, and neither was 2a's.** Second continuations were 2 of 4 in wave 2a and 3 of 3 in
  wave 2b, against ADR 0025's at most 1 in 4. So wave 3 stays at the plan's size and does not widen.
  - What drove them: every ticket's words failed their first design gate; five fixes brought a new fault (09's
    lock, 12's crash wording, 11's paper scaling twice, 10's strict read); two bugs passed CI's 4 cores and failed
    on the owner's 24.
- **#75, platform's next migration.** It must land before 20a's design gate. It covers:
  - the "Access ended" facts for `/api/me`: a fourth named function, returning the Developer's name, who revoked
    and the Project codes;
  - a Developer's Market fixed once it holds data: revoke the app's UPDATE of `market_id` and `library_id`, and
    its DELETE on `platform_developer`.
  Schedule it into wave 3 as platform's one migration there, or as its own local ticket.
- **#82:** the ReadArtefact carries no text style table, so MTEXT height's "else its style's" step is inert.
  It is 04's reader, an engine PR.
- **#77:** the harness's direct path gives a file's process no namespace of its own. Until it is fixed, real
  drawings go only through the check (`scripts/real-drawings`), never the harness directly from a shell.
- **The render stages are not measured on real drawings until 13 produces sheets.** #81's layout fixes are proven
  on synthetic files and an Autodesk sample only. An inch layout with no drawn frame still falls back to 1 mm per
  unit. 13's review must render real sheets locally and look.
- **PDF reading takes 0.4–0.5 s per page on the Edison plots** (28–33 s per PDF; shown, not counted). The second
  reader adds 0.3–2.5 s per DWG. For 24's budgets.
- **#73** (rate limits) and **#74** (staff reach) come before the beta.
- **Leftovers of session 04** (ask the owner before removing):
  - its agent worktrees under `.claude/worktrees/agent-*` (all merged) and their branches;
  - scratch copies under `.private/work/session-04/` (keep the reports);
  - `/home/riz/review70-scratch`;
  - the worktree `~/pr79` (the owner's, for `toolchain.sh`).
- **The owner's review minutes** have never been given: ask for a rough figure per wave.
- **An open question for the owner before M1** (unchanged): values copied out of a message carry invisible
  direction marks (U+2068/U+2069).
- **The cloud setup** takes 235–250 s of its 300 s budget.

## What session 04 learned (the lessons file has the rest)
- **Words:** run the `ux-critic` words gate yourself on every PR's catalogue on its first head, and send its
  findings with the code review in **one message per round**. Every PR's words failed the first pass even with a
  words review in the prompt.
- **Fixes:** re-review every fix against real processes and real layouts, not only its tests.
- **Cores:** run the suites on the owner's 24-core machine, not only CI's 4.
- **A new measure's first posting run:** read the exports' states and error kinds before accepting. 10's first
  run found a real file the second reader could not read, which led to the "Hold it" ruling.
- **After a branch update:** the owner's gate and posting run go on the updated head. Check that the post
  reached that head (#79's first gate post did not).
- **The machine:** a restart kills local agents and `/tmp`. Keep scratch and logs under `.private/`; each agent
  keeps a NOTES.txt.

## The finish line of this session
1. **Wave 3 merged:** 13, 14, 15, 19b, 20a. Each is reviewed (five passes and the words gate), fixed before the
   owner merges, and its local step done (13's real sheets, 19b's and 20a's gates).
2. **#75 and #82 scheduled and merged.**
3. **Wave 3's measures in #45.**

## How to run it (unchanged from session 04, on account B)
- **Launch:** `CLAUDE_CONFIG_DIR=~/.claude-b claude --cloud "<prompt>"` under `script -q -e -c '…' <log>`.
- **Follow-ups:** `claude -p "<message>" --cloud <session_id> < /dev/null`.
- **Owner steps:**
  - **UI and words:** the owner posts `design-gate` with the poster, as the key user.
  - **Engine PRs:** the owner runs `scripts/real-drawings <PR>`. A PR touching `scripts/owner/toolchain.sh`
    needs it re-run as root from a worktree of the PR head first.
- **The guard** refuses the key user's name, privilege-raising words, the statuses path and recursive `rm` in a
  Bash command: write such text with the Write tool.
- **Push only with the owner's yes; only the owner merges.**

## Law in force
- Secrets are never printed or written.
- Real drawings stay in `.private/`; only conventions and counts leave it.
- OpenConstructionERP is AGPL: learn, never copy. No AGPL library (PyMuPDF). No proprietary converter is run.
- The product's word is **Rebar**.
- No market literal in code; every visible string through a catalogue; logical CSS only.
