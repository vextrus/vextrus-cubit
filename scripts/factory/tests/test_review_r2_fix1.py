"""S14-R2 fix round 1 (PR #486): every cloud lens's verdict is recorded as ONE decision, and the batched
refuter sees each finding's repro, its replay and the lens's attack files."""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review, review_cloud

PR = 12


def git(where: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(where), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def repo(where: Path) -> Path:
    where.mkdir(parents=True)
    git(where, "init", "-q", "-b", "main")
    for key, value in (("user.email", "t@example.com"), ("user.name", "t"), ("commit.gpgsign", "false")):
        git(where, "config", key, value)
    (where / "a.py").write_text("A = 1\n")
    git(where, "add", "a.py")
    git(where, "commit", "-q", "-m", "base")
    return where


# ---------------------------------------------------------------- 1. one decision from every cloud lens


class Cloud:
    """A main checkout whose origin holds the PR head and each cloud reviewer's verdict branch."""

    def __init__(self, root: Path) -> None:
        self.origin = root / "origin.git"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.origin)], check=True)
        self.main = repo(root / "main")
        git(self.main, "remote", "add", "origin", str(self.origin))
        git(self.main, "push", "-q", "origin", "main")
        self.head = git(self.main, "rev-parse", "HEAD")
        self.records = self.main / ".private" / "work" / "factory" / "review" / "cloud"
        self.records.mkdir(parents=True)
        self.lenses: list[dict[str, str]] = []

    def hand_off(self, label: str, nonce: str) -> None:
        """What `review run --where cloud` leaves for one lens: its review file and the manifest."""
        review_file = self.records / f"review-{PR}-{nonce[:8]}.json"
        review_file.write_text(json.dumps({"pr": PR, "head_sha": self.head, "nonce": nonce}))
        branch = f"review/{PR}-{nonce[:8]}"
        entry = {"label": label, "state": "launched", "branch": branch, "review_file": str(review_file)}
        self.lenses.append(entry)
        required = ["lens-a", "lens-b"]
        manifest = {"pr": PR, "head": self.head, "round": 1, "tier": "normal",
                    "required": required, "lenses": self.lenses}  # fmt: skip
        review.handoff_path(self.records, PR, self.head, 1).write_text(json.dumps(manifest))

    def answer(self, nonce: str, verdict: str, findings: list[dict[str, Any]]) -> None:
        """The cloud reviewer commits its one verdict file on the head and pushes its review branch."""
        git(self.main, "switch", "-q", "--detach", self.head)
        path = self.main / ".review" / f"{PR}-{nonce[:8]}.json"
        path.parent.mkdir(exist_ok=True)
        body = {"pr": PR, "head_sha": self.head, "nonce": nonce, "agent": "pr-reviewer",
                "verdict": verdict, "findings": findings}  # fmt: skip
        path.write_text(json.dumps(body))
        git(self.main, "add", "-f", str(path.relative_to(self.main)))
        git(self.main, "commit", "-q", "-m", "verdict")
        git(self.main, "push", "-q", "origin", f"HEAD:refs/heads/review/{PR}-{nonce[:8]}")
        git(self.main, "switch", "-q", "main")

    @property
    def ledger_dir(self) -> Path:
        return self.main / ".private" / "work" / "factory" / "ledger"


@pytest.fixture
def cloud(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Cloud:
    made = Cloud(tmp_path)
    monkeypatch.setattr(review, "resolve", lambda pr: made.head)
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)  # the ledger records only off the cloud

    def ledger_call(argv: list[str], ledger_dir: Path) -> int:
        return ledger.main(argv, scan=lambda text: 0, post=lambda pr, body: 7001, ledger_dir=ledger_dir)

    monkeypatch.setattr(review, "ledger_call", ledger_call)
    return made


A_NONCE, B_NONCE = "1" * 32, "2" * 32
FIX = {"score": 70, "file": "a.py", "line": 1, "summary": "the rate drops its unit"}


def collect(cloud: Cloud) -> review.Run:
    run = review.Run(pr=PR, round_=1)
    review.collect(run, review.parse(["collect", str(PR), "--round", "1"]), cloud.main)
    return run


