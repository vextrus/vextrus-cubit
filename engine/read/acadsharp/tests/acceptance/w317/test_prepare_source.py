"""`tools/acadsharp-dump/prepare-source.sh` fetches the two upstream commits the lock pins, checks
each against its manifest, checks the patch against its pin and its paths, and only then exports and
patches; any refusal leaves `--dest` absent or empty (ticket W317, section 3, cases 1-9).

Offline: the origins are local git repositories made in the test's folder, passed with
`--origin NAME=file://...`; every file in them is invented. No toolchain.
"""

import hashlib
import os
import re
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[6]
SCRIPT = ROOT / "tools" / "acadsharp-dump" / "prepare-source.sh"
PATCH_NAME = "w317-invented-change.patch"

READER_CS = b"""namespace Vx.Sample.IO
{
\tinternal static class Gauge
{
\t\tpublic static double Fallback()
\t\t{
\t\t\treturn 7.25;
\t\t}

\t\tpublic static string Label() => "gauge";
\t}
}
"""

ACADSHARP_FILES: dict[str, bytes] = {
    "LICENSE": b"Invented licence text for a test origin.\nPermission is granted, freely.\n",
    "README.md": b"# A stand-in origin\n\nNothing here is upstream's.\n",
    "src/ACadSharp/IO/Gauge.cs": READER_CS,
    "src/ACadSharp/Things/Plinth.cs": b"namespace Vx.Sample.Things\n{\n\tsealed class Plinth { }\n}\n",
    "src/ACadSharp.Tests/GaugeTests.cs": b"namespace Vx.Sample.Tests\n{\n\tclass GaugeTests { }\n}\n",
}
CSUTILITIES_FILES: dict[str, bytes] = {
    "LICENSE": b"Another invented licence, for the second origin.\n",
    "CSUtilities/Strings/Padding.cs": b"namespace Vx.Util\n{\n\tpublic static class Padding { }\n}\n",
    "CSMath/Pair.cs": b"namespace Vx.Maths\n{\n\tpublic readonly struct Pair { }\n}\n",
}
PATCHED_PATH = "src/ACadSharp/IO/Gauge.cs"
PATCHED_CS = READER_CS.replace(b"return 7.25;", b"return 1.0;")
HEADER = (
    "An invented change for W317's acceptance tests: the gauge falls back to 1.\n"
    "Provenance: none; licence: the test origin's.\n\n"
)

ENVIRONMENT = {
    **os.environ,
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_SYSTEM": os.devnull,
    "GIT_TERMINAL_PROMPT": "0",
}


def git(folder: Path, *arguments: str) -> str:
    done = subprocess.run(
        ["git", "-C", str(folder), "-c", "user.email=w317@example.invalid", "-c", "user.name=w317",
         *arguments],
        capture_output=True, text=True, env=ENVIRONMENT, check=True, timeout=60,
    )  # fmt: skip
    return done.stdout


def manifest(files: Mapping[str, bytes]) -> str:
    """The sha256 of `git ls-files -z | LC_ALL=C sort -z | xargs -0 sha256sum`'s text."""
    paths = sorted(files, key=lambda path: path.encode())
    text = "".join(f"{hashlib.sha256(files[path]).hexdigest()}  {path}\n" for path in paths)
    return hashlib.sha256(text.encode()).hexdigest()


def make_origin(folder: Path, files: Mapping[str, bytes]) -> str:
    """A repository at `folder` holding `files` in one commit; returns the commit."""
    folder.mkdir(parents=True)
    git(folder, "init", "-q")
    git(folder, "config", "uploadpack.allowAnySHA1InWant", "true")
    for path, content in files.items():
        (folder / path).parent.mkdir(parents=True, exist_ok=True)
        (folder / path).write_bytes(content)
    git(folder, "add", "--", *files)
    git(folder, "commit", "-q", "-m", "an invented upstream state")
    return git(folder, "rev-parse", "HEAD").strip()


def diff_of(origin: Path, changes: Mapping[str, bytes]) -> str:
    """The `git diff` that turns the origin's files into `changes`; the origin is left as it was."""
    for path, content in changes.items():
        (origin / path).write_bytes(content)
    text = git(origin, "diff", "--", *changes)
    git(origin, "checkout", "-q", "--", *changes)
    return text


