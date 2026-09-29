# Building faster without losing quality: where the time goes, and what to change

Question (the owner, session 05, 29 Sep 2026): what way of working builds all of M0's tickets and the later
milestones fastest, at production grade, with tokens no constraint? Why is the local, xhigh set-up slower
than the cloud one?

Read on 2026-09-29, from a cloud session that could not see `.private/` (so not STATE.md, nor the local
sessions' logs). Evidence: #45's comments (session 04's timestamps), the PR list, `git log`,
docs/plans/M0.md, docs/sdlc.md, and docs/research/opus-5-5-agentic-orchestration.md (whose sources are keyed
[P55], [EFF], [CCBP], [LRH] and so on below). Web sources new to this file are listed at the end.

## 0. The answer in brief

- **There is no secret workflow.** The model is not the bottleneck: a builder reaches its first PR in
  **17–62 minutes** (#45: 08 17, 28 21, 10 37, 07 42, 09 48, 12 54, 11 62). A PR then spends **1 to 3.5
  hours** in the loop around it: review, one message, fix, re-review, the words gate, the owner's update,
  gate post, posting run and merge (#68 opened 11:00Z, merged 14:10Z; #70 11:26Z to 13:04Z; #81 14:43Z
  to 17:15Z). Every step of that loop waits on a relay: the builder waits on the orchestrator, the
  orchestrator on a reviewer, everyone on the owner.
- **Session 05 lost its first four hours before any build ran:** the session opened after #84 merged
  (18:03Z); the local switch (#85, 20:05Z) and three rounds of contracts (#86, 21:32Z) came before the
  first wave-3 merge (22:00Z). The cloud launch failure caused part of it. The rest was preparation that
  the builders could have done inside their tickets.
- **So the gains are in the loop, not the model:** move review into the builder, run the DAG without
  wave barriers, take the owner out of every step but the merge, and stop at `high` effort unless a ticket
  has shown it needs more. And, above all, **decide what the showcase is**: M2 is the showcase in
  docs/milestones.md, and M1 and M2 are not yet planned.

## 1. Where the time goes (measured)

| Stage | Session 04 (cloud builders, CLI orchestrator) | Source |
|---|---|---|
| Launch to first PR | 17–62 min | #45 |
| Review of a first head | within the hour | #45, wave 2a's measures |
| Continuations per PR | 1–3; second continuations 2 of 4 in 2a, 3 of 3 in 2b | #45; session-05 brief |
| What caused the continuations | words failing their first gate (3 of 4 in 2a, again in 2b despite the rule); a fix bringing a new fault | #45 |
| First PR to merge | about 1.5–3.5 h | PR list |
| Wave, launch to last merge | about 3.5 h for 4 tickets (2a: 10:44Z to 14:10Z) | #45, PR list |

M0 has 32 tickets. 16 are merged (waves 0–2 and 15), with #75 and #82 on top. The 16 left sit in waves 3 to 8, and their
critical path runs through six more waves (13 → 17 and 18 → 21b → 21c → 26 → 24). At about 3.5 h a
wave, **the critical path alone is about a day of orchestration**. The `local` reading tickets (13, 17,
18) are open-ended ("stops when its n / N stops improving"), so they, not the cloud tickets, set M0's end.

Unmeasured: local builders' time to ready (in STATE.md, not readable here); the machine's memory under
five xhigh sessions, browsers and test databases on 26 GB; the owner's minutes per PR.

## 2A. What Anthropic's own large runs did (the part that matters most)

The public record of Anthropic producing code at scale is one post with numbers: Nicholas Carlini's C
compiler [CC]. **16 agents, nearly 2,000 Claude Code sessions, two weeks, about $20,000, a 100,000-line Rust
compiler** that builds Linux 6.9. What made it work, in the author's words:
- **"Most of my effort went into designing the environment around Claude: the tests, the environment, the
  feedback."** The human built the checker, not the code, and did not review diffs.
- **"It's important that the task verifier is nearly perfect, otherwise Claude will solve the wrong
  problem."** The checker was existing test suites and GCC as a reference implementation.
- **"I don't use an orchestration agent."** Each agent ran the same prompt in a loop, picked "the next most
  obvious problem", and claimed it with a lock file in git. Git was the only thing they shared.
- **Spreading agents across failures:** when all 16 hit the same kernel bug, the author compiled most files
  with GCC and a random rest with Claude's compiler, so each agent met a different bug.
- **Test output went to log files with grep-able `ERROR` lines,** and a `--fast` flag ran a deterministic
  1–10 % sample per agent, keeping noise out of the context.
- What failed: new features broke old ones until the tests caught it, and "it is easy to see tests pass and
  assume the job is done, when this is rarely the case."

The long-running harness post says the same from the other side: a feature list, all failing at first; one
feature per session; "It is unacceptable to remove or edit tests" [LRH].

**Vextrus runs the other way round.** Its checker is people and agents reading diffs: `pr-reviewer`,
`ux-critic`, the orchestrator, the owner. Each finding is fixed once and then carried forward as a prose
line in `common.md` and the lessons, which the next builder has to read and remember. So throughput is
bounded by review latency, and the same class of fault comes back (words failed their first gate in
wave 2a, and again in 2b despite the rule). **Throughput scales with how much of "correct" a machine can
decide.** That is the insight, and it is public.

### What that means here, concretely
1. **Every finding at 50 or more leaves a committed check, not a lesson.** It goes in the same fix round,
   in a shared suite every builder runs before "ready". The classes already seen:
   - **words:** a catalogue lint against m0-screens' rules (no engine terms, no exit codes, a next step in
     every refusal, a banned-phrase table such as "Add it again") plus a table of approved phrasings;
   - **tenancy:** one generated attack suite that calls every operation as another tenant, a lapsed
     member and a Library, and expects the documented refusal (the `acts.py` walking test already does
     this for declarations; extend it to behaviour);
   - **machine size:** CI and the local fast check run the suites at 4 and at 24 workers, in random order;
   - **fix regressions:** the re-check's "test red without the fix" becomes a mutation step the builder
     runs itself (revert the fix, the test must fail).
2. **Acceptance tests come before the builder.** A separate agent writes each ticket's acceptance tests from
   the plan's entry and m0-screens; the owner reads them (the owner already reads tests in full, by
   docs/sdlc.md); the builder may not edit them, and says so if one is wrong. The owner then reviews the
   checker, not the code, as Carlini did.
3. **Bring the engine's checker forward.** For drawing reading, the checker is the Answer Keys and the
   blind scorer, planned for M1 (tickets 01–04). Until they exist, reading tickets have only a regression
   diff, and they stop "when n / N stops improving", judged by people. With the scorer, reading becomes the
   compiler's shape: many agents, each on a different failing sheet, looping until the score rises, with
   the keys kept out of reach as ADR 0026 already requires.
4. **Builders claim their own next ticket.** The DAG is in GitHub Issues. A builder that finishes claims the
   next unblocked issue (an assignee or label as the lock), builds, self-reviews and says ready; the
   orchestrator only gates and pushes. The owner still merges; that is the one step Carlini's run did not
   have, and it stays.
5. **One short, stable builder prompt,** the same for every ticket: the ticket's issue number, a pointer to
   the checks, and the rules below. What a lesson taught goes into a check, so the prompt stops growing.

### The builder prompt, whole
```
You build issue #<N> of vextrus/vextrus-cubit, in your own worktree, on branch <N>-<slug>.
Done means: its acceptance tests (tests/acceptance/<N>/, written before you; never edit or delete
them; tell me if one is wrong) pass; `scripts/ready` passes (the fast check, the shared attack
suite at 4 and 24 workers, the words lint, the mutation step); and pr-reviewer, run by you on
your committed head, reports nothing at 50 or more after at most two rounds.
Read: the issue, the files it names, CLAUDE.md. Nothing else unless a check sends you there.
Budget: ready within 90 minutes; print elapsed time at each commit.
Test output goes to .private/work/<N>/logs/; read only its ERROR lines.
Commit with explicit paths; never push. When ready, say so with the reports' paths and what you
did not verify, first.
```
`scripts/ready` and the acceptance-test step are new: one script and one agent brief. They replace most of
`common.md` and the runbook's review rounds, and need the owner-approved issue docs/sdlc.md asks for.

### Where this does not transfer
- A compiler has a perfect reference (GCC). Vextrus's QS judgement, the words a QS reads and the look of a
  screen have none: `qs-critic`, the design gate and the owner's walk stay, but they judge the finished
  flow, not every diff.
- Carlini's agents pushed to one branch with no human gate. Here the owner merges; batching (2.3) keeps
  that cheap.
- Nothing here is Anthropic's internal harness: its private tooling is not public, and this file cites only
  what is.

## 2. The changes, ranked by time saved

Each is a recommendation; the owner decides. The first three change nothing about quality: they move
the same checks earlier or take waiting out.

### 2.1 Review inside the builder, before "ready" (saves one to two relay rounds per PR)
Today the builder says "ready"; the orchestrator runs `pr-reviewer` and `ux-critic`; one message goes back;
the builder fixes; the orchestrator re-checks. Each round costs the orchestrator's turn and the message
latency, and the orchestrator's context fills with every PR's detail.
- **The builder runs the same agents on its own committed head** (the project's agents are available to
  every session in the checkout): `pr-reviewer` with the ticket's trust boundary; `ux-critic` words-only
  if it touched a catalogue; `refuter` on each of its own claims in the PR body. It fixes every finding at
  50 or more, then runs `pr-reviewer` in re-check mode. Only then does it say "ready", with the reports'
  paths.
- **The orchestrator's review becomes one confirming pass** by a fresh `pr-reviewer` on the final head,
  merged with `main` and the other open PRs. A fresh-context reviewer is what the guidance asks for
  [CCBP][P5]; this keeps it, and adds one earlier.
- This meets both causes of the second continuations: the words gate and the fix-regression re-check now
  run before the first PR, not after.
- **Bound the rounds.** "A reviewer prompted to find gaps will usually report some, even when the work is
  sound … Chasing every finding leads to over-engineering"; reviewers should "flag only gaps that affect
  correctness or the stated requirements" [CCBP]. The official workflow example stops "when two rounds in a
  row make no progress" [WF]. So: fix at 50 or more, and a third round goes to the owner as a re-spec
  (docs/sdlc.md's stop rule, applied to every ticket).

### 2.2 Continuous flow instead of waves (keeps every builder busy)
A wave waits for its slowest ticket. The plan's DAG (docs/plans/M0.md, "The tickets at a glance") already
names each ticket's blockers. **Launch a ticket the moment its blockers merge**, keeping four to six
builders running (the ceiling is the owner's review, docs/sdlc.md). "Merges after" edges stay in the
prompts as they are. The widening gate then measures the whole flow, per week, not per wave.
- **Contracts go into the ticket, not a docs PR before launch.** Session 05 ran three rounds of a contracts
  document (#86) before launching. The plan already fixes the contracts ("The contracts fixed here"); a
  ticket whose contract is unclear asks one question, and the owner of the shape merges first, as now.

### 2.3 The owner only merges (removes the longest waits)
Every push, update-branch, gate post and posting run waits for the owner today. Of them, only the merge is
irreversible.
- **Pre-authorise the orchestrator to push ticket branches, update them from `main` and open PRs.** A
  branch push to a private repository is reversible; `main` stays protected and only the owner merges.
- **One owner sitting, twice a day:** the orchestrator prepares a single script listing every pending
  gate post and posting run with exact SHAs; the owner runs it once, reads the tables, and merges in DAG
  order.
- **Stop the repost cascade** (docs/plans/M0.md, "The owner's time": 20–35 posting runs, most caused by
  rebases): let a `real-drawings` status carry over an update-branch that changes no engine path (the
  status keyed to the engine paths' tree hash, not the commit). A harness change: it needs an
  owner-approved issue, and it removes reposts rather than adding machinery.

### 2.4 Effort: `high` by default, `xhigh` where it measured a gain
The repository's own research says it: "Reserve `xhigh` and `max` for work where you've measured a
quality gain", and effort "affects all tokens", tool calls included: higher effort makes more and longer
calls [P55][EFF] (docs/research/opus-5-5-agentic-orchestration.md §2). Tokens are not the constraint;
**time is**, and every xhigh turn is slower.
- **The orchestrator at `high`.** Its work is coordination and one-line decisions; its hard judgements go
  to reviewers anyway.
- **Builders at `high`,** `xhigh` for the reading tickets (13, 17, 18, 21c) and anything touching money or
  geometry. Reviewers at `high` (as CLAUDE.md already says).
- The official figures: Opus 5.5 at `medium` "matches or exceeds Claude Opus 5 at `high`" on coding;
  `xhigh` is for "long-running agentic and coding tasks (over 30 minutes)"; `high` for "work where
  verification matters or edge cases are likely" [P55][EFF][CCMC]. No official source sets effort by role
  (orchestrator, builder, reviewer): that split is this file's judgement.
- **Measure it:** run the next two comparable tickets one at each level and compare time to ready and the
  confirming review's findings. If xhigh finds fewer faults at the confirming pass, keep it there.

### 2.5 Give every session an elapsed-time budget (faster at the same effort)
The one measured speed lever in the official guidance: in a multi-agent harness, giving Opus 5.5 an
elapsed-time signal (for example `elapsed 340s / 1200s`) made small teams finish "considerably sooner"
with comparable quality. "Lowering effort reduces the work itself, whereas a budget mostly keeps more
agents working in parallel" [P55]. Put a budget in every builder's prompt ("ready within 90 minutes;
report elapsed time at each commit") and in each review agent's brief. Unmeasured on this codebase.

### 2.6 Cloud builders for `cloud` tickets again, once account B links GitHub
Session 04's cloud builders were the fastest part of the loop, each on its own machine. Session 05's
failure was a set-up fault ("account B's `claude --cloud` uploaded a local copy with no git remote"), not a
fault of cloud builders. Local builders share 24 cores and 26 GB with each other, their browsers and
their test databases.
- **Fix the link** (account B connected to GitHub with the Claude App on `vextrus/vextrus-cubit`), prove it
  on one small ticket, and run `cloud` tickets there again; keep `local` and `cloud+local` tickets local.
- This reverses the owner's 29 Sep ruling ("everything will be run in locally"), so it is the owner's call.

### 2.7 A workflow for the review fan-out, not for building
The Workflow tool runs a deterministic script of subagents in the background. It suits the review:
per head, `pr-reviewer`, `ux-critic` (words) and a `refuter` per finding at 50 or more, in parallel, ending
in the one combined fix message as a file. The orchestrator gets the message, not the transcripts. It does
not suit building: a ticket is one long session with judgement throughout.
- The tool keeps intermediate results in script variables, not in the orchestrator's context, runs up to 16
  agents at once, and takes no input mid-run: "For sign-off between stages, run each stage as its own
  workflow" [WF]. So one run per head, and the owner's steps stay outside it.
- It replaces the runbook's steps 3–5 (`orchestrate-wave`) with a script under `.claude/workflows/`; the
  prose there shrinks by as much. Under ten agents a run.
- The postmortem's cause 3 (the harness became the product) is the risk: one script, no state store, and
  it goes in only if it removes the prose it replaces.

## 3. The one question that decides the date: what is the showcase?
docs/milestones.md makes **M2 the showcase** ("This is what an MD is shown"), and M1 and M2 are not
planned yet. Faster tickets do not close that gap on their own: M0 is 32 tickets, and M1 and M2 are each
larger.

**Recommendation:** name the showcase's date and audience, then cut **a thin vertical slice** through M0,
M1 and M2 on the Sample Project and Edison: upload, sheets confirmed, the frame read (grid, columns, beams,
slabs), the 3D view, and a Priced BOQ for concrete and formwork. Everything the slice does not touch waits.
It is honest only if it is labelled as a slice, with what it does not read yet shown as allowances, as
ADR 0002 already allows. The owner decides; the plan is re-cut once, not ticket by ticket.

## 4. What a day looks like after the changes
1. Morning: the orchestrator (`high`) reads STATE.md, launches every ticket whose blockers are merged, up to
   six, each told to self-review (2.1) before "ready".
2. Builders run; each ends with its own review reports. The orchestrator runs the confirming pass as a
   workflow (2.7) the moment a builder is ready, pushes and opens the PR (2.3).
3. Owner's sitting (late morning, late afternoon): one script of gate posts and posting runs, then merges in
   DAG order. The orchestrator launches the newly unblocked tickets straight after.
4. Measures per PR (time to ready, rounds, confirming-pass findings) go to #45 as now.

## 5. What does not help
- **More agents per ticket.** Multi-agent systems use about 15× the tokens of chat and "underperform on
  work with intensive interdependencies"; most coding has "fewer truly parallelizable tasks" [MARS]. Agent
  teams: "Start with 3-5 teammates"; "three focused teammates often outperform five scattered ones" [TEAMS].
- **A bigger harness.** "Add multi-step agentic systems only when simpler solutions fall short" [BEA]; the
  postmortem's cause 3 is the same lesson, learnt here.
- **More builders than the owner can review.** A practitioner's measure: human review is the bottleneck;
  one significant change reviewed at a time [SW, from search snippets only]. Hence 2.3.
- **Ultracode for everything:** it plans a workflow for every substantive task, so each request "uses more
  tokens and takes longer" [WF].

## 6. Unverified
- The local builders' timings in session 05 (STATE.md was not readable from this session).
- Whether xhigh's findings rate beats high's on this codebase: nobody has measured it here.
- The machine's memory pressure under five builders.
- Whether account B can link GitHub for cloud sessions (the owner's settings).

## Sources
New to this file (the others are keyed in docs/research/opus-5-5-agentic-orchestration.md):
- [CC] https://www.anthropic.com/engineering/building-c-compiler (5 Feb 2026)
- [CCMC] https://code.claude.com/docs/en/model-config
- [WF] https://code.claude.com/docs/en/workflows
- [TEAMS] https://code.claude.com/docs/en/agent-teams
- [SW] https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ (blocked by the proxy; snippets only)
- Also read: https://code.claude.com/docs/en/best-practices [CCBP],
  https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 [P55],
  https://platform.claude.com/docs/en/build-with-claude/effort [EFF],
  https://www.anthropic.com/engineering/multi-agent-research-system [MARS],
  https://www.anthropic.com/engineering/building-effective-agents [BEA].
