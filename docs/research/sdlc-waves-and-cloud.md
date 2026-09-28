# Running waves of tickets across worktrees and cloud sessions on two Max accounts

Question: how should Vextrus run waves of tickets across local worktrees and Claude Code cloud
sessions on two Claude Max accounts? What does the $500 cloud credit buy? What must the cloud
environment contain?

Read on **2026-09-26** (every source below was accessed that day). Claude Code docs were fetched as
raw markdown from `code.claude.com/docs/en/<page>.md`; the local CLI is v2.1.283. GitHub docs were
fetched through `docs.github.com/api/article/body`. The baseline is `docs/research/sdlc-claude-code.md`
(25 Sep); §7 lists what changed or was wrong there. **(unconfirmed)** marks a claim no primary source
states; **(secondary)** marks one resting only on news or blog reports.

Names used: **A** is the owner's main Max account (the one the local CLI is signed in to). **B** is
the second Max account.

---

## 0. Conclusions

### 0.1 Where things run

| Work | Where | Account | How it's launched | How the result comes back |
|---|---|---|---|---|
| `cloud` tickets (fully proven by committed tests) | Anthropic-hosted cloud sessions | B mostly, A some | `claude --cloud "<ticket prompt>"`, one per ticket, from the main checkout on a pushed `main`. For B: `CLAUDE_CONFIG_DIR=~/.claude-b claude --cloud "…"` [WEB][ENVV] | The session opens a PR that closes the issue, with auto-fix on [WEB] |
| `local` tickets that run unattended (the real-drawing check is scripted) | Local worktrees through the Workflow tool, `agent(…, {isolation: 'worktree'})` [WA] | A | One saved workflow run per wave, `pipeline()` over the ticket list | Each agent pushes a branch and opens a PR |
| `local` tickets that need the owner's eyes | Interactive `claude --worktree <name>` or agent view (`claude agents`) [WT][AV] | A | By hand | PR |
| Planning, grilling, research, orchestration | Local | A | Interactive | Committed docs |
| Deep review of risky PRs | Ultrareview, `/code-review ultra <PR#>` [UR] | B first (its 3 free runs), then A | By hand, per PR | Findings in the session, or one PR comment with `--post` |

- **The Workflow tool can't send work to the cloud.** A workflow's `agent()` takes only
  `isolation: 'worktree'` [WA]. So cloud waves are launched with `claude --cloud`, one command per
  ticket. The Agent tool's input type does accept `isolation: "remote"`, and its output has a
  `remote_launched` variant that "Claude Code dispatched to a cloud session" [SDK]. No page describes
  how it behaves, which account and environment it uses, or whether the credit pays for it
  **(unconfirmed)**. Try it once, and don't build on it.
- **A workflow can't ask the owner anything mid-run** [WF]. Only unattended local tickets belong in
  one.

### 0.2 Wave sizes (estimates; measure in wave 1)

- **Wave 1:** 4 cloud tickets (3 on B, 1 on A) and 1–2 local tickets on A.
- Measure four things in wave 1:
  - the cost per merged PR (the credit balance before and after, at `claude.ai/settings/usage`);
  - the wall time to a PR;
  - the owner's review minutes per PR;
  - how many PRs needed a second continuation.
- **Widen to 6–8 cloud and 2 local** once three things hold:
  - the owner's review queue stays under one working day;
  - no more than 1 PR in 4 needs a second continuation;
  - merge conflicts stay trivial.
- **The ceiling is the owner's review, not tokens or the credit.** At 20–30 minutes a PR, about 10–15
  PRs a day is one person's limit (estimate). So about 10–12 concurrent cloud sessions is the useful
  maximum.
- **Size each wave by conflicts, too:**
  - at most one ticket per wave may add migrations to a given Django app. Two new migrations in one
    app conflict on merge (inferred from how Django numbers migrations);
  - tickets own disjoint files (docs/sdlc.md).

### 0.3 The credit: what $500 buys and how the two accounts split it

- **What it buys:** at about **$10 per ticket session** (range $5–15, §1.6), $500 buys roughly
  **35–90 cloud ticket sessions, about 50 at the centre**. That is around 8–10 working days of 6
  cloud tickets a day.
- **The credit is not the limit on how much we build.** Cloud sessions "share rate limits with all
  other Claude and Claude Code usage" and carry "no separate compute charge" [WEB]. Reports say that
  once the credit is spent, cloud sessions count against normal plan limits (secondary) [CRD]. So
  after the credit, waves go on, drawing on the two accounts' Max limits.
- **Its deadline does bind.** Reports say it expires on **4 November 2026** (secondary) [CRD][CRD2].
  Start cloud waves as soon as M0's first tickets are ready. Don't hold the credit back.
