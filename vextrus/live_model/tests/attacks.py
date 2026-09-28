"""Helpers for attacking the Live Model's tables as `vextrus_app`, with plain SQL or the ORM."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db import DatabaseError, connections, transaction

RLS_REFUSED = "new row violates row-level security policy"
OUT_OF_REACH = "names a row neither this tenant's nor its Library's"

T_TABLES = ("live_model_element", "live_model_record", "live_model_elementrelation")
L_TABLES = (
    "live_model_elementfamily",
    "live_model_attributedefinition",
    "live_model_familyattribute",
    "live_model_classificationsystem",
    "live_model_classificationreference",
)
# An update each table allows its own tenant, so a refusal elsewhere is the policy's doing.
UPDATES = {
    "live_model_element": "mark_hint = 'C1'",
    "live_model_record": "evidence_note = 'Cube test'",
    "live_model_elementrelation": "valid_to_seq = 9",
    "live_model_elementfamily": "ifc_predefined_type = 'PILASTER'",
    "live_model_attributedefinition": "version = 2",
    "live_model_familyattribute": "required = false",
    "live_model_classificationsystem": "may_ship = false",
    "live_model_classificationreference": "name = 'Renamed'",
}
REACH_CHECKED = {"live_model_element", "live_model_familyattribute"}
"""The tables whose rows name an Element Family or an Attribute Definition, checked by a trigger."""


def act(cursor: Any, *, tenant: uuid.UUID | None = None, library: uuid.UUID | None = None) -> None:
    """Set the settings as the app does, local to the transaction ('' for none)."""
    cursor.execute(
        "select set_config('app.tenant_id', %s, true), set_config('app.user_id', '', true), "
        "set_config('app.library_id', %s, true)",
        [str(tenant or ""), str(library or "")],
    )


def ids(cursor: Any, table: str) -> set[uuid.UUID]:
    cursor.execute(f"select id from {table}")
    return {row[0] for row in cursor.fetchall()}


def execute(cursor: Any, sql: str, params: list[Any]) -> Callable[[], int]:
    """A statement to run later; it returns the rows it touched."""

    def run() -> int:
        cursor.execute(sql, params)
        return int(cursor.rowcount)

    return run


def refused(write: Callable[[], object]) -> str:
    """The error a write raises, inside its own savepoint so the test goes on."""
    with pytest.raises(DatabaseError) as raised, transaction.atomic():
        write()
    return str(raised.value)


def immediate(write: Callable[[], object]) -> Callable[[], object]:
    """The write with its deferred keys checked at once, so its savepoint sees the failure."""

    def run() -> object:
        with connections["default"].cursor() as cursor:
            cursor.execute("set constraints all immediate")
        return write()

    return run
