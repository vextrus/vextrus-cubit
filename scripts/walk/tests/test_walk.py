"""The builder's tests for scripts/walk beyond the pinned acceptance tests (synthetic data only).

They pin the fail-closed choices the ticket leaves to the builder: a refused verdict stands as a
not-PASS in ready.py's order, a smoke walk is never judged as a verdict, a re-walk keeps the older
verdict, an unmeasured false-continuation count fails its check, the leak scan fails closed when it
cannot run, and run.py never hands a child the owner's database URL.
"""

import contextlib
import json
import os
import subprocess
import sys
import time
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
    walks, expect_dir, folder = _lay_out(tmp_path, _walk(started_at="2026-10-05T00:00:00Z"))

    assert _cli(walks, expect_dir).returncode == 0
    first = json.loads((folder / "verdict.json").read_text())
    run.set_aside(folder)  # what run.py does before a new walk of the same head
    assert not (folder / "findings.json").exists()  # the re-walk's agent layer writes its own
    (folder / "walk.json").write_text(json.dumps(_walk(started_at="2026-10-05T00:30:00Z")))
    (folder / "findings.json").write_text(json.dumps(LAYER))
    assert _cli(walks, expect_dir).returncode == 0

    stamp = first["finished_at"].replace("-", "").replace(":", "")
    assert json.loads((folder / f"verdict.{stamp}.json").read_text()) == first
    assert json.loads((folder / "verdict.json").read_text())["started_at"] == "2026-10-05T00:30:00Z"


# One walk, one judgement (review round 1 of #293: a re-judged walk counted as a second walk).


def test_one_walk_judged_twice_is_not_two_passes(tmp_path: Path) -> None:
    repo, (sha,) = _repo(tmp_path, ["docs/a.md"])
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(EXPECT["set-a"]))
    folder = walks / sha
    folder.mkdir(parents=True)
    (folder / "walk.json").write_text(json.dumps(_walk(sha=sha, started_at=_a_minute_ago())))
    (folder / "findings.json").write_text(json.dumps(LAYER))

    assert _cli_for(sha, walks, expect_dir).returncode == 0
    again = _cli_for(sha, walks, expect_dir)

    assert again.returncode == 2
    assert [p.name for p in folder.glob("verdict*.json")] == ["verdict.json"]
    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_fail_rejudged_against_new_expectations_stays_one_fail(tmp_path: Path) -> None:
    repo, (sha,) = _repo(tmp_path, ["docs/a.md"])
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    expect_dir.mkdir()  # no expectation yet: UNSET, so FAIL
    folder = walks / sha
    folder.mkdir(parents=True)
    (folder / "walk.json").write_text(json.dumps(_walk(sha=sha, started_at=_a_minute_ago())))
    (folder / "findings.json").write_text(json.dumps(LAYER))

    assert _cli_for(sha, walks, expect_dir).returncode == 1
    (expect_dir / "set-a.json").write_text(json.dumps(EXPECT["set-a"]))
    assert _cli_for(sha, walks, expect_dir).returncode == 2
    assert _cli_for(sha, walks, expect_dir).returncode == 2

    assert json.loads((folder / "verdict.json").read_text())["result"] == "FAIL"
    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_walk_with_no_start_is_judged_only_into_an_empty_folder(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path, _walk())

    assert _cli(walks, expect_dir).returncode == 0
    (folder / "walk.json").touch()  # a new mtime is not a new walk

    assert _cli(walks, expect_dir).returncode == 2
    assert [p.name for p in folder.glob("verdict*.json")] == ["verdict.json"]


def _a_minute_ago() -> str:
    import time

    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 60))


