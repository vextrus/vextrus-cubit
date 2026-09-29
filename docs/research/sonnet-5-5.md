> Gathered by a research agent on 29 Sep 2026 from the pages cited on each line. The orchestrator
> checked only the quotes the session-06 brief relies on (effort defaults and recalibration, `model:
> sonnet`, `--model`, time signals, verification checks). Lines marked inferred, and any cost or
> benchmark figure not quoted, are the agent's, not the docs'.

# Claude Sonnet 5.5: Research Summary

## Official Announcement & Release

**STATED:** Claude Sonnet 5.5 released September 28, 2026. https://www.anthropic.com/claude-sonnet-5-5 "Introducing Claude Sonnet 5.5"

**STATED:** Available on Claude API, Amazon Web Services, Google Cloud, Microsoft Foundry, and Claude Platform on AWS. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Platforms: Claude API, Amazon Bedrock, Google Cloud, Microsoft Foundry, Claude Platform on AWS"

**STATED:** Retirement commitment: Not sooner than September 28, 2027. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Retirement: Not sooner than September 28, 2027"

---

## Capabilities & Performance

**STATED:** 30%+ faster than Sonnet 5 with up to 30% lower cost per task. https://www.anthropic.com/claude-sonnet-5-5 "The model generates outputs 30%+ faster than Sonnet 5 while requiring significantly fewer tokens per task, resulting in up to 30% lower costs."

**STATED:** Scores 70.6% on Terminal-Bench 4.0 (agentic coding) vs Sonnet 5's 10.3%. https://www.anthropic.com/claude-sonnet-5-5 "The model scores 70.6% on Terminal-Bench 4.0 (agentic coding), compared to Sonnet 5's 10.3%."

**STATED:** On GDPval-AA (real-world tasks across 44 occupations), scores nearly level with Opus 5.5—approximately 400 points above Sonnet 5. https://www.anthropic.com/claude-sonnet-5-5 "On GDPval-AA, testing real-world tasks across 44 occupations, Sonnet 5.5 scores nearly level with the more powerful Opus 5.5 model—approximately 400 points above Sonnet 5."

**STATED:** Context window 1M tokens (native, no variant needed), max output 128K tokens (300K on Batch API with beta header). https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Context window: 1M tokens · Max output: 128K tokens; Max output (Batch API, beta): 300K tokens"

**STATED:** Knowledge cutoff: June 2026 (reliable), training data cutoff: June 2026. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Reliable knowledge cutoff: Jun 2026, Training data cutoff: Jun 2026"

**STATED:** Supports adaptive thinking (on by default); lowest thinking setting is `between_tools` to turn off up-front thinking. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Adaptive thinking is on by default. The lowest thinking setting is `between_tools`, which turns off up-front thinking. It works at `high` effort or below."

---

## Pricing

**STATED:** Input $2 / million tokens, output $10 / million tokens. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Input: $2 / MTok, Output: $10 / MTok"

**STATED:** 5m cache write $2.50 / MTok, 1h cache write $4 / MTok, cache read $0.20 / MTok. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "5m cache write: $2.50 / MTok, 1h cache write: $4 / MTok, Cache read: $0.20 / MTok"

**STATED:** Batch API: 50% discount on input and output. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Batch API: 50% discount on input and output"

**STATED:** Same input price as Sonnet 5 ($2/MTok), not cheaper, but fewer tokens required = up to 30% lower total cost per task. https://platform.claude.com/docs/en/models/sonnet-5-5/overview (models overview table) vs WebSearch "The model is priced the same as Sonnet 5 at $2 per million input tokens, $10 per million output tokens"

---

## Model Specifications

**STATED:** Model ID `claude-sonnet-5-5` on Claude API. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Claude API: claude-sonnet-5-5"

**STATED:** Amazon Bedrock ID: `anthropic.claude-sonnet-5-5`. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Amazon Bedrock: anthropic.claude-sonnet-5-5"

**STATED:** Google Cloud ID: `claude-sonnet-5-5`. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Google Cloud: claude-sonnet-5-5"

**STATED:** Microsoft Foundry ID: `claude-sonnet-5-5`. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Microsoft Foundry: claude-sonnet-5-5"

