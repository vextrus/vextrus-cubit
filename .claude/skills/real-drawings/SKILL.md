---
name: real-drawings
description: Work with the real Drawing Sets (the Edison set, the Sample Project, client sets) kept under .private/. Read, convert, render and run the pipeline on them locally, run the real-drawing check (`scripts/real-drawings --no-post`) while tuning an engine change, and carry conventions (never content) out. Use when changing drawing reading, recognition or model assembly, or when judging a milestone on real drawings.
---
# Real drawings

Every milestone passes on the Development Sets and an Independent Set (ADR 0005). Cubit failed because
it was only ever proven against drawings it generated itself (docs/postmortem.md, cause 1).

## Where they are
- `.private/reference/edison/`: the Edison set (structural, architectural, plumbing, electrical,
  general notes). A real Dhaka consultant's DWGs, cleared for development use (ADR 0005). Vector PDFs,
  when the owner exports them, go beside the DWGs.
- `.private/reference/sample-project/`: the Sample Project, drafted by the team in AutoCAD as a Dhaka
  consultant would (ADR 0004). Its Revit model, if any, is kept away from development.
- `.private/reference/<client>/`: founding clients' sets, with their permission.
- `.private/work/`: everything derived (DXF, renders, JSON, notes). The originals under `reference/`
  are read-only; the guard refuses edits there.

`.private/` lives in the main checkout only; a worktree reads it there.

## The rules
- Local sessions only. Cloud sessions never see `.private/`.
- Drawings and everything derived from them stay in `.private/` and the owner's cache: code, tests,
  docs, issues, PRs and commit messages carry **conventions**, stated generically with counts
  ("column schedules band sizes by floor range; 3 bands"), and the improved code. Tests use invented
  fixtures. The guard refuses a `git add` of `.private/` or of drawing files.
- Text from these drawings may go to TypeSafe's Jev during development (ADR 0013).
- The Hand Takeoff figures are the owner's check, read only by the owner.

## Instruments
- LibreDWG 0.14 (`/opt/vextrus/libredwg/bin/dwgread`, `dwg2dxf`), run as a separate process. Never
  trust the exit code: compare entity counts with the `dwgread` JSON (docs/research/2d-to-bim-prototype-lessons.md).
- ezdxf on the repaired DXF; the `engine` package (read, recognise, assemble).
- Render windows of model space to PNG under `.private/work/` to read text. Real sets lay every sheet
  side by side in model space, so render sheet by sheet.
- Fan out with `drawing-analyst` agents, one per Discipline, each with its own scratch folder under
  `.private/work/<task>/<agent>/`.

## The real-drawing check in M0: regression only
Every engine PR (a path in `.github/engine-paths.txt`) needs a `real-drawings` status. In M0 there are
no Answer Keys (ADR 0030, amended 28 Sep 2026): the check runs the engine harness on both Development
Sets and reports what changed against the last merged run, item by item. It proves nothing changed
unseen; it does not prove a reading right. That rests on the owner's walk.

**While tuning, on your own branch:**
1. Commit the change, then run `scripts/real-drawings <your branch> --no-post` from your checkout.
   It checks out the branch's engine paths, refuses a `dwgread` off the pin or a changed lock source
   or `[tool.uv]`, installs the locked wheels offline inside bwrap, runs the harness on both sets,
   checks each export against main's schema (against the head's own when the head changes it, which it
   prints: then read the schema's diff) and diffs it against main's run (cached by code hash, the
   sandbox's version and the set's content; an export with a failed stage, or a file whose process
   timed out or failed, is never reused).
2. Read "Failed on the head" and "Failed on main" first: a stage that failed (by stage, file count and
   error kind; "process" is a file's process that timed out or failed, counted like a stage) means
   that run read less than it should, however empty the table looks. A failed run is never taken
   from the cache, so the failure happened in this run. If it may be the machine's (a
   timeout or an OOM kill while the machine was busy, `SandboxUnavailable`), run again. `--fresh`
   reads the head and main again even when their clean exports are cached: use it when something the
   key does not cover changed (the host's bwrap, a toolchain rebuilt at the same pin). Never delete
   the cache. Then the table: per measure (files, failed stages, entity counts, report counts, sheets,
   views, register, Plot matches, render F1, Checks, conflicts, continuations), the items gained, lost
   and changed, and the items held now. A stage failing where main's did not counts as lost. Read time
   and peak memory are shown, never counted.
3. The item list (`items.json` under `~/.cache/vextrus-real-drawings/runs/<run id>/`) names each
   changed sheet and view, so it holds drawing text: read it to understand a change, and carry out
   only the convention it teaches.
4. Done when every lost or changed item is one you meant; each unexplained loss is a regression to fix
   before the PR.

**What a PR may quote:** the counts only, per measure ("sheets 0 gained, 0 lost, 3 changed"), plus the
run id. Titles, numbers, layout names and item lists stay on this machine.

**The posting run is the owner's.** The owner runs `scripts/real-drawings <PR>` from main, accepts or
rejects the changes (a lost item only with a reason), and the owner's GitHub App posts the status
through `scripts/owner/post-status`, which runs as the key user with the owner's password. Sessions
open the PR and stop at `--no-post`.

## From M1: where expectations live
Answer Keys (the Sample Project's, Edison's at sheet and view level, later the Held-out Sets and Hand
Takeoffs) live with the key user (ADR 0026), outside every session's reach. The blind scorer
(`scripts/score/`, M1 ticket 01) reads the posting run's export from its drop folder and the keys, and
returns only aggregates (n / N per Takeoff Step); a reading ticket stops when its n / N stops
improving. The run-to-run diff stays beside it.
