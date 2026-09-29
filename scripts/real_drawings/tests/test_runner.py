"""Ticket 24s: the scored run, and the pipeline's user who alone writes a scored run's folder
(`scripts/real_drawings/runner.py`). On the made-up machine of `world.py`: the owner's side spools a
bundle, the sets and the wheels; the pipeline's user's side fetches the bundle into its own mirror,
refuses what the owner's user could swap, and runs the check, which writes the run's folder before the
verdict and has the scorer read it. The real scorer reads a folder the command wrote, on an invented
key. Nothing here raises privilege."""

import dataclasses
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings import runner
from scripts.real_drawings.command import Machine, run
from scripts.real_drawings.source import Refused
from scripts.real_drawings.tests.world import REPO, World, make_world, run_git
from tools.scorer import score as scorer


@pytest.fixture
def world(tmp_path: Path) -> World:
    return make_world(tmp_path / "world")


def scoring(world: World, calls: list[str], code: int = 0) -> Machine:
    def score(run_id: str) -> int:
        calls.append(run_id)
        return code

    return dataclasses.replace(world.machine(), score=score)


def test_a_scored_run_of_a_branch_writes_its_folder_scores_it_and_posts_nothing(world: World) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})
    calls: list[str] = []

    assert run("tuning", no_post=True, score=True, m=scoring(world, calls)) == 0

    (run_id,) = calls
    assert sorted(os.listdir(world.drop / run_id)) == [
        "export-invented-a.json",
        "export-invented-b.json",
        "metadata.json",
    ]
    assert world.posted == []
    assert "Nothing posted (a scored run of a branch or main)." in world.said


def test_a_scored_run_answers_the_scorers_exit_code(world: World) -> None:
    calls: list[str] = []

    assert run("main", no_post=True, score=True, m=scoring(world, calls, code=2)) == 2
    assert "Not scored: the scorer ended with exit code 2." in world.said


def test_a_posting_run_is_scored_before_the_verdict(world: World) -> None:
    world.pr(57, {"README.md": "a change the engine never reads\n"})
    order: list[str] = []
    world.answers = ["y", ""]

    def score(run_id: str) -> int:
        order.append("scored")
        assert not (world.drop / run_id / "summary.json").exists()
        return 0

    def ask(prompt: str) -> str:
        order.append("asked")
        return world.answer(prompt)

    m = dataclasses.replace(world.machine(), score=score, ask=ask)
    assert run("57", no_post=False, m=m) == 0

    assert order[0] == "scored"
    assert "asked" in order
    (run_id,) = world.posted
    assert (world.drop / run_id / "summary.json").exists()


def test_a_run_the_pipelines_user_did_not_write_says_it_is_not_scored(world: World) -> None:
    world.pr(57, {"README.md": "a change the engine never reads\n"})

    assert run("57", no_post=False, m=world.machine(), accept_if_clean=True) == 0

    assert any(line.startswith("Not scored: the pipeline's user") for line in world.said)
    assert len(world.posted) == 1


def test_a_run_that_is_not_clean_writes_no_folder_to_score(world: World) -> None:
    world.pr(57, {"engine/invented_export.json": json.dumps({"files": []})})
    calls: list[str] = []

    code = run("57", no_post=False, m=scoring(world, calls), accept_if_clean=True)

    assert code == 3
    assert calls == []
    assert os.listdir(world.drop) == [".lock"]


# The owner's side: the spool.


def test_the_spool_holds_main_and_the_head_the_sets_as_links_and_the_wheels(
    world: World, tmp_path: Path
) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})
    wheels = tmp_path / "wheels"
    wheels.mkdir()
    (wheels / "invented-1.0-py3-none-any.whl").write_bytes(b"wheel")
    (world.sets["invented-a"] / "elsewhere").symlink_to("/etc/hostname")
    spools = tmp_path / "spool"
    spools.mkdir()

    folder = runner.spool(world.repo, "tuning", world.sets, wheels, spools)

    heads = run_git(world.repo, "bundle", "list-heads", str(folder / runner.BUNDLE))
    assert {line.split()[1] for line in heads.splitlines()} == {"refs/heads/main", "refs/heads/tuning"}
    linked = folder / "sets" / "invented-a" / "sheet-1.bin"
    assert linked.stat().st_ino == (world.sets["invented-a"] / "sheet-1.bin").stat().st_ino
    assert not (folder / "sets" / "invented-a" / "elsewhere").exists()
    assert (folder / "wheels" / "invented-1.0-py3-none-any.whl").read_bytes() == b"wheel"