def _cli_for(sha: str, walks: Path, expect_dir: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.walk.verdict",
            sha,
            "--leak-hits",
            "0",
            "--walks-dir",
            str(walks),
            "--expect-dir",
            str(expect_dir),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


# ready.py ----------------------------------------------------------------------------------------


COMMITTED = "2026-10-05T00:00:00Z"
"""Every test commit's author and committer time: before the verdicts' fixed times, so a test
never depends on the wall clock (ready.py drops a verdict that finished long before its head)."""


def _git(repo: Path, *args: str) -> str:
    env = {**os.environ, "GIT_AUTHOR_DATE": COMMITTED, "GIT_COMMITTER_DATE": COMMITTED}
    command = ["git", "-C", str(repo), *args]
    done = subprocess.run(command, capture_output=True, text=True, check=True, env=env)
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


def test_a_rewalks_older_verdict_does_not_end_the_hold(tmp_path: Path) -> None:
    import os
    import time

    (tmp_path / "verdict.json").write_text("{}")
    os.utime(tmp_path / "verdict.json", (1, 1))
    since = time.time()

    assert run.verdict_written(tmp_path, since) is False
    (tmp_path / "verdict.json").write_text("{}")
    assert run.verdict_written(tmp_path, since - 1) is True


def test_an_earlier_walk_json_moves_aside(tmp_path: Path) -> None:
    (tmp_path / "walk.json").write_text("{}")

    run.set_aside(tmp_path)

    assert not (tmp_path / "walk.json").exists()
    assert len(list(tmp_path.glob("walk.*.json"))) == 1


def test_an_issue_number_that_could_carry_text_is_refused() -> None:
    finding = {
        "id": "f-1",
        "item": "M0-FL5",
        "defect_class": "crash",
        "screen": "rail",
        "delta": None,
        "severity": "OTHER",
        "misleading": False,
    }
    hidden = int.from_bytes(PLANTED.encode())

    with pytest.raises(issues.Refused):
        issues.draft([finding], [{"number": hidden, "key": "crash/rail"}], sha=SHA, scan=lambda t: 0)
    with pytest.raises(verdict.Malformed):
        verdict.evaluate(
            _walk(),
            EXPECT,
            {**LAYER, "findings": [{**finding, "issue": hidden, "dedup_comment_on": None}]},
            ref="main",
            leak_hits=0,
            **TIMES,
        )


def test_deeply_nested_json_is_bad_input_not_a_crash(tmp_path: Path) -> None:
    deep = tmp_path / "deep.json"
    deep.write_text("[" * 100_000)

    done = subprocess.run(
        [sys.executable, "-m", "scripts.walk.sanitize", str(deep)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert done.returncode == 2


# ready.py, the second refuter pass ---------------------------------------------------------------


def _two_passes(tmp_path: Path) -> tuple[Path, Path, str, str]:
    repo, (c1, c2) = _repo(tmp_path, ["vextrus/a.py", "docs/b.md"])
    walks = tmp_path / "walks"
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T01:00:00Z"))
    return repo, walks, c1, c2


def _forge_numbers(body: dict[str, Any], case: str) -> None:
    checks = {c["check"]: c for c in body["checks"]}
    if case == "slow-acts-marked-pass":
        checks["act_p95_during_read"]["measured"] = {"p95_ms": 5000, "samples": 9}
    elif case == "a-file-unread-marked-pass":
        checks["reads_complete"]["measured"] = {"files": 2, "completed": 1}
        checks["reads_complete"]["expected"] = {"files": 2}
    elif case == "never-measured-marked-pass":
        checks["act_p95_during_read"]["measured"] = {"samples": 0}
    elif case == "burden-over-its-limits":
        body["burden"][0].update(
            questions_by_kind={"low_confidence": 40},
            bulk_confirmable_sheets=0,
            false_continuation_questions=7,
        )
    elif case == "burden-for-a-set-never-checked":
        body["burden"].append({**body["burden"][0], "set": "set-b"})


@pytest.mark.parametrize(
    "case",
    [
        "slow-acts-marked-pass",
        "a-file-unread-marked-pass",
        "never-measured-marked-pass",
        "burden-over-its-limits",
        "burden-for-a-set-never-checked",
    ],
)
def test_a_pass_its_own_numbers_contradict_is_refused(tmp_path: Path, case: str) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    forged = _verdict(c2, "PASS", "2026-10-05T02:00:00Z")
    _forge_numbers(forged, case)
    _put(walks, c2, forged)

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


@pytest.mark.parametrize(
    "text", ['{"p95_ms": NaN}', '{"result": "FAIL", "result": "PASS"}'], ids=["nan", "a-key-twice"]
)
def test_json_a_strict_reader_refuses_is_malformed(tmp_path: Path, text: str) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    (walks / c2 / "verdict.20261005T030000Z.json").write_text(text)

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


@pytest.mark.parametrize(
    "place", ["verdict.json.bak", "Verdict.json", "old/verdict.json", "<sha>.bak/verdict.json"]
)
def test_a_misnamed_or_misplaced_verdict_is_malformed(tmp_path: Path, place: str) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    target = walks / c2 / place.replace("<sha>", f"../{c2}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(_verdict(c2, "FAIL", "2026-10-05T03:00:00Z")))

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_a_tag_and_a_branch_of_one_name_must_agree(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    _git(repo, "tag", "main", c2)
    (repo / "vextrus").mkdir(exist_ok=True)
    (repo / "vextrus" / "c.py").write_text("c")
    _git(repo, "add", "--", "vextrus/c.py")
    _git(repo, "commit", "-q", "--no-verify", "-m", "c")

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_a_product_directory_itself_is_a_product_path() -> None:
    assert ready.is_product_path("engine")
    assert ready.is_product_path("web/src")
    assert not ready.is_product_path("engineering.md")


def test_a_relative_diff_setting_cannot_hide_product_changes(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    (repo / "vextrus" / "c.py").write_text("c")
    _git(repo, "add", "--", "vextrus/c.py")
    _git(repo, "commit", "-q", "--no-verify", "-m", "c")
    _git(repo, "config", "diff.relative", "true")

    assert ready.ready("main", walks_dir=walks, repo=repo / "docs").ok is False


def test_a_pass_on_a_sha_the_repository_lacks_is_refused(tmp_path: Path) -> None:
    repo, walks, c1, _ = _two_passes(tmp_path)
    blob = _git(repo, "rev-parse", "HEAD:docs/b.md")
    _put(walks, blob, _verdict(blob, "PASS", "2026-10-05T01:30:00Z"))
    head = _git(repo, "rev-parse", "HEAD")
    _put(walks, head, _verdict(head, "PASS", "2026-10-05T02:00:00Z"))
    (walks / c1 / "verdict.json").unlink()

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_the_agent_layers_sign_in_is_owner_only_and_outside_the_walk(tmp_path: Path) -> None:
    import stat

    path = tmp_path / ".private" / "work" / "factory" / "g1.sign-in"

    run.write_sign_in(path, PLANTED)
    run.write_sign_in(path, PLANTED)  # a stale one is replaced

    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert json.loads(path.read_text()) == {"email": run.QS_EMAIL, "password": PLANTED}
    assert "walks" not in path.parts


def test_a_signal_interrupts_the_walk_but_ends_the_hold_quietly() -> None:
    import os
    import signal

    stopping: list[bool] = []
    with pytest.raises(KeyboardInterrupt), run._signals(stopping, []):
        os.kill(os.getpid(), signal.SIGTERM)
    assert stopping == [True]

    stopping.clear()
    with run._signals(stopping, [True]):
        os.kill(os.getpid(), signal.SIGTERM)
    assert stopping == [True]


# ready.py, the third refuter pass ----------------------------------------------------------------


def test_an_unreadable_walk_folder_is_malformed(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "FAIL", "2026-10-05T02:00:00Z"))
    (walks / c2).chmod(0)
    try:
        with pytest.raises(ready.Unreadable):
            ready.ready("main", walks_dir=walks, repo=repo)
    finally:
        (walks / c2).chmod(0o755)


@pytest.mark.parametrize(
    "place",
    ["old-<sha>/verdict.json", ".<sha>/verdict.json", "verdict.json", "archive/<sha>/verdict.json"],
)
def test_a_verdict_outside_its_walk_folder_is_malformed(tmp_path: Path, place: str) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    target = walks / place.replace("<sha>", c2)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(_verdict(c2, "FAIL", "2026-10-05T03:00:00Z")))

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_a_link_inside_a_walk_folder_is_malformed(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    hidden = tmp_path / "hidden"
    hidden.mkdir()
    (hidden / "verdict.json").write_text(json.dumps(_verdict(c2, "FAIL", "2026-10-05T03:00:00Z")))
    (walks / c2 / "old").symlink_to(hidden)

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_one_walk_filed_under_two_heads_is_one_walk(tmp_path: Path) -> None:
    repo, walks, c1, c2 = _two_passes(tmp_path)
    copied = _verdict(c1, "PASS", "2026-10-05T01:00:00Z")
    copied["sha"] = c2
    _put(walks, c2, copied)

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_pass_filed_under_a_tag_object_is_refused(tmp_path: Path) -> None:
    repo, walks, c1, c2 = _two_passes(tmp_path)
    _git(repo, "tag", "-a", "-m", "a tag", "t1", c1)
    tag = _git(repo, "rev-parse", "t1")
    (walks / c1 / "verdict.json").unlink()
    _put(walks, tag, _verdict(tag, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


# ready.py, the fourth refuter pass ---------------------------------------------------------------


def test_a_disciplines_row_listed_twice_is_refused(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    walk = _walk(sha=c2)
    walk["sets"]["set-a"]["questions"]["architectural"] = {"low_confidence": 1}
    walk["sets"]["set-a"]["burden"]["architectural"] = {
        **walk["sets"]["set-a"]["burden"]["structural"],
        "false_continuation_questions": 7,
    }
    failing = verdict.evaluate(
        walk,
        EXPECT,
        LAYER,
        ref="main",
        leak_hits=0,
        started_at=TIMES["started_at"],
        finished_at="2026-10-05T02:00:00Z",
    )
    assert failing["result"] == "FAIL"
    forged = {**failing, "result": "PASS"}
    forged["checks"] = [{**c, "status": "PASS"} for c in failing["checks"]]
    forged["burden"] = [failing["burden"][1], failing["burden"][1]]  # structural twice, no architectural
    _put(walks, c2, forged)

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_submodule_change_cannot_hide_behind_config(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    _git(repo, "update-index", "--add", "--cacheinfo", f"160000,{c2},engine/core")
    _git(repo, "commit", "-q", "--no-verify", "-m", "a submodule")
    _git(repo, "config", "diff.ignoreSubmodules", "all")

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


def test_a_fifo_in_a_walk_folder_is_malformed_not_a_hang(tmp_path: Path) -> None:
    import os

    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    os.mkfifo(walks / c2 / "verdict-z.json")

    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)


def test_an_older_pass_off_the_refs_history_is_not_counted_as_mains(tmp_path: Path) -> None:
    repo, (c1,) = _repo(tmp_path, ["vextrus/a.py"])
    _git(repo, "checkout", "-q", "-b", "feature")
    (repo / "docs").mkdir()
    (repo / "docs" / "f.md").write_text("f")
    _git(repo, "add", "--", "docs/f.md")
    _git(repo, "commit", "-q", "--no-verify", "-m", "f")
    feature = _git(repo, "rev-parse", "HEAD")
    _git(repo, "checkout", "-q", "main")
    walks = tmp_path / "walks"
    _put(walks, feature, _verdict(feature, "PASS", "2026-10-05T01:00:00Z"))
    _put(walks, c1, _verdict(c1, "PASS", "2026-10-05T02:00:00Z"))

    assert ready.ready("main", walks_dir=walks, repo=repo).ok is False


# T-WALK-1: the walk lock, the group kill and the drop ---------------------------------------------


def test_the_walk_lock_never_trips_ready(tmp_path: Path) -> None:
    repo, walks, c1, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    for sha in (c1, c2):
        with verdict.walk_lock(walks / sha):
            pass

    assert (walks / c2 / verdict.LOCK_NAME).exists()
    assert ready.ready("main", walks_dir=walks, repo=repo).ok is True


def test_a_verdict_of_a_missing_walk_folder_makes_no_folder(tmp_path: Path) -> None:
    walks = tmp_path / "walks"
    walks.mkdir()

    assert verdict.main(["0" * 40, "--leak-hits", "0", "--walks-dir", str(walks)]) == 2
    assert list(walks.iterdir()) == []


def test_ending_a_group_kills_a_grandchild_its_leader_left(tmp_path: Path) -> None:
    import signal

    leader = subprocess.Popen(
        ["sh", "-c", "sleep 120 >/dev/null & echo $!"],
        stdout=subprocess.PIPE,
        start_new_session=True,
    )
    # The leader exits normally; its grandchild lives on.
    grandchild = int(leader.communicate(timeout=10)[0])
    try:
        run.end_groups([leader], grace=1)
        state = ""
        for _ in range(100):
            try:
                state = Path(f"/proc/{grandchild}/stat").read_text().rsplit(")", 1)[1].split()[0]
            except OSError:
                state = "gone"
            if state in {"gone", "Z"}:
                break
            time.sleep(0.05)
        assert state in {"gone", "Z"}
    finally:
        with contextlib.suppress(ProcessLookupError):
            os.kill(grandchild, signal.SIGKILL)


def test_the_drop_hands_psql_no_pg_setting(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    seen = tmp_path / "seen.txt"
    psql = bin_dir / "psql"
    psql.write_text(f'#!/bin/sh\nenv | grep "^PG" > "{seen}"\nexit 0\n')
    psql.chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("PGDATABASE", "vextrus")
    monkeypatch.setenv("PGPASSFILE", str(tmp_path / "pass"))
    walk = run.Plan(
        sha="0" * 40,
        sha8="0" * 8,
        db_name=f"{run.DB_PREFIX}{'0' * 8}",
        out_dir=tmp_path / "out",
        worktree=tmp_path / "src",
        web_port=5511,
        api_port=8811,
    )

    run.drop_database(walk, tmp_path / "logs" / "drop.txt")

    assert seen.read_text().splitlines() == [f"PGPASSFILE={tmp_path / 'pass'}"]


def test_the_lock_clears_a_dead_runs_temporary_verdict(tmp_path: Path) -> None:
    repo, walks, _, c2 = _two_passes(tmp_path)
    _put(walks, c2, _verdict(c2, "PASS", "2026-10-05T02:00:00Z"))
    left = walks / c2 / ".verdict.json.dead.tmp"  # a run killed between its write and its rename
    left.write_text("{")
    with pytest.raises(ready.Unreadable):
        ready.ready("main", walks_dir=walks, repo=repo)

    with verdict.walk_lock(walks / c2):
        pass

    assert not left.exists()
    assert ready.ready("main", walks_dir=walks, repo=repo).ok is True


def test_a_verdict_that_cannot_be_written_is_an_error_not_a_fail(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path, _walk(started_at="2026-10-05T00:00:00Z"))

    def full(path: Path, data: Any) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(verdict, "write_atomic", full)
    argv = [SHA, "--leak-hits", "0"]
    argv += ["--walks-dir", str(walks), "--expect-dir", str(expect_dir)]

    assert verdict.main(argv) == 2
    assert not (folder / "verdict.json").exists()
