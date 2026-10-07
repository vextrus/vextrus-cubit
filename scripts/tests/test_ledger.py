"""The review ledger's edges the acceptance tests leave open: a failed post writes nothing, a round
already recorded cannot be recorded again lower, and the default leak scan fails closed."""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.ledger import main

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
H2 = "2f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"


@pytest.fixture(autouse=True)
def local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def source(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "final.txt"
    path.write_text("".join(f"{row}\n" for row in rows))
    return path


def record(tmp_path: Path, store: Path, head: str, round_: int, **seams: Any) -> int:
    given = source(tmp_path, f"VERDICT: PASS at {head}")
    argv = ["record", "12", "--round", str(round_), "--head", head, "--from", str(given)]
    options: dict[str, Any] = {"scan": lambda text: 0, "post": lambda pr, body: 5, "ledger_dir": store}
    return main(argv, **(options | seams))


def boom(pr: int, body: str) -> int:
    raise OSError("gh failed")


@pytest.mark.parametrize("post", [lambda pr, body: 0, boom], ids=["no-id", "raises"])
def test_a_failed_post_writes_nothing(tmp_path: Path, post: Any) -> None:
    store = tmp_path / "ledger"
    assert record(tmp_path, store, H, 1, post=post) == 3
    assert not store.exists() or list(store.iterdir()) == []


def test_a_new_head_cannot_be_recorded_at_a_lower_round(tmp_path: Path) -> None:
    store = tmp_path / "ledger"
    assert record(tmp_path, store, H, 2) == 0
    assert record(tmp_path, store, H2, 1) == 3
    assert record(tmp_path, store, H2, 2) == 3


def test_crlf_lines_decide_like_lf(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    given = tmp_path / "final.txt"
    given.write_bytes(f"VERDICT: PASS at {H}\r\nFINDING a 10 -\r\n".encode())
    assert main(["decide", "--from", str(given), "--head", H], ledger_dir=tmp_path) == 0
    assert json.loads(capsys.readouterr().out)["verdict"] == "PASS"


@pytest.mark.parametrize(
    "argv",
    [
        ["check", "12", "--round", "1", "--exception", "crash", "--reason", "x"],
        ["check", "0", "--round", "1"],
        ["decide", "--from", "x", "--head", "main"],
        ["bogus"],
        [],
    ],
)
def test_usage_errors_exit_2(tmp_path: Path, argv: list[str]) -> None:
    assert main(argv, ledger_dir=tmp_path) == 2


def test_a_multi_line_reason_is_refused(tmp_path: Path) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}")
    argv = ["record", "12", "--round", "3", "--head", H, "--from", str(given)]
    argv += ["--exception", "crash", "--reason", "one\ntwo"]
    assert main(argv, scan=lambda text: 0, post=lambda pr, body: 5, ledger_dir=tmp_path) == 3
    assert list(tmp_path.glob("12-*.json")) == []


@pytest.mark.parametrize(
    ("code", "stdout"),
    [
        (2, "leakscan: cannot-scan no-corpus\n"),
        (0, "nothing parsable\n"),
        (1, "leakscan: hits=0 scanned=1 corpus=0123456789ab\n"),
        (64, ""),
    ],
)
def test_the_default_leak_scan_fails_closed(
    monkeypatch: pytest.MonkeyPatch, code: int, stdout: str
) -> None:
    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args[0], code, stdout, "")

    monkeypatch.setattr(subprocess, "run", fake)
    with pytest.raises(RuntimeError):
        ledger.leak_scan("text")


def test_the_default_leak_scan_reads_the_hit_count(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        out = "HIT stdin:1 2\nleakscan: hits=2 scanned=1 corpus=0123456789ab\n"
        return subprocess.CompletedProcess(args[0], 1, out, "")

    monkeypatch.setattr(subprocess, "run", fake)
    assert ledger.leak_scan("text") == 2


def test_the_round_check_post_and_write_happen_under_the_ledger_lock(tmp_path: Path) -> None:
    """Two `record` runs at once cannot both pass the round check (the refuter's race)."""
    import fcntl

    store = tmp_path / "ledger"
    held: list[bool] = []

    def post(pr: int, body: str) -> int:
        with open(tmp_path / "ledger.lock", "a") as other:
            try:
                fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                held.append(True)
        return 5

    assert record(tmp_path, store, H, 1, post=post) == 0
    assert held == [True]


@pytest.mark.parametrize("reason", ["one\u2028two", "a\x85b", "\u200b", " "])
def test_a_reason_must_be_one_printable_line(tmp_path: Path, reason: str) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}")
    argv = ["record", "12", "--round", "3", "--head", H, "--from", str(given)]
    argv += ["--exception", "crash", "--reason", reason]
    assert main(argv, scan=lambda text: 0, post=lambda pr, body: 5, ledger_dir=tmp_path / "l") == 3