@pytest.mark.parametrize("target", ["../main", "-x", "a..b", "a b"])
def test_the_spool_refuses_a_target_that_is_not_a_plain_branch(
    world: World, tmp_path: Path, target: str
) -> None:
    with pytest.raises(Refused, match="not a branch name"):
        runner.spool(world.repo, target, world.sets, tmp_path, tmp_path)


def test_delegate_removes_its_spool_whatever_the_run_answers(world: World, tmp_path: Path) -> None:
    spools = tmp_path / "spool"
    spools.mkdir()
    seen: list[list[str]] = []

    def fails(command: list[str]) -> int:
        seen.append(command)
        return 5

    code = runner.delegate(
        ["main", "--score"],
        "main",
        repo=world.repo,
        sets=world.sets,
        wheels=tmp_path,
        into=spools,
        runner=fails,
    )

    assert code == 5
    assert seen[0][0] == "--spool"
    assert seen[0][2:] == ["main", "--score"]
    assert os.listdir(spools) == []


# The pipeline's user's side.


def installed_copy(world: World, root: Path) -> Path:
    """Main's files of the command in the world's main, and the same bytes as the installed copy."""
    files: dict[str, str | None] = {path: (REPO / path).read_text() for path in runner.FILES}
    world.commit("main", files)
    installed = root / "installed"
    for path, text in files.items():
        (installed / path).parent.mkdir(parents=True, exist_ok=True)
        (installed / path).write_text(text or "")
    return installed


class Pipeline:
    """The runner's side of one test: its home, the spool folder and the machine it would run on."""

    def __init__(self, world: World, root: Path) -> None:
        self.world = world
        self.home = root / "vxrun"
        self.spools = root / "spool"
        self.spools.mkdir(parents=True)
        self.installed = installed_copy(world, root)
        self.scored: list[str] = []
        self.held: dict[str, str] = {}  # what GitHub holds instead, per ref
        self.sets_read: dict[str, Path] = {}

    def machine(self, home: Path, work: Path) -> Machine:
        def score(run_id: str) -> int:
            self.scored.append(run_id)
            return 0

        self.sets_read = {name: work / "sets" / name for name in self.world.sets}
        return dataclasses.replace(
            self.world.machine(),
            repo=home / "repo.git",
            cache=home / "cache",
            sets=self.sets_read,
            score=score,
            fetch_prs=False,
        )

    def github(self, ref: str) -> str:
        """GitHub, as the poster answers it: here, what the owner's repository holds."""
        name = f"refs/pull/{ref}/head" if ref.isdigit() else f"refs/heads/{ref}"
        return self.held.get(ref, run_git(self.world.repo, "rev-parse", name))

    def spool(self, target: str) -> Path:
        return runner.spool(self.world.repo, target, self.world.sets, self.world.root, self.spools)

    def run(self, argv: list[str], **kwargs: Any) -> int:
        return runner.runner_main(
            argv,
            home=self.home,
            spools=self.spools,
            installed_at=self.installed,
            machine=self.machine,
            on_github=self.github,
            **kwargs,
        )


def test_the_pipelines_user_runs_a_prs_posting_run_from_its_own_mirror(
    world: World, tmp_path: Path
) -> None:
    pipeline = Pipeline(world, tmp_path)
    head = world.pr(57, {"README.md": "a change the engine never reads\n"})
    folder = pipeline.spool("57")

    assert pipeline.run(["--spool", folder.name, "57", "--accept-if-clean"]) == 0

    mirror = pipeline.home / "repo.git"
    assert run_git(mirror, "rev-parse", "refs/pull/57/head") == head
    assert run_git(mirror, "config", "transfer.fsckObjects") == "true"
    (run_id,) = world.posted
    assert pipeline.scored == [run_id]
    assert json.loads((world.drop / run_id / "metadata.json").read_text())["commit"] == head


def test_the_pipelines_user_scores_a_branch_only_when_asked_to(world: World, tmp_path: Path) -> None:
    pipeline = Pipeline(world, tmp_path)
    world.commit("tuning", {"engine/read.py": "X = 1\n"})
    folder = pipeline.spool("tuning")

    assert pipeline.run(["--spool", folder.name, "tuning"]) == 2
    assert pipeline.run(["--spool", folder.name, "tuning", "--score"]) == 0
    assert len(pipeline.scored) == 1
    assert world.posted == []


