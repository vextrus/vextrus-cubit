# Vextrus — architecture

The map a build session reads first. Revised in session 02 (28 Sep 2026) for the Live Model. The
decisions are ADRs 0018 (hosted, multi-tenant), 0034 (the stack), 0022 (the frontend, viewers and their
tools), 0027 (Checks), 0029 (the DWG reader and the second decoder), 0030 (the real-drawing check), 0031
(the engine and the data spine), 0035 (the Live Model), 0036 (Projects, Sites, Buildings), 0037
(Attributes and Records), 0038 (markets as data), 0039 (Drafting Profiles) and 0040 (Discipline Parts and
Element Relations). The tables are docs/data-model.md; where it and an ADR disagree, the ADR wins.
Evidence: docs/research/stack-*.md, stack-versions.md, deploy-providers.md, one-model-or-linked-models.md.

## The shape
One Django modular monolith (the web process plus worker processes from the same package), one
PostgreSQL 18, one object store and one React web app, per region (a cell). Nothing else until a
measurement says otherwise.

```
browser (React SPA) ──REST/OpenAPI──▶ Django + Ninja (web, Python 3.14) ──▶ PostgreSQL 18 (data, jobs,
     │ (sheet: engine buffers per sheet;         │                    events, search; row-level
     │  3D: three.js merged per storey, the      │                    security from M0)
     │  Discipline a per-Element state; tools)   └─ enqueue ─▶ worker ──▶ object store (FS dev / GCS beta)
     │                                                           └─ engine (pure Python)
     │                                                                read/: LibreDWG 0.14 (dwgread JSON,
     │                                                                  DXF → ezdxf) + ACadSharp cross-check,
     │                                                                  both sandboxed (bwrap: no network,
     │                                                                  read-only FS); pdfplumber / pypdfium2
     │                                                                recognise/ (applies Drafting Profiles),
     │                                                                families/<family>/ (structural,
     │                                                                architectural, MEP), measuring and
     │                                                                Checks (pure functions), assemble/,
     │                                                                render/ (per-sheet buffers + font table)
     └────────────── Jev (TypeSafe, US) ◀── platform's Jev client (answer cache, override log, fallback)
```

## The module map (higher layers import lower; modules on one line are independent)

