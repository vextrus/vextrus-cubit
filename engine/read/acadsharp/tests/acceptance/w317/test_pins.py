"""The pins and the one code path, read from the tree (ticket W317, section 3, cases 15-18): the source
lock names ACadSharp 3.8.0's commit and its CSUtilities submodule's, the patch is #1205's DWG scale
repair and nothing more, the dumper compiles that source instead of the NuGet package, and the owner's
toolchain script and the tests' build both prepare it with `prepare-source.sh`. No toolchain.
"""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
DUMPER = ROOT / "tools" / "acadsharp-dump"
LOCK = ROOT / "toolchain" / "acadsharp-source.lock"
PATCHES = DUMPER / "patches"
IN_TREE = DUMPER / "acadsharp" / "ACadSharp.csproj"
TOOLCHAIN_SH = ROOT / "scripts" / "owner" / "toolchain.sh"
TEST_BUILD = ROOT / "engine" / "read" / "acadsharp" / "tests" / "build.py"

ACADSHARP_3_8_0 = "3a1c66b9932f9e2dbfbbf3f03660c97d52e49b02"
CSUTILITIES_AT_3_8_0 = "b1f53ee2c68143173100d031adcdb275f524aea9"
READER_FILE = "src/ACadSharp/IO/DWG/DwgStreamReaders/DwgObjectReader.cs"
HEX64 = re.compile(r"[0-9a-f]{64}")


def records() -> list[list[str]]:
    """The lock's records: `#` starts a comment, fields split on spaces, empty lines skipped."""
    found = []
    for line in LOCK.read_text(encoding="ascii").splitlines():
        fields = line.split("#", 1)[0].split()
        if fields:
            found.append(fields)
    return found


def patch_record() -> tuple[str, str]:
    patches = [fields for fields in records() if fields[0] == "patch"]
    assert len(patches) == 1, patches
    assert len(patches[0]) == 3, patches[0]
    return patches[0][1], patches[0][2]


def patch_text() -> str:
    return (PATCHES / patch_record()[1]).read_text(encoding="utf-8")


def without_comments(xml: str) -> str:
    return re.sub(r"<!--.*?-->", "", xml, flags=re.DOTALL)


def property_values(project: Path, name: str) -> list[str]:
    return re.findall(rf"<{name}>([^<]*)</{name}>", without_comments(project.read_text()))


def function(script: str, name: str) -> str:
    start = script.index(f"{name}() {{")
    return script[start : script.index("\n}\n", start) + 2]


def code_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if not line.lstrip().startswith("#")]


# -- 15. the lock ---------------------------------------------------------------------------------


def test_the_source_lock_pins_the_two_upstream_commits_and_the_patch_by_hash() -> None:
    sources = {fields[1]: fields[2:] for fields in records() if fields[0] == "source"}
    digest, name = patch_record()

    assert sorted(sources) == ["ACadSharp", "CSUtilities"]
    assert len([fields for fields in records() if fields[0] == "source"]) == 2
    assert sources["ACadSharp"][0] == ACADSHARP_3_8_0
    assert sources["CSUtilities"][0] == CSUTILITIES_AT_3_8_0
    assert all(len(pins) == 2 and HEX64.fullmatch(pins[1]) for pins in sources.values()), sources
    assert HEX64.fullmatch(digest)
    assert "/" not in name
    assert (PATCHES / name).is_file()
    assert hashlib.sha256((PATCHES / name).read_bytes()).hexdigest() == digest
    assert {fields[0] for fields in records()} == {"source", "patch"}


# -- 16. the patch is #1205's DWG scale repair, nothing else ------------------------------------


def test_the_patch_touches_only_the_dwg_object_reader() -> None:
    text = patch_text()
    touched = set(re.findall(r"^diff --git a/(\S+) b/(\S+)$", text, flags=re.MULTILINE))
    headers = re.findall(r"^(?:---|\+\+\+) (\S+)", text, flags=re.MULTILINE)

    assert touched == {(READER_FILE, READER_FILE)}
    assert set(headers) == {f"a/{READER_FILE}", f"b/{READER_FILE}"}


def test_the_patch_leaves_out_the_mtext_and_dxf_halves_of_1205() -> None:
    text = patch_text()

    assert "BackgroundTransparency" not in text
    assert "DxfSectionReaderBase" not in text


