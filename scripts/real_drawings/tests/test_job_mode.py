"""`--job` mode (21a; the M0 plan, "The real-drawing check", step 3; the review R2): the product's job
in the sandbox against a throwaway PostgreSQL 18 cluster on a Unix socket, its export from the job's
export entry point; off by default. The command's tests run a fake sandbox (`world.py`); the last ones
run the real sandbox and the real cluster with a fake entry point, where the toolchain, bwrap and
PostgreSQL 18 are installed:

    uv run pytest -m "needs_toolchain or needs_bwrap" scripts/real_drawings/tests/test_job_mode.py
"""

import dataclasses
import json
import shutil
from pathlib import Path

import pytest

from scripts.real_drawings import command, sandbox
from scripts.real_drawings.command import run
from scripts.real_drawings.drop import take
from scripts.real_drawings.source import Refused
from scripts.real_drawings.tests.world import World, make_world


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    binaries = tmp_path / "postgresql-18" / "bin"
    binaries.mkdir(parents=True)
    (binaries / "initdb").write_text("#!/bin/sh\n")
    monkeypatch.setattr(sandbox, "PG_BIN", binaries)
    return make_world(tmp_path / "world")


def metadata(world: World) -> dict[str, object]:
    (folder,) = (world.cache / "runs").iterdir()
    return json.loads((folder / "metadata.json").read_text())  # type: ignore[no-any-return]


# The command ---------------------------------------------------------------------------------------


def test_the_harness_reads_both_runs_by_default(world: World) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})

    run("tuning", no_post=True, m=world.machine())

    assert [job.job for job in world.sandbox_runs] == [False, False]
    assert metadata(world)["mode"] == "harness"
    script = sandbox.script(world.sandbox_runs[0])
    assert "-m engine.harness" in script
    assert "initdb" not in script
    assert "--uid" not in sandbox.argv(world.sandbox_runs[0])


def test_job_mode_reads_the_head_with_the_job_and_main_with_the_harness(world: World) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})

    run("tuning", no_post=True, m=world.machine(), job=True)

    assert [job.job for job in world.sandbox_runs] == [True, False]
    assert metadata(world)["mode"] == "job"


def test_a_job_run_of_main_is_still_diffed_against_mains_harness_run(world: World) -> None:
    run("main", no_post=True, m=world.machine(), job=True)

    assert [job.job for job in world.sandbox_runs] == [True, False]


def test_a_jobs_export_is_never_reused_as_the_harnesss_or_the_other_way(world: World) -> None:
    run("main", no_post=True, m=world.machine())
    assert [job.job for job in world.sandbox_runs] == [False]

    run("main", no_post=True, m=world.machine(), job=True)

    assert [job.job for job in world.sandbox_runs] == [False, True]  # main's harness run: cached


