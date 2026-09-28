# Getting the best out of Claude Opus 5.5 as a long-session orchestrator

Question: what does Anthropic's current official guidance (late September 2026) say about getting the
best out of Claude Opus 5.5 (`claude-opus-5-5`) in long, agentic coding sessions, and especially as an
orchestrator that dispatches and reviews many parallel subagents and cloud sessions?

Read on 2026-09-28. Every claim carries a source key that links to its URL; the full list is at the end.
Most `platform.claude.com` pages were fetched as raw markdown (`<page>.md`), so quotes from them are
verbatim. The `anthropic.com/engineering` posts and two `code.claude.com` pages ([CCSA], [CCMC]) came
back through the fetch tool's extractor, so their quotes are very likely verbatim but were not checked
byte for byte. [SKILL] is the `claude-api` skill bundled with Claude Code 2.1.281
(`shared/model-migration.md`). Anthropic wrote it, but it is a local file, not a published page, so it
ranks below the docs. Guidance written for a sibling model (Opus 5, Fable 5) is labelled as such.

## 0. The answer in brief

- **Opus 5.5 has its own prompting page, and that page is short.** It says existing Opus 5 prompts
  "should perform well without changes", and it keeps Opus 5's patterns as the starting point [P55].
  So the Opus 5 guidance still applies unless re-tested: be brief, hold scope, add no self-check
  instructions, and cap delegation [P5][MG55].
- **Effort defaults to `medium` on Opus 5.5, and thinking cannot be turned off.** Effort is the only
  control. Anthropic reports that `medium` on Opus 5.5 "matches or exceeds Claude Opus 5 at `high`".
  `xhigh` and `max` are for "work where you've measured a quality gain" [P55][EFF].
- **The main failure Anthropic names for Opus 5.5 is stopping partway through unattended runs.** The
  model ends a turn with a progress report instead of a tool call [P55]. The fixes are a checklist the
  model updates, an automatic "items still open" nudge (at most two or three times), a system-prompt
  paragraph that names the four kinds of early stop, and never treating the task as done while a
  subagent is still running [P55].
- **The orchestration rules come from the multi-agent and Claude Code docs, not the model page.** Give
  each subagent an objective, an output format, its tools and sources, and clear boundaries [MARS]. The
  subagent sees only its prompt string [SDKSA]. Scale the agent count to the task: 1 agent, then 2–4,
  then 10 or more [MARS]. Check results by evidence and by a fresh-context reviewer, not by trust [CCBP].
- **The sources pull in different directions on verification.** Opus 5 guidance says to delete
  "double-check" and "use a subagent to verify" instructions [P5]. Claude Code's guidance says to add
  an adversarial fresh-context review before counting unattended work as done [CCBP]. The two can be
  reconciled: the worker gets no self-check instructions but does get a runnable check, and the
  orchestrator reviews independently at the end (§3.2).

## 1. Prompting practices for the Claude 5 family and Opus 5.5

**What is specific to Opus 5.5** [P55]:
- Its baseline is Opus 5: "Existing Claude Opus 5 prompts should perform well without changes". The
  migration guide adds: "Instructions tuned for Claude Opus 5's behavior may no longer be needed" [MG55].
- **Drop "think carefully" lines.** "The model decides for itself how much to think, and effort is the
  main control." In a chat product, removing such a line made replies start sooner "with no clear
  decline" in quality [P55].
- **Never ask it to write its reasoning into the reply.** Such a request "can be declined with the
  `reasoning_extraction` refusal category". Read summarized thinking blocks instead [P55].
- **It gets to work quickly.** "Claude Opus 5.5 tends to get to work quickly, and on loosely specified
  tasks it helps to tell the model to look through the relevant sources before acting." One sentence
  ("Before taking any action, explore broadly with tool calls…") raised task success in multi-app
  workflows [P55].
- **Name the specific things to avoid.** "a general instruction such as 'avoid a generic AI look'
  mostly swaps one default for another. It responds well to instructions that name specific patterns
  to avoid" [P55].
- **Mark text the user pasted in.** Wrap it in `<pasted_content id="…">` tags and add a note to the
  system prompt, so instructions inside it are not followed [P55].
