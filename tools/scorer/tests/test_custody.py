"""scripts/owner/keys-custody.sh (and drop-setup.sh), which the owner runs as root. Nothing here raises
privilege: the script's own functions are sourced into bash as the test's user, with `as_owner` running
as that user and `install` without its owner flags, and called on invented drafts; its root-only steps
are checked by what the script says (its syntax, its lists, its rule). Invented files only."""

import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import pytest

from scripts.real_drawings import runner

OWNER_SCRIPTS = Path(__file__).resolve().parents[3] / "scripts" / "owner"
SCRIPT = OWNER_SCRIPTS / "keys-custody.sh"
DRAFT = b'{"set": "invented-set", "files": {}, "sheets": [{"number": "QZ-CONFIRMED"}]}'

# As the test's user: the script's functions, with as_owner running as this user and install dropping
# its owner flags (only root may give a file away).
STUBS = """
as_owner() { "$@"; }
install() {
  local args=()
  while (($#)); do case $1 in -o|-g) shift 2 ;; *) args+=("$1"); shift ;; esac; done
  command install "${args[@]}"
}
"""


def custody(tmp_path: Path, body: str) -> subprocess.CompletedProcess[str]:
    """Runs `body` in bash after sourcing the script, its places moved under `tmp_path`."""
    places = (
        f"DRAFTS={tmp_path}/keys-draft; KEY_DIR={tmp_path}/keys; tmp={tmp_path}/tmp;"
        ' KEY_USER="$(id -un)"'
    )
    (tmp_path / "keys").mkdir(exist_ok=True)
    (tmp_path / "tmp").mkdir(exist_ok=True)
    script = f"source {SCRIPT}\n{STUBS}\n{places}\n{body}\n"
    return subprocess.run(["bash", "-c", script], capture_output=True, text=True, check=False)


def a_draft(tmp_path: Path, data: bytes = DRAFT) -> Path:
    folder = tmp_path / "keys-draft"
    folder.mkdir(exist_ok=True)
    draft = folder / "invented-set.json"
    draft.write_bytes(data)
    return draft


def test_the_script_parses() -> None:
    for script in (SCRIPT, OWNER_SCRIPTS / "drop-setup.sh"):
        done = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True, check=False)
        assert done.returncode == 0, done.stderr


@pytest.mark.skipif(shutil.which("shellcheck") is None, reason="no shellcheck here")
def test_shellcheck_finds_nothing() -> None:
    done = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stdout


# The refuter of fix round 1 (85): bash reads a script as it runs it, so a change your user made to the
# file while root waited at a prompt was run as root.


