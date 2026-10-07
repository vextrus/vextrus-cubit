"""The seed template (`vextrus.testing.seed_template`) copies what a real seed makes: the same rows in
every table, a job's events written by the queue, the job and the file that names it joined, the stored
files under the new tenant's keys, and, after a flush, ids no seed made before (the ledger of used ids
refuses one twice)."""

import re
import subprocess
from importlib import import_module
from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import call_command
from django.db import connections

from vextrus.platform.database import OWNER_ALIAS
from vextrus.seed import demo as seed_demo_module
from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import seeded_offline
from vextrus.testing.seed_template import UUID

BOTH = ["default", "owner"]


def owner_rows(sql: str) -> list[tuple[object, ...]]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(sql)
        return list(cursor.fetchall())


def shape() -> dict[str, object]:
    """What a seed leaves, with every id left out: rows per table, the job and its events, and the
    event log with the ids in its payloads blanked."""
    tables = [
        r[0]
        for r in owner_rows(
            "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'"
            " order by 1"
        )
    ]
    counts = {t: owner_rows(f"select count(*) from {t}")[0][0] for t in tables}
    blank = f"regexp_replace(%s::text, '{UUID}', 'U', 'g')"
    return {
        "counts": counts,
        "job": owner_rows("select status, attempts, scheduled_at > now() from procrastinate_jobs"),
        "events": owner_rows("select type from procrastinate_events order by id"),
        "job_named": owner_rows(
            "select count(*) from drawings_drawingfile f"
            " join procrastinate_jobs j on j.id = f.read_job_id"
        ),
        "log": owner_rows(
            f"select kind, subject_type, {blank % 'payload'} from platform_domainevent order by 1, 2, 3"
        ),
        "job_args": owner_rows(f"select {blank % 'args'} from procrastinate_jobs"),
    }


def real_layers(name: str, demo: Demo) -> None:
    import_module(f"vextrus.seed.{name}").run(demo)


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_seed_from_the_template_is_a_real_seeds_rows_and_a_second_one_after_a_flush_still_works(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    copied = seeded_offline()
    from_template = shape()
    files = sorted(
        Path(settings.VEXTRUS_STORAGE_ROOT, str(copied["developer:shapla"])).rglob("*"),
    )
    assert any(path.is_file() for path in files), "the template's stored files were not copied"

    call_command("flush", interactive=False, verbosity=0)
    again = seeded_offline()  # the template's ids, used once, cannot be used again: fresh ones
    assert again["project:KR-01"] != copied["project:KR-01"]
    call_command("flush", interactive=False, verbosity=0)

    monkeypatch.setattr(seed_demo_module, "run_layer", real_layers)
    seeded_offline()

    assert shape() == from_template


def test_the_remap_finds_every_uuid_in_a_text() -> None:
    assert re.fullmatch(UUID, "01a111b3-96ba-74d2-b92b-dea7c3d2bb13")
    assert not re.fullmatch(UUID, "01a111b3-96ba-74d2-b92b")


def test_a_demo_value_is_mapped_wherever_an_id_is_held() -> None:
    from uuid import uuid4

    from vextrus.testing.seed_template import _remapped

    old, new, other = uuid4(), uuid4(), uuid4()
    held: dict[str, object] = {"one": old, "many": [old, other], "nested": {old: (old, 7)}, "n": 3}

    assert _remapped(held, {old: new}) == {
        "one": new,
        "many": [new, other],
        "nested": {new: (new, 7)},
        "n": 3,
    }


def test_a_seed_whose_inputs_differ_from_the_clean_ones_runs_the_real_layers(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Seed once, patch what the layers read, seed again: the template is never copied."""
    from vextrus.seed import projects
    from vextrus.testing import seed_template

    assert seed_template._usable()
    with monkeypatch.context() as patch:
        patch.setitem(
            projects.PROJECTS,
            "developer:meghna",
            (*projects.PROJECTS["developer:meghna"], ("MG-02", "x", "y")),
        )
        assert not seed_template._usable()
    with monkeypatch.context() as patch:
        patch.setenv("PATH", str(tmp_path))  # t182's way of taking the toolchain away
        assert not seed_template._usable()
    with monkeypatch.context() as patch:
        patch.setattr(subprocess.Popen, "__init__", lambda *a, **k: None)
        assert not seed_template._usable()
    with monkeypatch.context() as patch:
        patch.setattr(projects, "services", None)  # a helper replaced
        assert not seed_template._usable()
    assert seed_template._usable()


@pytest.mark.real_seed
def test_a_test_can_force_the_real_layers() -> None:
    from vextrus.testing import seed_template

    assert not seed_template._usable()


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_project_added_to_the_seed_is_seeded_not_copied_from_the_template(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from vextrus.seed import projects

    seeded_offline()  # the template is made, the first seed copied from it
    call_command("flush", interactive=False, verbosity=0)
    monkeypatch.setitem(
        projects.PROJECTS,
        "developer:meghna",
        (*projects.PROJECTS["developer:meghna"], ("MG-02", "Meghna Annex", "Plot 1, Dhaka")),
    )

    assert "project:MG-02" in seeded_offline()
