# The stack: one Django modular monolith, one Postgres, native development and a Mumbai beta

**The backend** is Python 3.13, Django 6.1 with Django Ninja (REST, OpenAPI 3.1), uv, ruff, mypy with
django-stubs and pytest-django; it moves to Django 6.2 LTS when it ships. It is one application of 13
modules in one-way layers, enforced by import-linter (the map: docs/architecture.md). Each module owns
its tables and its own migration chain and exposes only `services.py` and `schemas.py`. The CAD work
lives in `engine`, pure Python that imports no Django and no module, run by worker processes of the
same package; the DWG readers are sandboxed subprocesses (ADRs 0029, 0031). No ORM joins or signals
across modules, no in-process event bus; a cross-module read goes through the owner's `services.py`.
The frontend and viewers are ADR 0022.

**All state lives in one Postgres 16:** typed tables with foreign keys inside a module, exact
decimals in the units ADR 0008 sets; Elements with a stable identity and states over a range of Model
Versions; Proposals, Confirmations, Questions and Traces as real tables (docs/data-model.md). Jobs are
Procrastinate, queued in the same transaction as their data. Search is full-text and trigram now,
pgvector later. Each change writes an event row in its own transaction; LISTEN/NOTIFY only nudges.
**Tenancy from M0:** a tenant column on every tenant table, row-level security with a policy in the
table's first migration, the app connecting as a non-owner role, and a CI test that every table has a
policy. A Vextrus Engineer enters a Developer's data only by its invitation: a named QS member,
time-bound (30 days by default, renewable), revocable, every action under their own name, visible to
the client. **Every Membership may be scoped to a list of Projects** (none = all), and anyone from
outside the Developer (a consultant's engineer, a contractor's QS, later a site engineer or facility
staff) enters the same way: a named person invited into the Developer's tenant, scoped to Projects and
a role, time-bound where the Developer wants it; the data never leaves the tenant; the Django admin obeys the same policies, and operators reach raw data only through the
beta's audited database path. Files go to the local filesystem in development and S3 from the beta.

**Stages.** Development is native on WSL2, about $0, no Docker; cloud sessions serve as previews; CI
is GitHub Actions, which builds LibreDWG once; Logfire and Sentry free tiers. The beta runs in AWS
ap-south-1 (Mumbai, 44 ms from Dhaka), about $87–123 a month: one x86 VM with web and worker
containers, RDS Postgres (14 days point-in-time restore), S3, and a small staging VM with its own
small database (about $15 a month). Targets: 99.5 % uptime, about 5 minutes of data loss at most,
restored within 4 hours. Beta hardening: a monthly restore drill, staff MFA, rate limits and an audit
table, client terms naming where data is processed. Scale (about $860–1,110 a month for Bangladesh):
the same image on ECS Fargate, Multi-AZ RDS, queue-scaled workers; the Gulf gets its own deployment
in AWS's UAE region. Every addition needs a measured trigger. Bangladesh's Personal Data Protection
Act 2026 allows data abroad with consent or under contract (our reading; a lawyer checks before the
beta).

**Why.** Django gives per-module migrations (parallel agents never share one chain), test databases
built from the migrations, and Decimal, UUIDs, auth, the admin and security from a scheduled release;
the cost, accepted, is mypy as the type gate. One Postgres means one datastore to run.

**Rejected.** FastAPI + SQLAlchemy (one Alembic chain; still 0.x), NestJS, CQRS, DDD machinery, event
sourcing, GraphQL, a separate Python service, monorepo tooling, Docker in development, Redis, a
separate vector database, a columnar copy (returns only if a slow query is measured), DigitalOcean
Bangalore for the beta.

## History
- 25 Sep 2026: decided as ADRs 0020 (backend), 0021 (one Postgres) and 0023 (deploy). Evidence:
  docs/research/stack-backend.md, stack-data.md, stack-deploy.md.
- 26 Sep 2026: row-level security from M0, not the beta (refuter #6, architecture critic #11,
  docs/reviews/). Recommended with the milestone order the owner ruled on ("M4 first"); it stands
  unless the owner rules otherwise.
- 26 Sep 2026 (owner's decision): Vextrus Engineers enter a tenant only by invitation. The owner's
  ruling: "Agree".
- 26 Sep 2026: x86 beta instead of t4g, staging's own database, sandboxing from M0 and the job rules
  (ADR 0031). The owner's ruling: "Agree with the bundle".
- 26 Sep 2026: units follow ADR 0008 (not "SI everywhere"); Element states carry validity ranges
  (docs/data-model.md). 0020, 0021 and 0023 merged into this ADR (session 01 brief, finish line 8).
- 27 Sep 2026 (owner's decision, session 02 Q11): Memberships may be scoped to Projects from M0, and
  outside parties enter only by named, scoped invitation into the Developer's tenant (the Vextrus
  Engineer pattern generalised); cross-organisation sharing is rejected until consultants pay
  themselves. The owner's ruling: "Agree with B on Q11."
- 27 Sep 2026 (owner's decision, session 02 Q15): UUIDv7 ids everywhere, file keys prefixed by the tenant,
  and a home region (cell) per Developer (ADR 0038); where the Gulf's cell goes waits for the hosting
  research (docs/research/global-markets-foundation.md §0: AWS's UAE region damaged, Bahrain unavailable).
