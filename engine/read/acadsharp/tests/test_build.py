"""The dumper built from the tree is the pinned build, ships only MIT code, and reads in the sandbox.

    uv run --no-sync pytest -m "needs_toolchain or needs_bwrap" engine/read/acadsharp

Built with the pinned SDK (/opt/vextrus/dotnet) and a NuGet cache of its own, as
scripts/owner/toolchain.sh builds it. The locked restore and the pin are checked everywhere.
"""

import hashlib
import json
import re
import subprocess
from collections.abc import Callable
from pathlib import Path

import pytest

from engine.fixtures.dwg import dotnet
from engine.read import acadsharp
from engine.read.acadsharp import DumperStopped, DumpTooLarge
from engine.read.acadsharp.tests.build import (
    RUNTIME_PACK,
    RUNTIME_PIN,
    SOURCE,
    RuntimePackNotPinned,
    build_dumper,
)

Fixture = Callable[..., Path]


def test_every_package_is_restored_by_the_hash_its_lock_pins() -> None:
    project = (SOURCE / "acadsharp-dump.csproj").read_text()
    lock = json.loads((SOURCE / "packages.lock.json").read_text())

    assert "<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>" in project
    assert "<RestoreLockedMode>true</RestoreLockedMode>" in project
    assert '<PackageReference Include="ACadSharp" Version="[3.8.0]" />' in project
    packages = {name: entry for group in lock["dependencies"].values() for name, entry in group.items()}
    assert packages["ACadSharp"]["resolved"] == "3.8.0"
    assert all(entry["contentHash"] for entry in packages.values())


def test_the_project_stamps_no_git_state_and_fetches_only_what_ships() -> None:
    project = (SOURCE / "acadsharp-dump.csproj").read_text()

    # Inside a git work tree, Source Link would stamp HEAD into the version (measured: another hash).
    assert "<EnableSourceControlManagerQueries>false</EnableSourceControlManagerQueries>" in project
    assert "<DisableTransitiveFrameworkReferenceDownloads>true<" in project  # no ASP.NET pack
    assert "<UseSharedCompilation>false</UseSharedCompilation>" in project  # no compiler server left


def test_toolchain_sh_installs_the_dumper_only_at_its_pin() -> None:
    script = (SOURCE.parents[1] / "scripts" / "owner" / "toolchain.sh").read_text()
    body = script[script.index("install_acadsharp_dump() {") :]

    assert 'build=$(mktemp -d "$PREFIX/' in body  # never under /tmp, which anyone can write
    assert 'TMPDIR="$build/tmp"' in body  # nor its temporary files
    assert "-noAutoResponse -nodeReuse:false -p:ImportDirectoryBuildProps=false" in body
    assert "-p:ImportDirectoryBuildTargets=false -p:ImportDirectoryPackagesProps=false" in body
    assert "global.json" in body
    # Restored, the runtime pack checked, and only then built from what was checked.
    restored = body.index("dotnet_here restore")
    checked_pack = body.index('sha512sum -c --quiet "$PINS/acadsharp-dump.runtime.sha512"')
    built = body.index('dotnet_here publish -c Release -o "$out" --no-restore')
    assert restored < checked_pack < built
    checked = body.index('if [ "$built" != "$pinned" ]')
    assert checked < body.index('install -m 0755 "$out/acadsharp-dump"')


def test_the_runtime_pack_pin_names_the_pack_by_a_sha512() -> None:
    digest, name = RUNTIME_PIN.read_text().split()

    assert re.fullmatch(r"[0-9a-f]{128}", digest)
    assert re.fullmatch(rf"{RUNTIME_PACK}\.10\.0\.\d+\.nupkg", name)


def test_the_sdk_is_the_pinned_one_and_never_rolls_forward() -> None:
    sdk = json.loads((SOURCE / "global.json").read_text())["sdk"]
    pinned = (SOURCE.parents[1] / "toolchain" / "dotnet.version").read_text().strip()

    assert sdk == {"version": pinned, "rollForward": "disable"}


@pytest.mark.needs_toolchain
def test_the_build_from_the_tree_is_the_pinned_build_byte_for_byte(dumper_prefix: Path) -> None:
    built = hashlib.sha256((dumper_prefix / "acadsharp-dump").read_bytes()).hexdigest()

    assert built == acadsharp.pinned_sha256(), (
        "the dumper built from tools/acadsharp-dump/ is not the pin: after changing its source, its "
        "lock or toolchain/dotnet.version, write the new sha256 into toolchain/acadsharp-dump.sha256; "
        "if the source did not change, the build is not reproducible on this machine"
    )


@pytest.mark.needs_toolchain
def test_the_runtime_pack_pinned_is_the_one_the_pinned_sdk_bundles() -> None:
    sdk = (SOURCE / "global.json").read_text()
    version = json.loads(sdk)["sdk"]["version"]
    bundled = (
        dotnet().parent / "sdk" / version / "Microsoft.NETCoreSdk.BundledVersions.props"
    ).read_text()
    runtime = re.findall(
        r'TargetFramework="net10\.0"[^>]*LatestRuntimeFrameworkVersion="([^"]+)"', bundled
    )

    pinned = re.fullmatch(rf"{RUNTIME_PACK}\.(.+)\.nupkg", RUNTIME_PIN.read_text().split()[1])

    assert pinned is not None
    assert runtime
    assert set(runtime) == {pinned[1]}


