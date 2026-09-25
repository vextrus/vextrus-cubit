# The Python backend: framework, code architecture and module map

Researched 2026-09-25. Question: which Python backend framework and code architecture should Vextrus
use, so that it is production-grade enterprise Python, AI coding agents (Claude Code, Opus 5.5, many
parallel sessions in git worktrees) build it fast with little friction, and it grows through three
stages (free to move in development, hardened beta, scale)?

Sources: official docs, release notes and changelogs; package metadata from the PyPI JSON API and the
npm registry, and repository data from the GitHub API (all queried today); the source of two
packages, read from their published wheels. Two small probes were run in the scratchpad, outside the
repo: a **typing probe** (the same two models under mypy with the django-stubs plugin, pyright and ty,
and the SQLAlchemy 2 equivalent) and a **boundary probe** (the proposed module map as an empty package
with planted violations, checked by import-linter 2.15 and tach 0.35.1). Each claim cites `[S#]`,
listed in §10. Internal context: `docs/postmortem.md` (cause 6), `docs/handoff/session-9-critical-review.md`
§6, `docs/research/oce-data-model.md` §2, `docs/research/2d-to-bim-approaches.md`, and the ADRs.

**Bottom line.** Use **Django 6.x with Django Ninja**, on Postgres. It runs as **one process type for
the web and one for workers, from one package**. **Procrastinate** runs jobs on the same Postgres,
with no Redis. The CAD/geometry **engine** is a pure-Python package with no Django in it, and it runs
in worker processes. Build a **modular monolith**:
- one Django app per domain module;
- a public `services.py`/`schemas.py` surface per module;
- a one-way layer order, enforced by **import-linter** in the check;
- migrations per module, so parallel agents in different modules never share a file a feature has to
  touch.

The contract to the frontend is REST with OpenAPI 3.1, turned into TypeScript *types only*. The
generated file is never committed. Tenancy starts as a tenant column on every row, and Postgres
row-level security is added at beta. **The main weakness, and it was measured:** Django models are
typed only under mypy with the django-stubs plugin. Under pyright and ty the model fields come out
`Unknown`. So mypy is the type gate.

---

## 1. What the answer must satisfy (from our own documents)

- **Cause 6 of the post-mortem.** The ERP's enterprise stack "slowed agentic coding to a crawl". Cubit's
  opposite "still carried six seams and per-area registries that parallel agents collided on". The
  lesson: "clear module boundaries, one obvious place for each thing, fast feedback, and room to grow
  into production" (`docs/postmortem.md`).
- **Session 9's review.** "Every feature crosses all of it, and parallel agents collide on shared
  registries. That is why a wave needs an integration script" (`session-9-critical-review.md` §6).
- **Rules the plan must satisfy.** "A process proportionate to the stage"; "An architecture that
  agents build well and that can grow into enterprise production" (`docs/postmortem.md`).
- **The domain.**
  - Money is exact: ৳ in lakh and crore, from Rate Analyses (ADR 0006).
  - SI is used inside (ADR 0008).
  - Every figure carries a Trace (CONTEXT.md).
  - Elements keep a stable identity across Revisions (ADR 0015).
  - Rule Sets and market data are data, per Developer and per market (ADRs 0009, 0017).
- **The CAD side.** The chosen pipeline is LibreDWG `dwg2dxf` "run as a sandboxed separate process",
  then ezdxf, then IfcOpenShell (`2d-to-bim-approaches.md` §1). LibreDWG is GNU-licensed and has
  repeated fuzzing CVEs (same file, §3).
- **What OCE teaches (FastAPI + async SQLAlchemy).** From `oce-data-model.md` §2:
  - Fresh installs are built with `create_all`, not the migrations, and the two disagree on the UUID
    column type (there are 364 Alembic files).
  - Money and dates are stored as strings.
  - A 918-line module loader.
  - A 1,858-line central event-wiring file, with 31 subscriptions that nothing publishes.
  - `boq` imports 15 other modules.
  - A 9,939-line rules file.

  These are not FastAPI's faults. They show what a team invents when the framework leaves structure,
  migrations and module wiring to it.

## 2. Candidates

