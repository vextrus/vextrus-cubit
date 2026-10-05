"""Ticket 182 (M0 21e): "seed_demo must not need the toolchain in CI (replay the job's recorded
output)". CI's backend job has no LibreDWG, no ACadSharp dump, no .NET and no bubblewrap; here each
is made unavailable (their paths pointed at nothing, an empty PATH, and no process may start), and
the demo seed still seeds KR-01 through the read job's steps, at m0-screens §7's counts.
"""

import subprocess
import uuid
from collections import Counter
from pathlib import Path
from typing import Any, NoReturn

import pytest
from django.test import Client

from vextrus.platform.models import User
from vextrus.platform.services import tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo, seed_demo
from vextrus.testing.auth import Api

from ..t21c.step1_whole import open_questions, proposals
from .test_seed_by_the_job import read_by_the_job

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


@pytest.fixture
def no_toolchain(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    nothing = tmp_path / "no-toolchain"
    nothing.mkdir()
    for variable in ("VEXTRUS_LIBREDWG", "VEXTRUS_ACADSHARP_DUMP", "VEXTRUS_DOTNET"):
        monkeypatch.setenv(variable, str(nothing / variable.lower()))
    monkeypatch.setenv("PATH", str(nothing))

    def refuse(*args: Any, **kwargs: Any) -> NoReturn:
        raise FileNotFoundError(f"no toolchain in CI: {args[1] if len(args) > 1 else args}")

    monkeypatch.setattr(subprocess.Popen, "__init__", refuse)


@pytest.fixture
def seeded(no_toolchain: None, monkeypatch: pytest.MonkeyPatch) -> Demo:
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    return seed_demo()


def as_nusrat(demo: Demo) -> Api:
    client = Client()
    client.force_login(User.objects.get(email="nusrat@shapla-homes.example"))
    session = client.session
    session[tenancy.SESSION_TENANT] = str(demo["developer:shapla"])
    session.save()
    return Api(client)


def test_the_seed_reads_kr_01s_dwgs_by_the_job_without_the_toolchain(seeded: Demo) -> None:
    read_by_the_job(seeded)


def test_the_seed_without_the_toolchain_holds_section_7s_sheets_and_questions(
    seeded: Demo,
) -> None:
    nusrat = as_nusrat(seeded)
    kr01: uuid.UUID = seeded["project:KR-01"]

    read_by_the_job(seeded)
    listed = proposals(nusrat, kr01)
    assert Counter(p["discipline"] for p in listed) == {
        "structural": 13, "architectural": 8, "electrical": 3,
    }  # fmt: skip
    assert [q["kind"] for q in open_questions(nusrat, kr01)] == [
        "file_misread", "conflict", "missing", "low_confidence", "check",
    ]  # fmt: skip
