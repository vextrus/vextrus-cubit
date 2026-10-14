"""`python -m scripts.merge_ready --cut-body <file>` (S29-F2b): rule (c) on a PR body before the PR
exists, offline, for the shift-left hook on `gh pr create --body-file`."""

from pathlib import Path

import pytest

from scripts.merge_ready import body_cut_problems, main


def test_a_body_with_cut_none_passes() -> None:
    assert body_cut_problems("Closes #9.\n\n## Cut\nNone.\n") == []


def test_a_cut_item_linking_an_issue_passes_whether_or_not_the_issue_is_open() -> None:
    assert body_cut_problems("## Cut\n- the tier 2 export (#12)\n") == []


def test_a_body_without_a_cut_section_is_named() -> None:
    (found,) = body_cut_problems("Closes #9.\n\n## Not verified\nThe live call.\n")
    assert "no '## Cut' section" in found


def test_a_cut_item_without_an_issue_is_named() -> None:
    (found,) = body_cut_problems("## Cut\n- the tier 2 export\n")
    assert "'cut' item 1 links no issue" in found


@pytest.mark.parametrize(
    ("body", "code"), [("## Cut\nNone.\n", 0), ("## Summary\nx\n", 1), ("## Cut\n- x\n", 1)]
)
def test_the_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], body: str, code: int
) -> None:
    file = tmp_path / "body.md"
    file.write_text(body)
    assert main(["--cut-body", str(file)]) == code
    printed = capsys.readouterr().out
    assert all(line.startswith("merge-ready: ") for line in printed.splitlines())
    assert (printed != "") == (code == 1)


def test_an_unreadable_body_file_exits_2(tmp_path: Path) -> None:
    assert main(["--cut-body", str(tmp_path / "missing.md")]) == 2
