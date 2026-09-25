# The backend is one Django modular monolith with enforced one-way layers and a Django-free engine

The backend is Python 3.13, Django 6.1 with Django Ninja (REST, OpenAPI 3.1), managed with uv and
checked with ruff, mypy (django-stubs) and pytest-django. It moves to Django 6.2 LTS when it ships.
It is one application of 13 modules in one-way layers, enforced by import-linter. Each module owns
its tables and its own migration chain, and exposes only `services.py` and `schemas.py`. The CAD work
lives in `engine`, a pure-Python package that imports no Django and no module. It runs in worker
processes, with LibreDWG as a sandboxed subprocess.

Why Django over FastAPI + SQLAlchemy:
- **Per-module migrations.** Parallel agents never share one migration chain; Alembic's single chain
  forks when branches collide.
- **Tests build their database by running the migrations,** so a fresh install cannot drift from
  them (OpenConstructionERP's FastAPI stack drifted: docs/research/oce-data-model.md).
- **Built in:** Decimal money, native UUIDs, auth, the admin (useful when a Vextrus Engineer sits
  with a client) and security, from a framework released on a schedule. FastAPI is still 0.x.

The cost, accepted: pyright and ty cannot type Django model fields, so mypy with django-stubs is the
type gate.

Rules no linter sees:
- no ORM joins or signals across modules;
- no in-process event bus in the MVP;
- a cross-module read goes through the owning module's `services.py`.

Against the failed stacks: no NestJS, CQRS or DDD machinery, no GraphQL, no separate Python service
(the worker is the same package with another command), no monorepo tooling, no Docker in development.
The shared files (INSTALLED_APPS, the root router, the import-linter config) change only when a
module is added, never per feature. That removes Cubit's shared-registry collisions. Details:
docs/research/stack-backend.md and docs/architecture.md.
