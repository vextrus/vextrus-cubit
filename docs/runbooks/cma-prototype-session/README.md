# The Managed Agents prototype session: the owner's runbook

One long Claude Managed Agents session on the Claude Platform, paid from the $200 API credit, that
dissects the Edison set, builds the final Vextrus prototype (a 3D Live Model read from the real drawings,
filed like the Claude Design G+9 model) and writes the final single spec. You run it from the main
checkout on your machine, because the drawings live there under `.private/`.

Sources: the Managed Agents docs on platform.claude.com (overview, environments, cloud sandbox
reference, files, outcomes, multiagent orchestration, `ant apply`), read 15 Oct 2026. Prices are list
prices from the same date.

**What I could not test.** This kit was written in a cloud session with no `ant` CLI, no Anthropic key
and no drawings. `cma.sh` was run only against a stub `ant`, which showed that the session body and the
outcome events it builds parse as intended. The first real call is `cma.sh smoke` (step 6). Run it before
the real session.

## How the session works

```
            you (cma.sh, ant CLI)                    Anthropic
  .private/reference/edison ─prepare─▶ DXF ─upload─▶ Files API (30-day expiry)
                                                         │ mounted read-only
  agents/*.md + environments/*.yaml ─ant apply─▶ 5 agents + 1 environment
                                                         │
  launch ─▶ ONE session ─ container: Ubuntu 24.04, 8 GB RAM, 10 GB disk, Chromium
               │  /workspace/vextrus-cubit (main, read-only token)
               │  /mnt/session/uploads/{edison,claude-design}
               ▼
        Vextrus Prototype Lead (Opus 5.5, xhigh) ── plans, synthesises, builds
          ├─ Drawing dissector ×N (Opus 5.5, high): one Discipline each, in parallel
          ├─ QS critic (Opus 5.5, high): quantities, Priced BOQ, flows
          ├─ Adversary (Sonnet 5.5, high): refutes claims before an outcome ends
          ├─ BIM researcher (Sonnet 5.5, medium): web research with sources
          └─ copies of the Lead: one large build piece each
               │
        outcome 1 (dissect) ─▶ outcome 2 (prototype) ─▶ outcome 3 (spec)
        each graded by an independent grader against its rubric (outcomes/*.rubric.md),
        revised until it passes or runs out of iterations
               ▼
  /mnt/session/outputs/{public,private}/ + CHECKPOINT.md + outputs.tar.gz ─fetch─▶ .private/work/cma/
```

Why this shape:
- **One session, three chained outcomes.** An outcome is a task with a rubric. A separate grader, with
  its own context, scores each pass and sends the gaps back, so the work doesn't stop at a first draft.
  You can run only one outcome at a time, so you send the next one when the previous one ends. The
  session keeps its history, files and container across all three.
- **A coordinator with a fixed set of helper agents, no dynamic workflows.** The work splits into fewer
  than 25 pieces: one Discipline per dissector, plus the critics. Dynamic workflows spawn many agents in
  phases and make cost hard to predict. They are off: the `coordinator` type has no workflows.
- **Models follow CLAUDE.md's roles:** Opus 5.5 `high` for drawings and the QS critic, Sonnet 5.5 for the
  adversary and look-ups. **One exception, which is yours to accept:** the Lead runs at `xhigh`. CLAUDE.md
  says the orchestrator never runs at `xhigh`, but that rule is for the factory's sessions. You asked this
  one to think hardest. To follow the rule instead, change `effort: xhigh` to `high` in
  `agents/vextrus-lead/agent.md` before `apply`; that roughly halves the Lead's thinking cost.
- **Unrestricted network, with nothing in the sandbox worth stealing.** The research needs sites no one
  can list in advance. Anthropic's git proxy injects the GitHub token, so it never enters the sandbox,
  and the token is read-only anyway. No other secret goes in. Every tool's permission policy is `auto`:
  the server checks each call, and you never have to approve one by hand.
- **No pushing.** The session cannot push, and you do not want it to: the repository is public, and the
  prototype carries Edison's geometry. Its results come back as files. You and the factory bring the
  `public/` part into the repository later through the normal review loop.

## Before you start: two things only you can decide

1. **Drawings to Anthropic's Files API.** ADR 0013 covers TypeSafe. Your ruling of 4 Oct (Q7) lets cloud
   sessions read the two Development Sets. This route is new: the Edison DWGs and DXFs are uploaded to
   the Claude Platform workspace, where they expire after 30 days, and you delete them after the
   session (step 10). Record it as one line in ADR 0013's history, or say no. Only the Edison set goes:
   never a Held-out Set, a client's set, or the Hand Takeoff.
