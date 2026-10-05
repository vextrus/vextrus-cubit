"""prepare-source.sh against the caller's environment and arguments: the breaks the refuter found in
W317's review, each pinned (offline; the synthetic origins of the acceptance tests, every file invented).

Neither break escalated in the owner's root run (sudo resets HOME and strips GIT_* variables, and
toolchain.sh passes no --origin), but the script's promise is that nothing outside its lock and its
arguments shapes what it writes.
"""

import subprocess
from pathlib import Path

from engine.read.acadsharp.tests.acceptance.w317.test_prepare_source import (
    ACADSHARP_FILES,
    CSUTILITIES_FILES,
    PATCHED_CS,
    PATCHED_PATH,
    SCRIPT,
    Origins,
    dest,  # noqa: F401 (a fixture)
    files_under,
    origins,  # noqa: F401 (a fixture)
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