- **Capabilities that matter for prompting.** It is strongest at "carrying a change through a large
  code base until its tests pass". It "sustains long-running autonomous work better than Claude Opus
  5… with parallel subagents and little oversight". Its code review catches more bugs "and fewer false
  alarms". It is "much less likely to state an incorrect figure or cite the wrong source" [P55].

**Inherited from Opus 5, which Opus 5.5 builds on** [P5]:
- **Verbosity.** Responses run longer by default, and "effort… controls how much the model thinks
  rather than how much it says", so prompt for length. The page gives a short conciseness instruction
  and a length rule for written documents [P5].
- **Scope ("do what is asked").** It "can also expand the scope of a task". The recommended wording:
  "Deliver what was asked, at the scope intended… check in only when different readings of the request
  would lead to materially different work… Finish the whole task" [P5].
- **Self-checks.** "Avoid instructing re-checks it already performs ('double-check your answer',
  're-verify before responding')" [P5].
- **Code review.** If the review prompt says "only report high-severity issues", it "may follow that
  instruction literally and report less"; "ask it to report everything and filter in a separate
  pass" [P5].
- **Full spec up front.** It "performs best when given the complete task specification up front and
  left to run" [P5].

**General rules for all current models** [PBP]:
- **Be explicit.** "If you want 'above and beyond' behavior, explicitly request it." The golden rule:
  show the prompt to a colleague with little context, and if they would be confused, Claude will be
  too.
- **Explain why.** Give the reason behind a rule. "Claude is smart enough to generalize from the
  explanation."
- **Examples.** "Include 3–5 examples" that are relevant, diverse and wrapped in `<example>` tags.
- **Ask for action, not suggestions.** "Can you suggest some changes" gets suggestions. "Change this
  function…" gets changes.
- **Drop the shouting.** Where a prompt said "CRITICAL: You MUST use this tool when...", write "Use
  this tool when..." [PBP].
- **Thoroughness.** Raise effort rather than prompting for it. In Claude Code's tests, "at a higher
  level [Claude] tested more edge cases and verified more of its work before answering. It also made
  more choices on its own" [CCMC].

## 2. Effort and thinking

- **Levels and default.** Opus 5.5 supports `low`, `medium`, `high`, `xhigh` and `max`. "`medium` is
  the default (Claude Opus 5 and earlier Opus models default to `high`)" [EFF]. Claude Code also
  starts Opus 5.5 at `medium`, and "a top-level `effortLevel` in your user settings file doesn't count
  for Opus 5.5" [CCMC].
- **Thinking is always on.** `thinking: {"type": "disabled"}` returns a 400 error "at every effort
  level", so effort is "the primary control for how much the model reasons and what a request costs"
  [EFF][WN55].
- **What each level is for** [EFF]:
  - `xhigh`: "Long-running agentic and coding tasks (over 30 minutes) with token budgets in the
    millions".
  - `max`: "the deepest possible reasoning".
  - `low`: "Simpler tasks that need the best speed and lowest costs, such as subagents".
- **When `xhigh` is worth it.** "Reserve `xhigh` and `max` for work where you've measured a quality
  gain". At a given level, Opus 5.5 "tends to think more per turn than Claude Opus 5, especially at
  `xhigh` and `max`" [P55].
- **Claude Code's per-level guidance** [CCMC]:
  - `medium` fits "day-to-day engineering work with a clear scope, such as implementing a new feature".
  - `high` is for "Work where verification matters or edge cases are likely".
  - `max` "is prone to overthinking, so test before adopting it broadly".
- **Measured on SWE-bench Pro** [COST]:
  - `medium`: 92.8% at about $0.22 per solved task.
  - `low`: 87.4% at $0.12.
  - `high`: about 2.5 points above `medium`, with `medium` costing about 70% of `high`.
  - "Long-horizon coding is where effort genuinely buys accuracy". On research and knowledge work the
    curve is "nearly flat".
- **How effort interacts with tools.** Effort "affects **all tokens**", tool calls included. "Lower
  effort also means fewer and terser tool calls". Higher effort may "Make more tool calls" and "Explain
  the plan before taking action". "In a tool-use loop, follow-up requests that only process tool results
  can still skip thinking at any level" [EFF].
