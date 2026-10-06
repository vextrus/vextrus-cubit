"""S14-R2 fix round 2 (PR #486 at 37b5ae2): the hand-off names every lens its tier requires, claims are
matched by id, no lens config steers a replay, and attack files are kept byte for byte."""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import review, review_cloud
from scripts.factory.tests.test_review_r2_fix1 import A_NONCE, PR, Cloud, git, repo

H = "a" * 40


# ---------------------------------------------------------------- 1. every required lens, with its state


class Launcher:
    """review_cloud.run in place: each lens's launch succeeds unless its model is in `failing`."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.failing: set[str] = set()
        self.launched: list[str] = []
        monkeypatch.setattr(review_cloud, "run", self.run)
        monkeypatch.setattr(subprocess, "run", lambda *_, **__: subprocess.CompletedProcess([], 0))

    def run(self, argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        model = argv[argv.index("--model") + 1]
        if model in self.failing:
            return 3
        n = len(self.launched)
        self.launched.append(model)
        branch, review_file = f"review/{PR}-{n:08d}", str(records_dir / f"review-{n}.json")
        return int(launch(["uv", "--branch", branch, "--review-file", review_file], ""))


def handed(tmp_path: Path) -> tuple[review.Run, Path]:
    records = tmp_path / "cloud"
    records.mkdir(exist_ok=True)
    return review.Run(pr=PR, round_=1, head=H, tier="normal"), records


def manifest(records: Path) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads(review.handoff_path(records, PR, H, 1).read_text())
    return loaded


def states(records: Path) -> dict[str, str]:
    return {entry["label"]: entry["state"] for entry in manifest(records)["lenses"]}


def test_a_failed_launch_still_names_every_required_lens(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: the hand-off named only the launched lens, so collect recorded lens A alone."""
    launcher = Launcher(monkeypatch)
    launcher.failing = {review.LENS_B.model}
    run, records = handed(tmp_path)
    with pytest.raises(review.Refused, match="lens-b"):
        review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    assert manifest(records)["required"] == ["lens-a", "lens-b"]
    assert states(records) == {"lens-a": "launched", "lens-b": "failed"}


def answered(monkeypatch: pytest.MonkeyPatch, branches: set[str]) -> None:
    """The ledger's reader in place: a launch's verdict is accepted when its branch is in `branches`."""

    def read_handed(main: Path, run: review.Run, lens: Any) -> tuple[str, dict[str, Any], str]:
        if lens["branch"] not in branches:
            raise review.Refused("no verdict file on the review branch")
        return lens["label"], {"verdict": "PASS", "findings": []}, lens["branch"]

    monkeypatch.setattr(review, "read_handed", read_handed)


def test_a_rerun_launches_only_the_lens_with_no_accepted_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    launcher = Launcher(monkeypatch)
    launcher.failing = {review.LENS_B.model}
    run, records = handed(tmp_path)
    with pytest.raises(review.Refused):
        review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    first = {entry["label"]: entry for entry in manifest(records)["lenses"]}
    answered(monkeypatch, {first["lens-a"]["launches"][0]["branch"]})
    launcher.failing = set()
    run, _ = handed(tmp_path)
    review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    assert launcher.launched == [review.LENS_A.model, review.LENS_B.model]
    assert states(records) == {"lens-a": "answered", "lens-b": "launched"}
    now = {entry["label"]: entry for entry in manifest(records)["lenses"]}
    assert now["lens-a"]["launches"] == first["lens-a"]["launches"], "lens A was dropped or redone"
    assert (now["lens-a"]["count"], now["lens-b"]["count"]) == (1, 2)


