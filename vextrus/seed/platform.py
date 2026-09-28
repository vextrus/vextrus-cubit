"""The demo seed's `platform` rows: the two Developers on the Bangladesh Market (02), and the
people of docs/design/m0-screens.md §7, the Guest among them (07)."""

from vextrus.platform.services import markets, tenancy
from vextrus.seed.demo import Demo

DEVELOPERS = {
    "developer:shapla": "Shapla Homes Ltd",
    "developer:meghna": "Meghna Properties Ltd",
}


def run(demo: Demo) -> None:
    market = markets.by_code("BD")
    demo["market"] = market
    for name, title in DEVELOPERS.items():
        with tenancy.acting_in(None):
            demo[name] = tenancy.create_developer(title, market.id)
