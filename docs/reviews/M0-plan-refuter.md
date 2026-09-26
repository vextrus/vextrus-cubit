# M0 plan review: the refuter

26 Sep 2026. The `refuter` tried to refute "docs/plans/M0.md, built as written, delivers the signed
spec's finish line and every fact it states is true". Verdict: refuted. Checked true: GitHub Pro not
bought (rulesets 403); main 57 ahead of origin (before the push); the LibreDWG workflow exists;
vx-score a placeholder; the credit figures match the research.

1. **High: ticket 06 runs agent-written code as `vxkeys`,** which can read every key. Fix: run the
   pipeline unprivileged (or in bwrap with /home/vxkeys masked); only vx-score reads keys and export.
2. **High: agents can already reach key-like content:** sheet counts appear in the spec and in
   sample-project-first-read.md and vector-pdf-evidence.md; the prototype's fitted per-sheet facts
   sit in `.private/work/session-01/sample-pipeline/`; a committed Edison drafting script would let
   agents rebuild the draft. Fix: move session-01 Development-Set outputs under vxkeys and keep the
   drafting script out of the repo, or state that M0's keys are not blind.
3. **High: vx-score's IoU matching does not fit a PDF-drafted Edison key** (pages are not sheets; 52
   of 57 structural pages registered). Fix: decide the key's join first (sheet number, or an
   owner-confirmed registration), in 05.
4. **High: ticket 06 cannot be done by a local agent** (denied /home/vxkeys, refused sudo; /home/riz
   is not readable by vxkeys). Fix: split into code the agent writes and a run the owner does; say how
   vxkeys gets the drawings and the PR's head.
5. **Med-high: vx-score is an oracle:** the passwordless rule allows any arguments, and the guard
   checked `sudo` only at a command's start, so `bash -c "sudo -n -u vxkeys …"` passed. The guard was
   tightened the same day (refuses sudo, su, wsl.exe, the key user and the scorer anywhere in a
   command); the structural fix is that vx-score takes no caller-chosen export, or the passwordless
   rule is dropped.
6. **Med-high: no ticket owns storage** (StoredFile, put/get). Fix: give it to 09.
7. **Med: dependencies do not hold:** 21 not blocked by 18; 13/17/18 need the export 21 owns; 06 needs
   04; early engine PRs need a status nothing can measure yet.
8. **Med: walk step 3 (cancel and restart) has no restart endpoint or ticket.** Fix: 14 and 20.
9. **Med: the status and ruleset have no owner;** agents share the owner's `gh` identity. Fix: the
   owner sets the ruleset; the status comes from a token held only by the key user and the ruleset
   accepts only that source.
10. **Med: shared files are not written once** (dependencies, INSTALLED_APPS, AUTH_USER_MODEL,
    middleware; `services/__init__.py` becomes a registry). Fix: 01 declares every M0 dependency, app
    and setting up front.
11. **Med: the policy-coverage test** is not "over zero tables" (contrib, Procrastinate); nothing
    tests that the app role is not a superuser and lacks BYPASSRLS, so RLS tests can pass vacuously.
12. **Med: bwrap is installed nowhere the cloud tests run;** the spec says sandbox tests run locally
    and in CI; the "unsandboxed in tests" fallback needs a switch in product code.
13. **Med: ticket 25 must be owner-run** (the reference setup is the owner's Windows Chrome).
14. **Low-med: ticket 13 asks Jev for storey,** against the owner's ruling (code owns storey ranges).
15. **Low: "15 cloud, 9 local" is false:** 17 cloud, 8 local.
16. **Low: the first-session checklist needs 01 merged;** the credit's claim deadline (7 Oct,
    research) is missing.
17. **Low: unowned items:** the MD's activity view (story 60, walk step 10); re-assigning a view; the
    exact re-plot setting; the phone notice; the `real-drawings` skill update; upload-to-sheet-list
    timing; peak RAM on the Sample Project; `web/src/drawing-set/` missing from the layout.
