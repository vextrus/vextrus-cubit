"""Ids: every row's id is a UUIDv7 made in the app by `ids.new_id()` (docs/data-model.md §2)."""

import uuid

from django.apps import apps
from django.db import models

from vextrus.modules import MODULES
from vextrus.platform.ids import new_id


def test_a_new_id_is_a_version_7_uuid() -> None:
    made = new_id()

    assert isinstance(made, uuid.UUID)
    assert made.version == 7


def test_new_ids_sort_in_the_order_they_were_made() -> None:
    made = [new_id() for _ in range(1000)]

    assert made == sorted(made)
    assert len(set(made)) == len(made)


def our_models() -> list[type[models.Model]]:
    return [model for module in MODULES for model in apps.get_app_config(module).get_models()]


def test_every_model_s_id_is_a_uuid_defaulting_to_new_id() -> None:
    wrong = [
        model._meta.label
        for model in our_models()
        if not (
            isinstance(model._meta.pk, models.UUIDField)
            and model._meta.pk.name == "id"
            and model._meta.pk.default is new_id
            and model._meta.pk.db_default is models.NOT_PROVIDED
        )
    ]

    assert our_models(), "no model was checked"
    assert wrong == []
