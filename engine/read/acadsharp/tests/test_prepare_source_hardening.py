"""prepare-source.sh against the caller's environment and arguments: the breaks the refuter found in
W317's review, each pinned (offline; the synthetic origins of the acceptance tests, every file invented).

Neither break escalated in the owner's root run (sudo resets HOME and strips GIT_* variables, and
toolchain.sh passes no --origin), but the script's promise is that nothing outside its lock and its
arguments shapes what it writes.
"""

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
    """A patch that renames or copies `source` to `target` whole."""
    return (
        f"{HEADER}diff --git a/{source} b/{target}\n"
        "similarity index 100%\n"
        f"{verb} from {source}\n"
        f"{verb} to {target}\n"
    )


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
DEV_NULL_HUNK = "@@ -0,0 +1 @@\n+x\n"

# Every patch the review rounds found or tried: each changes, as git applies it, a path outside
# src/ACadSharp/ or makes a link or a submodule; the rule judges what git did, so each is refused
# however the patch spells it. (The word, and the case.)
REFUSED: dict[str, tuple[str, str]] = {
    "rename-licence-in": ("patch-path", moving_patch("rename", "LICENSE", "src/ACadSharp/LICENSE")),
    "rename-tests-in": ("patch-path", moving_patch("rename", GAUGE_TESTS, MOVED_TESTS)),
    "move-by-diff-line": (
        "patch-path",
        (
            f"{HEADER}diff --git a/{GAUGE_TESTS} b/{MOVED_TESTS}\n"
            f"--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}"
        ),
    ),
    "move-by-minus-line": (
        "patch-path",
        (
            f"{HEADER}diff --git a/{MOVED_TESTS} b/{MOVED_TESTS}\n"
            f"--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}"
        ),
    ),
    # git reads a traditional patch's two names as two files and finds no second: it never applies.
    "move-traditional": (
        "patch-apply",
        f"{HEADER}--- a/{GAUGE_TESTS}\n+++ b/{MOVED_TESTS}\n{GAUGE_TESTS_HUNK}",
    ),
    # /dev/null is no file only where git says so; otherwise it writes dev/null at the tree's root.
    "dev-null-traditional": ("patch-path", f"{HEADER}--- /dev/null\n+++ /dev/null\n{DEV_NULL_HUNK}"),
    "dev-null-git": (
        "patch-path",
        (
            f"{HEADER}diff --git a/dev/null b/dev/null\nnew file mode 100644\n"
            f"--- /dev/null\n+++ b/dev/null\n{DEV_NULL_HUNK}"
        ),
    ),
    "link": (
        "patch-path",
        (
            f"{HEADER}diff --git a/src/ACadSharp/IO/Here.cs b/src/ACadSharp/IO/Here.cs\n"
            "new file mode 120000\n--- /dev/null\n+++ b/src/ACadSharp/IO/Here.cs\n"
            "@@ -0,0 +1 @@\n+../../../LICENSE\n\\ No newline at end of file\n"
        ),
    ),
    "link-hidden": (  # git reads the first number on a mode line
        "patch-path",
        (
            f"{HEADER}diff --git a/src/ACadSharp/L b/src/ACadSharp/L\n"
            "new file mode 120000 100644\n--- /dev/null\n+++ b/src/ACadSharp/L\n"
            "@@ -0,0 +1 @@\n+../../LICENSE\n"
        ),
    ),
    "submodule": (
        "patch-path",
        (
            f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
            "new file mode 160000\nindex 0000000..1234567\n--- /dev/null\n+++ b/src/ACadSharp/Sub\n"
            "@@ -0,0 +1 @@\n+Subproject commit 1234567890123456789012345678901234567890\n"
        ),
    ),
    "submodule-hidden": (
        "patch-path",
        (
            f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
            "new file mode 160000 100644\n--- /dev/null\n+++ b/src/ACadSharp/Sub\n"
            "@@ -0,0 +1 @@\n+Subproject commit 0123456789012345678901234567890123456789\n"
        ),
    ),
}

