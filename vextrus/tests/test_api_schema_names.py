"""No two of the API's schemas share a name (ticket 19a's finding): OpenAPI names a component by its
class's name, so a second `ActOut` silently replaced the first in the schema the web's types are made
from, and the web's typecheck failed far from the cause. Every Ninja schema a module defines (the API
imports every module's routers, and so their schemas) must have a name of its own."""

from collections import defaultdict

from ninja import Schema

from vextrus.api import api


def subclasses(cls: type) -> set[type]:
    found = set()
    for sub in cls.__subclasses__():
        found |= {sub, *subclasses(sub)}
    return found


def test_every_schema_of_the_api_has_a_name_of_its_own() -> None:
    assert api.urls  # every module's router, and its schemas, imported
    by_name: dict[str, set[str]] = defaultdict(set)
    for schema in subclasses(Schema):
        if schema.__module__.startswith("vextrus."):
            by_name[schema.__name__].add(f"{schema.__module__}.{schema.__qualname__}")

    assert {name: sorted(held) for name, held in by_name.items() if len(held) > 1} == {}
