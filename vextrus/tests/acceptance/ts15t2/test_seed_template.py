"""Ticket S15-T2 (issue #532): "seed fixtures from a template database"; its check: "suite time down".

Measured on main (bd5378fe5, 6 Oct 2026): a test whose module asks for the demo seed spends 9-13 s in
set-up (18-26 s under `-n 8`): `seed_demo` runs anew in each module, and in each xdist worker a module's
tests reach. One `seed_demo` sends 11,018 SQL statements through Django (platform 203, projects 94,
drawings 10,626, takeoff 93) in about 14-18 s, 98 % of it the drawings layer's read job.

The bound, counted rather than timed (a timed bound would itself be a flake): after the session's first
seed, the set-up of every test that asks for the demo through the seed fixtures sends at most 1,100 SQL
statements, a tenth of one seed's, so at the measured 9-13 s a seed costs, a later seed-fixture test's
set-up does at most about 1.3 s of the seed's database work. The template is made at most once a session
(per xdist worker); every test still reads the whole demo (`project:KR-01`, `project:MG-01`).

An inner pytest session (no xdist) runs two probe modules: the first asks for the demo through ticket
136's fixture, the later one through 19a's. `probes/counting.py` counts each test's set-up statements.
"""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

REPO = Path(__file__).resolve().parents[4]
PROBES = Path(__file__).with_name("probes")
PROBE_DB = "ts15t2_probe"
BOUND = 1_100
"""A tenth of one `seed_demo`'s 11,018 statements (measured on main, 6 Oct 2026)."""


def without_path(url: str) -> str:
    return urlunsplit(urlsplit(url)._replace(path=""))


def probe_environ(out: Path) -> dict[str, str]:
    """The outer environment without pytest's and xdist's variables, on a fixed base name, so the inner
    run never shares a database with the outer one (which may itself be a worker)."""
    environ = {key: value for key, value in os.environ.items() if not key.startswith("PYTEST_")}
    for variable in ("DATABASE_URL", "DATABASE_OWNER_URL"):
        if variable in environ:
            environ[variable] = without_path(environ[variable])
    environ["VEXTRUS_DB_NAME"] = PROBE_DB
    environ["TS15T2_SETUP_QUERIES"] = str(out)
    return environ


def test_a_later_seed_fixture_tests_set_up_sends_at_most_a_tenth_of_a_seeds_statements(
    tmp_path: Path,
) -> None:
    out = tmp_path / "setup-queries.txt"
    done = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-p",
            "vextrus.tests.acceptance.ts15t2.probes.counting",
            "-q",
            "-rf",
            str(PROBES / "probe_seed_first.py"),
            str(PROBES / "probe_seed_later.py"),
        ],
        cwd=REPO,
        env=probe_environ(out),
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-4000:]
    counts = dict(line.split("\t") for line in out.read_text().splitlines())
    later = {
        node.split("::")[-1]: int(sent) for node, sent in counts.items() if "probe_seed_later" in node
    }
    assert len(later) == 2, counts

    over = {name: sent for name, sent in later.items() if sent > BOUND}
    assert over == {}, f"seed-fixture set-up over the bound of {BOUND} statements: {over}"
