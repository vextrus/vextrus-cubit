"""Running the demo seed: each module's `run(demo)`, lowest layer first, in one transaction."""

from importlib import import_module
from typing import Any

from django.db import transaction

# The modules that seed, lowest layer first; a later one reads what an earlier one made from `demo`.
SEEDS: tuple[str, ...] = ("platform", "projects", "drawings", "takeoff")

type Demo = dict[str, Any]
"""What the seeds have made so far, by name ("developer:kr", "project:KR-01"), for later seeds."""


def seed_demo() -> Demo:
    demo: Demo = {}
    with transaction.atomic():
        for name in SEEDS:
            import_module(f"vextrus.seed.{name}").run(demo)
    return demo
