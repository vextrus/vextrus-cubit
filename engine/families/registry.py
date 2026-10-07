"""The family registry (C4): every sub-package of `engine.families` holding a `manifest.py`, found by
listing the directory at import, so no family ticket edits a list here.

`families()` returns them in Takeoff Step order (the building-first order, ADR 0007), then by key; a
family whose step is not in the order comes last. With no family package it is `()`.
"""

import pkgutil
from importlib import import_module
from pathlib import Path
from types import ModuleType

from engine.families.types import Manifest

STEP_ORDER: tuple[str, ...] = (
    "sheets",
    "general_notes",
    "storeys",
    "grid",
    "foundations",
    "columns",
    "beams",
    "slabs",
    "stairs",
    "tanks",
    "walls",
    "rooms",
    "roof",
    "site_mep",
)
"""The Takeoff Steps' keys in order (`vextrus.takeoff.library.STEPS`; the engine may not import it)."""

_ROOT = Path(__file__).parent


def _discover() -> tuple[ModuleType, ...]:
    found: list[ModuleType] = []
    for info in pkgutil.iter_modules([str(_ROOT)]):
        if not info.ispkg or info.name.startswith("_") or info.name == "tests":
            continue
        if not (_ROOT / info.name / "manifest.py").is_file():
            continue
        found.append(import_module(f"{__package__}.{info.name}"))
    return tuple(sorted(found, key=_order))


def _order(family: ModuleType) -> tuple[int, str]:
    manifest = manifest_of(family)
    step = manifest.step
    rank = STEP_ORDER.index(step) if step in STEP_ORDER else len(STEP_ORDER)
    return rank, manifest.key


def manifest_of(family: ModuleType) -> Manifest:
    """The family's `MANIFEST`, read from its `manifest` submodule."""
    held = import_module(f"{family.__name__}.manifest").MANIFEST
    if not isinstance(held, Manifest):
        raise TypeError(f"{family.__name__}.manifest.MANIFEST is not a Manifest")
    return held


_FAMILIES: tuple[ModuleType, ...] = _discover()


def families() -> tuple[ModuleType, ...]:
    """Every family package, in Takeoff Step order."""
    return _FAMILIES


def get(key: str) -> ModuleType:
    """The family package whose manifest key is `key`; KeyError if there is none."""
    for family in families():
        if manifest_of(family).key == key:
            return family
    raise KeyError(key)