- **The split:**
  - B carries about two in three cloud tickets while A is also running local work and
    orchestration. Both accounts' plan limits are shared with everything else each one does [WEB].
    Go 1:1 when A is idle.
  - Each account spends only its own $250. Nothing moves between accounts.
  - Record which account ran each PR. Commits carry a `Claude-Session:` trailer and the PR body
    carries the session URL [ENV]. Record the cost per merged PR in the milestone's issue.
  - Turn on **usage credits with a monthly cap on B** (the owner's figure). That pays for paid
    ultrareviews and any fast mode. Neither is covered by the plan [UR][FM], and probably not by the
    cloud credit either **(unconfirmed)**.

### 0.4 What the owner reviews on each PR (the owner alone merges)

1. **The PR body:** what was verified, how, and what was **not**.
2. **CI is green.** Count skipped tests as not run.
3. **The test diff:** no assertion weakened, and a bug fix starts with a failing test.
4. **Read in full any change to** `.github/workflows/`, `.claude/`, `CLAUDE.md`, hooks, settings,
   migrations or lockfiles.
   - The Claude GitHub App holds **Workflows: read and write** and **Actions: read and write**
     [GHA-C]. A session could edit CI.
   - GitHub Free has no CODEOWNERS on private repositories [GHP], so nothing else flags these.
5. **`local` PRs:** the real-drawing check's pass/fail and counts.
6. **Risky PRs** (money, geometry, the data spine): the ultrareview findings, resolved.
7. **UI PRs:** the design gate's screenshots.
8. **Merge in dependency order.** After each merge, tell the wave's open sessions to rebase.
   Auto-fix can't see merge conflicts [WEB].

### 0.5 GitHub: recommend GitHub Pro at $4 a month

- **The repository belongs to a personal account:** `owner.type = "User"`, measured with `gh api` on
  26 Sep. So the upgrade is **GitHub Pro**, not Team.
- **Pro unlocks protected branches and rulesets on private repositories** [GHPB][GHRS]. It also
  raises Actions to 3,000 minutes and 1 GB of artifact storage [GHAB]. Its price, **$4 a month**,
  comes from search results, not a GitHub page I could fetch **(unconfirmed)**.
- **The ruleset for `main`:**
  - require a pull request;
  - require the CI status check;
  - block force pushes and deletion;
  - **0 required approvals.**
- **Why no approvals.** Cloud sessions act through the owner's GitHub identity. Their PRs are
  authored by `vextrus`, and "pull request authors cannot approve their own pull requests" [GHAPR]. A
  required approval would block the owner. The owner's merge is the approval.
- **An option, if a recorded approval matters:** connect account B to a GitHub **machine account**
  with write access. GitHub's terms allow one free machine account per person [GHTOS]. Its PRs could
  then carry the owner's approval.

---

## 1. Cloud sessions (Claude Code on the web)

### 1.1 Environments

- **What an environment holds** [ENV]:
  - a name;
  - a network access level;
  - environment variables (`.env` format);
  - a setup script;
  - on Pro and Max only, **API credentials**.
- **Environments are personal to each account.** Owner-shared environments exist only on Team and
  Enterprise [ENV]. **A and B each need their own identical environment.** The setup script isn't
  in git, so keep the canonical copy in the repo and paste it into both (§6).
- **Where it is edited.** Only in the environment selector at claude.ai/code (the cloud icon above the
  message box) or in the Desktop app. "There's no settings page or direct URL" [ENV]. `/remote-env`
  picks the CLI's default environment and stores it in user settings [ENV]. Don't commit
  `remote.defaultEnvironmentId`: the IDs differ per account.
- **Environment variables are readable by anyone using the environment.** Use them for non-secrets
  only [ENV].
- **API credentials are the way to hold a key** [ENV]:
  - "Anthropic's agent proxy adds the key to requests for the hosts you list, after each request leaves
    the session's VM. The key never reaches Claude, the commands it runs, or the session's environment
    variables."
  - A credential is added only by editing an existing environment. It can't be viewed again, and it
    is deleted and re-added to change.
  - Its hosts are reachable even when the allowlist wouldn't otherwise allow them.
  - It is never attached to setup-script requests, GitHub, `api.anthropic.com` or the public package
    registries.
  - **This is where the TypeSafe cloud key goes** (§6.2). It is better than the environment
    variable ADR 0013 assumed.

### 1.2 Network

- **Four levels** [ENV]:
  - **None**;
  - **Trusted** (the default): an allowlist of package registries, GitHub, cloud SDKs and more;
  - **Full**: any domain;
  - **Custom**: your own list, optionally plus the defaults.
- **Always reachable, whatever the level:**
  - GitHub, through a separate proxy;
  - MCP connectors;
  - the API-credential hosts;
  - the Anthropic API.
- **Traffic control.** Everything passes a security proxy, which keeps a DNS-level audit trail. Bun is
  a known misfit behind it [ENV].
- **The GitHub proxy** [ENV]:
  - `git push` works only to the session's current branch;
  - GitHub API and **release-asset requests reach only repositories attached to the session**. "A
    setup script that downloads release assets from an unattached repository gets a 403";
  - it serves only a pinned set of GraphQL operations, so Projects v2 is unreachable.
- **What this means for us:**
  - **`uv python install 3.13`:** uv ≥ 0.11.14 downloads Python from `releases.astral.sh`, with
    GitHub as the fallback [UV]. Neither is reachable under Trusted: the Astral host isn't listed,
    and python-build-standalone is an unattached repository. **So use Custom = the defaults plus
    `releases.astral.sh`** (unconfirmed until tested).
  - **The LibreDWG source:** `ftp.gnu.org` is not on the Trusted list, and LibreDWG's GitHub
    releases are unattached. So either download our own prebuilt release asset from
    `vextrus/vextrus-cubit` (an attached repository), or add `ftp.gnu.org` to the Custom list.
  - **Node 24:** `nodejs.org` **is** on the Trusted list [ENV].

### 1.3 What the VM has

- **The machine:** Ubuntu 24.04 on x86_64, with about 4 vCPU, 16 GB of RAM and 30 GB of disk. "The
  VM may stop tasks that need significantly more memory" [ENV].
- **Preinstalled** [ENV]:
  - Python 3.x with pip, poetry, uv, mypy, pytest and ruff (which 3.x isn't stated);
  - **Node 20, 21 and 22 only** (22 on `PATH`), so **Node 24 must be installed**;
  - Docker;
  - **PostgreSQL 16** and Redis 7, which are "pre-installed but not running". Start them with
    `service postgresql start` each session;
  - GCC, Clang, cmake, `gh` and `jq`.
  - Ask Claude to run `check-tools` to see the exact versions.
- **Apt works:** "Scripts run as root on Ubuntu 24.04, so `apt install` and most language package
  managers work" [ENV]. `archive.ubuntu.com` and `security.ubuntu.com` are on the Trusted list.
- **Which user runs the session's commands isn't stated (unconfirmed).** The setup script runs as
  root, so install into `/opt`, not `~root`.

### 1.4 Setup script and caching

- **Three rules for the script** [ENV]:
  - it must exit 0, or the session fails to start;
  - it must "finish within five minutes";
  - it should run independent installs in parallel with `&` and `wait`.
- **The cache:**
  - After the script's first run, "Anthropic snapshots the filesystem" and later sessions start from
    that snapshot, skipping the script.
  - The snapshot keeps files, not processes. A database the script started isn't running next time.
  - It rebuilds when the script or the allowed hosts change, and after "roughly seven days".
  - Resuming a session never re-runs the script.
- **Order at start:** clone → setup script → network configured → Claude works [WQS].
- **A SessionStart hook runs in both local and cloud sessions**, on every start and resume.
  - Scope it with `CLAUDE_CODE_REMOTE=true` [ENV][ENVV].
  - It can export variables for later Bash commands through `CLAUDE_ENV_FILE` [HK].
  - Hooks run from the repository only in a session with **one** repository [ENV].
- **LibreDWG's build time is a risk.** It takes about 2 minutes on this 24-core machine (brief). On
  4 vCPU it could take 5–8 minutes (unmeasured), which is over budget. **Prebuild it in CI** (§6.4).
  ADR 0023 already says so.

### 1.5 Sessions, concurrency, limits

- **Launching.** Each `claude --cloud "…"` creates an independent session: "they'll all run
  simultaneously". The session clones the current branch **of the GitHub remote**, not the local
  checkout, so push first [WEB].
- **Follow-ups.** `claude -p "msg" --cloud <session-id>` queues a message into a running session
  [WEB].
- **Teleport.** `claude --teleport <id>` pulls a session and its branch into the terminal [WEB].
- **Idle sessions.** An inactive VM is reclaimed. Reopening restores the conversation, but not
  background work such as subagents and shell commands [WEB].
- **Permission modes.** Cloud sessions offer Auto, Accept edits and Plan. They don't offer Manual or
  Bypass [WQS].
- **Concurrency.** No documented cap on cloud sessions for Max accounts (searched the full docs)
  **(unconfirmed)**. The documented limit is the account's shared rate limits [WEB]. Projects have
  a separate cap of 200 new threads a day [PRJ].
- **Session length.** No documented maximum (unconfirmed). A changelog entry fixed losses "in cloud
  sessions running longer than about six hours" [CL].
- **Auto-fix PRs** [WEB]:
  - needs the Claude GitHub App on the repository;
  - reacts to CI failures and review comments;
  - asks when a request is ambiguous;
  - **can't react to merge conflicts**;
  - replies post under the owner's GitHub account;
  - is turned on per PR from the session's CI bar, from the terminal with `/autofix-pr`, or by
    telling the session to watch the PR.
- **Effort.** `CLAUDE_CODE_EFFORT_LEVEL` in the environment **overrides** `/effort` [ENVV]. Don't set
  it there. Keep `effortLevel` in the committed settings, so a ticket can still raise effort.

### 1.6 How the credit is consumed, and what one ticket costs

- **What the primary docs say.** Neither code.claude.com nor support.claude.com mentions the
  cloud-session credit; I searched both on 26 Sep. The primary facts are:
  - cloud sessions share plan rate limits and have no compute charge [WEB];
  - usage credits are "billed at standard API rates" [SUP];
  - once you draw on usage credits, the prompt-cache lifetime "drops to five minutes" from an hour
    [COST].
- **What only secondary reports say** (secondary) [CRD][CRD2][CRD3]:
  - $100 on Pro and $250 on Max, one-time;
  - claimed by 7 Oct and expiring on 4 Nov;
  - "cloud sessions only";
  - "separate from Anthropic's paid usage credits";
  - normal plan limits once it runs out.
- **Not stated anywhere:**
  - whether it is drawn per token at API list price (assumed below);
  - whether it covers ultrareview, routines, Projects, fast mode or `isolation: "remote"`;
  - whether it bypasses the plan's rate limits;
  - whether sessions on it get the 1-hour or the 5-minute cache.
- **Opus 5.5 list prices** per million tokens [PR]: input $4; 5-minute cache write $5; 1-hour write
  $8; cache read $0.20; output $20.
- **The ratio.** Anthropic reports that coding sessions now run an input-to-output ratio of about
  **324:1** [O55B]. So cost is mostly context re-read.
- **One ticket session, estimated:**
  - *80 turns at 90k average context:* 7.2M cache-read ($1.44), about 0.6M written ($3–5) and
    about 40k output ($0.80). That comes to **about $5–7**.
  - *150 turns at 120k:* 18M read ($3.60), 1.2M written ($6–10) and 100k output ($2). That comes to
    **about $12–16**.
  - A `/code-review` pass, reviewer subagents or an auto-fix round add roughly 30–50 %.
  - **Centre: about $10 per ticket** (estimate). Anthropic's enterprise average is "around $13 per
    developer per active day" [COST], which is consistent.
- **Measure in the first three sessions per account:** the balance before and after, and the
  session's `/usage` if the cloud surface shows it.

### 1.7 Two accounts on one private repository

- **Private repositories need the App.** A browser-connected account can use a private repository
  only when **the Claude GitHub App is installed on the account that owns it** [WQS]. The owner
  (`vextrus`) installs it once, on this repository only. Both Claude accounts then see the
  repository if their connected GitHub identity can read it.
- **`/web-setup` is the alternative.** It sends the local `gh` token to the Claude account, and
  sessions reach "any repository that token can access" [WQS]. That is broader than the App's
  per-repository scope. **Prefer the App.**
- **The App's permission set** [GHA-C] is read and write on Actions, Checks, Contents, Discussions,
  Issues, Pull requests, Repository hooks and **Workflows**, plus read on Members, Metadata and
  Statuses. You can't accept a subset.
- **Can two Claude accounts connect the same GitHub user?** Not stated **(unconfirmed)**. Try B with
  `vextrus` first. If it is refused, use a machine account (§0.5).
- **One person running two consumer Max subscriptions** is a question for Anthropic's terms, which I
  did not check **(unconfirmed)**.
- **Running both accounts from one machine:** `CLAUDE_CONFIG_DIR` "is useful for running multiple
  accounts side by side", for example `alias claude-b='CLAUDE_CONFIG_DIR=~/.claude-b claude'`
  [ENVV]. Sign B in once with `claude-b auth login`.

---

## 2. The Workflow tool and Agent isolation

- **What a workflow is.** A JavaScript script whose `agent()`, `pipeline()` and `parallel()` calls
  spawn subagents in the background. Intermediate results stay in script variables [WF].
- **Its limits** [WF][WA]:
  - no mid-run user input;
  - up to 16 concurrent agents (min(16, CPUs − 2); this machine has 24 CPUs);
  - 1,000 agents per run;
  - a "Large workflow" warning above 25 agents or 1.5M projected tokens;
  - it counts toward the plan's usage;
  - resumable in the same session. In a cloud session, results survive VM reclaim.
- **`agent()` options:** `label`, `phase`, `schema`, `model`, `effort`, `agentType` and
  **`isolation: 'worktree'` only** [WA]. The worktree:
  - branches from `origin/<default>` by default (`worktree.baseRef: fresh`);
  - is removed if nothing changed [WT][SA].
- **`.private/` isn't in a worktree** (it's gitignored). Local tickets reach the drawings by absolute
  path. Don't use `.worktreeinclude` for them.
- **Workflow agents cache prompts for 5 minutes by default,** even on a subscription.
  `subagentPromptCacheTtl: "1h"` extends that [WF].
- **The Agent tool's `isolation: "worktree" | "remote"`** [SDK]:
  - `remote` returns `status: "remote_launched"` with a `sessionUrl`: "tasks Claude Code dispatched
    to a cloud session";
  - the Workflow tool itself can return `remote_launched` with `taskType: "remote_agent"`;
  - **no guide page documents when that happens, or which account, environment or billing applies**
    (unconfirmed).
- **Parallel Django test runs collide.** Each local worktree needs its own dependency install and
  **its own test database name**. Django names the test database `test_<NAME>` by default, so
  parallel worktrees sharing Postgres on 5544 collide (inferred). Derive the name from the worktree.
  Cloud sessions each have their own VM, so they don't collide.
- **Concurrent local sessions.** This machine has 24 CPUs and 26 GB of RAM (measured). About 3–4
  local ticket sessions at once is a guess until measured.
- **How a wave is launched:**
  - *Local:* one `Workflow` call, `pipeline(tickets, t => agent(ticketPrompt(t), {isolation:
    'worktree', label: '#' + t.n}))`. Each agent follows docs/sdlc.md step 4 and ends with `gh pr
    create`.
  - *Cloud:* a shell loop of `claude --cloud` (A) and `claude-b --cloud` (B), one per ticket.
  - That keeps "a launcher, not an engine" (docs/sdlc.md): no state of its own; GitHub Issues and PRs
    stay the only work state.
- **The cloud ticket prompt should:**
  - name the issue;
  - tell the session to read it with `gh issue view`;
  - include Opus 5.5's "don't stop early" instruction and the two-continuation stop rule [O55];
  - end with "open a PR that closes #N, then turn on auto-fix for it".
  - Whether a session can turn on auto-fix for its own PR from a prompt is inferred from "tell Claude
    to auto-fix the PR" [WEB] **(unconfirmed)**.

## 3. `/code-review` and ultrareview

- **`/code-review` (bundled)** [CR]:
  - runs locally in the session and counts toward normal usage;
  - depth follows effort: `low`/`medium` report only confident findings; `high`–`max` broaden;
  - `--fix` applies the findings, and `--comment` posts them inline on a PR;
  - reads `CLAUDE.md`, not `REVIEW.md`.
  - **Use:** in every ticket session before its PR.
- **Ultrareview (`/code-review ultra`)** [UR]:
  - a research preview that runs as a **cloud session**;
  - a fleet of reviewers, and "every reported finding is independently reproduced and verified";
  - takes 5–10 minutes;
  - is limited to 500 changed files and 8,000 changed lines;
  - **cost:** 3 free runs per Max account, one-time (**6 across A and B**), then "typically $5 to
    $25 in usage credits". It needs usage credits turned on, and a stopped run still uses a free
    run.
  - PR mode (`/code-review ultra 123`) clones the PR with the account's connected GitHub identity,
    which must be able to read the private repository.
  - `claude ultrareview 123 --post` posts one plain PR comment as you. The comment isn't an approval.
  - **Use:** on PRs that touch money, geometry or the data spine, and on each milestone's last PR.
- **Managed Code Review** (automatic inline PR reviews) is **Team and Enterprise only**, at about
  $15–25 a review [CR]. It isn't available on Max. A private repository makes no difference; the
  plan does.

## 4. GitHub on a private repository

| | Free (personal, today) | Pro (personal) | Team (organization) |
|---|---|---|---|
| Protected branches, rulesets, required reviewers, code owners on private repos | **No** [GHPB][GHRS][GHP]. Measured on 26 Sep: HTTP 403 | Yes [GHPB][GHRS][GHP] | Yes [GHPB][GHRS]; push rulesets Team only [GHRS] |
| Actions minutes (standard runners, private repos) | 2,000 a month | 3,000 | 3,000 [GHAB] |
| Artifact storage / cache per repo | 500 MB / 10 GB | 1 GB / 10 GB | 2 GB / 10 GB [GHAB] |
| Price | $0 | $4 a month (search result; **unconfirmed**) | $4 per user a month [GHPR] |

- **Overage and extras** [GHRP][GHAB]:
  - Linux 2-core costs $0.006 a minute, and the 4-core larger runner $0.012;
  - artifacts cost $0.25 per GB-month;
  - GitHub-hosted runners are free only in public repositories.
- **Estimate of our CI use:**
  - 6 minutes a run, and about 3 runs per PR with auto-fix pushes: about 18 minutes per PR;
  - 2,000 minutes then covers about 110 PRs a month;
  - overage of 1,000 minutes costs $6.
  - **Minutes are not a constraint.**
- **Artifact or release asset for LibreDWG?**
  - Artifacts are kept 90 days by default (1–400 for private repositories) and count against storage
    [GHRET].
  - A release asset must be under 2 GiB, and there is "no limit on the total size of a release, nor
    bandwidth usage" [GHREL].
  - Cloud sessions can fetch release assets only from attached repositories [ENV].
  - **Use a release asset in our own repository, rebuilt when the pinned version changes.**
  - CI jobs download the same asset, or cache it with `actions/cache`.
- **Self-hosted runners** [GHSR][GHSEC]:
  - **Price.** They are "free to use with GitHub Actions" per the docs. The $0.002-a-minute platform
    charge announced for March 2026 was postponed [GHCL]. I found no later notice (unconfirmed).
  - **Security.** GitHub warns that they "can be persistently compromised by untrusted code in a
    workflow", with no clean VM per job. On a private repository, anyone who can open a PR can reach
    the runner's secrets.
  - **For us:** Claude writes our workflows, and the App holds Workflows: write. A runner on the
    owner's WSL machine would run Claude-written code next to `.private/` and `~/.bashrc`. **Don't.**
    If one is ever needed, use an ephemeral VM elsewhere.
- **Why no required approval:** the owner can't approve PRs authored under his own identity [GHAPR]
  (§0.5).

## 5. Other things that bear on "as fast as possible, at any cost, verified"

1. **Review throughput is the bottleneck.** Anthropic's playbook: start with 2–3 sessions and scale
   "only while review keeps up" (baseline [PB]). Everything that shortens the owner's review speeds
   the build:
   - the PR body format;
   - small, disjoint tickets;
   - screenshots for UI;
   - ultrareview on the risky PRs.
2. **Fast mode** makes Opus 5.5 "up to 2.5x faster" [FM]:
   - it is billed **only from usage credits**, at twice list price;
   - "enabling fast mode from the start is cheaper" [FM].
   - **Use it only on a critical-path ticket that blocks the next wave.** Speed elsewhere doesn't
     shorten the milestone.
3. **Merge conflicts are the hidden tax.** Auto-fix can't see them [WEB]:
   - merge in dependency order;
   - one migration-bearing ticket per Django app per wave;
   - rebase open sessions after each merge.
4. **Keep the check out of the agent's reach.** The App can edit workflows [GHA-C]. The owner reads
   every diff to `.github/` and `.claude/` (§0.4).
5. **Self-hosted cloud environments** would let cloud sessions run on our own hardware, and so near
   the drawings. They are **Team and Enterprise only** (public beta) [SH]. That rules them out on
   Max.
6. **Routines and Projects:**
   - Routines trigger on PR and release events, but not on issues [RT];
   - both are reportedly outside the credit (secondary);
   - neither is needed to launch waves.
7. **Test TypeSafe cheaply.** Tests use recorded Jev answers by default (ADR 0013). Live tests run
   only when marked, so cloud tickets spend nothing on TypeSafe unless asked.

---

## 6. The draft cloud environment (identical on A and B)

### 6.1 Environment settings

- **Name:** `vextrus`.
- **Network access:** **Custom**, with "Also include default list of common package managers"
  checked, and these allowed domains:
  ```text
  releases.astral.sh
  ftp.gnu.org
  ```
  `ftp.gnu.org` is only the fallback for building LibreDWG from source.
- **Environment variables** (no secrets; anyone using the environment can read them):
  ```text
  UV_PYTHON_INSTALL_DIR=/opt/uv-python
  UV_PYTHON_PREFERENCE=only-managed
  DATABASE_URL=postgres://vextrus:vextrus@127.0.0.1:5432/vextrus
  LIBREDWG_PREFIX=/opt/libredwg
  TYPESAFE_API_KEY=proxy-injected
  ```
  - `DATABASE_URL`'s password is a throwaway for the in-VM database only.
  - `TYPESAFE_API_KEY` is a placeholder, so code that requires the variable runs; the real key is
    the API credential below.
  - Don't set `CLAUDE_CODE_EFFORT_LEVEL` (§1.5).

### 6.2 Where the owner pastes the TypeSafe cloud key (never in the repo, a chat or an env var)

1. The owner creates a **separate cloud key** at TypeSafe (ADR 0013), with a spending limit if
   TypeSafe offers one. Ideally use one key per account, so each can be revoked alone.
2. Go to claude.ai/code, signed in as **A**.
3. Click the cloud icon above the message box.
4. Hover **vextrus** and click the gear to open **Update cloud environment**.
5. Scroll to **API credentials** and click **Add credential**. Fill it in [ENV]:
   - **Credential type:** Bearer;
   - **Name:** `TypeSafe cloud (Vextrus dev)`;
   - **Allowed websites:** `api.typesafe.ai`;
   - **Custom headers:** Name `Authorization`, Prefix `Bearer`, **Value: paste the key here**.
   - TypeSafe's endpoint is `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer
     <API_KEY>` [TS].
6. Click **Connect**. The key can't be viewed again.
7. Repeat signed in as **B**.
8. **Test it in the first session:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.typesafe.ai/v1/systemone \
     -H 'Content-Type: application/json' -d '{}'
   ```
   - **422** (validation error) means the key was attached;
   - **401** means it wasn't [TS].
   - Also test once with the code's own client. It sends `Authorization: Bearer proxy-injected`, and
     whether the proxy *replaces* an existing header isn't stated **(unconfirmed)**. If it doesn't,
     the client must omit the header when `TYPESAFE_API_KEY=proxy-injected`.
9. **Rotate the key** when the execution phase ends (ADR 0013).

### 6.3 Setup script (paste into the environment's **Setup script** box)

Keep the canonical copy in the repo (for example `scripts/cloud/setup.sh`) and paste it into both
accounts. It is a draft and **has not been run in a cloud VM**. Everything in it marked "(test)" is
unverified.

```bash
#!/bin/bash
# Vextrus cloud environment setup. Runs as root on Ubuntu 24.04 x86_64 before Claude Code starts.
# Its filesystem result is cached for ~7 days. Must exit 0 and finish in < ~5 min. No secrets here.
# Network: Custom = defaults + releases.astral.sh + ftp.gnu.org.
set -uo pipefail
STATUS=/opt/vextrus-setup.status
mkdir -p /opt && : > "$STATUS"
note() { echo "[vextrus-setup] $*"; echo "$*" >> "$STATUS"; }

PY_VERSION=3.13
NODE_MAJOR=24
LIBREDWG_VERSION=0.14
LIBREDWG_PREFIX=/opt/libredwg
REPO=vextrus/vextrus-cubit
LIBREDWG_TAG="toolchain-libredwg-${LIBREDWG_VERSION}"
LIBREDWG_ASSET="libredwg-${LIBREDWG_VERSION}-ubuntu24.04-x86_64.tar.gz"
export UV_PYTHON_INSTALL_DIR=/opt/uv-python   # outside ~root, so any session user can read it

install_python() {                       # uv is preinstalled; upgrade from PyPI if it is too old (test)
  uv python find "$PY_VERSION" >/dev/null 2>&1 && return 0
  uv python install "$PY_VERSION" && return 0
  python3 -m pip install -q --break-system-packages --upgrade uv && uv python install "$PY_VERSION"
}

install_node() {                         # nodejs.org is on the Trusted list
  local v
  v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c \
      "import sys,json; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v${NODE_MAJOR}.')))") || return 1
  curl -fsSL "https://nodejs.org/dist/${v}/node-${v}-linux-x64.tar.xz" -o /tmp/node.tar.xz || return 1
  rm -rf /opt/node${NODE_MAJOR} && mkdir -p /opt/node${NODE_MAJOR} &&
    tar -xJf /tmp/node.tar.xz -C /opt/node${NODE_MAJOR} --strip-components=1
}

prepare_postgres() {                     # PostgreSQL 16 is preinstalled, not running
  service postgresql start || return 1
  su postgres -c "psql -v ON_ERROR_STOP=1 -q" <<'SQL' || return 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus') THEN
    CREATE ROLE vextrus LOGIN CREATEDB PASSWORD 'vextrus';   -- throwaway, VM-local only
  END IF;
END $$;
SQL
  su postgres -c "createdb -O vextrus vextrus" 2>/dev/null || true
  su postgres -c "psql -q -d vextrus -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'" || true
  # pgvector later: apt-get install -y postgresql-16-pgvector gives 0.6.0 (docs/research/stack-data.md)
  service postgresql stop                # the snapshot keeps files, not processes
}

install_libredwg() {                     # 1st: our prebuilt release asset; 2nd: build from source
  [ -x "$LIBREDWG_PREFIX/bin/dwg2dxf" ] && return 0
  if gh release download "$LIBREDWG_TAG" -R "$REPO" -p "$LIBREDWG_ASSET" -D /tmp --clobber 2>/dev/null; then
    tar -xzf "/tmp/$LIBREDWG_ASSET" -C / && return 0      # GitHub proxy auth in setup scripts: (test)
  fi
  note "libredwg: release asset unavailable, building from source (may exceed the time budget)"
  cd /tmp && curl -fsSLO "https://ftp.gnu.org/gnu/libredwg/libredwg-${LIBREDWG_VERSION}.tar.xz" &&
    tar -xJf "libredwg-${LIBREDWG_VERSION}.tar.xz" && cd "libredwg-${LIBREDWG_VERSION}" &&
    ./configure -q --prefix="$LIBREDWG_PREFIX" --disable-shared --disable-bindings --disable-docs &&
    make -s -j"$(nproc)" && make -s install
}

install_python   & p1=$!
install_node     & p2=$!
prepare_postgres & p3=$!
install_libredwg & p4=$!
wait $p1 && note "python ${PY_VERSION}: ok" || note "python ${PY_VERSION}: FAILED"
wait $p2 && note "node ${NODE_MAJOR}: ok"   || note "node ${NODE_MAJOR}: FAILED"
wait $p3 && note "postgres: ok"             || note "postgres: FAILED"
wait $p4 && note "libredwg ${LIBREDWG_VERSION}: ok" || note "libredwg ${LIBREDWG_VERSION}: FAILED"
exit 0   # never block the session; the SessionStart hook prints $STATUS so failures are visible
```

A failed install isn't hidden. The next section's hook prints the status file at the start of every
session.

### 6.4 The repo side (a harness change: needs an owner-approved issue per docs/sdlc.md)

**The SessionStart hook for cloud sessions** (a draft; add it to `.claude/settings.json` beside
`state.mjs`):

```bash
#!/bin/bash
# scripts/cloud/session-start.sh: per-session start in cloud VMs only; local sessions exit at once.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
{ echo 'export PATH=/opt/node24/bin:/opt/libredwg/bin:$PATH'
  echo 'export UV_PYTHON_INSTALL_DIR=/opt/uv-python'; } >> "$CLAUDE_ENV_FILE"
service postgresql start >/dev/null 2>&1 || echo "WARN: postgres did not start"
if [ ! -x /opt/libredwg/bin/dwg2dxf ]; then           # GitHub proxy is live by now
  gh release download toolchain-libredwg-0.14 -R vextrus/vextrus-cubit \
     -p 'libredwg-0.14-ubuntu24.04-x86_64.tar.gz' -D /tmp --clobber &&
  tar -xzf /tmp/libredwg-0.14-ubuntu24.04-x86_64.tar.gz -C / || echo "WARN: LibreDWG missing"
fi
cd "$CLAUDE_PROJECT_DIR" && [ -f uv.lock ] && uv sync --frozen -q || true
cat /opt/vextrus-setup.status 2>/dev/null
exit 0
```

**The CI workflow that publishes LibreDWG** (a sketch; the same Ubuntu 24.04 x86_64 as the cloud
VM):

```yaml
# .github/workflows/toolchain-libredwg.yml
name: toolchain-libredwg
on:
  workflow_dispatch:
  push: { branches: [main], paths: ['toolchain/libredwg.version'] }
permissions: { contents: write }
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - name: Build static LibreDWG and publish it as a release asset
        env: { GH_TOKEN: '${{ github.token }}', V: '0.14' }
        run: |
          curl -fsSLO https://ftp.gnu.org/gnu/libredwg/libredwg-$V.tar.xz
          # TODO: verify libredwg-$V.tar.xz.sig against the GNU keyring and pin its sha256
          tar -xJf libredwg-$V.tar.xz && cd libredwg-$V
          ./configure --prefix=/opt/libredwg --disable-shared --disable-bindings --disable-docs
          make -j"$(nproc)" && sudo make install && cd ..
          tar -C / -czf libredwg-$V-ubuntu24.04-x86_64.tar.gz opt/libredwg
          gh release view toolchain-libredwg-$V -R "$GITHUB_REPOSITORY" >/dev/null 2>&1 \
            || gh release create toolchain-libredwg-$V -R "$GITHUB_REPOSITORY" --prerelease \
                 --title "Toolchain: LibreDWG $V" --notes "Static build for CI and cloud sessions"
          gh release upload toolchain-libredwg-$V libredwg-$V-ubuntu24.04-x86_64.tar.gz \
            -R "$GITHUB_REPOSITORY" --clobber
```

- `--disable-shared` gives self-contained binaries under one prefix. The configure flags come from
  LibreDWG's README [LDWG].
- LibreDWG 0.14's source is at `ftp.gnu.org/gnu/libredwg/` and on its GitHub release of 27 Jun 2026
  [LDWG].
- Whether a static build keeps every tool we use (`dwg2dxf`, `dwgread`) needs one check in CI.

### 6.5 First-session checklist (run once on each account before wave 1)

**Superseded (28 Sep 2026).** This checklist predates the stack's revision (ADR 0034, session 02 Q18)
and names Python 3.13. The cloud runs used a revised checklist: Python 3.14.7 exactly, PostgreSQL 18,
the toolchain under `/opt/vextrus`, each environment built by `scripts/cloud/setup.sh`. Its runs and
answers are recorded in the M0 milestone issue, #45 (environment B's run 5 and A's run 1 passed). The
list below is kept as first written.

1. `check-tools`, `psql --version` and `uv python find 3.13`. Is `node -v` v24?
2. `cat /opt/vextrus-setup.status`: every line is `ok`.
3. `dwg2dxf --version` reports 0.14.
4. The TypeSafe test in §6.2 returns 422.
5. `uv sync` and the empty test suite pass against `DATABASE_URL`.
6. The session opens a PR, and auto-fix is on.
7. The credit balance before and after is recorded.
8. How long the setup took. The first run must stay under about 5 minutes.

---

## 7. What changed from, or was wrong in, `sdlc-claude-code.md`

1. **The credit is $500 across two accounts, not $250.** The claim deadline and 4 November expiry
   still rest only on secondary sources. None of Anthropic's pages states them.
2. **Keys now have a proper home.** On Pro and Max, API credentials hold keys the session can't see
   [ENV]. The baseline's "environment variables … so no secrets" is still true, but the TypeSafe key
   now belongs in an API credential. ADR 0013's "pastes it into the cloud environment's settings"
   should say so.
3. **The repository is private.** Actions is no longer free: 2,000 minutes a month [GHAB]. Branch
   protection isn't available on Free for private repositories (403 measured; [GHPB]). The
   baseline's gate "(e) … Branch protection" can't be met without Pro or Team.
4. **The Workflow tool can't fan work out to cloud sessions.** `agent()` isolation is worktree only
   [WA]. docs/sdlc.md's "each in its own worktree or cloud session" needs `claude --cloud` for the
   cloud half.
5. **`uv python install` and a LibreDWG download probably fail under Trusted** (§1.2). The baseline
   listed this as open question 2. Its likely answer is Custom with `releases.astral.sh`, plus a
   release asset in our own repository.
6. **Node 24 isn't preinstalled** (20–22 only) [ENV].
7. **Cloud sessions offer Auto, Accept edits and Plan,** not Manual or Bypass [WQS].
8. **Drawing on usage credits shortens the prompt cache** from 1 hour to 5 minutes [COST]. That raises
   the cost of ultrareview and fast-mode work.
9. **Self-hosted cloud environments exist, but only on Team and Enterprise** [SH]. The self-hosted
   Actions runner charge was postponed [GHCL].

## 8. Unknowns (each to settle by a test or by asking Anthropic)

1. **The credit's terms:**
   - the rate it is drawn at;
   - whether it is used before plan limits, and whether it bypasses rate limits;
   - whether it covers ultrareview, fast mode, routines, Projects or `isolation: "remote"`;
   - which cache TTL applies;
   - the exact expiry date.
   Check `claude.ai/settings/usage` on both accounts.
2. **Cloud-session concurrency** per Max account, and any maximum session length.
3. **Whether two Claude accounts may connect the same GitHub user,** and whether one person may run
   two Max subscriptions under Anthropic's consumer terms.
4. **What `isolation: "remote"` on the Agent tool does,** and on which account and environment.
5. **In the setup script:**
   - whether `gh release download` from our private repository works there (GitHub proxy auth);
   - whether uv reaches `releases.astral.sh`;
   - which Python 3.x is preinstalled;
   - which user runs session commands;
   - LibreDWG's build time on 4 vCPU.
6. **Whether the agent proxy replaces an `Authorization` header the client already sends** (§6.2).
7. **Whether a cloud session can turn on auto-fix for its own PR** from the ticket prompt.
8. **GitHub Pro's current price.** $4 a month comes from search results only.
9. **Whether Chrome for the `chrome-devtools` MCP runs in the cloud VM** (needed if the UI design
   gate runs in cloud sessions). Chrome for Testing downloads from `storage.googleapis.com`, which is
   on the Trusted list, but this was not tested.
10. **All cost figures** (§1.6, §4) are estimates until wave 1 is measured.

## Sources (all accessed 2026-09-26)

Anthropic (primary):
- [ENV] Configure cloud environments, https://code.claude.com/docs/en/cloud-environments
- [WEB] Use Claude Code in the cloud, https://code.claude.com/docs/en/claude-code-on-the-web
- [WQS] Cloud sessions quickstart, https://code.claude.com/docs/en/web-quickstart
- [WF] Dynamic workflows, https://code.claude.com/docs/en/workflows
- [WA] The bundled `/workflow-authoring` skill's script reference (Claude Code v2.1.283, read locally)
- [SDK] Agent SDK TypeScript reference (`AgentInput`, `AgentOutput`, `WorkflowOutput`), https://code.claude.com/docs/en/agent-sdk/typescript
- [SA] Subagents, https://code.claude.com/docs/en/sub-agents
- [WT] Worktrees, https://code.claude.com/docs/en/worktrees
- [AV] Agent view, https://code.claude.com/docs/en/agent-view
- [UR] Ultrareview, https://code.claude.com/docs/en/ultrareview
- [CR] Code Review (and "Review a diff locally"), https://code.claude.com/docs/en/code-review
- [GHA-C] Claude Code GitHub Actions: GitHub App permissions, https://code.claude.com/docs/en/github-actions
- [COST] Manage costs, https://code.claude.com/docs/en/costs
- [FM] Fast mode, https://code.claude.com/docs/en/fast-mode
- [ENVV] Environment variables (`CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_EFFORT_LEVEL`), https://code.claude.com/docs/en/env-vars
- [HK] Hooks (`CLAUDE_ENV_FILE`), https://code.claude.com/docs/en/hooks
- [RT] Routines, https://code.claude.com/docs/en/routines
- [PRJ] Projects, https://code.claude.com/docs/en/claude-projects
- [SH] Self-hosted environments, https://code.claude.com/docs/en/self-hosted-environments
- [CL] Claude Code changelog, https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- [PR] Pricing, https://platform.claude.com/docs/en/about-claude/pricing
- [O55] Prompting Claude Opus 5.5, https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 (via baseline)
- [O55B] "Coding sessions are longer and use more context", https://claude.com/blog/claude-opus-5-5-built-for-coding-sessions-that-use-more-context (24 Sep 2026)
- [SUP] Manage usage credits for paid Claude plans, https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans

GitHub (primary):
- [GHP] GitHub's plans, https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- [GHPB] About protected branches, https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- [GHRS] About rulesets, https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- [GHAB] GitHub Actions billing, https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [GHRP] Actions runner pricing, https://docs.github.com/en/billing/reference/actions-runner-pricing
- [GHRET] Actions settings for a repository (retention), https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- [GHREL] About releases, https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- [GHSR] Self-hosted runners, https://docs.github.com/en/actions/concepts/runners/self-hosted-runners
- [GHSEC] Secure use reference, https://docs.github.com/en/actions/reference/security/secure-use
- [GHAPR] Approving a pull request with required reviews, https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews
- [GHTOS] GitHub Terms of Service (machine accounts), https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- [GHPR] GitHub pricing, https://github.com/pricing
- [GHCL] "Update to GitHub Actions pricing" (the self-hosted charge postponed), https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/ (seen through search results; page not fetched)

Other (primary for their own facts):
- [UV] uv environment variables (`UV_ASTRAL_MIRROR_URL`, `UV_PYTHON_INSTALL_MIRROR`), https://docs.astral.sh/uv/reference/environment/
- [LDWG] LibreDWG README (configure flags) and releases, https://raw.githubusercontent.com/LibreDWG/libredwg/0.14/README ; https://ftp.gnu.org/gnu/libredwg/ ; https://api.github.com/repos/LibreDWG/libredwg/releases/latest
- [TS] TypeSafe API, https://docs.typesafe.ai/api

Secondary (the credit):
- [CRD] windowsforum.com, "Claude Code Cloud Sessions Go GA; $100/$250 Credits Due Oct. 7", https://windowsforum.com/news/claude-code-cloud-sessions-go-ga-100-250-credits-due-oct-7.446024/ (via search summary)
- [CRD2] explainx.ai, https://explainx.ai/blog/claude-code-cloud-sessions-ga-100-250-credit-claim-credit-2026 ; KuCoin, https://www.kucoin.com/news/flash/anthropic-offers-cloud-credits-to-claude-code-pro-and-max-users
- [CRD3] SmartScope, https://smartscope.blog/en/blog/claude-code-cloud-sessions-credit-2026/ (says most terms are unconfirmed)
- ClaudeDevs on X, https://x.com/ClaudeDevs/status/2102871550974427462 (quoted by search results)

Local:
- `gh api repos/vextrus/vextrus-cubit` (owner type User, private), 26 Sep
- `nproc` / `free -g`: 24 CPUs, 26 GB of RAM
- docs/sdlc.md, ADR 0013, 0023, 0024, 0025, docs/research/sdlc-claude-code.md, docs/research/stack-data.md, docs/research/jev-system-one.md, docs/handoff/session-01-prompt.md
