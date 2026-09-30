"""The demo seed runs each module's seed, lowest layer first, each seeing what the earlier made."""

from importlib import import_module

import pytest
from django.core.management import call_command

from vextrus.modules import MODULES
from vextrus.seed.demo import SEEDS, Demo


def test_the_seeds_run_in_layer_order() -> None:
    assert list(SEEDS) == sorted(SEEDS, key=MODULES.index)


@pytest.mark.django_db(databases=["default", "owner"])  # the command runs sync_library first (#95)
def test_seed_demo_runs_every_seed_passing_what_each_made_on(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    ran: list[tuple[str, list[str]]] = []
    for name in SEEDS:

        def run(demo: Demo, name: str = name) -> None:
            ran.append((name, sorted(demo)))
            demo[name] = object()

        monkeypatch.setattr(import_module(f"vextrus.seed.{name}"), "run", run)

    call_command("seed_demo")

    assert ran == [(name, sorted(SEEDS[:index])) for index, name in enumerate(SEEDS)]
    out = capsys.readouterr().out
    assert "seeded: 4 named rows" in out
    # The seeded reading PDF's time left lasts 30 minutes (vextrus/seed/drawings.py, PAGE_MINUTES).
    assert (
        "Run flush then seed_demo just before a walk: the reading PDF shows its time left for"
        " 30 minutes." in out
    )
