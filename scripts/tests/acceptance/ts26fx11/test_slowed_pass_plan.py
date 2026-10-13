"""verify plans CI's slowed-fake web pass beside the plain one (S26-FX11; the orchestrator's ruling,
13 Oct 2026: "whenever verify plans web-test (any web change), it also plans a second web-test Check
identical to it but with VITE_FAKE_API_LATENCY_MS read from web.yml's slowed step (60), named so its
failure is clear").

The seam: `scripts.verify.plan(paths, root=...)`, the planned Checks' argv and env; no vitest runs. The
slowed pass is the planned Check whose env carries `VITE_FAKE_API_LATENCY_MS`; its name is the
builder's, only distinct from the plain pass's.
"""

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts26fx11.webyml import KEY, ci_latency
from scripts.verify import Check, plan

WEB_TEST = ("npm", "--prefix", "web", "test")
NOT_PLANNED = "no slowed web pass planned (no Check with VITE_FAKE_API_LATENCY_MS in its env)"


def passes(checks: list[Check]) -> tuple[list[Check], list[Check]]:
    """The planned whole-suite vitest runs: (plain, slowed)."""
    runs = [check for check in checks if check.argv == WEB_TEST]
    return [c for c in runs if KEY not in c.env], [c for c in runs if KEY in c.env]


@pytest.mark.parametrize(
    "paths",
    [["web/src/takeoff/storeys.tsx"], ["web/package.json"], ["web/src/a.tsx", "scripts/x.py"]],
)
def test_a_web_change_plans_the_plain_and_the_slowed_web_pass(paths: list[str], tmp_path: Path) -> None:
    plain, slowed = passes(plan(paths, root=tmp_path))
    assert len(plain) == 1, [c.name for c in plain]
    assert len(slowed) == 1, NOT_PLANNED


def test_the_slowed_pass_waits_as_long_as_web_yml_says(tmp_path: Path) -> None:
    _, slowed = passes(plan(["web/src/takeoff/storeys.tsx"], root=tmp_path))
    assert slowed, NOT_PLANNED
    assert slowed[0].env[KEY] == ci_latency()


def test_the_slowed_pass_is_the_plain_pass_with_only_the_latency_added(tmp_path: Path) -> None:
    plain, slowed = passes(plan(["web/src/takeoff/storeys.tsx"], root=tmp_path))
    assert slowed, NOT_PLANNED
    assert slowed[0].argv == plain[0].argv
    assert slowed[0].env == {**plain[0].env, KEY: ci_latency()}


def test_the_plain_pass_stays_unslowed(tmp_path: Path) -> None:
    checks = plan(["web/src/takeoff/storeys.tsx"], root=tmp_path)
    assert passes(checks)[1], NOT_PLANNED
    [plain] = [c for c in checks if c.name == "web-test"]
    assert KEY not in plain.env


def test_the_slowed_pass_has_its_own_name(tmp_path: Path) -> None:
    checks = plan(["web/src/takeoff/storeys.tsx"], root=tmp_path)
    _, slowed = passes(checks)
    assert slowed, NOT_PLANNED
    assert slowed[0].name != "web-test"
    assert [c.name for c in checks].count(slowed[0].name) == 1


def test_the_slowed_pass_runs_after_the_plain_one(tmp_path: Path) -> None:
    checks = plan(["web/src/takeoff/storeys.tsx"], root=tmp_path)
    plain, slowed = passes(checks)
    assert slowed, NOT_PLANNED
    assert checks.index(plain[0]) < checks.index(slowed[0])


@pytest.mark.parametrize(
    "paths",
    [
        ["docs/plans/m1.md"],
        ["vextrus/takeoff/models.py"],
        ["scripts/verify.py"],
        ["vextrus/takeoff/tests/acceptance/t1/test_a.py"],
    ],
)
def test_a_change_outside_web_plans_neither_web_pass(paths: list[str], tmp_path: Path) -> None:
    checks = plan(paths, root=tmp_path)
    assert passes(checks) == ([], [])
    assert not any(KEY in c.env for c in checks)
