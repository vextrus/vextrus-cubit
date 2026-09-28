from django.apps import AppConfig


class SeedConfig(AppConfig):
    """Holds only the `seed_demo` command; it has no tables."""

    name = "vextrus.seed"
    label = "seed"
