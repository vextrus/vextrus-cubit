"""A module's `http` package: one router holding every submodule's router."""

from pathlib import Path

import pytest
from ninja import NinjaAPI

from vextrus.routers import collect_router

SUBMODULE = """
from ninja import Router

router = Router()


@router.get("/{path}", auth=None)
def {name}(request) -> str:
    return "{name}"
"""


def test_every_submodules_router_is_mounted(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    package = tmp_path / "mod_http" / "http"
    package.mkdir(parents=True)
    (tmp_path / "mod_http" / "__init__.py").write_text("")
    (package / "__init__.py").write_text("")
    (package / "me.py").write_text(SUBMODULE.format(path="me", name="me"))
    (package / "members.py").write_text(SUBMODULE.format(path="members", name="members"))
    (package / "middleware.py").write_text("class TenantMiddleware: ...\n")
    monkeypatch.syspath_prepend(str(tmp_path))

    api = NinjaAPI(urls_namespace="test-collect-router")
    api.add_router("", collect_router("mod_http.http"))

    paths = api.get_openapi_schema(path_prefix="")["paths"]
    assert sorted(paths) == ["/me", "/members"]
    assert paths["/me"]["get"]["tags"] == ["mod_http"]
