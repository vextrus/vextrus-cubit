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

-- A vextrus_heldout this file did not make is never taken over: a role with CREATEDB (the owner's
-- `vextrus`) could have made it first, with a schema of its own and a search_path that runs its functions
-- in the instance's sessions. Its owner is never changed here; drop such a database by hand.
DO $foreign$
DECLARE
  owner text;
BEGIN
  SELECT pg_get_userbyid(datdba) INTO owner FROM pg_database WHERE datname = 'vextrus_heldout';
  IF owner IS NOT NULL AND owner <> 'vextrus_heldout' THEN
    RAISE EXCEPTION 'vextrus_heldout exists, made by %, not by this file: drop it (DROP DATABASE vextrus_heldout) and run again', owner;
  END IF;
END
$foreign$;
-- Copied from template0, never template1: template1 is whatever the cluster's superuser left in it, and
-- until step 3 every build session held that superuser's password, so a SECURITY DEFINER event trigger
-- planted there would fire as the superuser in the instance's own migrations. template0 takes no
-- connections (checked below), so no one has shaped it.
DO $template$
BEGIN
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'template0' AND (datallowconn OR NOT datistemplate)) THEN
    RAISE EXCEPTION 'template0 takes connections, so it may have been changed: ALTER DATABASE template0 ALLOW_CONNECTIONS false, and check it';
  END IF;
END
$template$;
SELECT 'CREATE DATABASE vextrus_heldout OWNER vextrus_heldout TEMPLATE template0'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus_heldout') \gexec
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
  -- No superuser but the cluster's own: another (a role named like a Unix user, say) could sign in by
  -- peer over the socket with no password and read every database.
  SELECT string_agg(rolname, ', ') INTO found
    FROM pg_roles WHERE rolsuper AND rolname <> 'postgres';
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'these roles are superusers besides postgres: %', found;
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
  -- No setting reaches the instance's sessions but the log settings above: a search_path (or any other)
  -- set on the database, on either role, or on every role, by anyone, stops it.
  SELECT string_agg(setting, ', ') INTO found
    FROM pg_db_role_setting s, unnest(s.setconfig) AS setting
   WHERE (s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = 'vextrus_heldout'))
     AND (s.setrole = 0 OR pg_get_userbyid(s.setrole) = ANY (held))
     AND NOT (s.setrole = 0 AND s.setdatabase <> 0 AND split_part(setting, '=', 1) = ANY (ARRAY[
       'log_statement', 'log_min_error_statement', 'log_min_messages', 'log_min_duration_statement',
       'log_min_duration_sample', 'log_duration', 'log_lock_waits', 'log_temp_files',
       'log_transaction_sample_rate', 'log_parameter_max_length_on_error']));
  IF found IS NOT NULL THEN
    RAISE EXCEPTION 'settings this file did not write reach vextrus_heldout''s sessions: %', found;
  END IF;
  IF EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus_heldout' AND datistemplate) THEN
    RAISE EXCEPTION 'vextrus_heldout is a template';
  END IF;
END
$walls$;
