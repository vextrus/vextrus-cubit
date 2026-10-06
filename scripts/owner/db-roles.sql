-- The two database roles (docs/data-model.md §2; the M0 plan, 01a; s02 reviews A1, A2).
-- Run once per PostgreSQL 18 cluster as a superuser: locally through scripts/owner/db-local.sh, in the
-- cloud by scripts/cloud/postgres.sh's pg_prepare. Idempotent. Sets no password: each place sets
-- its own (locally in ~/.pgpass; in the cloud the one DATABASE_URL names; in CI the service's).
--   vextrus      owns the schema and runs migrations; may create the per-worktree and test databases.
--   vextrus_app  the only role the app connects as; row-level security applies to it (never BYPASSRLS).
\set ON_ERROR_STOP on

SELECT 'CREATE ROLE vextrus' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus') \gexec
SELECT 'CREATE ROLE vextrus_app' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_app') \gexec

ALTER ROLE vextrus     LOGIN CREATEDB   NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE vextrus_app LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT 'CREATE DATABASE vextrus OWNER vextrus'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus') \gexec
