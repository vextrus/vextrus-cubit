# Lessons, by area

Short, dated lessons that cost us something once. Read the area you are working in before you start.

**This file is becoming an index** (ADR 0041): every serious finding leaves a committed check (a test,
lint or scan that fails on the class), and each lesson ends with `Check:` and that check's path. A lesson
without a check is a debt, listed in the milestone issue until it has one. Lessons below written before
29 Sep 2026 have no `Check:` yet: each is such a debt until the orchestrator adds one or marks it
"no check can catch this" with the reason.

## Harness and agents
- **Parallel agents share one chrome-devtools browser.** 26 Sep 2026: a prototype agent selected the
  wrong tab and sent keypresses into another agent's page, and its window resizes changed the other
  agents' viewports. Always select your own page by URL before acting, and use per-page viewport
  emulation, never window resizes. Treat measurements taken while another agent drove the browser as
  suspect.
- **Subagents may be refused writing report `.md` files.** They return the text instead; the
  orchestrator writes it. Plan prompts so the report comes back in the final message.
- **The guard splits Bash commands on `|`, `;` and newlines.** A heredoc or regex containing `sudo`,
  `su` or a pipe at a line start is refused. Write such files with the Write or Edit tool.

## Reading drawings
- **`dwgread` cannot check LibreDWG.** It shares the decoder; LibreDWG 0.13.3 lost a 2007-format file
  and a count check against `dwgread` passed it. Compare against ACadSharp (ADR 0029).
- **`dwg2dxf` corrupts text with raw line breaks;** read text from `dwgread` JSON.
- **Rules fitted to one office read nothing at the next.** The session-10 prototype ran zero stages
  on the Sample Project until 17 fittings (docs/research/sample-project-first-read.md).
- **LibreDWG 0.14 drops ATTRIB text styles** (null style handle); inherit the style from the ATTDEF
  with the same tag (docs/research/viewer-2d-fidelity.md).
- **dxf-viewer hides ATTRIBs carrying an embedded xrecord and draws no leaders:** it is not our sheet
  renderer.
- **Thin CAD lines as GL_LINES, never one quad per segment** (242 ms vs 19 ms a frame).
- **Aligned TEXT and ATTRIB from LibreDWG carry start point = alignment point** (all 3,016 non-left
  aligned ones in the Sample Project); AutoCAD plots from the start point, so draw from it, not from
  ezdxf's alignment placement (proto-sheet, 26 Sep 2026).
- **Every recognised figure must record its source handles** when it is read; re-finding them later
  by re-running rules is fragile (ADR 0031's Trace anchor).
- **SHX text drawn as single strokes (Hershey simplex) matched the plot's width at 0.997 (median of 78
  lines);** outline substitutes run 13–19 % narrow.
- **Wrap an MTEXT by AutoCAD's own measure of it, never by the substitute's widths alone** (S24-A4,
  12 Oct 2026; G1 walk 1, two sheets printed text over text). Drafters' reference rectangles hug
  AutoCAD's lines within 0.3–3 %, and the outline substitutes measure 4 % (Arial) to 35 % (condensed
  faces) wider, so main broke 1,335 of 6,960 real MTEXT into more lines than AutoCAD drew. The file
  stores the widest line's width and the block's height AutoCAD measured: fit to them. AutoCAD's
  measure of SHX text runs 12 % under its Plot, so single-stroke text is fitted only to its box.
  **Check:** `engine/render/tests/test_mtext_fit.py`.
- **LibreDWG's `dxf2dwg` is no fixture writer** (ticket 04, 28 Sep 2026): it writes only R2000 and
  R2004, dropped every model-space layer and the MTEXT heights, and on R2004 lost model space. ACadSharp
  writes the fixtures from ezdxf's DXF, but its DXF reader leaves ATTRIBs beside their INSERT, so the
  writer moves them back (engine/fixtures/dwg/_writer/). LibreDWG 0.14 then decodes ACadSharp's
  AC1024 and AC1032 ATTRIBs with a null style, as on real files; AC1018's keep theirs.
- **bwrap's PID namespace hides the sandboxed program's rusage** from the caller (0.005 s reported for
  a 1 s CPU loop): the sandbox tells a CPU kill by SIGXCPU, and peak memory is measured at the parse.
- **A program the sandbox starts is never killed by its file-size limit** (ticket 10, 28 Sep 2026):
  Python ignores SIGXFSZ and `posix_spawn` passes that on, so the write fails (EFBIG) and the program
  exits as it likes. Tell "too large" by the output's size, never by the signal.
- **The .NET runtime needs room of its own inside a sandbox** (ticket 10): it did not start under
  512 MiB of address space (it did under 1 GiB), nor under a 1 MiB file-size limit (its executable
  memory is mapped through a file the limit caps); it makes a diagnostics socket and debugger pipes in
  TMPDIR, which only an environment variable turns off. A self-contained single-file publish with
  locked packages and the pinned SDK is byte-for-byte reproducible, so its sha256 can be the pin, but
  only with `EnableSourceControlManagerQueries` off: inside a git work tree the SDK's Source Link
  stamps the repository's HEAD into the version (the owner's checkout gave another hash, twice), and
  only with no build path in it: a `[GeneratedRegex]` names its file-local types after a hash of the
  source file's path, so two folders gave two hashes (set `PathMap`). NuGet's lock does not list the
  runtime pack a self-contained build downloads: pin its .nupkg by its own hash.

## Session 02 (27–28 Sep 2026)
- **An app restart kills every background agent.** All nine died mid-task once; the partial work in their
  folders survived. Every long agent keeps a `NOTES.txt` progress log after each milestone and is told how
  to resume from it.
- **Vite's hot reload loops a page in the shared chrome-devtools browser** (its watcher sees its own log);
  prototypes run with HMR off or with the log ignored. A background tab is throttled to about one frame a
  second, so fps read from it is not real: measure render cost, not frame interval.
- **Headless Chrome in WSL has only SwiftShader:** every GPU figure an agent takes is relative; the
  reference-setup number needs the owner's PC.
- **Reading real drawings:** apply every insert's object-to-world transform (mirrored inserts put 25 of 47
  Edison piles 77,000 in away); read an MTEXT angle from its direction vector (98 of 139 beam labels
  unbound otherwise); MTEXT inside blocks may have no height; guard every geometry repair
  (self-intersecting outlines collapse to empty); never hard-code an N or a storey count; MEP symbol base
  points can lie far from their geometry, so locate by the geometry's centre; the same MEP point repeats
  on up to three sheets.
- **Row-level security:** after a transaction-local `set_config`, the setting reads back as `''` on a
  pooled connection, so policies read `nullif(current_setting('app.tenant_id', true), '')::uuid`; under
  FORCE RLS a foreign key added to a populated table as its owner fails (parent rows hidden).
