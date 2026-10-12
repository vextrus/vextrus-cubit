from typing import Any

from django.apps import AppConfig
from django.db.models.signals import post_save


class RatesConfig(AppConfig):
    name = "vextrus.rates"
    label = "rates"
    verbose_name = "Rates"

    def ready(self) -> None:
        # A Developer is made with its own Market Price set (a copy of its Market's starter), so its
        # prices are there before anything reads or edits them. The sender is named by label: `platform`
        # keeps its models private.
        post_save.connect(
            give_starter_prices,
            sender="platform.Developer",
            dispatch_uid="rates_give_starter_prices",
        )


def give_starter_prices(sender: Any, instance: Any, created: bool, **kwargs: Any) -> None:
    """When a Developer is made (acting as itself, as `create_developer` does), copy the starter set."""
    from vextrus.platform.services import tenancy
    from vextrus.rates.services import copy_starter

    if created and not instance.is_library and tenancy.current_tenant_id() == instance.id:
        copy_starter()