- **Thinking between tool calls.** With adaptive thinking, interleaved thinking is automatic. On Opus
  5.5, the notes it writes between tool calls come back as progress-update `thinking` blocks, empty
  under the default display [THK][WN55].
- **Budgets.** Effort is soft guidance; `max_tokens` is the hard limit ("Effort is soft guidance.
  `max_tokens` is a strict limit") [THK].
  - For long agentic coding turns, "a `max_tokens` of 128,000… has worked well" [P55]. The migration
    guide says to start at 64k [MG55].
  - To get less thinking, "lower the effort level first", because it works "more reliably than prompt
    instructions do" [P55].
- **Changing effort mid-session.** A top-level change "invalidates the prompt cache". A per-message
  effort change (beta) keeps it [P55][EFF]. In Claude Code, `/effort` mid-session shows a cache
  warning [CCMC].
- **Setting effort per subagent.** Subagent definitions accept their own `effort` [SDKSA].

## 3. Orchestration

### 3.1 How to brief a subagent

- **Four parts.** "Each subagent needs an objective, an output format, guidance on the tools and
  sources to use, and clear task boundaries." Without them, subagents "misinterpreted the task or
  performed the exact same searches as other agents" [MARS].
- **It starts blind.** "The only content you pass from parent to subagent is the Agent tool's prompt
  string, so include any file paths, error messages, or decisions the subagent needs directly in that
  prompt" [SDKSA]. A subagent "doesn't see your conversation history, the skills you've already
  invoked, or the files Claude has already read" [CCSA].
- **Brief once.** "Brief the subagent precisely the first time. Avoid launching, waiting, and
  re-briefing" [SKILL, Opus 5 delegation block].
- **Give the reason.** "I'm working on [the larger task] for [who it's for]. They need [what the
  output enables]" [PF5, Fable 5].
- **A good spec.** For larger work, the best specs "name the files and interfaces involved, state
  what is out of scope, and end with an end-to-end verification step" [CCBP].
- **Tools.** Restrict them to the job (read-only reviewers get Read, Grep and Glob). "A tool you leave
  out isn't in the subagent's session at all" [SDKSA].
- **One question each.** Anthropic's research system gives each subagent "clearly divided
  responsibilities" [MARS]. The Opus 5 guidance delegates only "genuinely independent, sizeable tracks"
  [P5].

### 3.2 How to verify what comes back

- **Evidence, not assertions.** "Have Claude show evidence rather than asserting success: the test
  output, the command it ran and what it returned, or a screenshot" [CCBP].
- **A check it can run.** "Claude stops when the work looks done. Without a check it can run, 'looks
  done' is the only signal available" [CCBP]. Agents need "'ground truth' from the environment at each
  step" [BEA].
- **An independent reviewer at the end.** "A reviewer running in a fresh subagent context sees only the
  diff and the criteria you give it, not the reasoning that produced the change" [CCBP].
- **Keep the reviewer on correctness.** "A reviewer prompted to find gaps will usually report some,
  even when the work is sound… Chasing every finding leads to over-engineering". So "flag only gaps
  that affect correctness or the stated requirements" [CCBP].
- **Reconciling the sources.** For long builds, "Separate, fresh-context verifier subagents tend to
  outperform self-critique" [PF5, Fable 5]. On Opus 5, however, "use a subagent to verify" inside the
  worker's prompt causes over-verification [P5]. The consistent reading: the worker runs its own checks
  unprompted, and the orchestrator adds one independent review of the finished result.
- **Other agents can be wrong.** "Sometimes, other agents will report incorrect or misleading results
  - don't always take them at face value immediately" [SKILL, Opus 5 corrections block].
- **Judging research output.** Judge the end state, not each turn: "a single LLM call… outputting
  scores from 0.0-1.0 and a pass-fail grade" [MARS].

### 3.3 How many to run in parallel

- **Scale to the task.** "Simple fact-finding requires just 1 agent with 3-10 tool calls, direct
  comparisons might need 2-4 subagents with 10-15 calls each, and complex research might use more
  than 10 subagents" [MARS].
