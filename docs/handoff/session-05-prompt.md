# Session 05: M0 wave 3

## Starting the session (the owner)
In a terminal, **not** the Desktop app, from the main checkout on `main`, pulled:

```bash
cd ~/vextrus-cubit && git switch main && git pull --ff-only
```

```bash
CLAUDE_CONFIG_DIR=~/.claude-b claude --model claude-opus-5-5 --effort xhigh
```

Account B is the vextrus.com login; the CLI's default config is not signed in. Check `/status` shows Opus 5.5
at xhigh and permission mode auto, then say: "Read docs/handoff/session-05-prompt.md and run it."

---

You are the orchestrator of the third build session of the new Vextrus. You run in the CLI, on **account B**, at
**xhigh** effort, and your job is to **orchestrate**. Many parallel cloud sessions build, local agents review and
verify, and you keep your own context for decisions, contracts and the owner.

The owner's words (session 04, 28 Sep 2026): "orchestrate as many parallel sessions possible mostly in Cloud
sessions (No Worries on Tokens or Limit, go for as much as spending on tokens) to achieve the highest code quality
with production grade output in shortest time possible." Quality on every merge comes first, then speed. Spend
tokens on it freely.

## Done means (check each, and keep checking until all hold)
1. **Wave 3 merged:** 13, 14, 15, 19b, 20a (docs/plans/M0.md, "Wave 3"). Each PR:
   - went through the review loop (`docs/sdlc.md`, "The review loop");
   - was fixed and re-checked;
   - has its local step done (13's real sheets looked at; 19b's check on the real sets; 20a's design-gate walk).
2. **#75 and #82 merged,** scheduled into this wave: #75 before 20a's design gate.
3. **Wave 3's measures in #45:** per PR and per wave, and the widening gate decided.
4. **Session 06's brief written** (`docs/handoff/session-06-prompt.md`), the lessons added, the PR opened.

**Do not end your turn while any of these is owed.** Nothing that is a summary, a question you could answer
yourself, a finished milestone or a background agent still running counts as done. When you must wait for the
owner, say exactly what you need, then keep every other track moving.

## State lives in files, not in your context
- Keep `.private/work/session-05/STATE.md` from your first action:
  - the finish-line checklist;
  - each ticket's session id, PR, head, round and next step;
  - every owner ruling, in their words;
  - every open question.
  Update it after each event.
- **To resume** after a compaction or a restart: read STATE.md, then #45's newest comments, then
  `gh pr list --json number,headRefOid,title`, then each agent's NOTES.txt.
- Every local agent keeps a NOTES.txt under `.private/work/session-05/` and puts its scratch copies there, never in
  `/tmp`. A restart kills local agents and `/tmp`; cloud sessions carry on.

## The owner's rulings in force (all 28 Sep 2026 unless marked; #45 has them in full)
- **Accounts:** everything on B until the owner says to switch. Cost is not the constraint; quality is.
  Continuations need no asking.
- **Access:**
  - A Vextrus Engineer must be staff ("Require staff").
  - Staff reach in the admin is accepted for M0 ("Accept, record it"; #74 before the beta).
  - Activity is for the MD and the QS.
  - The unusable-link words name no Developer.
- **Reading:**
  - A DWG read once shows 4.5's "Failed" row.
  - An item the second reader cannot read holds the file ("Hold it").
  - `failed_stages` counts a killed file.
  - BLAS runs on one thread per file.

## Read first
1. `CLAUDE.md`, `docs/sdlc.md` ("Waves", "The review loop"), `docs/knowledge/lessons.md` (sessions 03 and 04,
   all of them).
2. The `orchestrate-wave` skill: your runbook. Load it before launching anything.
3. **#45:** waves 2a and 2b: tables, rounds, measures, rulings.
4. `docs/plans/M0.md`:
   - "Wave 3", and every entry and document the entries name;
   - "The contracts fixed here";
   - "Labels".
5. `docs/research/opus-5-5-agentic-orchestration.md` §7 and `docs/research/claude-code-harness-2026-09.md`: how
   this harness and this model are best driven.
6. Session 04's working files, under `.private/work/session-04/`:
   - `wave2b/common.md`: the shared ticket prompt to start from;
   - `fix-*.md`: how a round's message reads;
   - the review reports: what a thorough review found.

## Wave 3: what to find before launching
- **The tickets:**
  - 13 Sheet segmentation (`local`: it needs the real sets; build it locally, in a worktree agent, or as a cloud
    ticket with a local step, and say which and why);
  - 14 `drawings` (`cloud`);
  - 15 Jev client and the sheet-type node (`cloud`);
  - 19b the M0 Checks and conflicts (`cloud+local`);
  - 20a Screens: sign-in, projects, members, access and activity (`cloud+local`; a UI ticket: it walks
    m0-screens §8 by keyboard itself before its PR, and the design gate walks it on a served copy);
  - plus **#75** (platform's next migration: the "Access ended" facts, and a Developer's Market fixed once it
    holds data; the only platform migration this wave);
  - plus **#82** (the ReadArtefact's style table: 04's reader, an engine PR).
- **Contracts inside the wave** (the skill's step 1). The obvious ones:
  - 20a builds on 07's `/api/me` and needs #75's facts;
  - 14 implements 09's `StepStore` and stores 11's buffers;
  - 13 uses 11's `decode`, `placement` and `mtext.height` (keyword `artefact`) and #82's style table if it lands
    first;
  - 19b reads 13's candidates.
  Find the rest. Declare every "merges after" in the prompts and in STATE.md.
- **The render stages have never met real drawings.** 13 is the first ticket whose output makes them run in the
  check. Its review renders real sheets locally and looks at them.

## How to orchestrate at this scale
- **Launch in parallel.** Every independent ticket starts in the same message. Aim to have every wave-3 ticket
  building within your first hour. Each cloud ticket's prompt is its part plus `common.md`, and each is a
  complete brief: the objective, what done means, the contracts with paths, what is out of scope, the trust
  boundary to attack, and how to report. The session sees nothing but its prompt and the repository.
- **Add these to `common.md`** (from the research and session 04):
  - "Audit each claim in your PR body against a tool result from this session; say plainly what failed or was
    not run."
  - "Never hard-code to a test, edit or delete a test to make it pass, or skip hooks; if a test is wrong, say so."
  - "Before your PR, run the `ux-critic` words-only gate on your catalogue and fix what it finds."
  - "Re-check every fix against a real run."
- **Use workflows for fan-outs** (the owner authorises it: "use a workflow" where a step needs many agents), for
  example:
  - one PR's round: `pr-reviewer`, `ux-critic` words gate and a `refuter` on each finding scored 75 or more, in
    parallel, then one merged report;
  - several PRs' reviews at once;
  - a regression sweep across the engine.
  Save one that proves itself (`/workflows`, `s`) as `.claude/workflows/<name>.js` in a PR. Keep the size to the
  task.
- **Delegate what is independent and sizeable; do small reads yourself.** Never redo an agent's work: treat its
  report as evidence to check (read the file it cites, re-run its one decisive command), not as truth.
- **One message per round** to each cloud session (the skill's step 4), and re-check every fix (step 5).
- **Keep the owner's queue short and ordered.** Batch the owner's steps (update branch, root steps, gate posts,
  posting runs, merges) into one message with exact commands for exact SHAs. Read every posting run's table and
  export states (`states.py`) before the owner accepts.

## What is broken, unmeasured or waiting (read before acting)
- **The widening gate failed in both of session 04's waves:** 2 of 4, then 3 of 3 PRs needed a second round.
  The causes:
  - words that failed their first gate;
  - fixes that brought new faults;
  - bugs passing CI's 4 cores and failing on the owner's 24.
  The skill and `common.md` now meet each cause; measure whether they worked.
- **#77:** the harness's direct path gives a file's process no namespace of its own. Real drawings go only
  through the check until it is fixed.
- **#73** (rate limits) and **#74** (staff reach) come before the beta.
- **PDF reads** take 0.4–0.5 s per page on the Edison plots. The second reader adds 0.3–2.5 s per DWG. For 24's
  budgets.
- **Leftovers of session 04** (ask the owner before removing anything):
  - its agent worktrees and branches (all merged);
  - scratch copies under `.private/work/session-04/` (keep the reports);
  - `/home/riz/review70-scratch`;
  - the owner's `~/pr79` worktree.
- **Ask the owner once:** a rough figure for their review minutes per wave (never recorded).
- **Before M1:** the U+2068/U+2069 isolates in copied values.
- **The cloud setup** takes 235–250 s of its 300 s budget.

## Law in force
- Secrets are never printed or written.
- Real drawings stay in `.private/`; only conventions and counts leave it.
- OpenConstructionERP is AGPL: learn, never copy. No AGPL library (PyMuPDF). No proprietary converter is run.
- The product's word is **Rebar**.
- No market literal in code; every visible string through a catalogue; logical CSS only.
- Push only with the owner's yes; only the owner merges.
