# The AI-native SDLC for Vextrus: what Anthropic's playbook and Claude Code offer, and the leanest harness that uses them

Question: what do Anthropic's AI-native SDLC guidance and Claude Code's current features offer for
building Vextrus (a complex Python and web product) mostly unattended and in parallel, at production
quality? And what is the leanest harness that uses them without the harness becoming the product?

Read on 2026-09-25. Sources are listed at the end with short keys (for example [PB], [WEB]); every
claim carries one. Claude Code docs were fetched as markdown from `code.claude.com/docs/en/<page>.md`.
Local evidence (the Builder's own review, our settings, our session transcripts) was read or measured
with tools on this machine. Where a fact comes only from a secondary source, it is marked
**(secondary)**. Where something was not verified, it says so.

## 0. The answer in brief

- **The playbook is a chain of small committed files, each read by the next stage:** `intent.md` →
  `spec.md` → `plan.md` (plan mode) → code with a self-check → PR review gates → maintain [PB]. It
  names one standing rule for `CLAUDE.md`: a mistake Claude makes twice goes in, and the file stays
  under a page [PB]. It warns against approval hooks during the build, untuned review, and keeping
  one artifact in two systems [PB].
- **Claude Code already does most of what the Builder hand-built.** Plan mode, auto mode, worktrees,
  subagents, `/code-review`, ultrareview, `/verify`, cloud sessions with auto-fix, and GitHub CI
  cover planning, isolation, parallelism, adversarial review and verification [PM][WT][SA][CMD][UR][WEB].
  The Builder rebuilt these as 75,789 lines of TypeScript with 16 to 22 roles (measured; [BLD-S]
  §4; [BLD-R] §1).
- **The $250 credit is one-time, for cloud sessions only, and short-lived (secondary).** It must be
  claimed by 7 October 2026 and expires on about 4–5 November 2026 [CRD]. **So the execution phase
  must start by mid-October, or the credit lapses.** That is a planning constraint for the owner.
- **What a session costs** at Opus 5.5 list price is dominated by cache reads: turns × context size.
  Measured on our own transcripts, one long orchestrated planning day cost the equivalent of about
  $830, three-quarters of it in subagents. A focused one-ticket session should cost about $5–15
  (estimate). Spend the credit on 25–40 small, well-specified, testable tickets in parallel, not on
  orchestration, planning or research.
- **Real drawings never reach the cloud.** `.private/` is gitignored, and cloud sessions start from a
  fresh clone of what is committed [ENV]. So the work splits in two. Cloud tickets are verified by
  committed tests. Every change to reading or assembly passes a **local real-drawing check** before
  merge. A milestone is done only when the owner walks it in the running product on real drawings.
- **The lean harness:** under a page of `CLAUDE.md`, `CONTEXT.md`, ADRs, one spec and one plan per
  milestone, GitHub Issues as the only work state, one self-contained guard hook, three read-only
  review agents, about 15 of Matt's skills, and plain CI on GitHub Actions. There are no roles, no
  ledger, no conductor, no held-out tests, no locked paths and no self-improvement loop.

## 1. The playbook: stages and artifacts

The playbook argues that the bottleneck has moved from writing code to the human-speed stages around
it. Each stage ends by committing an artifact that the next stage reads [PB].

| Stage | Artifact | Who | Notes [PB] |
|---|---|---|---|
| Plan | `intent.md`: problem, outcome, users, constraints, open questions | The originator brainstorms with Claude; the product owner approves | "a proto-spec in the originator's own terms" |
| Design | `spec.md`: requirements, design, flagged concerns | Claude writes it non-interactively from the intent, constrained by the org's skills; the product owner signs off | Measure rework as `spec.md` commits after the first `plan.md` |
| Build: plan | `plan.md`: files that change, order, tests, risks | The engineer runs plan mode (read-only), interviews Claude, commits `plan.md` before implementation | "clear enough for anyone to implement"; update it if the build diverges |
| Build: memory | `CLAUDE.md` | The team | One page. "Mistakes Claude makes twice go into the file." |
| Build: policy | `.claude/skills/<name>/SKILL.md` | Policy owners | Institutional knowledge, applied when relevant |
| Build: guardrails | hooks in settings | Platform | Block unsafe actions; keep credentials out of diffs |
| Build: parallel | worktrees and subagents | One engineer orchestrates | "Start with 2–3 sessions; scale only while review keeps up." |
| Test | a one-command check, with its expected healthy output listed in `CLAUDE.md` | Claude runs it before reporting done | "An agent fixing code must not be able to weaken the check on that code." |
| Test: evals | 20–50 real tasks re-run when `CLAUDE.md`, skills or hooks change | Platform engineer | Configuration is code and regresses like code |
| Deploy | PR review findings (`REVIEW.md`), branch protection, deploy gates | Claude reviews; a human code owner approves | "Claude cannot approve its own code"; "the agent may act up to the production gate and cannot pass it." |
| Maintain | a new `intent.md` written by a monitor | A deterministic metric trigger, then Claude diagnoses | Tie triggers to deterministic metrics, not model predictions |

Pitfalls it names [PB]:
- approval hooks during the build put a human back on the critical path of every parallel session;
- a stale or long `CLAUDE.md`;
- untuned review that drowns signal in nits;
- configuration changes shipped without regression evals;
- keeping one artifact in two systems. "Pick one system as authoritative per artifact."

Much of the playbook's Stage 4b–6 is enterprise machinery: an eval suite, managed hooks, control
bands, Claude Security, Claude Tag. **For a pre-user product, only the chain `intent → spec → plan →
code+check → PR gate` is in proportion.** The postmortem's rule applies: "Gates and law grow with
users, not ahead of them" [PM-V].

## 2. Claude Code features: what they do, limits, cost, and where they fit

Cost terms: "subscription" means the use draws on the Max plan's included limits. "Usage credits"
are pay-as-you-go, billed beyond the plan [COST].

| Feature | What it does | Limits and cost | Fit for Vextrus |
|---|---|---|---|
| **Plan mode** | Reads and runs exploratory commands, writes a plan, no source edits. Approving it can switch straight to auto mode [PM]. | Subscription. | **Use** for each milestone's `plan.md` (local, with the owner) and before any ticket of size L. |
| **Auto mode** | A classifier reviews each action instead of prompting. It blocks scope escalation, unknown infrastructure and hostile-content-driven actions. Explicit `ask` rules still prompt [PM]. | All plans. Opus 4.6+ on the Anthropic API. "Does not guarantee safety" [PM]. `defaultMode: "auto"` works only from user settings, not project settings [PM]. | **Use** as the default for implementation, locally and in the cloud. The owner's `ask` rules (push, reset, checkout, `rm -r`) stay. |
| **Worktrees** | `claude --worktree <name>` gives a session its own checkout. `isolation: worktree` does the same for a subagent. `.worktreeinclude` copies gitignored files in [WT]. | Each worktree is a fresh checkout that needs its own dependency install [WT]. The old worktrees take 8.8 GB (owner's housekeeping) [S10]. | **Use** for parallel local sessions, especially `local` tickets that need `.private/`. Don't put `.private/` in `.worktreeinclude` unless needed; a symlink is safer. |
| **Subagents** | Side tasks in their own context that return a summary. Built-in Explore and Plan are read-only. Custom agents can set tools, model, effort, isolation. Nesting depth defaults to 3; 20 concurrent by default [SA]. | Each subagent is a full context. We measured subagents at about 3× the main session's cost on our heaviest planning days (§3). | **Use** for review, verification and research only. Don't use them for parallel implementation inside one session; use separate sessions and PRs. |
| **Skills** | Versioned `SKILL.md` playbooks that load on demand. `disable-model-invocation: true` keeps them manual. `skillOverrides` hides or collapses them [SK]. | The listing costs context budget [SK]. **A project skill with the same name as a bundled one replaces it**: Matt's `code-review` replaces the bundled `/code-review` [SK]. | **Use** Matt's engineering loop (§4.3). **Rename Matt's `code-review`** so the bundled `/code-review` and `/code-review ultra` work. |
| **Bundled `/code-review`** | Reviews the diff for correctness bugs in a forked background subagent. `--fix` applies findings, `--comment` posts them to the PR. Effort sets depth [CR][CMD]. | Subscription [UR]. Doesn't read `REVIEW.md` [CR]. | **Use** before every PR as the adversarial pass, at `medium`. |
| **`/verify`, `/run`** | Build and run the app to confirm a change works, "without falling back to tests or type checks". `/run-skill-generator` records a launch recipe as a project skill [SK]. | `/verify` runs only when invoked [CMD]. The owner's user settings turn `run` off (`skillOverrides`) [US]. | **Use** once the app exists. Record the recipe once, so cloud sessions launch the app the same way. |
| **Ultrareview** (`/code-review ultra`) | A fleet of reviewer agents in a cloud sandbox. Each finding is independently reproduced. Takes 5–10 min [UR]. | 3 free runs on Max (one-time), then **$5–25 per review in usage credits**, not plan usage. Diff cap: 500 files / 8,000 lines [UR]. Unknown whether the $250 cloud credit pays for it. | **Use** selectively, on substantial PRs touching the data spine, geometry or money. Spend the free runs first. |
| **Managed Code Review** + `REVIEW.md` | Automatic multi-agent PR review with inline comments [CR]. | **Team and Enterprise only**; about $15–25 per review [CR]. | **Not available on Max.** Don't write a `REVIEW.md`. |
| **Hooks** | Scripts on lifecycle events. Exit 2 blocks with a reason Claude reads. A `Stop` hook can force continuation and is overridden after 8 consecutive blocks without progress [HK]. | Project hooks run in cloud sessions with one repository; user hooks don't [ENV]. | **Use** one guard hook and one small SessionStart state hook (§4.4). No approval hooks mid-build [PB]. |
| **Cloud sessions** (`claude --cloud`, web, phone) | Anthropic-managed VMs clone the GitHub branch and run a session that survives a closed laptop. `claude -p "…" --cloud <id>` queues follow-ups; `--teleport` pulls a session and its branch into the terminal [WEB]. | Ubuntu 24.04, x86_64, **4 vCPU / 16 GB / 30 GB** [ENV]. Share the plan's rate limits; "no separate compute charge" [WEB]. The VM is reclaimed after inactivity; background work is not restored [WEB]. `git push` only to the session's branch [ENV]. | **The execution workhorse** for `cloud` tickets (§3, §4). |
| **Cloud environment + setup script** | Network level (None, Trusted, Custom, Full), environment variables, a root setup script whose result is snapshotted and cached for about 7 days [ENV]. | The script must exit 0 and finish in about 5 minutes. Environment variables are readable by anyone using the environment, so no secrets. Python 3.x, uv, pytest, ruff, Node 22, **PostgreSQL 16** and Docker are preinstalled. PyPI, npm and GitHub are allowlisted under Trusted [ENV]. | **Set up and test before execution starts**, so no session burns turns installing (the Builder paid for this as its fault 23 [BLD-S] §1.3). |
| **Auto-fix PRs** | Claude watches a PR, and pushes fixes for CI failures and review comments when the fix is clear; it asks when a request is ambiguous [WEB]. | Needs the Claude GitHub App. Replies post under the owner's GitHub account. It can't react to merge conflicts [WEB]. | **Use** on cloud PRs so red CI doesn't wait for the owner. |
| **Routines** | Saved prompts that run as cloud sessions on a schedule, an API call, or a GitHub PR or release event [RT]. | Research preview. Daily run cap. Minimum interval one hour. Pushes only to `claude/` branches by default. Uses plan usage [RT]. The credit reportedly doesn't cover routines **(secondary)** [CRD]. A green run status means only that the session didn't crash [RT]. | **Not now.** Later, perhaps one nightly routine that reports CI or dependency drift as an issue. |
| **Projects** | A coordinating conversation that starts parallel cloud "threads", with shared instructions and memory, plus an Overview of what waits on you. A thread can run **on your own machine through Remote Control** [PRJ]. | Public beta on Pro and Max, rolling out. 200 threads/day [PRJ]. Reportedly not covered by the credit **(secondary)** [CRD]. The coordinator sees only what threads report [PRJ]. | **Trial later, not the backbone.** Its coordinator is a small Builder, and GitHub Issues already hold the state. Its local-thread option is worth remembering for `local` tickets. |
| **Remote Control** | Steer a local session from the phone or browser. Execution and files stay on the machine; the transcript is stored on Anthropic servers [RC]. | All plans [RC]. | **Use** to watch local `local`-ticket sessions from the phone. |
| **Headless / Agent SDK** (`claude -p`) | Scripted runs with `--output-format json` (which includes `total_cost_usd`) and `--bare` [HL]. | A `-p` session runs the project's hooks and MCP without a trust prompt [HL]. | Use it only inside CI or the local real-drawing check if needed. **Don't build an orchestrator on it.** That is how the Builder began [BLD-S] header. |
| **GitHub Actions** | Plain CI, and optionally `claude-code-action` for `@claude` mentions or scheduled prompts. Triggers need write access, and bots are rejected by default [GHA]. | **Actions are free for public repositories** on standard runners [GHB]. Claude in Actions needs a secret (API key or subscription OAuth token) [GHA]. | **Use for plain CI** (lint, types, tests, build). **Skip `claude-code-action`**: cloud sessions and auto-fix already cover it, without a token stored in a public repo's secrets. |
| **Agent teams** | Multiple coordinated sessions with messaging [AG]. | Experimental, off by default, "significantly more tokens", no worktree isolation [AG]. | **Don't use.** |
| **Dynamic workflows / ultracode / `/batch`** | Scripts that run many subagents and cross-check them; `/batch` splits a change into 5–30 worktree subagents [AG][CMD]. | Cost scales with the number of agents [AG]. | **Don't use for building.** The old `.claude/workflows/wave.js` and `chain.js` are this pattern. `/batch` only for a mechanical wide refactor. |
| **Fast mode** | Faster Opus output [PR]. | $8/$40 per MTok, twice list price [PR]. | **Don't use.** |
| **Effort** | Opus 5.5 defaults to `medium`, and at `medium` it matched or beat Opus 5 at `high` on agentic coding in Anthropic's tests [EF][O55]. `xhigh` is "for long-horizon work … over 30 minutes"; keep `xhigh`/`max` for measured gains [EF][O55]. | Changing effort mid-session invalidates the prompt cache, except per-message changes [EF]. | Policy in §4.7. |

Two Opus 5.5 behaviours matter for unattended runs [O55]:
- **It ends turns with progress reports.** An unattended loop that treats a text-only turn as "done"
  stops early. The guide gives a standing instruction naming the four bad stops (summary-then-stop,
  offer-to-continue, non-blocking decision lists, "good place to report"). It advises stopping after
  2–3 automatic continuations of a stuck task, and leaving the instruction out of
  human-in-the-loop sessions. **Put it in the cloud ticket prompt, not in `CLAUDE.md`.**
- **Time budgets speed up parallel work.** An "elapsed / budget" signal makes multi-agent work finish
  sooner without a quality loss in Anthropic's tests. Lowering effort, by contrast, reduces the work
  itself.

## 3. The $250 cloud-session credit: how it is consumed and how to spend it

### 3.1 What is known

Three facts rest on primary sources:
- cloud sessions "share rate limits with all other Claude and Claude Code usage", and there is "no
  separate compute charge for the cloud VM" [WEB];
- ultrareview and Code Review bill usage credits, not plan usage [UR][CR];
- `/usage` shows a session's list-price dollar figure, computed locally from token counts [COST].

The credit's own terms come only from secondary reports of the 23–24 September announcement
**(secondary)** [CRD]. Anthropic's docs don't mention it:
- $100 on Pro and **$250 on Max**, one-time;
- claim by **7 October 2026** (at `claude.ai/code/claim-credit`, or `/claim-credit` in the CLI);
- a linked GitHub account is required;
- it applies automatically when a cloud session starts;
- it is separate from the plan's usage limits;
- it expires on **4 or 5 November 2026** (reports differ);
- it reportedly doesn't apply to Projects or Routines;
- what cloud use costs after the credit runs out wasn't stated.

**Not known:**
- whether the credit is drawn at API list price per token (assumed below);
- whether ultrareview can draw on it;
- whether a cloud session on the Max plan draws on the credit first or on plan usage first.

The owner should check the balance and terms at `claude.ai/settings/usage` after claiming. We did not
verify that the balance appears there.

**The consequence:** if the credit expires in early November, execution has to start by mid-October
to spend it. The planning sessions (10–12) should be scheduled with that in mind. A caution: after
claiming, *any* cloud session draws on the credit, including an ultrareview, if it is eligible
(secondary). So start no cloud sessions during planning.

### 3.2 What a session costs: measured, then estimated

Opus 5.5 list prices per MTok [PR]:
- input $4;
- 1-hour cache write $8 (5-minute write $5);
- cache read **$0.20**;
- output $20.

Claude Code caches the prompt prefix, so a session's cost is roughly this [BLD-R] §12.2 [COST]:

```
cost ≈ Σ over turns (context size × $0.20/M)  +  output × $20/M  +  cache writes × $5–8/M
```

The Builder measured this over 1,909 sessions: about $4 in every $5 went to prompt handling (cache
reads 47.5%, cache writes 29.6%) and only 22.8% to output [BLD-R] §12.2.

We measured our own transcripts too (`~/.claude/projects/-home-riz-vextrus-cubit/*.jsonl`, deduplicated
by message id, priced at Opus 5.5 list):

| Session (local) | Main-session tokens | Main at Opus 5.5 list | Subagents (files, calls) | Subagents at list |
|---|---|---|---|---|
| 22–23 Sep, long orchestrated day | 1.41M out, 737M cache read | ≈ $203 | 163 files, 10,522 calls, 2.03B cache read | ≈ $632 |
| 24–25 Sep | 0.53M out, 370M cache read | ≈ $112 | 136 files, 10,241 calls, 1.88B cache read | ≈ $562 |
| 21 Sep, 1 h 42 min, main only | 0.24M out, 47M cache read | ≈ $18 | — | — |

These are list-price equivalents. The owner pays a subscription, so the figures measure token
pressure, not cash. But they show the shape:
- **Long contexts and subagent fan-out are the bill.** The average subagent call re-read about 190k
  cached tokens.
- A day of orchestration with about 150 subagents costs roughly three times the $250 credit.

**Estimate for one well-specified cloud ticket** (assumption: 100–200 turns at 50–100k average context,
50–100k output tokens, 0.5–1M cache writes):
- cache reads $1–4;
- output $1–2;
- writes $3–8;
- **about $5–15 per session.**

A ticket with an auto-fix round or two adds a few dollars. A ticket that fans out subagents or grows
past 150k context can cost 3–5× more.

So **$250 buys roughly 20–40 focused ticket sessions**, or less than a third of one orchestration
day. Treat this as a rough estimate until measured. Measure it in the first three cloud sessions:
- `/usage` in the session, if the cloud surface shows it;
- the credit balance before and after;
- then recalibrate.

### 3.3 How to spend it wisely

1. **Claim it before 7 October** (owner action). Start no cloud session until execution begins.
2. **Get ready before the first cloud session:**
   - the environment is set up (setup script, Python 3.13 through uv, Postgres started per session,
     the test suite runs green on the empty skeleton);
   - the milestone's spec and plan are committed and pushed;
   - the frontier tickets are written.

   Cloud sessions clone the pushed branch, not the local checkout [WEB].
3. **One ticket, one cloud session, one PR.** A ticket is sized to a fresh context, a vertical slice
   with its own test [TT]. No orchestrator session in the cloud. No subagent fan-out beyond one
   review pass.
4. **Run 3–5 sessions concurrently**, only as many as the owner can review ([PB]: "start with 2–3").
   Launch them with `claude --cloud "…"` from the terminal, one per frontier ticket [WEB].
5. **Pin `medium` effort in committed settings** (`effortLevel` in the project's
   `.claude/settings.json`), or with `CLAUDE_CODE_EFFORT_LEVEL` in the environment. The owner's user
   settings don't reach the cloud [ENV][SR].
6. **Turn on auto-fix** on each cloud PR, so red CI is fixed without the owner [WEB].
7. **Don't spend the credit on:**
   - grilling, planning, research or architecture: local, on the subscription;
   - real-drawing work: it can't run in the cloud;
   - routines or projects: reportedly excluded (secondary);
   - fast mode.
8. **Stop rule** [O55]: a ticket that fails its checks after two continuations goes back to
   `needs-triage` for a human re-spec. It is not retried in a loop. The Builder spent "$124.08 —
   bought nothing" on one parked node [BLD-R] §12.1.
9. **Record the cost per merged PR** in the milestone's issue, from `/usage` and the credit
   balance. That is the one metric the Builder was right to keep, at about $69.50 per merged increment
   [BLD-R] §1.

## 4. The lean harness proposal

The principle, from the postmortem: "One product, judged in the running product by its users. No
engine that builds the engine" [PM-V]. **The harness is configuration and prose, not code.** Its only
code is one guard hook and one state hook, under about 200 lines together. Any change to the harness
needs an issue the owner approves, and should remove as much as it adds.

### 4.1 Artifacts (one source of truth each [PB])

| Artifact | Where | Written by | Notes |
|---|---|---|---|
| `CLAUDE.md` | repo root, under one page | Claude, with owner approval | The commands with their healthy output [PB], the law, the layout. A mistake made twice goes in [PB]. |
| `CONTEXT.md` + `docs/adr/` | repo | `/grill-with-docs`, `/domain-modeling` | The user's vocabulary, not the machine's (postmortem cause 4 [PM-V]). |
| `docs/intent.md` | repo | owner + Claude | Product intent. One file, updated. |
| `docs/specs/<milestone>.md` | repo | Claude from the grilling; owner signs off | **In the repo, not in an issue**, so cloud sessions clone it. Matt's `/to-spec` publishes to the tracker [TS]; adapt it to write the file and open an issue that links to it. |
| `docs/plans/<milestone>.md` | repo | plan mode, with the owner | Modules, order, test seams, risks [PB]. One per milestone, not per ticket (an L ticket can carry a plan section in its issue). |
| Tickets | GitHub Issues | `/to-tickets` | Vertical slices with blocking edges and acceptance criteria [TT]. **Issues are the only work state.** No ledger. |
| PRs | GitHub | sessions | `Closes #N`. The body states what was verified and how, and what is *not* done. |
| Real-drawing ground truth | `.private/work/` | owner confirms | Never committed (law). |

Drop:
- `docs/traceability.json` and any requirement-id bookkeeping;
- ledgers, evidence packs, refusal registers and law ids (postmortem cause 3 [PM-V]).

### 4.2 Issue flow (public repository)

1. **Grill** (HITL, local): the intent and spec for the next milestone only. Use `/wayfinder` on
   Issues when the way is foggy [WF].
2. **Plan** (HITL, local, plan mode): commit `plan.md`. Raise effort to `high` only for the hard
   ones (§4.7).
3. **Ticket** with `/to-tickets` [TT]. Labels:
   - the five triage states (existing);
   - `bug` / `enhancement`;
   - **`cloud`**: verifiable by committed tests alone;
   - **`local`**: needs `.private/` drawings, the owner's machine or the owner's eyes.

   No issue body carries anything from `.private/`: no names, figures or drawing content [IT].
4. **Execute:**
   - frontier `ready-for-agent` + `cloud` tickets go to cloud sessions, 3–5 at a time;
   - `local` tickets go to local sessions in worktrees, on the subscription, watched through Remote
     Control.

   Each session runs Matt's `/implement` → `/tdd` at the agreed seams → the fast check → the bundled
   `/code-review` → a PR [IM][TDD].
5. **Gate each PR:**
   - (a) CI green on GitHub Actions (free for public repositories [GHB]);
   - (b) the session's own evidence in the PR body (commands and their results) [BP];
   - (c) for PRs touching reading or assembly, the **local real-drawing check** (§4.6);
   - (d) ultrareview on substantial or risky PRs [UR];
   - (e) **the owner merges.** Branch protection; Claude never approves its own work [PB].
6. **Close the milestone:** the owner walks the running product on real drawings (`product-review`).
   Only that walk says "done".

Cloud and local sessions run *in parallel across tickets*. Inside one ticket, they run in sequence.
The architecture must give each ticket its own files (clear module boundaries, one obvious place for
each thing), or parallel PRs collide. That happened to both earlier stacks [PM-V] §6 and to the
Builder, whose M2 tail was a dependency chain that never used its second lane [BLD-R] §12.9.

### 4.3 Skills: keep, rename, rewrite, drop (from the current `.claude/skills/`)

- **Keep (Matt):**
  - `grill-with-docs`, `grilling`, `domain-modeling`: the spine of planning;
  - `to-spec` (adapted to write `docs/specs/`), `to-tickets`, `triage`, `wayfinder`;
  - `implement`, `tdd`, `diagnosing-bugs`, `codebase-design`, `prototype`, `research`, `handoff`;
  - `resolving-merge-conflicts`, `writing-for-agents`, `wizard`, `ask-matt`.
- **Keep, occasional:** `improve-codebase-architecture`.
- **Rename:** Matt's `code-review` → `spec-review`. As a project skill it replaces the bundled
  `/code-review` [SK], and the owner's user settings set `"code-review": "off"` [US], which hides one
  or both. After the rename:
  - drop that override;
  - point Matt's `implement` at `/code-review` (bundled, for bugs);
  - use `/spec-review` (Matt's two-axis standards and spec check) before merging a milestone's last
    ticket.
- **Rewrite for the new product:**
  - `product-review`: walk the running product in the browser, keep the idea;
  - `edison-drawings` → a `real-drawings` skill for local analysis and the real-drawing check.
- **Drop:**
  - `lanes`, `readback`, `session-close`, `jev` (Cubit-specific). `jev`'s knowledge stays in
    `docs/research/jev-system-one.md` until an AI feature needs it;
  - `setup-matt-pocock-skills`: already run;
  - `grill-me`, which duplicates `grilling`;
  - optionally `teach`, `to-questionnaire`, `wait-what`. Their only cost is listing budget [SK].
- **Bundled skills to use:** `/code-review`, `/code-review ultra`, `/verify` and
  `/run-skill-generator` once the app runs [SK][CMD]. The owner's `skillOverrides` turns off `run`,
  `simplify` and `security-review` [US]. Reconsider `run`, needed for `/verify`'s recipe; its status
  is unverified.

### 4.4 Hooks and settings

- **Guard (PreToolUse, Bash|Edit|Write).** Port the universal rules from
  `scripts/harness/guard-rules.mjs` into a **self-contained** `.claude/hooks/guard.mjs`:
  `SECRET_PRINTED`, `STAGE_ALL`, `PRIVATE_STAGED`, `GIT_CLEAN`, `HISTORY_REWRITTEN`, `HOOKS_SKIPPED`,
  `POWERSHELL`. The reset deletes `scripts/harness/` [S10], and the hook must run in the cloud too
  [ENV]. Drop the Cubit rules (`BIBLE_EDITED`, `HELDOUT_EDITED`, `FROZEN_FIXTURE_EDITED`,
  `BASELINE_OVERWRITTEN`, `GENERATED_EDITED`). Reintroduce `LANDED_MIGRATION_EDITED` only when
  migrations exist and a mistake repeats.
- **SessionStart:** a small state script (branch, dirty files, open PR for the branch). It must not
  assume local paths, because it runs in the cloud too [ENV]. Install dependencies in the cloud
  **setup script**, not the hook, because the setup script is cached [ENV].
- **PostToolUse `sync` after commit:** keep. It is harmless and local-only in effect.
- **No approval hooks during the build** [PB]. **No Stop hook at first.** The Builder's visible
  acceptance stage "never once spoke" in 510 runs [BLD-R] §12.9, so a forced check at every stop
  mostly adds turns. CI and the PR gate do that job.
- **No locked paths or held-out tests.** In the Builder they produced faults 12–16 and 20, and a
  critical leak of the hidden answers into git history [BLD-S] §1.3, [BLD-R] §7.3 R1. Test integrity
  is kept by review instead:
  - a bug fix starts with a failing test [PB];
  - existing assertions are not weakened;
  - `/code-review` and the owner read test diffs.
- **Settings:**
  - committed project settings pin `model`, `effortLevel: "medium"` and the permission `ask` rules;
  - `.mcp.json` drops the `cubit` server. Its `chrome-devtools` entry runs through
    `scripts/harness/browser-mcp.mjs`, which the reset removes, so re-point it at the published
    package. Whether Chrome runs in the cloud VM is unverified: chromedriver is preinstalled, and a
    browser download domain isn't on the Trusted list [ENV].

### 4.5 Agents (review and verification only, all read-only)

Keep `refuter`, `qs-critic` and `ux-critic`, rewritten without Cubit law or commands. Keep
`drawing-analyst` for local use only; it writes only to `.private/work/`. They are the playbook's
"verifier subagent: final check by fresh context" [PB] and the docs' "adversarial review step" [BP].
The docs warn that a reviewer told to find gaps will always report some, and that chasing every one
leads to over-engineering. **Each agent's prompt says to flag only correctness and stated-requirement
gaps** [BP]. There are no builder, planner, fixer or integrator roles: the main session does the
work.

### 4.6 Verification with real drawings that must stay local

What the constraint implies:
- **Cloud sessions can't see `.private/`.** They start from a clone of committed files. Untracked
  files are never bundled, and the Edison set may never be committed [ENV][WEB][LAW].
- **So a cloud session can prove only what committed tests prove.** It can't prove that the product
  reads real Bangladeshi drawings. That was exactly the gap that sank Cubit: "a green gate meant
  'Cubit agrees with Cubit'" [PM-V] cause 1.

The rules this sets:
1. **Synthetic fixtures are for unit mechanics only**, never offered as proof of reading. A committed
   corpus must be openly licensed real drawings, or owner-approved redacted derivatives. Finding such
   a corpus is an **open research question**.
2. **The real-drawing check is local:** one command runs the pipeline on the `.private/` set and
   compares it with owner-confirmed ground truth kept in `.private/work/`. What may go into a PR
   comment is the **owner's ruling**: pass/fail and counts at most, never names, figures or images
   [IT][LAW].
3. **Tickets that change reading, inference or BIM assembly are labelled `local`,** or they carry the
   check as a merge condition. Cloud tickets take the work that committed tests fully specify: API,
   data model, UI, estimate arithmetic, IFC writing from confirmed data.
4. **The milestone finish line is the owner's walk** of the running product on a real drawing set.
5. **Optional, the owner's call:** uploading drawings to a Project's Library would put them on
   Anthropic storage [PRJ]. That isn't a commit, but it is outward-facing. Remote Control keeps
   execution local, but stores transcripts on Anthropic servers [RC], as every local session's model
   calls already do.

### 4.7 Effort policy

- **`medium` by default**, locally and in the cloud. It is Opus 5.5's default, and it matches or
  beats Opus 5 at `high` on agentic coding [EF][O55].
- **`high`** for genuinely hard decisions and debugging: architecture, the 2D→BIM approach, the
  business model, a bug two sessions couldn't crack. Drop back afterwards.
- **`xhigh`** only where measured to help [O55]. **`low`** for mechanical subagents such as Explore.
- **Set it per workload, not mid-conversation.** A top-level change invalidates the cache [EF].
- **A finding to fix (owner's call):** `~/.claude/settings.json` sets `modelSettings.claude-opus-5-5.effortLevel:
  "high"`, and the top-level `effortLevel: "medium"` doesn't apply to Opus 5.5 [US][MC]. So local
  sessions start at **high** unless overridden, contrary to CLAUDE.md's "the session runs at
  medium". The same file forces `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5-5` for every subagent
  [US].

## 5. The Builder's failure modes, and one rule each

Sources: the founding spec [BLD-S], the Builder's own review of 10–11 September [BLD-R], the
postmortem [PM-V], and measurements of `~/vextrus-builder` today:
- 1,592 commits;
- 47 spec files totalling 19,195 lines, from `builder.spec.md` up to v22 (5,507 lines);
- fault numbers up to 744 in commit subjects;
- 75,789 lines of engine TypeScript in `src/`.

| # | Failure mode (evidence) | Rule that prevents it |
|---|---|---|
| 1 | **The engine became the product.** About 23% of spend went on the engine's own faults, and "of the five most expensive increments, zero are clean product difficulty" [BLD-R] W2. Twenty-two versions of the spec. | **The harness is config and prose.** Harness code stays under about 200 lines of hooks. No orchestrator, state store or custom runner. A harness change needs an owner-approved issue and should delete as much as it adds. |
| 2 | **Green reported, product broken.** Screenshots and videos were green while the product failed on real use [PM-V]. The visible acceptance stage returned "0 reds, ever" in 510 runs; a green stage hid a 74 KB layering defect "because nobody reads a green stage's tail" [BLD-R] §12.8–9. | **Done means the owner saw it work in the running product on real drawings.** CI is necessary, never sufficient. Every PR states what it did *not* verify. |
| 3 | **Proved against itself.** Self-authored drawings and answer key [PM-V] cause 1. | **Real drawings from the first milestone.** Synthetic fixtures only for unit mechanics. The local real-drawing check gates reading and assembly changes (§4.6). |
| 4 | **Up-front mega-plan.** A 1,058-line Bible compiled "once" into 170 increments at `xhigh` [BLD-S] §4.1, [BLD-R] §1. Half the graph, "the half that sells", was never started [BLD-R] W6. | **Plan one milestone at a time,** money in the loop early [PM-V]. Spec and tickets only for the next milestone; the rest stays as fog in `/wayfinder` [WF]. |
| 5 | **Too many roles and too much machinery.** Sixteen to 22 roles, a conductor, relays, a ledger, a watchman and a coach [BLD-S] §0, §4. | **One implementing session per ticket and three read-only reviewers.** GitHub Issues are the state; the owner is the conductor. |
| 6 | **A self-improvement loop that never worked.** 299 lessons, 8% servable, the evaluator never called, 0 rows of metrics [BLD-R] W3. | **No learning machinery.** The playbook's rule instead: a mistake made twice goes into the one-page `CLAUDE.md` [PB]. |
| 7 | **Cost driven by prompt handling and reconnaissance.** 80% of spend was prompt handling [BLD-R] §12.2; 41 recon calls per session; 58–84% of tool budget went on finding where things are [BLD-R] W5. | **Small tickets in fresh contexts.** A code layout where each thing has one obvious place. `CONTEXT.md` plus a short layout map in `CLAUDE.md`. Cost per merged PR is tracked (§3.3). |
| 8 | **Locks and held-out tests bred faults.** Locks contradicted the plan, and the engine locked itself out [BLD-S] §1.3 faults 12–16, 20. The hidden answers leaked into git history [BLD-R] §7.3 R1. | **No locked paths, no hidden tests.** Test integrity comes from review of test diffs and the bug-first-test rule (§4.4). |
| 9 | **Rework loops.** One node in four "bought nothing"; $/merge rose from $52.82 to $100.67 [BLD-R] §1, §12.1. | **Stop after two failed continuations** [O55], then send the ticket back to a human for re-spec. No escalation ladder. |
| 10 | **Unpinned models and invented constants.** A subagent drew spend on an unconfigured model [BLD-R] §12.9; Opus prices were hard-coded 3× too high [BLD-R] W4. | **Pin model and effort in committed settings.** Every external fact (prices, API shapes, rates) in the product cites a source or a fetched doc. |
| 11 | **Parallelism the design couldn't use.** A chain of dependencies left the second lane idle [BLD-R] §12.9; parallel agents collided on shared registries [PM-V] cause 6. | **Tickets are vertical slices that own disjoint files** [TT]. The architecture decision is judged partly on this. |
| 12 | **The process was reported as progress.** "I thought everything was going well; in reality we were drowning" [S10]. | **Reports lead with what is broken or unmeasured.** The owner's weekly walk of the running product replaces dashboards. |

## 6. What not to use, and why

- **Agent teams:** experimental, token-hungry, no isolation [AG].
- **Dynamic workflows, ultracode, and the old `wave.js`/`chain.js` for building:** they recreate the
  Builder; costs scale with the number of agents [AG]. Keep `/batch` for a mechanical wide refactor
  only.
- **Managed Code Review and `REVIEW.md`:** Team and Enterprise only [CR].
- **`claude-code-action` in GitHub Actions:** it duplicates cloud sessions and auto-fix, and needs a
  token in a public repository's secrets [GHA].
- **Routines and Projects as the backbone:** preview and beta, reportedly outside the credit
  (secondary), and a coordinator that sees only summaries [RT][PRJ][CRD]. Revisit after the first
  milestone.
- **Fast mode:** twice the price [PR]. **`xhigh`/`max` by default:** no measured gain [O55].
- **Held-out tests, locked paths, ledger, relays, evidence packs, per-increment retros, and
  requirement-id traceability.** Each was paid for in the Builder and bought complexity faster than
  product [BLD-R].
- **The Opus 5.5 "keep going" standing instruction in `CLAUDE.md`:** use it only in unattended cloud
  ticket prompts [O55].

## 7. Open questions and what was not verified

1. The credit's exact terms (expiry date, per-token pricing, whether ultrareview draws on it).
   Secondary sources only. **The owner claims it before 7 October and checks the terms at
   claude.ai.**
2. Whether `uv python install 3.13`, Playwright browsers and a Chrome for `chrome-devtools-mcp` work
   under the Trusted network level. The GitHub proxy limits release-asset downloads to repositories
   attached to the session [ENV]. **Test this with the setup script before execution.**
3. A committable, openly licensed real-drawing corpus: which sources and licences. That needs its
   own research ticket.
4. The owner's rulings:
   - what the real-drawing check may say in a public PR;
   - whether drawings may ever be uploaded to Anthropic storage (Projects);
   - fixing the `high` effort default in user settings;
   - removing the `code-review` skill override.

## Sources

Primary (Anthropic):
- [PB] Anthropic, "The AI-native SDLC playbook", https://claude.com/blog/the-ai-native-sdlc-playbook
- [WEB] Use Claude Code in the cloud, https://code.claude.com/docs/en/claude-code-on-the-web
- [ENV] Configure cloud environments, https://code.claude.com/docs/en/cloud-environments
- [RT] Routines, https://code.claude.com/docs/en/routines
- [UR] Ultrareview, https://code.claude.com/docs/en/ultrareview
- [CR] Code Review (incl. "Review a diff locally"), https://code.claude.com/docs/en/code-review
- [PRJ] Projects, https://code.claude.com/docs/en/claude-projects
- [AG] Run agents in parallel, https://code.claude.com/docs/en/agents ; agent teams, https://code.claude.com/docs/en/agent-teams
- [PM] Permission modes (plan, auto), https://code.claude.com/docs/en/permission-modes
- [WT] Worktrees, https://code.claude.com/docs/en/worktrees
- [SA] Subagents, https://code.claude.com/docs/en/sub-agents
- [SK] Skills (bundled skills, name precedence, `skillOverrides`), https://code.claude.com/docs/en/skills
- [CMD] Commands reference, https://code.claude.com/docs/en/commands
- [HK] Hooks guide, https://code.claude.com/docs/en/hooks-guide
- [HL] Headless / programmatic use, https://code.claude.com/docs/en/headless
- [GHA] GitHub Actions, https://code.claude.com/docs/en/github-actions
- [BP] Best practices, https://code.claude.com/docs/en/best-practices
- [COST] Manage costs, https://code.claude.com/docs/en/costs
- [MC] Model configuration (effort precedence), https://code.claude.com/docs/en/model-config
- [SR] Settings reference (`effortLevel`, `modelSettings`), https://code.claude.com/docs/en/settings-reference
- [RC] Remote Control, https://code.claude.com/docs/en/remote-control
- [EF] Effort, https://platform.claude.com/docs/en/build-with-claude/effort
- [O55] Prompting Claude Opus 5.5, https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- [PR] Pricing, https://platform.claude.com/docs/en/about-claude/pricing

Primary (other):
- [GHB] GitHub, "About billing for GitHub Actions", https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions

Secondary (the credit; no Anthropic page found):
- [CRD] explainx.ai, https://explainx.ai/blog/claude-code-cloud-sessions-ga-100-250-credit-claim-credit-2026
- KuCoin news, https://www.kucoin.com/news/flash/anthropic-offers-cloud-credits-to-claude-code-pro-and-max-users
- The ClaudeDevs post on X (https://x.com/ClaudeDevs/status/2102871550974427462), quoted by search results; not fetchable.

Local:
- [PM-V] `docs/postmortem.md`
- [S10] `docs/handoff/session-10-prompt.md`
- [LAW] `CLAUDE.md`
- [IT] `docs/agents/issue-tracker.md`
- [BLD-S] `~/vextrus-builder/docs/specs/builder.spec.md`
- [BLD-R] `~/vextrus-builder/docs/VEXTRUS-BUILDER-STATE-OF-THE-ENGINE.md` (§1, §7, §12)
- [US] `~/.claude/settings.json` (read with secrets redacted)
- Project harness: `.claude/settings.json`, `.claude/hooks/*.mjs`, `.mcp.json`, `scripts/harness/guard-rules.mjs`
- Matt Pocock's skills: [TS] `to-spec`, [TT] `to-tickets`, [IM] `implement`, [TDD] `tdd`, [WF] `wayfinder`, plus `triage`, `handoff`, `code-review`
- Token measurements: `~/.claude/projects/-home-riz-vextrus-cubit/*.jsonl` and their subagent files, summed by message id and priced at [PR] Opus 5.5 list.