- **The cost.** Running "3-5 subagents in parallel" cut research time by up to 90%, but multi-agent
  systems "use about 15× more tokens than chats" [MARS].
- **Claude Code's limits.**
  - Nesting: subagents may nest "up to three layers below the main conversation".
  - Concurrency: the cap is 20 running subagents ("Concurrent subagent limit reached") [CCSA].
  - Deterministic caps: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`
    and `max_budget_usd` [SDKSA].
  - `/batch` splits a change "across 5 to 30 subagents", each in its own worktree [CCBP].
- **Keep spawn counts low.** On Opus 5, "If one subagent can complete the task, use one rather than
  several, and keep spawn counts low" [P5]. The bundled block adds "Never use more than 20 parallel
  agents unless the user explicitly requests it" [SKILL].
- **A time budget speeds up teams.** Opus 5.5 "pays close attention to information about elapsed
  time". An `elapsed 340s / 1200s` line on each message makes a team finish sooner, "whereas a budget
  mostly keeps more agents working in parallel" [P55]. This was measured on research tasks.

### 3.4 How to avoid duplicated work

- **The failure.** Vague division caused "2 others [to duplicate] work investigating current 2025
  supply chains" [MARS]. Distinct objectives and boundaries per agent are the fix [MARS].
- **Don't redo delegated work.** "If you delegate, commit to the delegation. Never redo the subagent's
  work and do not re-derive its findings once it reports back" [SKILL, Opus 5 delegation block].
- **Keep file edits apart.** Worktrees "run separate CLI sessions in isolated git checkouts so edits
  don't collide" [CCBP].
- **Opus 5's record.** It coordinates subagents "with effective writer-verifier patterns and few cases
  of agents overwriting each other's work" [P5].
- **Don't stall at the orchestrator.** "Delegate independent subtasks to subagents and keep working
  while they run". Asynchronous delegation beats "blocking until each subagent returns" [PF5, Fable 5].
  In the Agent SDK, "Subagents run in the background by default" [SDKSA].

### 3.5 How to keep the orchestrator's context lean

- **Context is the constraint.** "Since context is your fundamental constraint, use subagents to keep
  research out of it" [CCBP]. Only the subagent's final message returns to the parent [SDKSA].
- **Short summaries.** Each subagent should return "a condensed, distilled summary of its work (often
  1,000-2,000 tokens)" [CTX].
- **Write results to files.** Subagents "create outputs that persist independently" instead of passing
  everything through the lead agent [MARS]. Keep "lightweight identifiers (file paths…)" in context and
  load the content just in time [CTX].
- **Scope investigations.** "The infinite exploration… Scope investigations narrowly or use
  subagents" [CCBP].

## 4. Long sessions

- **Context degrades as it fills.** "LLM performance degrades as context fills… The context window is
  the most important resource to manage" [CCBP]. As tokens grow, "the model's ability to accurately
  recall information from that context decreases" [CTX].
- **Session hygiene in Claude Code** [CCBP]:
  - Run `/clear` between unrelated tasks.
  - Use `/compact <instructions>` to steer a compaction.
  - Put a line in CLAUDE.md such as "When compacting, always preserve the full list of modified files
    and any test commands".
  - "After two failed corrections, `/clear` and write a better initial prompt".
- **Resuming.** Use `claude --continue` or `--resume`, and name sessions with `/rename` "like branches"
  [CCBP].
- **State in files and git.** Use JSON for structured state (for example `tests.json`), free text for
  progress notes, and git as "a log of what's been done and checkpoints that can be restored" [PBP].
  "Claude's latest models are extremely effective at discovering state from the local filesystem". A
  fresh window can beat compaction if told: "Review progress.txt, tests.json, and the git logs" [PBP].
- **The long-running harness** [LRH]:
  - An initializer session sets up the environment.
  - Each later session makes "incremental progress, then leave[s] structured updates".
  - It works on "only one feature at a time".
  - Each session starts with `pwd`, the progress file and git log, then a basic end-to-end test.
- **Checklist and completion condition.** Opus 5.5 should "Keep the task's parts in a checklist the
  model updates, such as a to-do tool or a file". State the completion condition up front [P55].
- **Keep plans and notes outside the context.** A plan saved "to Memory to persist the context" [MARS].
  A `NOTES.md` or to-do list tracks progress [CTX]. For a lessons memory, store "one lesson per file…
  update an existing note rather than creating a duplicate" [PF5, Fable 5].
- **Context anxiety (Fable 5).** In very long sessions the model can suggest a new session. "Avoid
  surfacing explicit context-budget counts". If you must show them, add a reassurance [PF5]. The
  general "context will be compacted, don't stop early" prompt is written for models with context
  awareness, and those are listed as Sonnet and Haiku models [PBP].
- **For custom API harnesses (Opus 5.5).** Keep history append-only. Changes to the system prompt,
  the tool list or earlier messages invalidate earlier thinking blocks. Add the unattended-run
  paragraph "from the first request of the session". Compaction on demand (beta) keeps kept turns'
  thinking valid [P55][WN55]. Claude Code keeps this prefix intact itself [SKILL].

## 5. Code quality

- **A check that returns pass or fail** [CCBP]:
  - "Give Claude a check it can run: tests, a build, a screenshot to compare."
  - For bugs: "write a failing test that reproduces the issue, then fix it".
  - For errors: "address the root cause, don't suppress the error".
- **Test first.** "Ask Claude to create tests before starting work and keep track of them in a
  structured format" [PBP]. Or "have one Claude write tests, then another write code to pass them"
  [CCBP].
- **Against reward hacking** [PBP]:
  - "Do not hard-code values or create solutions that only work for specific test inputs… Tests are
    there to verify correctness, not to define the solution… if any of the tests are incorrect, please
    inform me rather than working around them."
  - "It is unacceptable to remove or edit tests" [PBP][LRH].
  - "don't bypass safety checks (e.g. --no-verify)" [PBP].
- **No claims without evidence.** "Before reporting progress, audit each claim against a tool result
  from this session… if tests fail, say so with the output". In testing this "nearly eliminated
  fabricated status reports" [PF5, Fable 5]. Claude Code puts it as "If you can't verify it, don't
  ship it" [CCBP].
- **Fewer invented APIs.** "Never speculate about code you have not opened… read relevant files
  BEFORE answering" [PBP]. Hand it documentation URLs rather than relying on memory [CCBP]. For names
  from fast-moving areas, "familiarity is not a reason to skip the search" [SKILL, Fable 5.1].
- **Against over-engineering.** "Don't add features, refactor code, or make 'improvements' beyond what
  was asked… Don't add error handling… for scenarios that can't happen" [PBP].
- **Report extras instead of doing them.** "find a pre-existing bug… report it as a follow-up… don't
  turn scratch checks into additional permanent test files" [SKILL, Fable 5.1].
- **Adversarial review.** Run `/code-review` or a subagent "against PLAN.md", reporting "gaps, not
  style preferences" [CCBP]. Opus 5.5's review has "more bugs caught… and fewer false alarms" [P55].

## 6. Pitfalls Anthropic names, and their countermeasures

| Pitfall | Where it is named | Countermeasure |
|---|---|---|
| **Stopping early** (turn ends in a report, an offer to wait, a list of decisions that block nothing, or a pause because "a milestone is done") | Opus 5.5 [P55] | Treat a text-only end of turn "as a report rather than as proof the task is done". Keep a checklist. Send an "open items: …" nudge, and "stop after two or three automatic continuations". Add the four-stops paragraph from the first request. Wait for running subagents or background commands [P55]. |
| **Long silences** | Opus 5.5 [P55] | Set `display: "updates"`. After about five silent tool steps, append "The user hasn't heard from you in a while…" (up to 2–3 times). This "roughly halved" long silent stretches [P55]. |
| **Too many subagents** | Opus 5 [P5]; Opus 4.6 [PBP]; research system ("spawning 50 subagents for simple queries") [MARS] | The delegation paragraph: "Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify". Plus deterministic caps on depth, concurrency and spend [P5][SDKSA]. |
| **Over-planning** | Fable 5 [PF5]; Opus 4.6 [PBP]; Claude Code [CCBP] | "When you have enough information to act, act. Do not re-derive facts… re-litigate a decision" [PF5]. "choose an approach and commit to it" [PBP]. "If you could describe the diff in one sentence, skip the plan" [CCBP]. Opus 5.5 is described the other way, as getting "to work quickly" [P55]. |
| **Too many questions or permission asks** | Opus 5.5 (stops 2–3 above) [P55]; Fable 5 [PF5] | "check in only when different readings… would lead to materially different work" [P5]. "Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input that only they can provide" [PF5]. Keep confirmation for risky actions [P55]. |
| **Scope creep and over-verification** | Opus 5 [P5] | The scope paragraph (§1). Delete verification scaffolding [P5]. Re-test both on Opus 5.5 [MG55]. |
| **Premature "done" and fabricated progress** | Fable 5 [PF5]; long-running harness [LRH] | Audit claims against tool results [PF5]. Keep a feature list with `passes: false` and do one feature at a time [LRH]. |
| **Re-litigating settled answers** (chat) | Opus 5.5 [P55] | "treat that answer as done" (not for agentic tasks, where "a later step can reveal a mistake") [P55]. |

## 7. What to put in an orchestrator's brief

1. **Open with the goal, who it is for and what counts as done.** Give the full task up front and let it
   run. State the completion condition as something a check can decide [P5][P55][PF5].
2. **Set effort explicitly.** Opus 5.5 defaults to `medium`. Use `high`/`xhigh` for long-horizon
   coding where a measured gain justifies it. Use `medium` or `low` for routine workers. Change effort
   per message, never top-level mid-session [EFF][P55][COST].
3. **Delegate only independent, sizeable tracks.** Do reads under a handful of tool calls yourself.
   Never delegate a self-check. Cap depth, concurrency and spend [P5][SDKSA][CCSA].
4. **Scale the agent count to the task:** 1, then 2–4, then about 10 or more, with divided
   responsibilities. Launch independent agents in one message so they run concurrently [MARS][SKILL].
5. **Brief each subagent completely once.** Give the objective, the output format and length (about
   1–2k tokens), the tools and sources, what is out of scope, the file paths and decisions it needs
   (it sees nothing else), and the reason for the task [MARS][SDKSA][CTX][PF5].
6. **Have subagents write large outputs to files** and return a summary plus the file paths. Keep
   only conclusions in the orchestrator [MARS][CTX][CCBP].
7. **Give every worker a runnable pass/fail check** (tests, build, screenshot diff) and require
   evidence (the command and its output) in its report, not assertions [CCBP][BEA].
8. **Require grounded claims.** Tell workers to "audit each claim against a tool result from this
   session", and to say plainly what failed or was skipped [PF5][CCBP].
9. **Review finished work with one fresh-context reviewer** that sees only the diff and the criteria
   and flags only gaps in correctness or requirements. Do not tell workers to "double-check"
   [CCBP][P5].
10. **Put anti-reward-hacking rules into coding briefs.** No hard-coding to tests, no editing or
    deleting tests, no `--no-verify`, and "inform me" if a test is wrong [PBP][LRH].
11. **Hold scope.** Deliver what was asked. Report extras as follow-ups rather than doing them. Say so
    in a sentence if the request looks mistaken, then continue [P5][SKILL].
12. **Never redo delegated work.** Don't re-derive findings. Treat a subagent report as evidence to
    check, not truth [SKILL].
13. **Don't end the turn while work is owed.** Don't stop on a summary, an offer, a non-blocking
    decision list or a milestone. Don't finish while a subagent or background command is running
    [P55].
14. **Keep state outside the context:** a checklist or progress file, structured state such as
    `tests.json`, and git commits. Say how to resume: read progress, git log, then a smoke test
    [PBP][LRH][P55].
15. **Give a time budget or elapsed-time signal** if the task's length can be estimated. Keep a hard
    timeout of your own [P55].

## 8. Unverified

- **Whether Opus 5.5 still over-delegates the way Opus 5 does.** The Opus 5.5 pages do not say. They
  only say Opus 5 patterns "remain a reasonable starting point" [P55][MG55].
- **Whether Claude Code's `claude_code` preset adds its "don't call the Agent tool unless asked" line
  for Opus 5.5.** The SDK page names only Opus 5 [SDKSA].
- **Whether Opus 5 advice to delete verification instructions holds on Opus 5.5.** No Opus 5.5
  measurement was found. [MG55] says only to "re-evaluate".
- **Over-planning guidance written for Opus 5.5.** None was found. The snippets cited are for Fable 5
  and Opus 4.6.
- **Three [SKILL] items that were not seen in the published Opus 5 page as fetched:** "Never use more
  than 20 parallel agents", "commit to the delegation", and "don't always take [other agents' reports]
  at face value".
- **`max_tokens` for long agentic turns.** [P55] says 128,000 "has worked well"; [MG55] says start at
  64k. The two were not reconciled.
- **Context awareness (the model tracking its own remaining tokens) on Opus 5.5.** [PBP] lists only
  Sonnet and Haiku models.
- **Time-budget signals.** They were measured on small research teams, not on coding. It was not
  checked whether Claude Code shows elapsed time to the model [P55].
- **Cloud sessions (Claude Code on the web) as an orchestration target.** Only [CCBP]'s listing was
  read. Their limits and how to brief them were not researched here.
- **Blog quotes** ([MARS], [CTX], [BEA], [LRH]) came through the fetch tool's extractor and were not
  checked character by character. "Writing tools for agents" and the older "Claude Code best
  practices" blog post were not fetched; the docs page [CCBP] is used instead.

## Sources

| Key | Source |
|---|---|
| [P55] | Prompting Claude Opus 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 |
| [WN55] | What's new in Claude Opus 5.5: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 |
| [MG55] | Migrating to Claude Opus 5.5: https://platform.claude.com/docs/en/models/opus-5-5/migration-guide |
| [EFF] | Effort: https://platform.claude.com/docs/en/build-with-claude/effort |
| [THK] | Thinking: https://platform.claude.com/docs/en/build-with-claude/thinking |
| [COST] | Optimizing for cost and intelligence: https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence |
| [P5] | Prompting Claude Opus 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 |
| [PBP] | Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices |
| [PF5] | Prompting Claude Fable 5 (sibling model): https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5 |
| [CCBP] | Claude Code best practices: https://code.claude.com/docs/en/best-practices |
| [CCSA] | Claude Code subagents: https://code.claude.com/docs/en/sub-agents |
| [SDKSA] | Agent SDK subagents (caps): https://code.claude.com/docs/en/agent-sdk/subagents |
| [CCMC] | Claude Code model configuration (effort): https://code.claude.com/docs/en/model-config |
| [MARS] | How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system |
| [CTX] | Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| [BEA] | Building effective agents: https://www.anthropic.com/engineering/building-effective-agents |
| [LRH] | Effective harnesses for long-running agents: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents |
| [SKILL] | `claude-api` skill bundled with Claude Code 2.1.281, `shared/model-migration.md` (sections "Migrating to Claude Opus 5 → Behavioral shifts", "Migrating to Claude Opus 5.5", "Migrating to Claude Fable 5.1 from Claude Fable 5"); local, Anthropic-authored, unpublished |

[P55]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
[WN55]: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5
[MG55]: https://platform.claude.com/docs/en/models/opus-5-5/migration-guide
[EFF]: https://platform.claude.com/docs/en/build-with-claude/effort
[THK]: https://platform.claude.com/docs/en/build-with-claude/thinking
[COST]: https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
[P5]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
[PBP]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
[PF5]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
[CCBP]: https://code.claude.com/docs/en/best-practices
[CCSA]: https://code.claude.com/docs/en/sub-agents
[SDKSA]: https://code.claude.com/docs/en/agent-sdk/subagents
[CCMC]: https://code.claude.com/docs/en/model-config
[MARS]: https://www.anthropic.com/engineering/multi-agent-research-system
[CTX]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
[BEA]: https://www.anthropic.com/engineering/building-effective-agents
[LRH]: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
