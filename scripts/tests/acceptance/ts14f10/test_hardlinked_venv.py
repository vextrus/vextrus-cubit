"""S14-F12 (issue #462): a worktree made by `launch local` gets its venv hardlinked from uv's shared
cache, so a worktree is small.

The authority: issue #462, "Fix": "`launch local` creates the venv with `uv sync
--link-mode=hardlink` from a shared cache"; the orchestrator's brief (session 14): "hardlinked venvs".

The seam: `scripts.factory.local.prepare(worktree)`, the launcher's step that readies a new worktree
(today it runs `uv run manage.py ensure_database`, which makes the venv). A fake `uv` on PATH records
each call's arguments and its `UV_LINK_MODE`. Pinned: some `uv` call of that step asks for hardlinks,
by `--link-mode=hardlink` (or `--link-mode hardlink`) or by `UV_LINK_MODE=hardlink`. Not pinned: which
`uv` subcommand, or anything about `node_modules` (npm has no shared store; the issue names none).
"""

from __future__ import annotations

import json
import os
import stat
from itertools import pairwise
from pathlib import Path
from typing import Any

import pytest

FAKE_UV = """#!/bin/sh
python3 - "$@" <<'PY'
import json, os, sys
with open(os.environ["TS14F10_UV_LOG"], "a") as log:
    log.write(json.dumps({"argv": sys.argv[1:], "link_mode": os.environ.get("UV_LINK_MODE")}) + "\\n")
PY
exit 0
"""


def asks_for_hardlinks(call: dict[str, Any]) -> bool:
    argv = [str(word) for word in call["argv"]]
    by_flag = "--link-mode=hardlink" in argv or any(
        word == "--link-mode" and later == "hardlink" for word, later in pairwise(argv)
    )
    return by_flag or call["link_mode"] == "hardlink"


def test_launch_locals_worktree_step_makes_the_venv_with_hardlinks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.factory import local

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    uv = bin_dir / "uv"
    uv.write_text(FAKE_UV)
    uv.chmod(uv.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    log = tmp_path / "uv.log"
    worktree = tmp_path / "worktree"
    worktree.mkdir()
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}")
    monkeypatch.setenv("TS14F10_UV_LOG", str(log))
    monkeypatch.delenv("UV_LINK_MODE", raising=False)

    local.prepare(worktree)

    calls = [json.loads(line) for line in log.read_text().splitlines()] if log.is_file() else []
    assert calls, "the worktree step ran no uv"
    assert any(asks_for_hardlinks(call) for call in calls), f"no uv call asks for hardlinks: {calls}"
