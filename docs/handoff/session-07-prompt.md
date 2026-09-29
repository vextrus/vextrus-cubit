# Session 07: finish M0 to production quality, then make M1 ready to build

## Starting the session (the owner)
1. **Before the session, once** (the only owner step that gates the start):
   `cd ~/vextrus-cubit && git switch main && git pull --ff-only && sudo bash scripts/owner/keys-custody.sh`
   — it reinstalls main's real-drawing command and scorer for the pipeline's user (21a, 24f and 129
   changed them after the last run). Without it every posting and scored run is refused ("the installed
   command is not main's").
2. Then: `claude --model claude-opus-5-5 --effort medium`, check `/status` (Opus 5.5, medium, auto), and
   say: "Read docs/handoff/session-07-prompt.md and run it."

---

You are the orchestrator of session 07, at **medium** effort. You own two results:
1. **M0 finished to production quality**: every remaining ticket merged through the loop, the reading
   scored against the Answer Keys and improved by the scored loops, the adversary rounds clean of
   anything ≥ 50, and **M0 handed to the owner's walk** with its steps written.
2. **M1 ready to build from session 08's first minute**: `docs/plans/M1.md` written (waves, tickets,
   contracts at the key level, budgets, where each runs), attacked by independent reviewers, and session
   08's brief written.

**You run everything yourself** (ADR 0041, the `orchestrate-wave` skill). The owner is not waiting to
approve anything but the steps only they can take (custody re-runs, spending, the walk). **After each
event take the next step in the same turn; never stop to summarise or offer to wait.** Speed and quality
are both the target: the fastest safe path, not the fastest path.

## The owner's rulings (verbatim; #45 and `.private/work/session-06/STATE.md` hold each in full)
Session 06 (29 Sep 2026):
> "Keep it up and keep pushing until we completed all issues on M0 and have the solid production grade
> foundation of our product by achieving the highest quality completing M0. I suggest you to utilize some
> Sonnet 5.5 agents for adversary, skeptic role type for attacking features that are merged or partially
> merged to get to know the weak point so that we can keep improving, fixing to reach our destination."

> "Finish up those which you can." / (for session 07) "bigger responsibilities of finishing off M0 with
> production quality at any cost in shortest time and get ready us for starting working on M1 from
> session 8."

> "For temporary please make our repo public so that we don't have to deal with CI runtime for now, I've a
> card issue which I'll resolve and pay soon" — **the repository is public** (ADR 0024 set aside until the
> owner fixes billing and says to make it private again). Write every commit, issue and PR as public.

> Keys: "I have reviewed keys-draft/review/READ-FIRST.md and you are right on these points … it was good
> as far I saw though I couldn't get the chance to go through all of them." The keys are in custody.

Still in force (session 06's brief lists them in full): autonomy (you push, open PRs, post gates and merge
after the loop); at most two fix rounds (a third only for a security hole ≥ 75 or a crash or false
statement a QS meets); every finding ≥ 50 or of a repeated class leaves a committed check; acceptance
tests first by a separate agent; elapsed/budget in every message to a builder; Opus 5.5 medium by
default, high for reading drawings, hostile input and security walls; `pr-reviewer` and `refuter` high;
Sonnet 5.5 for light work and **adversary rounds** (its findings ≥ 50 re-run by an Opus refuter before
you act); account B; the Answer Keys fenced (only the scorer reads them).

