"""The demo seed's platform part: the two Developers on the Bangladesh Market (m0-screens §7)."""

from typing import Any

import pytest

from vextrus.platform.services import markets, tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo


@pytest.mark.django_db
def test_the_seed_makes_the_two_developers_on_the_market(staff: Any) -> None:
    demo: Demo = {}

    seed_platform.run(demo)

    with tenancy.acting_in(None, user_id=staff.pk):
        named = {choice.id: choice.name for choice in tenancy.staff_developers()}
    assert named == {
        demo["developer:shapla"]: "Shapla Homes Ltd",
        demo["developer:meghna"]: "Meghna Properties Ltd",
    }
    for name in ("developer:shapla", "developer:meghna"):
        with tenancy.acting_in(demo[name]):
            assert markets.of_developer(demo[name]) == demo["market"]
    assert tenancy.current_tenant_id() is None
