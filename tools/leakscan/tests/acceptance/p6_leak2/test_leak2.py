"""Ticket T-LEAK-2 (session 12 phase 6): `range` stamps on the merge-base when its base is a newer
origin/main and says on stderr why any other clean range wrote no stamp; slug forms of a corpus string
hit in names, refs, messages and bodies (never in a diff line); `allow` takes `commit:<sha12>:<n>`,
`name:<i>` (with `--range`) and `ref:<name>`; a run id is not a corpus string.

Black-box through `python -m tools.leakscan` (contract leakscan-cli.md). Every corpus string is INVENTED
(the `_leak` literals); the run ids are invented strings of the tool's shape. The ticket's example run
id (`...-9f3c`) has no run of three letters, so today's corpus filter already drops it: the red case
uses `RUN_ID` (`...-9fac`, the same shape, kept today).
"""

import json
import re
import subprocess
from pathlib import Path

import pytest

from .._leak import (
    INDIGO,
    MARIGOLD,
    QUILLMOOR,
    SAFFRON,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    hits,
    normalise,
    sha256_text,
    summary,
    temp_repo,
)

# ZEBRA ("Zebra Quarry Holdings Pvt 7731") as a slug, by separator, camel case and a mix.
FORMS = [
    "zebra-quarry-holdings-pvt-7731",
    "zebra_quarry_holdings_pvt_7731",
    "zebra.quarry.holdings.pvt.7731",
    "zebra/quarry/holdings/pvt/7731",
    "ZebraQuarryHoldingsPvt7731",
    "zebra-quarry_holdings.pvt/7731",
]
FORM_IDS = ["dash", "underscore", "dot", "slash", "camel", "mixed"]
ZEBRA_SLUG = FORMS[0]
INDIGO_SLUG = "indigo-ferry-mills-88"
# Slugs that are not a corpus string: a different tail, the separators dropped, a part only.
NOT_SLUGS = ["zebra-quarry-tower", "zebraquarryholdingspvt7731", "zebraquarry"]

RUN_ID = "20261004T042700Z-0123456789ab-9fac"
TICKET_RUN_ID = "20261004T042700Z-0123456789ab-9f3c"
INSIDE = f"ZEBRA QUARRY {RUN_ID.upper()}"
NOT_SHAPE = "20261004T042700Z-0123456789AB-ZZZZ"
BUILT = re.compile(r"^corpus: (\d+) strings, sha256 [0-9a-f]{12}$", re.MULTILINE)
HEX64 = re.compile(r"[0-9a-f]{64}")


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _stamp_line(base: str, mergebase: str, head: str) -> str:
    return (
        f"leakscan: clean, but no stamp written: {base[:12]} is not an ancestor of origin/main and "
        f"of the head; scan {mergebase[:12]}..{head[:12]}"
    )


def _moved_main(leak: Leak, message: str) -> tuple[Path, str, str, str]:
    """Branch `b` cut from the first commit, its first commit holding `message`, then a clean second;
    then `main` moves one commit and origin/main follows. Returns the repo, the merge-base, b's first
    commit and b's head."""
    repo, base = temp_repo(leak.tmp / "work")
    git(repo, "checkout", "-q", "-b", "b")
    first = commit(repo, {"b.txt": "clean\n"}, message)
    head = commit(repo, {"c.txt": "clean too\n"}, "feat: a second clean commit")
    git(repo, "checkout", "-q", "main")
    newer = commit(repo, {"m.txt": "another change landed\n"}, "main: another PR landed")
    git(repo, "update-ref", "refs/remotes/origin/main", newer)
    return repo, base, first, head


