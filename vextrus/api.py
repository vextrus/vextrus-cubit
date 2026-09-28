"""The one API (ADR 0022): Django Ninja, signed in by session with CSRF (07's `acts.Session`), every
module's router, and every refusal as `{code, params}` (`acts.install`).

It also assembles every module's message codes and the engine's into the OpenAPI schema, as two
enums the web's generated types carry (the M0 plan's reviews A5, R7; story 92):
- `MessageCode`: every code the machine may send, so the web's test fails on a code with no words;
- `EventCode`: the DomainEvent kinds among them, so `platform`'s activity API names them without
  importing a higher module.
"""

from importlib import import_module
from typing import Any

from django.conf import settings
from ninja import NinjaAPI
from ninja.openapi.schema import OpenAPISchema

from engine.messages import MessageCode
from vextrus.modules import MODULES
from vextrus.platform.http import acts

MESSAGE_PACKAGES: tuple[str, ...] = (
    "engine.messages",
    *(f"vextrus.{module}.messages" for module in MODULES),
)


def message_codes() -> tuple[MessageCode, ...]:
    """Every code in MESSAGE_PACKAGES, in code order. Each package's `codes()` collects its own."""
    found: dict[str, MessageCode] = {}
    for package in MESSAGE_PACKAGES:
        for held in import_module(package).codes():
            if held.code in found:
                raise ValueError(f"{held.code} is declared in two packages")
            found[held.code] = held
    return tuple(found[code] for code in sorted(found))


class VextrusAPI(NinjaAPI):
    def get_openapi_schema(
        self, *, path_prefix: str | None = None, path_params: dict[str, Any] | None = None
    ) -> OpenAPISchema:
        schema = super().get_openapi_schema(path_prefix=path_prefix, path_params=path_params)
        codes = message_codes()
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        components["MessageCode"] = {
            "type": "string",
            "description": "A code the machine sends with named parameters; the web words it.",
            "enum": [held.code for held in codes],
        }
        components["EventCode"] = {
            "type": "string",
            "description": "The kind of a DomainEvent.",
            "enum": [held.code for held in codes if held.event],
        }
        return schema


def schema_url(debug: bool) -> str | None:
    """Ninja's schema and docs pages are served only in development (`VEXTRUS_DEBUG`); the web's
    types come from `manage.py export_openapi_schema`, which reads the schema without them."""
    return "/openapi.json" if debug else None


api = VextrusAPI(
    title="Vextrus",
    version="0",
    auth=acts.Session(),
    urls_namespace="api",
    openapi_url=schema_url(settings.DEBUG),
)
# Every refusal, the sign-in check's and the CSRF check's included, answers `{code, params}`.
acts.install(api)

for module in MODULES:
    api.add_router("", import_module(f"vextrus.{module}.http").router)