def test_a_rerun_whose_launches_fail_never_drops_a_launch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    launcher = Launcher(monkeypatch)
    run, records = handed(tmp_path)
    review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    good = {entry["label"]: entry["launches"] for entry in manifest(records)["lenses"]}
    launcher.failing = {review.LENS_A.model, review.LENS_B.model}
    run, _ = handed(tmp_path)
    with pytest.raises(review.Refused):
        review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    now = {entry["label"]: entry for entry in manifest(records)["lenses"]}
    assert {label: entry["launches"] for label, entry in now.items()} == good
    assert [now[label]["count"] for label in ("lens-a", "lens-b")] == [2, 2]
    assert states(records) == {"lens-a": "failed", "lens-b": "failed"}


@pytest.fixture
def cloud(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Cloud:
    made = Cloud(tmp_path)
    monkeypatch.setattr(review, "resolve", lambda pr: made.head)
    monkeypatch.setattr(review, "ledger_call", lambda *_: pytest.fail("something was recorded"))
    return made


def collect(cloud: Cloud) -> None:
    args = review.parse(["collect", str(PR), "--round", "1"])
    review.collect(review.Run(pr=PR, round_=1), args, cloud.main)


def test_collect_refuses_while_a_required_lens_never_launched(cloud: Cloud) -> None:
    cloud.hand_off("lens-a", A_NONCE)
    cloud.answer(A_NONCE, "PASS", [])
    path = review.handoff_path(cloud.records, PR, cloud.head, 1)
    written = json.loads(path.read_text())
    written["lenses"].append({"label": "lens-b", "state": "failed"})
    path.write_text(json.dumps(written))
    with pytest.raises(review.Refused, match="lens-b: never launched"):
        collect(cloud)


def test_collect_refuses_a_hand_off_that_leaves_out_a_lens_its_tier_requires(cloud: Cloud) -> None:
    cloud.hand_off("lens-a", A_NONCE)
    cloud.answer(A_NONCE, "PASS", [])
    path = review.handoff_path(cloud.records, PR, cloud.head, 1)
    written = json.loads(path.read_text())
    written["required"] = ["lens-a"]
    path.write_text(json.dumps(written))
    with pytest.raises(review.Refused, match="leaves out a lens"):
        collect(cloud)


# ---------------------------------------------------------------- 2. claims matched by id


def two_on_one_line() -> review.Run:
    run = review.Run(pr=PR, round_=1, head=H, merged=H, slot=1)
    run.findings = [
        review.Finding("l1-f1", 60, "a.py", 2, "`rate` drops its unit", None, "UNPROVEN"),
        review.Finding("l2-f1", 55, "a.py", 2, "`rate` is never rounded", None, "UNPROVEN"),
    ]
    return run


def judged(claim: review.Finding, verdict: str, *, with_id: bool) -> dict[str, Any]:
    item = {"file": claim.file, "line": claim.line, "score": claim.score,
            "summary": review.as_sent(claim.summary), "verdict": verdict, "evidence": "e"}  # fmt: skip
    return {"claim": claim.id, **item} if with_id else item


@pytest.mark.parametrize("with_id", [True, False], ids=["by-claim-id", "by-summary-as-sent"])
def test_two_claims_on_one_line_each_keep_the_refuters_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, with_id: bool
) -> None:
    """Refuted: the brief sent the summary with ' for `, the matching compared the original."""
    run = two_on_one_line()
    first, second = run.findings
    prompts: list[str] = []

    def run_lens(lens: review.Lens, prompt: str, *_: Any, **__: Any) -> dict[str, Any]:
        prompts.append(prompt)
        reply = [judged(first, "REFUTED", with_id=with_id), judged(second, "CONFIRMED", with_id=with_id)]
        return {"structured_output": {"findings": reply}}

    monkeypatch.setattr(review, "run_lens", run_lens)
    review.refute(run, tmp_path, tmp_path, tmp_path)
    assert [item.word for item in run.findings] == ["REFUTED", "CONFIRMED"]
    assert '"claim": "l1-f1"' in prompts[0]
    assert '"claim": "l2-f1"' in prompts[0]


# ---------------------------------------------------------------- 3. no lens config steers a replay


