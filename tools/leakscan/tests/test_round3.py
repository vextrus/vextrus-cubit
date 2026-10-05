"""PR #291's review round 3 (f2): `allow` hashes only what spans a line break, and the corpus cannot be
rebuilt small or from a chosen folder. Invented strings only; every corpus and folder is temporary."""

import subprocess
import sys
from pathlib import Path

import pytest

from tools.leakscan import core
from tools.leakscan.tests.acceptance._leak import (
    MARIGOLD,
    REPO,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    git_env,
    hits,
    temp_repo,
)


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def test_allowing_a_line_leaves_a_literal_on_the_next_line_a_hit(leak: Leak) -> None:
    body = leak.tmp / "f.md"
    body.write_text(f"{MARIGOLD}\n{ZEBRA}\n")
    assert leak.run("allow", f"{body}:1").returncode == 0
    alone = leak.tmp / "alone.md"
    alone.write_text(f"{ZEBRA}\n")
    assert leak.run("file", str(alone), "--no-stamp").returncode == 1


def test_allowing_a_clean_line_before_a_literal_is_refused(leak: Leak) -> None:
    body = leak.tmp / "f.md"
    body.write_text(f"a clean line\n{ZEBRA}\n")
    assert leak.run("allow", f"{body}:1").returncode == 1
    assert leak.allowlist.read_text().strip() == ""


def _without_seam(tmp_path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    # The main checkout is a temporary folder, so even the default leak home is never the real one.
    env = git_env(VEXTRUS_MAIN_CHECKOUT=str(tmp_path / "main"), PYTHONPATH=str(REPO))
    env.pop("VEXTRUS_LEAKSCAN_HOME", None)
    env["VEXTRUS_LEAKSCAN_ALLOWLIST"] = str(tmp_path / "allow.txt")
    return subprocess.run(
        [sys.executable, "-m", "tools.leakscan", *args],
        cwd=tmp_path,
        env=env,
        input="anything\n",
        capture_output=True,
        text=True,
        check=False,
    )


def test_build_from_a_chosen_folder_needs_the_test_seam(tmp_path: Path) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.txt").write_text(f"{ZEBRA}\n")
    assert _without_seam(tmp_path, "build", "--source", str(source)).returncode == 64
    assert not (tmp_path / "main/.private/work/leakscan/corpus").exists()


def test_a_corpus_under_the_floor_is_refused_outside_the_seam(tmp_path: Path) -> None:
    home = tmp_path / "main/.private/work/leakscan"
    home.mkdir(parents=True)
    (home / "corpus").write_text(f"{ZEBRA.upper()}\n")
    done = _without_seam(tmp_path, "text", "--stdin", "--no-stamp")
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan corpus-unreadable"


def test_a_rebuild_that_loses_half_the_corpus_is_refused_unless_forced(leak: Leak) -> None:
    before = leak.corpus_hash
    small = leak.tmp / "small"
    small.mkdir()
    (small / "a.txt").write_text(f"{ZEBRA}\n")
    done = leak.run("build", "--source", str(small))
    assert done.returncode == 2
    assert leak.corpus_hash == before
    assert leak.run("build", "--source", str(small), "--force").returncode == 0
    assert leak.corpus_hash != before


# ------------------------------------------------------------ T-LEAK-2: slugs, run ids, allow, stamps


@pytest.mark.parametrize(
    ("text", "read"),
    [
        ("zebra-quarry_7", "ZEBRA QUARRY 7"),
        ("ZebraQuarry7", "ZEBRA QUARRY 7"),
        ("a\\b+c..d//e", "A B C D E"),
        ("ZEBRA QUARRY", "ZEBRA QUARRY"),
        ("\uff3aebra\uff31uarry", "ZEBRA QUARRY"),  # NFKC first: full-width Z and Q split as ASCII
        ("Pvt7731x", "PVT 7731 X"),  # letter to digit and digit to letter
    ],
)
def test_slug_forms(text: str, read: str) -> None:
    assert core.slug_forms(text) == read


def test_a_run_id_is_dropped_only_whole_and_only_in_its_shape() -> None:
    assert not core.keeps("20261004T042700Z-0123456789AB-9FAC")
    assert core.keeps("20261004T042700Z-0123456789AB-9FACE")
    assert core.keeps("X20261004T042700Z-0123456789AB-9FAC")
    assert core.keeps("20261004T042700Z-0123456789AB-ZZZZ")


def test_a_string_found_as_written_and_as_a_slug_counts_once(leak: Leak) -> None:
    line = f"{ZEBRA} zebra-quarry-holdings-pvt-7731\n"
    assert hits(leak.run("text", "--stdin", "--no-stamp", stdin=line)) == [("stdin:1", 1)]


def test_a_slug_wrapped_over_two_message_lines_hits_at_the_first(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "docs: a note\n\nzebra-quarry-\nholdings-pvt-7731")
    done = leak.run("range", f"{base}..{head}", "--no-stamp", cwd=repo)
    assert hits(done) == [(f"commit:{head[:12]}:3", 1)]


def test_a_hit_inside_a_slug_named_file_never_prints_its_path(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"docs/ZebraQuarryHoldingsPvt7731.md": f"{MARIGOLD}\n"}, "docs: a note")
    done = leak.run("range", f"{base}..{head}", "--no-stamp", cwd=repo)
    assert hits(done) == [("name:0:1", 1), ("name:0", 1)]
    assert "docs/" not in done.stdout
    assert_no_text(done)


