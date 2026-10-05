"""Ticket T-STAMP (session 12, phase 6; issue #340): `stamp start` makes a missing state folder and
refuses a state path that cannot be a file; `stamp` never tracebacks on an unwritable state file;
`stamp end` stamps a final line, archives `session.json` beside the state file and removes it.

Black-box through `VEXTRUS_FACTORY_DIR` (where `session.json` lives) and `VEXTRUS_NOW` (the clock), as
`scripts/factory/tests/acceptance/test_stamp.py` (S1-S7) is. The seams fixed by the ticket's section 3:

    end            no arguments; the state file's last line is `<UTC> session ended h:mm/h:mm`;
                   `<state folder>/session-<started_utc as YYYYMMDDTHHMMSSZ>.json` = the session plus
                   `"ended_utc": "<UTC>"`; `session.json` is removed; stdout says `session ended` and
                   `h:mm/h:mm`. No session: `REFUSED: no session.json ...`, exit 2.

Exit codes: 0 done, 2 refused or usage.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-04T21:08:00Z"


class Stamp:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "factory"
        self.state = tmp / "STATE.md"
        self.session = self.factory / "session.json"

    def env(self, now: str) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(self.factory), VEXTRUS_NOW=now)
        for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"):
            env.pop(key, None)
        return env

    def run(
        self, *args: str, now: str = NOW, cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.stamp", *args],
            cwd=cwd or self.tmp,
            env=self.env(now),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def start(
        self, budget: str = "11h", *more: str, state: Path | None = None, now: str = NOW
    ) -> subprocess.CompletedProcess[str]:
        chosen = self.state if state is None else state
        return self.run("start", "--budget", budget, "--state", str(chosen), *more, now=now)


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def tree(root: Path) -> dict[str, bytes | None]:
    """Every path under `root`: a file's bytes, a folder as None."""
    return {
        str(p.relative_to(root)): (p.read_bytes() if p.is_file() else None)
        for p in sorted(root.rglob("*"))
    }


def refused(done: subprocess.CompletedProcess[str]) -> None:
    assert done.returncode == 2, show(done)
    assert done.stderr.startswith("REFUSED:"), show(done)
    assert "Traceback" not in done.stderr, show(done)


def state_in_folder(stamp: Stamp, name: str) -> Path:
    """A state file in its own existing folder, holding one header line."""
    folder = stamp.tmp / name
    folder.mkdir()
    state = folder / "STATE.md"
    state.write_text("# STATE\n")
    return state


def break_folder(state: Path) -> None:
    """Remove the state file's folder and put a regular file at its path: no folder can be made there."""
    for child in state.parent.iterdir():
        child.unlink()
    state.parent.rmdir()
    state.parent.write_text("not a folder\n")


@pytest.fixture
def stamp(tmp_path: Path) -> Stamp:
    return Stamp(tmp_path)


# 1
def test_1_start_makes_a_missing_state_folder_and_the_first_stamp_lands(stamp: Stamp) -> None:
    state = stamp.tmp / "new" / "deeper" / "STATE.md"
    done = stamp.start("1h", state=state)
    assert done.returncode == 0, show(done)
    assert state.parent.is_dir()
    assert json.loads(stamp.session.read_text())["state_file"] == str(state.resolve())

    first = stamp.run("first line")
    assert first.returncode == 0, show(first)
    assert state.read_text() == f"{NOW} first line\n"


# 2
@pytest.mark.parametrize("case", ["an existing folder", "a path under a regular file"])
def test_2_a_state_path_that_cannot_be_a_file_is_refused_at_start_and_nothing_is_written(
    stamp: Stamp, case: str
) -> None:
    afile = stamp.tmp / "afile"
    afile.write_text("a regular file\n")
    state = stamp.tmp if case == "an existing folder" else afile / "STATE.md"

    done = stamp.start("1h", state=state)
    refused(done)
    assert not stamp.session.exists()
    assert afile.read_text() == "a regular file\n"


# 3
def test_3_stamp_refuses_an_unwritable_state_file_without_a_traceback(stamp: Stamp) -> None:
    state = state_in_folder(stamp, "st")
    assert stamp.start("1h", state=state).returncode == 0
    break_folder(state)

    done = stamp.run("x")
    refused(done)
    assert state.parent.read_text() == "not a folder\n"


def ended_session(stamp: Stamp) -> tuple[Path, dict[str, object], subprocess.CompletedProcess[str]]:
    """Test 4's session: started 19:30, phase p1 at 19:40, a line at 20:00, ended at 22:42 (3:12 later).
    Returns the state file, the session as it was just before `end`, and `end`'s result."""
    state = state_in_folder(stamp, "s1")
    started = stamp.start("11h", "--phases", "p1=150", state=state, now="2026-10-04T19:30:00Z")
    assert started.returncode == 0, show(started)
    assert stamp.run("phase", "p1", now="2026-10-04T19:40:00Z").returncode == 0
    assert stamp.run("work", now="2026-10-04T20:00:00Z").returncode == 0
    before = json.loads(stamp.session.read_text())
    done = stamp.run("end", now="2026-10-04T22:42:00Z")
    return state, before, done


