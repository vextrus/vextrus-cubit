"""S18-F6, the review bar fails closed: a tiers file that cannot be read judges every path strict, and
it is read for the decision at hand, never remembered from an earlier one.

The brief (session 18): "an unreadable or missing tiers file judges every path strict." PR #615's
round-2 finding l1-f2 (score 50, confirmed): a test pointed the tiers file at a missing file and the
lax list read while it was missing stayed cached, so every later decision in the process judged a lax
path strict (and, the other way, a list cached before stayed in force while the file was missing). The
bar must not depend on which decision came first: these tests pass in any order and under any `-k`
subset, and each one checks both directions inside itself.

Seam (named by S17-F6's build, `scripts/ledger.py`): `scripts.ledger.TIERS_FILE`, the path of the
review tiers' file (`scripts/factory/review_tiers.toml`) the bar reads. The tests point it elsewhere
with `monkeypatch.setattr` and judge through `python -m scripts.ledger decide` and `to-file`."""

import json
from collections.abc import Callable
from pathlib import Path

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
PASS = f"VERDICT: PASS at {H}"
LAX_WEB = "web/src/ui/Button.tsx"
LAX_DOC = "docs/adr/0043-reviews-run-by-code.md"


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def unused_scan(text: str) -> int:
    raise AssertionError("decide scans nothing")


def unused_post(pr: int, body: str) -> int:
    raise AssertionError("decide posts nothing")


def ledger(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], command: str, *rows: str
) -> dict[str, object]:
    """`python -m scripts.ledger <command> --from <rows> --head H`: its one JSON line (exit 0)."""
    from scripts.ledger import main

    source = tmp_path / "final.txt"
    source.write_text("".join(f"{row}\n" for row in rows))
    code = main(
        [command, "--from", str(source), "--head", H],
        scan=unused_scan,
        post=unused_post,
        ledger_dir=tmp_path / "ledger",
    )
    out = capsys.readouterr()
    assert code == 0, out.out + out.err
    [line] = [row for row in out.out.splitlines() if row.strip()]
    loaded: dict[str, object] = json.loads(line)
    return loaded


def verdict(tmp_path: Path, capsys: pytest.CaptureFixture[str], score: int, path: str) -> object:
    return ledger(tmp_path, capsys, "decide", PASS, f"FINDING f1 {score} CONFIRMED {path}")["verdict"]


def filed(tmp_path: Path, capsys: pytest.CaptureFixture[str], score: int, path: str) -> object:
    return ledger(tmp_path, capsys, "to-file", PASS, f"FINDING f1 {score} CONFIRMED {path}")["to_file"]


def missing(folder: Path) -> Path:
    return folder / "missing.toml"


def not_toml(folder: Path) -> Path:
    path = folder / "broken.toml"
    path.write_text('[lax\npaths = ["web/**", "docs/**"\n')
    return path


def a_folder(folder: Path) -> Path:
    path = folder / "a-folder.toml"
    path.mkdir()
    return path


def nothing_lax(folder: Path) -> Path:
    path = folder / "empty.toml"
    path.write_text("[lax]\npaths = []\n\n[strict]\npaths = []\n")
    return path


def empty(folder: Path) -> Path:
    path = folder / "zero.toml"
    path.write_bytes(b"")
    return path


UNREADABLE: dict[str, Callable[[Path], Path]] = {
    "missing": missing,
    "not-toml": not_toml,
    "a-folder": a_folder,
    "lists-nothing-lax": nothing_lax,
    "empty": empty,
}


def point_tiers_at(monkeypatch: pytest.MonkeyPatch, path: Path) -> None:
    import scripts.ledger

    monkeypatch.setattr(scripts.ledger, "TIERS_FILE", path)


@pytest.mark.parametrize("path", [LAX_WEB, LAX_DOC])
@pytest.mark.parametrize("kind", list(UNREADABLE))
def test_a_tiers_file_that_cannot_be_read_judges_a_lax_path_strict(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    kind: str,
    path: str,
) -> None:
    folder = tmp_path / "tiers"
    folder.mkdir()
    point_tiers_at(monkeypatch, UNREADABLE[kind](folder))
    assert verdict(tmp_path, capsys, 60, path) == "FIX"
    assert filed(tmp_path, capsys, 60, path) == []


@pytest.mark.parametrize("path", [LAX_WEB, LAX_DOC])
def test_the_bar_reads_the_tiers_file_for_each_decision_and_remembers_none(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    """Missing, then the real file, then missing again, then the real file: each decision follows the
    file as it is at that decision, whatever an earlier test or decision read."""
    folder = tmp_path / "tiers"
    folder.mkdir()

    with pytest.MonkeyPatch.context() as patch:
        point_tiers_at(patch, missing(folder))
        assert verdict(tmp_path, capsys, 60, path) == "FIX", "a list read before stayed in force"

    assert verdict(tmp_path, capsys, 74, path) == "PASS", "the missing file's judgement stayed cached"
    assert filed(tmp_path, capsys, 74, path) == ["f1"], "the missing file's judgement stayed cached"

    with pytest.MonkeyPatch.context() as patch:
        point_tiers_at(patch, missing(folder))
        assert verdict(tmp_path, capsys, 60, path) == "FIX", "a list read before stayed in force"
        assert filed(tmp_path, capsys, 60, path) == [], "a list read before stayed in force"

    assert verdict(tmp_path, capsys, 74, path) == "PASS", "the missing file's judgement stayed cached"