def _allowed(leak: Leak, done: subprocess.CompletedProcess[str], literals: list[str]) -> None:
    """`allow` succeeded, the allowlist holds exactly the literals' hashes, and no output names them."""
    assert done.returncode == 0, done.stdout + done.stderr
    assert_no_text(done)
    expected = {sha256_text(normalise(literal)) for literal in literals}
    printed = any(value in done.stdout + done.stderr for value in expected)
    assert not printed, "the output holds a hash"
    entries = [line for line in leak.allowlist.read_text().splitlines() if line.strip()]
    assert all(HEX64.fullmatch(line) for line in entries)
    assert set(entries) == expected
    assert len(entries) == len(expected)


def _clean(done: subprocess.CompletedProcess[str]) -> None:
    assert done.returncode == 0, done.stdout + done.stderr
    assert summary(done)[1] == "0"


# ---------------------------------------------------------------- 1. range from a newer origin/main


def test_a_range_from_a_newer_origin_main_is_stamped_on_the_merge_base(leak: Leak) -> None:
    repo, mergebase, _, head = _moved_main(leak, "feat: a clean change")
    done = leak.run("range", "origin/main..b", "--ref", "b", cwd=repo)
    assert done.returncode == 0, done.stdout + done.stderr
    stamp = leak.home / "ok" / head
    assert stamp.is_file(), "no stamp for the head"
    assert json.loads(stamp.read_text()) == {
        "corpus": leak.corpus_hash,
        "range": f"{mergebase}..{head}",
    }
    assert leak.run("verify-stamp", head, cwd=repo).returncode == 0
    assert done.stderr == ""


