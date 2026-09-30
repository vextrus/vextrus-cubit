"""Ticket 21c, the check's sandbox can start the job (the orchestrator's ruling on the builder's item 3,
option (b)): "a job-only settings module and the checkout carrying `vextrus/settings/**` beside the
engine paths".

A run's checkout is what `scripts/real_drawings/source.py` writes from git's objects (`engine_files`,
then `write_checkout`), and its code hash covers exactly those files ("the code hash covers exactly what
the sandbox can execute"). Django needs `vextrus/settings/` and every app its settings install; the job's
own settings install only apps on the engine paths, so a backend-only PR stays out of the check.

Name chosen by the acceptance writer where the ruling gives none (the builder meets it):
`vextrus.settings.job`, the job-only settings module (beside `vextrus.settings.test`).
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.real_drawings import source
from tools.lint.engine_paths import matching, read_patterns

REPO = Path(__file__).resolve().parents[5]
JOB_SETTINGS = "vextrus.settings.job"
PATTERNS = (REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8")


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def _commit(repo: Path, files: dict[str, str]) -> str:
    for path, text in files.items():
        (repo / path).parent.mkdir(parents=True, exist_ok=True)
        (repo / path).write_text(text, encoding="utf-8")
    _git(repo, "add", "--", *files)
    _git(
        repo,
        "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false",
        "-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", "a head",
    )  # fmt: skip
    return _git(repo, "rev-parse", "HEAD")


@pytest.fixture
def head(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    return repo


INVENTED = {
    "engine/read.py": "X = 1\n",
    "vextrus/settings/__init__.py": "A = 1\n",
    "vextrus/settings/job.py": "B = 1\n",
    "vextrus/takeoff/tasks/read_file.py": "C = 1\n",
    "vextrus/boq/models.py": "D = 1\n",
    "web/src/main.tsx": "export {}\n",
}
"""An invented head: an engine file, the settings, the product job's file, a backend module the job
does not import (`boq`) and a web file."""


def test_a_runs_checkout_carries_the_settings_beside_the_engine_paths(head: Path) -> None:
    commit = _commit(head, INVENTED)

    carried = [f.path for f in source.engine_files(head, commit, PATTERNS)]

    assert "vextrus/settings/__init__.py" in carried
    assert "vextrus/settings/job.py" in carried
    assert "engine/read.py" in carried
    assert "vextrus/takeoff/tasks/read_file.py" in carried
    assert "vextrus/boq/models.py" not in carried, "a backend-only file is not the check's"
    assert "web/src/main.tsx" not in carried


def test_the_code_hash_changes_with_the_settings_the_sandbox_runs(head: Path) -> None:
    first = source.code_hash(source.engine_files(head, _commit(head, INVENTED), PATTERNS))

    changed = _commit(head, {"vextrus/settings/job.py": "B = 2\n"})

    assert source.code_hash(source.engine_files(head, changed, PATTERNS)) != first


def test_a_backend_only_change_leaves_the_code_hash_as_it_was(head: Path) -> None:
    first = source.code_hash(source.engine_files(head, _commit(head, INVENTED), PATTERNS))

    changed = _commit(head, {"vextrus/boq/models.py": "D = 2\n"})

    assert source.code_hash(source.engine_files(head, changed, PATTERNS)) == first


def _apps_under_job_settings(where: Path) -> list[str]:
    """The installed apps' module paths once Django is set up with the job's settings, run with the
    Python of these tests in `where` (nothing else on its path)."""
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    env["DJANGO_SETTINGS_MODULE"] = JOB_SETTINGS
    env["PYTHONPATH"] = str(where)
    program = (
        "import json, django\n"
        "django.setup()\n"
        "from django.apps import apps\n"
        "import vextrus.takeoff.tasks.read_file\n"
        "print(json.dumps([a.name for a in apps.get_app_configs()]))\n"
    )
    done = subprocess.run(
        [sys.executable, "-c", program], cwd=where, env=env, capture_output=True, text=True,
        check=False, timeout=300,
    )  # fmt: skip
    assert done.returncode == 0, done.stderr[-2000:]
    names: list[str] = json.loads(done.stdout.strip().splitlines()[-1])
    return names


def test_the_jobs_settings_install_no_vextrus_app_outside_the_engine_paths() -> None:
    names = _apps_under_job_settings(REPO)
    vextrus = [n for n in names if n.startswith("vextrus.")]
    assert "vextrus.takeoff" in vextrus

    packages = [f"{n.replace('.', '/')}/__init__.py" for n in vextrus]
    outside = sorted(set(packages) - set(matching(packages, read_patterns(PATTERNS))))

    assert outside == [], f"installed by the job's settings, but on no engine path: {outside}"


def test_django_starts_with_the_jobs_settings_in_a_checkout_of_this_head(tmp_path: Path) -> None:
    """The sandbox's own checkout of this commit (as `source` writes it for a run), and Django set up
    in it with the job's settings, the read job imported: the posting run does not fail at setup."""
    commit = _git(REPO, "rev-parse", "HEAD")
    checkout = tmp_path / "checkout"
    source.write_checkout(REPO, source.engine_files(REPO, commit, PATTERNS), checkout)

    names = _apps_under_job_settings(checkout)

    assert "vextrus.takeoff" in names
