"""Run only by `test_seed_template.py` in an inner pytest session (no `test_` prefix). The session's
first module to ask for the demo seed, through ticket 136's fixture (`demo`, the module's one seed)."""

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures, found by name)


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_first_module_has_the_demo(demo: Demo) -> None:
    assert "project:KR-01" in demo