ARCHIVE = "session-20261004T193000Z.json"


# 4
def test_4_end_stamps_a_final_line_archives_the_session_beside_the_state_file_and_removes_it(
    stamp: Stamp,
) -> None:
    state, before, done = ended_session(stamp)
    assert done.returncode == 0, show(done)
    assert "session ended" in done.stdout, show(done)
    assert "3:12/11:00" in done.stdout, show(done)

    assert state.read_text() == (
        "# STATE\n2026-10-04T20:00:00Z work\n2026-10-04T22:42:00Z session ended 3:12/11:00\n"
    )
    assert not stamp.session.exists()
    assert set(tree(state.parent)) == {"STATE.md", ARCHIVE}
    archived = json.loads((state.parent / ARCHIVE).read_text())
    assert archived == {**before, "ended_utc": "2026-10-04T22:42:00Z"}
    assert archived["phases"] == [{"name": "p1", "minutes": 150, "start_utc": "2026-10-04T19:40:00Z"}]


# 5
def test_5_after_end_elapsed_is_quiet_and_the_next_start_needs_no_force(stamp: Stamp) -> None:
    state, _, done = ended_session(stamp)
    assert done.returncode == 0, show(done)
    assert (state.parent / ARCHIVE).is_file(), sorted(tree(state.parent))
    archive = (state.parent / ARCHIVE).read_bytes()

    quiet = stamp.run("elapsed", now="2026-10-04T22:50:00Z")
    assert quiet.returncode == 0, show(quiet)
    assert quiet.stdout.strip() == "no budget set", show(quiet)

    second = state_in_folder(stamp, "s2")
    again = stamp.start("5h", state=second, now="2026-10-04T23:00:00Z")
    assert again.returncode == 0, show(again)
    session = json.loads(stamp.session.read_text())
    assert session["budget_minutes"] == 300
    assert session["started_utc"] == "2026-10-04T23:00:00Z"
    assert (state.parent / ARCHIVE).read_bytes() == archive


# 6
def test_6_end_with_no_session_is_refused_and_a_second_end_never_makes_a_second_archive(
    stamp: Stamp,
) -> None:
    before = tree(stamp.tmp)
    nothing = stamp.run("end")
    refused(nothing)
    assert "no session.json" in nothing.stderr, show(nothing)
    assert tree(stamp.tmp) == before

    state, _, done = ended_session(stamp)
    assert done.returncode == 0, show(done)
    assert (state.parent / ARCHIVE).is_file()
    after_first = tree(stamp.tmp)

    second = stamp.run("end", now="2026-10-04T22:50:00Z")
    refused(second)
    assert "no session.json" in second.stderr, show(second)
    assert tree(stamp.tmp) == after_first


# 7
def test_7_end_that_cannot_stamp_its_final_line_keeps_session_json(stamp: Stamp) -> None:
    state = state_in_folder(stamp, "st")
    assert stamp.start("11h", state=state).returncode == 0
    kept = stamp.session.read_bytes()
    break_folder(state)

    done = stamp.run("end", now="2026-10-04T22:42:00Z")
    refused(done)
    assert stamp.session.read_bytes() == kept
    assert state.parent.read_text() == "not a folder\n"


# 7, the second half
def test_7_end_takes_no_arguments_and_stamp_stamp_escapes_text_that_starts_with_end(
    stamp: Stamp,
) -> None:
    state = state_in_folder(stamp, "st")
    assert stamp.start("11h", state=state).returncode == 0
    kept = stamp.session.read_bytes()

    usage = stamp.run("end", "of", "wave", now="2026-10-04T22:00:00Z")
    assert usage.returncode == 2, show(usage)
    assert "usage:" in usage.stderr, show(usage)
    assert "Traceback" not in usage.stderr, show(usage)
    assert state.read_text() == "# STATE\n"
    assert stamp.session.read_bytes() == kept

    escaped = stamp.run("stamp", "end of wave", now="2026-10-04T22:00:00Z")
    assert escaped.returncode == 0, show(escaped)
    assert state.read_text() == "# STATE\n2026-10-04T22:00:00Z end of wave\n"
    assert stamp.session.read_bytes() == kept


# 8 (green on main too: it pins the order, validate first, then make the folder, then write session.json)
def test_8_a_refused_start_creates_no_folder(stamp: Stamp) -> None:
    for bad in (("abc",), ("1h", "--phases", "p1")):
        nowhere = stamp.tmp / "bad" / "STATE.md"
        done = stamp.start(*bad, state=nowhere)
        refused(done)
        assert not nowhere.parent.exists()
        assert not stamp.session.exists()

    state = state_in_folder(stamp, "s1")
    assert stamp.start("11h", state=state).returncode == 0
    kept = stamp.session.read_bytes()
    other = stamp.tmp / "other" / "STATE.md"
    again = stamp.start("5h", state=other, now="2026-10-04T22:00:00Z")
    refused(again)
    assert not other.parent.exists()
    assert stamp.session.read_bytes() == kept