def test_the_patch_names_its_provenance_and_licence_in_a_header() -> None:
    text = patch_text()
    header = text[: text.index("diff --git ")]

    assert "DomCR/ACadSharp#1205" in header
    assert "MIT" in header
    assert "Albert Domenech" in header


def test_the_patch_is_small() -> None:
    lines = patch_text()[patch_text().index("diff --git ") :].splitlines()
    added = [line for line in lines if line.startswith("+") and not line.startswith("+++ ")]
    removed = [line for line in lines if line.startswith("-") and not line.startswith("--- ")]

    assert 0 < len(added) <= 70
    assert 0 < len(removed) <= 20


# -- 17. the dumper compiles the prepared source, not the package -------------------------------


def test_the_dumper_references_the_in_tree_project_and_no_acadsharp_package() -> None:
    project = without_comments((DUMPER / "acadsharp-dump.csproj").read_text())

    assert not re.search(r"<PackageReference\s+Include=\"ACadSharp\"", project, flags=re.IGNORECASE)
    assert re.search(r"<ProjectReference\s+Include=\"acadsharp[/\\]ACadSharp\.csproj\"", project)
    assert IN_TREE.is_file()


def test_the_dumpers_lock_lists_no_acadsharp_package() -> None:
    lock = json.loads((DUMPER / "packages.lock.json").read_text())
    entries = [
        entry
        for group in lock["dependencies"].values()
        for name, entry in group.items()
        if name.lower() == "acadsharp"
    ]

    assert all(entry.get("type") == "Project" for entry in entries), entries
    assert not [entry for entry in entries if "contentHash" in entry or "resolved" in entry]


def test_both_projects_keep_the_reproducible_build_settings() -> None:
    for project in (DUMPER / "acadsharp-dump.csproj", IN_TREE):
        assert property_values(project, "RestoreLockedMode") == ["true"], project.name
        assert property_values(project, "EnableSourceControlManagerQueries") == ["false"]
        assert property_values(project, "Deterministic") == ["true"], project.name
        assert [value for value in property_values(project, "PathMap") if value.strip()]


def test_the_in_tree_project_builds_one_acadsharp_assembly_for_net10() -> None:
    assert property_values(IN_TREE, "TargetFramework") == ["net10.0"]
    assert property_values(IN_TREE, "TargetFrameworks") == []
    assert property_values(IN_TREE, "AssemblyName") == ["ACadSharp"]


# -- 18. one code path ---------------------------------------------------------------------------


def test_toolchain_sh_prepares_the_pinned_source_before_it_restores() -> None:
    body = function(TOOLCHAIN_SH.read_text(), "install_acadsharp_dump")
    code = code_lines(body)
    prepare = [line for line in code if "prepare-source.sh" in line]

    assert prepare
    assert '--lock "$PINS/acadsharp-source.lock"' in "\n".join(code)
    assert body.index("prepare-source.sh") < body.index("dotnet_here restore")
    called = re.compile(r"(?:^|[;&|(!`]|\bthen|\bdo|\bif)\s*(?:\w+=\S*\s+)*(?:git|curl|wget)(?![\w.-])")
    assert [line for line in code if called.search(line)] == []


def test_toolchain_sh_installs_each_pin_in_a_folder_of_its_own_and_removes_none() -> None:
    # The orchestrator's addendum: the new dumper goes beside the old, in a folder named by the first
    # 12 hex digits of its pin; the only thing the function deletes is its own build folder.
    body = function(TOOLCHAIN_SH.read_text(), "install_acadsharp_dump")
    removals = [line.strip() for line in code_lines(body) if re.search(r"(?<![\w.-])rm\s", line)]

    assert re.search(r'"\$PREFIX/acadsharp-dump/\$\{(?:pinned|built):0:12\}', body)
    assert removals
    assert set(removals) == {'rm -rf -- "$build"'}


def test_the_tests_build_prepares_the_source_with_the_same_script() -> None:
    assert "prepare-source.sh" in TEST_BUILD.read_text()


def test_the_dumpers_project_names_the_source_lock() -> None:
    comments = re.findall(r"<!--.*?-->", (DUMPER / "acadsharp-dump.csproj").read_text(), re.DOTALL)

    assert any("acadsharp-source.lock" in comment for comment in comments)
