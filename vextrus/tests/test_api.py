"""The one API: session auth with CSRF, every module's router, every message code in the schema."""

from pathlib import Path

import pytest
from ninja.security import SessionAuth

from vextrus import api as api_module
from vextrus.api import api, message_codes
from vextrus.modules import MODULES


def test_the_api_signs_in_by_session_and_checks_csrf() -> None:
    assert len(api.auth) == 1
    auth = api.auth[0]
    assert isinstance(auth, SessionAuth)
    assert auth.csrf is True


def test_every_module_s_router_is_mounted() -> None:
    mounted = {tag for _prefix, router in api._routers for tag in (router.tags or [])}

    assert mounted >= set(MODULES)


def write_codes(root: Path, package: str, submodule: str, body: str) -> None:
    folder = root.joinpath(*package.split("."))
    folder.mkdir(parents=True, exist_ok=True)
    for parent in [
        root.joinpath(*package.split(".")[:n]) for n in range(1, len(package.split(".")) + 1)
    ]:
        (parent / "__init__.py").touch()
    (folder / "__init__.py").write_text(
        "from engine.messages import collect_codes\n\ndef codes():\n    return collect_codes(__name__)\n"
    )
    (folder / f"{submodule}.py").write_text("from engine.messages import MessageCode\n" + body)


@pytest.fixture
def fake_packages(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write_codes(
        tmp_path, "fake_engine.messages", "read", 'A = MessageCode("fake_engine.read.no_layouts")\n'
    )
    write_codes(
        tmp_path,
        "fake_vextrus.jobs_mod.messages",
        "jobs",
        'B = MessageCode("jobs_mod.jobs.failed", params=("reason",))\n'
        'C = MessageCode("jobs_mod.jobs.started", event=True)\n',
    )
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.setattr(
        api_module, "MESSAGE_PACKAGES", ("fake_engine.messages", "fake_vextrus.jobs_mod.messages")
    )


@pytest.mark.usefixtures("fake_packages")
def test_every_package_s_codes_are_assembled() -> None:
    assert [held.code for held in message_codes()] == [
        "fake_engine.read.no_layouts",
        "jobs_mod.jobs.failed",
        "jobs_mod.jobs.started",
    ]


@pytest.mark.usefixtures("fake_packages")
def test_the_schema_carries_every_code_and_every_event_as_enums() -> None:
    schemas = api.get_openapi_schema()["components"]["schemas"]

    assert schemas["MessageCode"]["enum"] == [
        "fake_engine.read.no_layouts",
        "jobs_mod.jobs.failed",
        "jobs_mod.jobs.started",
    ]
    assert schemas["EventCode"]["enum"] == ["jobs_mod.jobs.started"]


def test_the_packages_assembled_are_the_engine_s_and_every_module_s() -> None:
    assert (
        "engine.messages",
        *(f"vextrus.{module}.messages" for module in MODULES),
    ) == api_module.MESSAGE_PACKAGES
    message_codes()  # every real package collects without error
