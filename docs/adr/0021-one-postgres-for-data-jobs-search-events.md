# One Postgres holds the data, the jobs, the search and the events

All state lives in one Postgres:
- **Data:** typed tables with real foreign keys; exact decimals, stored in SI.
- **Elements:** one stable identity across Revisions, with a state row per Revision.
- **Takeoff records:** Proposals, Confirmations, Questions and Traces are real tables.
- **Tenancy:** a tenant column on every tenant table, enforced by row-level security from the beta.
  The app does not connect as the table owner, and a test checks every table has a policy.
- **Jobs:** Procrastinate queues each job in the same transaction as its data.
- **Search:** full-text search and trigram matching now, pgvector for project memory later.
- **Events:** an event row written in the same transaction as each change feeds the watcher that
  wakes; LISTEN/NOTIFY only nudges it.

Files (uploads, derived DXF, IFC, GLB and exports) go to the local filesystem in development and to
S3 from the beta. IFC is an export, and the browser views GLB.

Rejected:
- **Redis.** No second datastore to run.
- **A separate vector database.** OpenConstructionERP's, fed by an in-process bus, loses events on a
  crash.
- **Event sourcing and CQRS.** They are a poor fit for an MVP and part of why the old ERP failed.
- **A columnar copy (Parquet + DuckDB).** It returns only if a slow query is measured.

Every later addition needs a measured trigger. Details: docs/research/stack-data.md.