def test_the_command_line_takes_job(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(command, "owners_machine", world.machine)

    assert command.main(["main", "--no-post", "--job"]) == 0

    assert world.sandbox_runs[0].job is True


def test_job_mode_without_postgresql_18_is_refused(world: World) -> None:
    shutil.rmtree(sandbox.PG_BIN)

    with pytest.raises(Refused, match="PostgreSQL 18's binaries"):
        run("main", no_post=True, m=world.machine(), job=True)
    assert world.sandbox_runs == []


# What the sandbox is given in job mode -------------------------------------------------------------


def a_job(tmp_path: Path, *, job: bool) -> sandbox.Job:
    return sandbox.Job(
        python=Path("/opt/vextrus/python/bin/python3"),
        toolchain=Path("/opt/vextrus"),
        checkout=tmp_path / "src",
        wheels=tmp_path / "wheels",
        requirements=tmp_path / "requirements.txt",
        sets={"invented": tmp_path / "sets" / "invented"},
        scratch=tmp_path / "out",
        env={"VEXTRUS_RUN_ID": "invented-run", "VEXTRUS_COMMIT": "abc"},
        job=job,
    )


def test_job_mode_starts_a_cluster_on_a_unix_socket_only_and_calls_the_jobs_export(
    tmp_path: Path,
) -> None:
    script = sandbox.script(a_job(tmp_path, job=True)).splitlines()

    initdb = f"{sandbox.PG_BIN}/initdb -D /tmp/pg -U vextrus --auth=trust -E UTF8 --no-sync"
    assert any(line.startswith(initdb) for line in script)
    [start] = [line for line in script if line.endswith("-w start > /dev/null")]
    assert f"-k {sandbox.SOCKET} -c listen_addresses=" + '"' in start  # no TCP at all
    assert f"trap '{sandbox.PG_BIN}/pg_ctl -D /tmp/pg -m fast -w stop > /dev/null' EXIT" in script
    assert script[-1] == (
        "/work/out/venv/bin/python -m vextrus.takeoff.services.export"
        " --set /work/sets/invented --out /work/out/export-invented.json"
        " --database /tmp/pg-socket --run-id invented-run --commit abc"
    )
    assert not any("engine.harness" in line for line in script)


def test_job_mode_runs_as_one_unprivileged_user_named_read_only(tmp_path: Path) -> None:
    job = a_job(tmp_path, job=True)
    args = sandbox.argv(job)

    assert args[args.index("--uid") + 1] == args[args.index("--gid") + 1] == "1000"
    passwd, group = sandbox.identity(job)
    assert passwd.parent == group.parent == tmp_path  # beside the scratch folder, never inside it
    for host, inside in ((passwd, "/etc/passwd"), (group, "/etc/group")):
        at = args.index(str(host))
        assert args[at - 1 : at + 2] == ["--ro-bind", str(host), inside]


def test_the_harness_mode_sandbox_is_as_it_was(tmp_path: Path) -> None:
    harness, job = a_job(tmp_path, job=False), a_job(tmp_path, job=True)

    assert "/etc/passwd" not in sandbox.argv(harness)
    assert sandbox.argv(dataclasses.replace(job, job=False)) == sandbox.argv(harness)


# The real sandbox and the real cluster, with a fake job ------------------------------------------------

ROOT = Path(__file__).resolve().parents[3]
TOOLCHAIN = Path("/opt/vextrus")
PIN = (ROOT / "toolchain" / "python.version").read_text().strip()
PYTHON = TOOLCHAIN / "python" / f"cpython-{PIN}-linux-x86_64-gnu" / "bin" / "python3"

FAKE_JOB = """
import json, os, pwd, socket, subprocess, sys
from pathlib import Path

args = dict(zip(sys.argv[1::2], sys.argv[2::2]))
psql = ["/usr/lib/postgresql/18/bin/psql", "-h", args["--database"], "-U", "vextrus", "-d", "postgres",
        "-qAtc"]
made = subprocess.run(psql + ["create table kept (n int); insert into kept values (7);"
                              " select n from kept"], capture_output=True, text=True)

def tcp():
    try:
        socket.create_connection(("127.0.0.1", 5432), timeout=2).close()
        return True
    except OSError:
        return False

Path(args["--out"]).write_text(json.dumps({"files": [], "probe": {
    "selected": made.stdout.strip(), "error": made.stderr.strip(), "tcp": tcp(),
    "user": pwd.getpwuid(os.getuid()).pw_name, "uid": os.getuid(),
    "set_files": sorted(os.listdir(args["--set"])), "run_id": args.get("--run-id"),
}}))
"""


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
@pytest.mark.skipif(not (sandbox.PG_BIN / "initdb").exists(), reason="PostgreSQL 18 is not installed")
def test_the_fake_job_reaches_its_throwaway_cluster_by_socket_only(tmp_path: Path) -> None:
    job = a_job(tmp_path, job=True)
    job = dataclasses.replace(job, python=PYTHON, env={"VEXTRUS_RUN_ID": "invented-run"})
    entry = job.checkout / "vextrus" / "takeoff" / "services"
    entry.mkdir(parents=True)
    for package in (job.checkout / "vextrus", job.checkout / "vextrus" / "takeoff", entry):
        (package / "__init__.py").write_text("")
    (entry / "export.py").write_text(FAKE_JOB)
    job.wheels.mkdir()
    job.requirements.write_text("")
    job.sets["invented"].mkdir(parents=True)
    (job.sets["invented"] / "sheet-1.bin").write_bytes(b"invented")
    job.scratch.mkdir()

    sandbox.run(job, tmp_path / "sandbox.log")

    take(job.scratch, "export-invented.json", tmp_path / "export.json")
    probe = json.loads((tmp_path / "export.json").read_text())["probe"]
    assert (probe["selected"], probe["error"]) == ("7", "")
    assert probe["tcp"] is False
    assert (probe["user"], probe["uid"]) == ("vextrus", 1000)
    assert probe["set_files"] == ["sheet-1.bin"]
    assert probe["run_id"] == "invented-run"
    log = (job.scratch / "pg.log").read_text()
    assert "database system is shut down" in log  # stopped when the script ended


# Refused until 21c makes it the default (the orchestrator's ruling on the merge with 24s) --------------


def test_job_mode_is_refused_on_a_posting_run(world: World) -> None:
    with pytest.raises(Refused, match="never scored or posted"):
        run("57", no_post=False, m=world.machine(), job=True)
    assert world.sandbox_runs == []
    assert world.posted == []


def test_job_mode_is_refused_with_score(world: World) -> None:
    with pytest.raises(Refused, match="never scored or posted"):
        run("main", no_post=True, m=world.machine(), job=True, score=True)
    assert world.sandbox_runs == []


@pytest.mark.parametrize(
    "argv", [["57", "--job"], ["main", "--job", "--score"]], ids=["posting", "score"]
)
def test_the_command_line_refuses_job_with_score_or_on_a_posting_run(
    world: World, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], argv: list[str]
) -> None:
    monkeypatch.setattr(command, "owners_machine", world.machine)

    with pytest.raises(SystemExit) as ended:
        command.main(argv)

    assert ended.value.code == 2
    assert "--job is never scored or posted until 21c" in capsys.readouterr().err
    assert world.sandbox_runs == []