def test_an_installed_copy_that_is_not_mains_is_refused(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    pipeline = Pipeline(world, tmp_path)
    (pipeline.installed / "scripts/real_drawings/drop.py").write_text("# edited\n")
    folder = pipeline.spool("main")

    assert pipeline.run(["--spool", folder.name, "main", "--score"]) == 2
    assert "scripts/real_drawings/drop.py" in capfd.readouterr().err
    assert pipeline.scored == []


@pytest.mark.parametrize("plant", ["a repository", "a link"])
def test_a_bundle_the_owners_user_swapped_is_refused(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str], plant: str
) -> None:
    """A repository in the bundle's place would have git read the owner's user's config as the
    pipeline's user (a config can run a program); a link could point anywhere."""
    pipeline = Pipeline(world, tmp_path)
    folder = pipeline.spool("main")
    bundle = folder / runner.BUNDLE
    bundle.unlink()
    if plant == "a repository":
        run_git(folder, "init", "--quiet", str(bundle))
        run_git(bundle, "config", "core.fsmonitor", f"touch {tmp_path / 'ran'}")
    else:
        bundle.symlink_to(world.repo / ".git")

    assert pipeline.run(["--spool", folder.name, "main", "--score"]) == 2
    assert "no plain bundle" in capfd.readouterr().err
    assert not (tmp_path / "ran").exists()


@pytest.mark.parametrize("token", ["../spool", "0123", "ABCDEF0123456789", "/etc"])
def test_a_spool_that_is_not_the_owners_sides_is_refused(
    world: World, tmp_path: Path, token: str
) -> None:
    pipeline = Pipeline(world, tmp_path)

    assert pipeline.run(["--spool", token, "main", "--score"]) == 2


def test_a_spool_folder_that_is_a_link_is_refused(world: World, tmp_path: Path) -> None:
    pipeline = Pipeline(world, tmp_path)
    real = pipeline.spool("main")
    token = "0123456789abcdef"
    (pipeline.spools / token).symlink_to(real)

    assert pipeline.run(["--spool", token, "main", "--score"]) == 2


# The contract: the real scorer reads the folder the command writes.


def test_the_scorer_scores_the_folder_the_command_writes(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    def the_run_the_harness_names(scratch: Path) -> None:
        env = world.sandbox_runs[-1].env
        for export in scratch.glob("export-*.json"):
            document = json.loads(export.read_text())
            document["run"] = {"id": env["VEXTRUS_RUN_ID"], "commit": env["VEXTRUS_COMMIT"]}
            export.write_text(json.dumps(document))

    world.plant = the_run_the_harness_names
    keys = tmp_path / "keys"
    keys.mkdir()
    sheet = {
        "layout": "Invented layout",
        "number": "X-101",
        "title": "Invented floor plan",
        "discipline": "structural",
        "storeys": "ground floor",
        "revision": "R0",
        "date": "2026-01-01",
        "views": [],
    }
    key = {"set": "invented-a", "held_out": False, "sheets": [sheet]}
    (keys / "invented-a.json").write_text(json.dumps(key))
    log = tmp_path / "score.log"

    def score(run_id: str) -> int:
        return scorer.main([run_id], drop=world.drop, keys=keys, log=log, writer=os.getuid())

    m = dataclasses.replace(world.machine(), score=score)
    assert run("main", no_post=True, score=True, m=m) == 0

    shown = capfd.readouterr().out
    assert "sheets         1 / 1" in shown, shown
    assert "sheet 1 (layout Invented layout): pass" in shown, shown
    (run_id,) = (p.name for p in world.drop.iterdir() if p.name != ".lock")
    metadata = json.loads((world.drop / run_id / "metadata.json").read_text())
    exported = (world.drop / run_id / "export-invented-a.json").read_bytes()
    assert metadata["sets"]["invented-a"]["export_sha256"] == hashlib.sha256(exported).hexdigest()
    sheet_file = (world.sets["invented-a"] / "sheet-1.bin").read_bytes()
    assert metadata["sets"]["invented-a"]["files"] == {
        "sheet-1.bin": hashlib.sha256(sheet_file).hexdigest()
    }


def test_the_launcher_runs_with_a_fixed_environment(tmp_path: Path) -> None:
    """`launch` clears the environment before anything runs as the pipeline's user (checked in a child
    process, since it exits)."""
    code = (
        "import os, sys\n"
        "from scripts.real_drawings import runner\n"
        f"runner.HOME = __import__('pathlib').Path({str(tmp_path)!r})\n"
        "runner.runner_main = lambda: print(sorted(os.environ), os.getcwd()) or 0\n"
        "runner.launch()\n"
    )
    env = {**os.environ, "GIT_DIR": "/elsewhere", "PYTHONPATH": str(REPO)}
    done = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, check=False, env=env, cwd=REPO
    )
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == f"['HOME', 'LANG', 'PATH'] {tmp_path}"


# The refuter's finding (score 70): a commit nobody pushed, whose engine could write any export, was
# scored; so was a head measured against a main nobody pushed.


