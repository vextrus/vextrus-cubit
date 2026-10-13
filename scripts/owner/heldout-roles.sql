-- The Held-out instance's database and its two roles (ticket M1-06; docs/plans/M1.md, wave 0).
-- Run by scripts/owner/heldout-instance.sh, as the cluster's superuser over its Unix socket, on the
-- PostgreSQL 18 cluster on port 5432 only, connected to the `postgres` database (never to
-- vextrus_heldout itself: its pg_hba.conf lines reject every role but the two below). Idempotent. Sets
-- no password: the script sets each, and writes it into the key user's own ~/.pgpass only.
--   vextrus_heldout      owns the schema and runs migrations; creates no database.
--   vextrus_heldout_app  the only role the instance's web and workers connect as (never BYPASSRLS).
-- No other role may connect: CONNECT is revoked from PUBLIC (the owner's `vextrus` has CREATEDB and
-- both M0 passwords sit in the owner's ~/.pgpass, scripts/owner/db-roles.sql:12-13).
\set ON_ERROR_STOP on

SELECT 'CREATE ROLE vextrus_heldout'
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_heldout') \gexec
SELECT 'CREATE ROLE vextrus_heldout_app'
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_heldout_app') \gexec

ALTER ROLE vextrus_heldout     LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE vextrus_heldout_app LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT 'CREATE DATABASE vextrus_heldout OWNER vextrus_heldout'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus_heldout') \gexec
ALTER DATABASE vextrus_heldout OWNER TO vextrus_heldout;
-- Never a template: a role with CREATEDB could otherwise copy it (CREATE DATABASE … TEMPLATE).
ALTER DATABASE vextrus_heldout IS_TEMPLATE false;

-- Only the two connect. The owner keeps its rights as owner; the app gets CONNECT and TEMPORARY.
REVOKE ALL ON DATABASE vextrus_heldout FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE vextrus_heldout TO vextrus_heldout_app;

-- Nothing of the instance's statements or their errors reaches the cluster's shared server log, which
-- the owner's user reads (group adm): an error's DETAIL can carry a row's values. Each of these is a
-- superuser's setting, so the instance's roles cannot set it back.
ALTER DATABASE vextrus_heldout SET log_statement = 'none';
ALTER DATABASE vextrus_heldout SET log_min_error_statement = 'panic';
ALTER DATABASE vextrus_heldout SET log_min_messages = 'panic';
ALTER DATABASE vextrus_heldout SET log_min_duration_statement = -1;
ALTER DATABASE vextrus_heldout SET log_min_duration_sample = -1;
ALTER DATABASE vextrus_heldout SET log_duration = off;
ALTER DATABASE vextrus_heldout SET log_lock_waits = off;
ALTER DATABASE vextrus_heldout SET log_temp_files = -1;
ALTER DATABASE vextrus_heldout SET log_transaction_sample_rate = 0;
ALTER DATABASE vextrus_heldout SET log_parameter_max_length_on_error = 0;

-- The walls, checked: any failure stops the script (ON_ERROR_STOP) before a password is set.
DO $walls$
DECLARE
  held constant text[] := ARRAY['vextrus_heldout', 'vextrus_heldout_app'];
  found text;
BEGIN
  -- No role is a member of either, and neither is a member of any role.
  SELECT string_agg(pg_get_userbyid(member) || ' in ' || pg_get_userbyid(roleid), ', ') INTO found
    FROM pg_auth_members
   WHERE pg_get_userbyid(roleid) = ANY (held) OR pg_get_userbyid(member) = ANY (held);
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'the Held-out roles must stand alone, but: %', found;
  END IF;
  -- No role but the two (and the superusers, whom pg_hba.conf rejects there) may connect.
  SELECT string_agg(rolname, ', ') INTO found
    FROM pg_roles
   WHERE NOT rolsuper AND NOT (rolname = ANY (held))
     AND has_database_privilege(oid, 'vextrus_heldout', 'CONNECT');
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'these roles may still connect to vextrus_heldout: %', found;
  END IF;
  -- No login role but the superusers reads or runs anything on the server's disk as its user: MEMBER,
  -- not USAGE, so a membership WITH INHERIT FALSE that may still SET ROLE is caught too.
  SELECT string_agg(rolname, ', ') INTO found
    FROM pg_roles
   WHERE rolcanlogin AND NOT rolsuper
     AND (pg_has_role(oid, 'pg_read_server_files', 'MEMBER')
       OR pg_has_role(oid, 'pg_write_server_files', 'MEMBER')
       OR pg_has_role(oid, 'pg_execute_server_program', 'MEMBER'));
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'these roles may read or run files on the server: %', found;
  END IF;
  -- No role but the superusers copies the whole cluster (a base backup over a replication connection).
  SELECT string_agg(rolname, ', ') INTO found
    FROM pg_roles WHERE rolreplication AND NOT rolsuper;
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'these roles may copy the whole cluster (REPLICATION): %', found;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = ANY (held)
              AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'a Held-out role carries a power it must not';
  END IF;
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus_heldout' AND datistemplate) THEN
    RAISE EXCEPTION 'vextrus_heldout is a template';
  END IF;
END
$walls$;