def waits_then_runs(script: Path, tmp_path: Path) -> str:
    """Starts `script`, changes its file while it waits at its prompt, then answers; its output."""
    started = subprocess.Popen(
        ["bash", str(script)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True
    )
    time.sleep(0.3)
    with script.open("a") as file:
        file.write(f"echo INJECTED > {tmp_path / 'ran'}\n")
    out, _ = started.communicate("y\n", timeout=10)
    return out


def test_a_change_to_a_running_script_is_run_without_main_and_never_with_it(tmp_path: Path) -> None:
    bare = tmp_path / "bare.sh"
    bare.write_text('read -r -p "Go on? " reply\necho answered\n')
    waits_then_runs(bare, tmp_path)
    assert (tmp_path / "ran").exists()  # the control: a script run line by line runs the change

    (tmp_path / "ran").unlink()
    wrapped = tmp_path / "wrapped.sh"
    wrapped.write_text(
        'main() {\n  read -r -p "Go on? " reply\n  echo answered\n}\n'
        'if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then\n  main "$@"\n  exit\nfi\n'
    )
    assert "answered" in waits_then_runs(wrapped, tmp_path)
    assert not (tmp_path / "ran").exists()


@pytest.mark.parametrize("name", ["keys-custody.sh", "drop-setup.sh"])
def test_the_owners_root_scripts_run_every_step_inside_main(name: str) -> None:
    text = (OWNER_SCRIPTS / name).read_text()
    start = text.index("\nmain() {\n")
    end = text.index("\n}\n", start)
    body_after = text[end + 3 :]
    assert re.fullmatch(
        r"\s*(# [^\n]*\n)*"
        r'(if \[\[ "\$\{BASH_SOURCE\[0\]\}" == "\$0" \]\]; then\n  main "\$@"\n  exit\nfi'
        r'|main "\$@"\nexit)\n',
        body_after,
    ), body_after
    before = text[:start]
    assert not re.search(r"^(step|read|confirm|sudo|install|chown|chmod|rm|mv) ", before, re.M)


# The refuter of fix round 1: F2 (70) a draft that was a link, R2 (75) a draft written through a handle
# kept open, R3 (60) a draft changed between its check and the owner's confirm: each reached custody.


def test_the_key_is_the_copy_that_was_checked_whatever_the_draft_becomes(tmp_path: Path) -> None:
    draft = a_draft(tmp_path)
    kept = os.open(draft, os.O_WRONLY)  # a handle your user opened before custody
    try:
        done = custody(
            tmp_path,
            f"snapshot_draft invented-set\n"
            f"printf 'changed after the check' > {draft}\n"  # between the check and the confirm
            f"take_key invented-set",
        )
        assert done.returncode == 0, done.stdout + done.stderr
        os.write(kept, b"written through the kept handle")
    finally:
        os.close(kept)

    key = tmp_path / "keys" / "invented-set.json"
    assert key.read_bytes() == DRAFT
    assert key.stat().st_ino != draft.stat().st_ino
    assert oct(key.stat().st_mode & 0o777) == "0o600"


def test_a_draft_that_is_a_link_is_never_taken(tmp_path: Path) -> None:
    elsewhere = tmp_path / "owners-file.json"
    elsewhere.write_bytes(DRAFT)
    (tmp_path / "keys-draft").mkdir()
    (tmp_path / "keys-draft" / "invented-set.json").symlink_to(elsewhere)

    done = custody(tmp_path, "snapshot_draft invented-set && take_key invented-set")

    assert done.returncode != 0
    assert "a link is never taken" in done.stdout
    assert not (tmp_path / "keys" / "invented-set.json").exists()


def test_a_key_already_in_custody_is_never_replaced(tmp_path: Path) -> None:
    a_draft(tmp_path)
    (tmp_path / "keys").mkdir()
    (tmp_path / "keys" / "invented-set.json").write_bytes(b"the key in custody")

    done = custody(tmp_path, "snapshot_draft invented-set && take_key invented-set")

    assert done.returncode != 0
    assert (tmp_path / "keys" / "invented-set.json").read_bytes() == b"the key in custody"


def test_the_drafts_are_removed_by_name_and_no_link_is_followed(tmp_path: Path) -> None:
    """F6 (50): root's deletes over the drafts could follow a folder swapped for a link."""
    a_draft(tmp_path)
    (tmp_path / "keys-draft" / "per-file" / "deep").mkdir(parents=True)
    (tmp_path / "keys-draft" / "per-file" / "deep" / "one.json").write_text("{}")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "keep.txt").write_text("not a draft")
    (tmp_path / "keys-draft" / "linked").symlink_to(outside, target_is_directory=True)

    done = custody(tmp_path, "remove_drafts")

    assert done.returncode == 0, done.stdout + done.stderr
    assert not (tmp_path / "keys-draft").exists()
    assert (outside / "keep.txt").read_text() == "not a draft"


# What only root can run is checked by what the script says.


def root_lines(text: str) -> list[str]:
    """The script's lines run as root: not a comment, not through `as_owner` (a whole `as_owner bash
    -c '...'` block included)."""
    text = re.sub(r"(?s)as_owner bash -c '.*?'[^\n]*", "as_owner", text)
    return [
        line
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#") and "as_owner" not in line
    ]


