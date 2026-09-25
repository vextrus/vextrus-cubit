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

## Amended: row-level security from M0 (26 Sep 2026)
M5's row-level security would have added a policy and a migration to every module while M3 and M4
worked in them (refuter #6, architecture critic #11, docs/reviews/). So from M0 the app connects as a
non-owner role, every tenant table has a policy in its first migration, and a CI test checks every
table has one. The beta only hardens. Recommended with the milestone order the owner ruled on
("M4 first"); it stands unless the owner rules otherwise.

## Amended: Vextrus Engineers enter a tenant only by invitation (owner's decision, 26 Sep 2026)
A Vextrus Engineer reaches a Developer's data only by that Developer's invitation: a named member with
the QS role, time-bound (30 days by default, renewable) and revocable. No one at Vextrus bypasses
row-level security through the app, and the Django admin obeys the same policies; operators reach raw
data only through the audited database path of the beta hardening. Every action is recorded under the
engineer's own name, and the client sees who from Vextrus has access and until when. The owner's
ruling: "Agree".
