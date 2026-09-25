# The plan review, point by point against the ADRs

Session 01, 26 Sep 2026. The review is an adversarial reading of the 25 Sep plan from the owner's
other project (the "laboratory"), where Opus 5.5 drove AutoCAD and Revit 2027 through MCP tools on
the Edison set. It is kept privately (`.private/reference/plan-review/`); this ledger carries only
its findings, never drawing content. Ids (C1–C6, M1–M13) are the review's own.

**How to weigh it.** The laboratory extracted inside AutoCAD, which a hosted product cannot run
under Autodesk's desktop licences, and it modelled; it never did a QS takeoff or priced. Its lessons
on checks, identity, walls, rod and model assembly carry over whatever reads the DWG. Its effort
figures are modelling effort, on one set.

**Status** says where each point stands: *grill* (a decision for the owner, asked one at a time),
*evidence* (waiting on a measurement this session runs), *fix* (a correction needing no decision),
*agreed* (the owner has ruled; the ruling is quoted in the ADR it changed).

## Critical

| Id | The review's point, in one line | ADRs | Verdict | Status |
|---|---|---|---|---|
| C1 | Finish lines have no tolerances or item list; the Hand Takeoff checks only a typical floor, where errors are cheapest to catch | 0005, milestones | Challenges | agreed: ADR 0005 amended (tolerances per item line, five zones, one Rule Set) |
| C2 | The engine has no check stage; bulk Confirmation passes plausible systematic errors; checks must run against the source, with a coverage ledger and n / N counts | 0007, architecture | Adds | grill |
| C3 | Once methods are fitted to Edison and the Sample Project, neither proves reading; proof needs held-out sets from other consultants | 0004, 0005 | Challenges | agreed: ADR 0005 amended (one Held-out Set before M1, two before M2) |
| C4 | Answer keys are protected by words; any local session can read them (and the laboratory's verified model) | 0004, 0005, sdlc | Challenges | agreed: ADR 0026 (separate user, password on sudo, blind scorer) |
| C5 | The DWG reader was chosen before it was tested; LibreDWG 0.13.3 lost over half of one real file silently; `dwgread` is not an independent check | 0018, 0020, architecture | Challenges | evidence (reader bake-off on both sets; options research), then grill |
| C6 | Plotted PDFs often lack text (SHX strokes, outlined TrueType), lose blocks, dimensions, arcs and handles; PDF is harder, not easier | 0014 | Challenges | evidence (PDF read of both sets), then grill |

## Major

| Id | The review's point, in one line | ADRs | Verdict | Status |
|---|---|---|---|---|
| M1 | Jev's strengths were measured on invented cases; on real drawings storey ranges were 19 / 38, so ranges and grids go to code; each node needs a real-item spot check and a pinned model | 0011 | Challenges | grill |
| M2 | Rod from the drawing is reading plus detailing rules (laps, hooks, anchorage); add a third Rod Basis; column rod was the tractable case | 0010 | Challenges | grill |
| M3 | Walls and rooms are the hardest architectural family (false walls from door leaves and furniture, hairline gaps); prove rooms enclosed | 0007, milestones | Adds | grill |
| M4 | "The Building Model stays pure geometry" leaves junction ownership of overlapping concrete unassigned | 0009 | Adds | grill |
| M5 | Revision matching by grid, storey and mark breaks on unreliable marks and the reader's own noise; identity per element family; a zero-change re-read test | 0015 | Challenges | grill |
| M6 | Takeoff Steps miss lintels, sunk slabs, upstands, water tanks, lift pit and core, pile heads, parapets, verandah fills | 0007 | Adds | grill (with the QS critic's sweep) |
| M7 | Levels by consensus erase real local levels (sunk and raised zones); storeys from level lines, a dissenting mark is a Question | prototype lessons | Challenges | fix (the lessons file) + grill with M4 |
| M8 | Converting to SI on reading is too early; keep native units to assembly, round only for display | 0008 | Challenges | grill |
| M9 | No font policy (server has no CAD fonts; substitutes, a per-upload font report) | 0022, architecture | Adds | evidence (2D viewer measurement), then grill |
| M10 | dxf-viewer re-interprets the drawing with a second engine; render the engine's own buffers so the QS sees what was read | 0022 | Challenges | evidence (2D viewer measurement), then grill |
| M11 | "Only the owner merges" is unenforceable: branch protection on a private Free repo returns 403 (confirmed 26 Sep); the owner should review evidence, not diffs | 0025, sdlc | Challenges | grill |
| M12 | No real-drawing regression when a `cloud` PR touches engine code; no lessons file; semantic collisions between parallel tickets | 0019, 0025, sdlc | Challenges | grill |
| M13 | Price and "delivered in days" are unmeasured; time the QS per step in the walks | 0012 | Adds | grill (measurement only; the business is settled) |

## Minor

| The review's point | ADRs | Verdict | Status |
|---|---|---|---|
| Marks and titles are unreliable keys; sheet → storey confirmed by outline as well as title | 0007 | Adds | fold into C2 / M5 |
| Scale per view, not per sheet; read only text from not-to-scale views | architecture | Adds | fold into the engine ADR |
| M3–M5 "in parallel" collide: M3 and M4 both change `engine` reading | milestones, 0019 | Challenges | grill (milestone order) |
| An implicit date in the session-01 brief | 0019 | — | fix: already gone from the rewritten brief (checked 26 Sep) |
| Stale research: `stack-frontend.md` names FastAPI and a committed `api-types.ts`; `stack-deploy.md` says CI is free "for this public repo" | 0022, 0024 | Fix | fix (confirmed by grep, 26 Sep) |
| `triangle` wraps Shewchuk's Triangle (non-commercial terms); a dedicated deployment hands over GPL LibreDWG and IfcOpenShell's libraries | 0018 | Adds | fix: licence checks in the engine ADR |
| A per-tenant Jev answer cache keyed by (state, question, options, model); ask TypeSafe about concurrency limits | 0011 | Adds | grill with M1 |
| An IFC validation gate | 0021, 0022 | Adds | fold into the engine ADR |
| The image will exceed free private registry storage | 0023 | Adds | fix (a cost line in `stack-deploy.md`) |
| One term for the owner-held truth | CONTEXT | Adds | fix with C4 |

## What the review confirms
0007 (building-first Takeoff, Questions at the point of need), 0009 (Measurement Rules as data,
PWD default), 0008 (SI inside with exact factors; timing challenged in M8), the Trace, 0011 (Jev
picks, code counts), 0010 (ratio first, never the answer), 0005 (the Independent Set rule), 0021
(one Postgres), 0020 (the modular monolith). It adds: "approximate never overwrites measured", and
"never re-derive a value from a correction's text".

## The review's own decisions for the owner, and where each is asked
1. Held-out sets → C3. 2. Tolerances → C1. 3. Oracles through a blind scorer → C1 / C4.
4. Custody → C4. 5. A second decoder → C5. 6. PDF differential test → C6. 7. GitHub Pro / Team → M11.
8. Hold the price until a timed walk → M13.
