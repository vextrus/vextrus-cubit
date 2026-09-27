# Python 3.14 and PostgreSQL 18 for the build: readiness, measured (27 Sep 2026)

Session 02. A background agent checked whether the build should start on Python 3.14 and PostgreSQL 18
instead of 3.13 and 16 (ADR 0034), because the product wants app-made UUIDv7 keys (Python 3.14 adds
`uuid.uuid7()`; Django 6.1's `UUID7()` database function needs PostgreSQL 18) and changing a database's
major version after data exists is costly. Scratch work: `.private/work/session-02/stack-check/`
(about 1.2 GB; the owner may delete it).

## Conclusions
**Nothing blocks it.** Every package on the stack installs from binary wheels on Python 3.14 (Linux
x86_64) and ran a small real task; PostgreSQL 18.6 ran Django 6.1, Procrastinate, pgvector and our
row-level security pattern with the same results as 16. Recommendation: pin Python 3.14 and PostgreSQL
18.6 everywhere now (local, cloud, CI, the beta's managed Postgres); generate keys in the app through one
project function (`ids.new_id()` over `uuid.uuid7`), and do not rely on database-side `UUID7()` defaults.

## Problems to handle (read first)
1. **ezdxf has no cp314 wheel (1.4.4)**: on 3.14 it runs pure Python. Measured on a 20 MB real DXF: read
   the same (~3.9 s); bounding boxes 3.2 → 5.3 s; block explode 0.15 → 0.25 s; 300k matrix transforms
   0.04 → 0.56 s. Fix, tested: build it from source (`uv --no-binary-package ezdxf`, ~90 s once, cached),
   which restores 3.13 speed; CI and the image then need `g++`. Likely cause: ezdxf's wheel workflow pins
   cibuildwheel v2.22 (3.14 by default from v3.1.0). The only one of 81 packages with this gap.
2. **Migrations record a key generator by its import path**: a migration made on 3.14 with
   `default=uuid.uuid7` fails to load on 3.13. All environments switch together; route ids through
   `ids.new_id()` so migrations never name `uuid.uuid7` or a backport (tested on both).
3. **`db_default=UUID7()` works only on PostgreSQL 18**; app-made keys need neither.
4. **The cloud environments ship PostgreSQL 16**: the setup script needs `apt.postgresql.org` on the
   environment's allowlist and `postgresql-18` installed (care over port 5432); setup time unmeasured.
5. **Local WSL**: the owner installs PostgreSQL 18 from the PostgreSQL apt repository (`postgresql-18`
   18.6, `postgresql-18-pgvector` 0.8.6 for noble).
6. **Not verified: RDS PostgreSQL 18.6 in ap-south-1.** RDS has offered 18 since 14 Nov 2025 (18.1), 18.6
   since 25 Aug 2026; Aurora PostgreSQL 18.3 is in all commercial regions. Confirm with `aws rds
   describe-db-engine-versions --engine postgres --engine-version 18.6 --region ap-south-1` (or the
   equivalent on the chosen provider).
7. **Python 3.14 starts multiprocessing with `forkserver` on Linux**: the engine's worker pools must not
   rely on fork.
8. **On either version:** (a) after a transaction-local `set_config('app.tenant_id', …, true)` the setting
   reads back as `''` in later transactions, so `current_setting(...)::uuid` raises: write policies as
   `nullif(current_setting('app.tenant_id', true), '')::uuid` (reproduced on 16.15 and 18.6; with it,
   both isolate identically); (b) a Procrastinate worker run inside the Django process must use
   `app.with_connector(app.connector.get_worker_connector())` or job arguments arrive as a string.

## Evidence
- **Django:** 6.1 (6.1.1, 2 Sep 2026) supports Python 3.12–3.14 and PostgreSQL 15+, extended support to
  Dec 2027; 6.2 LTS (due Apr 2027) Python 3.12–3.14, PostgreSQL 16+, support to Apr 2030. `UUID7()` is
  new in 6.1 (PostgreSQL 18+, MariaDB 11.7+, SQLite on Python 3.14+). Sources:
  https://docs.djangoproject.com/en/6.1/releases/6.1/ ; https://docs.djangoproject.com/en/6.1/ref/models/database-functions/ ;
  https://docs.djangoproject.com/en/dev/releases/6.2/
- **Packages on Python 3.14.7** (binary wheels only, imported and exercised): psycopg 3.3.6 (cp314,
  libpq 18), django-ninja 1.7.1, procrastinate 3.10.0 (its CI tests 3.14 × PG 18), ezdxf 1.4.4 (pure only),
  shapely 2.1.2, numpy 2.5.3, pdfplumber 0.11.10, pdfminer.six 20260107, pypdfium2 5.13.0, ifcopenshell
  0.8.5 (py314 wheel; requires Python < 3.15), XlsxWriter 3.2.9, WeasyPrint 70.0, mypy + django-stubs
  2.3.1 + 6.1.1 (strict run passed), import-linter 2.15, pytest-django 4.14.0, babel 2.18.0 (en_IN
  1,23,45,678.5), logfire 5.1.1, sentry-sdk 2.70.0, typesafe-sdk 0.7.2. Source: https://pypi.org/pypi/<pkg>/json
- **PostgreSQL 18:** GA 25 Sep 2025, current 18.6 (13 Aug 2026); community end of life 18 on 14 Nov 2030
  (16 on 9 Nov 2028); RDS standard support 18 to 28 Feb 2031 (16 to 28 Feb 2029); RDS 18.6 extensions
  pgvector 0.8.2, pg_trgm 1.6, pgAudit 18, pg_cron 1.6.7. A local 18.6 trial: `uuidv7()`, Django
  `db_default=UUID7()` and `CREATE EXTENSION vector` (0.8.6) work; checksums on; `io_method=worker`.
  Release-note incompatibilities touch nothing in row-level security (checksums on by default; MD5
  passwords deprecated; AFTER triggers run as the queuing role; generated columns virtual by default).
  PostgreSQL 19 is at Beta 4 (24 Sep 2026): too early. Sources: https://www.postgresql.org/support/versioning/ ;
  https://www.postgresql.org/docs/18/release-18.html ; https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html ;
  https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-rds-postgresql-18-6-17-11-16-15-15-19-14-24/
- **GitHub Actions:** setup-python has 3.14.7 for Ubuntu 24.04; `postgres:18.6` or
  `pgvector/pgvector:0.8.6-pg18` service images (the runner's own Postgres is 16.15). A sample workflow
  passes actionlint (not run on GitHub).
- **Python lifecycles:** 3.13's last bugfix release is 6 Oct 2026 (PEP 719), then security fixes only to
  Oct 2029; 3.14 bugfixes to Oct 2027, security to Oct 2030 (PEP 745); 3.15 ruled out for now
  (IfcOpenShell < 3.15; Django lists 3.14 as highest).
- **Fallbacks:** on 3.13, `uuid-utils` 1.0.0 or `uuid6` behind `ids.new_id()`; on PostgreSQL 16, app-made
  keys only.

## Scope of the tests
ezdxf timed on two real DXFs; IfcOpenShell and WeasyPrint smoke-tested only; the CI workflow not run on
GitHub; RDS in ap-south-1 unconfirmed.
