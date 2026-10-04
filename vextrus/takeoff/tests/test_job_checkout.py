"""The job starts in the real-drawing check's checkout shape (ticket 21c; the orchestrator's ruling
(b)): only the engine paths (`.github/engine-paths.txt`) and `scripts/real_drawings/source.py`'s
`CHECKOUT_ALSO` are copied, and in a fresh interpreter there Django starts on `vextrus.settings.job`,
its system checks pass, its migrations load as one graph, every installed module's Library loads, and
the job and its export entry import, each from the copy (never from this checkout)."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

from scripts.real_drawings.source import CHECKOUT_ALSO
from tools.lint.engine_paths import matching, read_patterns

REPO = Path(__file__).resolve().parents[3]

STARTS = """
import sys
from pathlib import Path

import django

django.setup()

from importlib import import_module

from django.apps import apps
from django.core.management import call_command
from django.db.migrations.loader import MigrationLoader

call_command("check")
MigrationLoader(None, ignore_no_migrations=True).graph.validate_consistency()
for module in ("platform", "projects", "drawings", "takeoff"):
    assert apps.is_installed(f"vextrus.{module}"), module
    import_module(f"vextrus.{module}.library")
entry = import_module("vextrus.takeoff.services.export")
job = import_module("vextrus.takeoff.tasks.read_file")
here = Path.cwd().resolve()
for loaded in (entry, job, import_module("vextrus.settings.job")):
    assert Path(loaded.__file__).resolve().is_relative_to(here), loaded.__file__
print("started")
"""


def _checkout(into: Path) -> None:
    listed = subprocess.run(
        ["git", "-C", str(REPO), "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    patterns = read_patterns((REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8"))
    for path in matching(sorted(listed), [*patterns, *CHECKOUT_ALSO]):
        source = REPO / path
        if source.is_file():
            target = into / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)


def test_the_job_starts_in_the_checks_checkout_shape(tmp_path: Path) -> None:
    checkout = tmp_path / "src"
    _checkout(checkout)
    assert not (checkout / "vextrus" / "boq").exists()  # the shape: other modules left out
    assert not (checkout / "vextrus" / "seed").exists()
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in ("PYTHONPATH", "DJANGO_SETTINGS_MODULE")
    }
    env["DJANGO_SETTINGS_MODULE"] = "vextrus.settings.job"

    done = subprocess.run(
        [sys.executable, "-c", STARTS],
        cwd=checkout,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )

    assert done.returncode == 0, done.stderr[-4000:]
    assert done.stdout.strip().endswith("started")


def test_the_export_starts_as_the_sandbox_starts_it(tmp_path: Path) -> None:
    """`python -m vextrus.takeoff.services.export` in a fresh interpreter, with no Django settings
    named (the sandbox's cleared environment): its package imports nothing that needs Django set up,
    so the run reaches the cluster, here a socket where none listens (21d: the first `--job` run on
    the real sets ended at `ImproperlyConfigured` before reading anything)."""
    checkout = tmp_path / "src"
    _checkout(checkout)
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in ("PYTHONPATH", "DJANGO_SETTINGS_MODULE", "DATABASE_URL")
    }
    socket = tmp_path / "no-cluster"
    socket.mkdir()
    out = tmp_path / "export.json"

    done = subprocess.run(
        [
            *(sys.executable, "-m", "vextrus.takeoff.services.export", "--set", str(tmp_path)),
            *("--out", str(out), "--database", str(socket)),
        ],
        cwd=checkout,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )

    assert done.returncode != 0
    assert "ImproperlyConfigured" not in done.stderr, done.stderr[-4000:]
    assert "AppRegistryNotReady" not in done.stderr, done.stderr[-4000:]
    assert "psycopg.OperationalError" in done.stderr, done.stderr[-4000:]
    assert not out.exists()
