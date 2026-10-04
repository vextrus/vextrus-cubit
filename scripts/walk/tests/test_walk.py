"""The builder's tests for scripts/walk beyond the pinned acceptance tests (synthetic data only).

They pin the fail-closed choices the ticket leaves to the builder: a refused verdict stands as a
not-PASS in ready.py's order, a smoke walk is never judged as a verdict, a re-walk keeps the older
verdict, an unmeasured false-continuation count fails its check, the leak scan fails closed when it
cannot run, and run.py never hands a child the owner's database URL.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import issues, ready, run, sanitize, schema, verdict

ROOT = Path(__file__).resolve().parents[3]
SHA = "0123456789abcdef0123456789abcdef01234567"
PLANTED = "SYNTHETIC-PLANTED-QQ"
TIMES = {"started_at": "2026-10-05T01:00:00Z", "finished_at": "2026-10-05T02:00:00Z"}


def _walk(**change: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "schema": 1,
        "sha": SHA,
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {
            "set-a": {
                "files": [{"id": 1, "state": "done", "read_seconds": 3}],
                "acts": [{"kind": "confirm", "ms": 50, "read_running": True}],
                "questions": {"structural": {"low_confidence": 1}},
                "burden": {
                    "structural": {
                        "sheets": 4,
                        "one_source": 0,
                        "bulk_confirmable": 4,
                        "continuation_questions": 0,
                        "false_continuation_questions": 0,
                    }
                },
            }
        },
    }
    body.update(change)
    return body


EXPECT = {
    "set-a": {
        "files": 1,
        "p95_ms_max": 1000,
        "questions_max_per_discipline": 3,
        "bulk_confirmable_share_min": 0.8,
        "false_continuation_max": 0,
    }
}
LAYER = {"items": [{"item": i, "status": "PASS"} for i in sanitize.ITEMS], "findings": []}


def _evaluate(walk: dict[str, Any]) -> dict[str, Any]:
    return verdict.evaluate(walk, EXPECT, LAYER, ref="main", leak_hits=0, **TIMES)


# verdict.py --------------------------------------------------------------------------------------


def test_an_unmeasured_false_continuation_count_fails_its_check() -> None:
    walk = _walk()
    walk["sets"]["set-a"]["burden"]["structural"]["false_continuation_questions"] = None

    judged = _evaluate(walk)

    [check] = [c for c in judged["checks"] if c["check"] == "questions_per_discipline"]
    assert check["status"] == "FAIL"
    assert judged["result"] == "FAIL"
    assert schema.verdict_errors(judged) == []


def test_a_walk_that_breaks_its_schema_is_not_judged() -> None:
    walk = _walk()
    walk["sets"]["set-a"]["files"][0]["name"] = PLANTED

    with pytest.raises(verdict.Malformed):
        _evaluate(walk)


def test_a_discipline_key_that_is_not_a_code_is_not_judged() -> None:
    walk = _walk()
    walk["sets"]["set-a"]["questions"] = {PLANTED: {"low_confidence": 1}}

    with pytest.raises(verdict.Malformed):
        _evaluate(walk)


def test_an_expectation_with_an_unknown_key_is_not_judged() -> None:
    with pytest.raises(verdict.Malformed):
        verdict.evaluate(
            _walk(), {"set-a": {**EXPECT["set-a"], "note": 1}}, LAYER, ref="main", leak_hits=0, **TIMES
        )


def test_a_finding_with_a_free_text_key_is_not_judged() -> None:
    finding = {
        "id": "f-1",
        "item": "M0-FL3",
        "defect_class": "other",
        "screen": "projects",
        "delta": None,
        "severity": "OTHER",
        "misleading": False,
        "issue": 3,
        "dedup_comment_on": None,
        "title": PLANTED,
    }
    with pytest.raises(verdict.Malformed):
        verdict.evaluate(
            _walk(), EXPECT, {**LAYER, "findings": [finding]}, ref="main", leak_hits=0, **TIMES
        )


def _cli(walks: Path, expect_dir: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.walk.verdict",
            SHA,
            "--leak-hits",
            "0",
            "--walks-dir",
            str(walks),
            "--expect-dir",
            str(expect_dir),
            *extra,
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def _lay_out(tmp_path: Path, walk: dict[str, Any]) -> tuple[Path, Path, Path]:
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    folder = walks / SHA
    folder.mkdir(parents=True)
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(EXPECT["set-a"]))
    (folder / "walk.json").write_text(json.dumps(walk))
    (folder / "findings.json").write_text(json.dumps(LAYER))
    return walks, expect_dir, folder


def test_a_smoke_walk_is_never_written_as_a_verdict(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path, _walk(smoke=True))

    refused = _cli(walks, expect_dir)
    assert refused.returncode == 2
    assert not (folder / "verdict.json").exists()

    smoke = _cli(walks, expect_dir, "--smoke")
    assert smoke.returncode == 0, smoke.stderr
    assert not (folder / "verdict.json").exists()
    assert json.loads((folder / "smoke-verdict.json").read_text())["smoke"] is True


def test_only_a_smoke_walk_is_judged_with_smoke(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path, _walk())

    assert _cli(walks, expect_dir, "--smoke").returncode == 2
    assert not (folder / "smoke-verdict.json").exists()


def test_a_rewalk_keeps_the_older_verdict(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path, _walk())

    assert _cli(walks, expect_dir).returncode == 0
    first = json.loads((folder / "verdict.json").read_text())
    assert _cli(walks, expect_dir).returncode == 0

    stamp = first["finished_at"].replace("-", "").replace(":", "")
    assert json.loads((folder / f"verdict.{stamp}.json").read_text()) == first
    assert (folder / "verdict.json").exists()


# ready.py ----------------------------------------------------------------------------------------


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def _repo(tmp_path: Path, paths: list[str]) -> tuple[Path, list[str]]:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "walk-test@example.invalid")
    _git(repo, "config", "user.name", "walk test")
    _git(repo, "config", "commit.gpgsign", "false")
    shas = []
    for path in paths:
        (repo / path).parent.mkdir(parents=True, exist_ok=True)
        (repo / path).write_text(path)
        _git(repo, "add", "--", path)
        _git(repo, "commit", "-q", "--no-verify", "-m", path)
        shas.append(_git(repo, "rev-parse", "HEAD"))
    return repo, shas


def _verdict(sha: str, result: str, finished_at: str) -> dict[str, Any]:
    walk = _walk(sha=sha)
    if result == "FAIL":
        walk["sets"]["set-a"]["acts"][0]["ms"] = 5000
    return verdict.evaluate(
        walk,
        EXPECT,
        LAYER,
        ref="main",
        leak_hits=0,
        started_at=TIMES["started_at"],
        finished_at=finished_at,
    )


def _put(walks: Path, sha: str, body: Any, name: str = "verdict.json") -> None:
    (walks / sha).mkdir(parents=True, exist_ok=True)
    (walks / sha / name).write_text(json.dumps(body))


def test_a_refused_verdict_between_two_passes_is_never_skipped(tmp_path: Path) -> None:
    repo, (c1, c2, c3) = _repo(tmp_path, ["vextrus/a.py", "vextrus/b.py", "docs/c.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    forged = {**_verdict(c2, "FAIL", "2026-10-05T02:00:00Z"), "smoke": True}
    _put(walks, c2, forged)
    _put(walks, c3, _verdict(c3, "PASS", "2026-10-05T03:00:00Z"))

    answer = ready.ready("main", walks_dir=walks, repo=repo)

    assert answer.ok is False


def test_a_fail_at_the_same_time_as_a_pass_stands_newer(tmp_path: Path) -> None:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    _put(walks, c2, _verdict(c2, "FAIL", "2026-10-05T02:00:00Z"), "verdict.20261005T020000Z.json")

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_pass_missing_a_check_for_a_set_is_refused(tmp_path: Path) -> None:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    thin = _verdict(c2, "PASS", "2026-10-05T02:00:00Z")
    thin["checks"] = thin["checks"][:1]
    assert schema.verdict_errors(thin) == []  # the contract alone would let it through
    _put(walks, c2, thin)

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_smoke_verdict_file_is_never_read(tmp_path: Path) -> None:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"), "smoke-verdict.json")

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_fail_on_a_head_the_ref_lacks_is_never_skipped(tmp_path: Path) -> None:
    repo, (c1, c2, c3) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md", "vextrus/c.py"])
    _git(repo, "branch", "stale", c2)
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T03:00:00Z"))
    _put(walks, c3, _verdict(c3, "FAIL", "2026-10-05T05:00:00Z"))
    _put(walks, "f" * 40, _verdict("f" * 40, "FAIL", "2026-10-05T06:00:00Z"))  # a head never fetched

    assert ready.ready("stale", walks_dir=walks, repo=repo).ok is False


def test_a_copy_of_one_walk_is_not_two_walks(tmp_path: Path) -> None:
    repo, (c1,) = _repo(tmp_path, ["vextrus/a.py"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"), "verdict-copy.json")

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


@pytest.mark.parametrize("case", ["started-after-finished", "finished-before-its-commit"])
def test_impossible_times_are_refused(tmp_path: Path, case: str) -> None:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    odd = _verdict(c2, "PASS", "2026-10-05T02:00:00Z")
    if case == "started-after-finished":
        odd["started_at"] = "2026-10-05T03:00:00Z"
    else:
        odd["started_at"] = odd["finished_at"] = "2000-01-01T00:00:00Z"
    _put(walks, c2, odd)

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_an_upper_case_sha_folder_is_malformed(tmp_path: Path) -> None:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    _put(walks, c2.upper(), _verdict(c2, "FAIL", "2026-10-05T03:00:00Z"))

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_a_ref_starting_with_a_dash_is_refused(tmp_path: Path) -> None:
    repo, _ = _repo(tmp_path, ["docs/a.md"])

    with pytest.raises(ready.Unreadable):
        ready.ready("--all", walks_dir=tmp_path / "walks", repo=repo)


# issues.py and sanitize.py -----------------------------------------------------------------------


def test_the_leak_scan_fails_closed_when_it_cannot_run(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        issues.leakscan_text("anything", root=tmp_path)  # no tools.leakscan there


def test_a_hostile_marker_gives_no_key() -> None:
    assert issues.key_of(f"<!-- walk-key: {PLANTED}/projects -->") is None
    assert issues.key_of("<!-- walk-key: other/projects\n-->") is None
    assert issues.key_of("<!-- walk-key: other/projects -->") == "other/projects"


def _triage_folder(tmp_path: Path, items: list[dict[str, Any]] | None = None) -> Path:
    folder = tmp_path / SHA
    findings = [
        {
            "id": f"f-{n}",
            "item": "M0-FL5",
            "defect_class": cls,
            "screen": "takeoff.step1",
            "delta": None,
            "severity": "OTHER",
            "misleading": False,
        }
        for n, cls in ((1, "other"), (2, "other"), (3, "crash"))
    ]
    folder.mkdir()
    triage = {"items": LAYER["items"] if items is None else items, "findings": findings}
    (folder / "triage.json").write_text(json.dumps(triage))
    open_issue = {"number": 9, "body": "- Walk: x\n<!-- walk-key: crash/takeoff.step1 -->"}
    (folder / "open-issues.json").write_text(json.dumps([open_issue]))
    return folder


def test_draft_then_record_fill_each_finding_and_keep_ids_private(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    folder = _triage_folder(tmp_path)
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)

    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path)]) == 0
    assert issues.main(["record", SHA, "--walks-dir", str(tmp_path), "--created", "1=41"]) == 0

    layer = json.loads((folder / "findings.json").read_text())
    by_id = {f["id"]: (f["issue"], f["dedup_comment_on"]) for f in layer["findings"]}
    assert by_id == {"f-1": (41, None), "f-2": (41, None), "f-3": (None, 9)}
    judged = verdict.evaluate(_walk(), EXPECT, layer, ref="main", leak_hits=0, **TIMES)
    assert judged["agent_layer"]["issues_drafted"] == 2
    assert judged["agent_layer"]["dedup_comments"] == 1
    public = "".join(f.read_text() for f in (folder / "public").iterdir())
    assert "f-1" not in public  # finding ids (critic-chosen) never reach the public folder


def test_record_rebuilds_the_items_from_closed_words(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    items = [{"item": "M0-FL1", "status": "PASS", "note": PLANTED}]
    _triage_folder(tmp_path, items)
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)

    assert issues.main(["draft", SHA, "--walks-dir", str(tmp_path)]) == 2
    assert not (tmp_path / SHA / "findings.json").exists()


@pytest.mark.parametrize("module", ["issues", "verdict", "ready", "run"])
def test_a_usage_error_never_echoes_the_command_line(module: str) -> None:
    done = subprocess.run(
        [sys.executable, "-m", f"scripts.walk.{module}", PLANTED, "--" + PLANTED.lower()],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert done.returncode == 2
    assert PLANTED not in done.stdout + done.stderr
    assert PLANTED.lower() not in done.stdout + done.stderr


def test_a_huge_integer_is_not_a_number() -> None:
    hidden = int.from_bytes(PLANTED.encode())

    assert sanitize.is_number(hidden) is False
    assert sanitize.is_number(-hidden) is False
    assert sanitize.is_number(10**400) is False  # no OverflowError either
    judged = _evaluate(_walk())
    judged["checks"][0]["measured"]["files"] = hidden
    assert str(hidden) not in json.dumps(sanitize.sanitize_walk(judged))


def test_the_summary_keeps_only_the_markets_disciplines() -> None:
    judged = _evaluate(_walk())
    judged["burden"][0]["discipline"] = "planted_qq"

    assert sanitize.sanitize_walk(judged)["burden"] == []


def test_the_summary_keeps_only_known_kinds_and_measures() -> None:
    judged = _evaluate(_walk())
    judged["burden"][0]["questions_by_kind"]["planted_kind"] = 2
    judged["checks"][0]["measured"]["planted_measure"] = 1

    summary = sanitize.sanitize_walk(judged)

    assert "planted_kind" not in json.dumps(summary)
    assert "planted_measure" not in json.dumps(summary)
    assert sanitize.sanitize_walk(summary) == summary


def test_the_checker_refuses_an_unknown_keyword() -> None:
    with pytest.raises(schema.SchemaUnknown):
        schema.errors({}, {"type": "object", "dependentRequired": {}})


# run.py ------------------------------------------------------------------------------------------


def test_a_child_never_gets_a_database_url_or_the_callers_password(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, (sha,) = _repo(tmp_path, ["docs/a.md"])
    monkeypatch.setenv("DATABASE_URL", "postgresql://synthetic@127.0.0.1/vextrus")
    monkeypatch.setenv("VEXTRUS_DEMO_PASSWORD", PLANTED)
    walk = run.plan(sha, root=repo, web_port=5511, api_port=8811)

    env = run._child_env(walk)

    assert "DATABASE_URL" not in env
    assert env.get("VEXTRUS_DEMO_PASSWORD") != PLANTED
    assert env["VEXTRUS_DB_NAME"] == f"vextrus_walk_{sha[:8]}"


def test_a_sha_not_in_the_repository_is_refused(tmp_path: Path) -> None:
    repo, _ = _repo(tmp_path, ["docs/a.md"])

    with pytest.raises(ValueError):  # noqa: PT011 (the refusal is the promise)
        run.plan("f" * 40, root=repo, web_port=5511, api_port=8811)


def test_a_sets_files_are_its_drawings_dwgs_first(tmp_path: Path) -> None:
    folder = tmp_path / ".private" / "reference" / "set-a"
    folder.mkdir(parents=True)
    for name in ("b.pdf", "a.dwg", "c.DWG", "notes.txt", "a.dwg:Zone.Identifier"):
        (folder / name).write_text("x")

    files = run.set_files(tmp_path, ["set-a"])

    assert [Path(f).name for f in files["set-a"]] == ["a.dwg", "c.DWG", "b.pdf"]


def test_the_events_line_is_f3s_form(tmp_path: Path) -> None:
    run.Events(tmp_path, SHA[:8])("check reads_complete PASS")
    run.Events(tmp_path, SHA[:8], smoke=True)("started")

    lines = (tmp_path / ".private" / "work" / "factory" / "events.log").read_text().splitlines()
    assert lines[0].endswith(f" WALK - {SHA[:8]} check reads_complete PASS")
    assert lines[1].endswith(f" WALK smoke {SHA[:8]} started")
