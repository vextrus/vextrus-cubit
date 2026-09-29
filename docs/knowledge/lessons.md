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
- A `claude --cloud` session with no git remote: **paid 29 Sep 2026** by `scripts/cloud/launch.py`
  (its test: `scripts/tests/test_cloud_launch.py`), which refuses a bundled launch from the CLI's debug log.
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
  `scripts/cloud/launch.py` launches every cloud ticket and exits 2 on a bundle or a wrong revision
  (`scripts/tests/test_cloud_launch.py`). Diagnose a tool from its own debug log before theorising.
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