PLINTH = "src/ACadSharp/Things/Plinth.cs"
# What round 2's parser refused by the patch's form, and git applies to library files only: by the
# outcome they are accepted, and the tree is exactly what git wrote.
ACCEPTED: dict[str, tuple[str, dict[str, bytes]]] = {
    # A copy into the library deletes nothing outside it: its outcome is a new library file, the same
    # as a patch adding those bytes itself, which any patch may do.
    "copy-tests-in": (
        moving_patch("copy", GAUGE_TESTS, MOVED_TESTS),
        {**ACADSHARP_FILES, MOVED_TESTS: ACADSHARP_FILES[GAUGE_TESTS]},
    ),
    "rename-inside": (
        moving_patch("rename", PLINTH, "src/ACadSharp/IO/Plinth.cs"),
        {
            **{k: v for k, v in ACADSHARP_FILES.items() if k != PLINTH},
            "src/ACadSharp/IO/Plinth.cs": ACADSHARP_FILES[PLINTH],
        },
    ),
    "traditional-inside": (
        (
            f"{HEADER}--- a/{PATCHED_PATH}\n+++ b/{PATCHED_PATH}\n"
            "@@ -6,3 +6,3 @@\n \t\t{\n-\t\t\treturn 7.25;\n+\t\t\treturn 1.0;\n \t\t}\n"
        ),
        {**ACADSHARP_FILES, PATCHED_PATH: PATCHED_CS},
    ),
    "link-mode-on-index-line-only": (  # git records the mode line's 100644, not the index line's
        (
            f"{HEADER}diff --git a/src/ACadSharp/Sub b/src/ACadSharp/Sub\n"
            "new file mode 100644\nindex 0000000..ABCDEF0 160000\n--- /dev/null\n"
            "+++ b/src/ACadSharp/Sub\n@@ -0,0 +1 @@\n+x\n"
        ),
        {**ACADSHARP_FILES, "src/ACadSharp/Sub": b"x\n"},
    ),
}


def without_awk(origins: Origins, tmp_path: Path) -> Path:  # noqa: F811
    """Put a stand-in for every awk first on the script's PATH: each records that it ran and fails.
    Returns the record's path (absent while no awk ran)."""
    record = tmp_path / "w317-awk-ran"
    folder = tmp_path / "w317-no-awk"
    folder.mkdir()
    for name in ("awk", "gawk", "mawk", "nawk"):
        stand_in = folder / name
        stand_in.write_text(f"#!/bin/sh\necho {name} >> '{record}'\nexit 99\n")
        stand_in.chmod(0o755)
    origins.environment |= {"PATH": f"{folder}:{origins.environment['PATH']}"}
    return record


@pytest.mark.parametrize("shell", ["with-awk", "awk-free"])
@pytest.mark.parametrize("kind", sorted(REFUSED))
def test_a_patch_whose_outcome_leaves_the_library_or_makes_a_link_is_refused(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
    kind: str,
    shell: str,
) -> None:
    record = without_awk(origins, tmp_path) if shell == "awk-free" else tmp_path / "absent"
    word, patch = REFUSED[kind]

    done = origins.run(origins.lock(patch), dest)

    refused(done, word)
    nothing_left(dest, origins)
    origins_untouched(origins)
    assert not record.exists()
    assert not [path for path in tmp_path.rglob("null") if path.parent.name == "dev"]


@pytest.mark.parametrize("shell", ["with-awk", "awk-free"])
@pytest.mark.parametrize("kind", sorted(ACCEPTED))
def test_a_patch_that_changes_only_library_files_is_applied_as_git_applies_it(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
    kind: str,
    shell: str,
) -> None:
    record = without_awk(origins, tmp_path) if shell == "awk-free" else tmp_path / "absent"
    patch, tree = ACCEPTED[kind]

    done = origins.run(origins.lock(patch), dest)

    assert done.returncode == 0, done.stderr
    assert files_under(dest / "ACadSharp") == tree
    assert not record.exists()


def test_the_good_patch_needs_no_awk(
    origins: Origins,  # noqa: F811
    dest: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    record = without_awk(origins, tmp_path)

    done = origins.run(origins.lock(), dest)

    assert done.returncode == 0, done.stderr
    assert files_under(dest / "ACadSharp") == {**ACADSHARP_FILES, PATCHED_PATH: PATCHED_CS}
    assert not record.exists()
