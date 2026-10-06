"""S14-R2, PR #496 fix round 2 (96fea5d): collect's advice names `--relaunch <lens>` and following it
relaunches the dead lenses; a stop while the launcher runs leaves an `unconfirmed` launch, never a
`failed` lens that a rerun would launch a second time."""

import json
import re
import shlex
import signal
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review, review_cloud
from scripts.factory.tests.test_review_r2_fix1 import PR, Cloud

NONCES = [f"{n}" * 32 for n in "89abcdef"]
ADVICE = r"`review run (\S+) --round (\S+) --where cloud((?: --relaunch \S+)*)`"
STOPS = (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)


class Launcher:
    """review_cloud.run in place: each launch makes a real review file with the next nonce and runs
    `true`, or for a model in `killing` a launcher that sends SIGTERM to review.py while it runs."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch, head: str) -> None:
        self.head = head
        self.killing: set[str] = set()
        self.failing: set[str] = set()
        self.launched: list[tuple[str, str]] = []  # (model, nonce)
        monkeypatch.setattr(review_cloud, "run", self.run)

    def run(self, argv: list[str], *, push: Any, launch: Any, records_dir: Path) -> int:
        model = argv[argv.index("--model") + 1]
        nonce = NONCES[len(self.launched)]
        self.launched.append((model, nonce))
        review_file = records_dir / f"review-{PR}-{nonce[:8]}.json"
        review_file.write_text(json.dumps({"pr": PR, "head_sha": self.head, "nonce": nonce}))
        branch = f"review/{PR}-{nonce[:8]}"
        if model in self.failing:
            self.launched.pop()
            return 3  # the push or the launch failed: nothing launched
        command = ["true"]
        if model in self.killing:
            command = ["sh", "-c", "kill -TERM $PPID; sleep 30"]
        return int(launch([*command, "--branch", branch, "--review-file", str(review_file)], ""))

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


def hand_off(cloud: Cloud, relaunch: frozenset[str] = frozenset()) -> None:
    run = review.Run(pr=PR, round_=1, head=cloud.head, tier="normal")
    review.hand_off(run, [review.LENS_A, review.LENS_B], cloud.main, cloud.records, relaunch)


def collect(cloud: Cloud) -> None:
    args = review.parse(["collect", str(PR), "--round", "1"])
    review.collect(review.Run(pr=PR, round_=1), args, cloud.main)


def entries(cloud: Cloud) -> dict[str, dict[str, Any]]:
    loaded = json.loads(review.handoff_path(cloud.records, PR, cloud.head, 1).read_text())
    return {entry["label"]: entry for entry in loaded["lenses"]}


# ---------------------------------------------------------------- 1. advice that relaunches


def test_following_collects_advice_relaunches_both_dead_lenses(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    """Refuted: collect advised a plain rerun with --where cloud, which never relaunches a lens that
    has a launch, so following it looped for ever."""
    launcher = Launcher(monkeypatch, cloud.head)
    hand_off(cloud)  # both lenses launch; both sessions die
    with pytest.raises(review.Refused) as refused:
        collect(cloud)
    advice = re.search(ADVICE, str(refused.value))
    assert advice is not None, str(refused.value)
    assert advice.group(1, 2) == (str(PR), "1")
    named = frozenset(re.findall(r"--relaunch (\S+)", advice[3]))
    assert named == {"lens-a", "lens-b"}
    hand_off(cloud)  # a plain rerun: says why it launches nothing
    assert len(launcher.launched) == 2
    err = capfd.readouterr().err
    assert "lens-a: launched, no verdict; relaunch with --relaunch lens-a" in err
    assert "lens-b: launched, no verdict; relaunch with --relaunch lens-b" in err
    hand_off(cloud, named)  # the advice, followed exactly
    assert [model for model, _ in launcher.launched[2:]] == [review.LENS_A.model, review.LENS_B.model]
    now = entries(cloud)
    assert [now[label]["count"] for label in ("lens-a", "lens-b")] == [2, 2]
    assert [len(now[label]["launches"]) for label in ("lens-a", "lens-b")] == [2, 2]


# ---------------------------------------------------------------- 2. a stop while the launcher runs


@pytest.fixture
def stop_handlers() -> Any:
    saved = {
        signum: signal.getsignal(signum) for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)
    }
    review.install_stop_handlers()
    yield
    for signum, handler in saved.items():
        signal.signal(signum, handler)


def test_a_sigterm_during_lens_b_s_launcher_leaves_an_unconfirmed_launch_a_rerun_keeps(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch, stop_handlers: None
) -> None:
    """Refuted: a stop while the launcher ran recorded lens B as `failed` with no launch, though its
    session may exist, so a rerun launched it a second time."""
    launcher = Launcher(monkeypatch, cloud.head)
    launcher.killing = {review.LENS_B.model}
    with pytest.raises(review.Stopped):
        hand_off(cloud)
    first = entries(cloud)
    (pending,) = first["lens-b"]["launches"]
    b_nonce = launcher.nonce_of(review.LENS_B.model)
    assert pending == {
        "branch": f"review/{PR}-{b_nonce[:8]}",
        "review_file": str(cloud.records / f"review-{PR}-{b_nonce[:8]}.json"),
        "unconfirmed": True,
    }
    assert first["lens-b"]["state"] == "unconfirmed"
    launcher.killing = set()
    hand_off(cloud)  # the rerun: lens B has a launch, so it is not launched again
    assert len(launcher.launched) == 2
    cloud.answer(launcher.nonce_of(review.LENS_A.model), "PASS", [])
    cloud.answer(b_nonce, "PASS", [])  # lens B's session did start, and answered
    collect(cloud)
    (recorded,) = list(cloud.ledger_dir.iterdir())
    assert json.loads(recorded.read_text())["counts"]["reviewers"] == 2


# ---------------------------------------------------------------- 3. round 3's advice keeps its flags


R3 = ["--round", "3", "--exception", "fix-regression", "--reason", "the advice's round-3 flags"]
COMMAND = re.compile(r"`(review run [^`]+)`")


def follow(cloud: Cloud, monkeypatch: pytest.MonkeyPatch, text: str, which: int = 0) -> None:
    """Run the `which`-th command `text` advises, exactly as printed, through review.py's own run."""
    commands = COMMAND.findall(text)
    assert commands, f"no command in {text!r}"
    args = review.parse(shlex.split(commands[which])[1:])
    monkeypatch.setattr(review, "merged_head", lambda main, pr, head: (head, head))
    monkeypatch.setattr(review, "changes", lambda *_: ([("vextrus/rates/table.py", 400, 0)], []))
    monkeypatch.setattr(review, "merge_bases", lambda *_: 1)
    monkeypatch.setattr(review, "tier", lambda *_, **__: "normal")
    review.review(review.Run(pr=PR, round_=args.round), args, cloud.main)