@pytest.mark.needs_toolchain
def test_the_build_inside_a_git_work_tree_is_still_the_pin(tmp_path: Path) -> None:
    # The owner's checkout is a git work tree: the build must not read it (finding 1 of #79's review).
    repository = tmp_path / "work-tree"
    repository.mkdir()
    git = ["git", "-C", str(repository), "-c", "user.email=t@example.invalid", "-c", "user.name=t"]
    subprocess.run([*git, "init", "-q"], check=True)
    subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "a commit"], check=True)

    prefix = build_dumper(repository / "build")

    built = hashlib.sha256((prefix / "acadsharp-dump").read_bytes()).hexdigest()
    assert built == acadsharp.pinned_sha256()


@pytest.mark.needs_toolchain
def test_a_runtime_pack_that_is_not_the_pin_stops_the_build_before_it_builds(tmp_path: Path) -> None:
    wrong = tmp_path / "wrong.sha512"
    wrong.write_text(f"{'a' * 128}  {RUNTIME_PIN.read_text().split()[1]}\n")

    with pytest.raises(RuntimePackNotPinned):
        build_dumper(tmp_path / "build", runtime_pin=wrong)

    assert not (tmp_path / "build" / "prefix").exists()


@pytest.mark.needs_toolchain
def test_the_build_fetches_no_aspnet_pack(
    dumper_prefix: Path,
) -> None:
    fetched = {path.name for path in (dumper_prefix.parent / "nuget").iterdir()}

    assert "microsoft.aspnetcore.app.runtime.linux-x64" not in fetched
    assert RUNTIME_PACK in fetched


@pytest.mark.needs_toolchain
def test_every_package_the_build_fetched_is_mit(dumper_prefix: Path) -> None:
    nuspecs = sorted((dumper_prefix.parent / "nuget").glob("*/*/*.nuspec"))
    licences = {
        path.parent.parent.name: re.findall(
            r"<license type=\"expression\">([^<]+)</license>", path.read_text()
        )
        for path in nuspecs
    }

    assert "acadsharp" in licences
    assert "microsoft.netcore.app.runtime.linux-x64" in licences  # the runtime inside the file
    assert licences == {name: ["MIT"] for name in licences}


@pytest.mark.needs_toolchain
@pytest.mark.parametrize(
    ("name", "version"),
    [
        ("entity_kinds", "AC1032"),
        ("entity_kinds", "AC1027"),
        ("entity_kinds", "AC1024"),
        ("title_block", "AC1032"),
        ("text_kinds", "AC1032"),
        ("sheet_layout", "AC1032"),
    ],
)
def test_the_real_dumper_reads_a_fixture_in_the_sandbox(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch, name: str, version: str
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    read = acadsharp.dump(dwg_fixture(name, version=version))

    assert (read.acadsharp, read.dwg_version) == ("3.8.0", version)
    assert len(read.handles) == sum(read.types.values()) == sum(read.layers.values()) > 0


@pytest.mark.needs_toolchain
def test_the_real_dumper_names_an_entity_it_could_not_read_and_reads_the_rest(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The real file's pattern (the owner's diagnosis on #79): an INSERT whose stored Z scale is 0.
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    read = acadsharp.dump(dwg_fixture("zero_z_scale"))

    assert list(read.unread.values()) == ["INSERT"]
    assert read.types == {"LINE": 1, "CIRCLE": 1}  # the rest of the file, read
    assert not read.handles & set(read.unread)


@pytest.mark.needs_toolchain
def test_the_real_dumper_on_an_error_about_anything_but_an_entity_is_a_failure(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    with pytest.raises(DumperStopped) as raised:
        acadsharp.dump(dwg_fixture("second_reader_fails"))

    assert raised.value.message == {"code": "engine.decoders_agree.stopped", "params": {}}
    assert raised.value.why == "exit 1"


@pytest.mark.needs_toolchain
def test_the_real_dumper_on_an_error_notification_of_another_shape_is_a_failure(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Two layers with one name: ACadSharp's table template raises "already exists", an Error
    # notification that is not "Could not read <entity>", whatever its Failsafe setting.
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    with pytest.raises(DumperStopped) as raised:
        acadsharp.dump(dwg_fixture("duplicate_layer"))

    assert raised.value.message == {"code": "engine.decoders_agree.stopped", "params": {}}
    assert raised.value.why == "exit 1"


@pytest.mark.needs_toolchain
def test_the_real_dumper_on_garbage_is_a_failure(
    dumper_prefix: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    garbage = tmp_path / "garbage.dwg"
    garbage.write_bytes(b"AC1032" + hashlib.sha256(b"x").digest() * 1000)

    with pytest.raises(DumperStopped) as raised:
        acadsharp.dump(garbage)

    assert raised.value.message["code"] == "engine.decoders_agree.stopped"


@pytest.mark.needs_toolchain
def test_the_real_dumper_over_the_entity_bound_is_too_large(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    monkeypatch.setattr(acadsharp, "MAX_ENTITIES", 10)

    with pytest.raises(DumpTooLarge):
        acadsharp.dump(dwg_fixture("entity_kinds"))