**STATED:** Claude API alias: `sonnet` (resolves to `claude-sonnet-5-5`). https://platform.claude.com/docs/en/models/overview "Claude API alias: claude-sonnet-5-5"

**STATED:** Comparative latency: Fast (relative to current lineup). https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Comparative latency: Fast"

**STATED:** Default effort: `high` on Claude API. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Default effort: high"

---

## Effort Levels

**STATED:** Supports all five effort levels: `low`, `medium`, `high`, `xhigh`, `max`. https://platform.claude.com/docs/en/build-with-claude/effort "Claude Sonnet 5.5 supports all five effort levels"

**STATED:** Effort levels are recalibrated on Sonnet 5.5; same level does not produce the same amount of thinking as Sonnet 5. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "Its levels are recalibrated, so a level doesn't produce the same amount of thinking as the same level on Claude Sonnet 5. Run a fresh effort sweep on your evals rather than carrying over the setting you used on Claude Sonnet 5."

**STATED:** Recommended: Start with `high` unless workload is agentic or latency-sensitive. For agentic coding and multistep tool use, start with `medium` for well-specified tasks and `high` for harder ones. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "Start with `high` unless your workload is agentic or latency-sensitive. For agentic coding and multistep tool use, start with `medium` for well-specified tasks and move to `high` for harder or longer ones."

**STATED:** For chat and latency-sensitive work, start with `medium` or `low`. Use `xhigh` or `max` only where evals show quality gain. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "For chat and other latency-sensitive work, start with `medium` or `low`. Use `xhigh` or `max` only where your evals show a quality gain."

**STATED:** Supports per-message effort changes (beta, requires `mid-conversation-output-config-2026-07-01` header) to preserve prompt cache. https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta "Claude Sonnet 5.5 also supports changing effort mid-conversation with a per-message `output_config`, which preserves the prompt cache."

**STATED:** With `thinking: {"type": "between_tools"}` (lowest thinking setting), effort can't change mid-conversation; per-message effort that differs returns a 400 error. Use adaptive thinking instead at xhigh/max. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "With `between_tools`, effort can't change mid-conversation: a per-message `output_config.effort` that differs from the level in effect returns a 400 error. To vary effort per turn, use adaptive thinking."

**STATED:** Set `max_tokens` to 128,000 (model max) for agentic coding; thinking counts toward it. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "Set `max_tokens` to 128,000, the model's maximum. Thinking counts toward `max_tokens` even when the thinking content isn't returned."

---

## Breaking Changes from Sonnet 5

**STATED:** Turn off up-front thinking with `between_tools` (lowest setting, works at high effort or below). https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Turn off up-front thinking with `between_tools`"

**STATED:** Forced tool use returns an error (not supported on 5.5). https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Forced tool use returns an error"

**STATED:** Thinking blocks tied to model and conversation; earlier blocks may not be accessible. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Thinking blocks are tied to the model and the conversation"

**STATED:** Earlier `computer_20251124` tool not accepted on Claude API and Google Cloud. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "On the Claude API and Google Cloud, the earlier `computer_20251124` computer use tool is not accepted"

**STATED:** Advisor tool rejects Claude Opus 4.8, 4.7, and Sonnet 5 as advisors. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "The advisor tool rejects Claude Opus 4.8, Claude Opus 4.7, and Claude Sonnet 5 as advisors"

**STATED:** Text between tool calls comes back in `thinking` blocks; set `display` value or turn off up-front thinking to return it. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "Text between tool calls comes back in `thinking` blocks"

---

## Use Cases & Recommended Applications

**STATED (Anthropic):** Excels at well-scoped everyday tasks (fixing bugs, quick iteration), creating polished documents/slides/spreadsheets, long-horizon work with strong image understanding, fast iteration on less complex projects, high-volume workflows requiring speed. https://www.anthropic.com/claude-sonnet-5-5 "Sonnet 5.5 excels at: Well-scoped everyday tasks and bug fixing, Creating polished documents, slides, and spreadsheets, Long-horizon work with strong image understanding, Fast iteration on less complex projects, High-volume workflows requiring speed"

**STATED (Platform docs):** Described as "the best combination of speed and intelligence." https://platform.claude.com/docs/en/models/sonnet-5-5/overview "The best combination of speed and intelligence"

