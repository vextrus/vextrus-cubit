"""Jobs: Procrastinate, queued in the same PostgreSQL as the data (ADR 0034; 09 fills).

`vextrus.platform.services.jobs` wraps it: a job is deferred in its data's transaction, carries only
its tenant's id and ids, and runs its steps each in a transaction that acts in the tenant.
`manage.py worker` runs a worker (`--queue cad` for the CAD queue).
"""

# Procrastinate's connection: Django's `default` alias, so the worker connects as vextrus_app and a
# job is deferred in its data's transaction. A worker run inside the Django process must use the
# worker connector (docs/research/stack-versions.md, problem 8b); `manage.py worker` does.
PROCRASTINATE_DATABASE_ALIAS = "default"
# Each module's tasks/ package collects its submodules, so autodiscovery finds every task.
PROCRASTINATE_AUTODISCOVER_MODULE_NAME = "tasks"
PROCRASTINATE_READONLY_MODELS = True

# The queue a job runs on unless it names another; `manage.py worker` listens to it by default, and
# the stalled-job retrier runs on it.
VEXTRUS_DEFAULT_QUEUE = "default"

# The `cad` queue runs at concurrency 1 under an address-space cap (RLIMIT_AS) set at the worker's
# start (09). 4 GiB (24, docs/research/m0-measurements.md): the largest peak address space of a read
# job on the Development Sets is 1.00 GB (numerical libraries on one thread: `vextrus/__init__.py`),
# and every sandboxed reader the worker starts sets its own limit of up to 3 GiB, which it cannot
# raise above this one.
VEXTRUS_CAD_QUEUE = "cad"
VEXTRUS_CAD_WORKER_CONCURRENCY = 1
VEXTRUS_CAD_WORKER_MEMORY_BYTES: int = 4 * 2**30

# A job is tried at most this many times, whether it raised or its worker died mid-way; a worker's
# stop does not count ("Trying again by itself (try 2 of 3)": docs/design/m0-screens.md).
VEXTRUS_JOB_TRIES = 3
# Seconds between tries after a job raised (a constant back-off).
VEXTRUS_JOB_RETRY_SECONDS = 10
# Seconds a stopping worker (Ctrl-C, SIGTERM) lets a running job go on; then the job stops after its
# current step and is tried again, its completed steps skipped. 0: stop after the current step.
VEXTRUS_WORKER_STOP_SECONDS = 0
# A worker beats this often, even while it stops (`run_worker` keeps its own beat going).
VEXTRUS_WORKER_HEARTBEAT_SECONDS = 10
# A running job whose worker has been silent this long is stalled (the worker is dead, frozen or cut
# off from its host): the retrier, run every minute, ends the silent session still holding the job,
# if any, and tries the job again. A job stuck this way is picked up within about two minutes.
VEXTRUS_JOB_STALLED_SECONDS = 60