def test_a_hit_in_the_branchs_first_commit_is_still_found_from_a_newer_origin_main(
    leak: Leak,
) -> None:
    repo, _, first, _ = _moved_main(leak, ZEBRA)
    done = leak.run("range", "origin/main..b", "--ref", "b", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [(f"commit:{first[:12]}:1", 1)]
    assert leak.stamps() == []
    assert_no_text(done)


# ---------------------------------------------------------------- 2. an unstamped clean range says so


def test_a_clean_range_that_writes_no_stamp_says_why_on_stderr(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    middle = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    head = commit(repo, {"c.txt": "clean\n"}, "feat: clean too")
    done = leak.run("range", f"{middle}..{head}", cwd=repo)
    assert done.returncode == 0, done.stdout + done.stderr
    assert leak.stamps() == []
    assert done.stderr.splitlines() == [_stamp_line(middle, base, head)]
    assert_no_text(done)


def test_no_stamp_prints_no_stamp_line(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    middle = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    head = commit(repo, {"c.txt": "clean\n"}, "feat: clean too")
    done = leak.run("range", f"{middle}..{head}", "--no-stamp", cwd=repo)
    assert done.returncode == 0, done.stdout + done.stderr
    assert leak.stamps() == []
    assert done.stderr == ""


def test_a_clean_range_that_stamps_prints_nothing_on_stderr(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 0, done.stdout + done.stderr
    assert (leak.home / "ok" / head).is_file()
    assert done.stderr == ""


# ---------------------------------------------------------------- 3. slug forms hit, by place


def _no_form(done: subprocess.CompletedProcess[str], form: str) -> None:
    assert_no_text(done)
    named = form.upper() in (done.stdout + done.stderr).upper()
    assert not named, "the output names the slug"


@pytest.mark.parametrize("form", FORMS, ids=FORM_IDS)
def test_a_slug_file_name_hits_by_its_index(leak: Leak, form: str) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {f"docs/{form}.md": "a clean line\n"}, "docs: add a note")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [("name:0", 1)]
    assert leak.stamps() == []
    _no_form(done, form)


@pytest.mark.parametrize("form", FORMS, ids=FORM_IDS)
def test_a_slug_ref_hits(leak: Leak, form: str) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = leak.run("range", f"{base}..{head}", "--ref", form, cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [("ref", 1)]
    _no_form(done, form)


@pytest.mark.parametrize("form", FORMS, ids=FORM_IDS)
def test_a_slug_in_a_commit_message_hits_by_its_line(leak: Leak, form: str) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"docs: a note\n\n{form}")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [(f"commit:{head[:12]}:3", 1)]
    _no_form(done, form)


@pytest.mark.parametrize("form", FORMS, ids=FORM_IDS)
def test_a_slug_in_a_body_file_hits_by_its_line(leak: Leak, form: str) -> None:
    body = leak.tmp / "body.md"
    body.write_text(f"a clean first line\n{form}\n")
    done = leak.run("file", str(body))
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [("file:2", 1)]
    _no_form(done, form)


@pytest.mark.parametrize("form", FORMS, ids=FORM_IDS)
def test_a_slug_on_stdin_hits_by_its_line(leak: Leak, form: str) -> None:
    done = leak.run("text", "--stdin", stdin=f"a clean first line\n{form}\n")
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [("stdin:2", 1)]
    _no_form(done, form)


# ---------------------------------------------------------------- 4. slugs do not over-reach


def test_a_slug_in_an_added_diff_line_is_not_slug_read(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    code = f"{FORMS[1]} = 1\nzebra_quarry_holdings = 2\n"
    head = commit(repo, {"src/a.py": code}, "feat: a clean change")
    _clean(leak.run("range", f"{base}..{head}", "--no-stamp", cwd=repo))


@pytest.mark.parametrize("text", NOT_SLUGS, ids=["other-tail", "no-separators", "a-part"])
def test_a_slug_that_is_not_a_corpus_string_does_not_hit(leak: Leak, text: str) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {f"docs/{text}.md": "a clean line\n"}, f"docs: a note\n\n{text}")
    _clean(leak.run("range", f"{base}..{head}", "--ref", text, "--no-stamp", cwd=repo))
    body = leak.tmp / "body.md"
    body.write_text(f"a clean first line\n{text}\n")
    _clean(leak.run("file", str(body), "--no-stamp"))
    _clean(leak.run("text", "--stdin", "--no-stamp", stdin=f"{text}\n"))


# ---------------------------------------------------------------- 5. allow takes commit, name, ref


def test_allow_takes_a_commit_message_location(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"docs: a note\n\n{ZEBRA}")
    assert leak.run("range", f"{base}..{head}", "--no-stamp", cwd=repo).returncode == 1
    _allowed(leak, leak.run("allow", f"commit:{head[:12]}:3", cwd=repo), [ZEBRA])
    _clean(leak.run("range", f"{base}..{head}", cwd=repo))


@pytest.mark.parametrize("which", ["no-object", "a-blob", "past-the-end", "no-hit"])
def test_allow_refuses_a_commit_location_with_nothing_to_allow(leak: Leak, which: str) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"docs: a note\n\n{ZEBRA}")
    blob = git(repo, "rev-parse", f"{head}:b.txt")
    location = {
        "no-object": "commit:0123456789ab:3",
        "a-blob": f"commit:{blob[:12]}:1",
        "past-the-end": f"commit:{head[:12]}:9",
        "no-hit": f"commit:{head[:12]}:1",
    }[which]
    done = leak.run("allow", location, cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert leak.allowlist.read_text().strip() == ""
    assert_no_text(done)


@pytest.mark.parametrize("location", ["commit:", "commit:zz:1", "name:x", "name:0"])
def test_allow_refuses_a_bad_location_form_as_usage(leak: Leak, location: str) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    done = leak.run("allow", location, cwd=repo)
    assert done.returncode == 64, done.stdout + done.stderr
    assert leak.allowlist.read_text().strip() == ""


def test_allow_takes_a_file_name_location_with_its_range(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {f"docs/{ZEBRA_SLUG}.md": "a clean line\n"}, "docs: add a note")
    span = f"{base}..{head}"
    assert hits(leak.run("range", span, "--no-stamp", cwd=repo)) == [("name:0", 1)]
    _allowed(leak, leak.run("allow", "--range", span, "name:0", cwd=repo), [ZEBRA])
    _clean(leak.run("range", span, cwd=repo))


def test_allow_refuses_a_file_name_index_past_the_range(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {f"docs/{ZEBRA_SLUG}.md": "a clean line\n"}, "docs: add a note")
    done = leak.run("allow", "--range", f"{base}..{head}", "name:5", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert leak.allowlist.read_text().strip() == ""


def test_allow_takes_a_ref_location(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    span = f"{base}..{head}"
    assert leak.run("range", span, "--ref", ZEBRA_SLUG, "--no-stamp", cwd=repo).returncode == 1
    _allowed(leak, leak.run("allow", f"ref:{ZEBRA_SLUG}", cwd=repo), [ZEBRA])
    _clean(leak.run("range", span, "--ref", ZEBRA_SLUG, cwd=repo))


def test_allow_takes_every_form_at_once(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {f"docs/{INDIGO_SLUG}.md": "a clean line\n"}, f"docs: a note\n\n{SAFFRON}")
    body = leak.tmp / "body.md"
    body.write_text(f"{MARIGOLD}\n")
    span = f"{base}..{head}"
    done = leak.run(
        "allow",
        "--range",
        span,
        f"{body}:1",
        f"commit:{head[:12]}:3",
        "name:0",
        f"ref:{ZEBRA_SLUG}",
        cwd=repo,
    )
    _allowed(leak, done, [MARIGOLD, SAFFRON, INDIGO, ZEBRA])
    _clean(leak.run("range", span, "--ref", ZEBRA_SLUG, cwd=repo))
    _clean(leak.run("file", str(body)))


# ---------------------------------------------------------------- 6. run ids are not corpus strings


@pytest.fixture
def runs(tmp_path: Path) -> Leak:
    """The invented sources plus a second folder holding run ids and strings near them."""
    built = Leak(tmp_path)
    second = tmp_path / "runs"
    second.mkdir()
    (second / "runs.txt").write_text(
        "\n".join([RUN_ID, TICKET_RUN_ID, QUILLMOOR, INSIDE, NOT_SHAPE]) + "\n"
    )
    done = built.run("build", "--source", str(built.sources), "--source", str(second))
    assert done.returncode == 0, done.stdout + done.stderr
    built.tmp.joinpath("build.out").write_text(done.stdout)
    return built


def test_a_run_id_is_not_kept_in_the_corpus(runs: Leak) -> None:
    kept = (runs.home / "corpus").read_text().splitlines()
    # Booleans only: a failure never prints a corpus line.
    run_id_kept = normalise(RUN_ID) in kept or normalise(TICKET_RUN_ID) in kept
    assert not run_id_kept, "a run id is kept"
    others_kept = all(normalise(value) in kept for value in (QUILLMOOR, INSIDE, NOT_SHAPE))
    assert others_kept, "a string beside the run ids was dropped"
    counted = BUILT.search(runs.tmp.joinpath("build.out").read_text())
    assert counted is not None
    assert int(counted[1]) == len(kept) == 8


def test_a_commit_message_quoting_a_run_id_is_clean(runs: Leak) -> None:
    repo, base = temp_repo(runs.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"chore: notes for run {RUN_ID}")
    _clean(runs.run("range", f"{base}..{head}", cwd=repo))


def test_a_string_holding_a_run_id_among_words_still_hits_as_the_whole(runs: Leak) -> None:
    repo, base = temp_repo(runs.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"chore: a note\n\n{INSIDE}")
    done = runs.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [(f"commit:{head[:12]}:3", 1)]


def test_other_strings_beside_run_ids_still_hit(runs: Leak) -> None:
    repo, base = temp_repo(runs.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"chore: a note\n\n{QUILLMOOR}\n{NOT_SHAPE}")
    done = runs.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1, done.stdout + done.stderr
    assert hits(done) == [(f"commit:{head[:12]}:3", 1), (f"commit:{head[:12]}:4", 1)]
