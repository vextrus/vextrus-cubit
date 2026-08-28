"""Byte-deterministic serialisation, so a committed fixture artifact regenerates identically.

JSON, UTF-8, LF, sorted keys, two-space indent, one trailing newline — and never a NaN or an
infinity, which are not JSON and would make the artifact unreadable to the mirrors.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def dumps(artifact: dict[str, Any]) -> str:
    """The artifact's exact bytes, as text."""
    return json.dumps(artifact, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def write_artifact(destination: Path, artifact: dict[str, Any]) -> None:
    destination.write_text(dumps(artifact), encoding="utf-8", newline="\n")