@pytest.mark.parametrize("where", ["head", "main"])
def test_a_head_or_main_that_github_does_not_hold_is_never_measured(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str], where: str
) -> None:
    pipeline = Pipeline(world, tmp_path)
    world.commit("tuning", {"engine/read.py": "X = 1\n"})
    folder = pipeline.spool("tuning")
    pipeline.held["tuning" if where == "head" else "main"] = ""  # nobody pushed it

    assert pipeline.run(["--spool", folder.name, "tuning", "--score"]) == 2

    assert "on GitHub" in capfd.readouterr().err
    assert world.sandbox_runs == []
    assert pipeline.scored == []


def test_a_prs_head_that_is_not_githubs_is_never_measured(world: World, tmp_path: Path) -> None:
    pipeline = Pipeline(world, tmp_path)
    world.pr(57, {"README.md": "a change\n"})
    folder = pipeline.spool("57")
    pipeline.held["57"] = "f" * 40

    assert pipeline.run(["--spool", folder.name, "57", "--accept-if-clean"]) == 2
    assert world.sandbox_runs == []


def test_the_pipelines_user_reads_its_own_copy_of_the_sets(world: World, tmp_path: Path) -> None:
    """The owner's user keeps its hard links' files: changed in place during a run, they would be read
    under a digest taken before, and cached so."""
    pipeline = Pipeline(world, tmp_path)
    (world.sets["invented-a"] / "elsewhere").symlink_to("/etc/hostname")
    folder = pipeline.spool("main")
    seen: dict[str, bytes] = {}

    def run(target: str, **kwargs: Any) -> int:
        copy = kwargs["m"].sets["invented-a"]
        seen["bytes"] = (copy / "sheet-1.bin").read_bytes()
        seen["same"] = (copy / "sheet-1.bin").stat().st_ino == (
            world.sets["invented-a"] / "sheet-1.bin"
        ).stat().st_ino
        seen["link"] = (copy / "elsewhere").exists()
        return 0

    assert pipeline.run(["--spool", folder.name, "main", "--score"], run=run) == 0

    assert seen == {"bytes": b"invented bytes", "same": False, "link": False}
    assert not pipeline.sets_read["invented-a"].exists()  # removed after the run


# The refuter's second pass (score 65): a second run, started while the first sat between its check
# against GitHub and its measurement, moved the shared mirror's refs to a commit nobody pushed.


def test_a_second_run_cannot_move_the_mirror_under_a_checked_run(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    pipeline = Pipeline(world, tmp_path)
    world.commit("tuning", {"engine/read.py": "X = 1\n"})
    pushed = run_git(world.repo, "rev-parse", "refs/heads/tuning")
    honest = pipeline.spool("tuning")
    world.commit("tuning", {"engine/read.py": "X = 'never pushed'\n"})
    forged = pipeline.spool("tuning")
    pipeline.held["tuning"] = pushed  # GitHub holds only the pushed commit
    second: list[int] = []
    first_machine = pipeline.machine

    def machine(home: Path, work: Path) -> Machine:
        second.append(pipeline.run(["--spool", forged.name, "tuning", "--score"]))
        return first_machine(home, work)

    pipeline.machine = machine  # type: ignore[method-assign]
    assert pipeline.run(["--spool", honest.name, "tuning", "--score"]) == 0

    assert second == [2]
    assert "another scored run is running" in capfd.readouterr().err
    (run_id,) = pipeline.scored
    assert json.loads((world.drop / run_id / "metadata.json").read_text())["commit"] == pushed


def test_the_sets_copy_enters_no_linked_folder_and_reads_no_pipe(world: World, tmp_path: Path) -> None:
    secret = tmp_path / "vxrun-only"
    secret.mkdir()
    (secret / "private.bin").write_bytes(b"not the owner's")
    (world.sets["invented-a"] / "linked").symlink_to(secret, target_is_directory=True)
    os.mkfifo(world.sets["invented-a"] / "pipe")
    spooled = tmp_path / "spooled"
    spooled.mkdir()
    for name, folder in world.sets.items():
        (spooled / name).mkdir()
        for path in folder.iterdir():
            if path.is_symlink():
                (spooled / name / path.name).symlink_to(path.readlink(), target_is_directory=True)
            elif path.is_fifo():
                os.mkfifo(spooled / name / path.name)
            else:
                os.link(path, spooled / name / path.name)

    runner._take_sets(spooled, tmp_path / "copy")

    assert sorted(p.name for p in (tmp_path / "copy" / "invented-a").iterdir()) == ["sheet-1.bin"]
