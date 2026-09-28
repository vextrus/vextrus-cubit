"""The real-drawing command end to end on a made-up machine (the M0 plan, the real-drawing check, steps
1-7): a fake harness writes invented exports, a fake poster records what it is asked to post.
No test raises privilege or names the key user."""

import dataclasses
import fcntl
import hashlib
import json
import os
from pathlib import Path

import pytest

from scripts.real_drawings import sandbox
from scripts.real_drawings.command import Machine, run
from scripts.real_drawings.source import Refused
from scripts.real_drawings.tests.world import FAKE_EXPORT, PYPROJECT, World, invented, make_world

GIT = '{ git = "https://github.com/someone/ezdxf?rev=abc" }'
URL = '{ url = "https://example.com/ezdxf-1.4.4.tar.gz" }'
PATH = '{ path = "wheels/ezdxf-1.4.4-cp314-cp314-linux_x86_64.whl" }'


@pytest.fixture
def world(tmp_path: Path) -> World:
    return make_world(tmp_path)


def only_file(folder: Path, name: str) -> dict[str, object]:
    return json.loads((folder / name).read_text())  # type: ignore[no-any-return]


def run_folder(world: World) -> Path:
    (folder,) = (world.cache / "runs").iterdir()
    return folder


def test_a_dwgread_off_its_pin_is_refused(world: World) -> None:
    (world.toolchain / "libredwg" / "bin" / "dwgread").write_text("#!/bin/sh\necho 'dwgread 0.13'\n")
    world.commit("tuning", {"engine/read.py": "X = 1\n"})

    with pytest.raises(Refused, match=r"dwgread is 'dwgread 0\.13', but the head pins LibreDWG 0\.14"):
        run("tuning", no_post=True, m=world.machine())
    assert world.sandbox_runs == []


def test_a_head_pinning_another_libredwg_is_refused(world: World) -> None:
    world.commit("tuning", {"toolchain/libredwg.version": "0.15\n"})

    with pytest.raises(Refused, match=r"pins LibreDWG 0\.15"):
        run("tuning", no_post=True, m=world.machine())


@pytest.mark.parametrize("source", [GIT, URL, PATH])
def test_a_head_whose_lock_names_a_git_url_or_path_source_is_refused(world: World, source: str) -> None:
    lock = f'version = 1\n\n[[package]]\nname = "ezdxf"\nversion = "1.4.4"\nsource = {source}\n'
    world.commit("tuning", {"uv.lock": lock})

    with pytest.raises(Refused, match="ezdxf: locked from"):
        run("tuning", no_post=True, m=world.machine())
    assert world.sandbox_runs == []


def test_a_head_whose_tool_uv_differs_from_mains_is_refused(world: World) -> None:
    pyproject = PYPROJECT.replace("no-build = true", "no-build = true\ncompile-bytecode = true")
    world.commit("tuning", {"pyproject.toml": pyproject})

    with pytest.raises(Refused, match=r"\[tool\.uv\] differs from main's"):
        run("tuning", no_post=True, m=world.machine())


def test_a_no_post_run_diffs_the_head_against_main_and_posts_nothing(world: World) -> None:
    world.commit("tuning", {FAKE_EXPORT: invented(title="Invented section")})

    assert run("tuning", no_post=True, m=world.machine()) == 0

    assert world.posted == []
    assert os.listdir(world.drop) == [".lock"]
    assert any(line.split()[:4] == ["sheets", "0", "0", "2"] for line in world.said)  # two sets
    folder = run_folder(world)
    assert not (
        folder / "head" / "out"
    ).exists()  # the sandbox's scratch is gone once its exports are out
    metadata = only_file(folder, "metadata.json")
    assert metadata["commit"] == world.repo_commit("tuning")
    items = json.loads((folder / "items.json").read_text())
    assert [(i["set"], i["measure"], i["change"]) for i in items] == [
        ("invented-a", "sheets", "changed"),
        ("invented-b", "sheets", "changed"),
    ]