def test_a_lens_a_pass_and_a_lens_b_fix_record_one_fix(cloud: Cloud) -> None:
    """Refuted: each cloud verdict was recorded alone and the first fetched (a PASS) hid the FIX."""
    cloud.hand_off("lens-a", A_NONCE)
    cloud.hand_off("lens-b", B_NONCE)
    cloud.answer(A_NONCE, "PASS", [])
    cloud.answer(B_NONCE, "FIX", [FIX])
    run = collect(cloud)
    record = json.loads((cloud.ledger_dir / f"{PR}-{cloud.head}.json").read_text())
    assert (record["verdict"], record["counts"]["reviewers"]) == ("FIX", 2)
    assert run.verdict == "FIX"
    assert review.from_verdict(PR, cloud.main).count("the rate drops its unit") == 1


def test_nothing_is_recorded_until_every_lens_has_answered(cloud: Cloud) -> None:
    cloud.hand_off("lens-a", A_NONCE)
    cloud.hand_off("lens-b", B_NONCE)
    cloud.answer(A_NONCE, "PASS", [])
    with pytest.raises(review.Refused, match="lens-b"):
        collect(cloud)
    assert not cloud.ledger_dir.exists() or list(cloud.ledger_dir.iterdir()) == []


def test_a_handed_off_head_cannot_be_recorded_one_lens_at_a_time(cloud: Cloud, tmp_path: Path) -> None:
    cloud.hand_off("lens-a", A_NONCE)
    cloud.hand_off("lens-b", B_NONCE)
    cloud.answer(A_NONCE, "PASS", [])
    launch = tmp_path / "launch.json"
    branch = f"review/{PR}-{A_NONCE[:8]}"
    launch.write_text(json.dumps({"role": "reviewer", "review": {"pr": PR, "head_sha": cloud.head,
                                  "nonce": A_NONCE, "branch": branch}}))  # fmt: skip
    with pytest.raises(ledger.Refused, match="collect"):
        ledger.fetch_verdict(
            PR,
            launch,
            1,
            scan=lambda text: 0,
            post=lambda pr, body: 7001,
            ledger_dir=cloud.ledger_dir,
            head_of=lambda pr: cloud.head,
        )
    assert not (cloud.ledger_dir / f"{PR}-{cloud.head}.json").exists()


def test_collect_with_no_hand_off_is_refused(cloud: Cloud) -> None:
    with pytest.raises(review.Refused, match="--where cloud"):
        collect(cloud)


# ---------------------------------------------------------------- 2. the refuter sees the proof


REPRO = "review_attacks/lens-b/test_badge_passes.py"
PROOF = {"test_file": REPRO, "command": f"uv run pytest -rf {REPRO}", "expect_fail": True}


def test_the_refuter_is_told_the_repro_and_what_its_replay_showed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: the refuter got only file, line, score and summary, and the clean before replay had
    removed the lens's helper, so it could not see the evidence."""
    rv = repo(tmp_path / "rv1")
    head = git(rv, "rev-parse", "HEAD")
    attacks = rv / "review_attacks" / "lens-b"
    attacks.mkdir(parents=True)
    (attacks / "test_badge_passes.py").write_text("from helper import COUNT\n")
    (attacks / "helper.py").write_text("COUNT = 3\n")
    (attacks / "pytest.ini").write_text("[pytest]\naddopts = /elsewhere/test_out.py\n")
    (rv / "stray.py").write_text("left by the lens\n")
    ran: list[list[str]] = []

    def run_group(argv: Any, **_: Any) -> subprocess.CompletedProcess[str]:
        ran.append(sorted(p.name for p in attacks.iterdir()))
        out = f"ERROR {REPRO} - ModuleNotFoundError: no module named 'helper'\n1 error in 0.02s\n"
        return subprocess.CompletedProcess(list(argv), 2, out, "")

    monkeypatch.setattr(review, "run_group", run_group)
    run = review.Run(pr=PR, round_=1, head=head, merged=head, slot=1)
    run.findings = [review.Finding("l1-f1", 70, "a.py", 1, "the badge count is wrong", REPRO,
                                   proof=PROOF)]  # fmt: skip
    review.confirm(run, rv)
    assert ran == [["helper.py", "test_badge_passes.py"]], "the helper was cleaned, or pytest.ini kept"
    assert not (rv / "stray.py").exists()
    (found,) = run.findings
    assert found.word == "UNPROVEN"
    assert found.replayed is not None
    assert found.replayed["exit"] == 2

    prompts: list[str] = []

    def run_lens(lens: review.Lens, prompt: str, *_: Any, **__: Any) -> dict[str, Any]:
        prompts.append(prompt)
        return {"structured_output": {"findings": []}}

    monkeypatch.setattr(review, "run_lens", run_lens)
    review.refute(run, rv, tmp_path / "slot1", tmp_path)
    (prompt,) = prompts
    assert REPRO in prompt
    assert f"uv run pytest -rf {REPRO}" in prompt
    assert '"expect_fail": true' in prompt
    assert "did not fail by name" in prompt
    assert "ModuleNotFoundError: no module named 'helper'" in prompt
    assert (attacks / "helper.py").is_file(), "the attack files are not in place for the refuter"


