"""One API path, two modules (ticket 21a): `vextrus/api.py` merges one path's operations across the
modules' routers, since Django serves the first route that matches (21a's upload `POST` shares
`drawings`' files list path, which would otherwise answer 405)."""

import uuid
from typing import Any

import pytest
from ninja import NinjaAPI, Router


def test_the_upload_and_the_files_list_share_one_path() -> None:
    from vextrus.api import api

    methods = {
        method
        for router in api._get_bound_routers()
        for path, view in router.path_operations.items()
        if path.endswith("/drawings/files")
        for op in view.operations
        for method in op.methods
    }
    assert methods == {"GET", "POST"}


def test_two_modules_declaring_one_method_on_one_path_is_refused() -> None:
    from vextrus.api import VextrusAPI

    first, second = Router(), Router()

    @first.get("/same")
    def one(request: Any) -> None: ...

    @second.get("/same")
    def two(request: Any) -> None: ...

    api: NinjaAPI = VextrusAPI(urls_namespace=f"clash-{uuid.uuid4().hex}")
    api.add_router("", first)
    api.add_router("", second)
    with pytest.raises(ValueError, match="declared by two modules"):
        api.urls  # noqa: B018
