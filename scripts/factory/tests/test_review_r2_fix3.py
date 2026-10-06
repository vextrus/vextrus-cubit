"""S14-R2, #486 round 3 (46ed5e0): a lens whose cloud session died is launched again by a rerun of the
round, and collect records once every required lens has an accepted verdict (its newest)."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review, review_cloud
from scripts.factory.tests.test_review_r2_fix1 import FIX, PR, Cloud

NONCES = ["1" * 32, "2" * 32, "3" * 32, "4" * 32]


class Launcher:
    """review_cloud.run in place: each launch makes a real review file with the next nonce; the
    launch command itself is `true` (nothing is launched)."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch, head: str) -> None:
        self.head = head
        self.launched: list[tuple[str, str]] = []  # (model, nonce)
        monkeypatch.setattr(review_cloud, "run", self.run)

    def run(self, argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        nonce = NONCES[len(self.launched)]
        self.launched.append((argv[argv.index("--model") + 1], nonce))
        review_file = records_dir / f"review-{PR}-{nonce[:8]}.json"
        review_file.write_text(json.dumps({"pr": PR, "head_sha": self.head, "nonce": nonce}))
        branch = f"review/{PR}-{nonce[:8]}"
        return int(launch(["true", "--branch", branch, "--review-file", str(review_file)], ""))

    def nonce_of(self, model: str) -> str:
        return [nonce for launched, nonce in self.launched if launched == model][-1]


@pytest.fixture
def cloud(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Cloud:
    made = Cloud(tmp_path)
    monkeypatch.setattr(review, "resolve", lambda pr: made.head)
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)

    def ledger_call(argv: list[str], ledger_dir: Path) -> int:
        return ledger.main(argv, scan=lambda text: 0, post=lambda pr, body: 7001, ledger_dir=ledger_dir)

    monkeypatch.setattr(review, "ledger_call", ledger_call)
    return made


def hand_off(cloud: Cloud) -> None:
    run = review.Run(pr=PR, round_=1, head=cloud.head, tier="normal")
    review.hand_off(run, [review.LENS_A, review.LENS_B], cloud.main, cloud.records)


def collect(cloud: Cloud) -> None:
    args = review.parse(["collect", str(PR), "--round", "1"])
    review.collect(review.Run(pr=PR, round_=1), args, cloud.main)


def entries(cloud: Cloud) -> dict[str, dict[str, Any]]:
    loaded = json.loads(review.handoff_path(cloud.records, PR, cloud.head, 1).read_text())
    return {entry["label"]: entry for entry in loaded["lenses"]}


def test_a_lens_whose_session_died_is_launched_again_and_collect_records_once_both_answered(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: a rerun reused every lens marked launched, so a dead lens A was never launched again
    and collect refused 'lens-a: no verdict' for ever."""
    launcher = Launcher(monkeypatch, cloud.head)
    hand_off(cloud)
    assert [model for model, _ in launcher.launched] == [review.LENS_A.model, review.LENS_B.model]
    cloud.answer(launcher.nonce_of(review.LENS_B.model), "FIX", [FIX])  # lens A's session died
    with pytest.raises(review.Refused, match="lens-a: no accepted verdict"):
        collect(cloud)
    hand_off(cloud)  # the rerun: lens A only
    assert [model for model, _ in launcher.launched] == [
        review.LENS_A.model,
        review.LENS_B.model,
        review.LENS_A.model,
    ]
    now = entries(cloud)
    assert (now["lens-a"]["count"], len(now["lens-a"]["launches"])) == (2, 2)
    assert (now["lens-b"]["count"], now["lens-b"]["state"]) == (1, "answered")
    cloud.answer(launcher.nonce_of(review.LENS_A.model), "PASS", [])
    collect(cloud)
    (recorded,) = list(cloud.ledger_dir.iterdir())
    record = json.loads(recorded.read_text())
    assert (record["verdict"], record["counts"]["reviewers"]) == ("FIX", 2)


def test_collect_takes_each_lens_s_newest_accepted_verdict(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Lens A answered twice (its first session was thought dead and launched again): the newest
    accepted verdict counts, never the older one."""
    launcher = Launcher(monkeypatch, cloud.head)
    hand_off(cloud)
    first_a = launcher.nonce_of(review.LENS_A.model)
    cloud.answer(launcher.nonce_of(review.LENS_B.model), "PASS", [])
    hand_off(cloud)  # lens A has no verdict yet: launched again
    cloud.answer(first_a, "PASS", [])
    cloud.answer(launcher.nonce_of(review.LENS_A.model), "BLOCK", [FIX])
    collect(cloud)
    (recorded,) = list(cloud.ledger_dir.iterdir())
    assert json.loads(recorded.read_text())["verdict"] == "BLOCK"