def test_the_stages_the_head_has_not_built_are_named(world: World) -> None:
    document = json.loads(invented())
    document["stages"] = {
        name: {"target": f"engine.x:{name}", "ticket": "13", "built": built}
        for name, built in (("read", True), ("sheets", False), ("views", False))
    }
    world.commit("tuning", {FAKE_EXPORT: json.dumps(document)})

    run("tuning", no_post=True, m=world.machine())

    assert "Not built on the head: sheets, views" in world.said


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_a_stage_failed_on_the_head_is_named_counted_and_shown_at_the_verdict(world: World) -> None:
    # 06b's harness with its fake stages; on the head its reader fails on one invented drawing,
    # in each of the made-up machine's two sets.
    world.commit("main", {FAKE_EXPORT: (FIXTURES / "export-fakes.json").read_text()})
    world.pr(57, {FAKE_EXPORT: (FIXTURES / "export-fakes-read-fails.json").read_text()})
    world.answers = ["y", "the invented reader fails on purpose"]

    run("57", no_post=False, m=world.machine())

    assert "Failed on the head: read on 2 files (RuntimeError)" in world.said
    assert not any(line.startswith("Failed on main") for line in world.said)
    assert "Stages failed on the head: read on 2 files (RuntimeError)." in world.prompts[0]
    (run_id,) = world.posted
    summary = only_file(world.drop / run_id, "summary.json")
    assert summary["measures"]["failed_stages"] == {"gained": 0, "lost": 2, "changed": 0}  # type: ignore[index]
    shown = "\n".join(world.said + world.prompts) + (world.drop / run_id / "summary.json").read_text()
    assert "the fake reader failed" not in shown  # the kind only, never the message


def test_a_stage_failed_on_main_is_named_too(world: World) -> None:
    world.commit("main", {FAKE_EXPORT: (FIXTURES / "export-fakes-read-fails.json").read_text()})
    world.commit("tuning", {FAKE_EXPORT: (FIXTURES / "export-fakes.json").read_text()})

    run("tuning", no_post=True, m=world.machine())

    assert "Failed on main: read on 2 files (RuntimeError)" in world.said
    assert not any(line.startswith("Failed on the head") for line in world.said)


def test_a_pr_with_no_post_never_posts(world: World) -> None:
    world.pr(57, {FAKE_EXPORT: invented(title="Invented section")})

    assert run("57", no_post=True, m=world.machine()) == 0

    assert world.posted == []
    assert os.listdir(world.drop) == [".lock"]


def test_the_sandbox_gets_only_the_engine_paths(world: World) -> None:
    world.commit("tuning", {"json.py": "raise SystemExit\n", "engine/read.py": "X = 1\n"})

    run("tuning", no_post=True, m=world.machine())

    head_run = world.sandbox_runs[0]
    written = sorted(
        str(p.relative_to(head_run.checkout)) for p in head_run.checkout.rglob("*") if p.is_file()
    )
    assert "json.py" not in written
    assert "README.md" not in written
    assert "engine/read.py" in written


def test_mains_run_is_cached_by_code_hash_and_reused_after_a_non_engine_merge(world: World) -> None:
    run("main", no_post=True, m=world.machine())
    assert len(world.sandbox_runs) == 1

    world.commit("main", {"README.md": "a non-engine merge\n"})
    world.commit("tuning", {"docs.md": "still no engine change\n"})
    run("tuning", no_post=True, m=world.machine())

    assert len(world.sandbox_runs) == 1  # the head and main share main's code hash: nothing ran


def test_an_export_read_in_another_sandbox_is_never_reused(world: World) -> None:
    # The owner's first baseline was read in a sandbox without /tmp, where 04's reader could not
    # start: the same code in the fixed sandbox must read again, not reuse that export.
    run("main", no_post=True, m=dataclasses.replace(world.machine(), sandbox_version="without-tmp"))
    run("main", no_post=True, m=dataclasses.replace(world.machine(), sandbox_version="with-tmp"))
    run("main", no_post=True, m=dataclasses.replace(world.machine(), sandbox_version="with-tmp"))

    assert len(world.sandbox_runs) == 2


def test_the_sandbox_version_is_its_codes_own_hash() -> None:
    source = (Path(sandbox.__file__)).read_bytes()

    assert (
        Machine.__dataclass_fields__["sandbox_version"].default
        == hashlib.sha256(source).hexdigest()[:16]
    )


def test_an_engine_change_runs_the_head_and_diffs_against_mains_cached_run(world: World) -> None:
    run("main", no_post=True, m=world.machine())
    world.commit("tuning", {"engine/read.py": "X = 2\n"})

    run("tuning", no_post=True, m=world.machine())

    assert len(world.sandbox_runs) == 2


def test_an_export_that_breaks_mains_schema_is_refused(world: World) -> None:
    world.commit("tuning", {FAKE_EXPORT: json.dumps({"sheets": []})})

    with pytest.raises(Refused, match=r"breaks the schema at \$: files is missing"):
        run("tuning", no_post=True, m=world.machine())


