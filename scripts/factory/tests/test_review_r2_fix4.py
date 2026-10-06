"""S14-R2, PR #496 fix round 1 (b9f8902): the refuter judges the merged head, never a tree the lenses
edited; the hand-off file is written before and after each launch, so a stop or a timeout part-way
keeps every launch already made."""

import json
import stat
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review, review_cloud
from scripts.factory.tests.test_review_r2_fix1 import PR, Cloud, git, repo

# ---------------------------------------------------------------- 1. the refuter's tree


def test_the_refuter_judges_the_merged_head_not_the_lenses_edits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: with no repro there was no reset, so the refuter judged a tracked file a lens had
    edited and a root conftest.py it had left."""
    rv = repo(tmp_path / "rv1")
    head = git(rv, "rev-parse", "HEAD")
    (rv / "a.py").write_text("A = 2  # edited by a lens\n")
    (rv / "conftest.py").write_text("def pytest_collection_modifyitems(items): items.clear()\n")
    attacks = rv / "review_attacks" / "lens-b"
    attacks.mkdir(parents=True)
    (attacks / "test_rate.py").write_text("def test_rate(): assert False\n")
    (attacks / "helper.py").write_text("RATE = 1\n")
    for name in ("conftest.py", "pytest.ini", "pytest.toml", "pyproject.toml"):
        (attacks / name).write_text("[pytest]\n")
    seen: list[dict[str, Any]] = []

    def run_lens(lens: review.Lens, prompt: str, *_: Any, **__: Any) -> dict[str, Any]:
        left = sorted(
            p.relative_to(rv).as_posix()
            for p in rv.rglob("*")
            if ".git" not in p.parts and ".private" not in p.parts
        )
        seen.append({"a.py": (rv / "a.py").read_text(), "files": left})
        return {"structured_output": {"findings": []}}

    monkeypatch.setattr(review, "run_lens", run_lens)
    run = review.Run(pr=PR, round_=1, head=head, merged=head, slot=1)
    run.findings = [review.Finding("l1-f1", 60, "a.py", 1, "the rate is wrong", None, "UNPROVEN")]
    review.refute(run, rv, tmp_path / "slot1", tmp_path)
    (tree,) = seen
    assert tree["a.py"] == "A = 1\n", "the refuter judged the lens's edit"
    assert tree["files"] == [
        "a.py",
        "review_attacks",
        "review_attacks/lens-b",
        "review_attacks/lens-b/helper.py",
        "review_attacks/lens-b/test_rate.py",
    ]


# ---------------------------------------------------------------- 2. the hand-off, written as it goes


NONCES = ["5" * 32, "6" * 32, "7" * 32]


class Launcher:
    """review_cloud.run in place: lens B's launch is interrupted by `interrupt` (a Stopped, or a
    TimeoutExpired from its push) once; every other launch makes a real review file and runs `true`."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch, head: str, interrupt: str) -> None:
        self.head, self.interrupt = head, interrupt
        self.launched: list[str] = []
        monkeypatch.setattr(review_cloud, "run", self.run)
        real = review._run

        def git_run(argv: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
            if argv[:2] == ["git", "push"] and self.interrupt == "timeout":
                raise subprocess.TimeoutExpired(argv, review.GIT_TIMEOUT)
            return real(argv, **kwargs)

        monkeypatch.setattr(review, "_run", git_run)

    def run(self, argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        model = argv[argv.index("--model") + 1]
        nonce = NONCES[len(self.launched)]
        if model == review.LENS_B.model and self.interrupt:
            if self.interrupt == "stopped":
                self.interrupt = ""
                raise review.Stopped(15)
            push(["git", "push", "origin", f"{self.head}:refs/heads/review/{PR}-{nonce[:8]}"])
        self.launched.append(model)
        review_file = records_dir / f"review-{PR}-{nonce[:8]}.json"
        review_file.write_text(json.dumps({"pr": PR, "head_sha": self.head, "nonce": nonce}))
        branch = f"review/{PR}-{nonce[:8]}"
        return int(launch(["true", "--branch", branch, "--review-file", str(review_file)], ""))


def hand_off(cloud: Cloud) -> None:
    run = review.Run(pr=PR, round_=1, head=cloud.head, tier="normal")
    review.hand_off(run, [review.LENS_A, review.LENS_B], cloud.main, cloud.records)


def entries(cloud: Cloud) -> dict[str, dict[str, Any]]:
    loaded = json.loads(review.handoff_path(cloud.records, PR, cloud.head, 1).read_text())
    return {entry["label"]: entry for entry in loaded["lenses"]}


@pytest.mark.parametrize(
    ("interrupt", "raised"),
    [("stopped", review.Stopped), ("timeout", subprocess.TimeoutExpired)],
    ids=["stopped-between-launches", "lens-b-push-timed-out"],
)
def test_an_interrupted_hand_off_keeps_lens_a_and_a_rerun_launches_only_lens_b(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, interrupt: str, raised: type[BaseException]
) -> None:
    """Refuted: the hand-off file was written only after the last launch, so a stop or a push timeout
    on lens B dropped lens A's launch (and with it the guard on `ledger fetch-verdict`)."""
    cloud = Cloud(tmp_path)
    launcher = Launcher(monkeypatch, cloud.head, interrupt)
    with pytest.raises(raised):
        hand_off(cloud)
    first = entries(cloud)
    assert len(first["lens-a"]["launches"]) == 1, "lens A's launch was dropped"
    assert first["lens-b"]["launches"] == []
    assert first["lens-b"]["state"] == "failed"
    launcher.interrupt = ""
    hand_off(cloud)
    assert launcher.launched == [review.LENS_A.model, review.LENS_B.model]
    now = entries(cloud)
    assert now["lens-a"]["launches"] == first["lens-a"]["launches"]
    assert len(now["lens-b"]["launches"]) == 1


def test_fetch_verdict_refuses_lens_a_alone_after_an_interrupted_hand_off(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cloud = Cloud(tmp_path)
    Launcher(monkeypatch, cloud.head, "stopped")
    with pytest.raises(review.Stopped):
        hand_off(cloud)
    (launched,) = entries(cloud)["lens-a"]["launches"]
    nonce = json.loads(Path(launched["review_file"]).read_text())["nonce"]
    record = tmp_path / "launch.json"
    record.write_text(json.dumps({"role": "reviewer", "review": {"pr": PR, "head_sha": cloud.head,
                                  "nonce": nonce, "branch": launched["branch"]}}))  # fmt: skip
    with pytest.raises(ledger.Refused, match="collect"):
        ledger.fetch_verdict(
            PR,
            record,
            1,
            scan=lambda text: 0,
            post=lambda pr, body: 7001,
            ledger_dir=cloud.ledger_dir,
            head_of=lambda pr: cloud.head,
        )


def test_the_hand_off_file_is_private_and_written_whole(tmp_path: Path) -> None:
    path = tmp_path / "cloud" / f"{PR}-{'a' * 40}-r1.handoff.json"
    review.write_handoff(path, {"pr": PR, "lenses": []})
    review.write_handoff(path, {"pr": PR, "lenses": [{"label": "lens-a"}]})
    assert json.loads(path.read_text())["lenses"] == [{"label": "lens-a"}]
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert [p.name for p in path.parent.iterdir()] == [path.name], "a temporary file was left"


def test_relaunch_is_for_the_cloud_only(tmp_path: Path) -> None:
    args = review.parse(["run", str(PR), "--round", "1", "--relaunch", "lens-a"])
    with pytest.raises(review.BadInput, match="--where cloud"):
        review.review(review.Run(pr=PR, round_=1), args, tmp_path)