def test_every_pytest_config_and_a_stray_conftest_go_and_the_replay_names_its_own_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: review_attacks/<lens>/pytest.toml survived and its addopts (--collect-only) turned a
    FAILED into exit 0."""
    rv = repo(tmp_path / "rv1")
    (rv / "pyproject.toml").write_text("[tool.pytest.ini_options]\naddopts = []\n")
    git(rv, "add", "pyproject.toml")
    git(rv, "commit", "-q", "-m", "config")
    head = git(rv, "rev-parse", "HEAD")
    own = rv / "review_attacks" / "lens-b"
    own.mkdir(parents=True)
    repro = "review_attacks/lens-b/test_rate_fails.py"
    (rv / repro).write_text("def test_attack(): assert False\n")
    for name in ("pytest.toml", ".pytest.toml", "pytest.ini", "tox.ini", "setup.cfg", "pyproject.toml"):
        (own / name).write_text('[pytest]\naddopts = ["--collect-only"]\n')
    (own / "conftest.py").write_text("HELPER = 1\n")
    (rv / "review_attacks" / "conftest.py").write_text("def pytest_collection_modifyitems(items): ...\n")
    seen: list[list[str]] = []

    def run_group(argv: Any, **_: Any) -> subprocess.CompletedProcess[str]:
        seen.append(list(argv))
        left = sorted(p.relative_to(rv).as_posix() for p in (rv / "review_attacks").rglob("*"))
        seen.append(left)
        out = f"FAILED {repro}::test_attack - assert False\n1 failed\n"
        return subprocess.CompletedProcess(list(argv), 1, out, "")

    monkeypatch.setattr(review, "run_group", run_group)
    run = review.Run(pr=PR, round_=1, head=head, merged=head, slot=1)
    run.findings = [review.Finding("l1-f1", 70, "a.py", 1, "s", repro)]
    review.confirm(run, rv)
    argv, left = seen
    assert left == [
        "review_attacks/lens-b",
        "review_attacks/lens-b/conftest.py",
        "review_attacks/lens-b/test_rate_fails.py",
    ]
    assert argv[argv.index("-c") + 1] == "pyproject.toml"
    assert argv[argv.index("--rootdir") + 1] == "."
    assert run.findings[0].word == "CONFIRMED"


def test_a_worktree_with_no_config_replays_with_none(tmp_path: Path) -> None:
    assert review.repo_config(tmp_path)[:2] == ["-c", "/dev/null"]


# ---------------------------------------------------------------- 4. attack files byte for byte


SAMPLE = b"0\r\nSECTION\r\n2\rHEADER\n\x00\x89PNG\r\n\x1a\n\xff\xfe"


def test_a_reused_lens_restores_its_attack_files_byte_for_byte(tmp_path: Path) -> None:
    """Refuted: read_text turned CRLF and a lone CR into LF, so a CRLF DXF or a PNG changed."""
    rv = repo(tmp_path / "rv1")
    out = tmp_path / "out"
    out.mkdir()
    folder = rv / "review_attacks" / "lens-b"
    folder.mkdir(parents=True)
    (folder / "plan.dxf").write_bytes(SAMPLE)
    (folder / "test_plan.py").write_bytes(b"def test_plan():\r\n    pass\r\n")
    run = review.Run(pr=PR, round_=1, head=H, merged=H, base="c" * 40, slot=1)
    answer = {"verdict": "PASS", "head": H, "findings": [], "report": "r"}
    review.save_finished(out, run, review.LENS_B, answer, rv)
    for path in folder.iterdir():
        path.unlink()
    saved = review.load_finished(out, run, review.LENS_B)
    assert saved is not None
    review.restore_attacks(rv, saved["attacks"])
    assert (folder / "plan.dxf").read_bytes() == SAMPLE
    assert (folder / "test_plan.py").read_bytes() == b"def test_plan():\r\n    pass\r\n"
