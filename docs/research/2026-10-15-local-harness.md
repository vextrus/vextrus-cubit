# A local harness that works like Managed Agents: the evidence

15 Oct 2026. Question: how do we get, on the owner's own machine and Max subscription, the working
style that made one Claude Managed Agents session productive (`2026-10-15-cma-session-lessons.md`),
without rebuilding the factory? This file collects what the official docs and Anthropic's engineering
posts say, with sources, and ends with the design they support (`studio/`, `docs/handoff/studio-01-prompt.md`).

**Not read.** The owner's four claude.dev posts (building-effective-agent-automations,
claude-code-in-the-cloud, getting-started-with-claude-code-mods, spending-your-effort) did not resolve
from the cloud session (`getaddrinfo ENOTFOUND claude.dev`), and none was found elsewhere. Session 31
reads them first, on the owner's machine.

## 1. Claude Code has every piece, except the grader
Sources: code.claude.com/docs/en/ sub-agents, workflows, agent-view, headless, goal, hooks-guide,
advisor, model-config, best-practices (read 15 Oct).

| Managed Agents piece | Claude Code piece |
|---|---|
| A long-lived coordinator on Opus 5.5 at high effort | The main session: `claude --model opus --effort high` |
| Specialists, each with its own model, effort, prompt and tools | `.claude/agents/<name>.md`, with frontmatter `model`, `effort`, `tools`, `mcpServers` (inline, so each agent can have its own browser), `isolation: worktree`, `background`, `maxTurns` |
| Parallel fan-out, and work too big for one context | Several agents per turn (20 at once by default); dynamic workflows, i.e. JavaScript scripts with `agent()`, `parallel()`, `pipeline()` and `phase()`, up to 16 agents at once and 1,000 per run, saved in `.claude/workflows/` and run as `/<name>` |
| The grader and the revise loop | **No built-in equivalent.** The options: `/goal <condition>`, checked by a small model that can't run tools, so it judges only the transcript; a Stop hook of type `agent` (experimental, 60 s timeout); a grader subagent the lead must call; or a workflow `while` loop around a grader `agent()` with a schema for its verdict. The last is the strongest, because the control flow is code. |
| An advisor | `/advisor <model>`, or `"advisorModel"` in settings. Opus 5.5 can take a Fable 5.1 or Opus 5.5 advisor. A Fable advisor bills to usage credits where Fable does. |
| Long unattended runs | `claude --bg`, `claude agents`, `claude attach`; `claude -p` with `--output-format stream-json`; auto permission mode. |

Limits that matter:
- **Subagents cannot launch workflows.** The `Workflow` tool is removed from them, so only the main
  session orchestrates workflows.
- **Usage limits.** A workflow run "can use meaningfully more tokens than working through the same task
  in conversation", and on a subscription it draws on the session and weekly limits. An interactive run
  pauses at a usage limit and resumes after the reset; `-p` and background runs fail instead.
- **The browser.** `claude --chrome` is not supported in WSL, so we use the repo's own chrome-devtools
  MCP wrapper (`.claude/mcp/browser.mjs`). Declared inline per agent, each judge gets its own browser.

## 2. The Agent SDK on a Max subscription: use Claude Code itself instead
The Agent SDK docs (agent-sdk/overview, quickstart) say: "Unless previously approved, Anthropic does not
allow third party developers to offer claude.ai login or rate limits for their products, including agents
built on the Claude Agent SDK. Use the API key authentication methods". The legal page says advertised
Max limits "assume ordinary, individual usage of Claude Code and the Agent SDK", and that nothing
prevents "an end user from signing in to the unmodified Claude Code binary with their own Claude
subscription". The billing article (support.claude.com/en/articles/15036540) was read only through a
summariser, and two of those summaries conflicted.

**Conclusion:** drive the unmodified `claude` binary (interactive, `-p`, `--bg`). It needs no SDK code
and is plainly within the subscription's intended use. The SDK adds nothing we need.

