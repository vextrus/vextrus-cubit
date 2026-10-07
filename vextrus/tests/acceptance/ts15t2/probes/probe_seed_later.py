"""Run only by `test_seed_template.py` in an inner pytest session (no `test_` prefix). A later module
asking for the demo seed, through ticket 19a's fixture (`demo`, the module's one seed): two tests."""

import pytest

from vextrus.seed.demo import Demo
from vextrus.takeoff.tests.acceptance.t19a.step1 import *  # noqa: F403 (its fixtures, found by name)


@pytest.mark.django_db(databases=["default", "owner"])
def test_a_later_module_has_the_demo(demo: Demo) -> None:
    assert "project:KR-01" in demo


@pytest.mark.django_db(databases=["default", "owner"])
def test_its_second_test_has_the_demo_too(demo: Demo) -> None:
    assert "project:MG-01" in demo