def test_a_ledger_path_that_is_a_file_refuses_before_posting(tmp_path: Path) -> None:
    store = tmp_path / "ledger"
    store.write_text("not a folder\n")
    posts: list[str] = []

    def post(pr: int, body: str) -> int:
        posts.append(body)
        return 5

    assert main(["check", "12", "--round", "1"], ledger_dir=store) == 3
    assert record(tmp_path, store, H, 1, post=post) == 3
    assert posts == []


def test_a_huge_score_is_bad_input(tmp_path: Path) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}", "FINDING a " + "9" * 5000 + " -")
    assert main(["decide", "--from", str(given), "--head", H], ledger_dir=tmp_path) == 2


def test_check_refuses_an_exception_with_no_reason(tmp_path: Path) -> None:
    argv = ["check", "12", "--round", "3", "--exception", "crash"]
    assert main(argv, ledger_dir=tmp_path / "ledger") == 3
    assert main([*argv, "--reason", "the export crashes"], ledger_dir=tmp_path / "ledger") == 0


# ---------------------------------------------------------------- the bar's edges (S17-F6)


@pytest.mark.parametrize(
    ("file", "strict"),
    [
        ("vextrus/rates/table.py", True),
        ("VEXTRUS/Rates/table.py", True),  # case ignored: fail closed
        ("vextrus\\rates\\table.py", True),  # a Windows spelling
        ("vextrus/rates/table.py:12", True),
        ("./vextrus/boq/services/pricing.py", True),
        ("/home/user/vextrus-cubit/web/src/components/badge.tsx", True),  # absolute: strict
        ("vextrus/rates/../../web/src/components/badge.tsx", True),  # any `..`: strict
        ("../outside.py", True),
        (None, True),
        ("", True),
        ("C:\\repo\\engine\\read\\x.py", True),  # the refuter's spellings (S17-F6)
        ("C:/repo/engine/read/x.py", True),
        ("vextrus/platform/database.py:12-20", True),
        ("vextrus/platform/database.py:L12", True),
        ("vextrus/platform/database.py#L12", True),
        (".claude/settings.json:1-2", True),
        ("b/engine/read/x.py", True),
        ("vextrus/platform/database.py ", True),
        (" vextrus/platform/database.py", True),
        ("web/src/components/badge tsx", True),  # a blank: not a plain path
        ("web/src/components/badge.tsx", False),
        ("web/src/components/badge.tsx#L3-L9", False),
        ("./web/src/components/badge.tsx:4-6", False),
        ("web/src/components/badge.tsx:7:2", False),
        ("scripts/factory/say.py", False),
    ],
)
def test_on_strict_path(file: str | None, strict: bool) -> None:
    assert ledger.on_strict_path(file) is strict


def test_an_unreadable_strict_list_judges_every_path_strict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ledger.strict_paths.cache_clear()
    monkeypatch.setattr(ledger, "TIERS_FILE", tmp_path / "missing.toml")
    try:
        assert ledger.on_strict_path("web/src/components/badge.tsx") is True
        (tmp_path / "missing.toml").write_text("[strict]\npaths = []\n")
        ledger.strict_paths.cache_clear()
        assert ledger.on_strict_path("web/src/components/badge.tsx") is True
    finally:
        ledger.strict_paths.cache_clear()


@pytest.mark.parametrize(
    ("file", "named"), [("a.py", "a.py"), ("a b.py", None), ("", None), (None, None), (3, None)]
)
def test_a_file_a_finding_line_cannot_carry_is_none(file: Any, named: str | None) -> None:
    assert ledger.named_file(file) == named


