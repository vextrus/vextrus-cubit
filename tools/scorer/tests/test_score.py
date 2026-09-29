"""The scorer's rules the acceptance tests leave open (ticket 24s): the other four sheet fields, extra
views and sheets, the normalising, the files inside a run's folder, the system Python it runs on, and
that no failure shows a key's value. Invented keys and exports only."""

import hashlib
import json
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


# Fix round 1 of 24s. F2 (70): a key that is a link was followed to a file the owner's user holds.


def test_a_key_that_is_a_link_is_refused(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())
    key = place.keys / "invented-set.json"
    held = tmp_path / "owners-copy.json"
    key.rename(held)
    key.symlink_to(held)

    assert place.score() == score.REFUSED
    assert "a link is never followed" in shown(capfd)


def test_a_key_others_may_write_is_refused(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())
    os.chmod(place.keys / "invented-set.json", 0o666)

    assert place.score() == score.REFUSED
    assert "not the key user's alone" in shown(capfd)


# F3 (70): a run of drawings the key does not key was scored.


def keyed_files(place: Place, key_files: dict[str, str], run_files: dict[str, str] | None) -> None:
    key = json.loads((place.keys / "invented-set.json").read_text()) | {"files": key_files}
    (place.keys / "invented-set.json").write_text(json.dumps(key))
    metadata = json.loads((place.run / "metadata.json").read_text())
    if run_files is not None:
        metadata["sets"]["invented-set"]["files"] = run_files
    (place.run / "metadata.json").write_text(json.dumps(metadata))


@pytest.mark.parametrize(
    "run_files",
    [
        None,
        {"sub/invented-aaaa.dwg": "1" * 64},
        {"invented-aaaa.dwg": "0" * 64, "another.dwg": "2" * 64},
        {"a/invented-aaaa.dwg": "0" * 64, "b/invented-aaaa.dwg": "0" * 64},
    ],
)
def test_a_run_of_other_drawings_than_the_key_keys_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], run_files: dict[str, str] | None
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())
    keyed_files(place, {"invented-aaaa.dwg": "0" * 64}, run_files)

    assert place.score() == score.REFUSED
    out = shown(capfd)
    assert "drawings" in out, out
    assert " / " not in out


def test_a_run_of_exactly_the_keyed_drawings_is_scored(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(file="invented-aaaa.dwg"), found_plan())
    keyed_files(place, {"invented-aaaa.dwg": "0" * 64}, {"sub/invented-aaaa.dwg": "0" * 64})

    assert place.score() == 0
    assert "sheets         1 / 1" in shown(capfd)


def test_a_key_sheet_joins_only_a_sheet_of_the_drawing_it_names(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(file="another.dwg"), found_plan())

    place.score()
    assert "the sheet missing" in shown(capfd)


# Session 06's ruling 14:20: a model-space sheet's export boxes are scaled by key paper / export paper.

FRAME = [0.0, 0.0, 1000.0, 700.0]


def model_space(place: Place, key_paper: object, export_paper: object) -> None:
    key = key_sheet(
        "Model", "QZ-901", "Invented plan", "first floor", [key_view(A_BOX, "Plan A")], frame=FRAME
    )
    if key_paper is not None:
        key["paper"] = key_paper
    half = [n / 2 for n in A_BOX]  # the export drew the sheet on paper half the key's size
    found = export_sheet(
        "Model", "QZ-901", "Invented plan", "first floor", [export_view(half, "Plan A")], box=FRAME
    )
    if export_paper is not None:
        found["paper"] = export_paper
    place.write_keys([key])
    place.write_run([found])


def test_a_model_space_sheets_boxes_are_scaled_by_the_papers(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    model_space(place, [420, 297], [210, 148.5])

    place.score()
    out = shown(capfd)
    assert "views          1 / 1" in out, out
    assert "paper unknown" not in out


@pytest.mark.parametrize(("key_paper", "export_paper"), [(None, [210, 148.5]), ([420, 297], None)])
def test_a_model_space_sheet_missing_paper_is_unscaled_and_says_so(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], key_paper: object, export_paper: object
) -> None:
    place = Place(tmp_path)
    model_space(place, key_paper, export_paper)

    place.score()
    out = shown(capfd)
    assert "paper unknown" in out, out
    assert "views          0 / 1" in out, out


