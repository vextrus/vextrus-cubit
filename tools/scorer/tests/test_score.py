"""The scorer's rules the acceptance tests leave open (ticket 24s): the other four sheet fields, extra
views and sheets, the normalising, the files inside a run's folder, the system Python it runs on, and
that no failure shows a key's value. Invented keys and exports only."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from tools.scorer import score
from tools.scorer.tests.acceptance.t24s.runs import (
    RUN_ID,
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

A_BOX = [10.0, 10.0, 110.0, 110.0]
B_BOX = [200.0, 10.0, 300.0, 110.0]
SCORER = Path(score.__file__)


def shown(capfd: pytest.CaptureFixture[str]) -> str:
    output = capfd.readouterr()
    return output.out + output.err


def one_sheet(place: Place, key: dict[str, object], found: dict[str, object]) -> None:
    place.write_keys([key])
    place.write_run([found])


def plan(**values: object) -> dict[str, object]:
    return (
        key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(A_BOX, "Plan A")])
        | values
    )


def found_plan(views: list[dict[str, object]] | None = None, **values: object) -> dict[str, object]:
    sheet = export_sheet(
        "Sheet A", "QZ-901", "Invented plan", "first floor", views or [export_view(A_BOX, "Plan A")]
    )
    return sheet | values


@pytest.mark.parametrize(
    ("field", "value", "reason"),
    [
        ("title", "Another plan", "title wrong"),
        ("discipline", "architectural", "Discipline wrong"),
        ("revision", "R9", "revision wrong"),
        ("date", "2030-02-02", "date wrong"),
    ],
)
def test_each_other_sheet_field_fails_the_sheet_in_general_terms(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], field: str, value: str, reason: str
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(**{field: value}), found_plan())

    assert place.score() == 0
    out = shown(capfd)
    assert out.count(reason) == 1, out
    assert "sheets         0 / 1" in out, out
    assert value.casefold() not in out.casefold()


def test_an_extra_view_is_reported_and_does_not_fail_its_sheet(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    views = [export_view(A_BOX, "Plan A"), export_view(B_BOX, "An invented extra")]
    one_sheet(place, plan(), found_plan(views))

    place.score()
    out = shown(capfd)
    assert "pass; an extra view" in out, out
    assert "sheets         1 / 1" in out, out
    assert "extra views 1" in out, out


def test_a_missing_sheet_is_not_named_and_an_extra_sheet_is_counted(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys([plan(layout="Zanzibar layout")])
    place.write_run([found_plan()])

    place.score()
    out = shown(capfd)
    assert "the sheet missing" in out, out
    assert "zanzibar" not in out.casefold()
    assert "extra sheets 1" in out, out


def test_a_views_title_and_subject_are_scored_without_their_values(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    key = plan(views=[key_view(A_BOX, "Quixotic title", subject="pile_cap")])
    one_sheet(place, key, found_plan())

    place.score()
    out = shown(capfd)
    assert "a view's title wrong" in out, out
    assert "a view's subject wrong" in out, out
    assert "view titles    0 / 1" in out, out
    assert "view subjects  0 / 1" in out, out
    assert "quixotic" not in out.casefold()
    assert "pile_cap" not in out


def test_several_missing_views_are_counted_in_one_reason(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    views = [key_view(A_BOX, "Plan A"), key_view(B_BOX, "Plan B"), key_view([0, 200, 50, 250], "C")]
    one_sheet(place, plan(views=views), found_plan())

    place.score()
    out = shown(capfd)
    assert "2 views missing" in out, out


def test_numbers_fold_case_and_separators_and_titles_their_symbols(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    key = plan(number="qz 901", title="Invented  %%c plan")
    found = export_sheet(
        "Sheet A", "QZ.901", "invented ø PLAN", "first floor", [export_view(A_BOX, "Plan A")]
    )
    one_sheet(place, key, found)

    place.score()
    out = shown(capfd)
    assert "wrong" not in out, out
    assert "sheets         1 / 1" in out, out


def test_a_key_without_held_out_is_answered_as_held_out(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())
    key = place.keys / "invented-set.json"
    key.write_text(key.read_text().replace('"held_out": false, ', ""))

    place.score()
    out = shown(capfd)
    assert "in aggregate only" in out, out
    assert "sheet 1" not in out, out


@pytest.mark.parametrize("change", ["group-writable", "hard-linked"])
def test_a_file_in_the_run_others_may_write_or_a_second_link_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], change: str
) -> None:
    place = Place(tmp_path)
    export = place.write_run([found_plan()])
    place.write_keys([plan()])
    if change == "group-writable":
        os.chmod(export, 0o660)
    else:
        os.link(export, tmp_path / "second-name.json")

    assert place.score() == score.REFUSED
    out = shown(capfd)
    assert "refused" in out, out
    assert " / " not in out, out


def test_metadata_whose_commit_is_not_the_run_ids_head_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys([plan()])
    place.write_run([found_plan()])
    metadata = place.run / "metadata.json"
    metadata.write_text(metadata.read_text().replace('"commit": "5e1f', '"commit": "6e1f'))

    assert place.score() == score.REFUSED
    assert "not the run's head" in shown(capfd)


def test_a_failure_shows_no_message_since_it_could_quote_a_key(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())

    def broken(*_: object) -> None:
        raise ValueError("could not convert 'QZ-SECRET'")

    monkeypatch.setattr(score, "_score", broken)
    assert place.score() == score.BROKEN
    out = shown(capfd) + place.logged()
    assert "QZ-SECRET" not in out, out
    assert "ValueError" in out, out


def test_odd_values_in_a_key_are_scored_as_wrong_not_shown(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    views = [{"box": "QZ-ODD-BOX", "title": 7, "kind": None, "subject": ["QZ-ODD-LIST"]}]
    place.write_keys(
        [plan(frame="QZ-ODD-FRAME", number=901, views=views), "QZ-ODD-SHEET"]  # type: ignore[list-item]
    )
    place.write_run([found_plan()])

    assert place.score() == 0
    out = shown(capfd) + place.logged()
    assert "QZ-ODD" not in out, out


def test_the_log_holds_totals_only(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan(number={"value": "AB-100", "source": "title_block_text"}))

    place.score()
    logged = place.logged()
    assert f"run {RUN_ID} head 5e1f0c2a9b7d" in logged, logged
    assert "number wrong" not in logged, logged
    assert "number 0 / 1" in logged, logged


@pytest.mark.skipif(not Path("/usr/bin/python3").exists(), reason="no system Python here")
def test_the_scorer_runs_on_the_system_python_its_launcher_names(tmp_path: Path) -> None:
    """The installed launcher is `#!/usr/bin/python3 -I` (3.12 on this machine): a syntax or a module
    newer than that Python breaks the installed scorer while the suite, on 3.14, stays green."""
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())
    place.log.touch()
    installed = tmp_path / "vx_score.py"
    shutil.copyfile(SCORER, installed)
    driver = (
        "import importlib.util, os, sys, pathlib\n"
        "spec = importlib.util.spec_from_file_location('vx_score', sys.argv[1])\n"
        "module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)\n"
        "P = pathlib.Path(sys.argv[2])\n"
        "sys.exit(module.main([sys.argv[3]], drop=P / 'drop', keys=P / 'keys', log=P / 'score.log',"
        " writer=os.getuid()))\n"
    )
    done = subprocess.run(
        ["/usr/bin/python3", "-I", "-c", driver, str(installed), str(tmp_path), RUN_ID],
        capture_output=True,
        text=True,
        check=False,
        env={"PATH": "/usr/bin:/bin"},
    )
    assert done.returncode == 0, done.stderr
    assert "sheets         1 / 1" in done.stdout, done.stdout
    assert sys.stdlib_module_names  # the stdlib-only scan is the acceptance test's


def test_the_installed_scorer_refuses_as_the_owners_user() -> None:
    done = subprocess.run(
        [sys.executable, "-I", str(SCORER), RUN_ID], capture_output=True, text=True, check=False
    )
    assert done.returncode == score.REFUSED, done.stderr
    # Where the pipeline's user exists, the key user's log is what this user cannot write.
    assert "no user vxrun" in done.stderr or "the log cannot be written" in done.stderr


@pytest.mark.skipif(not Path("/usr/bin/python3").exists(), reason="no system Python here")
@pytest.mark.parametrize("module", ["score.py", "drafts.py"])
def test_what_runs_on_the_system_python_compiles_there(module: str) -> None:
    """keys-custody.sh runs the scorer as root's file and the draft check as the owner's user, both on
    /usr/bin/python3; the formatter targets 3.14 and rewrites, for one, `except (A, B):` into syntax
    3.12 cannot read."""
    source = SCORER.parent / module
    done = subprocess.run(
        [
            "/usr/bin/python3",
            "-I",
            "-c",
            "import sys; compile(open(sys.argv[1]).read(), sys.argv[1], 'exec')",
            str(source),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stderr