def test_it_installs_exactly_the_files_the_runner_checks_against_mains() -> None:
    block = re.search(r"(?s)^RUNNER_FILES=\((.*?)^\)", SCRIPT.read_text(), re.M)
    assert block is not None
    assert tuple(block.group(1).split()) == runner.FILES


def test_root_changes_no_owner_of_a_file_through_a_link() -> None:
    """F1 (70): root's chown followed a lock your user had made a link to /etc/passwd."""
    lines = root_lines(SCRIPT.read_text())
    chowns = [line for line in lines if re.search(r"\bchown\b", line)]
    assert chowns
    assert all(re.search(r"\bchown\s+(-R\s+)?-h\b", line) for line in chowns), chowns
    text = SCRIPT.read_text()
    assert text.index('chown -h "$RUN_USER:$KEY_GROUP" "$DROP"') < text.index('rm -f -- "$DROP/.lock"')
    assert not any(re.search(r"\b(chmod|chown)\b.*\.lock", line) for line in lines)
    assert not any(re.search(r"\bmv\b", line) for line in lines)  # the draft is copied, never moved


def test_root_deletes_nothing_in_the_drafts_folder() -> None:
    lines = root_lines(SCRIPT.read_text())
    assert not [line for line in lines if re.search(r"\b(rm|rmdir)\b", line) and "DRAFTS" in line]


def test_everything_installed_is_githubs_main_never_your_checkouts() -> None:
    """F4 (65) and its refuter (70): main came from your checkout's ref, vouched for by a poster
    installed from your working tree; uv from your ~/.local/bin."""
    text = SCRIPT.read_text()
    assert 'from_main() { git -C "$MAIN_REPO" show' in text
    assert 'git -C "$ROOT" show' not in text
    assert not re.search(r"\$ROOT/(tools|scripts)/", text)
    assert '"$(git -C "$MAIN_REPO" rev-parse refs/heads/main)" = "$github_main"' in text
    assert "api.github.com/repos/$REPOSITORY/commits/main/status" in text
    assert 'from_main scripts/owner/post-status > "$tmp/post-status"' in text
    assert 'from_main scripts/owner/post-status.toml > "$tmp/post-status.toml"' in text
    assert "command -v uv" not in text
    assert re.search(r"^UV_SHA256=[0-9a-f]{64}$", text, re.M)
    # The App's JWT and token go to curl in root's files, never on a command line.
    assert all("Bearer" not in line or "printf" in line or "sed" in line for line in text.splitlines())


def test_drop_setup_never_installs_the_poster_once_the_pipelines_user_exists() -> None:
    text = (OWNER_SCRIPTS / "drop-setup.sh").read_text()
    refusal = text.index('if id "$(setting writer)"')
    assert refusal < text.index('sudo install -o root -g root -m 0755 "$root/scripts/owner/post-status"')


def test_the_pipelines_user_may_run_only_the_posters_head_and_real_drawings() -> None:
    """F5 (50): vxrun's rule allowed every subcommand of the poster."""
    rule = SCRIPT.read_text().split('cat > "$tmp/rule" <<RULE', 1)[1].split("\nRULE\n", 1)[0]
    assert "$LIB/post-status ^head [0-9A-Za-z._-]+\\$" in rule
    assert "$LIB/post-status ^real-drawings [0-9A-Za-z-]+\\$" in rule
    assert not re.search(r"\$LIB/post-status\s*(,|$)", rule, re.M)


def test_its_paths_are_the_runners_and_the_scorers() -> None:
    text = SCRIPT.read_text()
    for path in (runner.RUNNER, runner.INSTALLED, runner.SPOOL, runner.HOME, runner.BIN, runner.SCORER):
        assert str(path).rsplit("/", 1)[-1] in text, path
    assert f"RUN_USER={runner.RUNNER_USER}" in text
