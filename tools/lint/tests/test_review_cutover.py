"""The review cutover lint reads an `agent(` call whole: template literals, nested calls, strings with
parentheses; it ignores other uses of the word and a `.agent(` method."""

from pathlib import Path

from tools.lint.review_cutover import main, problems


def root_with(tmp_path: Path, text: str, name: str = "real-set-walk.js") -> Path:
    (tmp_path / ".claude/workflows").mkdir(parents=True)
    (tmp_path / ".claude/workflows" / name).write_text(text)
    return tmp_path


def test_no_workflows_folder_passes(tmp_path: Path) -> None:
    assert problems(tmp_path) == []


def test_a_ledger_word_in_a_template_literal_prompt_names_its_line(tmp_path: Path) -> None:
    text = "const a = 1\nconst r = await agent(`run ${x} then Ledger record (now)`, { label: 'l' })\n"
    assert [p.split(":")[1] for p in problems(root_with(tmp_path, text))] == ["2"]


def test_a_ledger_word_after_a_parenthesis_in_a_string_still_counts(tmp_path: Path) -> None:
    text = "await agent('check (a) ) then run the ledger', { label: 'l' })\n"
    assert len(problems(root_with(tmp_path, text))) == 1


def test_the_word_outside_any_agent_call_is_not_flagged(tmp_path: Path) -> None:
    text = "// the ledger is written by code\nconst r = await agent('walk')\nlog('ledger')\n"
    assert problems(root_with(tmp_path, text)) == []


def test_a_method_named_agent_is_not_an_agent_call(tmp_path: Path) -> None:
    assert problems(root_with(tmp_path, "await runner.agent('ledger')\n")) == []


def test_an_unclosed_call_reads_to_the_end_of_the_file(tmp_path: Path) -> None:
    assert len(problems(root_with(tmp_path, "await agent('x'\nledger\n"))) == 1


def test_a_second_script_is_named(tmp_path: Path) -> None:
    root = root_with(tmp_path, "return 1\n", "review-pr-prechecked.js")
    (message,) = problems(root)
    assert message.startswith(".claude/workflows/review-pr-prechecked.js: only real-set-walk.js")


def test_main_exit_codes(tmp_path: Path) -> None:
    assert main([str(root_with(tmp_path, "await agent('walk')\n"))]) == 0
    assert main(["a", "b"]) == 2
