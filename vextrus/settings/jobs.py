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

# The `cad` queue runs at concurrency 1 under an address-space cap set at the worker's start (09);
# 24 sets the value from the measured peak memory. None: no cap yet.
VEXTRUS_CAD_QUEUE = "cad"
VEXTRUS_CAD_WORKER_CONCURRENCY = 1
VEXTRUS_CAD_WORKER_MEMORY_BYTES: int | None = None

# A job is tried at most this many times, whether it raised or its worker stopped mid-way
# ("Trying again by itself (try 2 of 3)": docs/design/m0-screens.md, the file's life).
VEXTRUS_JOB_TRIES = 3
# Seconds between tries after a job raised (a constant back-off).
VEXTRUS_JOB_RETRY_SECONDS = 10
# Seconds a stopping worker (Ctrl-C, SIGTERM) lets a running job go on; then the job stops after its
# current step and is tried again, its completed steps skipped. 0: stop after the current step.
VEXTRUS_WORKER_STOP_SECONDS = 0
# A running job whose worker has sent no heartbeat for this long is a candidate: the retrier, run
# every minute, tries it again once its try's hold on it is gone (the worker died), never while the
# try lives (a worker's heartbeat is every 10 s by Procrastinate's default, and stops while it stops).
VEXTRUS_JOB_STALLED_SECONDS = 60