Figures are as of 2026-09-25. "Releases/12 mo" counts PyPI releases since 2025-09-25 [S1].

| | **Django 6.1 + Django Ninja 1.7** | Django + DRF 3.18 | **FastAPI 0.141 + SQLAlchemy 2.1 + Alembic** (± SQLModel) | Litestar 2.24 + Advanced Alchemy |
|---|---|---|---|---|
| **Maturity / governance** | Django: DSF with paid Fellows who "triage 10-15 new tickets each week and review and merge around fifteen non-trivial patches a week" [S11]. Ninja: 9.2k stars; 66 of its last 100 commits are by one maintainer (vitalik) [S17] | DRF: "feature-complete … generally do not accept new features" [S12] | FastAPI is 0.x: "each minor version could potentially include breaking changes" [S18]. 89 releases in 12 mo [S1]. SQLAlchemy 2.1.0 went final on 24 Sep 2026 [S21]. SQLModel is still 0.0.47 [S1, S23] | 8.5k stars [S25]. Last release 11 Jun 2026. A 3.0 milestone is open, with a branch `feat/v3-remove-sqlalchemy-completely` [S25] |
| **Support horizon** | 6.1 supported to Dec 2027. 6.2 LTS (Apr 2027) to Apr 2030. From "Django 2028", every release gets 3 years [S3, S4] | same | Pin to a minor version and upgrade by testing [S18] | not stated |
| **ORM / migrations** | ORM built in. Migrations are per app, autodetected, and run in one transaction on Postgres [S8]. Test databases are built by running the migrations unless you opt out with `--nomigrations` [S37] | same | SQLAlchemy ORM plus Alembic. Alembic keeps one revision graph; two developers starting from the same base get **multiple heads**, fixed by `alembic merge`. Per-module streams need `version_locations` and branch labels [S24] | Advanced Alchemy over SQLAlchemy (same Alembic) |
| **Decimal / dates / UUID** | `DecimalField` gives a Python `Decimal`; `UUIDField` is native `uuid` on Postgres; `DateField` [S9]. UUID7 database function added in 6.1 [S3] | same | `Mapped[Decimal]` with `Numeric`, native types (probe [S28]) | same |
| **Typing (measured [S28])** | mypy with the django-stubs plugin types fields, FKs and reverse relations. Pyright and ty return `Unknown` for model fields. django-stubs says pyright has "basic support", and pyright/ty "do not run the plugin" [S26] | the same, plus DRF needs separate stubs [S1] | SQLAlchemy 2 `Mapped[...]` is fully typed under pyright **and** ty with no plugin | as SQLAlchemy |
| **Validation / API schema** | Pydantic v2 (`pydantic>=2.0,<3`) [S1]. Built-in OpenAPI **3.1.0**, `export_openapi_schema` command, `py.typed` (wheel source [S16]) | DRF serializers; OpenAPI through a third-party package | Pydantic v2 (`pydantic>=2.9`) [S1], built-in OpenAPI | msgspec, and Pydantic optionally [S25] |
| **Async** | Async views work, but ORM "Transactions do not yet work in async mode" [S5] | sync | async-first. Under `AsyncSession`, lazy loading "will fail under asyncio", and one `AsyncSession` "is not safe for use in multiple, concurrent tasks" [S22] | async-first |
| **Jobs** | `django.tasks` API (6.0) with dev-only backends; production needs a third-party worker [S2, S6, S7]. Procrastinate runs on Postgres with Django integration [S36] | same | bring your own (Celery, Dramatiq, Procrastinate) | bring your own |
| **Auth / admin** | Built-in auth and sessions; django-allauth for MFA/SSO [S1]. Built-in admin for "an organization's internal management tool" [S10] | same | FastAPI prescribes no ORM, migrations, admin or auth [S19]. fastapi-users "is now in maintenance mode" [S20] | guards; no admin |
| **Structure it gives** | apps: models, migrations, admin and routers per app [S8, S14] | same | "rarely the case that you can put everything in a single file"; `APIRouter` per file, the rest is yours [S19] | layered controllers and DI |

Not considered further: Flask, Sanic, Falcon and the like. They have no ORM, migrations or typed
schemas of their own, so we would assemble the same pieces as the FastAPI column with less typing.

