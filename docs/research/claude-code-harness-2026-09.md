# Claude Code Harness Configuration Research (September 2026)

> **Corrections, checked by the orchestrator against the pages themselves (28 Sep 2026).** Where this file
> and these differ, these hold:
> - **The effort environment variable** is `CLAUDE_CODE_EFFORT_LEVEL`, not `ANTHROPIC_EFFORT`
>   (code.claude.com/docs/en/model-config).
> - **Opus 5.5 starts at `medium`** unless a level is saved for it. The per-model shape, as Claude Code itself
>   writes it, is `"modelSettings": {"claude-opus-5-5": {"effortLevel": "xhigh"}}`. The docs' settings reference
>   and model page disagree on whether a top-level `effortLevel` covers Opus 5.5, so set the per-model key.
> - **Effort precedence:** `CLAUDE_CODE_EFFORT_LEVEL`, `--effort` or `/effort`; then the settings; then the
>   model's default.
> - **A cloud session's settings come from the repository's `.claude/settings.json`,** or the environment's
>   variables ("To change a setting for a cloud session … commit the key to that repository's
>   `.claude/settings.json`", code.claude.com/docs/en/claude-code-on-the-web). Nothing documents `--effort`
>   carrying into `--cloud`.
> - **`ultracode`** is xhigh plus automatic workflows. It lifts the concurrent-subagent limit and the large-run
>   warning; set it with `claude --effort ultracode` or `/effort ultracode`. Workflows run up to 16 agents at
>   once by default (`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`, 1–256), and 1,000 per run. A saved workflow
>   lives in `.claude/workflows/<name>.js` and runs as `/<name>`. `Workflow` in the allow rules approves launches
>   (code.claude.com/docs/en/workflows).
> - **`autoMode` and `autoContinueAtUsageLimit` are user or managed settings only;** a project file cannot set
>   them (code.claude.com/docs/en/settings-reference).

**Research Date**: 28 September 2026  
**Claude Code Version**: 2.1.x (late September 2026)  
**Sources**: Official Claude Code documentation (code.claude.com/docs)

---

## 1. Effort Levels

**Available Levels**: `low`, `medium`, `high`, `xhigh`, `max`, and `ultracode`

### Setting Effort Per Session

**CLI Flag** (`--effort`):
```bash
claude --effort high
claude --effort ultracode
```
Source: https://code.claude.com/docs/en/model-config.md

**In-Session Command** (`/effort`):
```
/effort high
/effort ultracode
```
Source: https://code.claude.com/docs/en/model-config.md

**Environment Variable** (`ANTHROPIC_EFFORT`):
```bash
export ANTHROPIC_EFFORT=high
```

**Settings File** (`~/.claude/settings.json`):
```json
{
  "effortLevel": "high",
  "modelSettings": {
    "claude-opus-5-5": {
      "effort": "xhigh"
    }
  }
}
```
Source: https://code.claude.com/docs/en/settings-reference.md

### Per-Subagent Effort

**Subagent Frontmatter** (`.claude/agents/<name>.md`):
```yaml
---
name: code-reviewer
effort: high
model: opus
---
```
Source: https://code.claude.com/docs/en/sub-agents.md

**Per-Skill Effort**: Set in skill's `SKILL.md` frontmatter (experimental).

### Xhigh and Max

- **`xhigh`**: Extended reasoning mode that uses more tokens for complex problems
- **`max`**: Maximum reasoning with full problem decomposition
- **`ultracode`**: Combines `xhigh` reasoning with automatic workflow orchestration; enables dynamic workflows by default
  - Requires Claude Code v2.1.203+
  - Changes concurrent subagent limits and approval gates
  - Can be set in `/effort` or with `claude --effort ultracode`

Source: https://code.claude.com/docs/en/workflows.md

### Opus 5.5 Defaults

- **Default effort**: `medium` (not `high` as with earlier Opus versions)
- Adaptive thinking per step based on effort level set
- Test different levels against your work before adopting broadly

Source: https://code.claude.com/docs/en/model-config.md

---

## 2. Models

### Pin Orchestrator Model

**CLI Flag**:
```bash
claude --model opus
claude --model sonnet
claude --model fable
```

**In-Session Command**:
```
/model opus
/model opus[1m]  # With 1M context window
```

**Settings File** (`~/.claude/settings.json`):
```json
{
  "model": "claude-opus-5-5",
  "availableModels": ["claude-opus-5-5", "claude-3-5-sonnet"],
  "enforceAvailableModels": true
}
```

Source: https://code.claude.com/docs/en/model-config.md

### Pin Subagent Models

**In Subagent Frontmatter**:
```yaml
---
name: code-reviewer
model: sonnet
---
```

**Full Model ID**: Use canonical names like `claude-opus-5-5`, `claude-3-5-sonnet-20241022`

Source: https://code.claude.com/docs/en/sub-agents.md

### Available Model Aliases

| Alias | Model | Use Case |
|-------|-------|----------|
| `best` | Fable where available, else Opus | Most capable |
| `fable` | Claude Fable 5.1 | Complex reasoning |
| `opus` | Claude Opus 5.5 | Strong reasoning, long context |
| `sonnet` | Claude Sonnet 5 | Daily tasks, balanced |
| `haiku` | Claude Haiku 4.5 | Fast, simple tasks |
| `opusplan` | Opus→Sonnet | Planning then execution |
| `sonnet[1m]` | Sonnet 5 + 1M tokens | Large file analysis |
| `opus[1m]` | Opus 5.5 + 1M tokens | Deep analysis |

Source: https://code.claude.com/docs/en/model-config.md

### Fast Mode

**What it is**: Lowers latency by trading reasoning depth; uses a smaller model or reduced capability variant.

**Set Fast Mode**:
```bash
claude --fast
```

**In-Session**:
```
/fast  # toggles
```

**Requirements**: Available on Pro, Max, and Team plans when a fast model is configured by Anthropic.

**Availability**: Requires Claude Code v2.1.271+ in cloud sessions.

Source: https://code.claude.com/docs/en/model-config.md (under fast-mode)

---

## 3. settings.json

### Key Files and Precedence

**Location Hierarchy** (lowest to highest priority):
1. Managed settings (organization-deployed)
2. `~/.claude/settings.json` (user, all projects)
3. `.claude/settings.json` (project, shared via git)
4. `.claude/settings.local.json` (project, gitignored)
5. `~/.claude.json` (global config, specific keys only)

Source: https://code.claude.com/docs/en/settings-reference.md

### Critical Settings for Agentic Builds

**Permissions**:
```json
{
  "permissions": {
    "defaultMode": "auto",
    "allow": ["Bash(git *)", "Read", "Write"],
    "ask": ["Bash(rm -rf *)"],
    "deny": ["PowerShell"],
    "additionalDirectories": ["/home/riz/reference"],
    "blockReadsOutsideWorkingDirectories": false
  }
}
```
Source: https://code.claude.com/docs/en/settings-reference.md

**Hooks**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{"type": "command", "command": "npx prettier --write $FILE"}]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [{"type": "command", "command": "echo 'Context reminder: ...'"} ]
      }
    ]
  }
}
```
Source: https://code.claude.com/docs/en/hooks-guide.md

**Environment Variables**:
```json
{
  "env": {
    "VEXTRUS_DEBUG": "1",
    "NODE_ENV": "development"
  }
}
```

**Model and Effort**:
```json
{
  "model": "claude-opus-5-5",
  "effortLevel": "high",
  "modelSettings": {
    "claude-opus-5-5": {"effort": "xhigh"},
    "claude-3-5-sonnet": {"effort": "medium"}
  }
}
```

**MCP Servers**:
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["chrome-devtools", "github"],
  "deniedMcpServers": ["dangerous-server"],
  "allowedMcpServers": ["http", "stdio"]
}
```

