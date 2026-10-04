"""Ticket f3, 3.8: `scripts/owner/clean.sh`, the owner's lawful disk cleanup (spec 3.13, "Disk full, no
lawful cleanup"; owner action O7: "dry run first ... it also lists stale test databases").

With no argument it is a dry run: it lists each candidate under the roots in `VEXTRUS_CLEAN_ROOTS`
(colon-separated folders) with a size, prints a databases section (or why `psql` could not be asked)
and deletes nothing. `--yes` deletes only for the owner at a terminal: it is refused when stdin is
not a terminal or `VEXTRUS_ROLE` is set, so an agent can never use it to get round the guard's
recursive-delete refusal. It never drops a database. `psql` and `dropdb` are stubs first on `PATH`
that record their calls.
"""

from __future__ import annotations

import hashlib
import json
import os
import pty
import re
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
SCRIPT = REPO / "scripts" / "owner" / "clean.sh"

STUB = """
import json, sys
with open({log!r}, "a") as log:
    log.write(json.dumps([{who!r}, *sys.argv[1:]]) + "\\n")
if {who!r} == "psql":
    print("vextrus_t901_old\\nvextrus_rv_slot3\\nvextrus")
"""


class Cleaner:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.roots = [tmp / "roots" / "worktrees", tmp / "roots" / "work"]
        for i, root in enumerate(self.roots):
            for child in (
                "alpha",
                "beta",
            ):  # no digits in the names: a listed line's digits are its size
                folder = root / f"{child}-{('one', 'two')[i]}"
                folder.mkdir(parents=True)
                (folder / "big.bin").write_bytes(bytes(range(256)) * (64 * (i + 1)))
                (folder / "note.txt").write_text(f"keep {folder.name}\n")
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.log = tmp / "db-calls.log"
        for who in ("psql", "dropdb"):
            path = self.stubs / who
            path.write_text(f"#!{sys.executable}\n" + STUB.format(log=str(self.log), who=who))
            path.chmod(0o755)

    def env(self, role: str | None = None) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            VEXTRUS_CLEAN_ROOTS=os.pathsep.join(str(root) for root in self.roots),
        )
        if role is not None:
            env["VEXTRUS_ROLE"] = role
        return env

    def fingerprint(self) -> str:
        digest = hashlib.sha256()
        for path in sorted((self.tmp / "roots").rglob("*")):
            digest.update(str(path.relative_to(self.tmp)).encode())
            if path.is_file():
                digest.update(path.read_bytes())
        return digest.hexdigest()

    def db_calls(self) -> list[list[str]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@pytest.fixture
def cleaner(tmp_path: Path) -> Cleaner:
    return Cleaner(tmp_path)


# C1
def test_c1_no_argument_is_a_dry_run_that_lists_with_sizes_and_deletes_nothing(cleaner: Cleaner) -> None:
    before = cleaner.fingerprint()
    done = subprocess.run(
        ["bash", str(SCRIPT)],
        cwd=cleaner.tmp,
        env=cleaner.env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )
    assert done.returncode == 0, show(done)
    for root in cleaner.roots:
        listed = [line for line in done.stdout.splitlines() if str(root) in line]
        assert listed, f"{root} is not listed\n{show(done)}"
        assert all(re.search(r"\d", line.replace(str(root), "")) for line in listed), show(done)
    assert re.search(r"(?i)database", done.stdout), show(done)
    assert cleaner.fingerprint() == before, "a dry run changed the files"
    assert all("drop" not in " ".join(call).lower() for call in cleaner.db_calls()), cleaner.db_calls()
    assert [call for call in cleaner.db_calls() if call[0] == "dropdb"] == []


# C2
@pytest.mark.parametrize("caller", ["no terminal", "agent at a terminal"])
def test_c2_yes_is_refused_without_a_terminal_or_with_an_agent_role(
    cleaner: Cleaner, caller: str
) -> None:
    before = cleaner.fingerprint()
    if caller == "no terminal":
        done = subprocess.run(
            ["bash", str(SCRIPT), "--yes"],
            cwd=cleaner.tmp,
            env=cleaner.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
    else:
        controller, terminal = pty.openpty()
        try:
            done = subprocess.run(
                ["bash", str(SCRIPT), "--yes"],
                cwd=cleaner.tmp,
                env=cleaner.env(role="builder"),
                capture_output=True,
                text=True,
                stdin=terminal,
                timeout=120,
                check=False,
            )
        finally:
            os.close(terminal)
            os.close(controller)
    assert done.returncode != 0, show(done)
    assert "No such file" not in done.stderr, show(done)
    assert cleaner.fingerprint() == before, "a refused --yes deleted files"
    dry = subprocess.run(  # the same caller may still look: the dry run is never refused
        ["bash", str(SCRIPT)],
        cwd=cleaner.tmp,
        env=cleaner.env(role="builder" if caller != "no terminal" else None),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )
    assert dry.returncode == 0, show(dry)
    assert [call for call in cleaner.db_calls() if call[0] == "dropdb"] == []


# C3
def test_c3_the_script_parses_runs_strict_and_never_drops_a_database() -> None:
    parsed = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert parsed.returncode == 0, parsed.stderr
    text = SCRIPT.read_text()
    assert re.search(r"(?m)^\s*set -euo pipefail\b", text)
    assert not re.search(r"(?i)\bdropdb\b|drop\s+database", text)
