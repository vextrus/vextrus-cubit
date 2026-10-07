"""Unit tests of the governor's parsers and of each real command line it runs (PATH stubs)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

from scripts.factory import governor

SEAMS = ("VEXTRUS_MEMINFO_FILE", "VEXTRUS_DF_FILE", "VEXTRUS_USAGE_FILE", "VEXTRUS_AGENTS_FILE")


def stub(folder: Path, name: str, stdout: str, code: int = 0) -> Path:
    """A command that records its argv to `<name>.argv` and prints `stdout`."""
    record = folder / f"{name}.argv"
    path = folder / name
    path.write_text(
        f"#!{sys.executable}\nimport json, sys\n"
        f"open({str(record)!r}, 'w').write(json.dumps(sys.argv[1:]))\n"
        f"sys.stdout.write({stdout!r})\nsys.exit({code})\n"
    )
    path.chmod(0o755)
    return record


@pytest.fixture
def no_seams(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    for name in SEAMS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("PATH", f"{tmp_path}{os.pathsep}{os.environ['PATH']}")
    return tmp_path


def test_meminfo_needs_available_and_both_swap_fields() -> None:
    text = "MemAvailable: 2097152 kB\nSwapTotal: 4194304 kB\nSwapFree: 3145728 kB\n"
    memory = governor.parse_meminfo(text)
    assert memory is not None
    assert memory.available_gb == 2.0
    assert memory.swap_used_gb == 1.0
    assert governor.parse_meminfo("MemAvailable: 2097152 kB\n") is None
    assert governor.parse_meminfo("") is None


def test_df_wants_the_header_and_one_number() -> None:
    assert governor.parse_df("Avail\n1048576\n") == 1.0
    assert governor.parse_df("1048576\n") is None
    assert governor.parse_df("Avail\n1\n2\n") is None
    assert governor.parse_df("Avail\nlots\n") is None


def test_usage_reads_only_the_session_and_all_models_week_lines() -> None:
    text = (
        "Current week (Fable): 99% used\nCurrent session: 41% used\n"
        "Current week (all models): 38% used\n"
    )
    reading = governor.parse_usage(json.dumps({"result": text}))
    assert reading.usage == governor.Usage(41.0, 38.0)
    assert (
        governor.parse_usage("Current session: 41% used\nCurrent week (Fable): 1% used\n").usage is None
    )
    assert (
        governor.parse_usage("Current session: 141% used\nCurrent week (all models): 1% used").usage
        is None
    )


def test_agents_must_be_a_list_of_objects() -> None:
    assert governor.parse_agents("[]") == []
    assert governor.parse_agents('{"rows": []}') is None
    assert governor.parse_agents("[1]") is None
    assert governor.parse_agents("not json") is None


def test_cloud_cap_from_the_ramp_is_never_negative_nor_above_16() -> None:
    assert governor.cloud_cap(governor.Usage(79, 10), 5.0, 5.0) == 0
    assert governor.cloud_cap(governor.Usage(0, 0), 0.01, 1.0) == 16
    assert governor.cloud_cap(governor.Usage(49, 69), None, None) == 16
    assert governor.cloud_cap(governor.Usage(50, 10), None, None) == 16
    assert governor.cloud_cap(governor.Usage(99, 99), None, None) == 16


def test_df_runs_df_k_output_avail_on_root(no_seams: Path) -> None:
    record = stub(no_seams, "df", "Avail\n52428800\n")
    assert governor.read_disk_gb() == 50.0
    assert json.loads(record.read_text()) == ["-k", "--output=avail", "/"]


def test_usage_runs_claude_p_usage_as_json(no_seams: Path) -> None:
    text = "Current session: 12% used\nCurrent week (all models): 27% used\n"
    record = stub(no_seams, "claude", json.dumps({"result": text}))
    assert governor.read_usage().usage == governor.Usage(12.0, 27.0)
    assert json.loads(record.read_text()) == ["-p", "/usage", "--output-format", "json"]


def test_agents_runs_claude_agents_json_all(no_seams: Path) -> None:
    record = stub(no_seams, "claude", '[{"name": "a", "pid": 1, "kind": "background"}]')
    rows = governor.read_agents()
    assert rows is not None
    assert governor.live_local_agents(rows) == 1
    assert json.loads(record.read_text()) == ["agents", "--json", "--all"]


def test_a_failing_command_is_an_unreadable_reading(no_seams: Path) -> None:
    stub(no_seams, "claude", "Current session: 1% used\nCurrent week (all models): 1% used\n", code=1)
    assert governor.read_usage().usage is None
    assert governor.read_agents() is None


def test_a_pidfile_that_names_no_pid_counts_as_live(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "meminfo").write_text("MemAvailable: 67108864 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n")
    (tmp_path / "df").write_text("Avail\n524288000\n")
    monkeypatch.setenv("VEXTRUS_MEMINFO_FILE", str(tmp_path / "meminfo"))
    monkeypatch.setenv("VEXTRUS_DF_FILE", str(tmp_path / "df"))
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path))
    assert governor.check("rd-run").ok
    (tmp_path / "rd.pid").write_text("not a pid\n")
    refused = governor.check("rd-run")
    assert not refused.ok
    assert "rd.pid" in str(refused.reason)


@pytest.mark.parametrize("option", ["--running", "--agents", "--rate"])
def test_negative_counts_are_a_usage_error(option: str) -> None:
    extra = ["--hours-to-reset", "1"] if option == "--rate" else []
    with pytest.raises(SystemExit) as stopped:
        governor.main(["check", "review", option, "-1", *extra])
    assert stopped.value.code == 2