def test_allow_refuses_a_hex_ref_that_is_not_the_commit_it_names(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, f"docs: a note\n\n{ZEBRA}")
    git(repo, "branch", "0123456789ab", head)  # a branch named like a sha resolves, but not as one
    done = leak.run("allow", "commit:0123456789ab:3", cwd=repo)
    assert done.returncode == 1
    assert leak.allowlist.read_text().strip() == ""


def test_allow_reads_a_file_line_as_written_never_as_a_slug(leak: Leak) -> None:
    body = leak.tmp / "f.md"
    body.write_text("zebra-quarry-holdings-pvt-7731\n")
    assert leak.run("allow", f"{body}:1").returncode == 1
    assert leak.allowlist.read_text().strip() == ""


@pytest.mark.parametrize("location", ["commit:0123456:0", "commit:0123456789ABC:1", "ref:", "x:0"])
def test_allow_refuses_more_bad_forms_as_usage(leak: Leak, location: str) -> None:
    assert leak.run("allow", location).returncode == 64


def test_allow_name_follows_the_merge_base_substitution(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "checkout", "-q", "-b", "b")
    commit(repo, {"docs/zebra-quarry-holdings-pvt-7731.md": "clean\n"}, "docs: a note")
    git(repo, "checkout", "-q", "main")
    newer = commit(repo, {"m.txt": "landed\n"}, "main: another PR landed")
    git(repo, "update-ref", "refs/remotes/origin/main", newer)
    # From the newer main, `range` scans merge-base..b: one name, the slug's; `allow` sees the same.
    assert hits(leak.run("range", "origin/main..b", "--no-stamp", cwd=repo)) == [("name:0", 1)]
    assert leak.run("allow", "--range", "origin/main..b", "name:0", cwd=repo).returncode == 0
    assert leak.run("range", "origin/main..b", cwd=repo).returncode == 0
    assert (leak.home / "ok" / git(repo, "rev-parse", "b")).is_file()


