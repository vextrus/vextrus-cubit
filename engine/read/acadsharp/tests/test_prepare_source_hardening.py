"""prepare-source.sh against the caller's environment and arguments: the breaks the refuter found in
W317's review, each pinned (offline; the synthetic origins of the acceptance tests, every file invented).

Neither break escalated in the owner's root run (sudo resets HOME and strips GIT_* variables, and
toolchain.sh passes no --origin), but the script's promise is that nothing outside its lock and its
arguments shapes what it writes.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

from engine.read.acadsharp.tests.acceptance.w317.test_prepare_source import (
    ACADSHARP_FILES,
    CSUTILITIES_FILES,
    HEADER,
    PATCHED_CS,
    PATCHED_PATH,
    SCRIPT,
    Origins,
    dest,  # noqa: F401 (a fixture)
    files_under,
    nothing_left,
    origins,  # noqa: F401 (a fixture)
    origins_untouched,
    refused,
)


def test_attributes_of_the_callers_home_never_change_the_tree(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    # An attributes file in the caller's configuration folder would rewrite every .cs on checkout.
    home = tmp_path / "home-w317"
    (home / "git").mkdir(parents=True)
    (home / "git" / "attributes").write_text("*.cs ident eol=crlf\n")
    (home / ".gitattributes").write_text("*.cs ident eol=crlf\n")
    origins.environment |= {"XDG_CONFIG_HOME": str(home), "HOME": str(home)}

    done = origins.run(origins.lock(), dest)

    assert done.returncode == 0, done.stderr
    assert files_under(dest / "ACadSharp") == {**ACADSHARP_FILES, PATCHED_PATH: PATCHED_CS}
    assert files_under(dest / "CSUtilities") == CSUTILITIES_FILES


def test_git_variables_of_the_caller_are_not_passed_to_git(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    trace = tmp_path / "w317-trace.log"
    origins.environment |= {"GIT_TRACE": str(trace), "GIT_TRACE2_EVENT": str(trace)}

    done = origins.run(origins.lock(), dest)

    assert done.returncode == 0, done.stderr
    assert not trace.exists()


def test_an_origin_that_is_not_an_https_or_file_url_is_a_usage_error(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    marker = tmp_path / "w317-ran"
    option = f"ACadSharp=--upload-pack=touch {marker}; git-upload-pack {origins.acadsharp}; :"

    done = origins.run(origins.lock(), dest, option, f"CSUtilities=file://{origins.csutilities}")

    assert done.returncode == 2, done.stderr
    assert not marker.exists()
    assert not dest.exists()


def test_a_dest_of_the_root_is_a_usage_error_and_writes_nothing(
    origins: Origins,  # noqa: F811
    tmp_path: Path,
) -> None:
    here = tmp_path / "w317-cwd"
    here.mkdir()
    lock = origins.lock()

    done = subprocess.run(
        ["bash", str(SCRIPT), "--lock", str(lock), "--dest", "/", "--patches", str(origins.patches)],
        capture_output=True, text=True, env=origins.environment, cwd=here, timeout=120,
    )  # fmt: skip

    assert done.returncode == 2, done.stderr
    assert not any(here.iterdir())


def test_a_refused_fetch_prints_one_line(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    hollow = tmp_path / "w317-hollow"
    hollow.mkdir()

    done = origins.run(
        origins.lock(), dest, f"ACadSharp=file://{hollow}", f"CSUtilities=file://{origins.csutilities}"
    )

    assert done.returncode == 3
    lines = done.stderr.splitlines()
    assert len(lines) == 1, lines
    assert lines[0].startswith("prepare-source: refused: fetch: ACadSharp: ")


def moving_patch(verb: str, source: str, target: str) -> str:
    """A patch that renames or copies `source` to `target` whole: git apply's numstat names only
    the new name, so only the summary shows where it came from."""
    return (
        f"{HEADER}diff --git a/{source} b/{target}\n"
        "similarity index 100%\n"
        f"{verb} from {source}\n"
        f"{verb} to {target}\n"
    )


@pytest.mark.parametrize(
    ("verb", "source", "target"),
    [
        ("rename", "LICENSE", "src/ACadSharp/LICENSE"),  # the licence leaves the tree
        ("rename", "src/ACadSharp.Tests/GaugeTests.cs", "src/ACadSharp/GaugeTests.cs"),  # compiled in
        ("copy", "src/ACadSharp.Tests/GaugeTests.cs", "src/ACadSharp/GaugeTests.cs"),
        ("rename", "src/ACadSharp/Things/Plinth.cs", "src/ACadSharp/IO/Plinth.cs"),  # inside, still
    ],
    ids=["licence-in", "tests-in", "copy-in", "inside"],
)
def test_a_patch_that_renames_or_copies_a_file_is_refused(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    verb: str,
    source: str,
    target: str,
) -> None:
    # The pinned patch only edits files in place; a rename or copy is refused whatever its two
    # names, so the check never has to read which name a record holds.
    done = origins.run(origins.lock(moving_patch(verb, source, target)), dest)

    refused(done, "patch-path")
    nothing_left(dest, origins)
    origins_untouched(origins)


# A move with no rename lines: git apply reads the old name from `---` and the new from `+++` (or
# the diff line's two names), so the file at the first name goes and the second is written.
GAUGE_TESTS = "src/ACadSharp.Tests/GaugeTests.cs"
MOVED_TESTS = "src/ACadSharp/GaugeTests.cs"
GAUGE_TESTS_HUNK = (
    "@@ -1,4 +1,4 @@\n"
    " namespace Vx.Sample.Tests\n"
    " {\n"
    "-\tclass GaugeTests { }\n"
    "+\tclass GaugeTests { int moved; }\n"
    " }\n"
)
NAMES_THAT_DIFFER = {
    "diff-line": (
        f"{HEADER}diff --git a/{GAUGE_TESTS} b/{MOVED_TESTS}\n"
        f"--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}"
    ),
    "minus-line": (
        f"{HEADER}diff --git a/{MOVED_TESTS} b/{MOVED_TESTS}\n"
        f"--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}"
    ),
    "traditional": f"{HEADER}--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}",
    "traditional-inside": (
        f"{HEADER}--- a/{PATCHED_PATH}\n+++ b/{PATCHED_PATH}\n"
        "@@ -6,3 +6,3 @@\n \t\t{\n-\t\t\treturn 7.25;\n+\t\t\treturn 1.0;\n \t\t}\n"
    ),
    "link": (
        f"{HEADER}diff --git a/src/ACadSharp/IO/Here.cs b/src/ACadSharp/IO/Here.cs\n"
        "new file mode 120000\n--- /dev/null\n+++ b/src/ACadSharp/IO/Here.cs\n"
        "@@ -0,0 +1 @@\n+../../../LICENSE\n\\ No newline at end of file\n"
    ),
    "link-hidden": (  # git reads the first number on a mode line; a second must not hide it
        f"{HEADER}diff --git a/src/ACadSharp/L b/src/ACadSharp/L\n"
        "new file mode 120000 100644\n--- /dev/null\n+++ b/src/ACadSharp/L\n"
        "@@ -0,0 +1 @@\n+../../LICENSE\n"
    ),
    "submodule-hidden": (
        f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
        "new file mode 160000 100644\n--- /dev/null\n+++ b/src/ACadSharp/Sub\n"
        "@@ -0,0 +1 @@\n+Subproject commit 0123456789012345678901234567890123456789\n"
    ),
    "index-mode": (
        f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
        "new file mode 100644\nindex 0000000..ABCDEF0 160000\n--- /dev/null\n"
        "+++ b/src/ACadSharp/Sub\n@@ -0,0 +1 @@\n+x\n"
    ),
    "submodule": (
        f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
        "new file mode 160000\nindex 0000000..1234567\n--- /dev/null\n+++ b/src/ACadSharp/Sub\n"
        "@@ -0,0 +1 @@\n+Subproject commit 1234567890123456789012345678901234567890\n"
    ),
}


def awks() -> list[str]:
    return [name for name in ("gawk", "mawk") if shutil.which(name)]


@pytest.mark.parametrize("kind", sorted(NAMES_THAT_DIFFER))
@pytest.mark.parametrize("awk", awks())
def test_a_patch_whose_names_differ_or_that_is_not_a_git_diff_of_a_file_is_refused(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
    kind: str,
    awk: str,
) -> None:
    # Every name the patch carries is read by one parser, under each awk this machine has (CI's
    # Ubuntu's is mawk): a move by two different names, with no rename line, is refused like a rename.
    bin_folder = tmp_path / "w317-bin"
    bin_folder.mkdir()
    (bin_folder / "awk").symlink_to(shutil.which(awk) or awk)
    origins.environment |= {"PATH": f"{bin_folder}:{origins.environment['PATH']}"}

    done = origins.run(origins.lock(NAMES_THAT_DIFFER[kind]), dest)

    refused(done, "patch-path")
    nothing_left(dest, origins)
    origins_untouched(origins)


@pytest.mark.parametrize("awk", awks())
def test_the_good_patch_is_read_the_same_by_every_awk(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
    awk: str,
) -> None:
    bin_folder = tmp_path / "w317-bin"
    bin_folder.mkdir()
    (bin_folder / "awk").symlink_to(shutil.which(awk) or awk)
    origins.environment |= {"PATH": f"{bin_folder}:{origins.environment['PATH']}"}

    done = origins.run(origins.lock(), dest)

    assert done.returncode == 0, done.stderr
    assert files_under(dest / "ACadSharp") == {**ACADSHARP_FILES, PATCHED_PATH: PATCHED_CS}
