"""Ticket f4, T5: `python -m scripts.verify` runs the fast check for the changed paths on the staged
tree, writes `<git-common-dir>/vextrus/verify-<tree>.json` (`contracts/verify-record.schema.json`) and
prints `Factory-Verify: <tree> ok` (`contracts/trailers.md` 1) only when every check passed
(docs/specs/factory.md 2.2 "Builder's finish", 3.4 "verify").

Seams (fixed by the ticket): `scripts.verify.plan(paths, *, have=...) -> list[Check]` (`Check.name`,
`Check.argv`; `have(tool) -> bool` says whether a command is on PATH) and `scripts.verify.main(argv, *,
run)` with `run(check) -> (exit code, output text)`.
"""

import json
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors

CHECK_IDS = {
    "pytest",
    "ruff",
    "ruff-format",
    "mypy",
    "lint-imports",
    "openapi-export",
    "api-types",
    "typecheck",
    "lint",
    "messages-check",
    "web-test",
    "node-test",
    "plugin-validate",
    "plugin-test",
}
WEB = ["openapi-export", "api-types", "typecheck", "lint", "messages-check", "web-test"]
PYTEST_FLAKE = "scripts/tests/test_x.py :: test_sometimes"
VITEST_FLAKE = "web/src/a/b.test.tsx :: shows the thing"


def names(paths: list[str], **options: Any) -> list[str]:
    from scripts.verify import plan

    return [check.name for check in plan(paths, **options)]


def argv_of(paths: list[str], name: str, **options: Any) -> list[tuple[str, ...]]:
    from scripts.verify import plan

    return [tuple(check.argv) for check in plan(paths, **options) if check.name == name]


def test_a_backend_change_plans_its_modules_pytest_and_the_python_checks() -> None:
    from scripts.verify import plan

    checks = plan(["vextrus/takeoff/api.py"])
    found = [check.name for check in checks]
    assert {"pytest", "ruff", "ruff-format", "mypy", "lint-imports"} <= set(found)
    assert set(found) <= CHECK_IDS
    assert not set(found) & set(WEB)
    [pytest_argv] = argv_of(["vextrus/takeoff/api.py"], "pytest")
    assert any("vextrus/takeoff" in part for part in pytest_argv)
    assert "-rf" in pytest_argv
    assert not any("vextrus/projects" in part for check in checks for part in check.argv)


def test_a_web_change_plans_the_cloud_web_order() -> None:
    from scripts.verify import plan

    checks = plan(["web/src/takeoff/A.tsx"])
    found = [check.name for check in checks]
    assert [name for name in found if name in WEB] == WEB
    assert "pytest" not in found
    assert "mypy" not in found
    joined = {check.name: " ".join(check.argv) for check in checks}
    assert "export_openapi_schema" in joined["openapi-export"]
    assert "api:types" in joined["api-types"]
    assert "typecheck" in joined["typecheck"]
    assert "messages:check" in joined["messages-check"]
    assert "test" in joined["web-test"]


def test_a_hook_change_runs_node_tests_by_glob_never_by_folder() -> None:
    [argv] = argv_of([".claude/hooks/guard.mjs"], "node-test")
    assert ".claude/hooks/**/*.test.mjs" in argv
    assert not {".claude/hooks", ".claude/hooks/"} & set(argv)


def test_a_plugin_change_validates_and_tests_the_plugin_when_claude_is_present() -> None:
    path = ["tools/mod/vextrus-factory/register.js"]
    [validate] = argv_of(path, "plugin-validate", have=lambda tool: True)
    [tested] = argv_of(path, "plugin-test", have=lambda tool: True)
    assert " ".join(validate) == "claude plugin validate --json --strict tools/mod/vextrus-factory"
    assert " ".join(tested) == "claude plugin test tools/mod/vextrus-factory"
    absent = names(path, have=lambda tool: tool != "claude")
    assert "plugin-validate" not in absent
    assert "plugin-test" not in absent


def test_a_workflow_change_runs_the_workflow_lint() -> None:
    from scripts.verify import plan

    checks = plan([".claude/workflows/review-pr.js"])
    assert any("tools.lint.workflows_js" in " ".join(check.argv) for check in checks)