@dataclass
class Origins:
    tmp: Path
    acadsharp: Path
    csutilities: Path
    acadsharp_commit: str
    csutilities_commit: str
    patches: Path
    good_patch: str
    environment: dict[str, str]

    def lock(
        self,
        patch: str | bytes | None = None,
        *,
        acadsharp_commit: str | None = None,
        acadsharp_manifest: str | None = None,
        patch_sha256: str | None = None,
    ) -> Path:
        """Write the patch file (the good one unless given) and a lock pinning it and the origins;
        each pin can be overridden. Returns the lock's path."""
        content = patch if patch is not None else self.good_patch
        data = content.encode() if isinstance(content, str) else content
        (self.patches / PATCH_NAME).write_bytes(data)
        lock = self.tmp / "acadsharp-source.lock"
        lock.write_text(
            "# An invented lock: the two origins and one patch, for W317's tests.\n"
            f"source ACadSharp {acadsharp_commit or self.acadsharp_commit} "
            f"{acadsharp_manifest or manifest(ACADSHARP_FILES)}\n"
            f"source CSUtilities {self.csutilities_commit} {manifest(CSUTILITIES_FILES)}\n"
            f"patch {patch_sha256 or hashlib.sha256(data).hexdigest()} {PATCH_NAME}\n",
            encoding="ascii",
        )
        return lock

    def run(self, lock: Path, dest: Path, *origins: str) -> subprocess.CompletedProcess[str]:
        named = origins or (
            f"ACadSharp=file://{self.acadsharp}",
            f"CSUtilities=file://{self.csutilities}",
        )
        arguments = ["--lock", str(lock), "--dest", str(dest), "--patches", str(self.patches)]
        for origin in named:
            arguments += ["--origin", origin]
        return subprocess.run(
            ["bash", str(SCRIPT), *arguments],
            capture_output=True, text=True, env=self.environment, cwd=self.tmp, timeout=120,
        )  # fmt: skip


@pytest.fixture
def origins(tmp_path: Path) -> Origins:
    acadsharp = tmp_path / "origins" / "acadsharp"
    csutilities = tmp_path / "origins" / "csutilities"
    acadsharp_commit = make_origin(acadsharp, ACADSHARP_FILES)
    csutilities_commit = make_origin(csutilities, CSUTILITIES_FILES)
    patches = tmp_path / "patches"
    patches.mkdir()
    good = HEADER + diff_of(acadsharp, {PATCHED_PATH: PATCHED_CS})
    (tmp_path / "tmp").mkdir()  # the script's $TMPDIR, empty again after every run
    return Origins(
        tmp_path, acadsharp, csutilities, acadsharp_commit, csutilities_commit, patches, good,
        {**ENVIRONMENT, "TMPDIR": str(tmp_path / "tmp")},
    )  # fmt: skip


@pytest.fixture
def dest(tmp_path: Path) -> Path:
    (tmp_path / "build").mkdir()
    return tmp_path / "build" / "upstream"


def files_under(folder: Path) -> dict[str, bytes]:
    """Every file under `folder` by its relative path; a link is its target's name, never followed."""
    return {
        path.relative_to(folder).as_posix(): (
            b"link to " + os.readlink(path).encode() if path.is_symlink() else path.read_bytes()
        )
        for path in sorted(folder.rglob("*"))
        if path.is_symlink() or not path.is_dir()
    }


def everything_under(folder: Path) -> list[Path]:
    return sorted(folder.rglob("*"))


def refused(done: subprocess.CompletedProcess[str], *words: str) -> None:
    """Exit 3 and exactly one refusal line, `prepare-source: refused: <word>: <detail>`, naming one
    of `words`."""
    lines = [line for line in done.stderr.splitlines() if "refused:" in line]
    assert done.returncode == 3, (done.returncode, done.stderr)
    assert len(lines) == 1, done.stderr
    found = re.fullmatch(r"prepare-source: refused: ([a-z-]+): \S.*", lines[0])
    assert found is not None, lines[0]
    assert found[1] in words, lines[0]


def nothing_left(dest: Path, origins: Origins) -> None:
    """`dest` absent or empty, and no work area left beside it or in $TMPDIR."""
    assert not dest.exists() or not any(dest.iterdir()), everything_under(dest)
    assert [path.name for path in dest.parent.iterdir()] in ([], [dest.name])
    assert not any((origins.tmp / "tmp").iterdir())


def origins_untouched(origins: Origins) -> None:
    assert {k: v for k, v in files_under(origins.acadsharp).items() if not k.startswith(".git/")} == (
        ACADSHARP_FILES
    )
    assert {
        k: v for k, v in files_under(origins.csutilities).items() if not k.startswith(".git/")
    } == CSUTILITIES_FILES


# -- 1. the good case -----------------------------------------------------------------------------


def test_the_pinned_sources_are_exported_patched_and_without_git(origins: Origins, dest: Path) -> None:
    done = origins.run(origins.lock(), dest)

    assert done.returncode == 0, done.stderr
    assert files_under(dest / "ACadSharp") == {**ACADSHARP_FILES, PATCHED_PATH: PATCHED_CS}
    assert files_under(dest / "CSUtilities") == CSUTILITIES_FILES
    assert not [path for path in everything_under(dest) if path.name == ".git"]
    assert [path.name for path in dest.parent.iterdir()] == [dest.name]  # no work area left
    assert not any((origins.tmp / "tmp").iterdir())
    origins_untouched(origins)


# -- 2. to 8. the refusals ------------------------------------------------------------------------


def test_a_commit_the_origin_does_not_have_is_refused(
    origins: Origins, dest: Path, tmp_path: Path
) -> None:
    elsewhere = make_origin(tmp_path / "elsewhere", {"NOTE.txt": b"a commit no origin holds\n"})

    done = origins.run(origins.lock(acadsharp_commit=elsewhere), dest)

    refused(done, "fetch", "commit")
    nothing_left(dest, origins)