def test_a_pass_with_an_unrefuted_finding_that_could_block_is_refused_at_record(
    tmp_path: Path,
) -> None:
    """`commit_record` itself (as `fetch-verdict` reaches it, with no `decide` refusal before it)."""
    decision = ledger.judge(["PASS"], {"f1": (60, "-", "vextrus/rates/table.py")}, "0" * 64)
    assert decision.verdict == "PASS"
    with pytest.raises(ledger.Refused):
        ledger.commit_record(
            pr=12, head=H, round_=1, decision=decision, exception=None, source="fetch-verdict",
            scan=lambda text: 0, post=lambda pr, body: 5, ledger_dir=tmp_path / "ledger",
        )  # fmt: skip
    assert not (tmp_path / "ledger" / f"12-{H}.json").exists()


def test_a_pass_with_an_unrefuted_74_off_the_strict_paths_is_recorded(tmp_path: Path) -> None:
    decision = ledger.judge(["PASS"], {"f1": (74, "-", "web/src/components/badge.tsx")}, "0" * 64)
    ledger.commit_record(
        pr=12, head=H, round_=1, decision=decision, exception=None, source="fetch-verdict",
        scan=lambda text: 0, post=lambda pr, body: 5, ledger_dir=tmp_path / "ledger",
    )  # fmt: skip
    written = json.loads((tmp_path / "ledger" / f"12-{H}.json").read_text())
    assert written["verdict"] == "PASS"
    assert written["counts"]["unrefuted_ge_50"] == 1
    assert decision.to_file == ("f1",)


@pytest.mark.parametrize(
    ("file", "code"),
    [
        ("vextrus/platform/database.py ", 3),  # padded: the refuter's case (S17-F6)
        ("vextrus/platform/database.py", 3),
        ("app.py", 0),  # a file of the head's tree, off the strict paths
        ("web/src/components/badge.tsx", 3),  # not in the head's tree: judged strict
    ],
    ids=["padded-strict", "strict", "off-strict", "not-on-the-tree"],
)
def test_fetch_verdict_judges_a_cloud_pass_by_the_bar(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, file: str, code: int
) -> None:
    """A cloud reviewer's PASS with an unrefuted 60 is refused on a strict path, however its file is
    padded, and recorded PASS off the strict paths."""
    from scripts.tests.acceptance.tf4.test_ledger_fetch_verdict import (
        VERDICT_PATH,
        Origin,
        fetch,
        verdict_file,
    )

    origin = Origin(tmp_path)
    found = [{"score": 60, "file": file, "line": 1, "summary": "a row is read twice"}]
    origin.review_branch({VERDICT_PATH: verdict_file(origin.head, findings=found)})
    done, store = fetch(origin, tmp_path, monkeypatch)
    assert done == code
    written = store / f"12-{origin.head}.json"
    assert written.exists() is (code == 0)
    if code == 0:
        assert json.loads(written.read_text())["verdict"] == "PASS"


@pytest.mark.parametrize(
    "file",
    [
        "vextrus/platform/schemas/money.py",  # PR #610 review, round 1: money in the API
        "vextrus/drawings/services/_access.py",  # the project-scope wall
        "vextrus/platform/services/invitations.py",
        "vextrus/platform/services/storage.py",
        "vextrus/projects/services/access.py",
        "vextrus/rates",  # a folder: `X/**` matches `X`
        "engine/read",
        "engine/recognise/storeys.py",
        "vextrus/projects/services/projects.py",  # PR #610 review, round 2: walls in each module
        "vextrus/drawings/http/files.py",
        "vextrus/drawings/acts.py",
        "vextrus/api.py",
        "scripts/owner/post-status",
        ".github/workflows/ci.yml",
        ".claude/hooks/guard.mjs",
    ],
)
def test_a_60_on_a_wall_folder_blocks(tmp_path: Path, file: str) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}", f"FINDING f1 60 CONFIRMED {file}")
    decision = ledger.decide(given.read_bytes(), H)
    assert decision.verdict == "FIX"
    assert decision.to_file == ()


@pytest.mark.parametrize(
    "file", ["web/src/x.tsx", "scripts/factory/watch.py", "tools/leakscan/scan.py", "engine/plot/x.py"]
)
def test_a_60_off_the_strict_trees_is_filed_not_blocking(tmp_path: Path, file: str) -> None:
    given = source(tmp_path, f"VERDICT: PASS at {H}", f"FINDING f1 60 CONFIRMED {file}")
    decision = ledger.decide(given.read_bytes(), H)
    assert decision.verdict == "PASS"
    assert decision.to_file == ("f1",)
