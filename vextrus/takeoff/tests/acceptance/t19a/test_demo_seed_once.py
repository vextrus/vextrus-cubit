"""The demo seed is made once per test module, not once per test (#237, CI's fix F1: the function-scoped
`demo` ran `seed_demo()`, now the real read job over KR-01's four recorded DWGs, in every test that asked
for it, and CI's python job ran out of time). Each test reads the module's one seed, made before the test
began, and makes none of its own; under pytest-xdist a module's tests may run in several workers, and
each worker makes its own one seed for the module.

A seed is counted where `seed_demo` runs it: each run of its first layer (`vextrus.seed.platform.run`).
"""

from collections.abc import Callable, Iterator
from dataclasses import dataclass

import pytest

from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api

from .step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .step1 import step1


@dataclass
class Seeds:
    made: int = 0


@pytest.fixture(scope="module", autouse=True)
def seeds() -> Iterator[Seeds]:
    """Every seed made while this module runs (set up before any other fixture of the module)."""
    counted = Seeds()
    run = seed_platform.run

    def counting(demo: Demo) -> None:
        counted.made += 1
        run(demo)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(seed_platform, "run", counting)
        yield counted


@pytest.fixture(autouse=True)
def made_before_the_test(seeds: Seeds) -> int:
    """The seeds made before this test's own fixtures (`demo` among them) were set up."""
    return seeds.made


@pytest.mark.django_db(databases=["default", "owner"])
@pytest.mark.parametrize(
    ("email", "developer", "project"),
    [("nusrat@shapla-homes.example", "shapla", "KR-01"), ("tanvir@meghna.example", "meghna", "MG-01")],
)
def test_each_test_reads_the_modules_one_seed_made_before_it_began(
    demo: Demo,
    as_person: Callable[[str, str], Api],
    seeds: Seeds,
    made_before_the_test: int,
    email: str,
    developer: str,
    project: str,
) -> None:
    response = as_person(email, developer).get(f"{step1(demo[f'project:{project}'])}/progress")

    assert response.status_code == 200, response.content
    assert (made_before_the_test, seeds.made) == (1, 1)