| Layer | Modules | Own |
|---|---|---|
| 6 | `summary`, `exports`, `assistant`, `revisions` | The Project Summary, Target Cost warning, ৳ by stage, consumption ranges; Excel, PDF and the 3D share link with presentation; the Live Model's query (Level 2: one structured query over Elements, Attributes, Life Phases and money, words parsed by code, Jev for ambiguity, chips); every comparison split into quantity and price effect |
| 5 | `boq` | The Priced BOQ computed on read (cache keyed by a hash of the figure-feeding facts), Cost Basis per Takeoff Step (allowances as consumption per unit of floor area at Market Prices; MEP Parts' allowances until read), Estimate layers, Lump Sums and Provisional Sums, Construction Stage names, the Material Schedule, Issued Estimates freezing their Measurement Lines |
| 4 | `takeoff`, `measurement`, `rates` | Takeoff Steps per Discipline Part, Proposals with candidate geometry and Traces, Confirmations (steps may close with Questions open, "awaiting answer"), Questions, the Check catalogue with runs and findings, Coverage, the Developer's Specification, the confirm service, annotations (placed dimensions and note pins anchored to Element identity, from M2); Rule Sets per Market (Measurement Rules incl. MEP, junction ownership, rebar detailing), BOQ Items with Billing Units per unit system, Rebar Ratios, diameter splits; Resources, Market Price sets with their currency, Rate Analyses, Labour Contracts, Benchmarks per the Market's source, tax rates with kinds as data |
| 3 | `live_model` | Confirmed facts only, in SI: Element Families (Discipline Part, IFC class, classification references), Elements (per Building and Part, one per physical piece), Element States over Model Versions (typed core + `attrs` checked against Attribute Definitions), Attribute Definitions and their family applicability, Records (As built, As maintained), Element Relations, classification systems and references, the Building's storeys and grid, Element Traces, confirmed rebar; parametric data for the browser's 3D |
| 2 | `drawings` | Drawing Sets, Revisions, Sheets (Discipline, Building), Sheet Revisions, Drawing Set States, Views with confirmed scale, all in drawing units; files with the two-decoder cross-check, quarantine and the PDF upload report; the read job; the Trace anchor type; Drafting Profiles (per consultant office and Discipline; publishing needs permission and review) |
| 1 | `projects` | Project (its Market, currency, unit system, Target Cost, Saleable Area), Site, Buildings |
| 0 | `platform` | Tenancy and row-level security, Memberships (optionally scoped to Projects; Vextrus Engineers and outsiders by invitation), auth, Markets (currency, format profile, unit systems, languages, time zone, work week, home region), ids (`ids.new_id()`, UUIDv7), message catalogues, formatters per value kind, storage, the job-queue wrapper, the event outbox, the Jev client with its answer cache, override log and fallback |
| — | `engine` | Pure Python, no Django: `read/` (behind one reader interface), `recognise/` (candidates plus judgement requests; applies Drafting Profiles), `families/<family>/` (recognise, check, geometry, measure; structural, architectural and MEP families, dispatched by a registry generated from the directory), `assemble/`, `render/` |

**Where the code lives.** One uv project: the Django modules under `vextrus/<module>/`; `engine/` is a
top-level package beside `vextrus/` (no Django, no module imports). The platform module is always
imported as `vextrus.platform` (a bare `platform` is Python's standard library).

**Each module has the same anatomy** (ADR 0034; packages so parallel tickets never share a file):
- `models.py` and `migrations/`: private. Only the one ticket per wave that adds a migration to the
  module edits `models.py`.
- `services/`, `schemas/`, `http/`, `admin/`, `tasks/`: packages, each ticket owning its own submodule.
- The public surface stays `services` and `schemas`: `services/__init__.py` and `schemas/__init__.py`
  re-export, and a re-export line is the only shared edit. `http/__init__.py` exposes one `router`
  that includes the submodules' routers.
- `tests/`.

**Settings are a package,** `vextrus/settings/` (`base`, `db`, `auth`, `tenancy`, `jobs`, `storage`,
`uploads`, `jev`, `i18n`, `test`): every setting's name and default is written once in its submodule.

import-linter enforces the layers, the independence of siblings, the privacy of models, and `engine`'s
isolation. The shared files (INSTALLED_APPS, the root router, the import-linter config) change only when
a module is added, never per feature.

## Rules a build session follows
- **One module per feature.** A cross-module feature is two slices: the lower module's service first,
  then the upper module. An Element Family ticket only adds files under `engine/families/<family>/` and
  its family row; it never edits a shared registry (ADR 0031).
- **Across modules:** no ORM joins, signals or in-process event bus. A downward id is read through the
  owner's `services.py`; an upward id is an opaque stamp, never resolved. Slow work is a job.
- **Ownership:** Proposals and candidate geometry live in `takeoff`. Only `takeoff`'s confirm service
  writes As designed values into `live_model`, copying Trace anchors in; As built and As maintained values
  enter only as Records through `live_model.services`, never overwriting As designed (ADR 0037). Nothing
  enters the Priced BOQ unconfirmed.
- **The Live Model:** one per Building, one identity space, Discipline Parts sharing the Building's storeys
  and grid; Element Relations are typed and checked, and a Relation whose end changes or disappears raises
  a Question (ADR 0040). Every Attribute a state carries has a definition; keys are permanent.
- **Measuring is pure:** a function of (confirmed facts, pinned Rule Set version) in `engine`; `takeoff`
  previews it on Proposals, `boq` computes on read. Live money is never stored; an Issued Estimate freezes
  it down to its Measurement Lines (ADR 0028). Junction ownership is one function for quantities and 3D
  (ADR 0009).
- **Markets as data (ADR 0038):** no market literal in code; every visible string is a message; every
  figure goes through the formatter for its kind with the Project's Market; drawing notation is isolated
  left to right; CSS is logical only, and the sheet and 3D canvases never mirror.
- **Units (ADR 0008):** drawings and Proposals stay in drawing units; the confirm service converts to SI
  with exact factors; money is an exact Decimal in its quoted unit and the Market's currency, rounded to
  the currency's minor unit; quantities round per Measurement Line in the Billing Unit. Nothing that feeds
  a figure is a float. Display Units and grouping happen only at the edge.
- **Trace:** every figure carries one. A DWG anchor is (file hash, reader and version, sheet, insert
  handle chain, entity handle); a PDF anchor is (page, path index, box). An artefact an anchor names is
  never deleted.
- **Checks (ADR 0027):** pure functions over (read artefacts, confirmed state), never compared with the
  pipeline's own output; they run at reading and at every Confirmation. A firing Check raises a Question,
  a sanity range a flag. Counts show n / N with N from the drawing, never a hard-coded number; Coverage
  accounts for every view; a missing discipline is a Question, never zero.
- **Reading:** both decoders run on every upload; a disagreement quarantines the file (ADR 0029). Every
  insert's object-to-world transform is applied (mirrored inserts too); MTEXT angles come from their
  direction vectors; every geometry repair is guarded. A consultant office's conventions live in its
  Drafting Profile, never in reader code. Every engine PR carries the `real-drawings` status (ADR 0030).
- **Jev** picks among candidates code has found; code computes every number, owns storey ranges and
  grids, and if Jev is unavailable the QS picks (ADR 0011).
- **Data:** every tenant table has a row-level security policy in its first migration, reading the tenant
  through `nullif(current_setting('app.tenant_id', true), '')::uuid`; append-only tables are only ever
  appended to; constraints on populated tables are added by a role that bypasses row-level security, or
  before data; CI runs `makemigrations --check` and asserts one leaf per module; at most one ticket per
  wave adds migrations to a module. Ids come from `ids.new_id()`; migrations never name `uuid.uuid7`.
- **Jobs:** idempotent steps per file, then per sheet, with progress and cancel; arguments carry only the
  tenant id and ids; the CAD queue runs at concurrency 1 under its own memory cap; worker pools never rely
  on fork (Python 3.14 starts them with forkserver).
- **The viewer (ADR 0022):** merged per storey with the Discipline and state as per-Element data (merging
  per discipline doubles draw calls); MEP runs drawn as lines or instanced; every tool within the budgets
  on the reference setup before its milestone closes.
- Generated files (the OpenAPI schema and TS types) are never committed. Each worktree gets its own
  database, named by an environment variable; test databases are named by a hash of the migrations.

## The harness around the product (ADRs 0025, 0026, 0030; docs/sdlc.md)
Not part of the product and never imported by it: `scripts/score/` (vx-score, the blind scorer, from
M1), `scripts/real-drawings` with `scripts/real_drawings/` (the owner's real-drawing command),
`scripts/owner/`, `scripts/cloud/` and `.github/`. The owner reads these and `engine/read/sandbox.py` in
full.
- **The real-drawing command runs as the owner, inside bwrap:** no network, environment cleared,
  read-only `/usr`, the toolchain, a scratch checkout of the PR's head and the Development Sets; writable
  only one scratch directory and the drop folder `/srv/vextrus-drop`; neither the owner's home nor the key
  user's home is mounted. In M0 it posts the element-by-element change against the last merged run; from
  M1 it also writes the export the scorer reads.
- **Only the scorer runs as the key user,** with the owner's password: it takes no path, reads the drop
  folder and the Answer Keys, prints aggregates only, and posts the `real-drawings` status.
- **The status is posted by the owner's private GitHub App** (commit statuses only, its key with the key
  user), so a status posted with any other identity shows a different author.

## Stages
Development is native and free; the beta runs on Google Cloud in Mumbai on x86 (one VM, Cloud SQL
Enterprise with 7 days of point-in-time restore and 30 days of daily backups in Delhi); scale grows on
measured triggers; each further region is a cell with its own database and object store (ADR 0034).
