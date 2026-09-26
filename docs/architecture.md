# Vextrus — architecture

The map a build session reads first. The decisions are ADRs 0018 (hosted, multi-tenant), 0034 (the
stack), 0022 (the frontend and viewers), 0027 (Checks), 0029 (the DWG reader and the second decoder),
0030 (the real-drawing check) and 0031 (the engine and the data spine). The tables are
docs/data-model.md; where it and an ADR disagree, the ADR wins. Evidence: docs/research/stack-*.md.

## The shape
One Django modular monolith (the web process plus worker processes from the same package), one
Postgres, one file store and one React web app. Nothing else until a measurement says otherwise.

```
browser (React SPA) ──REST/OpenAPI──▶ Django + Ninja (web) ──▶ Postgres 16 (data, jobs, events, search;
     │ (sheet: engine buffers per sheet;       │                  row-level security from M0)
     │  3D: three.js per storey, ADR 0022)     └─ enqueue ─▶ worker ──▶ files (FS dev / S3 beta)
     │                                                        └─ engine (pure Python)
     │                                                             read/: LibreDWG 0.14 (dwgread JSON,
     │                                                               DXF → ezdxf) + ACadSharp cross-check,
     │                                                               both sandboxed (bwrap: no network,
     │                                                               read-only FS); pdfplumber / pypdfium2
     │                                                             recognise/, families/<family>/,
     │                                                             measuring and Checks (pure functions),
     │                                                             assemble/ (parametric elements; IfcOpenShell and GLB for export),
     │                                                             render/ (per-sheet buffers + font table)
     └────────────── Jev (TypeSafe, US) ◀── platform's Jev client (answer cache, override log, fallback)
```

## The module map (higher layers import lower; modules on one line are independent)

| Layer | Modules | Own |
|---|---|---|
| 6 | `summary`, `exports`, `assistant`, `revisions` | The Project Summary, Target Cost warning, ৳ by stage, consumption ranges; Excel, PDF and the 3D share link (ADR 0022); the Level 2 assistant; every comparison (Revision, rule re-measure, price update) split into quantity and price effect |
| 5 | `boq` | The Priced BOQ computed on read (a Measurement Line cache), Cost Basis per Trade, Estimate layers, Lump Sums and Provisional Sums, Construction Stage names, the Material Schedule, Issued Estimates |
| 4 | `takeoff`, `measurement`, `rates` | Takeoff Steps, Proposals with candidate geometry and their Traces, Confirmations, Questions, the Check catalogue with its runs and findings, Coverage, the Developer's Specification; Rule Set versions, Measurement Rules (junction ownership, rebar detailing), BOQ Items and Billing Units, Rebar Ratios by Storey Band, diameter splits; Resources, Market Price sets, Rate Analyses, Labour Contracts, Benchmark Rates and mark-ups, tax rates |
| 3 | `building_model` | Confirmed facts only, in SI: Element Families (as data), Elements with identity per family, Element States over Model Versions, confirmed reinforcement (rebar bars), Element Traces, storeys, Storey Bands, grid; parametric element data for the browser's 3D; IFC and GLB through `engine` for export (ADR 0022) |
| 2 | `drawings` | Drawing Sets, Revisions, Sheets, Sheet Revisions, Drawing Set States, Views with confirmed scale, all in drawing units; files with the two-decoder cross-check, quarantine and the PDF upload report; the read job; the Trace anchor type |
| 1 | `projects` | Project, Display Units, market, Target Cost, Saleable Area |
| 0 | `platform` | Tenancy and row-level security, memberships (Vextrus Engineers by invitation), auth, units and money formatting, storage, the job-queue wrapper, the event outbox, the Jev client, its answer cache, override log and fallback |
| — | `engine` | Pure Python, no Django: `read/` (behind one reader interface), `recognise/` (candidates plus judgement requests), `families/<family>/` (recognise, check, geometry, measure, dispatched by a registry generated from the directory), `assemble/` |

Each module has the same anatomy: `models.py` and `migrations/` (private); `services.py` and
`schemas.py` (public); `http.py` (the Ninja router); `admin.py`; `tasks.py`; `tests/`.
import-linter enforces the layers, the independence of siblings, the privacy of models, and
`engine`'s isolation. The shared files (INSTALLED_APPS, the root router, the import-linter config)
change only when a module is added, never per feature.

## Rules a build session follows
- **One module per feature.** A cross-module feature is two slices: the lower module's service first,
  then the upper module. An Element Family ticket only adds files under `engine/families/<family>/`
  and its family row; it never edits a shared registry (ADR 0031).
- **Across modules:** no ORM joins, signals or in-process event bus. A downward id is read through
  the owner's `services.py`; an upward id is an opaque stamp, never resolved. Slow work is a job.
- **Ownership:** Proposals and candidate geometry live in `takeoff`. Only `takeoff`'s confirm service
  writes `building_model`, copying Trace anchors in. Nothing enters the Priced BOQ unconfirmed.
- **Measuring is pure:** a function of (confirmed facts, pinned Rule Set version) in `engine`;
  `takeoff` previews it on Proposals, `boq` computes on read. Live money is never stored; an Issued
  Estimate freezes it (ADR 0028). Junction ownership is one function for quantities and 3D (ADR 0009).
- **Units (ADR 0008):** drawings and Proposals stay in drawing units; the confirm service converts to
  SI with exact factors; money is an exact Decimal in its quoted unit; quantities round per
  Measurement Line in the Billing Unit, amount = ROUND(quantity × rate, 2). Nothing that feeds a
  figure is a float. Display Units and lakh / crore grouping (money and quantities, never coordinates
  or dimensions) happen only at the edge.
- **Trace:** every figure carries one. A DWG anchor is (file hash, reader and version, sheet, insert
  handle chain, entity handle); a PDF anchor is (page, path index, box). An artefact an anchor names
  is never deleted.
- **Checks (ADR 0027):** pure functions over (read artefacts, confirmed state), never compared with
  the pipeline's own output; they run at reading and at every Confirmation. A firing Check raises a
  Question, a sanity range a flag. Counts show n / N with N from the drawing; Coverage accounts for
  every view.
- **Reading:** both decoders run on every upload; a disagreement quarantines the file and `takeoff`
  raises a Question (ADR 0029). Every engine PR carries the `real-drawings` status (ADR 0030).
- **Jev** picks among candidates code has found; code computes every number, owns storey ranges and
  grids, and if Jev is unavailable the QS picks (ADR 0011).
- **Data:** every tenant table has a row-level security policy in its first migration; append-only
  tables are only ever appended to (docs/data-model.md §2); CI runs `makemigrations --check` and
  asserts one leaf per module; at most one ticket per wave adds migrations to a module.
- **Jobs:** idempotent steps per file, then per sheet, with progress and cancel; arguments carry only
  the tenant id and ids; the CAD queue runs at concurrency 1 under its own memory cap.
- Generated files (the OpenAPI schema and TS types) are never committed. Each worktree gets its own
  database, named by an environment variable; test databases are named by a hash of the migrations.

## Stages
Development is native and free; the beta runs in AWS Mumbai on x86; scale grows on measured triggers
(ADR 0034).