2. **The Lead's effort** (above): `xhigh` as shipped, or `high`.

The naming question ("BIM Live Model" against intent.md's "it is not called BIM") goes to the session
as your proposal. It comes back as an ADR proposal for you to rule on.

## Budget plan ($200 credit)

What a session costs, at list price: model tokens (Opus 5.5 at $4 per million input tokens, $20 per
million output, $0.20 per million cached input read; Sonnet 5.5 at $2 / $10), web searches at $10 per
1,000, and $0.08 per hour of running time. The session's budget is a hard cap on all of it. When the
session reaches the cap, it pauses (it doesn't stop) and keeps its history and container. Raising the
cap resumes the work. `cma.sh` uses the cap as a gate between phases, so no single phase can spend the
whole credit:

| Step | Cap after the step | Spend (estimate) |
|---|---|---|
| Smoke check | $4 (its own session) | $1-3 |
| Launch, outcome 1 (dissect) | $70 (`launch` sets it) | $40-70 |
| Outcome 2 (prototype) | `cma.sh budget 14000` | +$50-70 |
| Outcome 3 (spec) | `cma.sh budget 18500` | +$30-45 |
| Slack for a last fix round | `cma.sh budget 19000` at most | |

These figures are estimates, not measurements. Read `cma.sh status` (its `list_cost`) at each gate and
adjust. If outcome 1 costs more than $70, cut scope before outcome 2: lower its `max_iterations` from 5
to 3 in `outcomes/2-prototype.event.yaml`, or set the Lead to `high`. Also set a spend limit on the
workspace in the Console (Settings, Limits) if your organisation has one. That is a second stop beneath
the session cap.

## Steps

0. **Workspace and key.** In the Console (platform.claude.com), create a workspace `vextrus-cma` with
   its own API key. Uploaded files are visible to the whole workspace, so a workspace of its own keeps
   the drawings away from other keys. Put the key in `~/.bashrc` as `ANTHROPIC_API_KEY`, the same way
   `TYPESAFE_API_KEY` is kept there, and never in the repository or a chat. Copy the workspace's ID from
   the Console's URL bar into `CMA_WORKSPACE`, so the printed session links open.
1. **The CLI.** Install `ant` 1.30 or later from github.com/anthropics/anthropic-cli/releases (the Linux
   amd64 build, for WSL). Check it with `ant --version`. `jq` and `curl` are already on the machine.
2. **A read-only GitHub token.** On GitHub, go to Settings, Developer settings, Fine-grained tokens.
   Create one for the repository `vextrus/vextrus-cubit` only, with **Contents: Read** and nothing else,
   expiring in 30 days. Export it as `GITHUB_TOKEN_RO` in the shell you run `cma.sh` from.
3. **Prepare the inputs** (local, nothing leaves the machine):
   ```sh
   docs/runbooks/cma-prototype-session/cma.sh check
   docs/runbooks/cma-prototype-session/cma.sh prepare "/path/to/Live Model G+9 v2.html"
   ```
   `prepare` converts every DWG under `.private/reference/edison/` to DXF with LibreDWG 0.14. It writes
   each DXF's size to `.private/work/cma/dxf.tsv` and packs two archives. Open `dxf.tsv`: a FAILED line,
   or a DXF far smaller than its neighbours, is a thin conversion (2d-to-bim-prototype-lessons.md).
   Re-run that file by hand, or let the session re-read the DWG.
4. **Upload:** `cma.sh upload`. It uploads three files, each expiring in 30 days, and writes their IDs
   to `.private/work/cma/files.env`.
5. **Create the agents and the environment:** `cma.sh apply` prints the plan and changes nothing. Read
   the plan, then run `cma.sh apply --yes`. This writes `claude-lock.json` beside this README. It holds
   resource IDs only, so commit it, with an explicit path. Want to change a prompt later? Edit the
   agent's file and re-run `cma.sh apply --yes`. Each run makes a new agent version. A running session
   keeps the version it started with.
6. **Smoke check** (about $1-3): `cma.sh smoke`, then `cma.sh watch smoke`. It checks the mounts, the
   DXF entity counts, a WebGL screenshot of the Claude Design model in headless Chromium, and the disk
   and memory. Then fetch what it wrote (`cma.sh fetch smoke`) and look at the design screenshot. Fix
   whatever failed before going on.
   **What the first smoke check found (15 Oct), and what changed:** the system `python3` couldn't import
   the environment's pip packages, so the Lead now makes its own venv with uv as its first step.
   WebGL in software takes about 80 s per screenshot, so the prompt now sets waits and a one-frame
   `?shot` mode. The DWG archive also carries the consultant's plotted PDFs for Architecture and
   Structural, and the agents now use them to check renders. three.js is pinned to 0.184.0, the
   version the Claude Design model loads. `fetch` no longer pipes into `ant files download`, and it
   skips the session's copies of your uploads. The sandbox reported 15 GiB of memory and 29 GB of free
   disk, more than the documented minimum. To pick up these changes: `git pull`, then
   `cma.sh apply --yes` (a new agent version and an updated environment), then `cma.sh fetch smoke`. A
   second smoke check is optional.
7. **Launch:** `cma.sh launch`. One call creates the session with its mounts and its $70 cap, and sends
   your kickoff message (`kickoff.md`, in your words) followed by outcome 1. It prints the session's
   Console link.
8. **Watch and steer:** `cma.sh watch` opens the Console's session viewer from a local server; it
   follows every thread. To watch in a terminal and type to the Lead, run
   `ant beta:sessions connect "$(cat .private/work/cma/session.sid)"`. Enter sends a message to the
   Lead. **Esc interrupts, and an interrupt ends the current outcome as `interrupted`.** Use it only to
   stop. To redirect, type a message instead. `cma.sh status` shows the state, the cost so far and
   each outcome's result.
9. **The next outcomes.** When `status` shows outcome 1's result (`satisfied`, or
   `max_iterations_reached`) and the session is `idle`:
   ```sh
   cma.sh fetch                 # read CHECKPOINT.md and the outcome 1 reports first
   cma.sh budget 14000
   cma.sh outcome 2
   ```
   Do the same for outcome 3 with `cma.sh budget 18500` and `cma.sh outcome 3`. A `failed` result means
   the grader found the rubric and the task in contradiction. Read its explanation, fix the rubric file,
   and send the outcome again.
10. **Bring it home.** Run `cma.sh fetch` once more. It writes everything to
    `.private/work/cma/outputs/<session>/` and unpacks `outputs.tar.gz` into `tree/`. Then delete the
    three uploads in the Console's Files page, or with `ant files delete --file-id <id>` and the IDs in
    `files.env`. Leave the session itself alone: it stays readable in the Console, and deleting it is a
    separate decision.

## What comes back, and where it goes

| Path in the outputs | Holds | Goes |
|---|---|---|
| `private/01-dissect/` | per-Discipline reports, the Element inventory with Traces | `.private/work/cma/` only |
| `private/02-prototype/` | the prototype built on Edison, its screenshots | `.private/work/cma/` only (it carries Edison geometry) |
| `public/01-dissect/` | the engine's gaps and the conventions, stated generically | the repository, after a review that no drawing content leaked |
| `public/02-prototype/` | the generator code and its synthetic fixture | the repository, as a factory ticket with tests |
| `public/03-spec/` | `VEXTRUS-SPEC.md`, diagrams, ADR proposals, glossary delta, M1 delta, owner questions | the repository, after your rulings on the proposals and questions |
| `CHECKPOINT.md`, `outputs.tar.gz` | the session's own record | `.private/work/cma/` |

Nothing comes back merged. The spec and the M1 delta are proposals until you rule on them. After that,
they replace or amend `docs/specs/M1.md`, `docs/milestones.md` and the ADRs the normal way, as a session
brief.

## If something goes wrong

- **`apply` rejects a roster path:** the coordinator's roster names the other agents by file path, and
  `ant apply` fills in their IDs. If your `ant` version doesn't, apply the four helper agents first, then
  put their `agent_...` IDs from `claude-lock.json` in the Lead's `multiagent.agents` list.
- **A literal `@./kickoff.md` appears as the first message:** your `ant` did not inline the file. Paste
  the file's text in place of the `@./...` strings in `cma.sh`, which are the kickoff line in `launch`
  and the rubric line in each `outcomes/*.event.yaml`.
- **The session paused:** `status` shows `stop_reason` `budget_reached`. Raise the cap with
  `cma.sh budget <cents>`. The new cap must be above the cost reported so far.
- **Mermaid's renderer can't find a browser:** the Lead can render the diagrams with the pre-installed
  Playwright Chromium instead. Tell it so in a message.
- **A thread looks stuck:** watch it in `cma.sh watch` before you act. Message the Lead rather than
  interrupting, because an interrupt ends the outcome.
