"""S14-L6 (issue #456): `python -m scripts.land order <PR> ...` prints the order the lander would merge
them in, each PR with the 40-hex head it has to keep, and merges nothing: engine PRs with a ledger PASS
first, then the rest, by number; a PR with no PASS is left out; PRs whose files overlap keep their
number order.

Seams (assumed): `scripts.land.main(["order", "<PR>", ...]) -> int` is the command; the order is read
from stdout by where each PR's full head appears (a line may carry one PR or several); a left-out PR's
head, if printed at all, is on a line saying "left out" (the lander's words today). Engine PRs are those
whose files match `.github/engine-paths.txt` in the checkout; the ledger is
`scripts.ledger.default_ledger_dir()` of the checkout. GitHub is the fake gh 2.45 of `_fake.py`.
"""

from dataclasses import dataclass
from pathlib import Path

import pytest

from scripts import land
from scripts.tests.acceptance.ts14l6._fake import Fake, World, install, passed

Fixtures = tuple[Path, pytest.MonkeyPatch, pytest.CaptureFixture[str]]


@dataclass
class Ordered:
    code: int
    out: str
    err: str
    fake: Fake
    heads: dict[int, str]

    def order(self) -> list[int]:
        """The PRs in the order their heads are first printed, left-out lines aside."""
        seen: list[tuple[int, int, int]] = []
        for row, line in enumerate(self.out.splitlines()):
            if "left out" in line:
                continue
            for number, head in self.heads.items():
                if head in line and number not in [n for _, _, n in seen]:
                    seen.append((row, line.index(head), number))
        return [number for _, _, number in sorted(seen)]


def ordering(
    env: Fixtures,
    prs: dict[int, list[str]],
    *,
    without_pass: frozenset[int] = frozenset(),
    args: list[int],
) -> Ordered:
    tmp_path, monkeypatch, capfd = env
    world = World(tmp_path)
    for number, files in prs.items():
        world.pr(number, files)
        if number not in without_pass:
            passed(world.ledger(), number, world.heads[number])
    fake = install(
        tmp_path,
        monkeypatch,
        {number: {"head": world.heads[number], "files": files} for number, files in prs.items()},
    )
    monkeypatch.chdir(world.work)
    capfd.readouterr()
    code = land.main(["order", *(str(number) for number in args)])
    out, err = capfd.readouterr()
    return Ordered(code, out, err, fake, dict(world.heads))


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]) -> Fixtures:
    return tmp_path, monkeypatch, capfd


APART = {
    21: ["docs/a.md"],
    22: ["engine/x.py"],
    24: ["scripts/b.py"],
    26: ["engine/w.py"],
}


def test_order_prints_engine_prs_with_a_pass_first_then_the_rest_by_number(env: Fixtures) -> None:
    done = ordering(env, APART, args=[24, 21, 26, 22])
    assert done.code == 0, done.out + done.err
    assert done.order() == [22, 26, 21, 24], done.out


def test_order_prints_each_pr_with_the_full_head_it_has_to_keep(env: Fixtures) -> None:
    done = ordering(env, APART, args=[24, 21, 26, 22])
    assert done.code == 0, done.out + done.err
    for number, head in done.heads.items():
        assert any(head in line for line in done.out.splitlines()), f"PR {number}'s head {head}"


def test_order_leaves_out_a_pr_with_no_ledger_pass(env: Fixtures) -> None:
    prs = APART | {23: ["engine/y.py"]}
    done = ordering(env, prs, without_pass=frozenset({23}), args=[21, 22, 23, 24, 26])
    assert done.order() == [22, 26, 21, 24], done.out


def test_prs_whose_files_overlap_keep_their_number_order(env: Fixtures) -> None:
    """32 is an engine PR, but it changes a file 31 changes too: 31 lands first."""
    prs = {
        31: ["scripts/c.py"],
        32: ["engine/q.py", "scripts/c.py"],
        33: ["engine/r.py"],
        34: ["docs/d.md"],
    }
    done = ordering(env, prs, args=[34, 33, 32, 31])
    assert done.code == 0, done.out + done.err
    order = done.order()
    assert sorted(order) == [31, 32, 33, 34], done.out
    assert order.index(31) < order.index(32), "overlapping PRs out of number order"
    assert order.index(33) < order.index(34), "an engine PR with a PASS after a docs PR"


def test_order_merges_nothing_and_changes_nothing_on_github(env: Fixtures) -> None:
    done = ordering(env, APART, args=[24, 21, 26, 22])
    assert done.code == 0, done.out + done.err
    assert done.order() == [22, 26, 21, 24], done.out
    assert done.fake.writes() == []
