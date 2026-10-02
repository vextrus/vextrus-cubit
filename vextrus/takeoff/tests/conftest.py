"""Every `takeoff` test reads with TypeSafe down unless it says otherwise (ticket 21c: the read job
asks Jev each sheet's kind). A test that wants Jev's answers gives them by its own fixture (a stand-in
`jev_offline.use(...)`, or `jev_down(way)`), which runs after this one and replaces it."""

from collections.abc import Callable

import pytest


@pytest.fixture(autouse=True)
def typesafe_down_unless_given(jev_down: Callable[[str], None]) -> None:
    jev_down("timeout")
