"""One leaf migration per module (docs/architecture.md, Data): at most one ticket per wave adds a
migration to a module, and two that did anyway would fork its chain. Reads the migration files
only; needs no database.

    uv run python -m tools.lint.migration_leaves
"""

import os
import sys
from collections.abc import Iterable

from django.db.migrations.graph import MigrationGraph


def leaf_problems(graph: MigrationGraph, modules: Iterable[str]) -> list[str]:
    found = []
    for module in modules:
        leaves = sorted(name for app, name in graph.leaf_nodes(module) if app == module)
        if len(leaves) > 1:
            found.append(f"{module} has {len(leaves)} leaf migrations: {', '.join(leaves)}")
    return found


def main() -> int:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vextrus.settings")
    import django

    django.setup()
    from django.db.migrations.loader import MigrationLoader

    from vextrus.modules import MODULES

    loader = MigrationLoader(None, ignore_no_migrations=True)
    found = leaf_problems(loader.graph, MODULES)
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
