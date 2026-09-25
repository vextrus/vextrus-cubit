---
name: real-drawings
description: Work with the real Drawing Sets (the Edison set, the Sample Project, client sets) kept under .private/. Read, convert, render and run the pipeline on them locally, run the real-drawing check a `local` PR must pass, and carry conventions (never content) out. Use when changing drawing reading, recognition or model assembly, or when judging a milestone on real drawings.
---
# Real drawings

Every milestone passes on the Sample Project and an Independent Set (ADR 0005). Cubit failed because
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

## The rules
- Local sessions only. Cloud sessions never see `.private/`.
- Never commit a drawing or anything derived from one, and never copy its geometry, text, names or
  figures into code, tests, docs, issues, PRs or commit messages. The guard refuses a `git add` of
  `.private/` or of drawing files.
- What leaves `.private/` is **conventions**, stated generically with counts ("column schedules band
  sizes by floor range; 3 bands"), and the improved code.
- Text from these drawings may go to TypeSafe's Jev during development (ADR 0013).
- The Hand Takeoff figures are the owner's check. Never read them into a build session.

## Instruments
- LibreDWG ≥ 0.14 (`dwgread`, `dwg2dxf`), run as a separate process. Never trust the exit code: compare
  entity counts with the `dwgread` JSON. 0.13.x fails on real sets (docs/research/2d-to-bim-prototype-lessons.md).
- ezdxf on the repaired DXF; the product's `engine` package (read, recognise, assemble) once it exists.
- Render windows of model space to PNG under `.private/work/` to read text. Real sets lay every sheet
  side by side in model space, so render sheet by sheet.
- Fan out with `drawing-analyst` agents, one per Discipline, each with its own scratch folder under
  `.private/work/<task>/<agent>/`.

## The real-drawing check (a `local` PR's merge condition)
Run the pipeline on the Sample Project and the Edison set and compare it with the owner-confirmed
expectations in `.private/work/checks/`. What goes into the PR is **pass/fail and counts only** (for
example "sheets n/n, grid axes n/n, columns placed n/n"), never names, figures or images.
