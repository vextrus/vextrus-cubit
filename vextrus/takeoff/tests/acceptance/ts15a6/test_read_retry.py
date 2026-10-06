"""Ticket S15-A6 (#546), its read-retry half (#192): "a read job's retry can run inside the next file's
child". The real-drawing check's export (`vextrus.takeoff.services.export`, 21d) reads each file in a
child of its own under that file's timeout (`read_each`); a job that raised is tried again
`VEXTRUS_JOB_RETRY_SECONDS` later, so its retry ran in the next file's child, under that file's
timeout (the issue's repro: "a raising file then a slow one; the first reported ok, the second
timed_out, a job left doing"). The issue's fix: "each child runs only its own file's job".

Each child here is the product's own (`export.main` with the arguments the export gives its child,
`--database <host> --worker <storage>`, and whatever `read_each` adds), on the test database, with
21c's invented readers (`_child.py`; no toolchain, no real drawing). The first file's reader raises on
every try. The time a real next file takes to be added and read (past the retry's 10 s) is passed by
making the waiting retry due just before the second child starts, as the clock would; nothing waits
on the wall clock. The children's reads are logged by file and child.
"""

import hashlib
import json
import sys
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connections

from vextrus.platform.database import OWNER_ALIAS
from vextrus.takeoff.services import export
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.jobs import database_url

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

RAISES = "a-raises.dwg"
NEXT = "b-reads.dwg"
REPO = Path(__file__).resolve().parents[5]
CHILD = (
    f"import sys; sys.path.insert(0, {str(REPO)!r}); "
    "from vextrus.takeoff.tests.acceptance.ts15a6 import _child; sys.exit(_child.main())"
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def the_retry_delay_passes() -> None:
    """A retry waiting its `VEXTRUS_JOB_RETRY_SECONDS` is due now, as it is once the next file has
    been added and read for longer than that."""
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(
            "update procrastinate_jobs set scheduled_at = now()"
            " where status = 'todo' and scheduled_at > now()"
        )


def test_a_raising_files_retry_never_runs_in_the_next_files_child(
    qs_project: QsProject, tmp_path: Path
) -> None:
    folder = tmp_path / "set"
    folder.mkdir()
    for name in (RAISES, NEXT):
        (folder / name).write_bytes(drawing("dwg", f"S15-A6 {name}"))
    paths = {name: _sha(folder / name) for name in (RAISES, NEXT)}
    log = tmp_path / "reads.log"
    log.touch()
    storage = Path(settings.VEXTRUS_STORAGE_ROOT)
    env = {
        "DJANGO_SETTINGS_MODULE": "vextrus.settings.job",
        "DATABASE_URL": database_url("default"),
        "DATABASE_OWNER_URL": database_url(OWNER_ALIAS),
        "VEXTRUS_STORAGE_ROOT": str(storage),
    }
    host = str(settings.DATABASES["default"]["HOST"])
    children: list[int] = []

    def worker() -> list[str]:
        children.append(len(children) + 1)
        if len(children) == 2:  # the next file's child: the first file's retry is due by now
            the_retry_delay_passes()
        config = {
            "child": children[-1],
            "log": str(log),
            "raises": RAISES,
            "names": [RAISES, NEXT],
            "env": env,
        }
        return [
            sys.executable,
            "-c",
            CHILD,
            json.dumps(config),
            "--database",
            host,
            "--worker",
            str(storage),
        ]

    export.read_each(
        qs_project.member.developer_id,
        qs_project.project_id,
        folder,
        paths,
        timeout=600.0,
        worker=worker,
    )

    reads = [tuple(json.loads(line)) for line in log.read_text(encoding="utf-8").splitlines()]
    assert len(children) == 2, children  # one child for each file, as the export reads them
    assert (NEXT, 2) in reads, reads  # the next file was read, in its own child
    assert {child for name, child in reads if name == RAISES} == {1}, reads
    assert {name for name, child in reads if child == 2} == {NEXT}, reads
