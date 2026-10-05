"""Ticket f2, B1: the corpus (leakscan-cli.md 1, 2 `build`; spec 5 item 1).

"A corpus string is a normalised string of 8 or more characters containing at least three
consecutive letters." `build` "prints `corpus: <n> strings, sha256 <first 12 hex>` and exits 0, or 2
if a source cannot be read." The allowlist holds "sha256 hashes of normalised generic strings, never
the strings". Built here from `build --source <dir>` over invented text; today the package does not
exist.
"""

import re
import stat
import subprocess
from pathlib import Path

from ._leak import COPPERFIELD, EXCLUDED, LITERALS, ZEBRA, Leak, assert_no_text, normalise, sha256_text

BUILT = re.compile(r"^corpus: (\d+) strings, sha256 ([0-9a-f]{12})$")


def _built(done: subprocess.CompletedProcess[str]) -> re.Match[str]:
    out = [line for line in done.stdout.splitlines() if line.strip()]
    assert out, done.stderr
    match = BUILT.match(out[-1])
    assert match, f"not the build line: {out[-1]!r}"
    return match


def test_build_writes_one_corpus_file_and_prints_its_count_and_hash(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    done = leak.run("build", "--source", str(leak.sources))
    assert done.returncode == 0, done.stderr
    match = _built(done)
    assert (leak.home / "corpus").is_file()
    assert match[2] == leak.corpus_hash[:12]


def test_build_keeps_the_six_invented_strings_once_each(tmp_path: Path) -> None:
    # Six distinct strings: four in the text file, one more in the Markdown file (its other line
    # repeats one in another case and spacing), one nested in the JSON export.
    leak = Leak(tmp_path)
    assert _built(leak.build())[1] == "6"


def test_short_numeric_dated_and_letterless_strings_are_not_kept(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    leak.build()
    for text in EXCLUDED:
        done = leak.run("text", "--stdin", "--no-stamp", stdin=f"{text}\n")
        assert done.returncode == 0, f"an excluded string hit: case {EXCLUDED.index(text)}"


def test_normalisation_ignores_case_and_whitespace(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    leak.build()
    done = leak.run(
        "text", "--stdin", "--no-stamp", stdin="see zebra  QUARRY\tholdings   pvt 7731 here\n"
    )
    assert done.returncode == 1
    assert_no_text(done)


def test_every_kept_string_is_found_in_scanned_text(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    leak.build()
    for literal in LITERALS:
        done = leak.run("text", "--stdin", "--no-stamp", stdin=f"prefix {literal} suffix\n")
        assert done.returncode == 1, f"literal {LITERALS.index(literal)} was not found"


def test_the_corpus_file_is_private_and_lives_only_in_the_leakscan_home(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    before = {
        path for path in tmp_path.rglob("*") if leak.home not in path.parents and path != leak.home
    }
    leak.build()
    after = {path for path in tmp_path.rglob("*") if leak.home not in path.parents and path != leak.home}
    assert after == before
    assert stat.S_IMODE((leak.home / "corpus").stat().st_mode) == 0o600


def test_build_prints_counts_only_never_a_string(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    assert_no_text(leak.build())


def test_an_allowlisted_hash_is_dropped_from_the_corpus(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    leak.allowlist.write_text(sha256_text(normalise(COPPERFIELD)) + "\n")
    assert _built(leak.build())[1] == "5"
    assert leak.run("text", "--stdin", "--no-stamp", stdin=f"{COPPERFIELD}\n").returncode == 0


def test_a_changed_source_changes_the_corpus_hash(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    first = _built(leak.build())[2]
    (leak.sources / "more.txt").write_text("Bramblewick Foundry Annex\n")
    second = _built(leak.build())[2]
    assert first != second
    assert second == leak.corpus_hash[:12]


def test_an_unreadable_source_exits_2(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    done = leak.run("build", "--source", str(tmp_path / "no-such-folder"))
    assert done.returncode == 2
    assert "leakscan: cannot-scan source-unreadable" in done.stdout
    assert ZEBRA.upper() not in done.stdout.upper()