def test_a_scripts_and_tools_change_runs_both_test_folders() -> None:
    parts = [
        part
        for argv in argv_of(["scripts/ledger.py", "tools/lint/acceptance.py"], "pytest")
        for part in argv
    ]
    assert any(part.startswith("scripts") for part in parts)
    assert any(part.startswith("tools/lint") for part in parts)


def test_a_docs_only_change_plans_nothing() -> None:
    from scripts.verify import plan

    assert plan(["docs/a.md"]) == []


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


@pytest.fixture
def clone(tmp_path: Path) -> Path:
    """A clone with main at one commit and `origin/main` pointing at it."""
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "test")
    git(root, "config", "commit.gpgsign", "false")
    (root / ".github").mkdir()
    (root / ".github/flaky.txt").write_text(
        f"# Known flaky tests: <repo path> :: <test title>\n\n{PYTEST_FLAKE}\n{VITEST_FLAKE}\n"
    )
    (root / "README.md").write_text("x\n")
    git(root, "add", ".github/flaky.txt", "README.md")
    git(root, "commit", "-q", "-m", "init")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    return root


def stage(root: Path, name: str, text: str = "x = 1\n") -> str:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    git(root, "add", name)
    return git(root, "write-tree")


class Runner:
    """A fake `run`: each check's outputs in turn (the last repeats), else (0, its own text)."""

    def __init__(self, scripted: dict[str, list[tuple[int, str]]] | None = None) -> None:
        self.scripted = scripted or {}
        self.calls: list[str] = []

    def __call__(self, check: Any) -> tuple[int, str]:
        self.calls.append(check.name)
        outputs = self.scripted.get(check.name)
        if not outputs:
            return 0, f"output of {check.name}\n"
        return outputs.pop(0) if len(outputs) > 1 else outputs[0]


