> Gathered by a research agent on 29 Sep 2026 from the pages cited on each line. The orchestrator
> checked only the quotes the session-06 brief relies on (effort defaults and recalibration, `model:
> sonnet`, `--model`, time signals, verification checks). Lines marked inferred, and any cost or
> benchmark figure not quoted, are the agent's, not the docs'.

# Research: Claude Opus 5.5 Prompting Best Practices for Orchestrators

**Date:** 2026-09-29  
**Research Focus:** Official Anthropic documentation on prompting Claude Opus 5.5, effort levels, agentic orchestration, subagents, and Claude Code best practices for orchestrators writing builder prompts.

---

## Core Effort Level Guidance (Stated in Docs)

1. **Start with Medium Effort on Claude Opus 5.5** — Medium is the default on Claude Opus 5.5 (different from Opus 5's high default); Claude Opus 5.5 at medium matches or beats Opus 5 at high on coding and knowledge-work evals. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#calibrate-effort ("Start at `medium`, the default on Claude Opus 5.5…set it explicitly, and test several levels against your own evals")

2. **Reserve xhigh and max for Measured Quality Gains** — Only step up to xhigh or max when you've measured a quality gain on your own evals; on several coding evaluations, low comes close to Opus 5 at high with much lower cost. Source: https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-opus-5-5 ("Reserve `xhigh` and `max` for work where you've measured a quality gain")

3. **Lower Effort to Reduce Thinking, Cost, and Latency** — To get less thinking, lower the effort level first; lowering effort reduces thinking, cost, and latency more reliably than prompt instructions do. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#calibrate-effort ("To get less thinking, lower the effort level first. Lowering effort reduces thinking, and with it cost and latency, more reliably than prompt instructions do")

4. **Set max_tokens High at Higher Effort Levels** — Set `max_tokens` to 128,000 (the model's maximum) for long agentic coding tasks; thinking counts toward max_tokens even when not returned, so a small limit can cut replies off. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#calibrate-effort ("Set `max_tokens` high enough to leave room for the model's thinking tokens and the reply… a `max_tokens` of 128,000, the model's maximum, has worked well")

5. **Effort Affects All Output Tokens** — Effort controls thinking volume and the number of tool calls made; lower effort levels tend to make fewer, terser tool calls and proceed directly to action. Source: https://platform.claude.com/docs/en/build-with-claude/effort#effort-with-tool-use ("Lower effort levels tend to: Combine multiple operations into fewer tool calls, Make fewer tool calls, Proceed directly to action without preamble")

---

## Claude Opus 5.5 Agentic Capabilities (Stated in Docs)

6. **Agentic Coding Strength at Default Medium Effort** — Claude Opus 5.5 is strongest on multistep work in real repositories carrying changes through large codebases until tests pass, and at its default medium effort matched or beat Opus 5 at high effort on multistep tasks in fewer steps and with fewer tokens. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#capabilities-relevant-to-prompting ("at its default `medium` effort the model matched or beat Claude Opus 5 at `high` effort on such tasks, in fewer steps and with fewer tokens")

7. **Sustains Long-Running Autonomous Work Better** — Claude Opus 5.5 sustains long-running autonomous work better than Opus 5, such as multi-hour audits and migrations of large code bases run end to end with parallel subagents and little oversight. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#capabilities-relevant-to-prompting ("It also sustains long-running autonomous work better than Claude Opus 5")

8. **Stronger Code Review with Fewer False Alarms** — Early testers reported stronger code review, with more bugs caught than on Claude Opus 5 and fewer false alarms, and it explains its changes in plain language. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#capabilities-relevant-to-prompting ("stronger code review, with more bugs caught than on Claude Opus 5 and fewer false alarms")

9. **Reads Visual Inputs More Accurately** — Claude Opus 5.5 reads charts, diagrams, and screenshots more accurately than Opus 5 without extra tooling, and even at its lowest effort setting it read values off dense charts more accurately than Opus 5 did at its highest. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#capabilities-relevant-to-prompting ("even at its lowest effort setting it read values off dense charts more accurately than Claude Opus 5 did at its highest")

10. **Generates Output Tokens 30% Faster** — Claude Opus 5.5 generates output tokens more than 30 percent faster than Opus 5 and tends to finish the same task with fewer tokens; existing Opus 5 prompts should perform well without changes. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 ("Claude Opus 5.5 generates output tokens more than 30 percent faster than Claude Opus 5")

---

## Unattended Agentic Runs & Progress Updates (Stated in Docs)

11. **Treat Text-Only Turn Endings as Status Reports, Not Task Completion** — Claude Opus 5.5 sends progress updates between tool calls; an unattended agent loop that treats a text-only end of turn as the end of the task stops running prematurely. Keep the task's parts in a checklist and send a short continuation message if items remain open. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#unattended-agentic-runs ("Treat a text-only end of turn as a report rather than as proof the task is done")

12. **Use Standing Instructions for Unattended Runs** — Add a system prompt instruction that tells the model to avoid unnecessary early stops (summarizing rather than taking the next step, offering to wait, listing decisions for the user when no blocker exists). Tell it to keep working and carry status notes in the same message as the next tool call. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#unattended-agentic-runs (paragraph on standing instructions for autonomous work)

13. **Receive Progress Updates with display: "updates"** — Between tool calls, Claude Opus 5.5 writes progress updates; these come as thinking blocks with text that's empty at the default `display: "omitted"`. Set `display: "updates"` to receive a short summary of each note. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#user-facing-progress-updates ("Set `display: "updates"` to receive a short summary of each note")

14. **Add Time Signals for Multiagent Orchestration** — For a team of agents, give the model a time budget or elapsed-time signal (e.g., `elapsed 340s / 1200s`); the model paces work to finish inside the budget. Time signals made small agent teams finish sooner without losing quality. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#time-signals-for-multiagent-harnesses ("have your harness add a short line at the end of each message it sends back to the model giving the elapsed time against that budget")

---

## Claude Code Best Practices for Orchestrators (Stated in Docs)

15. **Give Claude a Verification Check It Can Run** — Claude stops when the work looks done; without a check, "looks done" is the only signal. Give Claude a check that produces pass/fail (tests, build, linter, script comparing output to fixture, screenshot comparison). Claude does work, runs check, reads result, iterates until pass. Source: https://code.claude.com/docs/en/best-practices ("Give Claude a check it can run: tests, a build, a screenshot to compare. It's the difference between a session you watch and one you walk away from")

16. **Separate Exploration from Implementation with Plan Mode** — Letting Claude jump to coding solves the wrong problem; use plan mode to separate exploration from implementation. Have Claude explore, write a plan, then implement. This avoids false starts. Source: https://code.claude.com/docs/en/best-practices#explore-first-then-plan-then-code ("Separate research and planning from implementation to avoid solving the wrong problem")

17. **Provide Specific Context in Builder Prompts** — Reference specific files, mention constraints, point to example patterns. Vague prompts need more corrections. The more precise instructions, fewer corrections needed. Source: https://code.claude.com/docs/en/best-practices#provide-specific-context-in-your-prompts ("The more precise your instructions, the fewer corrections you'll need")

18. **Scope Investigations Narrowly or Use Subagents** — Long explorations consume the main session's context window. Use subagents to keep research in a separate context; only summaries return to the main session. When Claude researches, it reads many files that consume your context. Source: https://code.claude.com/docs/en/best-practices#manage-context-aggressively ("When Claude researches a codebase it reads lots of files, all of which consume your context. Subagents run in separate context windows and report back summaries")

19. **Delegate Research to Subagents to Keep Main Session Clean** — Use subagents for investigation and exploration to explore in a separate context, keeping your main conversation clean for implementation. Pass findings back as brief summaries. Source: https://code.claude.com/docs/en/best-practices#use-subagents-for-investigation ("Use subagents to keep research out of it… only the summary returns to your context")

20. **Clear Context Between Unrelated Tasks** — Long sessions with irrelevant context reduce performance. Run `/clear` between unrelated tasks to reset the context window entirely. After two corrections on the same issue, clear and write a better prompt. Source: https://code.claude.com/docs/en/best-practices#course-correct-early-and-often ("`/clear` between unrelated tasks… A clean session with a better prompt almost always outperforms a long session with accumulated corrections")

---

## Prompt Engineering Fundamentals (Stated in Docs)

21. **Be Clear and Direct** — Claude responds to clear, explicit instructions. Think of Claude as a brilliant but new employee who lacks context. Show your prompt to a colleague with minimal context; if they'd be confused, Claude will too. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#be-clear-and-direct ("The more precisely you explain what you want, the better the result")

22. **Add Context to Improve Performance** — Provide context or motivation behind instructions (explain why the behavior matters). Claude generalizes from explanations better than from bare rules. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#add-context-to-improve-performance ("Providing context or motivation behind your instructions…can help Claude better understand your goals")

23. **Use Examples Effectively (3-5 Well-Crafted Examples)** — Examples (few-shot prompting) steer output format, tone, and structure. Make them relevant, diverse (covering edge cases), and structured in `<example>` or `<examples>` tags. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#use-examples-effectively ("Include 3–5 examples for best results")

24. **Structure Complex Prompts with XML Tags** — XML tags help Claude parse complex prompts unambiguously, especially mixing instructions, context, examples, and inputs. Use consistent, descriptive tag names. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags ("XML tags help Claude parse complex prompts unambiguously")

25. **Remove Instructions That Told the Model to Think** — If your Opus 5 prompt asked Claude to "think carefully" or "reason through," remove those for Opus 5.5; thinking is always on and the model decides how much. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#thinking-instructions-in-chat-system-prompts ("In chat applications, if your system prompt contains instructions that tell Claude to think carefully before answering, consider removing them for Claude Opus 5.5")

26. **Treat Earlier Answers as Settled on Longer Conversations** — On multi-turn conversations with follow-ups, Claude sometimes re-examines earlier answers, adding thinking overhead on later turns. To make replies start sooner, add instructions treating earlier answers as settled unless the user asks about them. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#thinking-instructions-in-chat-system-prompts ("Once you have answered something, treat that answer as done")

---

## Subagent Orchestration (Stated in Docs)

27. **Subagents Work Best for a Few Delegated Tasks Per Turn** — Use subagents when you need quick, focused workers that report back. Subagents work well for a few delegated tasks per turn; for runs coordinating dozens to hundreds of agents, use Workflows (dynamic orchestration). Source: https://code.claude.com/docs/en/agent-teams ("subagents work well for a few delegated tasks per turn; for runs that coordinate dozens to hundreds of agents, use the Workflow tool")

28. **Subagents Run in Separate Context Windows** — Each subagent has its own context window and does not see conversation history or previously read files (unless it's a fork). Exploration in a subagent doesn't consume main context. Source: https://code.claude.com/docs/en/best-practices#use-subagents-for-investigation ("Each subagent has its own context: Doesn't see conversation history or previously read files")

29. **Name Subagents for Direct Communication** — Assign names to subagents you spawn so you can reference them for follow-up questions and additional work. This lets you communicate with each subagent independently. Source: https://code.claude.com/docs/en/agent-teams ("The lead assigns every teammate a name when it spawns them, and any teammate can message any other by that name")

30. **Use Adversarial Review Subagents Before Marking Work Done** — Before treating a task as done, have a subagent review the diff in a fresh context and report gaps independently. A reviewer sees only the diff and criteria, not the implementing context, so it evaluates on its own terms. Source: https://code.claude.com/docs/en/best-practices#add-an-adversarial-review-step ("Before treating a task as done, have a subagent review the diff in a fresh context and report gaps")

---

## Tool Use Best Practices (Stated in Docs)

31. **Parallel Tool Calls and Fewer Steps at Lower Effort** — Effort affects how many tool calls the model makes; lower effort tends to combine operations into fewer tool calls and proceed more directly to action. Effort works whether thinking is on or off. Source: https://platform.claude.com/docs/en/build-with-claude/effort#effort-with-tool-use ("Lower effort levels tend to: Combine multiple operations into fewer tool calls, Make fewer tool calls")

32. **Tool Use Scales with Effort and Task Complexity** — On higher effort levels, Claude may make more tool calls and explain plans before acting; on lower levels it proceeds directly. Source: https://platform.claude.com/docs/en/build-with-claude/effort#effort-with-tool-use ("Higher effort levels may: Make more tool calls, Explain the plan before taking action, Provide detailed summaries of changes")

---

## Multi-App Workflow Context (Stated in Docs)

33. **Explore Broadly in Multi-App Workflows Before Acting** — In workflow automation across several connected apps (email, docs, spreadsheets, CRM), tell Claude to explore broadly with tool calls: list and open records across apps that could be relevant, including ones the task doesn't explicitly mention. This improves task completion on loosely specified multi-app tasks. Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#explore-context-in-multi-app-workflows ("Before taking any action, explore broadly with tool calls: list and open the emails, documents, spreadsheet tabs and records across the available apps")

---

## Inferred Practices (Not Explicitly Stated But Supported by Docs)

34. **Use Moderate Effort for Well-Specified Agentic Tasks** — For agentic coding with well-specified tasks, start with medium; move to high for harder or longer ones. Lower effort reduces cost and latency reliably. *Inference:* From Opus 5.5 best practices showing medium matches Opus 5 high on evals and token usage data.

35. **Set Explicit Effort Per Task Rather Than Once at Session Start** — Per-message effort (beta) preserves prompt cache on Claude Fable 5.1, Claude Opus 5.5, Claude Opus 5, and Claude Sonnet 5.5; changing top-level effort between requests invalidates cache. For flexibility within cached sessions, use per-message effort. *Inference:* From https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta

36. **Choreograph Builder Launches with Time Signals** — An orchestrator coordinating builder sessions should use time signals (elapsed/budget) to help builders self-regulate on long-running tasks. Builders pace work better knowing budget constraints. *Inference:* From Opus 5.5 guidance on time signals for multiagent harnesses.

37. **Write Orchestrator System Prompts to Avoid Reporting Stops** — Orchestrators should include standing instructions to avoid ending turns with summaries that close by announcing the next step when work remains, since that stops the automation. Include next steps in the same message as tool calls. *Inference:* From guidance on unattended agentic runs and standing instructions.

---

## Data Sources & Confidence

| Practice | Source URL | Confidence |
|----------|-----------|-----------|
| 1–10, 14 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 | High — Direct verbatim from Opus 5.5 guide |
| 2–5, 31–32 | https://platform.claude.com/docs/en/build-with-claude/effort | High — Official effort levels reference |
| 11–13 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#unattended-agentic-runs | High — Direct Opus 5.5 guide section |
| 15–20 | https://code.claude.com/docs/en/best-practices | High — Official Claude Code best practices |
| 21–26 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | High — Official prompting best practices |
| 27–30 | https://code.claude.com/docs/en/agent-teams and https://code.claude.com/docs/en/best-practices | High — Official subagent and team coordination docs |
| 33 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#explore-context-in-multi-app-workflows | High — Opus 5.5 specific guidance |
| 34–37 | Inferred from multiple sources listed above | Medium — Synthesized from stated practices |

---

## Top 10 Most Actionable Practices for Orchestrators Writing Builder Prompts

1. **Start builder prompts with medium effort on Opus 5.5; measure before going higher.** Medium is the default and matches Opus 5 at high on coding evals. Save xhigh/max for measured quality gains only. (Practice #2)

2. **Give every builder task a concrete verification check (tests, build, script, screenshot).** Without it, "looks done" is the only signal and you become the reviewer loop. Verification lets unattended builders iterate independently. (Practice #15)

3. **Set max_tokens to 128,000 on medium+ effort builder tasks.** Thinking counts toward the limit even when hidden; undersized limits cut off long agentic runs mid-work. (Practice #4)

4. **Separate exploration from implementation: have builders plan in read-only mode first, then implement.** Planning in plan mode avoids false starts and wasted exploration. (Practice #16)

5. **Use time signals (elapsed/budget in seconds) when orchestrating multiple builders.** Pass `elapsed 340s / 1200s` at the end of each builder message. Builders pace work better knowing time constraints, often finishing well inside budget. (Practice #14)

6. **Delegate research and exploration to subagents; keep main builder context clean.** Builder context fills fast. Subagents explore in separate windows; only summaries return. This keeps builders focused on implementation. (Practice #19)

7. **Point builders to specific files and patterns, not generic instructions.** Name files, cite examples, reference patterns in your codebase. "Look at how X is done in file Y and follow that pattern" beats "write clean code." (Practice #17)

8. **Avoid "think carefully" and "reason through" instructions; thinking is always on.** Opus 5.5's adaptive thinking decides depth. Such instructions are overhead without benefit. Remove them from Opus 5 prompts you copy. (Practice #25)

9. **Write standing instructions for unattended builders to prevent early stops.** Tell them: keep working and carry status notes in the same message as tool calls; don't offer to wait or summarize and stop. Prevents premature turn endings. (Practice #12)

10. **Clear context between unrelated builder tasks.** After two failed corrections on one issue, clear session and write a better prompt rather than accumulating context. Clean sessions with better prompts outperform long noisy ones. (Practice #20)

---

## Practices Not Found in Official Docs

- **LoRA or prompt caching strategies specific to orchestrator scenarios** — Not covered in the docs reviewed.
- **Model selection rules for builders vs. orchestrators** — Docs cover model selection per subagent but not orchestrator-specific guidance.
- **Exact token budgets for builder prompts per effort level** — Docs give general guidance but not hard numbers for Opus 5.5.
- **Orchestrator failure recovery patterns** — Docs don't address what an orchestrator should do when a builder session crashes.