def test_a_layout_sheets_boxes_are_never_scaled(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    half = [n / 2 for n in A_BOX]
    key = plan(paper=[420, 297])
    found = found_plan([export_view(half, "Plan A")]) | {"paper": [210, 148.5]}
    one_sheet(place, key, found)

    place.score()
    out = shown(capfd)
    assert "views          0 / 1" in out, out
    assert "paper unknown" not in out


def test_numbers_too_large_for_a_float_are_unusable_not_a_failure(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Fix round 1's refuter (20): an overflowing paper or box ended the call with exit 3, which a
    caller could tell from an answer."""
    place = Place(tmp_path)
    model_space(place, [10**400, 297], [210, 148.5])
    document = json.loads(next(place.run.glob("export-*.json")).read_text())
    assert document  # the export is the run's; only the key's paper overflows

    assert place.score() == 0
    assert "paper unknown" in shown(capfd)


# Ticket 24f: the edges its acceptance tests leave open.

HEAD = "5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123"  # the head `Place` writes
EARLIER = f"20260928T090000Z-{HEAD[:12]}-cafe"  # an earlier run of the same head


def recorded_export_run(place: Place, export_run: object, *, named: str = EARLIER) -> None:
    """A run whose export names `named` and whose metadata records `export_run` for it."""
    place.write_keys([plan()])
    place.write_run([found_plan()], export_run_id=named)
    metadata = json.loads((place.run / "metadata.json").read_text())
    metadata["sets"]["invented-set"]["export_run"] = export_run
    (place.run / "metadata.json").write_text(json.dumps(metadata))


def test_an_export_of_the_recorded_earlier_run_is_scored(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    recorded_export_run(place, {"id": EARLIER, "commit": HEAD})

    assert place.score() == 0
    assert "sheet 1 (layout Sheet A): pass" in shown(capfd)


@pytest.mark.parametrize(
    "export_run",
    [
        "QZ-NOT-A-RUN",
        {"id": EARLIER},
        {"id": "QZ-NOT-A-RUN", "commit": HEAD},
        {"id": EARLIER, "commit": "QZ"},
        {"id": f"20260928T090000Z-{'0' * 12}-cafe", "commit": HEAD},  # the id is another head's
    ],
    ids=["not-an-object", "no-commit", "not-a-run-id", "not-a-commit", "another-head"],
)
def test_a_recorded_export_run_that_is_not_a_run_and_its_head_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], export_run: object
) -> None:
    place = Place(tmp_path)
    recorded_export_run(place, export_run)

    assert place.score() == score.REFUSED
    out = shown(capfd)
    assert "export_run" in out, out
    assert "QZ" not in out, out


def test_a_recorded_export_run_is_the_only_run_the_export_may_name(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Once the metadata records an earlier run, an export naming this run itself is not that export."""
    place = Place(tmp_path)
    recorded_export_run(place, {"id": EARLIER, "commit": HEAD}, named=RUN_ID)

    assert place.score() == score.REFUSED
    assert "names another run" in shown(capfd)


@pytest.mark.parametrize(
    ("key", "stated"),
    [
        (["3rd", "5th floor"], "(3RD), 5TH FLOOR."),
        ("3rd and 5th floor", "3rd, 5th floor"),
        (["Grand hall"], "grand hall"),  # "and" inside a word separates nothing
        (["1st-floor"], "1st-floor"),
        ([], ", &"),
        ([None, ""], None),
    ],
    ids=["punctuation", "string-key", "and-in-a-word", "inner-hyphen", "separators-only", "empties"],
)
def test_storeys_fold_punctuation_and_separators(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], key: object, stated: object
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place, plan(storeys=key), found_plan(storeys_as_stated={"value": stated, "source": "file"})
    )

    place.score()
    assert "sheet 1 (layout Sheet A): pass" in shown(capfd)


def test_a_hyphen_inside_a_storey_is_kept(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        plan(storeys=["1st-floor"]),
        found_plan(storeys_as_stated={"value": "1st floor", "source": "file"}),
    )

    place.score()
    assert "storeys wrong" in shown(capfd)


def test_a_model_space_key_sheet_with_no_frame_joins_a_lone_model_space_sheet(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    found = found_plan()
    found["location"] = {"layout": None, "box": A_BOX}
    one_sheet(place, plan(layout="MODEL"), found)

    place.score()
    out = shown(capfd)
    assert "sheet 1: pass" in out, out


def test_a_layout_key_sheet_never_joins_a_model_space_sheet(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    found = found_plan()
    found["location"] = {"layout": None, "box": A_BOX}
    one_sheet(place, plan(frame=A_BOX), found)

    place.score()
    out = shown(capfd)
    assert "the sheet missing" in out, out
    assert "extra sheets 1" in out, out


def test_a_refusal_with_a_log_that_cannot_be_written_says_only_that(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    one_sheet(place, plan(), found_plan())

    code = score.main(
        ["QZ-NOT-A-RUN"], drop=place.drop, keys=place.keys, log=Path("/dev/full"), writer=os.getuid()
    )

    output = capfd.readouterr()
    assert code == score.REFUSED
    assert output.out == ""
    assert output.err == score.UNLOGGED + "\n"


# The 24f refuter (50): an export value that failed the call only when its sheet joined a key sheet told
# a Held-out Set's layout and frame by the exit code. Every value is now normalised before the join.

DEEP = "[" * 60000 + "]" * 60000  # past the recursion limit, whatever normalises it


def poisoned(place: Place, where: str) -> None:
    """The run's one export sheet (null layout, at A_BOX), with one value no scorer could normalise."""
    found = found_plan(views=[export_view(A_BOX, "Plan A")])
    found["location"] = {"layout": None, "box": A_BOX}
    if where == "views":
        found["views"] = 1
    elif where == "location":
        found["location"] = "QZ-POISON"
    else:
        found[where] = {"value": "QZ-POISON", "source": "file"}
    export = place.write_run([found])
    data = export.read_bytes().replace(b'"QZ-POISON"', DEEP.encode())
    export.write_bytes(data)
    metadata = json.loads((place.run / "metadata.json").read_text())
    metadata["sets"]["invented-set"]["export_sha256"] = hashlib.sha256(data).hexdigest()
    (place.run / "metadata.json").write_text(json.dumps(metadata))


@pytest.mark.parametrize(
    "where", ["views", "storeys_as_stated", "number", "title", "revision_mark", "location"]
)
def test_what_an_export_does_to_the_call_never_depends_on_whether_its_sheet_joins(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], where: str
) -> None:
    answers = []
    for frame in (A_BOX, B_BOX):  # the key sheet joins the export sheet, then it does not
        place = Place(tmp_path / str(frame[0]))
        place.root.mkdir()
        place.write_keys([plan(layout="model", frame=frame)], held_out=True)
        poisoned(place, where)
        code = place.score()
        out = shown(capfd).replace(str(tmp_path / str(frame[0])), "")
        answers.append((code, out))

    assert answers[0] == answers[1], answers