**INFERRED:** Suitable for agentic work and coding at medium-high effort (benchmarks show 70.6% on Terminal-Bench vs Opus's higher performance suggests reliable for bounded agentic tasks). https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 + Sonnet 5.5 Terminal-Bench score

---

## Using Sonnet 5.5 in Claude Code

**STATED:** Model alias `sonnet` resolves to latest Sonnet (5.5). https://code.claude.com/docs/en/model-config "Alias: sonnet → Latest Sonnet for daily coding tasks"

**STATED:** Set model at startup: `claude --model sonnet`. https://code.claude.com/docs/en/model-config "At startup: claude --model <alias|name>"

**STATED:** Set model in session: `/model sonnet` or `/model` for picker. https://code.claude.com/docs/en/model-config "During session: /model <alias|name> or /model for picker"

**STATED:** Configure in `~/.claude/settings.json`: `"model": "sonnet"`. https://code.claude.com/docs/en/model-config 'Settings file: Add "model": "sonnet" to ~/.claude/settings.json'

**STATED:** Environment variable: `ANTHROPIC_MODEL=sonnet`. https://code.claude.com/docs/en/model-config "Environment variable: ANTHROPIC_MODEL=<alias|name>"

**STATED:** In agent frontmatter (`.claude/agents/*.md`): `model: sonnet`. https://code.claude.com/docs/en/model-config (implied from "Agent definitions... You can define agents like a code-reviewer in .claude/agents/code-reviewer.md with settings including... model: sonnet")

**STATED:** Sonnet 5.5 always uses 1M context natively (no `[1m]` variant needed). https://code.claude.com/docs/en/model-config "Sonnet 5.5 specifics: Always uses 1M context natively on Anthropic API—no `[1m]` variant needed."

**STATED:** Default subagent model setting applies unless overridden per-agent. https://platform.claude.com/docs/en/about-claude/models/choosing-a-model (implied from "default" mention in Agent tool parameters)

**INFERRED:** Explore and small debugging tasks good fit for `--model sonnet` at medium effort (lower cost + faster iteration). https://code.claude.com/docs/en/model-config + effort docs

---

## Comparison vs Opus 5.5

**STATED:** Opus 5.5: $4 input / $20 output. Sonnet 5.5: $2 input / $10 output (exactly half). https://platform.claude.com/docs/en/models/overview "Opus 5.5: $4 / $20, Sonnet 5.5: $2 / $10"

**STATED:** Opus 5.5 default effort: medium. Sonnet 5.5 default effort: high. https://platform.claude.com/docs/en/models/overview "Opus 5.5: Default effort medium, Sonnet 5.5: Default effort high"

**STATED:** Both 1M context, both support all five effort levels, both support adaptive thinking, both support per-message effort. https://platform.claude.com/docs/en/build-with-claude/effort

**STATED:** Sonnet 5.5 has faster latency compared to Opus 5.5 ("Fast" vs "Moderate"). https://platform.claude.com/docs/en/models/overview "Sonnet latency: Fast; Opus latency: Moderate"

**INFERRED (from Anthropic guidance):** Use Opus 5.5 for ambiguous, long-running, or high-stakes work where quality > cost. Use Sonnet 5.5 for well-scoped, routine, or high-volume work where speed matters. https://www.anthropic.com/claude-sonnet-5-5 "Sonnet 5.5 typically needs far fewer tokens to do the same work" + "Use Claude Opus 5.5 for tasks that are ambiguous, long-running, or costly to get wrong"

**INFERRED (strategy from search results):** "Run Sonnet 5 by default and escalate to Opus 5 on the specific paths where judgment matters more than throughput." https://emergent.sh/learn/claude-opus-5-5-vs-claude-sonnet-5 (applies equally to 5.5 generation)

---

## What Could Not Be Found

- Specific detailed benchmarks on common coding tasks beyond Terminal-Bench 4.0 (agentic) and GDPval-AA.
- Explicit token-use comparison studies (% fewer tokens required for same task vs Sonnet 5).
- Detailed system card or safety evaluations (link referenced but content not fetched).
- Specific performance deltas on math, reasoning, writing quality vs Opus 5.5 at matched effort.
- Explicit guidance on Sonnet 5.5's suitability for the Vextrus drawing-analysis pipeline (assumed to follow general agentic coding guidance).
- Whether Sonnet 5.5's `between_tools` thinking mode is suitable for tool-heavy drawing workflows (guidance exists but not field-tested).

---

## Recommended Split: Multi-Agent Coding Workflow

### Orchestrator
- **Model:** Opus 5.5 (medium effort default)
- **Reason:** Judges requirements, breaks work into tickets, reviews PRs, merges. Needs strong judgment to avoid costly rework. Cost: ~$0.30/ticket planning. https://platform.claude.com/docs/en/about-claude/models/choosing-a-model "Use Opus 5.5 for long-running agentic coding and knowledge work"

### Builders (Feature Implementation)
- **Model:** Sonnet 5.5 at medium effort for well-specified tickets; high effort for hard bugs.
- **Reason:** 30% cheaper, runs fast, adequate for bounded tasks. Escalate Opus for ambiguous requirements. Cost: ~$0.10/build vs $0.20 on Opus. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "For agentic coding and multistep tool use, start with `medium` for well-specified tasks and move to `high` for harder or longer ones"

### Acceptance-Test Writers
- **Model:** Sonnet 5.5 at high effort
- **Reason:** Writing failing tests is a well-scoped task; high effort ensures thorough coverage. Speed matters (one test per ticket, quick iteration). https://code.claude.com/docs/en/model-config + effort guidance

### PR Reviewers (`pr-reviewer` agent)
- **Model:** Opus 5.5 at high effort (kept high per agent role spec in CLAUDE.md)
- **Reason:** Code review is high-stakes (merge decision). Needs strong judgment on correctness. https://platform.claude.com/docs/en/models/opus-5-5/overview "For long-running agentic coding"

### Exploration & Debugging (`refuter` agent)
- **Model:** Sonnet 5.5 at high effort for proofs-of-concept; Opus 5.5 xhigh for hard diagnosis.
- **Reason:** Exploration is iterative; Sonnet's speed is advantageous. Escalate Opus for hard diagnostics. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "For latency-sensitive work, start with medium or low"

### Small Debugging / Bug Diagnosis
- **Model:** Sonnet 5.5 at medium-high effort
- **Reason:** Most bugs are scoped; Sonnet at high effort handles complex traces. Move to Opus if the fix changes architecture. https://www.anthropic.com/claude-sonnet-5-5 "Excels at... bug fixing"

### Documentation Drafting
- **Model:** Sonnet 5.5 at medium effort
- **Reason:** Writing is inherently bounded; medium effort balances quality and speed. Orchestrator polishes before publishing. https://platform.claude.com/docs/en/build-with-claude/effort#recommended-effort-levels-for-claude-sonnet-5-5 "Balanced approach with moderate token savings"

### Drawing-Specific Agents (`drawing-analyst`, `real-drawings`)
- **Model:** Opus 5.5 at high effort (start) or xhigh if drawing patterns are novel.
- **Reason:** Drawing analysis involves novel patterns and high-stakes inference (model quality). Sonnet 5.5 at high is a fallback for familiar tasks. https://platform.claude.com/docs/en/models/sonnet-5-5/overview "For long-horizon work" + https://www.anthropic.com/claude-sonnet-5-5 "excels at... long-horizon work with strong image understanding"

### Expected Cost Savings
- **Stated:** Sonnet 5.5 runs 30% cheaper than Sonnet 5 per task (via fewer tokens + speed). https://www.anthropic.com/claude-sonnet-5-5 "resulting in up to 30% lower costs"
- **Inferred:** Switching builders from Opus to Sonnet cuts ~50% of builder costs (Sonnet = half Opus price + lower token use).
- **Note:** Orchestrator, reviewers, and drawing analysts kept on Opus preserve correctness; builders on Sonnet capture throughput gains.

---

## Key Decisions (ADR Candidates)

1. **Default builder model:** Sonnet 5.5 at medium effort for ADR-assigned, well-scoped tickets; Opus 5.5 on ambiguous or novel drawing tasks.
2. **Effort calibration:** Run effort sweep on drawing-reading tasks before committing; Sonnet's levels are recalibrated.
3. **Thinking strategy:** Test `between_tools` on tool-heavy drawing workflows; if adaptive thinking interferes with determinism, lock to `between_tools` at high effort.

---

Generated: 2026-09-29
Sources: https://platform.claude.com, https://www.anthropic.com, https://code.claude.com
