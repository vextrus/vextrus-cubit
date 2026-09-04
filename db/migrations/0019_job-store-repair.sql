-- hand-written: 0018_job-store-schemas superseded, never edited (SEAM-JOBS, R-SPINE-031).
--
-- 0018 is applied by its journal entry, so a database that already ran an earlier form of it — the
-- e2e lane's, and any deployment that crossed this lane while it was being built — never sees a
-- rewrite of that file. Two things the earlier forms did are therefore still standing there, and one
-- thing the managing tier now depends on is still missing:
--
--   * the app role was granted CREATE on the DATABASE, a standing privilege no tier of this product
--     is owed;
--   * `pgboss.delete_queue` was marked SECURITY DEFINER and handed to the app role — a door that
--     deletes a queue's row and drops its partition with every job in it;
--   * `cubit_jobs.provision_queue_storage()` was installed without a version guard (and, on a
--     database that crossed only the very first form, was never installed at all), while
--     src/core/db.ts asks for it on every managing open and reads the guard's answer.
--
-- Everything below is written to stand on a database in any of those states and on a fresh one where
-- 0018 has just run: schema and grants are repeatable, the installer is replaced in place, and the
-- queue storage an earlier installer already made is repaired where it stands.
CREATE SCHEMA IF NOT EXISTS "cubit_jobs";
--> statement-breakpoint
-- Taken back where an earlier form of 0018 handed it out: the app role holds no right to make schemas
-- in the database it serves, on any deployment this lane has ever crossed.
DO $$ BEGIN EXECUTE format('REVOKE CREATE ON DATABASE %I FROM %I', current_database(), 'cubit_app'); END $$;
--> statement-breakpoint
GRANT USAGE, CREATE ON SCHEMA "cubit_jobs" TO "cubit_app";
--> statement-breakpoint
-- The log is a queue's working state, not a ledger: a claim is released and an event is read back,
-- so the app role holds the ordinary four on the tables the migration role makes there, and the
-- migration role is not locked out of tables the app role makes first (SEAM-JOBS).
ALTER DEFAULT PRIVILEGES IN SCHEMA "cubit_jobs" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "cubit_app";
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "cubit_jobs" GRANT USAGE ON SEQUENCES TO "cubit_app";
--> statement-breakpoint
-- The queue library's storage, installed on demand by the ONE tier that manages the queue.
--
-- R-SPINE-031 keeps the queue's migration to the managing tier: a database no managing runtime ever
-- opened holds no queue storage, and a tier that merely enqueues says so rather than making it. That
-- reading is why this is a function and not DDL run here. It is SECURITY DEFINER because installing
-- a schema is the migration role's authority, never the app role's: the app role may call it, and
-- calling it can do exactly one thing — install pg-boss 10.4.2's schema version 24, verbatim as
-- `PgBoss.getConstructionPlans("pgboss")` prints it, and grant the app role what the runtime needs.
--
-- Making a queue creates that queue's partition of `pgboss.job` and attaches it, which is the parent
-- table's owner's right; so the library's own `create_queue` is marked SECURITY DEFINER here too, and
-- the app role is given that one door and nothing else — not `delete_queue`, which drops a queue's
-- partition and every job in it.
CREATE OR REPLACE FUNCTION "cubit_jobs"."provision_queue_storage"() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $provision$
DECLARE
  standing int;
