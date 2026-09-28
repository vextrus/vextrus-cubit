"""Jobs: Procrastinate, queued in the same PostgreSQL as the data (ADR 0034; 09 fills)."""

# Procrastinate's connection: Django's `default` alias, so the worker connects as vextrus_app and a
# job is deferred in its data's transaction. A worker run inside the Django process must use the
# worker connector (docs/research/stack-versions.md, problem 8b).
PROCRASTINATE_DATABASE_ALIAS = "default"
# Each module's tasks/ package collects its submodules, so autodiscovery finds every task.
PROCRASTINATE_AUTODISCOVER_MODULE_NAME = "tasks"
PROCRASTINATE_READONLY_MODELS = True

# The `cad` queue runs at concurrency 1 under an address-space cap set at the worker's start (09);
# 24 sets the value from the measured peak memory. None: no cap yet.
VEXTRUS_CAD_QUEUE = "cad"
VEXTRUS_CAD_WORKER_CONCURRENCY = 1
VEXTRUS_CAD_WORKER_MEMORY_BYTES: int | None = None