**Plugins and Skills**:
```json
{
  "enabledPlugins": ["plugin-name"],
  "skillOverrides": {
    "/my-skill": {"hide": false}
  },
  "disableBundledSkills": false
}
```

**Subagent Limits**:
```json
{
  "agent": "default-agent-name"
}
```
(Environment variable: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=20`)

Source: https://code.claude.com/docs/en/settings-reference.md

**Status Line**:
```json
{
  "statusLine": true,
  "showTurnDuration": true
}
```

**Cleanup and Retention**:
```json
{
  "cleanupPeriodDays": 30,
  "autoCompactWindow": 100000
}
```

**Auto Mode**:
```json
{
  "permissions": {
    "defaultMode": "auto"
  },
  "autoMode": {
    "classifyAllShell": false
  }
}
```

Source: https://code.claude.com/docs/en/settings-reference.md, https://code.claude.com/docs/en/auto-mode-config.md

**Background Agents and Worktrees**:
```json
{
  "disableAgentView": false
}
```

**Context and Memory**:
```json
{
  "autoMemoryEnabled": true,
  "autoCompactEnabled": true,
  "bashOutputMaxChars": 5000
}
```

---

## 4. Subagents (`.claude/agents/*.md`)

### Frontmatter Fields

**Complete Reference**:
```yaml
---
name: code-reviewer                          # Unique command name (required)
description: Reviews code for quality        # When to use (required)
model: sonnet                                # full ID or alias (default: inherit)
effort: high                                 # low|medium|high|xhigh|max
tools: Read, Glob, Grep                      # comma-separated; inherit if omitted
disallowedTools: Bash                        # tools to remove from inherited set
permissionMode: auto                         # default|acceptEdits|auto|dontAsk|bypassPermissions|plan
maxTurns: 20                                 # turn limit before subagent stops
skills: skill-name, another-skill            # preload skills
mcpServers: chrome-devtools, github          # enable MCP servers
memory: project                              # user|project|local (persistent memory)
background: true                             # keep in background even if foreground requested
omitClaudeMd: false                          # skip CLAUDE.md files
isolation: worktree                          # worktree isolation
color: blue                                  # red|blue|green|yellow|purple|orange|pink|cyan
initialPrompt: "Start with this..."          # auto-submit first turn
experimental:
  cacheTtl: "5m"                             # prompt cache TTL (5m or 1h)
---
```

Source: https://code.claude.com/docs/en/sub-agents.md

### Running as Background

**Default Behavior**: Subagents can run in background or foreground.

**Force Background**:
```yaml
---
name: researcher
background: true  # stays in background even if you ask for foreground
---
```

**Worktree Isolation**:
```yaml
---
name: parallel-worker
isolation: worktree  # gets own git worktree
---
```

Source: https://code.claude.com/docs/en/sub-agents.md

### Invocation Methods

```bash
# Natural language (Claude decides to delegate)
Use the code-reviewer agent to analyze my changes

# @-mention (guarantees subagent runs)
@"code-reviewer (agent)" look at this

# Session-wide (main thread takes agent's properties)
claude --agent code-reviewer

# Project default (in .claude/settings.json)
{
  "agent": "code-reviewer"
}
```

### Limits

- **Description token limit**: Combined custom subagent descriptions ≤ 15,000 tokens (warning at startup)
- **Concurrent subagent limit**: Default 20 (set `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`)
- **Nesting depth**: Default 3 layers (set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`)
- **Built-in subagents** (Explore, Plan) skip CLAUDE.md to keep fast and cheap

Source: https://code.claude.com/docs/en/sub-agents.md

---

## 5. Skills (`.claude/skills/<name>/SKILL.md`)

### Frontmatter Fields

```yaml
---
name: deploy                                 # Command name (defaults to dir name)
description: Deploy to production           # When Claude auto-invokes it
model: sonnet                                # Override model (alias or full ID)
effort: high                                 # low|medium|high|xhigh|max
allowed-tools: "Bash(git *)"                 # Pre-approve tools without prompts
disable-model-invocation: false              # true = only you invoke, no auto-load
user-invocable: true                         # false = Claude only, not you
context: fork                                # fork = run in subagent (isolated)
agent: Explore                               # Subagent type if context: fork
arguments: [environment, branch]             # Named positional arguments
---
```

Source: https://code.claude.com/docs/en/skills.md

### Content Lifecycle

- **Invocation**: Content loads as single message, stays in context across turns
- **Persistence**: Claude Code doesn't re-read file on later turns
- **Permissions**: `allowed-tools` grants clear after next message
- **Compaction**: Auto-compaction preserves 5 most recent skill invocations

### Dynamic Context Injection

```yaml
---
name: pr-review
---

## PR Context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`

Summarize this PR...
```

**Permission checks**: Injected commands checked against permission rules.

### Running Skills in Subagents

```yaml
---
name: deep-research
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly.
```

**Behavior**: Runs in background by default (`background: false` to wait), doesn't see conversation history, results return when complete.

### String Substitutions

| Variable | Meaning |
|----------|---------|
| `$ARGUMENTS` | All arguments passed to skill |
| `$0`, `$1`, ... | Indexed arguments by position |
| `$name` | Named argument (from `arguments` frontmatter) |
| `${CLAUDE_SKILL_DIR}` | Directory containing SKILL.md |
| `${CLAUDE_PROJECT_DIR}` | Project root directory |
| `${CLAUDE_SESSION_ID}` | Current session ID |

Source: https://code.claude.com/docs/en/skills.md

---

## 6. Hooks

### Hook Events (Complete List)

**Session Lifecycle**:
- `SessionStart`: Session begins or resumes
- `Setup`: `--init-only`, `--init`, or `--maintenance` in `-p` mode
- `SessionEnd`: Session terminates
- `Stop`: Claude finishes responding
- `StopFailure`: Turn ends due to API error

**User Input**:
- `UserPromptSubmit`: Before Claude processes a prompt
- `UserPromptExpansion`: Command expands before reaching Claude (can block)

**Tool Execution**:
- `PreToolUse`: Before tool call executes (can block)
- `PermissionRequest`: About to ask for permission
- `PermissionDenied`: Auto mode denies a tool call
- `PostToolUse`: After tool call succeeds
- `PostToolUseFailure`: After tool call fails
- `PostToolBatch`: After full batch of parallel tool calls

**Notifications**:
- `Notification`: Fires on permission_prompt, idle_prompt, auth_success, elicitation_*, agent_*, quota_* events

**Context and Configuration**:
- `SessionStart`/`SessionEnd`/`PreCompact`/`PostCompact`: Context events
- `ConfigChange`: Configuration file changes during session
- `CwdChanged`: Working directory changes
- `DirectoryAdded`: Directory added via `/add-dir`
- `FileChanged`: Watched file changes on disk
- `InstructionsLoaded`: CLAUDE.md or `.claude/rules/*.md` loaded
- `PreModelSwitch`/`PostModelSwitch`: Model changes

**Subagents and Agents**:
- `SubagentStart`/`SubagentStop`: Subagent spawned or finishes
- `TeammateIdle`: Agent team teammate about to go idle

**Tasks**:
- `TaskCreated`/`TaskCompleted`: Task creation/completion

**MCP and Elicitation**:
- `Elicitation`/`ElicitationResult`: MCP server requests user input

**Worktrees**:
- `WorktreeCreate`/`WorktreeRemove`: Worktree lifecycle

Source: https://code.claude.com/docs/en/hooks-guide.md (full event reference at https://code.claude.com/docs/en/hooks.md)

### Hook Input Format

**Example for `PreToolUse` (Bash)**:
```json
{
  "session_id": "abc123",
  "cwd": "/home/user/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**Hook reads JSON on stdin**, processes it, outputs decision via exit code and stdout/stderr.

### Hook Output Format

**Exit Codes**:
- **0**: No objection; normal permission flow applies (for PreToolUse)
- **2**: Block the action; write reason to stderr
- **Other**: Depends on event; JSON on stdout parsed for structured decision

**Structured JSON Output** (exit 0 + JSON):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Security risk"
  }
}
```

**For `UserPromptSubmit`** (inject context):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Current branch: main. Latest commit: abc123"
  }
}
```

Source: https://code.claude.com/docs/en/hooks-guide.md

### Hook Types

**Command** (`"type": "command"`):
```json
{
  "type": "command",
  "command": "./my-hook.sh",
  "timeout": 10,
  "if": "Bash(git *)"
}
```

**HTTP** (`"type": "http"`):
```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks",
  "headers": {"Authorization": "Bearer $TOKEN"},
  "allowedEnvVars": ["TOKEN"]
}
```

**Prompt** (`"type": "prompt"`):
```json
{
  "type": "prompt",
  "prompt": "Is this action safe? Respond with {\"ok\": true/false, \"reason\": \"...\"}"
}
```

**Agent** (`"type": "agent"`, experimental):
```json
{
  "type": "agent",
  "prompt": "Verify tests pass. $ARGUMENTS",
  "timeout": 120
}
```

Source: https://code.claude.com/docs/en/hooks-guide.md

### Matchers

**Tool Events** (PreToolUse, PostToolUse, PermissionRequest):
```json
{
  "matcher": "Bash|Edit|Write"  # Pipe-separated tool names
}
```

**Session Events** (SessionStart):
```json
{
  "matcher": "startup|resume|clear|compact|fork"
}
```

**MCP Tools**:
```json
{
  "matcher": "mcp__github__.*"  # Regex for all GitHub MCP tools
}
```

**FileChanged**:
```json
{
  "matcher": ".envrc|.env"  # Literal filenames, not regex
}
```

Source: https://code.claude.com/docs/en/hooks-guide.md

### Timeouts (Default)

- **Command/HTTP/MCP tool**: 10 minutes (30s for UserPromptSubmit/PreModelSwitch/PostModelSwitch; 10s for MessageDisplay)
- **Prompt hook**: 30 seconds
- **Agent hook**: 60 seconds
- **SessionEnd hooks**: 1.5 seconds (raised to 60s if you set longer per-hook timeout)

**Override per hook**:
```json
{
  "type": "command",
  "timeout": 60,
  "command": "./my-hook.sh"
}
```

Source: https://code.claude.com/docs/en/hooks-guide.md

---

## 7. Cloud Sessions

### Creating Cloud Sessions

**From CLI**:
```bash
claude --cloud "Fix the authentication bug in src/auth/login.ts"
```
- Creates new cloud session on claude.ai
- Clones your current directory's GitHub remote (push first if local commits)
- Shows live checklist of setup steps
- Returns session URL

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

**From Browser**: https://claude.ai/code

**From Desktop App**: Select **Cloud** instead of **Local** when starting session

**From Mobile**: **Code** tab in Claude app

### Sending Follow-ups from CLI

```bash
claude -p "your message" --cloud <session-id>
```

**Supports**:
- Bare ID: `session_01DiUkqY2...`
- URL: `https://claude.ai/code/session_01DiUkqY2...`
- Stdin: `echo "message" | claude -p --cloud <session-id>`

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

### Cloud Environments

**What it is**: Saved configuration controlling network access, environment variables, setup scripts.

**Default Environment**: Created during onboarding (Anthropic-managed, or your own setup scripts).

**Settings per Environment**:
- Network access level (Trusted, Restricted, None)
- Environment variables
- Setup scripts (cached if finishes in ~5 minutes)
- API credentials (Pro/Max only, stay outside sandbox)
- Git configuration

**Set Environment**:
```bash
claude --cloud "task" --environment production
```

Source: https://code.claude.com/docs/en/cloud-environments.md

### Moving Sessions

**From Cloud to Terminal**:
```bash
claude --teleport                          # Interactive picker
claude --teleport <session-id>              # Specific session
```

**Inside session**:
```
/teleport
```

**From session menu**: **Open in > Terminal** copies command.

**Requirements**: Clean git state, correct repository, branch pushed, same account.

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

### Listing and Monitoring

**From CLI**: Sessions appear at https://claude.ai/code (session list)

**Monitor Session**:
- Browser: session keeps running, check progress anytime
- Mobile app: **Code** tab shows running sessions
- Terminal: `/teleport` to pull and continue locally

**Background Sessions** (`claude agents`): Use agent view to dispatch and monitor multiple sessions at once.

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

### Concurrent Cloud Session Limits

- No enforced limit stated; share rate limits with all Claude usage in account
- Running multiple tasks consumes more rate limits proportionately
- No separate compute charge for cloud VM

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

### Effort and Model for Cloud Sessions

**Set at Creation**:
```bash
claude --cloud "task" --model opus --effort high
```

**Change In-Session**:
```
/model sonnet
/effort high
```

**Argument Form** (required for cloud sessions):
```
/model sonnet          # Not interactive picker
/effort xhigh
```

Source: https://code.claude.com/docs/en/claude-code-on-the-web.md

---

## 8. Workflow Tool and Multi-Agent Orchestration

### What It Is

A **dynamic workflow** is a JavaScript script that orchestrates many subagents at once. Claude writes the script; a runtime executes it in background. Use for codebase audits, 500-file migrations, cross-checked research, and tasks requiring >1 agent.

### Opting In

**Workflows are on by default** on Pro, Max, Team, Enterprise, and API access.

**Turn off** (per session or globally):
- In `/config`, toggle **Dynamic workflows**
- Set `"disableWorkflows": true` in `~/.claude/settings.json`
- Env var: `CLAUDE_CODE_DISABLE_WORKFLOWS=1`

Source: https://code.claude.com/docs/en/workflows.md

### Writing Workflows

**Method 1: Ask Claude**:
```
ultracode: audit every API endpoint under src/routes/ for missing auth checks
```

**Method 2: Use `/effort ultracode`**:
```
/effort ultracode
```
Then describe any substantive task; Claude writes workflows for it.

**Method 3: Saved workflow**:
```
/deep-research "What changed in Node.js permission model v20→v22?"
```

Source: https://code.claude.com/docs/en/workflows.md

### Workflow Script Location

**Saved Workflows**:
- Project: `.claude/workflows/<name>.js` (shared via git)
- Personal: `~/.claude/workflows/<name>.js` (all projects, private)
- Plugin: `<plugin>/workflows/<name>.js` (namespaced as `/plugin-name:workflow-name`)

**Run as Command**: `/workflow-name` or `/plugin-name:workflow-name`

Source: https://code.claude.com/docs/en/workflows.md

### Workflow Script Structure

```javascript
export const meta = {
  name: 'audit-routes',
  description: 'Audit every route handler for missing auth',
}

const found = await agent('List every .ts file under src/routes/', {
  schema: { 
    type: 'object',
    required: ['files'],
    properties: { files: { type: 'array', items: { type: 'string' } } }
  },
})

const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)

return audits.filter(Boolean)
```

**API Functions**:
- `agent(prompt, options)`: Spawn one subagent, returns result or null
- `pipeline(items, async fn)`: Spawn one agent per item, all in parallel, return array
- `parallel(tasks)`: Run set of agent calls at once
- `phase(title)`: Group following agents under phase title
- `log(message)`: Show message above phases
- `args`: Global for passed input (from `args` parameter)

Source: https://code.claude.com/docs/en/workflows.md

### The "Ultracode" Keyword

**What it triggers**:
- Automatic workflow orchestration for substantive tasks
- `xhigh` reasoning effort applied
- Claude decides when a task warrants a workflow

**Where it works**:
- In-session prompt at interactive terminal
- IDE extension panel
- Remote Control client
- Agent SDK application (if stamped as human input with `origin: {kind: "human"}`)

**Where it does NOT work**:
- `claude -p` prompt
- Webhook payload or PR comment
- Scheduled task
- Agent SDK without human origin stamp

**Dismiss**: Press `Option+W` (macOS) or `Alt+W` (Windows/Linux); backspace after keyword.

Source: https://code.claude.com/docs/en/workflows.md

### Workflow Lifecycle and Resume

**Approval**: Per-run prompt shows planned phases; approve before launch (unless ultracode on or bypassPermissions mode).

**Progress**: Run `/workflows` to list and monitor; watch agents by phase.

**Resume**: Select run in `/workflows`, press `p` to pause/resume. Replay replays agents in order; completed agents return cached results, failed agents rerun.

**When run stops**:
- **Background session**: Continues in background session
- **Exit**: Results saved under `~/.claude/projects/<session>/`; can resume with `claude --resume`

**Cost and Limits**:
- 25-agent warning threshold (or custom `workflowSizeGuideline`)
- 1.5M token projected total warning
- Up to 16 concurrent agents by default (`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`)
- Up to 4,096 items per `pipeline()` or `parallel()` call
- 1,000 agents total per run

Source: https://code.claude.com/docs/en/workflows.md

---

## 9. CLI-Only Features for Long Sessions

### Background Tasks and Monitoring

**Background Bash**:
```bash
! npm build  # Non-blocking, runs while you type
```

**Background Session** (agent view):
```bash
claude agents               # View all background sessions
/tasks                      # List running tasks in current session
```

### Compaction

**Manual Compaction**:
```
/compact
/compact keep the test output
```

**Auto-Compaction**: Triggers when context window fills (default 80% full).

**Control Compaction Window**:
```
/autocompact 500k
/autocompact auto          # Use smart default
```

Source: https://code.claude.com/docs/en/common-workflows.md

### Status Line

**Shows**:
- Model and effort level
- Current permission mode
- Session state

**Control**:
```json
{
  "statusLine": true,
  "showTurnDuration": true
}
```

### Session Resume and Continuation

**Resume Last Session**:
```bash
claude --continue
```

**Resume Specific Session**:
```bash
claude --resume                    # Interactive picker
claude --resume <session-id>
```

**In-Session Resume**:
```
/resume
```

Source: https://code.claude.com/docs/en/common-workflows.md

### Context Management Commands

**Check Context**:
```
/context
```

**Clear Session** (new conversation, keep working directory):
```
/clear
```

**Rewind** (v2.1.198+):
```
/rewind
```

**Add Directory** (expand working directory):
```
/add-dir /path/to/additional/directory
```

### Monitoring with `/tasks`

```
/tasks
```

Lists all running tasks and background sessions; shows state and elapsed time.

### Loop Command

**Recurring Prompt or Command**:
```
/loop 5m /skill-name
/loop 30s "your prompt"
```

**Persist across session restart**:
```
claude --resume --continue
```

Source: https://code.claude.com/docs/en/common-workflows.md

### Monitor Tool

**Stream Output from Background Process**:
```bash
claude agent run "long task" | monitor
```

Not a documented surface; use `/tasks` instead for background monitoring.

---

## 10. MCP Configuration

### Project `.mcp.json`

**Location**: Repository root (`.mcp.json`)

**Format**:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/chrome-devtools-server.js"]
    },
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp"
    }
  }
}
```

**Scope**: Shared with team via version control; requires approval in interactive sessions.

**Access Control** (settings.json):
```json
{
  "enabledMcpjsonServers": ["chrome-devtools", "github"],
  "disabledMcpjsonServers": ["experimental-server"]
}
```

Source: https://code.claude.com/docs/en/mcp.md

### User Config (`~/.claude.json` and `~/.claude/settings.json`)

**Local-Scoped** (current project only):
```json
{
  "projects": {
    "/path/to/project": {
      "mcpServers": {
        "stripe": {
          "type": "http",
          "url": "https://mcp.stripe.com"
        }
      }
    }
  }
}
```

**User-Scoped** (all projects):
```json
{
  "mcpServers": {
    "hubspot": {
      "type": "http",
      "url": "https://mcp.hubspot.com"
    }
  }
}
```

In `~/.claude/settings.json`:
```json
{
  "enableAllProjectMcpServers": true,
  "deniedMcpServers": ["dangerous-server"],
  "allowedMcpServers": ["http", "stdio"]
}
```

Source: https://code.claude.com/docs/en/mcp.md

### Official GitHub MCP Server

**Add**:
```bash
claude mcp add --transport http github https://api.github.com/mcp \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

**Use**:
```
Review PR #456
Create issue for the bug we found
Show open PRs assigned to me
```

**Requirements**: GitHub personal access token with repository access.

Source: https://code.claude.com/docs/en/mcp.md

### MCP Management Commands

```bash
claude mcp list                        # List all servers
claude mcp get <name>                  # Details for one server
claude mcp remove <name>               # Remove server
claude mcp login <name>                # Complete OAuth flow

# In-session
/mcp                                   # Manage servers UI
```

### Integration Patterns

**Remote HTTP** (recommended):
```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp \
  --scope project
```

**Local Stdio**:
```bash
claude mcp add --env AIRTABLE_KEY=xyz --transport stdio airtable \
  -- npx -y airtable-mcp-server
```

**Dynamic Auth** (helper script):
```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://internal.example.com/mcp",
      "headersHelper": "/opt/bin/get-auth-headers.sh"
    }
  }
}
```

**Scope Options**:
```bash
--scope local       # Project-only, private
--scope project     # Shared via git
--scope user        # All projects, private
```

Source: https://code.claude.com/docs/en/mcp.md

---

## Unverified

The following features or details could not be confirmed from official documentation:

1. **`/schedule` command availability and scheduling options** — referenced in workflows but not separately documented
2. **Exact per-provider feature availability** (Bedrock, Vertex AI, Foundry) for workflows and cloud sessions
3. **Ultrareview feature details** — mentioned in TOC but page not fetched
4. **Specific performance benchmarks for effort levels** (xhigh vs. max vs. ultracode)
5. **Organization-level workflow size guideline enforcement** — noted as Anthropic-set but mechanism unclear
6. **Exact concurrency limits for remote MCP servers** during parallel runs
7. **Agent team experimental features** (currently disabled by default) — limited documentation
8. **Projects feature** (claude.ai/code Projects) — mentioned but not fully detailed in fetched pages
9. **Artifact publishing and permissions** from Cloud Code
10. **Claude in Slack / Claude Tag integration** with Claude Code harness

---

## Summary: 25 Key Findings

1. **Effort levels**: `low`, `medium`, `high`, `xhigh`, `max` set via `/effort`, `--effort`, env var, or settings.json; `ultracode` combines `xhigh` with auto-workflow.

2. **Pin orchestrator model**: Use `claude --model opus` or `/model sonnet`, or `"model": "claude-opus-5-5"` in settings.json.

3. **Subagent model pinning**: Set `model: sonnet` in `.claude/agents/<name>.md` frontmatter.

4. **Settings hierarchy**: `.claude/settings.local.json` (highest) > `.claude/settings.json` (project) > `~/.claude/settings.json` (user) > managed settings (lowest).

5. **Permissions rule syntax**: `"allow": ["Bash(git *)", "Read"], "deny": ["PowerShell"]` in settings.json.

6. **Hooks**: 25+ events (PreToolUse, PostToolUse, SessionStart, Stop, Notification, PreCompact, etc.); matchers narrow by tool name or event type.

7. **Hook types**: command (shell), http (POST), prompt (LLM), agent (experimental); exit codes 0 (allow), 2 (deny), or JSON output for structured decisions.

8. **Subagent frontmatter**: name, description, model, effort, tools, permissionMode, isolation (worktree), background, memory (persistent), maxTurns.

9. **Subagent limits**: 20 concurrent default, 3 nesting depth, 15k token description budget combined.

10. **Skills**: Stored as `SKILL.md` with frontmatter (allowed-tools, context: fork, agent, arguments, disable-model-invocation); support `!`command`` injection and substitutions ($ARGUMENTS, $0, ${CLAUDE_PROJECT_DIR}).

11. **Workflow keyword**: Type `ultracode` in prompt to auto-write and run workflow; disabled in non-interactive mode (claude -p, webhooks, PR comments).

12. **Workflow scripts**: Plain JavaScript with `agent()`, `pipeline()`, `parallel()`, `phase()`, `log()`, and `args` global; saved to `.claude/workflows/` or `~/.claude/workflows/`.

13. **Cloud sessions**: Start with `claude --cloud "task"`, check progress on claude.ai/code, pull to terminal with `claude --teleport`, send follow-ups via `claude -p "msg" --cloud <id>`.

14. **Cloud environments**: Configure network access, env vars, setup scripts; selected per session; Anthropic-managed or self-hosted.

15. **Effort defaults**: Opus 5.5 starts at `medium` (not `high`); test levels per workload; xhigh/max use extended reasoning.

16. **Fast mode**: Reduces latency via smaller model or reduced capability; set with `claude --fast` or `/fast`; available on Pro/Max/Team.

17. **Model aliases**: opus (Opus 5.5), sonnet (Sonnet 5), haiku, fable, opusplan; [1m] suffix enables 1M context window.

18. **MCP per-project**: `.mcp.json` at repo root declares shared servers; user config in `~/.claude/settings.json` with scope (local, project, user).

19. **GitHub MCP**: Official server available; add with `claude mcp add --transport http github https://api.github.com/mcp --header "Authorization: Bearer TOKEN"`.

20. **Concurrent subagents**: Default 20 (controlled by `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); ultracode mode bypasses limit.

21. **Hook timeouts**: Command/HTTP/MCP 10min (30s for UserPromptSubmit, 10s for MessageDisplay); prompt 30s; agent 60s; SessionEnd 1.5s (raised if per-hook override).

22. **Context management**: `/compact` manual, auto-compaction at ~80%, `/autocompact 500k`, `/context` to check, `/clear` to new session.

23. **Workflow cost control**: 25-agent warning (tunable with `workflowSizeGuideline`), 1.5M token projection warning, up to 16 concurrent agents, 1000 agents per run.

24. **Subagent fork mode**: `context: fork` in skill/agent runs isolated with own tools; `agent: Explore|Plan|general-purpose` or custom agent name.

25. **Permission modes**: auto (classifier), manual, acceptEdits (auto-apply changes), plan, dontAsk, bypassPermissions; per-session or default in settings; MCP tools and auto mode can override.