BEGIN
  IF to_regclass('pgboss.version') IS NOT NULL THEN
    -- Storage already stands. It is only this door's answer if it stands at the version these plans
    -- install: `migrate => false` on every tier means the library will never correct a mismatch, so a
    -- schema at another version driven by this client is silent drift that shows up as an SQL error
    -- somewhere else. It is named here instead, with the version each side holds.
    EXECUTE 'SELECT max(version) FROM pgboss.version' INTO standing;
    IF standing IS DISTINCT FROM 24 THEN
      RAISE EXCEPTION 'the queue storage in schema pgboss stands at version %, and this installer holds pg-boss 10.4.2''s version 24 — no tier migrates it (R-SPINE-031), so it must be migrated by an operator', standing;
    END IF;
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS pgboss;

  CREATE TYPE pgboss.job_state AS ENUM (
    'created',
    'retry',
    'active',
    'completed',
    'cancelled',
    'failed'
  );

  CREATE TABLE pgboss.version (
    version int primary key,
    maintained_on timestamp with time zone,
    cron_on timestamp with time zone,
    monitored_on timestamp with time zone
  );

  CREATE TABLE pgboss.queue (
    name text,
    policy text,
    retry_limit int,
    retry_delay int,
    retry_backoff bool,
    expire_seconds int,
    retention_minutes int,
    dead_letter text REFERENCES pgboss.queue (name),
    partition_name text,
    created_on timestamp with time zone not null default now(),
    updated_on timestamp with time zone not null default now(),
    PRIMARY KEY (name)
  );

  CREATE TABLE pgboss.schedule (
    name text REFERENCES pgboss.queue ON DELETE CASCADE,
    cron text not null,
    timezone text,
    data jsonb,
    options jsonb,
    created_on timestamp with time zone not null default now(),
    updated_on timestamp with time zone not null default now(),
    PRIMARY KEY (name)
  );

  CREATE TABLE pgboss.subscription (
    event text not null,
    name text not null REFERENCES pgboss.queue ON DELETE CASCADE,
    created_on timestamp with time zone not null default now(),
    updated_on timestamp with time zone not null default now(),
    PRIMARY KEY(event, name)
  );

  CREATE TABLE pgboss.job (
    id uuid not null default gen_random_uuid(),
    name text not null,
    priority integer not null default(0),
    data jsonb,
    state pgboss.job_state not null default('created'),
    retry_limit integer not null default(2),
    retry_count integer not null default(0),
    retry_delay integer not null default(0),
    retry_backoff boolean not null default false,
    start_after timestamp with time zone not null default now(),
    started_on timestamp with time zone,
    singleton_key text,
    singleton_on timestamp without time zone,
    expire_in interval not null default interval '15 minutes',
    created_on timestamp with time zone not null default now(),
    completed_on timestamp with time zone,
    keep_until timestamp with time zone NOT NULL default now() + interval '14 days',
    output jsonb,
    dead_letter text,
    policy text
  ) PARTITION BY LIST (name);

  ALTER TABLE pgboss.job ADD PRIMARY KEY (name, id);
  CREATE TABLE pgboss.archive (LIKE pgboss.job);
  ALTER TABLE pgboss.archive ADD PRIMARY KEY (name, id);
  ALTER TABLE pgboss.archive ADD archived_on timestamptz NOT NULL DEFAULT now();
  CREATE INDEX archive_i1 ON pgboss.archive(archived_on);

  EXECUTE $plan$
    CREATE FUNCTION pgboss.create_queue(queue_name text, options json)
    RETURNS VOID AS
    $$
    DECLARE
      table_name varchar := 'j' || encode(sha224(queue_name::bytea), 'hex');
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
      INSERT INTO pgboss.queue (
        name,
        policy,
        retry_limit,
        retry_delay,
        retry_backoff,
        expire_seconds,
        retention_minutes,
        dead_letter,
        partition_name
      )
      VALUES (
        queue_name,
        options->>'policy',
        (options->>'retryLimit')::int,
        (options->>'retryDelay')::int,
        (options->>'retryBackoff')::bool,
        (options->>'expireInSeconds')::int,
        (options->>'retentionMinutes')::int,
        options->>'deadLetter',
        table_name
      )
      ON CONFLICT DO NOTHING
      RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE pgboss.%I (LIKE pgboss.job INCLUDING DEFAULTS)', table_name);

      EXECUTE format('ALTER TABLE pgboss.%1$I ADD PRIMARY KEY (name, id)', table_name);
      EXECUTE format('ALTER TABLE pgboss.%1$I ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', table_name);
      EXECUTE format('ALTER TABLE pgboss.%1$I ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', table_name);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i1 ON pgboss.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''created'' AND policy = ''short''', table_name);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i2 ON pgboss.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''active'' AND policy = ''singleton''', table_name);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i3 ON pgboss.%1$I (name, state, COALESCE(singleton_key, '''')) WHERE state <= ''active'' AND policy = ''stately''', table_name);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i4 ON pgboss.%1$I (name, singleton_on, COALESCE(singleton_key, '''')) WHERE state <> ''cancelled'' AND singleton_on IS NOT NULL', table_name);
      EXECUTE format('CREATE INDEX %1$s_i5 ON pgboss.%1$I (name, start_after) INCLUDE (priority, created_on, id) WHERE state < ''active''', table_name);

      EXECUTE format('ALTER TABLE pgboss.%I ADD CONSTRAINT cjc CHECK (name=%L)', table_name, queue_name);
      EXECUTE format('ALTER TABLE pgboss.job ATTACH PARTITION pgboss.%I FOR VALUES IN (%L)', table_name, queue_name);
    END;
    $$
    LANGUAGE plpgsql
  $plan$;

  EXECUTE $plan$
    CREATE FUNCTION pgboss.delete_queue(queue_name text)
    RETURNS VOID AS
    $$
    DECLARE
      table_name varchar;
    BEGIN
      WITH deleted as (
        DELETE FROM pgboss.queue
        WHERE name = queue_name
        RETURNING partition_name
      )
      SELECT partition_name from deleted INTO table_name;

      EXECUTE format('DROP TABLE IF EXISTS pgboss.%I', table_name);
    END;
    $$
    LANGUAGE plpgsql
  $plan$;

  INSERT INTO pgboss.version(version) VALUES ('24');

  -- What the runtime needs and nothing more: the queue's rows are read and written through the
  -- parent table, whose privileges are the ones checked, and a partition made later by
  -- `create_queue` inherits the same reach through these default privileges.
  GRANT USAGE ON SCHEMA pgboss TO cubit_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO cubit_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cubit_app;

  -- Making a queue is a partition of `pgboss.job`, which only that table's owner may attach. That one
  -- door runs as its definer so the app role never needs to own the schema, and it is the only thing
  -- in the schema the app role may execute.
  --
  -- Unmaking one is NOT given out. `delete_queue` deletes the queue's row and drops its partition —
  -- every job it holds — and no tier of this product ever calls it: the runtime makes queues and
  -- consumes them, and retiring one is an operator's act performed as the owning role. A door that
  -- destroys a queue's stored jobs is not a standing privilege of the role that serves requests.
  ALTER FUNCTION pgboss.create_queue(text, json) SECURITY DEFINER SET search_path = pg_catalog, pgboss;
  REVOKE ALL ON FUNCTION pgboss.create_queue(text, json) FROM PUBLIC;
  REVOKE ALL ON FUNCTION pgboss.delete_queue(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION pgboss.create_queue(text, json) TO cubit_app;
END;
$provision$;
--> statement-breakpoint
-- Installing is the managing tier's act (R-SPINE-031), so only a role that runs one may ask for it.
REVOKE ALL ON FUNCTION "cubit_jobs"."provision_queue_storage"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "cubit_jobs"."provision_queue_storage"() TO "cubit_app";
--> statement-breakpoint
-- And where an earlier installer already made the queue storage, the door it handed out is taken
-- back where it stands: replacing the installer above only changes what the NEXT database gets.
DO $$
BEGIN
  IF to_regprocedure('pgboss.delete_queue(text)') IS NOT NULL THEN
    ALTER FUNCTION pgboss.delete_queue(text) SECURITY INVOKER RESET search_path;
    REVOKE ALL ON FUNCTION pgboss.delete_queue(text) FROM PUBLIC;
    EXECUTE format('REVOKE ALL ON FUNCTION pgboss.delete_queue(text) FROM %I', 'cubit_app');
  END IF;
END $$;