def test_a_base_whose_merge_base_is_off_main_scans_as_asked_and_says_why(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    side = commit(repo, {"s.txt": "side\n"}, "side: not on origin/main")
    git(repo, "checkout", "-q", "-b", "x", side)
    left = commit(repo, {"l.txt": "left\n"}, "left")
    git(repo, "checkout", "-q", "-b", "y", side)
    right = commit(repo, {"r.txt": "right\n"}, "right")
    done = leak.run("range", f"{left}..{right}", cwd=repo)
    assert done.returncode == 0
    assert leak.stamps() == []
    assert done.stderr.splitlines() == [
        (
            f"leakscan: clean, but no stamp written: {left[:12]} is not an ancestor of origin/main and "
            f"of the head; scan {base[:12]}..{right[:12]}"
        )
    ]


def test_a_range_without_origin_main_says_why_with_no_scan_advice(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    git(repo, "update-ref", "-d", "refs/remotes/origin/main")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 0
    assert done.stderr.splitlines() == [
        (
            f"leakscan: clean, but no stamp written: {base[:12]} is not an ancestor of origin/main and "
            "of the head"
        )
    ]


# Corpus strings whose own slug form differs from them (the refuter's round on T-LEAK-2): a letter
# beside a digit, a separator inside. Invented strings.
KESTREL = "Kestrel Block C1 Annex"
HERONSGATE = "Plot-12 Heronsgate Row"


@pytest.fixture
def slugged(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    (built.sources / "more.txt").write_text(f"{KESTREL}\n{HERONSGATE}\n")
    built.build()
    return built


@pytest.mark.parametrize(
    "form",
    [
        "kestrel-block-c1-annex",
        "KestrelBlockC1Annex",
        "kestrel_block_c1_annex",
        "plot-12-heronsgate-row",
        "plot_12_heronsgate_row",
        "QuillmoorEstates",
        "quillmoor_estates",
    ],
)
def test_a_slug_of_a_corpus_string_with_digits_or_separators_hits(slugged: Leak, form: str) -> None:
    repo, base = temp_repo(slugged.tmp / "work")
    head = commit(repo, {f"docs/{form}.md": "clean\n"}, f"docs: a note\n\n{form}")
    done = slugged.run("range", f"{base}..{head}", "--ref", form, "--no-stamp", cwd=repo)
    assert hits(done) == [(f"commit:{head[:12]}:3", 1), ("name:0", 1), ("ref", 1)]
    assert form.upper() not in done.stdout.upper()


def test_a_short_slug_form_of_a_corpus_string_is_matched_too() -> None:
    corpus = core.Corpus(b"ABC----D\n")  # its slug form, `ABC D`, is under 8 characters
    assert corpus.found_slug("see abc_d here") == {"ABC----D"}
    assert corpus.found_slug("abcd") == set()


def test_a_corpus_slug_never_hits_in_a_diff_line(slugged: Leak) -> None:
    repo, base = temp_repo(slugged.tmp / "work")
    head = commit(repo, {"src/a.py": "kestrel_block_c1_annex = 1\n"}, "feat: a clean change")
    done = slugged.run("range", f"{base}..{head}", "--no-stamp", cwd=repo)
    assert done.returncode == 0


# Git object ids are tool-made names (the orchestrator's addendum to T-LEAK-2): a corpus string that is
# one, or holds one as a whole token, is dropped. Invented ids.
SHA40 = "4f2a9c0d1e3b5a7c9e0f2a4b6c8d0e1f3a5b7c9d"
RUN_ID = "20261004T042700Z-0123456789ab-9fac"


def test_a_sha_and_a_run_id_never_enter_the_corpus_and_their_neighbours_do(tmp_path: Path) -> None:
    built = Leak(tmp_path)
    (built.sources / "run.txt").write_text(f"{SHA40}\n{RUN_ID}\nHEAD {SHA40[:12]} BUILT\n{KESTREL}\n")
    built.build()
    kept = (built.home / "corpus").read_text().splitlines()
    # Booleans only: a failure never prints a corpus line.
    ids_kept = [value for value in kept if SHA40[:12].upper() in value or "9FAC" in value]
    assert ids_kept == [], "an object id or run id is kept"
    assert KESTREL.upper() in kept, "the drawing-like string beside them was dropped"


@pytest.mark.parametrize(
    ("text", "kept"),
    [
        ("COMMIT A1B2C3D DONE", False),
        ("HEAD 0123456789AB-9FAC", False),
        (SHA40.upper(), False),
        ("PHONE 01711234567", True),  # digits only: a number, not an object id
        ("DEFACED WALLS", True),  # letters A-F only: a word
        ("BLOCK A1B2C3 WEST", True),  # 6 hex: under 7
        ("SHA:A1B2C3D4E5 NOTE", True),  # not a whole token
    ],
)
def test_an_object_id_token_is_dropped_only_when_it_is_one(text: str, kept: bool) -> None:
    assert core.keeps(text) is kept