## 3. The recommendation, with reasons

**Django 6.1 now, moving to 6.2 LTS when it ships (April 2027) [S4], with Django Ninja for the API,
Postgres 16, Procrastinate for jobs, and a pure-Python engine package for CAD/geometry/IFC.**

1. **One obvious place for each thing, supplied by the framework rather than invented by us.** A
   Django app already has a fixed home for its models, migrations, admin and tests. Ninja [S13] adds a
   `Router` per app, mounted once in a root API [S14]. That is exactly the "one obvious place" cause 6
   asks for. OCE on FastAPI had to write its own 918-line loader and a central event file
   (`oce-data-model.md` §2). We should not repeat that.
2. **Per-module migrations fit parallel worktrees.** Django keeps each app's migrations in that app's
   own directory [S8]. So two agents working in different modules never touch the same migration
   chain. Two agents in the *same* module get the same number, which Django detects and linearises
   with `makemigrations --merge` [S8]. Alembic's default single graph produces multiple heads whenever
   two branches add revisions [S24]. Its per-module streams exist, but you must configure them.
3. **One migration path, with the right types.** The test database is built by running the migrations
   by default [S37]. That closes OCE's `create_all`-versus-migrations drift, which is a matter of
   discipline under Alembic. `DecimalField`/`Decimal`, native `uuid` and `DateField` are the defaults
   [S9]. Money is never a string.
4. **Batteries we need at beta come from maintainers with a schedule:** auth, sessions, CSRF, CSP (new
   in 6.0 [S2]), the admin, and a tasks API [S2]. On the FastAPI side:
   - the framework is still 0.x, and minor versions may break [S18];
   - SQLModel is 0.0.x [S1];
   - the common auth package is in maintenance mode [S20].

   Every one of those gaps is a piece an agent would assemble and we would maintain.
5. **The work is CPU-bound, so async-first buys little.** asyncio's own docs: a CPU-bound call
   "would delay" every task on the loop, and the cure is an executor, in a thread or a process [S39].
   Our heavy work is DWG parsing, geometry, IFC assembly and measurement. It belongs in worker
   *processes* whatever the framework. The request path is ordinary CRUD over Postgres. Sync Django
   avoids SQLAlchemy's async pitfalls (implicit IO on lazy loads fails; a session is not task-safe)
   [S22]. Those are the kind of bug an agent writes and a test misses.
6. **The admin is a real asset for "done with you".** A Vextrus Engineer sitting with a client's QS
   (ADR 0016) needs to inspect and correct data. Django's admin is meant exactly for "an organization's
   internal management tool", and not for the product's front end [S10].
7. **Ninja over DRF.** Ninja's schemas are Pydantic v2 [S1]. It ships OpenAPI 3.1.0, a schema export
   command and `py.typed` [S16], so one set of types serves validation, documentation and the TS
   client. DRF is "feature-complete" [S12]. That makes it a stable fallback, not a place new typing
   support will come from.

**What FastAPI + SQLAlchemy does better, stated plainly:**
- **Typing is better.** The probe shows SQLAlchemy 2 models fully typed under pyright and ty with no
  plugin, while Django's need mypy with its plugin [S28].
- **Async is native end to end.**

Choose FastAPI instead if the owner weighs editor/LSP typing above per-module migrations, the admin and
batteries. The module map below works in either.

### Typing policy (because of the measured gap)
- The type gate is **mypy (strict) with the django-stubs plugin** [S26, S28]. The plugin reads the app
  registry and declares reverse accessors [S26].
- The **engine package** (no Django) can also run under pyright or ty, which type it fully.
- Recheck ty when it leaves beta. Today it is "currently in beta", with 0.0.x versioning and
  "breaking changes … between any two versions" [S27].