- **WeasyPrint breaks Bangla conjuncts** (Chrome's print does not); dimensions inside Arabic text read
  backwards unless isolated left to right; Chrome has no `en-BD` formats.
- **A python edit that fails its assertion writes nothing, and a `;`-chained commit still runs:** chain
  the commit with `&&` after an edit script, never `;` (a research file was once committed without its
  corrections).
- **Refuters earn their cost on research:** four of five research files needed corrections before
  commit (a lift price rise stated as 81 % that was 22 %; a fire gap stated as 3× that was 2.4×; an
  iTwin claim reversed; a groove item's scope).

## Session 03 (28 Sep 2026): wave 0 and wave 1, the first build
The owner's ruling that frames these: cost is not the constraint; quality on every merge is, with as
much parallel work as that quality allows, and each wave applies the last one's lessons.
- **Two tickets meeting at a contract, built in parallel, drift.** 06a read an export shape it assumed
  from the plan; 06b wrote the real one; the first baseline could not read it. The fit was found only
  by running one inside the other (the review of #62). When a wave's tickets meet at a contract, the
  owner of the shape merges first, the other builds against fixtures generated by the real code, and
  the review runs the two together before either merges.
- **A check that cannot show failure hides breakage.** The first baseline reported every measure at
  0 items and looked clean; 04's `read` stage had failed on every DWG. Every report names the stages
  that failed, beside those not built, and never presents zero without what ran.
- **bwrap nested in bwrap needs a `/tmp`:** without one the inner fails "Failed to mount tmpfs: No such
  file or directory". The outer sandbox mounts a private `--tmpfs /tmp`.
- **Reviews found a real security hole in three of five wave-1 tickets,** each missed by its author and
  its refuter: a tree entry named `..` written outside the checkout (06a; git's plumbing accepts it,
  only its checkout refuses it); a planted symlink followed out of the sandbox (04); the app role able
  to set the staff flag, by UPDATE and then by INSERT (02). Every harness and security PR gets a bug
  scan aimed at its trust boundary, and fixes land before merge.
- **PR bodies overclaim.** A mutation claim true only for removed thresholds, "fits 06a" before anyone
  checked, a revert credited to "the owner's ruling" the owner never made. Reviewers check each claim
  against evidence; nobody attributes a ruling that was not given.
- **The pseudo right-to-left language must be right to left in strength.** Accented Latin is left to
  right to the browser and hid an unisolated `14′-6″`; each run is wrapped in U+202E…U+202C, and every
  value filled into a message is isolated with U+2068…U+2069 at render.
- **A cloud session may act on a PR comment before its follow-up arrives** (06b reshaped its export,
  then reverted it). Send the follow-up with the decision first; post the review comment after.
- **The cloud image** (Ubuntu 24.04): its Launchpad PPAs answer 403, failing every `apt-get update`
  (set them aside); its `uv` predates Python 3.14.7 and silently fetched 3.14.0rc2 (install a pinned
  uv); it has no `gh`; the setup cannot reach the private release while a session can, through its
  GitHub proxy; concurrent apt runs lose each other's `.deb`s (one `flock`); the session runs as root
  (a read-only test checks ownership and mode); `$CLAUDE_PROJECT_DIR` is empty during setup; LibreDWG
  from source takes 235–250 s of the 300 s budget.
- **`uv sync` and `uv run` reinstall `uv.lock`'s pure ezdxf** over the compiled wheel: where speed or the
  toolchain test matters, lay the wheel over it and run with `--no-sync`.
- **Debian's pip bends `--prefix` into `local/`;** `--target` puts a tool where a script expects it.
- **Diagnostics name exact paths:** a `cpython-3.14*` glob matched two folders and ran one interpreter
  on the other's binary, which read as a broken Python.

## Session 04 (28 Sep 2026): wave 2a and 2b
- **Machine words fail the design gate like screens do.** All three wave-2a tickets with catalogues
  (07, 08, 09) failed their first gate on words: a refusal telling the sender to ask themselves; "ask
  your MD" to create what the MD cannot; "Add it again", which 4.5 refuses. A backend ticket's words
  get a `ux-critic` words review before its PR.
- **Contracts inside a wave hide in the seed too.** 08 had to merge after 07 for two reasons: the
  decorator its operations declare acts through, and the Guest's scope in the seed (platform's seed runs
  before projects'). Look for both before launching.
- **A fix can regress what it fixes.** 09's advisory lock stopped a superseded try, and made a frozen
  worker hold its job for two hours (TCP keepalive) where the retrier had freed it in 60 s. Re-review
  every fix against real processes, not only its tests.
- **Refusals before the guard escape its shape.** Ninja's `SessionAuth(csrf=True)` answered 401/403 as
  `{"detail"}` before 07's guard ran; tests checked statuses only. Assert refusal bodies, not statuses.
- **"Blocked by UPDATE" is not "blocked".** 08's column grants stopped an UPDATE of a Project's
  currency; delete and re-insert still rewrote it (the same shape as 02's staff flag). Attack a wall by
  every write, not the one it names.
- **A check that runs from `main` fails open in the shell.** `$(…)` inside `[ ]` and pipes inside `if`
  escape `set -e`: the not-applicable workflow would have posted both required statuses on a failed
  matcher. Capture a command's output as its own command under `shell: bash`.
- **A test flaking on one machine can be a real bug.** #66's fork-chain flake was the harness failing
  to stop fork chains; it failed on CI too once looked for. Diagnose before loosening.
- **The App needs "pull requests: read"** to check a PR's head in a private repository; the first post
  answered 403 and posted nothing (the check fails safe).
- **A power cut kills local agents and `/tmp`.** Keep scratch copies and logs under `.private/`; every
  agent keeps a NOTES.txt it can resume from.
- **A thread count CI cannot see.** CI's runners have 4 cores; the owner's machine has 24, and numpy's
  OpenBLAS spins a thread per core. #66's test failed only here, and #80's PDF child failed 13 tests
  here while CI passed: 04's bwrap `--clearenv` drops the harness's one-thread pin, and the extra
  threads exhausted its memory cap. A setting made in one process does not cross a sandbox that clears
  the environment: every sandboxed Python child sets its own pin, and a test asserts one thread from
  `/proc/self/task` rather than relying on the runner's core count.
- **A setting you think is on may not be.** The owner's "high by default" ruling lived as
  `effortLevel: "high"` in the project settings, yet Opus 5.5 starts at `medium` unless a level is saved
  for it per model, and the docs disagree on whether the top-level key covers it. Cloud tickets read only
  the repository's `.claude/settings.json`. Set `modelSettings` per model, and check `/status` at the
  start of a session.
- **A new measure's first real run is where real files surprise.** 10's second reader agreed on every
  synthetic file and stopped on one real DWG (a Z scale of 0 its library refuses); 12's PDF reads took
  30 s where fixtures took a second. Read the exports' states and error kinds before the owner accepts,
  and diagnose locally before deciding.
- **The Desktop app and the CLI keep separate configs.** The CLI's default config was not signed in, and
  account B's config dir held none of the Desktop's settings (auto mode, the classifier's environment,
  prompt caching). A move between surfaces carries its user settings over by hand.

## Session 05 (29 Sep 2026): the cloud launch that was not, and wave 3
**From session 06 every lesson names the committed check that guards it** (a test, lint or scan that
fails on the class; the autonomy ADR); a lesson without one is a debt, listed here and in the milestone
issue until a check pays it. Session 05's lessons below, as debts ("checks session" marks those the
session-05 close-out's committed checks cover; confirm each on its merge):
- Cascade keys run as the table's owner (#93): **checks session** (the cascade-key guard over every module).
- A wall attacked by one write only: **checks session** (the wall check by every write, from NARROWER's map).
- A builder's own words gate passing words the fresh gate fails: **checks session** (the words lint);
  the fresh gate stays.
- A failure's name lost: **checks session** (the failures log).
- Hostile-input bounds found one at a time; resource claims without numbers: **checks session**
  (resource-bound test helpers); one budget per file stays a design rule.
- The posting run's accept asked at a terminal: the non-interactive accept, **the owner's change**
  (taken out of the checks session).
- Contracts drift at the level of keys; contract faults show only in the merged tree: debt (no check
  yet; the rule is exact keys in both prompts and a merged run before READY).
- A strict ruleset puts every open PR behind: debt (the orchestrator merges `main` in; no check).
- A `claude --cloud` session with no git remote: **paid 29 Sep 2026** by the cloud launcher, now
  `scripts/factory/launch.py` (its test: `scripts/factory/tests/test_launch_cloud.py`), which refuses a bundled launch from the CLI's debug log.
- Messaging across config dirs; a builder's `cd` out of its worktree; `--resume` on a running session
  starting a copy: debts (runbook rules; no check).
- `gh pr edit` failing on the Projects (classic) error: debt (the `gh api` route; no check).
- The wave slower than the owner expected: the time budgets and the two-round cap (the autonomy ADR);
  a measure in #45, not a check.

- **A `claude --cloud` session can come up with no git remote.** When the Claude GitHub App does not cover
  the repository for the signed-in account, the CLI uploads a local copy instead of linking GitHub, "even
  if you connected GitHub with `/web-setup`" (code.claude.com/docs/en/claude-code-on-the-web). Account B's
  six wave-3 sessions came up that way: they could not push, and all were deleted. The signs: a launch that
  took 30–39 s (account A's took 3 s), and the session filed under "other" rather than the repository.
  Installing the App did not change it within the session. Check one launch's remote before fanning out;
  the owner then chose to build everything locally.
- **Cross-session messaging does not cross config dirs.** From the default config, SendMessage to a
  session started under `~/.claude-b` answered "No agent named … is reachable". Start the orchestrator and
  its builders from one config.
- **A builder's worktree isolation refuses a command that runs git in the shared checkout** (`cd <main>
  && git …`, or `git -C <main>`). Give builders absolute paths to scripts, never a `cd` out of their
  worktree.
- **A key's cascade runs as the table's owner** (#93). Taking DELETE off `projects_building` left the
  app able to delete the Building's Project, whose key cascaded to the Building as `vextrus`, and then
  to insert the Building's id under another Project (measured on PostgreSQL 18.6). A wall against
  re-using an id covers every row whose delete cascades to it, not only the row's own table.
- **`claude --bg --resume <id> "<message>"` on an idle but running session starts a copy of it in the
  caller's directory.** 13's copy started in the main checkout (stopped within a minute; it had only
  read). Stop the session first (`claude stop <id>`), then resume it from its own worktree.
- **Keep every suite run's output in a file.** Twice a failure's name was lost: #82's builder saw one
  engine test fail once in 19 runs, and it was never identified (12 more runs passed); 20a's sign-in
  failure was found only in a reviewer's screenshot. Run pytest with `-rf` into a log under `.private/work/`.
- **`gh pr edit` fails** on a Projects (classic) deprecation error. Set a body with `gh api -X PATCH
  repos/vextrus/vextrus-cubit/pulls/<n> -F body=@<file>`.
- **Contracts drift at the level of keys.** Where two prompts each named part of a shared shape, the
  builders drifted twice: 13's judgement facts against 15's node, and 13's sheet-number rule against
  19b's stand-in. Each cost both tickets a round. Write the exact keys and forms into both prompts
  before launch.
- **The merged tree is where contract faults show.** 15 with 13 (the facts' keys), 13 with 14 (a NUL in
  a title kills 14's store), #75 with 20a (a time zone alone gave a fresh browser the wrong date format;
  the Market was needed), 19b with 13 (the number rule): each passed alone. Run the partner's head
  merged before READY.
- **A builder's own words gate is necessary, not sufficient.** Four of the five catalogues that passed
  their builder's gate failed the orchestrator's fresh one: 19b with five musts after four rounds of its
  own, 14 with two, 13 with one, 20a with two and two spec sentences. Only 15's passed.
- **A hostile-input bound found one piece at a time costs a round a piece.** 13's four reviews each
  found the next unbounded walk (per space, then sheets per file, then the whole file). What held was
  one budget per file, spent by every walk, with every cut counted in the export: start there.
- **The owner expected a much faster wave.** Up to four code reviews on one ticket (13) and one
  builder's five refuter rounds before its READY (14: 175 min): four of wave 3's five tickets merged
  6 h 13 min after launch, and the owner stopped further rounds (29 Sep 2026). The fix is to cap rounds
  and budget time per ticket and per wave; the owner rules on both at session 06's start.
- **A strict ruleset puts every open PR behind after each merge.** `main` requires an up-to-date branch
  with every check and `design-gate`: after each wave-3 merge the owner updated the next PR and posted
  its gate again on the new head (four merges took 32 minutes). The orchestrator merges `main` into the
  next PR's branch itself and gives the gate for that head, or plans the merges as one ordered pass.

## Session 06, first start (29 Sep 2026): the cloud's cause, found in 15 minutes
- **The cloud's silent bundle had one cause: the Claude GitHub App did not cover the repository.** The
  CLI's own debug log said so (`claude --debug-file <f> --cloud …`: "Checking GitHub app installation …
  GitHub app is not installed on vextrus/vextrus-cubit (status is null)", then "[teleportToRemote]
  Bundling (reason: github_preflight_failed)", a 91 MB upload: the 40 s). Session 05 guessed at the
  account link and retracted it; the debug log answered in one launch. Once the owner installed the App
  on `vextrus`, a launch took 5 s, cloned `main`, and its session pushed a branch itself. **Check:**
  `scripts/factory/launch.py` launches every cloud ticket and exits 2 on a bundle or a wrong revision
  (`scripts/factory/tests/test_launch_cloud.py`). Diagnose a tool from its own debug log before theorising.
- **A diagnostic that a local push can satisfy proves nothing.** The first start's wait for the cloud
  session's branch was met by a push the orchestrator made locally on the owner's instruction. The
  launch wrapper judges the CLI's log instead. Check: the same.
- **Every acceptance-writer had to invent a name the plan leaves open** (an API path, a scorer seam, a
  component's props, a key format), and a builder may not change a pinned test: the orchestrator rules
  each report's "not pinned" list before the builder starts. Debt (a runbook step; no check).
- **`claude --bg -w <name>` makes a new `worktree-<name>` branch**, not the ticket's: create the worktree
  on the ticket's branch first so the acceptance commits are under the builder. Debt (runbook; no check).


## Session 06, second start (29 Sep 2026): seven tickets merged, the scorer's first answer, a power cut
- **Two drafting agents given one naming rule for scratch folders (`scratch-<file-stem>`) collided**: one
  resumed the other's folder and keyed Edison's structural drawing under the Sample Project's name (57
  sheets where the Plot has 38). Caught by comparing the draft's sheet count with its own Plot. **Check:**
  every key and draft records `files: {name: sha256}` for every file of its set, and `tools/scorer/drafts.py`,
  the review page and `keys-custody.sh` refuse a mismatch (24s, #113). Give parallel agents unique folders.
- **The scorer's first answer on main was 0 of 284 sheets, all "the sheet missing"**: the keys say a
  model-space sheet's layout is "model" with its frame, 13's export says `layout: null` with its box. The
  contract was written for both sides in words and never run on a real export until the owner's custody
  step. **Check:** 24f's acceptance tests join a key to an export shaped exactly as 13's (#128). Score a
  real export once as soon as the scorer exists, before the loops depend on it.
- **Storeys could never pass** (a key's list against the export's stated text, stringified): the
  acceptance helper typed `storeys: str`, so no test ever held a list. Found by a Sonnet adversary,
  confirmed by an Opus refuter (80). **Check:** 24f's list-storeys tests. Type a test fixture's fields as
  the real data holds them, not as the first test needed.
- **Adversaries on merged code pay** (the owner's ruling: Sonnet agents in a skeptic role): three of them
  found the scorer's two faults above, a weak pixel test (#122) and no wall breach in 28 operations × 9
  attackers. Every finding at 50 or more was re-run by an Opus refuter before acting (one fell from 55 to
  40, one rose from 45 to 65). Debt (a runbook step: adversaries after each merge wave).
- **`claude --bg --resume <short id>` opens a picker and blocks**; a fix round sent that way sat 25
  minutes. Message an idle local builder with SendMessage, or resume with the full session id. Debt.
- **Cloud builders push to a harness-named `claude/<slug>` branch, not the ticket's**: two BLOCKED
  reports sat unseen 45 minutes while the watcher watched `t16`/`t21a`, and a READY head present at the
  watcher's start never fired. The watcher now lists every `claude/*` branch each loop and keeps the heads
  it has handled. Debt (the watcher is a session script, not committed).
- **A power cut stopped every local session and agent for ~70 minutes.** STATE.md, NOTES.txt and the
  review files let every piece restart within 10 minutes; one empty git object (a write cut mid-way) was
  found by a reviewer and removed. Keep writing state to files after every event.
- **CI's shellcheck and CI's Python differ from the machine's**: 24s's shellcheck test skipped here (no
  shellcheck installed) and failed in CI; 24f's test that relied on a RecursionError at 60,000 nesting
  levels passed on uv's clang build and not on setup-python's GCC build (the stack use differs). Debt:
  shellcheck in the toolchain; tests must force the failure they test (monkeypatch), never count on a
  build's stack.
- **Acceptance tests had defects the builders could not fix** (a jsonb read as text, a layer contract, a
  fixture that swallowed queued refusals, a literal the words gate forbade, a sentence without its
  isolates): five `acceptance:` amendments by the orchestrator, each from a builder's BLOCKED with its
  proof. A writer should run its tests against a throwaway implementation before committing (the 24s and
  23 writers did, and theirs needed none). Debt (the acceptance-writer's brief).
- **`seed_demo` run twice duplicates every Developer** (#129; a builder is on it). Found only because a
  design walk re-seeded a database. **Check:** t129's acceptance tests.
- **A reading ticket that words codes skipped its words gate** (18 added `engine/plot` and
  `render_f1` catalogues; the missing gate was found only at merge). The orchestrator checks
  `git diff --name-only -- web/src/messages` at every READY. Check: `merge_ready` refused the merge
  until the gate was posted.

## Session 07 (29–30 Sep 2026; two power cuts, ~16.5 h lost; ~7 h of work)
- **The scorer's first real answer was a contract fault, not a reading one:** view subjects 0/N on both sets
  (free-phrase keys against the engine's 14 words) and three kind names spelled differently. A diagnosis
  agent proved it on synthetic cases before any loop spent time. **Check:** 24g's tests (kind folding, subject
  mapping, the subject table equal to the conventions) and its counts-only diagnostic.
- **A title block is a View** (CONTEXT.md); keys boxed it, the engine never emitted one: ~280 key views
  unjoinable. **Check:** loop-views' tests; #151 holds two after-cap edge cases.
- **A scored run measures only what GitHub holds, and only while the branch stands still:** loop runs were
  refused for an unpushed branch, then for a branch that moved mid-run. The orchestrator pushes loop
  branches and freezes them until the run ends. Debt (runbook).
- **A cloud launch from the main checkout clones main**, not the ticket's branch (one stray session built 22
  from main twice). Launch through `scripts/factory/launch.py` from the main checkout with `--on-branch`. **Check:** the launcher's
  refusal (it caught it).
- **Cloud builders are messaged with `claude --cloud <session_id> -p "<msg>" < /dev/null`**; SendMessage
  does not reach them. A cloud builder can also go silent (22's first builder never acted on its round): if a
  branch has not moved in an hour after a round, launch a fresh builder from the branch head. Debt (runbook).
- **The guard refuses any shell command whose text names the privilege tool** (a heredoc prompt that said
  "sudoers" was refused): write such prompts with the Write tool; `post-status` runs alone on its line.
- **A wait loop that greps process lines matches itself** (`pgrep -f real-drawings-run` waited forever on its
  own command line): match `comm`, not the whole line. Debt.
- **Every merge makes every other open PR stale** (the ruleset requires up to date): each merge costs the
  others a CI re-run and, for engine PRs, a posting run on the new head (cached, but the lock serialises).
  Merge in an order that puts engine PRs first. Debt (runbook).
- **A fix can re-open the class it fixes:** 22's double-act fix dropped Undo during the reload (caught only by
  122's slowed CI run); loop-views' fallback re-opened the sheet-eating box on one synthetic case. The
  re-check's mutation runs and 122's latency shard caught both. **Check:** 122's slowed Vitest step; the
  reviewers' mutation runs (practice).
- **Two copies of a local builder** run when `claude --bg --resume` meets a session still open: stop the
  original first (`claude stop <id>`). Debt.
- **Adversary rounds this session:** the read job (a limit that never reached the QS, 70 → fixed by nrif; a
  pathological file holds the CAD worker, #140) and the scorer/posting path (key fence held against 1,200
  crafted pairs; NaN not refused by the reader, refuted to 25; #149). Each ≥ 50 re-run by an Opus refuter.

## Session 08: M0's merges and fix wave
Sessions 08 onward are held to the rule above by `tools/lint/docs_paths.py`: each top-level bullet ends
with `Check:` and a path on main, or `No check:` / `No check yet:` and the reason or the issue.
- **Messaging a builder the wrong way blocks or duplicates it:** `claude --bg --resume <short id>` opens a
  picker and blocks; resuming a session still open runs two copies. Message idle local builders with
  SendMessage; resume a stopped one by its full session id. No check yet: factory: the guard's short-id
  rule (spec §3.13, C9).
- **A scored run measures only a branch GitHub holds and that stands still:** runs were refused for an
  unpushed branch and for a head that moved mid-run. Push the branch and freeze it until the run ends.
  No check yet: factory: the real-drawing lock (`rdlock`, spec §3.13).
- **Test fixtures typed unlike the real data pass and prove nothing** (storeys were a list; a helper typed
  a string). Type fixtures as the real data holds them, and force the failure a test tests. No check:
  a reviewer's judgement; `pr-reviewer` reads every acceptance file for it.
- **Two agents sharing one scratch folder overwrote each other.** Give every agent its own folder under
  `.private/work/`. No check: the folder is private and outside git.
- **A cloud builder can die with its account** (#168 was never built when account B stopped). Launch
  every builder from the one account the orchestrator runs on. No check yet: factory: the launcher refuses
  a builder launched from another account's config (no test checks the account or the config dir today).

## Session 09: landing the reviewed queue
- **Strict up-to-date merging is serial:** every merge re-runs the next PR's CI (the python job went to
  35 minutes, #194). Merging main into a PR's worktree and running the suites there first showed every
  semantic clash before CI did. No check yet: factory: merge queue trial (spec §3.13, C14).
- **An acceptance amendment needs the owner's approval** unless the owner ruled its class in advance;
  `tools.lint.acceptance` refuses a builder's change to an acceptance path. Check: `tools/lint/tests/test_acceptance.py`.
- **A wait loop that greps process lines matches itself** (`pgrep -f` waited on its own command line; a
  second time after session 07). No check yet: factory: the guard's wait rule (spec §3.13, C8); a
  CLAUDE.md law line meanwhile.
- **The scorer refused a main export cached by a PR's run** (#199): score main with `--fresh`. No check
  yet: #199, still open (`tools/scorer/tests/test_score.py` pins only the symptom).

## Session 10: the export without paper
- **A change to what a check reads can blind it silently:** after #210 the scorer read the job's export,
  which had no paper, and main scored 0 sheets until #212; the posting run's diff never compared paper.
  After such a change, score main before trusting any number. No check yet: factory: reading measures
  (export G5, S1 diagnostics, S2 proxy) in one custody re-run (spec §3.13, C6).
- **A merge that combines both sides of an acceptance file is refused** (#186 was replaced by #208):
  git merges it itself when the sides changed different lines; on a conflict take the file whole
  from one side (not conflict markers, not a mix), then re-apply the branch's change in an
  `acceptance:` commit. Check: `tools/lint/tests/test_acceptance.py`.
- **Real-drawing text reached the public repository** in a scored loop's test literals, for about 25
  minutes. Scan new literals against the cached exports before pushing an engine branch. No check yet:
  factory: the leak wall (spec §5, T2; #211).
- **The cloud launcher refused twice** (cloned at main, not the ticket's branch); local builders worked.
  Check: `scripts/factory/tests/test_launch_cloud.py`.

## Session 11: the machine's limits
- **Times estimated from memory were wrong** (four of six sessions). Stamp every event from `date -u`.
  No check yet: factory: `stamp.py` and the clock hook (spec §3.13, C7); a CLAUDE.md law line meanwhile.
- **Eight local builders filled swap, and parallel suites filled the disk** (38 GB of test leftovers;
  `git bundle` dies on a full disk). Check `df` and `free` before every launch. No check yet: factory:
  the governor's memory and disk floors (spec §3.13).
- **CI flaked under load** (t16's middle-drag pan, tviewerplot's P cycle, the "bulk act, half refused"
  toast; #245). Check: `.github/flaky.txt` and `tools/lint/tests/test_ci_shards.py`.
- **One real-drawing run per engine head on one lock** (~29 min), and every engine merge stales the next
  PR's head. No check yet: factory: visible real-drawing lock queue (spec §3.13).

## Session 12 (4 Oct 2026): the owner's walk found D1–D10; the factory
- **"Walk now" was said to the owner twice with no agent walking first,** and the owner's walk found
  ten defects an agent walk then found in about 50 minutes. No "walk now" without a passing G1 verdict.
  No check yet: factory: G1 and `ready.py` (spec §5, T7); a CLAUDE.md law line meanwhile.
- **Design reviews walked the demo seed, where no file is ever really being read,** and web tests used
  fakes no test checked against the server (D1, D8). The seed proves a UI ticket's mechanics only. No
  check yet: factory: G2a: fakes validated against OpenAPI; closed Literal keys.
- **Walk findings and budget cuts were dropped without an issue** (F6 became D2; D6 was a silent cut).
  Every walk finding of any severity, and every cut, becomes an issue. No check yet: factory:
  `merge_ready` (c), no silent cuts (spec §3.13).
- **The living docs named paths gone from the tree** (`scripts/score/` in the architecture and the
  real-drawings skill, after the scorer moved to `tools/scorer/`). Check: `tools/lint/docs_paths.py`.
- **A probe's own wait matched itself again** (the cloud probe's `pgrep`, the third time). No check yet:
  factory: the guard's wait rule (spec §3.13, C8).

## Session 14 (5 Oct 2026): the review command and the pane
- **An orchestrator CLAUDE.md edit made without the docs lint broke CI** (97 of 90 lines, a pinned phrase
  dropped). Run `tools.lint.docs_paths` and the line tests before pushing. Check:
  `tools/lint/docs_paths.py` (its 90-line rule; 8 lines added to CLAUDE.md turn it red).
- **A fix instruction listed `docs/handoff/**` as safe; the docs-only list must not hold it.** Check:
  `scripts/factory/tests/test_review_units.py`
  (`test_agent_instructions_and_files_code_reads_are_never_docs_only`).
- **Denylists in review tiers lose; allowlists hold.** Check: `scripts/factory/tests/test_review_units.py`
  (`test_an_unlisted_docs_path_is_never_docs_only`).
- **Fix rounds regress.** Builders re-run every earlier round's cases. Check:
  `scripts/tests/test_fix_regression.py`.
- **Derived UI state needs one source** (U2's Reviews tab). Check:
  `tools/mod/vextrus-factory/tests/acceptance/ts14u2/pane.test.mjs`.
- **Acceptance pins can contradict a later owner ruling:** use `scripts.factory.amend`. Check:
  `scripts/factory/tests/acceptance/p6_amend/test_amend_command.py`.
- **The old review workflow ignored CI** (PASS on red heads). Check:
  `scripts/factory/tests/test_review_units.py` (`test_a_failed_ci_check_or_ci_workflow_job_is_red`).

## Session 17 (7-8 Oct 2026): the factory's speed
- **Never block a session on an owner question the session can work around:** ask, then keep working; flag the
  half-way gap before asking (session 17 lost ~5 h waiting on a disk-cleanup and swap-reset question). No check: none possible (a
  process rule); carried as a binding lesson in `docs/handoff/session-18-prompt.md`; if made twice it goes into
  CLAUDE.md's mistakes list.
- **A forced colour in the caller's shell broke every check that parses a child's output** (#585): the owner's
  `FORCE_COLOR`, `PY_COLORS` and `CLICOLOR_FORCE` leaked into nested pytest and node runs, so the acceptance lint
  read "not built" and a guard test miscounted; it failed on main and blocked two builders' verifies for hours.
  A check that parses a child's output must strip forced-colour env (fixed by #614). Check:
  `tools/lint/tests/test_acceptance_lint_runs.py`
  (`test_a_colour_forced_in_the_callers_shell_does_not_break_reading_pytest`) and `scripts/tests/test_verify.py`
  (`test_a_check_never_inherits_a_forced_colour`).
- **Local verify skips the `needs_toolchain` tests, so an engine PR went READY and failed CI's toolchain job**
  (E2, #613: two toolchain acceptance tests broke in its fix round). The toolchain is on this machine; a verify of
  `engine/**` changes must run them. No check yet: #616 (verify runs `needs_toolchain` tests for engine paths
  locally; session 18's attempt #621 was cut after three rounds: a plain `uv run` re-syncs the venv to the pure
  ezdxf wheel, so the run needs its own toolchain venv; design on #616). Until then every engine builder's prompt
  says to run them by hand.
- **Concurrent verifies in different worktrees collide** on the vitest browser port and on the test database's
  name, so a green tree reads red under contention (Q3's re-verify). Check: `scripts/tests/acceptance/ts18t617`
  (verify's plan gives each worktree's run its own vitest port block and its own database name).
- **Enumerating the dangerous side of a list never converges** (F6's strict review paths: three rounds, a missed
  wall each round). List the safe side instead: strict by default, a short `[lax]` allowlist with its
  carve-outs by name (`scripts/factory/review_tiers.toml`). Check: `scripts/tests/acceptance/ts17f6` (S18-F6).
- **The lander updated every branch after the owner turned "require up to date" off,** re-running full CI and a
  real-drawing post per landing for nothing. It now lands a PR as it stands; only `land update` brings main in, and
  a conflicting PR is refused naming it (#611). Check: `scripts/tests/acceptance/ts17f7`.

## Session 18 (9 Oct 2026): Phase 0 closed, a power cut, G1 still 13 of 16

- **G1's act timer armed its answer wait after the request left,** so an answer in the same event batch was lost and
  recorded as a 180 s timeout with status 0 (three undo acts on main d0c53b48; the server had answered 200 at once).
  Check: `web/src/acceptance/ts18walk1` (#625; 300 presses under load, no answered act lost).
- **Real-drawing runs started by hand bypass the rdlock,** so `rdlock_min` read 0 for a session that ran them
  (session 17). `measures` is right for what `rdlock run` writes. No check yet: #620 (`scripts/real-drawings` refuses
  to run outside the lock; a custody change). Until then every run goes through `scripts.factory.rdlock run`.
- **`allowlist batch` opens a head with no `Factory-State: READY`,** so CI's `ci` job fails on it and the lander
  refuses; the orchestrator had to verify and commit READY by hand (#622). No check yet: the factory freeze
  holds it until G1 passes twice.
- **verify's `contract-fixtures` can run before `openapi-export` writes the schema** (seen by two builders). No check
  yet: #626.
- **A crosspr-only BLOCKED head cannot be reviewed alone**: CI's heavy jobs skip a non-READY head and the review
  refuses a red CI (E3, #629). Opening such a PR by hand is wasted; members that conflict only with each other go
  straight into the train (lesson h of session 17, confirmed). No check: a rule in the session brief.
- **A power cut (11:14Z-15:01Z) killed every builder**; resumes copied each conversation into a new session, and
  Q1's copy took a new name, so the orchestrator thought it gone and ran a second verify in its worktree; crosspr's
  scratch worktree then vanished mid-run. No check: find a builder by its `cwd` in `claude agents --json`, never by
  name, before working in its worktree.

## Session 19 (9-10 Oct 2026): Q1 landed, a second power cut, G1 11 of 16 still failing

- **The words lint ran in CI, not in verify:** verify does not run tools.lint.words that CI's web job runs -> a
  verified head goes red in CI. Fix: add the check to scripts/verify.py (small factory PR). Check:
  `scripts/tests/acceptance/ts19f1/test_verify_words_lint.py` (#633; verify plans `words-lint` for web/ and the
  lint's own files).
- **Drawing text leaked into acceptance commits, caught before any push:** acceptance writers fed drawing-analyst
  reports copied real titles into fixtures and commit messages twice (B2, B4); leakscan caught both at push; redo on
  fresh branches s19-b2b, s19-b4b (old s19-b2/s19-b4 local, never pushed). Check to add: acceptance_lint (or
  amend/the writer's finish) runs leakscan range on the writer's commits. B4 changes tools/scorer -> owner custody
  re-run before landing. Check: `.claude/hooks/guard.mjs` (no push without a clean range scan) caught both; the
  writer-side scan is not yet code (#637).
- **Verify fails on load-sensitive tests:** ts15a2's 500 ms answer bound failed verify runs beside other heavy runs
  (S19-B5, Train A, S15-E2 in session 18), and verify's own concurrent checks fail these tests even alone on a quiet
  machine; one was a real test bug (a process-directed SIGHUP taken by another xdist thread, fixed in Train A at
  167aaca2). Nothing refuses a verify beside a real-drawing run or another verify today. No check yet: #636 (verify
  runs its timing-sensitive checks one after another); until then run verify alone with `VEXTRUS_VERIFY_WORKERS=2`.
- **The acceptance lint called git's clean merge a hand resolution** (`diff-tree --cc` names a file both sides
  changed), so no train could pass CI or take an amendment.
  Check: `tools/lint/tests/acceptance/ts19f1/test_merge_resolution.py` (#633).
- **A second power cut (about 16:50Z-18:08Z)** stopped every builder again; resumes copied conversations, so builders
  were found by `cwd`, not name (session 18's lesson held). No check: power is outside the code; the rule is in
  the session brief.

## Session 20 (10 Oct 2026): Train A through four review rounds, Train B integrated, G1 at 5 of 16 on its head

- **This machine's wall clock jumps (WSL2 time sync, +1.5 to +2.6 s about every 30 s), and this Python's
  `Event.wait(timeout)` waits on it,** so a test's verdict wait woke early and A2's held-row tests failed on a quiet
  machine. No check yet: ts15a2's waits loop on the monotonic clock in Train A (6d8b1c4c, lands with #641); a lint on
  a bare `.wait(<n>)` verdict in tests is #636.
- **A timing bound green on this machine can be red on CI** (its runners are about 5.5x slower): w334's linear-time
  path and ts15a2's 500 ms answer both failed only in CI. No check: CI's shards are the measure; read their timings
  before landing.
- **A read job's finishing step holds Step 1's write lock through `set_questions` over the whole set** (5-15 s on
  the real sets), so an act landing inside it is refused 503 after 3 s; G1 saw one undo per set. No check yet: the
  find/keep split and its test are session 21's ticket (`.private/work/session-20/diag-undo-503.md`).
- **A fourth power cut in two days (about 10:40Z-11:24Z)** stopped both builders; resumed copies took new names and
  the watcher's LOCAL-IDLE fired falsely on them while they worked. No check: power is outside the code; find
  builders by `cwd` (session 18's lesson held).
- **Several sessions' budget records share `.git/vextrus/`,** so a builder's clock line showed another ticket's
  record. No check yet: name each record by the worktree, not only the ticket.

## Session 21 (10-11 Oct 2026): Train A landed, merge_ready reads large PRs, Train B's boundary rule regressed five times

- **merge_ready, the PR leak scan and the lander read `gh pr diff`, which GitHub refuses over 20000 lines,** and
  GraphQL's `files(first: 100)` cut a 207-file PR's facts short, so Train A (#641) could not pass the merge gate at
  all. Check: `scripts/tests/acceptance/ts21mr/test_large_pr.py` (#645: merge_ready and `leakscan pr` read diff,
  files and commits from git; a 150th-file leak is found). The lander's `Gh.files` read it too until #655 (check: `scripts/tests/acceptance/ts22l647/`); #641 landed by hand.
- **Drawing text reached test fixtures twice in one session** (C2's acceptance writer, C4's builder), each called
  "invented". Check: `scripts/verify.py`'s leak scan (and publish's) caught both before any push; each was redone on a fresh
  branch. The guard refuses `tools.leakscan range` from a builder's worktree, so the orchestrator scans for them.
- **A sha typed from memory again** (an rdlock no-post run on a head that does not exist); caught before any gate,
  restarted with `git rev-parse`. No check: `rdlock run --head` should refuse a sha git cannot resolve.
- **`stamp start --budget 12` reads 12 minutes,** not hours. Check: `scripts/factory/tests/acceptance/ts22stamp/` (#675, session 22, after a repeat).
- **Verify races on a fresh worktree** (contract-fixtures before openapi-export; pytest-lint sees other worktrees'
  databases): four builders lost a 30-minute verify to it. No check: #644.
- **A HOLD file ordered verifies better than messages:** builders hold suites while
  `.private/work/session-21/HOLD` exists; each verify then ran alone on the critical path. No check: a practice the orchestrator keeps, not
  a code path.
- **A fix round that redefines an identity ("what counts as the same plan") regressed in every review** (#648 r1-r3,
  #650 r1: by number, then view, then storey range, then a withdrawal). No check: a builder changing an identity
  key writes the table of cases (copies, halves, another view, excluded, undo) as tests before the fix.
- **A fourth power cut (03:41Z-09:50Z) killed every agent;** resumed copies took new names, so messages to the old
  name went to a stale Remote Control entry. No check: find sessions by `cwd` (`claude agents --json`).

## Session 22 (11-12 Oct 2026): Trains B and C landed; G1 measured M0's real distance

- **`stamp start --budget 8` read 8 minutes, a second time** (session 21 noted it without one). Check:
  `scripts/factory/tests/acceptance/ts22stamp/` (S22-STAMP, #675: `stamp start` refuses a bare-number budget).
- **A fix round that tunes a budget constant regressed in the next review** (#653: one shared budget of one step an item
  cut real-size column plans). Round 3 changed the shape instead (titles held whole read first in one linear pass,
  never cut) and passed. Same class as session 21's identity treadmill. No check: after one regression from a
  constant, the next round changes the shape, not the number.
- **A wall-clock test timed once, cold, flaked on CI the day it landed** (#653's shared-budget tests; #655's python
  (rest)). Check: `engine/plot/tests/acceptance/ts22timing/` (every engine/plot timing comparison takes the best of
  several runs through one helper).
- **A builder changed an acceptance fixture itself under an `acceptance:` commit** (#654). Check: `tools/lint/acceptance.py`
  (CI refused it: no red/green lines); redone through `scripts.factory.amend` on a fresh branch.
- **`gh pr view --json baseRefOid` again** (S21-MR, then #655's first head: real gh has no such field, so the lander
  refused every PR; the fakes answered any field). Root: the orchestrator's acceptance brief named the field. Check:
  `scripts/tests/acceptance/ts22l647/test_gh_pr_view_fields.py` (every `pr view --json` field in scripts/ and tools/
  is one gh knows; the fakes refuse others).
- **The orchestrator's own brief carried a real sheet title into an acceptance test** (S22-FL7), and a writer copied
  another (S22-FL5); the range scan before a push caught both, redone on fresh branches. No check: example titles
  in a brief are invented.
- **merge_ready read "for a later ticket" notes under `## Cut` as unfiled cut items** (#650). Check:
  `scripts/merge_ready.py` (it refused); publish still builds bodies that can do it.
- **G1's script layer passed all but one check while the agent layer failed seven milestone items, with seven blockers.** The script checks
  measure what earlier tickets fixed; the critics found unbuilt spec (Correct E), unlogged acts and wrong meanings.
  No check: run the agent layer on every walk, even when the script layer fails.
- **An act's 503 during a read came from per-row ORM writes under Step 1's write lock** (12,560 statements, 9-10 s
  on a 278-view DWG), not from finding Questions (C1's target). Check: `vextrus/takeoff/tests/acceptance/ts22lockhold/`
  (statements under the lock flat in views a sheet; an act during finishing is answered).
- **The branch held by another worktree** blocks a launch on it: the orchestrator detaches the writer's worktree
  (`git switch --detach`) before launching the builder, or builds on a sibling branch and fast-forwards. No check:
  a practice the orchestrator keeps.

## Session 22 (11 Oct 2026): the Correct act (S22-FL8)
- **An act that keeps typed text in its own row must check that text before the row is written.** S22-FL8's
  first head wrote the correction's Confirmation (its `before` keeps the new number and title) before the
  drawings setters checked the text, so a NUL or a lone surrogate was a 500 (jsonb refused it), not a coded
  400; the refuter found it (score 50). Check: `vextrus/takeoff/tests/test_step1_correct.py`
  (`test_typed_text_that_cannot_be_kept_is_refused_with_a_code_and_nothing_is_written`).
- **An undo that restores a row "as it stood" restores a state other people's acts may have moved on from** (S22-FL8
  review 2: a correction's undo put the `missing` Question back withdrawn by an exclusion since undone, so a
  numberless sheet confirmed). A text edit also has to clear what read the old text (`plot_title_alike`, as
  `record_sheets` does). Round 3 found the same class again (an undo that restored one act's old value over
  another person's: A and B correct, A undoes, B undoes). Check: `vextrus/takeoff/tests/test_step1_correct.py`
  (`test_a_correction_undone_after_the_exclusion_it_followed_was_undone_asks_the_question_open`,
  `test_two_people_correcting_one_sheet_undo_only_the_latest_each_time`,
  `test_correcting_a_title_clears_the_plot_page_that_read_the_old_title`).
- **A fourth round of the same undo class: restoring "through a chain" of other people's acts never stopped finding
  cases** (#680 reviews 2-3: five findings, one root). Round 4 changed the shape, as the constant-tuning lesson
  says: an undo takes back only the latest standing act, only while the row is as the act left it, else it is
  refused in words. Check: `vextrus/takeoff/tests/test_step1_correct.py`
  (`test_a_correction_is_not_undone_once_another_correction_stands_after_it`).
- **A server act that can undo another act than the tab expects makes the tab's own history words wrong** (#691 round 2:
  the web said "corrected S-05" while the server undid a confirmation). The words and the history follow the
  server's reply. Check: `web/src/takeoff/correct.test.tsx` (the test "words Ctrl Z from the server when it
  passed the correction over, and keeps the correction to undo").

## Session 23 (12 Oct 2026): M0's blockers went round the review cap; the real-drawing lock set the pace

- **A question to the owner blocks the orchestrator's turn: two hours passed with two READY heads unread** (asked at
  3:05 of 8:00, answered at 5:08; FL8's and FL5's READY heads waited). No check: before asking, every running
  builder has its next message and every READY head its next step; ask only what nothing else waits on.
- **A rule built on word order went round three reviews, each finding a new word case** (#682, then #684: the tie
  between a building element and a site work). The fourth shape (a view proposes every element's Step plus Step 14,
  no tie; site works never a view's subject) held. Same class as sessions 21 and 22. Check:
  `engine/recognise/tests/test_views.py` (every reviewer's example pinned through `views.find` and `conflicts.find`).
- **A fix round's docstring claimed inertness the code did not have** (#684 round 1: site works "as before they
  were words" in `subjects()`, while `ViewCandidate.subject` still carried them to the conflicts stage). Check:
  `engine/recognise/tests/test_site_works_inert.py` (`test_a_views_subject_is_what_it_was_before_site_works_were_words`:
  a view's subject equals main's for any title; and the continuation and same-storey cases).
- **The FL5 cases table over every real sheet changed the rule in one pass** (#676's "states storeys and stands in
  no drawing" kept 2 of 4 real long titles; the shape rule kept 4 of 4 and 124 of 124 shorter ones). No check:
  a recogniser rule that a review sent back once is designed from a cases table of the real sets first.
- **The real-drawing lock is the session's pace: a run takes 22-41 minutes and they queue one at a time** (#681's
  no-post and posting runs alone took 79 minutes). Posting runs went straight to `--accept "<reason>"` when an
  earlier no-post of the same code had been judged. No check: queue a posting run only for a head whose review
  passed; cancel a run whose head a fix round has replaced.
- **The design gate needs every item 1-11 named once; "none" is not a value** (post-status refused `--failed none`
  and a list without 11). No check: post-status refuses it by itself.
- **Two builders on one ticket both reached READY** (#680: the cloud builder silent for an hour pushed at 09:25 while
  a local relaunch finished at 09:34). No check: before relaunching a silent cloud builder, tell it to stop and
  wait for its answer or its deadline.
- **A wall-clock ratio test in engine/plot still compares single runs** and failed #680's CI once under load.
  No check: #685 carries the fix and its check.
- **Correction undo restored through a chain and broke three rounds running** (#680: each round's fix of
  "restore what the correction replaced" met a new interleaving of corrections, undos and answers; round 3 found
  75 and 70). Stopped at the cap. No check: session 24 changes the shape (Ctrl Z takes back only a sheet's
  latest standing correction), with every reviewer's sequence pinned.

## Session 24 (12 Oct 2026): seven merges, one G1 walk; the factory's own gates cost the most time

- **A lens's FIX outranked the review bar** (#698 rounds 1-2: findings of 60-65 on a path the owner's ruling made lax,
  recorded FIX twice because a lens wrote FIX). Check: `scripts/tests/acceptance/ts24l1/` (#707: the verdict is
  computed from the bar; a lens FIX with no standing finding at the bar is PASS).
- **The reviewer's own words closed the lax list** ("only the web's view components and the docs' Markdown are lax"),
  so lenses judged a session ruling's paths strict. Check: `scripts/tests/test_bar_docs.py`
  (`test_no_bar_document_closes_the_lax_list_in_words`).
- **An accept reason was posted from a builder's counts before the run's own table was read** (#698: the table had 88
  changed views the reason did not name; judged afterwards, nothing worse). No check yet: run `--accept-if-clean`
  first and write the reason only from the table.
- **A posting run on a branch older than main shows main's merges in reverse** (#710's first run: 88 views and 55
  render losses that were #698's and #704's). No check yet: `land update` before every posting run.
- **Cloud builders could not finish verify's web tests under load** (A3, B1, B3 blocked for hours); the orchestrator
  verified the same trees locally with a clean `npm ci` and they were green. A symlinked node_modules made a false
  "regression" (gate.test.tsx) that cost a builder a round. No check yet: a session-25 ticket gives verify a serial
  web mode for cloud boxes.
- **The watcher missed carried-over tickets' READY and a cloud BLOCKED** (A1 three times, A7 55 minutes). No check yet:
  read every builder's branch tip on each self-check (#701, cut, adds the watcher's check).
- **Two open PRs that conflict each refuse the other's READY through crosspr** (#706 and #714). No check yet: the
  orchestrator orders them and closes the later one until the first lands.
- **A spec's worked money example drew new findings every round** (#700, three rounds). No check yet: one seed table
  that every figure cites (its reshape, ae830596).

## The exploring session beside session 24 (12-13 Oct 2026): M0 dragged on execution, not design

- **A depth review overclaimed until refuted** (an Opus `high` product review: none of its nine "change before M1" claims
  survived a refuter as cheap-now; the exploring session's own "verified" was once half-checked). No check yet: every claim
  that changes a plan, a brief or a scope gets one `refuter` before it steers.
- **One figure was quoted three ways** (round-1 PASS as 24 %, 13-24 % and 32 %, each right only for its window). No check
  yet: a figure in a brief names its source and window (`docs/research/2026-10-13-why-m0-dragged.md`).
- **A machine command named no device** (`swapon -a` reads `/etc/fstab`, which lists no swap on this WSL; swap stayed off
  about 47 minutes). No check yet: a command that changes the machine names its device (`/dev/sdc`).
- **A workflow stayed red for a week with no owner** (`e2e.yml`: 129 failures on main, 0 passes in 300 runs; the smoke test
  waits for words the screen no longer says). No check yet: session 25's measures add the e2e pass streak on main.
- **The guard fails open and matches words, not acts** (no hook sets `onFailure`; `guard.mjs` fails closed only for its
  `closed` rules; its status, privilege and stamp rules refused read-only queries and notes that merely named a word, four
  times in one evening). No check yet: session 25's F4 (the PreToolUse guard's `onFailure: "block"`, allow cases in
  `guard.test.mjs`).
- **A fix round introduced a new fault** (#728 round 1 changed "ADR 0043" to "ADR 0041" and kept the wrong item; 12 of 16
  sampled later-round findings came from the previous fix). No check yet: session 25's F1 (`review self` on each fix's own diff).

## Session 25 (13 Oct 2026): nineteen merges, e2e green for the first time, one G1 walk; the watcher's misses cost the most

- **The e2e test was right and CI was wrong** (e2e.yml never installed the ACadSharp dumper, so every read failed at the
  second reader; the brief blamed the test's words). Check: `scripts/tests/acceptance/ts25e2e/` (#749). e2e then went green
  on main for the first time and held 5 runs.
- **verify's contract-fixtures raced the schema export** (#709; 4 of the orchestrator's first 5 local verifies). Check:
  `scripts/tests/test_verify.py` (`test_contract_fixtures_runs_after_the_export_in_its_chain`, #750).
- **The watcher missed BLOCKED pushes without a Factory-Reason, every carried-over ticket's push, local builders' commits
  on a renamed branch, and every builder's reply** (~290-340 builder-minutes unseen; the owner relayed one reply by hand).
  No check yet: #761 (FX1, FX2 in session 26's brief).
- **The round cap closed five PRs whose last findings were under 75 and came from the previous fix** (F1 #748, F3 #737,
  M1-24 #747/#756, M1-06 #753: $45.83 of $94.04, none merged). No check yet: the owner's delta-review ruling (FX4).
- **A docs page with one seed table never converged under review** (M1-24: a stale copy of a changed figure in every
  round, two PRs). No check yet: the seed-figure lint #765 (#762).
- **merge_ready's Cut parser counts every non-blank line under a Cut heading as an item** (#755 and #757 refused twice
  each at land). No check yet: #759 (publish runs the same check).
- **A posting run started with a reason judged from an older head's table** (#711 after #723's engine merge): stopped
  before it posted; re-run no-post on the new head. No check yet: the session-24 lesson stands.
- **Parallel local verifies time out the same three web tests that pass alone**, as cloud verifies do. No check yet: FX3.
- **The exploring session's diagnosis missed the factory's own gate friction**: design gates on test-only web PRs, the Cut
  parser, catalogue caps crossed only after a main merge, an engine timing test failing an unrelated PR's CI.
  No check yet: each is filed with its owed check (#759, #761, #764; the design gate is FX5 in session 26's brief).
- **An orchestrator's READY commit claimed a fix its tree did not hold** (D2 #773: the builder's push predated the fix
  message; round 2 caught it). No check yet: FX1's ci_gate change should refuse a READY commit whose subject names a fix round
  while the tree equals its parent's; until then, diff before writing the subject.
- **Fixes to UI tickets made new faults in round 2 on D1, D2 and D4 alike** (copy naming, the confirmed bar, the sheet filter).
  No check yet: FX4's delta review re-runs the earlier rounds' attack tests on each fix.
- **The real-drawing lock, not the builders, set session 25's pace at the close**: five engine-path tickets each owed a 25-45
  min run, strictly serial. No check yet: the owner's Q-R10 (one integration run) is session 26's rule.
- **The orchestrator's own fix direction contradicted the spec** (D1 #774: "name a copy by title first" against m0-screens
  6.7's mark first; round 3 caught it). No check yet: every fix message the orchestrator writes cites the spec line its
  direction follows.
- **The orchestrator passed drawing phrases to builders in its messages** (E1: the two phrases a set prints where a member
  continues on the next sheet), and a builder and an acceptance writer copied them into code and a commit message; verify's
  leak scan stopped both before any push, so the commits held. Check: `tools/leakscan/` (run by `scripts/verify.py`).

## Session 26 (13-14 Oct 2026): every factory fix and every M0 ticket merged (23 PRs); the delta review carried nine capped PRs; G1 walk #1 failed on older code a deeper walk found

- **The delta review counted a replayed attack that failed again as CONFIRMED, with no refuter** (D4 #771 r6, FX1 #786
  r3 and FX2 #794 r3: three false FIX verdicts; two refuter runs proved them false; every delta review was held from 17:47Z
  to 20:29Z). A replay failed when its own staleness guard tripped, or when it called a seam the fix had removed. Check:
  `scripts/tests/acceptance/ts26fx9/` (replayed attacks are judged, staleness failures are STALE, a same-head re-round
  only after a FIX that rested on unconfirmed replays) and `scripts/factory/tests/test_review_delta.py` (#808). The
  orchestrator's ruling holds: no same-head re-review after a refuter-CONFIRMED replay (no refuter shopping).
- **The delta review past the round cap merged nine PRs that session 25's cap would have closed** (#774 #783 #765 #794
  #786 #801 #805 #737 #771; 21 delta runs at $1.19 each, against $3.05 for a full round). Check:
  `scripts/tests/acceptance/ts26fx4/test_delta_review.py` (#789).
- **A review started on a head whose CI was red** (session 25 spent $12.05 on 3 such runs); today FX7 refused at least
  three (#804 r1, #748 r4, #794 r3's first try). Check: `scripts/tests/acceptance/ts26fx4/test_ci_first.py` (#789).
- **GitHub reported a completed `ci` job as in progress, so FX7 held D4's round 7 until a ci re-run** (~10 min). No check
  yet: #819 (review reads the run's own conclusion when the rollup disagrees, or prints the re-run command). #788 is a different case: it covers a head with no ci check at all, not a
  stale one.
- **verify did not run CI's harness node tests**: it ran only `.claude/hooks/**`, while CI runs `.claude/**`, `scripts/**`
  and `tools/mod/**`. FX2's local verify passed, then CI failed a runbook test that reads SKILL.md, and FX7 refused the
  round. Check: `scripts/tests/acceptance/ts26fx10/test_node_tests.py` (#806; verify reads the argv from `ci.yml`).
- **verify did not run CI's slowed-fake web pass** (`VITE_FAKE_API_LATENCY_MS`). B2 #780 passed review r4, then CI
  failed its own toast test, and two more of its tests were flaky under latency. D7 #805 passed its gate, then CI found
  a regression in two tests. That is about 2.5 h over two tickets. Check: `scripts/tests/acceptance/ts26fx11/` (#809;
  the latency is read from `web.yml`, so it cannot drift).
- **merge_ready accepted only "None." and "Nothing." as an empty Cut, and builder.md named no empty-Cut words.**
  Publish refused FX1's body twice: once for notes after "Nothing cut.", once for "Nothing cut." itself. It now also
  accepts "None cut.", "Nothing cut." and "Nothing was cut.", and builder.md says "None.". Check:
  `scripts/tests/acceptance/ts26fx8/` (#792).
- **publish's Cut check caught bad bodies before any PR opened** (FX1 twice). Session 25 lost 4 refused lands to the
  same parser. Check: `scripts/tests/acceptance/ts26fx6/test_publish_cut_check.py` (#782).
- **A cloud launch was REFUSED (the prompt-leak scan) but the orchestrator read only `| tail -1`**, which shows the
  `record:` line. The pipe also hid exit 2. 47 min were lost on E1's fix round. Cause: pasted reviewer summaries in the
  prompt hit the scan. Rule until the check lands: read the whole launch output; never pipe it; never paste review
  summaries into a cloud prompt; write invented examples. No check yet: #820 (`scripts.factory.launch` prints the REFUSED line last as well as first; it already exits 2 and prints it first).
- **`rdlock run --head <sha>` recorded origin's head, but `scripts/real-drawings <branch>` read the stale local branch**
  (E1 at its older head): one wasted run, stopped. Check:
  `scripts/factory/tests/test_s25f3_fixes.py` (`test_a_run_of_the_runner_refuses_when_the_local_branch_is_not_the_head`,
  #737).
- **The fake API hid a real-API behaviour.** B2's typed storeys correction showed ", corrected" on the fake API. On the
  real API it raised the title-vs-plans Check, and the row read "Question" instead. Only the integration gate on the real
  API found it (#811 item 1 FAIL). B2 had passed review four times by then. Rule: the design gate walks the real API,
  never the fake. No check yet: #821 (a backend test for each server-dependent promise a fake-API test makes, named in the PR).
  #812 lists the gate's other leftovers.
- **The orchestrator's gate-fix message asked for words that committed acceptance tests contradict** (D6 #801: the
  header "File, where" and one ", x" phrasing for options, while `ts25d1` and `ts24a3` pin "File" and the option's "at x").
  The builder cut one of them, the re-walk failed item 1 on both, and the orchestrator reversed itself (header stays
  "File"; options keep "at x"). That cost one fix round and one gate walk. **This is the second time** (session 25: D1's
  "title first" against m0-screens 6.7). No check yet: #822; until it lands, CLAUDE.md's "mistake made twice" list carries it.
- **Design gates on every UI PR found real defects that review had passed.** 12 walks failed 5 items: D1 (File cell),
  D4 (Jump to rows), D6 twice (tooltip split, row label wrap) and B2 in #811 (real-API storeys). Each was on a head whose
  latest review was PASS. D7 passed all three of its walks, but those walks filed #807, #813 and #814. In total the gates
  filed 9 issues (#791 #795 #796 #803 #807 #810 #812 #813 #814). Keep a gate walk on every UI head after any fix, delta PASS or not. Check:
  `scripts/merge_ready.py` (the required design-gate status) and `tools/lint/tests/acceptance/ts26fx0/` (#783).
- **A builder edited an acceptance test inside a product commit** (FX10, #804). CI's acceptance check refused it. The
  orchestrator rebuilt the branch as #806 (the test edit as its own `acceptance:` commit). The check worked. Check:
  `tools/lint/acceptance.py` (ci.yml's "Acceptance check" step, `.github/workflows/ci.yml:117-121`).
- **Cloud builders were still BLOCKED by web load after FX3 merged** (D1, B2, D6 from 16:40Z on), and each was verified
  locally. FX3 re-runs a timed-out file alone, but the cloud verify still timed out. No check yet: #823 (a verify record naming the step and file that timed out in the cloud).
- **`web` eslint/config.test.ts timed out on CI all session** (FX1's land refused once). No check yet:
  #824 (raise the timeouts with the reason, or list them as flakes with the reason).
- **The watcher's misses (#761) are closed:** BLOCKED without a reason, carried-over launches and `Factory-Status:`
  replies now write events, and a status-only commit keeps a READY head READY. Check:
  `scripts/factory/tests/acceptance/ts26fx1/` (#786). The factory mod's wake replaced the Monitors at 20:43Z. Check:
  `tools/mod/vextrus-factory/tests/` and `scripts/factory/tests/test_wake_kinds.py` (#794).
- **The integration land (Q-R10) found what the separate PRs did not.** The first no-post gained a conflict (E1 not
  acceptable). Round 1 of #811 BLOCKED on three tickets: E1 read a sheet-reference range as a member range, B2 had a
  re-read status and a storeys cap below the engine's, and D5 dropped a numberless back-in. Each had passed review on
  its own PR. No check: the owner's Q-R10
  (one integration review and one no-post run before posting) is the rule; no test replaces a real-drawing run.
- **The lander merged a head whose CI ran before another PR changed main, and main went red** (D4 #771 on a head from
  before D7 #805: each passed alone; together Jump to read D7's test seed of Step 1's cache and three shell.test tests
  failed). Every PR that merged main then inherited the red (F1 #748 and M1-24 #798 refused at land) until the hotfix
  #817 (the seed in the API's real shapes, typed from the OpenAPI types). No check yet: #825 (the lander refuses a head
  that does not contain main's tip when main changed paths its tests read since the head's CI ran).
- **The factory mod's wake replaced the 30-minute Monitor re-arms** from 20:43Z, but its table kept listing tickets after
  their PRs merged. No check yet: #826.

## Session 27 (14 Oct 2026): factory and engine tickets merged, gates failed on heads review had passed, no G1 walk fit the budget

- **A writer's first acceptance commit carried real drawing titles** (S27-G3: 28 leak-scan hits; the branch was abandoned
  before any push). The writer did not scan its own range. No check yet: #847 (the
  acceptance-writer contract and the READY report require a leakscan of the range). The pre-push scan stays the backstop.
- **New acceptance tests passed the lint and failed CI.** Three engine tests needed the sandbox that CI does not have
  (SandboxUnavailable), so the integration PR went red. No check yet: #848
  (acceptance_lint runs new tests as CI does, or requires the marker).
- **Design gates failed an item on 5 of 12 walks, each on a head review had passed.** #837 (a note 0 px wide), #842 twice
  (focus lost, then focus kept with no ring) and #843 twice (the bar ahead of the list). The acceptance tests were green
  because they asked whether the thing was reachable in the DOM, not whether it was seen or in the same commit as the list.
  Check: `web/src/ui/focus-inset.node.test.ts` (no `outline-none` beside `focus-inset`); each other fix round owes its own test, named in the gate verdicts (a visible-width floor for the note; a lint for
  `outline-none` beside `focus-inset`; one source of truth for the bar and the list's counts). Verify each landed in
  #837, #842 and #843 at merge. The rule stands: a gate walks every UI head after every fix.
- **A fix inverts a disagreement and closes only the path the test pinned** (#843: the first fix made the bar and list agree
  on five answer kinds, and the held-file answer disagreed the other way). The acceptance test pinned only the answers that
  move no sheet; the writer added the reply-delta contract after the first draft. No check yet: #860
  (a test per answer kind; the held-file case first).
- **The lander merged a head that did not contain main's tip** (session 26: D4 #771 on a head from before D7 #805). Fixed:
  the lander and `merge_ready` refuse such a head, and ADR 0041 is amended on the owner's ruling "Yes, always". Check: `scripts/tests/acceptance/ts27l825/`;
  the acceptance tests of #845 (`s27-l825`) and the ADR 0041 amendment. Closes #825.
- **A branch name or path that spells a multiword corpus string with hyphens printed in clear.** `sweep-remote` found 96
  old-product `inc/*` branches with hits and printed branch names; review rounds 1 and 2 each found one more spelling
  (hyphen, underscore, path). Check: `tools/leakscan/` tests (#841, folded form on both sides, `ref:<i>` for a name-hit).
  The pre-push ref test has the same hole: No check yet: #854.
- **A builder's follow-up list went under `## Cut`** (G6 and M1-00, twice in one day), and the orchestrator added a heading
  commit by hand each time. No check yet: #849 (publish names the fix, or builder.md).
- **A timing bound of 500 ms flaked under CI load twice in a day** (ts15a2 [answer] 0.587 s blocked #841's land; G6's cloud
  verify blocked on load twice and was verified locally). Same class as #823 and #824. No check yet:
  #851 and #852.
- **Two cloud builders were refused by the CLOUD_PUSH guard and the cause is unknown** (W835 and SWEEP; each pushed after the orchestrator sent
  recovery steps). No check yet: #850.
- **The orchestrator carried a design-gate verdict to a head the gate never walked** (#842 after `land update`); the
  classifier refused the land, and a real walk of that head then passed. The owner's ruling (14 Oct): "Re-walk every new
  head". The order is now: update with main, gate that head, land it. No check yet: the lander could refuse a
  design-gate status older than the head's last main merge (owed with #849's factory batch).

## Session 28 (14 Oct 2026): the three first tasks and the G1 fix wave merged; G1 walk #1 failed under the new bar
- **An integration PR whose fix rounds were merged in as branches cannot take a delta review.** #844's round 3 was refused
  ("another branch's work"), and `fix-regression` did not hold (the finding predated fix round 1). The remedy was a clean line
  (round 2's head plus each fix round cherry-picked as commits, the same verified tree) as a new PR, #870, which cost a
  full round 1. Rule: an integration branch takes each fix round as commits on its own line, never as a merge of the
  ticket branch. No check yet: owed (review.py's refusal should name the remedy; builder.md and the runbook say so).
- **An integration PR with a `web/**` file had no design gate planned.** #844 never had one; #870's land was refused for
  it, and the gate then failed item 1 (an open report not refreshed after a Plot re-match). Plan a gate for every PR that
  touches `web/**`, integration PRs included. Check: `scripts/merge_ready.py` refuses the land (it did).
- **A posting real-drawing run needs a review PASS on its head first, and `--ticket` needs a launch record.** Two refused
  posting runs cost minutes. Check: `scripts/factory/rdlock.py` refuses both (it did); the runbook should order review, then posting.
- **G1's hold (90 min) ended before the agent layer did.** walk.json came 46 min after the start and the agent layer ran
  96 min (critics, roles, triage), so the stack stopped while the role walker still worked. No check yet: owed (run.py's
  hold should end on verdict.json alone, or the default hold should outlast the agent layer's measured p90).
- **The act-time check failed on a tail, not a regression.** Undo's median was unchanged (654 against 656 ms) and its
  query count equal (126 on a 3-sheet project) between sessions 26 and 28, but the worst undo moved from 982 to 1,370 ms
  and p95 over 13 samples is the one or two worst. The walk logs no server time per act, so request time and queueing
  (reads, the cad worker, more `/drawings/files` polls) cannot be told apart. No check yet: owed (server-side duration
  and lock wait per act in the walk's record).
- **Under the new bar (S28-W1) walk #1's misleading findings fell from 8 to 1** (one BLOCKS with its reproduction, 13
  OTHER filed). Check: `scripts/tests/acceptance/ts28w1/` and the walk verdicts.
- **A docs-only PR can break a pinned docs test that CI does not run on it.** The close PR reworded CLAUDE.md's bar line
  and dropped "user-facing", which `scripts/tests/acceptance/ts25f2/test_bar_docs_agree.py` pins; `ci.yml`'s changes step
  runs no Python on docs-only heads, so only main's push run would have failed. Review round 1 caught it. No check yet:
  owed (the changes step runs the docs-pinning tests when CLAUDE.md, `docs/` or `.claude/` change).

## Session 29 (14-15 Oct 2026): the factory's wave 1 half landed; M0's f-1 fixed; the usage window ran out at 1 h 40
- **Eight Opus `high` acceptance writers and six builders at once used the whole session window in 100 minutes.** Every
  builder stalled about 75 minutes (STOP-FAILURE rate_limit; four BUDGET-PASSED rows that were not overruns). The governor
  held launches at 100 % but launched into 21 % of the window without a forecast. No check yet: owed (the governor's
  `cloud-session` and `local-agent` units refuse a launch whose expected spend would cross the window's floor).
- **Builders wrote notes after `## Cut` three times** (M0a-F1, F2b, F2a); publish refused each head and each needed an
  empty re-commit and a message round. No check yet: owed (#890: the verify runs merge_ready's Cut parser on the READY message).
- **Two parallel tickets editing one gate file deadlock each other's crosspr** (F3 and F7 in `scripts/factory/review.py`):
  each verify refused while the other PR was open. The remedy was to close one PR for a while and land the other first.
  Rule: tickets that share a file are launched in sequence, or one is told at launch that it lands second. No check yet:
  owed (the launch refuses a ticket whose plan names a file an open ticket's branch changes, unless `--after <ticket>`).
- **A refused round 1 followed by a recorded round 2 strands a PR's ledger** (#884): no round can be recorded again. The
  PR was closed and reopened as #896. No check yet: owed (#897).
- **Listing walls as paths did not converge, again** (F7: every round CONFIRMED a missed gate or access file; lesson (e)
  of review_tiers.toml). Back to planning (#898). Check: none until the replan; the replan owes a tree-walking test.
- **A shell-parsing hook judged as a wall did not converge** (F2b: each round found a new spelling that slips past). The
  replan frames it as advisory (#895). Rule: a convenience check is written and reviewed as advisory, never as a wall.
- **A cloud box could not pass the slowed web pass on files the PR never touched** (M0b-F1: 4 timeouts, verify unrecordable
  for 90 minutes). A fresh local builder recorded the verify in 12 minutes. Check: #893 (F2a, held) scales web timeouts by
  `VEXTRUS_TIME_SCALE`; until it lands, a cloud builder blocked only on untouched slowed tests is finished locally.
- **A test-only change under `vextrus/` costs the real-drawing check's full run** (#893: a timing helper and an amended
  test). That is F5's case; carried to session 30.
- **The first PR of the new flow:** #882 (M0a f-1) went acceptance, build, a fresh-context fix round before review,
  review PASS, gate PASS, real-drawing check clean, merged at 124 minutes open-to-merge. Check: the ledger and the statuses.
