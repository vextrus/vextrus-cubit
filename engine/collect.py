"""The glob collector: a package's submodules, found by listing its directory.

Packages that many tickets add to (each module's `messages/`, `http/` and `tasks/`, and
`engine/messages/`) collect their submodules with this, so no ticket edits a shared list
(docs/architecture.md, Messages). Private modules (a leading underscore) and `tests` are skipped.
"""

import pkgutil
from importlib import import_module
from types import ModuleType


def submodules(package: str) -> list[ModuleType]:
    """Import and return the package's public submodules and subpackages, in name order."""
    parent = import_module(package)
    names = sorted(
        info.name
        for info in pkgutil.iter_modules(parent.__path__)
        if not info.name.startswith("_") and info.name != "tests"
    )
    return [import_module(f"{package}.{name}") for name in names]
