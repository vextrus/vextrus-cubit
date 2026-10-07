"""The family registry (docs/plans/M1.md C4): discovered at import from `engine/families/`'s
sub-packages, each holding a `manifest.py` with `MANIFEST: Manifest`. Nothing is generated or listed
per family, so parallel family tickets never touch one file.

`families()` is ordered by Takeoff Step order, then key; `get(key)` names one. Look both up on this
module at call time (tests replace them).
"""

from __future__ import annotations

import importlib
from pathlib import Path
from types import ModuleType

STEP_ORDER = (
    "drawings",
    "strength",
    "storeys",
    "grid",
    "foundations",
    "columns",
    "beams",
    "slabs",
    "stairs",
    "lift",
    "walls",
    "rooms",
)
"""The Takeoff Steps in order; a Step not named here sorts after them."""

_ROOT = Path(__file__).parent


def _step_rank(module: ModuleType) -> tuple[int, str]:
    manifest = importlib.import_module(f"{module.__name__}.manifest").MANIFEST
    step = str(manifest.step)
    rank = STEP_ORDER.index(step) if step in STEP_ORDER else len(STEP_ORDER)
    return rank, str(manifest.key)


def _discover() -> tuple[ModuleType, ...]:
    found = [
        importlib.import_module(f"{__package__}.{path.parent.name}")
        for path in sorted(_ROOT.glob("*/manifest.py"))
        if (path.parent / "__init__.py").exists()
    ]
    return tuple(sorted(found, key=_step_rank))


_FAMILIES = _discover()


def families() -> tuple[ModuleType, ...]:
    """Every family package, in Takeoff Step order."""
    return _FAMILIES


def get(key: str) -> ModuleType:
    """The family package whose manifest's key is `key`; KeyError when there is none."""
    for module in families():
        if importlib.import_module(f"{module.__name__}.manifest").MANIFEST.key == key:
            return module
    raise KeyError(key)
