"""`takeoff`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit. A submodule is imported on first use, not with the package
(21d): the real-drawing check starts the job's export as `python -m vextrus.takeoff.services.export`,
which imports this package before the export can set Django up, and `step1` loads the models.
"""

from importlib import import_module
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from vextrus.takeoff.services import (
        frame_steps,  # S16-T2
        step1,  # 19a
    )

__all__ = ["frame_steps", "step1"]


def __getattr__(name: str) -> object:
    if name in __all__:
        return import_module(f"{__name__}.{name}")
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
