"""Ticket f3, 3.4: `scripts/factory/status.py`, the one writer of `status.json` (status.schema.json:
written atomically, a temp file in the same folder renamed over it) and the band's WATCHER DOWN rule
(over 180 s old, missing or unparseable).

ST1 calls `write_atomic(path, payload)` in a subprocess (`PYTHONPATH=<repo root>`); ST2 runs `python
-m scripts.factory.status age`, which reads `$VEXTRUS_FACTORY_DIR/status.json`'s `written_at` against
`VEXTRUS_NOW`.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"

WRITE = """
import sys
from pathlib import Path
from scripts.factory.status import write_atomic

payload = {"schema_version": 1, "written_at": "2026-10-04T21:08:00Z"}
if sys.argv[2] == "bad":
    payload["watcher"] = object()  # not JSON
try:
    write_atomic(Path(sys.argv[1]), payload)
except Exception as error:
    print("refused:", type(error).__name__)
    sys.exit(4)
"""


def env(factory: Path) -> dict[str, str]:
    environ = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
    environ.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(factory), VEXTRUS_NOW=NOW)
    return environ


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def write(factory: Path, kind: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-c", WRITE, str(factory / "status.json"), kind],
        cwd=factory,
        env=env(factory),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


# ST1
def test_st1_write_atomic_never_leaves_half_a_file_or_a_temp_file(tmp_path: Path) -> None:
    factory = tmp_path / "factory"
    factory.mkdir()
    previous = b'{"schema_version": 1, "written_at": "2026-10-04T21:07:00Z"}\n'
    (factory / "status.json").write_bytes(previous)

    done = write(factory, "bad")
    assert "No module named" not in done.stderr, show(done)
    assert (factory / "status.json").read_bytes() == previous
    assert sorted(p.name for p in factory.iterdir()) == ["status.json"], show(done)

    done = write(factory, "good")
    assert done.returncode == 0, show(done)
    assert json.loads((factory / "status.json").read_text())["written_at"] == NOW
    assert sorted(p.name for p in factory.iterdir()) == ["status.json"]


# ST2
@pytest.mark.parametrize(
    ("content", "code"),
    [
        ({"written_at": "2026-10-04T21:06:20Z"}, 0),  # 100 s old
        ({"written_at": "2026-10-04T21:03:00Z"}, 3),  # 300 s old
        (None, 3),  # missing
        ("{not json", 3),
    ],
)
def test_st2_age_exits_3_when_status_json_is_over_180_seconds_old_or_missing(
    tmp_path: Path, content: dict[str, str] | str | None, code: int
) -> None:
    factory = tmp_path / "factory"
    factory.mkdir()
    if isinstance(content, dict):
        (factory / "status.json").write_text(json.dumps({"schema_version": 1, **content}))
    elif isinstance(content, str):
        (factory / "status.json").write_text(content)
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.status", "age"],
        cwd=tmp_path,
        env=env(factory),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=60,
        check=False,
    )
    assert "No module named" not in done.stderr, show(done)
    assert done.returncode == code, show(done)