def test_a_planted_link_in_place_of_the_export_is_not_followed(world: World) -> None:
    secret = world.root / "outside.json"
    secret.write_text(invented())

    def plant(scratch: Path) -> None:
        (scratch / "export-invented-a.json").unlink()
        (scratch / "export-invented-a.json").symlink_to(secret)

    world.plant = plant
    world.pr(57, {"engine/read.py": "X = 1\n"})
    world.answers = ["y", ""]

    with pytest.raises(Refused, match=r"no regular file export-invented-a\.json"):
        run("57", no_post=False, m=world.machine())
    assert os.listdir(world.drop) == [".lock"]
    assert world.posted == []


def test_a_planted_summary_and_metadata_in_the_sandbox_output_are_not_copied(world: World) -> None:
    def plant(scratch: Path) -> None:
        forged = {"verdict": "accepted", "reason": "", "measures": {}, "commit": "f" * 40}
        (scratch / "summary.json").write_text(json.dumps(forged))
        (scratch / "metadata.json").write_text(json.dumps(forged))
        (scratch / "extra").symlink_to("/etc/passwd")

    world.plant = plant
    head = world.pr(57, {FAKE_EXPORT: invented(title="Invented section")})
    world.answers = ["n", ""]

    assert run("57", no_post=False, m=world.machine()) == 0

    (run_id,) = world.posted
    folder = world.drop / run_id
    assert sorted(os.listdir(folder)) == [
        "export-invented-a.json",
        "export-invented-b.json",
        "metadata.json",
        "summary.json",
    ]
    assert only_file(folder, "metadata.json")["commit"] == head
    assert only_file(folder, "summary.json")["verdict"] == "rejected"


def test_the_summary_carries_counts_only_never_a_title_or_number_from_the_export(world: World) -> None:
    world.pr(57, {FAKE_EXPORT: invented(title="Zebra Crossing Plan", number="QX-977")})
    world.answers = ["y", ""]

    run("57", no_post=False, m=world.machine())

    (run_id,) = world.posted
    summary = (world.drop / run_id / "summary.json").read_text()
    for text in ("Zebra", "QX-977", "X-101", "Invented"):
        assert text not in summary
    assert json.loads(summary)["measures"]["sheets"] == {"gained": 0, "lost": 0, "changed": 2}


def test_a_lost_item_is_accepted_only_with_a_reason(world: World) -> None:
    world.pr(57, {FAKE_EXPORT: json.dumps({"files": []})})  # every file lost
    world.answers = ["y", "  "]

    with pytest.raises(Refused, match="only with a reason"):
        run("57", no_post=False, m=world.machine())
    assert world.posted == []

    world.answers = ["y", "the invented file was dropped on purpose"]
    run("57", no_post=False, m=world.machine())
    (run_id,) = world.posted
    summary = only_file(world.drop / run_id, "summary.json")
    assert summary["verdict"] == "accepted"
    assert summary["reason"] == "the invented file was dropped on purpose"


def test_two_posting_runs_are_held_apart_by_the_lock(world: World) -> None:
    world.pr(57, {"engine/read.py": "X = 1\n"})
    world.pr(58, {"engine/read.py": "X = 2\n"})
    second: list[BaseException] = []

    def start_another() -> None:
        world.during = None
        try:
            run("58", no_post=False, m=world.machine())
        except Refused as refused:
            second.append(refused)

    world.during = start_another
    world.answers = ["n", ""]

    run("57", no_post=False, m=world.machine())

    assert [str(r) for r in second] == [
        "another posting run holds the drop folder's lock; wait for it to finish"
    ]
    assert len(world.posted) == 1


def test_a_posting_run_is_refused_while_another_process_holds_the_lock(world: World) -> None:
    world.pr(57, {"engine/read.py": "X = 1\n"})
    held = os.open(world.drop / ".lock", os.O_RDWR)
    fcntl.flock(held, fcntl.LOCK_EX)
    try:
        with pytest.raises(Refused, match="another posting run"):
            run("57", no_post=False, m=world.machine())
    finally:
        os.close(held)
    assert world.sandbox_runs == []


def test_a_branch_or_main_never_posts(world: World) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})

    run("tuning", no_post=False, m=world.machine())
    run("main", no_post=False, m=world.machine())

    assert world.posted == []
    assert os.listdir(world.drop) == [".lock"]


def test_a_posting_run_needs_mains_copy_of_the_command(world: World) -> None:
    world.pr(57, {"engine/read.py": "X = 1\n"})
    world.commit("elsewhere", {})
    world.checkout_ref("elsewhere")

    with pytest.raises(Refused, match="main's copy of the command"):
        run("57", no_post=False, m=world.machine())


def test_main_without_the_harness_schema_is_refused(world: World) -> None:
    world.commit("main", {"engine/export.schema.json": None})

    with pytest.raises(Refused, match="06b"):
        run("main", no_post=True, m=world.machine())