def test_a_finding_whose_repro_was_missing_says_so_to_the_refuter(tmp_path: Path) -> None:
    rv = repo(tmp_path / "rv1")
    head = git(rv, "rev-parse", "HEAD")
    run = review.Run(pr=PR, round_=1, head=head, merged=head, slot=1)
    run.findings = [review.Finding("l1-f1", 70, "a.py", 1, "s", "tests/test_gone.py",
                                   proof={**PROOF, "test_file": "tests/test_gone.py"})]  # fmt: skip
    review.confirm(run, rv)
    brief = review.refuter_brief(run, rv, tmp_path, run.findings)
    assert "tests/test_gone.py" in brief
    assert "not run" in brief


def test_a_reused_lens_brings_back_its_whole_attack_folder(tmp_path: Path) -> None:
    rv = repo(tmp_path / "rv1")
    out = tmp_path / "out"
    out.mkdir()
    attacks = rv / "review_attacks" / "lens-b"
    attacks.mkdir(parents=True)
    (attacks / "test_badge_passes.py").write_text("from helper import COUNT\n")
    (attacks / "helper.py").write_text("COUNT = 3\n")
    (attacks / "data.json").write_text("{}\n")
    run = review.Run(pr=PR, round_=1, head="a" * 40, merged="a" * 40, base="c" * 40, slot=1)
    found = {"score": 70, "file": "a.py", "line": 1, "summary": "s", "repro": PROOF}
    answer = {"verdict": "FIX", "head": "a" * 40, "report": "r", "findings": [found]}
    review.save_finished(out, run, review.LENS_B, answer, rv)
    for path in attacks.iterdir():
        path.unlink()
    saved = review.load_finished(out, run, review.LENS_B)
    assert saved is not None
    review.restore_attacks(rv, saved["attacks"])
    assert sorted(p.name for p in attacks.iterdir()) == [
        "data.json",
        "helper.py",
        "test_badge_passes.py",
    ]


def test_the_cloud_hand_off_names_every_lens_for_collect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def launch_one(argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        model = argv[argv.index("--model") + 1]
        branch, review_file = f"review/{PR}-{model[-8:]}", str(records_dir / f"{model}.json")
        return int(launch(["uv", "--branch", branch, "--review-file", review_file], ""))

    monkeypatch.setattr(review_cloud, "run", launch_one)
    monkeypatch.setattr(subprocess, "run", lambda *_, **__: subprocess.CompletedProcess([], 0))
    run = review.Run(pr=PR, round_=1, head="a" * 40, tier="normal")
    records = tmp_path / "cloud"
    records.mkdir()
    review.hand_off(run, [review.LENS_A, review.LENS_B], tmp_path, records)
    manifest = json.loads(review.handoff_path(records, PR, "a" * 40, 1).read_text())
    assert [lens["label"] for lens in manifest["lenses"]] == ["lens-a", "lens-b"]
    assert all(
        lens["launches"][-1]["branch"] and lens["launches"][-1]["review_file"]
        for lens in manifest["lenses"]
    )