- ruff is the linter and formatter, and uv runs one project with one lockfile, with no workspaces
  (the ERP's monorepo workspaces were part of what failed).

## 4. Architecture shape: a modular monolith with enforced one-way layers

### 4.1 The module map for the MVP

Each module is a Django app under `vextrus/`, except `engine`, which is plain Python. **Higher layers
may import lower ones, never the reverse; modules on the same line are independent of each other.**

| Layer | Module | Owns (CONTEXT.md terms) | Public surface used by others |
|---|---|---|---|
| 6 | `summary` | Project Summary (read-only composition), Target Cost warning | none (top) |
| 6 | `exports` | Priced BOQ to Excel, Priced BOQ and Material Schedule to PDF, 3D share link | none |
| 6 | `assistant` | AI Level 2: routes an Ask to read-only queries of lower modules through Jev; code computes every number (ADR 0011) | none |
| 6 | `revisions` | Revision Comparison: element-by-element differences between the Building Models of two Revisions, and the ৳ effect | none |
| 5 | `boq` | Priced BOQ, Material Schedule: map measured quantities to BOQ items, price them through Rate Analyses | `services`, `schemas` |
| 4 | `measurement` | Rule Sets, Measurement Rules, Rod Ratios, Rod Basis; turns Building Model elements into quantities with a Trace naming the rules (ADR 0009) | `services`, `schemas` |
| 4 | `rates` | Resources, Market Prices, Rate Analyses, Labour Contracts, Benchmark Rates, the Bangladeshi starting library (market as data, ADR 0017) | `services`, `schemas` |
| 4 | `takeoff` | Takeoff Steps, Proposals, Confirmations, Questions; carries Confirmations over to a new Revision by matching grid, storey and mark (ADR 0015); calls Jev for Level 1 judgments | `services`, `schemas` |
| 3 | `building_model` | Confirmed elements with stable identity, storeys and Storey Bands, grid; IFC and GLB output through `engine` | `services`, `schemas` |
| 2 | `drawings` | Drawing Sets, drawing-file Revisions, Sheets, Disciplines; upload, storage and the read job (DWG/vector PDF through `engine`); Trace anchors (sheet plus position) | `services`, `schemas` |
| 1 | `projects` | Project, Display Units choice, market, Target Cost value | `services`, `schemas` |
| 0 | `platform` | tenancy (Organisation, membership, the roles QS/MD/Vextrus Engineer), auth glue, units and money formatting (SI inside, lakh/crore outside, ADR 0008), storage, the job-queue wrapper, the Jev client with its fallback to the QS picking (ADR 0011) | `services` |
| — | `engine` | **Pure Python, no Django, no app imports:** `read/` (DWG to DXF through a sandboxed LibreDWG subprocess, ezdxf, vector PDF), `recognise/` (rules and cross-sheet checks), `assemble/` (IfcOpenShell, GLB) | its package API |

Why this shape:
- **`rates` is independent of the model.** Rate-library work and takeoff work can run in parallel
  from day one.
- **`takeoff` and `measurement` are siblings.** The Priced BOQ filling in as the Takeoff proceeds
  (ADR 0007) is a screen that reads `boq`, not an import from `takeoff`.
- **AI is split by level.** The Jev client is low (`platform`), used by `drawings`/`takeoff` for Level 1.
  The Level 2 assistant is top-level and read-only.
- **The moat lives in `engine`, testable without a database.** It is where most reading work happens.
  Its tests are fast unit tests over DXF/PDF inputs. It is imported by `drawings`, `takeoff` and
  `building_model` and imports none of them.

### 4.2 Anatomy of one module (identical everywhere)

```
vextrus/boq/
  models.py        private: tables (FKs to other modules by string, e.g. "rates.RateAnalysis")
  migrations/      private: this module's own chain
  services.py      PUBLIC: the functions other modules may call (commands and queries)
  schemas.py       PUBLIC: Pydantic v2 types in and out (also the HTTP contract)
  http.py          Ninja Router for this module's endpoints
  admin.py         internal admin
  tasks.py         Procrastinate jobs owned by this module
  tests/
```

The only shared files are:
- `INSTALLED_APPS`;
- the root API, one `add_router(...)` line per module (Ninja accepts a dotted string [S16]);
- the import-linter config.

All three change when a **module** is added, not when a feature is. Module settings live in the
module, not in `settings.py`.

### 4.3 Enforcement (tried on this map: the boundary probe [S31])

**import-linter** [S29], in the check command:
- **a `layers` contract** with `containers = vextrus` and the table's order (`summary | exports |
  assistant | revisions`, `boq`, `measurement | rates | takeoff`, …). `|` marks independent siblings;
- **a `forbidden` contract** that stops `vextrus.engine` importing any app or `django` (this needs
  `include_external_packages = True`);
- **one `protected` contract per module**, so that `models` is importable only from inside its own
  module.

In the probe, all four planted violations were reported and the legal `boq → rates, measurement`
imports passed:
- a sibling import (`measurement → takeoff`);
- an upward import (`drawings → takeoff`);
- `engine → django` and `engine → drawings.models`;
- `summary → boq.models`.

Tach 0.35.1 caught the same boundary breaks with one generic `[[interfaces]]` rule. It did not flag
`engine → django` in the probe's configuration. Its repository has moved from `gauge-sh` to `tach-org`
(GitHub redirect), while its docs still sit at `docs.gauge.sh` [S30]. Its per-module `depends_on` list
is also a file every cross-module feature edits. **Use import-linter**, which has released steadily
since 2019 [S1]; keep tach as the alternative.

**What no import linter sees:** ORM joins across modules (`filter(sheet__drawing_set=...)`) and Django
signals. Two rules:
- a cross-module read goes through the owner's `services.py`;
- no signals and no in-process event bus across modules in the MVP. A higher module calls the lower
  one, and slow work is a job.

This follows from OCE, whose string-matched bus left 31 subscriptions with no publisher
(`oce-data-model.md` §2).

### 4.4 Where the CAD/geometry pipeline runs

- **In a worker process, never in the web process.** Uploading a Drawing Set enqueues a
  Procrastinate job (`drawings.tasks`). The worker calls `engine`, stores the result, and the UI polls
  the job's state. Procrastinate provides retries, locks, periodic tasks and priorities on Postgres
  13+, and it has Django migrations and admin integration [S36]. There is no Redis and no second
  datastore.
- **LibreDWG as a subprocess** with a time and memory limit, because of its GNU licence and its CVEs
  (`2d-to-bim-approaches.md` §3). A crash then kills one conversion, not the worker.
- **Two queues from day one** (`cad` for heavy reads, `default` for the rest), so a large DWG cannot
  starve light jobs. That is configuration, not a service.
- **The same codebase and lockfile.** The worker is the same package started with a different command,
  not the ERP's "separate Python service".
- **Pin Python to 3.13 or 3.14.** IfcOpenShell requires `<3.15` [S1], and Django 6.x requires ≥3.12 [S2].
  Free-threaded Python is supported in 3.14 but optional, with about 10% single-thread overhead
  (PEP 779 [S40]). Nothing here needs it; processes do the parallel work.

### 4.5 How parallel agents avoid colliding

- **One agent per module per wave.** A feature normally lives inside one module directory. A
  cross-module feature is two slices: first the lower module's `services.py`, then the upper one.
- **Each worktree has its own database.** The DB name comes from an environment variable set per
  worktree. pytest-django gives each xdist worker its own database, and `--reuse-db` keeps it between
  runs [S37]. Postgres runs natively (no Docker in dev: the ERP lesson).
- **Fast feedback per module.** `pytest vextrus/<module>` plus mypy plus `lint-imports` is the loop.
  Tests roll back a transaction per test, and `transaction=True` is the slow exception [S37]. The
  Claude Code guidance is to "Give Claude a check it can run" [S41]; this is that check, scoped to what
  the agent touched.
- **Generated artefacts are never committed.** The OpenAPI schema and the TS types are regenerated by
  the dev and CI commands. Two branches therefore never conflict on a generated file (see §5).

## 5. The contract to the frontend

- **What we use.** REST from Ninja, with OpenAPI 3.1 produced from the Pydantic schemas [S16]. On the
  client, **openapi-typescript** generates "runtime-free types" "within milliseconds" [S38], used
  through the small `openapi-fetch` client [S38].
- **Why this is not the ERP's GraphQL codegen:**
  - there is no second schema language and no resolver layer;
  - there is no generated runtime client;
  - the types are a pure function of the backend's schemas, regenerated in one step and not committed.

  CI regenerates them and type-checks the frontend, so drift is caught where it happens.
- **Rejected alternatives.** Hand-written TS types drift silently. tRPC is TypeScript-only, and Cubit's
  stack used it with the problems in cause 6. Whether the frontend is an SPA at all is the frontend
  research's decision. The takeoff canvas and the 3D viewer suggest a rich client.

## 6. Multi-tenancy

| Option | For | Against |
|---|---|---|
| **Tenant column** (`organisation_id` on every tenant-owned row, filtered in services) | Simplest; one schema, one migration run; shared reference data (the PWD library, default Rule Sets) sits naturally beside tenant data | One forgotten filter leaks data |
| **Plus Postgres RLS** | The database enforces it. With RLS enabled and no policy, access is "default-deny" [S32]. Policies read a per-transaction setting set by `set_config(…, true)`, which reverts when the transaction ends [S34] | Superusers and `BYPASSRLS` roles "always bypass", and table owners bypass unless `FORCE ROW LEVEL SECURITY` [S32]. Unique and FK checks can reveal that a hidden value exists, so surrogate keys are needed [S33] |
| Schema per tenant (django-tenants) | Strong isolation | Sets the `search_path` per request by hostname [S35]. `migrate_schemas` runs across every schema (a parallel executor exists) [S35]. Cross-tenant benchmarks and shared libraries get harder |

**Recommendation.**
- **Development:** a tenant column from the first table, since it is cheap now and a rewrite later.
- **Beta:**
  - add RLS policies on every tenant table through migrations, with `FORCE ROW LEVEL SECURITY`;
  - the app connects as a non-owner role without `BYPASSRLS`;
  - a middleware sets the tenant per transaction.
- **Avoid:** schema-per-tenant, and the young `django-rls` package, whose first release was July 2025
  [S1]. The policies are a few lines of SQL we own.

## 7. The three stages

| Stage | Add | Why then |
|---|---|---|
| **Development (now)** | Django 6.1, Ninja, Postgres 16 (native, on 5544), Procrastinate worker with `cad` and `default` queues, the `engine` package, the tenant column, local file storage through Django `STORAGES`, uv, ruff, mypy with django-stubs, pytest-django, import-linter, the OpenAPI to TS types step | The minimum that keeps boundaries and fast checks from day one. No Redis, no Docker, no second service |
| **Beta (a few Developers)** | RLS (§6); django-allauth with MFA [S1]; S3-compatible object storage for drawings and IFC/GLB; Sentry and structured logs (sentry-sdk, django-structlog [S1]); an audit trail of Confirmations (django-pghistory [S1]); CSP on [S2]; a frozen `/api/v1`; backups with point-in-time recovery; the worker on its own host with limits; LibreDWG in an OS sandbox | Real client data, and the MD relies on the numbers. Confirmations are a record, so an audit trail is needed |
| **Scale** | Upgrade to Django 6.2 LTS (Apr 2027) [S4]; more web processes behind an ASGI/WSGI server; worker pools per queue; read replicas; pgvector for project memory (`docs/intent.md`); OpenTelemetry (an instrumentation package exists [S1]); split `engine` into its own service **only if** a measurement shows it is needed | By then it is already process-separated and has no Django in it, so the split is cheap |

## 8. Against the two failed stacks

| Failed choice | Where | Here |
|---|---|---|
| Workspaces monorepo, a separate design-system package | ERP | One uv project, one lockfile; the frontend's packaging is its own decision |
| NestJS/CQRS/DDD ceremony | ERP | Plain Django apps: models, services, schemas. No command/query buses, no repositories over the ORM |
| GraphQL plus generated clients | ERP | REST plus OpenAPI 3.1, types only, never committed (§5) |
| Prisma, plus a separate Python web service | ERP | One Python backend. The CAD engine is a package inside it, run by the worker |
| Redis | ERP | Postgres does jobs (Procrastinate) |
| Docker in dev | ERP | Native Postgres; `uv run` |
| Six seams, per-area registries every feature touched, an integration script per wave | Cubit | Shared files change only when a module is added (§4.2). Migrations are per module. Boundaries are enforced by one linter, not by registries |
| "One schema lane" | Cubit | Each module owns its tables and migrations; FKs across modules point downward only |
| pg-boss plus a Python CAD lane over a seam | Cubit | One language on the server; job and engine in the same package |
| One verify command for everything | Cubit | A check scoped to the module touched, with the full suite in CI |

## 9. Risks and unknowns

1. **The typing gap (measured).** Pyright and ty see Django model fields as `Unknown` [S28]. Claude
   Code's code-intelligence plugins and the editor may therefore under-report errors in model code.
   mypy with the plugin is the gate [S26]. This is the strongest argument for FastAPI + SQLAlchemy.
2. **Django Ninja depends on one maintainer** (66 of its last 100 commits [S17]). It is a thin layer:
   services and schemas do not depend on it, and DRF or plain Django views are the fallback [S12].
3. **The ORM joins across modules** without an import, so the linter cannot see them (§4.3). This is a
   code-review rule, not a mechanical one.
4. **Procrastinate is smaller** (1.4k stars, GitHub API). Keep it behind the `platform` job wrapper. The
   `django.tasks` API [S6] is the seam to move to if a production backend matures. Of the listed
   backends, `django-tasks-db` is ORM-based and new [S7].
5. **Django async.** ORM transactions are sync-only [S5]; Ninja's async views use the same `a`-prefixed ORM calls [S15]. If live progress (SSE or websockets) is
   needed, it is a small async surface, or it is polling.
6. **Not measured here:**
   - how fast Opus 5.5 actually builds in Django compared with FastAPI;
   - test-suite speed at size;
   - Procrastinate's throughput under large DWG jobs.

   A one-module spike (for example, `rates` with its API, admin and tests) in each stack would settle
   the first two in about a day, if the owner wants evidence before deciding.
7. **Versions to pin.** Django ≥3.12 [S2]; IfcOpenShell <3.15 [S1]; SQLAlchemy 2.1 made `greenlet` an
   explicit install [S21] (only relevant if the FastAPI option is chosen).

## 10. Sources

- [S1] PyPI JSON API, `https://pypi.org/pypi/<name>/json`, queried 2026-09-25, for django,
  django-ninja, djangorestframework(-stubs), fastapi, sqlalchemy, sqlmodel, alembic, litestar,
  advanced-alchemy, pydantic, django-stubs, django-types, procrastinate, celery, dramatiq,
  django-tasks, django-tasks-db, import-linter, tach, ty, pyright, mypy, ruff, uv, django-tenants,
  django-rls, django-allauth, fastapi-users, django-structlog, sentry-sdk, django-pghistory,
  opentelemetry-instrumentation-django, ifcopenshell, psycopg (versions, dates, release counts,
  `requires_python`, `requires_dist`).
- [S2] Django 6.0 release notes, https://docs.djangoproject.com/en/6.1/releases/6.0/
- [S3] Django 6.1 release notes, https://docs.djangoproject.com/en/6.1/releases/6.1/
- [S4] Django downloads, supported versions, https://www.djangoproject.com/download/
- [S5] Django, Asynchronous support, https://docs.djangoproject.com/en/6.1/topics/async/
- [S6] Django, Tasks framework, https://docs.djangoproject.com/en/6.1/topics/tasks/
- [S7] Django community ecosystem, Tasks, https://www.djangoproject.com/community/ecosystem/
- [S8] Django, Migrations, https://docs.djangoproject.com/en/6.1/topics/migrations/
- [S9] Django, Model field reference, https://docs.djangoproject.com/en/6.1/ref/models/fields/
- [S10] Django, The admin site, https://docs.djangoproject.com/en/6.1/ref/contrib/admin/
- [S11] Django Software Foundation, Fundraising (Fellowship), https://www.djangoproject.com/fundraising/
- [S12] Django REST framework, Contributing, https://www.django-rest-framework.org/community/contributing/
- [S13] Django Ninja, https://django-ninja.dev/
- [S14] Django Ninja, Routers, https://django-ninja.dev/guides/routers/
- [S15] Django Ninja, Async support, https://django-ninja.dev/guides/async-support/
- [S16] django-ninja 1.7.1 wheel source: `ninja/py.typed`; `ninja/openapi/schema.py` (`("openapi", "3.1.0")`);
  `ninja/management/commands/export_openapi_schema.py`; `ninja/router.py` (`add_router` accepts
  `Union["Router", str]` and calls `import_string`).
- [S17] GitHub REST API, commits since 2025-09-25 (first 100), for vitalik/django-ninja,
  fastapi/fastapi, litestar-org/litestar and django/django; repository stats for each, queried
  2026-09-25.
- [S18] FastAPI, About FastAPI versions, https://fastapi.tiangolo.com/deployment/versions/
- [S19] FastAPI, Bigger applications, https://fastapi.tiangolo.com/tutorial/bigger-applications/
- [S20] fastapi-users README (GitHub API), "This project is now in maintenance mode."
- [S21] SQLAlchemy blog, "SQLAlchemy 2.1.0 Released" (24 Sep 2026), https://www.sqlalchemy.org/blog/
- [S22] SQLAlchemy 2.0, Asynchronous I/O, https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- [S23] SQLModel, https://sqlmodel.tiangolo.com/
- [S24] Alembic, Working with branches, https://alembic.sqlalchemy.org/en/latest/branches.html
- [S25] Litestar repository https://github.com/litestar-org/litestar, with releases, milestones and
  branches through `gh api`.
- [S26] django-stubs README, https://github.com/typeddjango/django-stubs
- [S27] ty README, https://github.com/astral-sh/ty ("ty is currently in beta"; version policy)
- [S28] Typing probe, run 2026-09-25 in the scratchpad. It used Django 6.1.1, django-stubs 6.1.1 and
  mypy strict with the plugin, pyright 1.1.414, ty 0.0.84, SQLAlchemy 2.1.0, and django-types 0.24.0
  under pyright. The models were `RateAnalysis(rate: DecimalField)` and `Resource(analysis: FK,
  related_name="resources")`, and each checker revealed the types.

  | Checker | `a.rate` | `r.analysis` | `a.resources.all()` |
  |---|---|---|---|
  | mypy with the plugin | `Decimal` | `RateAnalysis` | `QuerySet[Resource]` |
  | pyright with django-stubs | `Unknown` | `Unknown` | error |
  | ty with django-stubs | `Unknown` | `Unknown` | error |
  | pyright with django-types | `Decimal` | `RateAnalysis` | error, until the reverse relation is declared by hand |
  | SQLAlchemy 2, under pyright and under ty | `Decimal` | `RateAnalysis` | `list[Resource]` |
- [S29] import-linter docs, https://import-linter.readthedocs.io/en/stable/, and the 2.15 wheel source
  (`contracts/layers.py`, `contracts/protected.py`; wildcard support in `domain/fields.py`).
- [S30] Tach README (https://github.com/tach-org/tach; `github.com/gauge-sh/tach` returns a 301
  redirect to it) and Interfaces docs, https://docs.gauge.sh/usage/interfaces
- [S31] Boundary probe, run 2026-09-25 in the scratchpad. The §4.1 map was built as an empty package
  with four planted violations. import-linter 2.15 (layers, forbidden and protected contracts)
  reported all four and kept the legal imports. Tach 0.35.1 reported the boundary and interface
  breaks; in that configuration it did not report `engine → django`.
- [S32] PostgreSQL 16, Row Security Policies, https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- [S33] PostgreSQL 16, CREATE POLICY, https://www.postgresql.org/docs/16/sql-createpolicy.html
- [S34] PostgreSQL 16, System administration functions (`current_setting`, `set_config`),
  https://www.postgresql.org/docs/16/functions-admin.html
- [S35] django-tenants docs, https://django-tenants.readthedocs.io/en/latest/ and `/use.html`
- [S36] Procrastinate docs, https://procrastinate.readthedocs.io/en/stable/, and README
- [S37] pytest-django, Database access, https://pytest-django.readthedocs.io/en/latest/database.html
- [S38] openapi-typescript, https://openapi-ts.dev/introduction. The npm registry was queried
  2026-09-25 (openapi-typescript 7.13.0, openapi-fetch 0.17.0).
- [S39] Python docs, Developing with asyncio, https://docs.python.org/3/library/asyncio-dev.html
- [S40] PEP 779, https://peps.python.org/pep-0779/
- [S41] Claude Code, Best practices, https://code.claude.com/docs/en/best-practices