## 3. What makes long agent work reach quality
Anthropic engineering posts:
- [Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps), 24 Mar 2026
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 26 Nov 2025
- [Demystifying evals](https://anthropic.com/engineering/demystifying-evals-for-ai-agents), 9 Jan 2026
- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Scaling Managed Agents](https://anthropic.com/engineering/managed-agents)
- [Redesigning source control](https://www.anthropic.com/engineering/redesigning-source-control), 13 Oct 2026

Platform docs: [Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes);
[prompting Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
and Fable 5.1; Claude Code [best practices](https://code.claude.com/docs/en/best-practices).

1. **Planner, builder, evaluator; the evaluator drives the live app.** "Agents tend to praise their own
   work." Their evaluator "identified real bugs, then talked itself into approving", so read its
   transcripts and tune its prompt. In their example, a solo run cost $9 and its core feature didn't
   work; the full harness cost $200 and the result was playable. (Harness design)
2. **The grader runs in a separate context**, "to avoid being influenced by the main agent's
   implementation choices". Criteria are explicit and graded one by one: "vague criteria produce noisy
   evaluations". Derive the rubric from a known-good artifact. (Define outcomes)
3. **Mix graders:** code for what code can measure, a model per rubric dimension with an "Unknown"
   option, and a human for the final call. Move fixed defects into a regression suite. (Demystifying evals)
4. **A feature or defect list in JSON whose agents may change only its status field, a progress file, git
   commits, one item at a time.** Each session starts by reading the progress file and the git log,
   then runs a smoke test. (Effective harnesses)
5. **Give a check Claude can run**, "a screenshot to compare. It's the difference between a session you
   watch and one you walk away from." Ask for evidence, not assertions. A fresh-context reviewer should
   flag only gaps that affect correctness, or it drives over-engineering. After two failed corrections,
   restart with a better prompt. (Best practices)
6. **Effort.** Opus 5.5 defaults to `medium` and "medium matches or exceeds Claude Opus 5 at high" on
   coding. Set effort explicitly, and use `xhigh`/`max` only where a measurement shows a gain. Treat a
   text-only end of turn as a report, not as done: keep a checklist, re-prompt with the open items, and
   stop after 2-3 automatic continuations. A visible time budget (`elapsed 340s / 1200s`) makes teams
   finish sooner at similar quality. (Prompting Opus 5.5; the latency cookbook, 18 Sep 2026)
7. **Visual work.** Give the agent crop, zoom and measure tools (PIL/OpenCV). Agentic CAD research
   (e.g. CADSmith, arXiv 2603.26512) pairs exact kernel measurements with an independent judge that
   looks at several calibrated views. No source covers "element inside its host's bounds" for BIM: we
   write those invariants ourselves. buildingSMART IDS checks properties, and IfcClash checks clashes.
8. **Subtraction.** "Harnesses encode assumptions that go stale as models improve." (Scaling Managed
   Agents) Anthropic's source control team dropped the global merge lock, relied on post-merge tests,
   and reviewed "intent, not every line" (Redesigning source control). Our own factory review reached
   the same verdict: "most of the fix is subtraction and parallelism, not new gates."

## 4. The design these support
- **A separate workspace, `~/vextrus-studio`:** a private, local-only git repo holding the prototype, its
  data and a small harness. The factory's hooks, gates and long CLAUDE.md never load there; the main
  repository is mounted read-only beside it (`--add-dir`).
- **The main session is the lead** (Opus 5.5, `high`). It plans, delegates, merges and keeps
  `CHECKPOINT.md`. Specialists are agent files: a grader, a model auditor, a visual judge, builders on
  Opus or Sonnet, an adversary, a scout on Haiku, and the existing QS critic.
- **Code is the first judge of geometry.** `checks/` holds invariants (supports, hosts, stacking, units,
  bounds) that fail when an Element floats or sits off its host. The visual judge then compares calibrated
  views of each storey against the drawing's own sheet. The grader reads the live files and returns a
  verdict per criterion.
- **Two saved workflows:** `/proto-audit` (every lens finds defects, adversaries try to refute each one,
  the survivors are ranked) and `/outcome` (build, grade, revise until the rubric passes or the round
  limit is reached).
- **No PRs, gates or ledgers inside the studio.** Git commits are the record. The owner's walk is the
  finish line. Results move into the public repository later, by hand and reviewed, with no drawing
  content.