def test_a_tree_that_is_not_the_manifest_is_refused_before_anything_is_patched(
    origins: Origins, dest: Path
) -> None:
    other_tree = {**ACADSHARP_FILES, "src/ACadSharp/Things/Plinth.cs": b"// another tree\n"}

    done = origins.run(origins.lock(acadsharp_manifest=manifest(other_tree)), dest)

    refused(done, "manifest")
    nothing_left(dest, origins)
    origins_untouched(origins)


def test_a_patch_that_is_not_its_pin_is_refused(origins: Origins, dest: Path) -> None:
    lock = origins.lock()
    tampered = origins.good_patch.replace("+\t\t\treturn 1.0;", "+\t\t\treturn 1.5;")
    assert len(tampered) == len(origins.good_patch)
    assert tampered != origins.good_patch
    (origins.patches / PATCH_NAME).write_text(tampered)  # one byte differs from what the lock pins

    done = origins.run(lock, dest)

    refused(done, "patch-hash")
    nothing_left(dest, origins)


def test_a_patch_that_does_not_apply_leaves_no_half_patched_tree(origins: Origins, dest: Path) -> None:
    stale = origins.good_patch.replace("-\t\t\treturn 7.25;", "-\t\t\treturn 7.5;")
    assert stale != origins.good_patch

    done = origins.run(origins.lock(stale), dest)  # its pin is right; its hunk is not the origin's

    refused(done, "patch-apply")
    nothing_left(dest, origins)


def escaping_patches(origins: Origins) -> dict[str, str]:
    climb = (
        "diff --git a/src/ACadSharp/../../../climbed.txt b/src/ACadSharp/../../../climbed.txt\n"
        "new file mode 100644\n"
        "--- /dev/null\n"
        "+++ b/src/ACadSharp/../../../climbed.txt\n"
        "@@ -0,0 +1 @@\n"
        "+out of the tree\n"
    )
    absolute = f"--- /dev/null\n+++ {origins.tmp / 'rooted.txt'}\n@@ -0,0 +1 @@\n+out of the tree\n"
    tests_folder = diff_of(
        origins.acadsharp,
        {
            PATCHED_PATH: PATCHED_CS,
            "src/ACadSharp.Tests/GaugeTests.cs": b"namespace Vx.Sample.Tests\n{\n}\n",
        },
    )
    return {"climb": climb, "absolute": absolute, "sibling": HEADER + tests_folder}


@pytest.mark.parametrize("kind", ["climb", "absolute", "sibling"])
def test_a_patch_that_touches_a_path_outside_the_library_folder_is_refused(
    origins: Origins, dest: Path, kind: str
) -> None:
    # A climb out with `..` (under src/ACadSharp/ by its prefix), an absolute path, and a second file
    # in src/ACadSharp.Tests/, whose name begins as the library folder's does: each pinned right.
    patch = escaping_patches(origins)[kind]

    done = origins.run(origins.lock(patch), dest)

    refused(done, "patch-path")
    nothing_left(dest, origins)
    assert not [path for path in origins.tmp.rglob("*") if path.name in {"climbed.txt", "rooted.txt"}]
    origins_untouched(origins)


def test_a_dest_that_holds_a_file_is_a_usage_error_and_is_left_alone(
    origins: Origins, dest: Path
) -> None:
    dest.mkdir()
    (dest / "keep.txt").write_bytes(b"someone else's\n")

    done = origins.run(origins.lock(), dest)

    assert done.returncode == 2, done.stderr
    assert files_under(dest) == {"keep.txt": b"someone else's\n"}


def test_an_origin_that_is_not_a_repository_is_refused(
    origins: Origins, dest: Path, tmp_path: Path
) -> None:
    hollow = tmp_path / "origins" / "hollow"
    hollow.mkdir()

    done = origins.run(
        origins.lock(), dest, f"ACadSharp=file://{hollow}", f"CSUtilities=file://{origins.csutilities}"
    )

    refused(done, "fetch")
    nothing_left(dest, origins)


# -- 9. the same pins give the same tree ----------------------------------------------------------


def test_two_runs_give_the_same_tree(origins: Origins, tmp_path: Path) -> None:
    lock = origins.lock()
    trees = []
    for name in ("first", "second"):
        (tmp_path / name).mkdir()
        done = origins.run(lock, tmp_path / name / "upstream")
        assert done.returncode == 0, done.stderr
        trees.append(files_under(tmp_path / name / "upstream"))

    assert trees[0] == trees[1]
    assert manifest(trees[0]) == manifest(trees[1])
    assert trees[0]


# -- the seam's own rule: work areas are removed by naming files --------------------------------


def test_the_script_holds_no_recursive_delete() -> None:
    code = [line for line in SCRIPT.read_text().splitlines() if not line.lstrip().startswith("#")]
    recursive = re.compile(r"\brm\b[^|;&]*\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b|\s-delete\b")

    assert code
    assert not [line for line in code if recursive.search(line)]
