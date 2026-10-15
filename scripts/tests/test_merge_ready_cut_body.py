"""`python -m scripts.merge_ready --cut-body <file>` and `--cut-message <file>` (S30-F2d): rule (c)
offline, before a PR exists, for the advisory shift-left hook at `gh pr create` and `git commit`."""

from pathlib import Path

import pytest

from scripts.merge_ready import body_cut_problems, main, message_cut_problems

TRAILERS = (
    "Factory-State: READY\nFactory-Verify: " + "0" * 40 + " ok\n"
    "Co-Authored-By: Fixture <fixture@example.invalid>\n"
)


def test_a_body_with_cut_none_passes() -> None:
    assert body_cut_problems("Closes #9.\n\n## Cut\nNone.\n") == []


def test_a_cut_item_linking_an_issue_passes_whether_or_not_the_issue_is_open() -> None:
    assert body_cut_problems("## Cut\n- the tier 2 export (#12)\n") == []


def test_a_body_without_a_cut_section_passes_as_merge_ready_passes_it() -> None:
    assert body_cut_problems("Closes #9.\n\n## Not verified\nThe live call.\n") == []


def test_a_cut_item_without_an_issue_is_named() -> None:
    (found,) = body_cut_problems("## Cut\n- the tier 2 export\n")
    assert "'cut' item 1 links no issue" in found


def test_a_ready_message_sets_its_trailers_aside() -> None:
    message = f"ready: S99-X1\n\nThe widget.\n\n## Cut\n- the export (#9)\n\n{TRAILERS}"
    assert message_cut_problems(message) == []


def test_a_ready_message_with_notes_after_cut_none_is_named() -> None:
    message = f"ready: S99-X1\n\n## Cut\nNone.\n\nLater tickets:\n- the export\n\n{TRAILERS}"
    (found,) = message_cut_problems(message)
    assert "links no issue" in found


def test_a_message_that_is_not_ready_has_no_cut_problem() -> None:
    assert message_cut_problems("S99-X1: a step\n\n## Cut\n- the export\n") == []


@pytest.mark.parametrize(
    ("flag", "text", "code"),
    [
        ("--cut-body", "## Cut\nNone.\n", 0),
        ("--cut-body", "## Summary\nx\n", 0),
        ("--cut-body", "## Cut\n- x\n", 1),
        ("--cut-message", f"ready: x\n\n## Cut\n- x\n\n{TRAILERS}", 1),
        ("--cut-message", f"ready: x\n\n## Cut\nNone.\n\n{TRAILERS}", 0),
    ],
)
def test_the_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], flag: str, text: str, code: int
) -> None:
    file = tmp_path / "text.md"
    file.write_text(text)
    assert main([flag, str(file)]) == code
    printed = capsys.readouterr().out
    assert all(line.startswith("merge-ready: ") for line in printed.splitlines())
    assert (printed != "") == (code == 1)


def test_an_unreadable_file_exits_2(tmp_path: Path) -> None:
    assert main(["--cut-body", str(tmp_path / "missing.md")]) == 2
    assert main(["--cut-message", str(tmp_path / "missing.md")]) == 2