def round3(cloud: Cloud) -> review.Run:
    args = review.parse(["run", str(PR), *R3, "--where", "cloud"])
    run = review.Run(pr=PR, round_=3, head=cloud.head, tier="normal")
    run.exception, run.reason = args.exception, args.reason
    return run


def test_collects_round_3_advice_keeps_the_exception_and_relaunches(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: in round 3 the advice left out --exception and --reason, so check_round refused it
    ("round 3 needs a recorded exception")."""
    launcher = Launcher(monkeypatch, cloud.head)
    review.hand_off(round3(cloud), [review.LENS_A, review.LENS_B], cloud.main, cloud.records)
    with pytest.raises(review.Refused) as refused:
        review.collect(review.Run(pr=PR, round_=3), review.parse(["collect", str(PR), *R3]), cloud.main)
    follow(cloud, monkeypatch, str(refused.value))  # the advice, exactly: accepted, both relaunched
    assert len(launcher.launched) == 4
    now = json.loads(review.handoff_path(cloud.records, PR, cloud.head, 3).read_text())
    assert [entry["count"] for entry in now["lenses"]] == [2, 2]


def test_hand_offs_failure_advice_in_round_3_keeps_the_exception(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch
) -> None:
    launcher = Launcher(monkeypatch, cloud.head)
    launcher.failing = {review.LENS_B.model}
    with pytest.raises(review.Refused) as refused:
        review.hand_off(round3(cloud), [review.LENS_A, review.LENS_B], cloud.main, cloud.records)
    launcher.failing = set()
    follow(cloud, monkeypatch, str(refused.value))
    assert [model for model, _ in launcher.launched] == [review.LENS_A.model, review.LENS_B.model]


def test_a_reruns_launched_no_verdict_line_in_round_3_keeps_the_exception(
    cloud: Cloud, monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    launcher = Launcher(monkeypatch, cloud.head)
    review.hand_off(round3(cloud), [review.LENS_A, review.LENS_B], cloud.main, cloud.records)
    capfd.readouterr()
    review.hand_off(round3(cloud), [review.LENS_A, review.LENS_B], cloud.main, cloud.records)
    line = next(line for line in capfd.readouterr().err.splitlines() if "lens-a: launched" in line)
    follow(cloud, monkeypatch, line)
    assert [model for model, _ in launcher.launched] == [
        review.LENS_A.model,
        review.LENS_B.model,
        review.LENS_A.model,
    ]
