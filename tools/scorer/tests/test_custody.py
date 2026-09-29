"""scripts/owner/keys-custody.sh, which the owner runs as root: what a test can check without raising
privilege (its syntax, its installed copy's list against the runner's, and that it moves and removes by
name, never copies or deletes recursively)."""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

from scripts.real_drawings import runner

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "owner" / "keys-custody.sh"


def test_the_script_parses() -> None:
    done = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


@pytest.mark.skipif(shutil.which("shellcheck") is None, reason="no shellcheck here")
def test_shellcheck_finds_nothing() -> None:
    done = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stdout


def test_it_installs_exactly_the_files_the_runner_checks_against_mains() -> None:
    block = re.search(r"(?s)^RUNNER_FILES=\((.*?)^\)", SCRIPT.read_text(), re.M)
    assert block is not None
    assert tuple(block.group(1).split()) == runner.FILES


def test_it_moves_keys_and_removes_drafts_by_name_never_copying_or_deleting_recursively() -> None:
    text = SCRIPT.read_text()
    assert 'mv -- "$DRAFTS/$set.json" "$key"' in text
    copies = [line for line in text.splitlines() if re.search(r"\b(cp|install|cat|ln)\b", line)]
    assert not [line for line in copies if "DRAFTS" in line or "KEY_DIR" in line], copies
    assert not re.search(r"\brm\s+-[a-zA-Z]*[rR]", text)
    assert 'rm -f -- "$f"' in text


def test_it_installs_main_s_committed_files_never_the_working_trees() -> None:
    text = SCRIPT.read_text()
    assert "from_main tools/scorer/score.py" in text
    assert 'from_main "$file"' in text
    assert not re.search(r"\$ROOT/(tools|scripts)/", text)
    # Fix round 1, F4 (65): main is root's clone checked against GitHub's, never your checkout's ref.
    assert 'from_main() { git -C "$MAIN_REPO" show' in text
    assert 'git -C "$ROOT" show' not in text
    assert '"$(git -C "$MAIN_REPO" rev-parse refs/heads/main)" = "$github_main"' in text


def test_its_paths_are_the_runners_and_the_scorers() -> None:
    text = SCRIPT.read_text()
    for path in (runner.RUNNER, runner.INSTALLED, runner.SPOOL, runner.HOME, runner.BIN, runner.SCORER):
        name = str(path).rsplit("/", 1)[-1]
        assert name in text, path
    assert f"RUN_USER={runner.RUNNER_USER}" in text


def root_lines(text: str) -> list[str]:
    """The script's lines run as root: every line not run through `as_owner` (a whole `as_owner bash
    -c '...'` block included) and not a comment."""
    text = re.sub(r"(?s)as_owner bash -c '.*?'[^\n]*", "as_owner", text)
    return [
        line
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#") and "as_owner" not in line
    ]


def test_root_changes_no_owner_of_a_file_through_a_link() -> None:
    """Fix round 1, F1 (70): root's chown followed a lock your user had made a link to /etc/passwd."""
    lines = root_lines(SCRIPT.read_text())
    chowns = [line for line in lines if re.search(r"\bchown\b", line)]
    assert chowns
    assert all(re.search(r"\bchown\s+(-R\s+)?-h\b", line) for line in chowns), chowns
    text = SCRIPT.read_text()
    assert 'rm -f -- "$DROP/.lock"' in text
    assert text.index('chown -h "$RUN_USER:$KEY_GROUP" "$DROP"') < text.index('rm -f -- "$DROP/.lock"')
    assert not any(re.search(r"chmod\b.*\.lock", line) for line in lines)


def test_a_draft_that_is_a_link_is_never_taken() -> None:
    """F2 (70): a draft that was a link moved as a link, and the key stayed in your user's hands."""
    text = SCRIPT.read_text()
    assert '[ ! -L "$DRAFTS/$set.json" ] && [ -f "$DRAFTS/$set.json" ]' in text
    assert 'if [ -L "$key" ] || [ ! -f "$key" ]; then' in text
    assert '[ "$(sha256sum < "$key" | cut -d\' \' -f1)" = "$sha" ]' in text


def test_uv_is_the_pinned_release_never_your_users_copy() -> None:
    """F4 (65): uv was copied from your user's ~/.local/bin."""
    text = SCRIPT.read_text()
    assert "command -v uv" not in text
    assert re.search(r"^UV_SHA256=[0-9a-f]{64}$", text, re.M)
    assert "sha256sum -c --quiet" in text


def test_the_pipelines_user_may_run_only_the_posters_head_and_real_drawings() -> None:
    """F5 (50): vxrun's rule allowed every subcommand of the poster."""
    rule = SCRIPT.read_text().split('cat > "$tmp/rule" <<RULE', 1)[1].split("\nRULE\n", 1)[0]
    assert "$LIB/post-status ^head [0-9A-Za-z._-]+\\$" in rule
    assert "$LIB/post-status ^real-drawings [0-9A-Za-z-]+\\$" in rule
    assert not re.search(r"\$LIB/post-status\s*(,|$)", rule, re.M)


def test_root_deletes_nothing_in_the_drafts_folder() -> None:
    """F6 (50): root's rm and rmdir over the drafts could follow a folder swapped for a link."""
    lines = root_lines(SCRIPT.read_text())
    assert not [line for line in lines if re.search(r"\b(rm|rmdir)\b", line) and "DRAFTS" in line]
    body = SCRIPT.read_text()
    assert "as_owner bash -c '" in body