## The time budget
**8 hours** from your first launch. No new M0 launches after 5 h 30 (M1's planning needs the last 2 h);
no new launches of any kind after 7 h; at 8 h the running rounds finish and you write the hand-off.
Per ticket: M0.md's "Finishing M0" table from its acceptance-writer's launch (or your first message to a
carried-over builder) to merge. State both clocks, from `date`, in every message to a builder.

## Where M0 stands at session 06's close (exact; verify with `git log origin/main`, `gh pr list`)
**Start fresh. Do not resume, message or wait for any session-06 builder or agent** (local `s6-*`, the
cloud sessions, the review agents): they are stopped. Every carried-over piece below is a **fresh ticket**
that starts from a committed branch head, with its findings listed here and in the files named.

**Merged in session 06 (11 tickets):** 23 (#112), 24s (#113), 16 (#116), 19a (#119), 17 (#117), 21a (#126),
20b (#130), 24f (#128), 129 (#132), 21b (#138), and the web race fix #137. main at the hand-off PR's merge.

| Ticket | Start from | State | What is left (the next session's whole job for it) |
|---|---|---|---|
| **18** Plot registration | PR **#124**, branch `t18` (db45aa6c) | approved after 3 reviews (2×75, 50, 50 fixed); engine suites green on the merge with 17 | after the owner's custody re-run: merge `main` in, `scripts/real-drawings 124 --no-post` (last: no failed stage; plot_matches +208, render_f1 +195, checks +416 all `plot_pages`), `--accept "<judged reason>"`, merge. 15 minutes. |
| **22** Step 1 screen | branch **`t22` at b3186ea5** (pushed; acceptance adc09fd8) | review round 1 fixed (half-refused bulk act; double Enter; the e2e smoke test by hand only until 21c; `agrees`' no-list test); #115 fixed; words gate passed 3 rounds | **the design gate failed** on items 1, 7, 8, 10, 11 (walk on d74383ac, one commit before b3186ea5; report and screenshots `.private/work/session-06/22/gate-1.md`, `gate/`): **M1 dates misread** ("12.09.2026" shown "9 Dec 2026"; blocks the demo); M2 the list's Storeys, Views and File columns and the files band (6.2); M3 file-name marks without date; M4 Question cards' Trace lines and bodies; M5 Q2's "Picked for you"; M6 sheet mode: working view, legend, view outlines, → ←, List/Sheet control, sheet picker; M7 the inspector's Proposal and Views blocks, Correct/Exclude, thumbnail; M8 initials chips, "Who did what"; M9 the rows' focus ring (`outline-none` beats `focus-visible:outline-2`); M10 en-XB ranges reversed (make a range one notation span); M11 the MD/Guest bar and the ghost next Question. A **fresh builder** (cloud, high: it is most of Step 1) takes these as its work list, pasted into its prompt with m0-screens' sections for each (a cloud builder cannot read `.private/`); budget 3 h; then review and a fresh walk. |
| **21c** Proposals, Questions, Coverage | not started | — | acceptance tests and builder at once after 21b is on main; picks up #118, #135, #102's Discipline-less sheet. |
| **26** First-open and Step 1 walk | not started | — | after 21c and 22. |
| **24** Measurements | not started | — | the owner's run; sets the CAD worker's cap. |

## The scorer: make its first real answer
main's only baseline so far scored 0/284 because of a join bug, now fixed by 24f. After the custody
re-run and 18's merge: `scripts/real-drawings main --score` and record in #45 — sheets and views n / N per
set, per field, and the reasons' counts (never a key value). Read the reasons: if one reason dominates a
whole set (e.g. "paper unknown", "the sheet missing"), suspect the scorer or the contract before the
reading, and prove which with a synthetic case first (session 06's lesson). Then **the scored loops**
(M0.md "The scored loop"): 17's views and storeys, 18's render F1 with the sheet level as a guard — one
fix branch each, many agents on different failing sheets, each loop ≤ 90 minutes, stop when two scored
heads gain nothing; a head may not lose a passing sheet without a judged reason. Every scored head in #45.

## The order
1. **Launch at once, in parallel** (first 15 minutes): 21c's acceptance-writer (21b is on main); a small
   **seed ticket** for #136, #131, #125 (its acceptance tests first); a fresh builder for **22** from `t22`
   with its gate musts; a small **test ticket** for #122 and #134's latency check; a **harness ticket**
   for #107.
2. 18 (if not merged at the hand-off) → **the baseline score** on main → **the scored loops** on 17 and
   18 (local, real drawings), each ≤ 90 minutes.
3. **21c** builder as soon as its tests land (critical path; high) → review → its first `--job` posting
   run → merge.
4. **22** reviewed and design-walked again (serve it: worktree DB, `migrate`, `flush` then **one**
   `seed_demo` with `VEXTRUS_DEMO_PASSWORD` from a throwaway file the gate types into the form), merged
   after 21c.
5. **26** after 21c and 22: the real-set walk (Edison's five DWGs, the Sample Project); its fixes scored.
6. **24** prepared for the owner's run; the CAD worker's cap from it.
7. **Adversary rounds** after each merge wave (Sonnet 5.5; one surface each: the read job and its
   sandbox; Step 1's acts and walls; the scorer and posting path); confirmed findings ≥ 50 fixed in-session.
8. **M1's plan** from 5 h 30 (below), in parallel with the last M0 merges.
9. **M0's walk steps** for the owner (docs/specs/M0.md, Finish line), in #45 and the hand-off.

## M1: ready to build at session 08's start
M1's spec is signed (`docs/specs/M1.md`, "The frame and piles, priced"; its "What M0 hands over to M1"
and "What M1 takes from M0" name the seams). Produce, with agents (you decide, you do not draft alone):
- `docs/plans/M1.md` in M0.md's shape: waves, each ticket's entry (owns, also edits, blocked by, merges
  after, sees, where, effort, budget), **the contracts fixed at the key level** (names, fields, codes, an
  example each), the Checks M1 brings, labels, risks, the owner's time. Reuse M0's machinery: acceptance
  tests first, the scorer and keys (M1's keys need element-level fields: ask the owner only if the spec
  does not settle it), adversary rounds, the scored loop.
- **Attack it before it is final:** a `qs-critic` (would a Dhaka QS sign the Priced BOQ and Material
  Schedule M1 produces?), a `refuter` on the critical path and the contracts, and a `pr-reviewer` pass on
  the plan's consistency with the ADRs and M0's code as merged. Fold their findings in.
- **Session 08's brief** (`docs/handoff/session-08-prompt.md`): launches M1's first wave in its first
  15 minutes (acceptance writers for every wave-1 ticket at once), with this brief's operating rules.
- Anything only the owner can rule (product, scope, spending) goes to the owner as one question at a
  time, your recommendation first, before the session ends.

## Operating rules (session 06's lessons, each paid for; the checks are committed where named)
- **Score a real export the moment the scorer exists**, before any loop depends on it (the 0/284 join).
- **Type test fixtures as the real data holds them** (storeys were a list; the helper typed a string).
- **Tests force the failure they test** (monkeypatch), never count on a build's stack or timing.
- **Acceptance writers run their tests against a throwaway implementation before committing**, and run
  every file they commit (21b's toolchain file was never run: two tests could not pass). Their "not
  pinned" lists are ruled before the builder starts. When a builder is BLOCKED on a test with proof, amend
  it yourself or through the writer (`acceptance:` commit) within minutes.
- **Watch cloud builders by their `claude/<slug>` branch** (they never push the ticket's branch): the
  watcher lists every `claude/*` branch each loop and remembers handled heads; a READY head present at
  the watcher's start still fires. Local builders by state transitions.
- **Message an idle local builder with SendMessage**; never `claude --bg --resume <short id>` (it opens a
  picker and blocks). A stopped one: `claude --bg --resume <full session id> "<step>"` from its worktree.
- **Unique scratch folders per agent** (two drafting agents collided on `scratch-structural`).
- **Every change to `scripts/real_drawings/` or `tools/scorer/` on main needs the owner's custody
  re-run**: batch such PRs, and ask once, right after the last one merges.
- **CI differs from this machine**: no shellcheck here (run it in the builder's checks via a container or
  ask the owner to install it), a different Python build, a slower browser. A CI-only failure goes to a
  Sonnet debugger at once with the job's log; a failure that passes on a re-run twice is a flake: file it.
- `post-status` needs the literal full SHA on a line of its own. `gh` here is 2.45: use `gh api` for what
  newer flags do.
- A power cut cost 70 minutes and nothing else, because every event was in STATE.md: keep that.
- Batch fix rounds: one message per round; a later finding in the same round goes as an addendum only if
  the round is still running.
- Serve design walks yourself and pass the demo password as a file path, never the value; the seed now
  refuses a second run (#129): `flush` then `seed_demo`.

## The open issues, triaged at session 06's close (labels `M0` and `before-beta`; none left `needs-triage`)
**`M0` — land before the owner's walk; each has an owner ticket:**
| Issue | What | Who takes it |
|---|---|---|
| #136 | the demo seed lacks KR-01's Structural drawing list (Step 1 opens "Confirm 5", §7 says 16) | a small seed ticket, first (blocks 22's walk and the owner's) |
| #131 | demo seed/status contradictions on BP-02 (Plot "0 of 6" before its DWG; "read anyway" with 0 sheets) | the same seed ticket |
| #125 | the seed's job-borne 4.5 states on BP-02 and MG-01 (cut from 21a) | the same seed ticket |
| #115 | the viewer retakes focus after Try again | fixed on `t22`; closes with 22 |
| #118 | Drawing Set acts with no operation (Open the Question, Mark for Vextrus, Bangla sheet links, Open in Step 1) | 21c (operations) + 22 (controls) |
| #135 | a sheet left out for unreadable writing is also out of Coverage | 21c |
| #102 | 5 of 7 false continuations remain; the Discipline-less sheet's Questions | 17's scored loop; 21c |
| #133 | engine rendering on a real set (portrait title blocks rotated, bubble letters, level tags) | 26's walk judges; fix tickets from it |
| #122 | the viewer's pixel test misses dropped text | a small test ticket before the next raster change |
| #134 | the web test race: fixed by #137; open for its committed check (latency in `FakeApi`) | the same small test ticket |
| #107 | an acceptance test can hide behind an opt-in marker; the scorer's argument pattern allows an option | a harness ticket (it guards the acceptance rule itself) |
**`before-beta` — not M0; read before M1's plan, schedule in M1 or the beta's hardening wave:** #73 sign-in
rate limits (#121 found none too), #74 staff reach in the admin, #77 the harness's direct path namespace,
#92 a write landing in another tab's Developer, #94 a 500 on an over-long Content-Type, #120 viewer
findings < 50, #121 platform findings < 50, #123 scorer findings < 50, #127 the Held-out join oracle
(before the first Held-out Set).
**Closed by merges:** #95, #100 (session 06); #27, #87, #88 close when #124 merges; #33 by #138; #129 by #132.
**Also known:** peak memory rose on two Edison files with 18 (663 → 1,207 MB; 365 → 926 MB;
`keep_buffers`), and the CAD worker has no cap until 24.
**Clean-up for the owner** (the guard refuses recursive deletes): the merged worktrees (`git worktree
list`, then `git worktree remove <path>` for each merged ticket), and the scratch worktrees under
`.private/work/session-06/*/review*`, `adversary/*/wt`, `web-flake/wt`, `21b/on-21a`, `21b/on-21b`.

## Done means
1. M0's remaining tickets merged (18, 21b, 21c, 22, 26; 24 prepared for the owner's run), each through
   the loop, each finding ≥ 50 with its committed check.
2. The first real Development-Set scores and every scored loop head in #45, with the reading improved.
3. Adversary rounds on every merge wave with no confirmed finding ≥ 50 left open.
4. M0's walk steps written for the owner, or exactly what remains and why.
5. `docs/plans/M1.md` attacked and final; session 08's brief written.
6. #45's measures; lessons with their checks or listed as debts; the hand-off PR merged.

## Law in force
Secrets never printed or written; real drawings stay in `.private/` (the repo is public: no drawing text,
no key value, no client-identifying content beyond what is already there); the keys are read only by the
scorer; OpenConstructionERP never copied; no AGPL library in the product (never PyMuPDF, even in scratch:
use pypdfium2 or pdftoppm); the product's word is **Rebar**; no market literal; every visible string
through a catalogue; logical CSS only.
