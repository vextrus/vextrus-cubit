"""Unit tests of S14-R2's seams in `scripts.factory.review`: the schema check, the
rerun store, the batched refuter's matching, the fix message from the kept findings, the guard brief
and the cloud hand-off's arguments."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import review, review_cloud

H = "a" * 40
BASE = "c" * 40


def finding(score: int = 60, line: int = 1, summary: str = "s", repro: Any = None) -> dict[str, Any]:
    return {"score": score, "file": "a.py", "line": line, "summary": summary, "repro": repro}


def answer(*items: dict[str, Any]) -> dict[str, Any]:
    return {"verdict": "FIX", "head": H, "findings": list(items), "report": "r"}


# ---------------------------------------------------------------- the schema check


def test_a_reply_in_the_review_schema_conforms() -> None:
    repro = {"test_file": "t.py", "command": "c", "expect_fail": True}
    assert review.conforms(answer(finding(), finding(repro=repro)), review.REVIEW_SCHEMA)


@pytest.mark.parametrize(
    "reply",
    [
        {"verdict": "FIX", "head": H, "findings": []},
        answer(finding(repro={"test_file": "t.py", "command": "c", "expect_fail": "yes"})),
        answer(finding(score=True)),
        answer(finding(line=-1)),
        answer(finding(score=101)),
        [answer()],
    ],
    ids=["no-report", "expect-fail-text", "score-bool", "negative-line", "score-101", "a-list"],
)
def test_a_reply_outside_the_review_schema_does_not_conform(reply: Any) -> None:
    assert not review.conforms(reply, review.REVIEW_SCHEMA)


def test_the_refuter_schema_needs_every_field_and_a_known_verdict() -> None:
    item = {
        "file": "a.py",
        "line": 1,
        "score": 60,
        "summary": "s",
        "verdict": "REFUTED",
        "evidence": "e",
    }
    assert review.conforms({"findings": [item]}, review.REFUTER_SCHEMA)
    assert not review.conforms({"findings": [{**item, "verdict": "FALSE"}]}, review.REFUTER_SCHEMA)
    assert not review.conforms({"findings": [{k: v for k, v in item.items() if k != "evidence"}]},
                               review.REFUTER_SCHEMA)  # fmt: skip


# ---------------------------------------------------------------- the model map and the caps


def test_the_lenses_run_on_the_owners_map_with_caps(tmp_path: Path) -> None:
    assert (review.LENS_A.model, review.LENS_B.model) == ("claude-opus-5-5", "claude-sonnet-5-5")
    assert review.WORDS.model == review.REFUTER.model == "claude-sonnet-5-5"
    for lens in (review.LENS_A, review.LENS_B, review.WORDS, review.REFUTER):
        command = review.lens_command(lens, tmp_path)
        at = command.index
        assert command[at("--effort") + 1] == "high"
        assert int(command[at("--max-turns") + 1]) > 0
        assert float(command[at("--max-budget-usd") + 1]) > 0
        assert "--no-session-persistence" in command


def test_the_refuter_is_read_only_and_answers_in_its_own_schema(tmp_path: Path) -> None:
    command = review.lens_command(review.REFUTER, tmp_path, review.REFUTER_SCHEMA)
    allowed = command[command.index("--allowedTools") + 1].split(",")
    assert not [tool for tool in allowed if tool.startswith(("Edit", "Write")) or tool == "Bash"]
    assert json.loads(command[command.index("--json-schema") + 1]) == review.REFUTER_SCHEMA


@pytest.mark.parametrize("raw", ["0", "-1", "ten", "1.5", "9999999"])
def test_a_malformed_lens_cap_is_bad_input(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv(review.TIMEOUT_ENV, raw)
    with pytest.raises(review.BadInput):
        review.lens_timeout()


def test_the_lens_cap_defaults_and_reads_seconds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(review.TIMEOUT_ENV, raising=False)
    assert review.lens_timeout() == review.LENS_TIMEOUT
    monkeypatch.setenv(review.TIMEOUT_ENV, "90")
    assert review.lens_timeout() == 90


# ---------------------------------------------------------------- reruns


# ---------------------------------------------------------------- the batched refuter


def every_path_strict(monkeypatch: pytest.MonkeyPatch) -> None:
    """The 50 bar on every path (an unreadable strict list): these tests pin the refuter's matching,
    not the sample (S17-F6's tests and `test_the_sample_*` below pin that)."""
    monkeypatch.setattr(ledger, "strict_paths", lambda: None)


def claims_run() -> review.Run:
    run = review.Run(pr=12, round_=1, head=H, merged=H, slot=1)
    run.findings = [
        review.Finding("l1-f1", 80, "a.py", 1, "replayed", "t.py", "CONFIRMED", "replay"),
        review.Finding("l1-f2", 60, "a.py", 2, "first at line 2", None, "UNPROVEN"),
        review.Finding("l2-f1", 55, "a.py", 2, "second at line 2", None, "UNPROVEN"),
        review.Finding("l2-f2", 70, "b.py", 9, "disputed", None, "UNPROVEN"),
        review.Finding("l2-f3", 30, "a.py", 3, "low", None, "-"),
    ]
    return run


def judged(file: str, line: int, summary: str, verdict: str) -> dict[str, Any]:
    return {"file": file, "line": line, "score": 60, "summary": summary, "verdict": verdict,
            "evidence": "e"}  # fmt: skip


def refuted_with(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, reply: Any
) -> tuple[review.Run, list[str]]:
    every_path_strict(monkeypatch)
    run = claims_run()
    prompts: list[str] = []

    def fake(lens: review.Lens, prompt: str, *_: Any, **__: Any) -> dict[str, Any]:
        assert lens is review.REFUTER
        prompts.append(prompt)
        return {"structured_output": reply, "total_cost_usd": 0.1}

    monkeypatch.setattr(review, "run_lens", fake)
    monkeypatch.setattr(review, "refuter_tree", lambda run, rv: None)  # matching only, no tree
    review.refute(run, tmp_path / "rv1", tmp_path / "slot1", tmp_path)
    return run, prompts


def words(run: review.Run) -> dict[str, str]:
    return {item.id: item.word for item in run.findings}


def test_two_findings_on_one_line_are_told_apart_by_their_summary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reply = {"findings": [judged("a.py", 2, "second at line 2", "REFUTED")]}
    run, prompts = refuted_with(tmp_path, monkeypatch, reply)
    assert words(run)["l1-f2"] == "UNPROVEN"
    assert words(run)["l2-f1"] == "REFUTED"
    assert "replayed" not in prompts[0]
    assert "low" not in prompts[0].split("\n\n")[1]
    assert "ledger" not in prompts[0].lower()


def test_verdicts_that_disagree_leave_the_finding_unproven(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reply = {
        "findings": [
            judged("b.py", 9, "disputed", "REFUTED"),
            judged("b.py", 9, "disputed", "CONFIRMED"),
        ]
    }
    run, _ = refuted_with(tmp_path, monkeypatch, reply)
    assert words(run)["l2-f2"] == "UNPROVEN"


def test_the_refuter_cannot_touch_a_replayed_or_unknown_finding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reply = {
        "findings": [
            judged("a.py", 1, "replayed", "REFUTED"),
            judged("z.py", 4, "made up", "REFUTED"),
        ]
    }
    run, _ = refuted_with(tmp_path, monkeypatch, reply)
    assert words(run) == words(claims_run())


def test_a_refuter_that_fails_refutes_nothing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    every_path_strict(monkeypatch)
    run = claims_run()

    def past_cap(*_: Any, **__: Any) -> dict[str, Any]:
        raise review.Refused("refuter ran past its cap of 2 seconds and was killed")

    monkeypatch.setattr(review, "run_lens", past_cap)
    monkeypatch.setattr(review, "refuter_tree", lambda run, rv: None)  # matching only, no tree
    review.refute(run, tmp_path, tmp_path, tmp_path)
    assert words(run) == words(claims_run())
    assert run.lenses[-1]["refused"].startswith("refuter ran past")


# ---------------------------------------------------------------- the fix message


def recorded(main: Path, head: str, round_: int, views: list[dict[str, Any]] | None) -> None:
    factory = main / ".private" / "work" / "factory"
    (factory / "ledger").mkdir(parents=True, exist_ok=True)
    (factory / "verdicts").mkdir(parents=True, exist_ok=True)
    record = {"pr": 12, "head": head, "round": round_, "recorded_at": f"2026-10-0{round_}T00:00:00Z"}
    (factory / "ledger" / f"12-{head}.json").write_text(json.dumps(record))
    if views is not None:
        review.findings_file(factory / "verdicts", 12, head).write_text(json.dumps(views))


def view(score: int, status: str, summary: str) -> dict[str, Any]:
    return {"id": "l1-f1", "score": score, "file": "a.py", "line": 4, "summary": summary,
            "status": status, "method": None}  # fmt: skip


def test_the_fix_message_is_the_latest_rounds(tmp_path: Path) -> None:
    recorded(tmp_path, "1" * 40, 1, [view(70, "CONFIRMED", "old round")])
    recorded(tmp_path, "2" * 40, 2, [view(70, "UNPROVEN", "new round"), view(49, "UNPROVEN", "low")])
    text = review.from_verdict(12, tmp_path)
    assert "new round" in text
    assert "old round" not in text
    assert "low" not in text
    assert "a.py:4 (70): new round" in text


def test_a_record_with_no_kept_findings_is_refused(tmp_path: Path) -> None:
    recorded(tmp_path, "1" * 40, 1, None)
    with pytest.raises(review.Refused):
        review.from_verdict(12, tmp_path)


def test_another_prs_record_is_never_read(tmp_path: Path) -> None:
    recorded(tmp_path, "1" * 40, 1, [view(70, "CONFIRMED", "pr 12")])
    ledger = tmp_path / ".private" / "work" / "factory" / "ledger"
    (ledger / f"12-{'1' * 40}.json").rename(ledger / f"123-{'1' * 40}.json")
    with pytest.raises(review.Refused):
        review.from_verdict(12, tmp_path)


def test_fix_message_needs_from_verdict() -> None:
    with pytest.raises(review.BadInput):
        review.parse(["fix-message", "12"])
    assert review.parse(["fix-message", "12", "--from-verdict"]).pr == 12


# ---------------------------------------------------------------- the guard brief


@pytest.mark.parametrize(
    ("paths", "told"),
    [([".claude/hooks/guard.mjs"], True), (["vextrus/rates/table.py"], False)],
)
def test_a_writing_lens_on_a_guard_change_is_told_to_attack_through_event_json(
    tmp_path: Path, paths: list[str], told: bool
) -> None:
    run = review.Run(pr=12, round_=1, head=H, merged=H, slot=1, paths=paths)
    assert (review.GUARD_ATTACK in review.brief(run, review.LENS_B, tmp_path, tmp_path)) is told
    assert review.GUARD_ATTACK not in review.brief(run, review.WORDS, tmp_path, tmp_path)
    assert "ledger" not in review.GUARD_ATTACK.lower()


# ---------------------------------------------------------------- the cloud hand-off


def test_review_cloud_passes_the_lens_model_and_task(tmp_path: Path) -> None:
    launched: list[tuple[list[str], str]] = []

    def launch(argv: list[str], prompt: str) -> int:
        launched.append((argv, prompt))
        return 0

    code = review_cloud.run(
        ["--pr", "12", "--head", H, "--agent", "pr-reviewer", "--model", "claude-sonnet-5-5",
         "--task", "You are the adversary lens."],
        push=lambda argv: 0,
        launch=launch,
        records_dir=tmp_path,
    )  # fmt: skip
    assert code == 0
    ((argv, prompt),) = launched
    assert argv[argv.index("--model") + 1] == "claude-sonnet-5-5"
    assert argv[argv.index("--effort") + 1] == "high"
    assert "You are the adversary lens." in prompt


def test_a_refuter_takes_no_task(tmp_path: Path) -> None:
    claim = tmp_path / "claim.txt"
    claim.write_text("c")
    argv = ["--pr", "12", "--head", H, "--agent", "refuter", "--claim-file", str(claim)]
    with pytest.raises(ValueError, match="--task"):
        review_cloud.parse([*argv, "--claim-n", "1", "--task", "t"])


# ---------------------------------------------------------------- the refuter's round 1 (S14-R2)


def test_where_cloud_on_a_no_model_tier_records_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recorded: list[str] = []
    monkeypatch.setattr(review, "resolve", lambda pr: H)
    monkeypatch.setattr(review, "merged_head", lambda main, pr, head: (H, BASE))
    monkeypatch.setattr(review, "changes", lambda main, merged, base: ([("docs/a.md", 1, 0)], []))
    monkeypatch.setattr(review, "merge_bases", lambda main, head, base: 1)
    monkeypatch.setattr(review, "tier", lambda *_, **__: "docs-only")  # R1's lists decide which
    monkeypatch.setattr(review, "hand_off", lambda *_: pytest.fail("a cloud reviewer was launched"))
    monkeypatch.setattr(review, "record", lambda *_: recorded.append("record"))
    args = review.parse(["run", "12", "--round", "1", "--where", "cloud"])
    with pytest.raises(review.Refused, match="no reviewer"):
        review.review(review.Run(pr=12, round_=1), args, tmp_path)
    assert recorded == []


def test_the_refuter_prompt_masks_the_records_name_and_still_matches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: a finding on scripts/ledger.py put the word in the refuter's prompt."""
    every_path_strict(monkeypatch)
    run = review.Run(pr=12, round_=1, head=H, merged=H, slot=1)
    run.findings = [review.Finding("l1-f1", 70, "scripts/ledger.py", 3, "the Ledger drops a row", None,
                                   "UNPROVEN")]  # fmt: skip
    prompts: list[str] = []

    def fake(lens: review.Lens, prompt: str, *_: Any, **__: Any) -> dict[str, Any]:
        prompts.append(prompt)
        file, summary = review.unnamed("scripts/ledger.py"), review.unnamed("the Ledger drops a row")
        return {"structured_output": {"findings": [judged(file, 3, summary, "REFUTED")]}}

    monkeypatch.setattr(review, "run_lens", fake)
    monkeypatch.setattr(review, "refuter_tree", lambda run, rv: None)  # matching only, no tree
    review.refute(run, tmp_path, tmp_path, tmp_path)
    assert "ledger" not in prompts[0].lower()
    assert run.findings[0].word == "REFUTED"


# ---------------------------------------------------------------- the refuter's sample (S17-F6)

OFF = "web/src/components/badge.tsx"
ON = "vextrus/rates/table.py"


def kept(id_: str, score: int, file: str, word: str = "UNPROVEN") -> review.Finding:
    return review.Finding(id_, score, file, 1, f"summary {id_}", None, word, on_tree=True)


def test_no_claim_when_nothing_that_could_block_is_left() -> None:
    found = [kept("a", 74, OFF), kept("b", 60, OFF), kept("c", 90, ON, "CONFIRMED")]
    assert review.refuter_claims(found) == []


def test_the_sample_is_every_blocker_then_three_others_highest_first() -> None:
    found = [
        kept("o55", 55, OFF), kept("o60", 60, OFF), kept("s50", 50, ON), kept("o74", 74, OFF),
        kept("o65", 65, OFF), kept("b80", 80, OFF), kept("o70", 70, OFF), kept("n49", 49, ON),
        kept("nofile", 50, "a file with blanks"),
    ]  # fmt: skip
    assert [item.id for item in review.refuter_claims(found)] == [
        "s50", "b80", "nofile", "o74", "o70", "o65",
    ]  # fmt: skip


def test_the_fix_message_files_the_findings_that_do_not_block_under_their_own_heading() -> None:
    views = [
        kept("b", 80, OFF).view(),
        kept("s", 55, ON).view(),
        kept("f", 60, OFF).view(),
        kept("u", 70, OFF, "-").view(),
        kept("r", 70, OFF, "REFUTED").view(),
        kept("low", 40, ON).view(),
    ]
    text = review.fix_text(12, H, views)
    fix, filed = text.split("File as issues")
    for shown in ("(80): summary b", "(55): summary s"):
        assert shown in fix
    for shown in ("(70): summary u", "(60): summary f"):
        assert shown in filed
        assert shown not in fix
    for hidden in ("summary r", "summary low"):
        assert hidden not in text


def test_only_findings_to_file_print_no_fix_round() -> None:
    text = review.fix_text(12, H, [kept("f", 60, OFF).view()])
    assert "Fix round" not in text
    assert text.startswith("File as issues")


# ---------------------------------------------------------------- the file on the head's tree (#610 r1)


def test_a_file_not_exactly_on_the_heads_tree_is_judged_strict(tmp_path: Path) -> None:
    """A 60 on `rates/table.py` (shortened from its package root) or on `vextrus/rates` (a folder)
    blocks; the same 60 on a file of the tree off the strict paths does not."""
    import subprocess

    for name in ("vextrus/rates/table.py", "web/src/components/badge.tsx"):
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_text("x = 1\n")
    for argv in (["init", "-q"], ["add", "."], ["-c", "user.name=t", "-c", "user.email=t@t.invalid",
                 "commit", "-q", "-m", "tree"]):  # fmt: skip
        subprocess.run(["git", "-C", str(tmp_path), *argv], check=True, capture_output=True)
    head = subprocess.run(["git", "-C", str(tmp_path), "rev-parse", "HEAD"], check=True,
                          capture_output=True, text=True).stdout.strip()  # fmt: skip
    found = [
        review.Finding("a", 60, "rates/table.py", 1, "s", None, "UNPROVEN"),
        review.Finding("b", 60, "vextrus/rates", 1, "s", None, "UNPROVEN"),
        review.Finding("c", 60, "web/src/components/badge.tsx", 1, "s", None, "UNPROVEN"),
    ]
    review.mark_on_tree(found, tmp_path, head)
    assert [item.named_file for item in found] == [None, None, "web/src/components/badge.tsx"]
    assert [item.could_block for item in found] == [True, True, False]
    review.mark_on_tree(found, tmp_path, "f" * 40)  # an unreadable tree: every file strict
    assert all(item.could_block for item in found)


def test_the_lens_is_told_the_file_decides_the_bar() -> None:
    told = review.FINDING_SCHEMA["properties"]["file"]["description"]
    assert "repo-relative path of one file in the head" in told
    assert "strict paths block at 50" in told