def verify(
    root: Path,
    run: Callable[[Any], tuple[int, str]],
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[int, str, str]:
    from scripts.verify import main

    monkeypatch.chdir(root)
    code = main([], run=run)
    out = capsys.readouterr()
    return code, out.out, out.err


def record_of(root: Path, tree: str) -> dict[str, Any]:
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    loaded: dict[str, Any] = json.loads((common / "vextrus" / f"verify-{tree}.json").read_text())
    return loaded


def records(root: Path) -> list[Path]:
    common = Path(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    return sorted((common / "vextrus").glob("verify-*.json"))


def test_a_green_staged_tree_gets_its_record_and_the_trailer(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out, _ = verify(clone, Runner(), capsys, monkeypatch)
    assert code == 0
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    assert record["tree"] == tree
    assert record["ok"] is True
    assert record["checks"]
    assert all(check["exit_code"] == 0 for check in record["checks"])
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"


def test_from_a_linked_worktree_the_record_lands_in_the_main_clones_common_dir(
    clone: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    worktree = tmp_path / "worktree"
    git(clone, "worktree", "add", "-q", "-b", "ticket", str(worktree))
    tree = stage(worktree, "scripts/thing.py")
    code, out, _ = verify(worktree, Runner(), capsys, monkeypatch)
    assert code == 0
    assert (clone / ".git" / "vextrus" / f"verify-{tree}.json").is_file()
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"


def test_a_failing_check_is_recorded_and_gets_no_trailer(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    code, out, _ = verify(clone, Runner({"mypy": [(1, "error: wrong type\n")]}), capsys, monkeypatch)
    assert code == 1
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    [mypy] = [check for check in record["checks"] if check["name"] == "mypy"]
    assert mypy["exit_code"] == 1
    assert record["ok"] is False
    assert "Factory-Verify:" not in out


def test_unstaged_changes_to_tracked_files_are_refused_with_no_record(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    stage(clone, "scripts/thing.py")
    (clone / "README.md").write_text("changed after staging\n")
    code, out, _ = verify(clone, Runner(), capsys, monkeypatch)
    assert code == 2
    assert records(clone) == []
    assert "Factory-Verify:" not in out


def test_each_checks_output_is_kept_in_a_file_the_record_names(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    assert verify(clone, Runner(), capsys, monkeypatch)[0] == 0
    for check in record_of(clone, tree)["checks"]:
        name = check["output_file"]
        assert name.startswith(f".private/work/verify/{tree}/")
        assert f"output of {check['name']}" in (clone / name).read_text()


def test_claude_absent_leaves_the_plugin_checks_out_and_says_so(
    clone: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    git_path = shutil.which("git")
    assert git_path
    (bin_dir / "git").symlink_to(git_path)
    monkeypatch.setenv("PATH", str(bin_dir))
    stage(clone, "tools/mod/vextrus-factory/register.js", "export default () => {}\n")
    tree = stage(clone, "scripts/thing.py")
    code, out, err = verify(clone, Runner(), capsys, monkeypatch)
    assert "not run: claude absent" in err
    assert code == 0
    listed = {check["name"] for check in record_of(clone, tree)["checks"]}
    assert "pytest" in listed
    assert not listed & {"plugin-validate", "plugin-test"}
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"


PYTEST_FAILED = "FAILED scripts/tests/test_x.py::test_sometimes - AssertionError: assert 1 == 2\n"
PYTEST_SUMMARY = "==== 1 failed, 40 passed in 3.10s ====\n"
VITEST_FAILED = " FAIL  src/a/b.test.tsx > the group > shows the thing\n"


@pytest.mark.parametrize(
    ("path", "check", "failure", "flake"),
    [
        ("scripts/thing.py", "pytest", PYTEST_FAILED + PYTEST_SUMMARY, PYTEST_FLAKE),
        ("web/src/a/b.tsx", "web-test", VITEST_FAILED + " Test Files  1 failed (1)\n", VITEST_FLAKE),
    ],
    ids=["pytest", "vitest"],
)
def test_a_listed_flake_that_passes_its_one_rerun_is_recorded_as_a_flake(
    clone: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    check: str,
    failure: str,
    flake: str,
) -> None:
    tree = stage(clone, path)
    run = Runner({check: [(1, failure), (0, "all passed\n")]})
    code, out, _ = verify(clone, run, capsys, monkeypatch)
    assert code == 0
    assert run.calls.count(check) == 2
    record = record_of(clone, tree)
    assert errors(record, contract("verify-record.schema.json")) == []
    [flaky] = [item for item in record["checks"] if item["name"] == check]
    assert (flaky["exit_code"], flaky["raw_exit_code"], flaky["flakes"]) == (0, 1, [flake])
    assert out.rstrip("\n").splitlines()[-1] == f"Factory-Verify: {tree} ok"


def test_a_failure_not_listed_is_never_rerun(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    other = "FAILED scripts/tests/test_x.py::test_other - AssertionError\n"
    run = Runner({"pytest": [(1, PYTEST_FAILED + other + PYTEST_SUMMARY), (0, "all passed\n")]})
    code, out, _ = verify(clone, run, capsys, monkeypatch)
    assert code == 1
    assert run.calls.count("pytest") == 1
    [item] = [item for item in record_of(clone, tree)["checks"] if item["name"] == "pytest"]
    assert item["exit_code"] == 1
    assert "Factory-Verify:" not in out


def test_a_flake_that_fails_its_rerun_fails(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    tree = stage(clone, "scripts/thing.py")
    run = Runner({"pytest": [(1, PYTEST_FAILED + PYTEST_SUMMARY)]})
    code, out, _ = verify(clone, run, capsys, monkeypatch)
    assert code == 1
    assert run.calls.count("pytest") == 2
    [item] = [item for item in record_of(clone, tree)["checks"] if item["name"] == "pytest"]
    assert item["exit_code"] == 1
    assert "Factory-Verify:" not in out


def test_with_no_flaky_file_there_are_no_flakes(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    git(clone, "rm", "-q", ".github/flaky.txt")
    git(clone, "commit", "-q", "-m", "no flaky list")
    tree = stage(clone, "scripts/thing.py")
    run = Runner({"pytest": [(1, PYTEST_FAILED + PYTEST_SUMMARY), (0, "all passed\n")]})
    code, _, _ = verify(clone, run, capsys, monkeypatch)
    assert code == 1
    [item] = [item for item in record_of(clone, tree)["checks"] if item["name"] == "pytest"]
    assert (item["exit_code"], item["flakes"]) == (1, [])
