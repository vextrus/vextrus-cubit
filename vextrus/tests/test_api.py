"""The one API: session auth with CSRF, every module's router, every message code in the schema."""

import sys
from pathlib import Path

import pytest
from ninja.security import SessionAuth

from vextrus import api as api_module
from vextrus.api import api, message_codes
from vextrus.modules import MODULES


def test_the_api_signs_in_by_session_and_checks_csrf() -> None:
    assert isinstance(api.auth, list)
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
    # A sibling test's fake modules are cached under the same names, their tmp_path since deleted
    # (`tmp_path_retention_policy = "failed"`): import this test's own.
    for name in [name for name in sys.modules if name.split(".")[0] in ("fake_engine", "fake_vextrus")]:
        monkeypatch.delitem(sys.modules, name)
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


# Ninja's schema pages only in development; every refusal a `Refusal` (07) --------------------------


@pytest.mark.django_db
def test_the_schema_and_docs_pages_are_not_served_outside_development() -> None:
    from django.test import Client

    client = Client()

    assert client.get("/api/openapi.json").status_code == 404
    assert client.get("/api/docs").status_code == 404


def test_in_development_the_schema_pages_are_served() -> None:
    from vextrus.api import VextrusAPI, schema_url

    shown = VextrusAPI(urls_namespace="api-development-check", openapi_url=schema_url(True))
    hidden = VextrusAPI(urls_namespace="api-production-check", openapi_url=schema_url(False))

    def names(built: VextrusAPI) -> set[str | None]:
        return {getattr(pattern, "name", None) for pattern in built.urls[0]}

    assert names(shown) >= {"openapi-json", "openapi-view"}
    assert not names(hidden) & {"openapi-json", "openapi-view"}


@pytest.mark.django_db
def test_the_schema_is_still_exported_for_the_web_s_types(tmp_path: Path) -> None:
    import json

    from django.core.management import call_command

    output = tmp_path / "schema.json"
    call_command("export_openapi_schema", "--api", "vextrus.api.api", "--output", str(output))

    schema = json.loads(output.read_text())
    assert "/api/me" in schema["paths"]
    assert "Refusal" in schema["components"]["schemas"]


def test_the_api_answers_its_own_refusals_as_refusals() -> None:
    from ninja.errors import AuthenticationError

    from vextrus.platform.http import acts
    from vextrus.platform.services import auth as auth_services

    assert isinstance(api.auth, list)
    assert isinstance(api.auth[0], acts.Session)
    assert {AuthenticationError, auth_services.Refused} <= set(api._exception_handlers)


@pytest.mark.django_db
def test_no_two_schemas_share_a_component_name(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Ninja keys each schema by its class's name and keeps the last one merged: two schemas of one
    name would leave the web's generated types describing one of them for both (#75's review)."""
    from django.core.management import call_command
    from ninja.openapi.schema import OpenAPISchema

    clashes: list[str] = []
    merge = OpenAPISchema.add_schema_definitions

    def checked(self: OpenAPISchema, definitions: dict[str, object]) -> None:
        clashes.extend(
            name
            for name, definition in definitions.items()
            if self.schemas.get(name, definition) != definition
        )
        merge(self, definitions)

    monkeypatch.setattr(OpenAPISchema, "add_schema_definitions", checked)
    call_command(
        "export_openapi_schema", "--api", "vextrus.api.api", "--output", str(tmp_path / "schema.json")
    )

    assert sorted(set(clashes)) == []
