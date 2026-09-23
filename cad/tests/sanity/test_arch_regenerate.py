"""F-ARCH regenerates from its committed generator (L-CAD-09): `python -m fixtures.gen.arch --out
<tmp>` under the `fixtures` group, once per session. What it prints must be what it wrote (`wrote
<relative> sha256=<hex>`), what it wrote must be the committed corpus byte for byte — the drawing
included: the corpus carries no DWG, so nothing is judged by census — and the committed corpus must
hold nothing the generator does not write.

The cad lane runs this only when an input it reads has moved (scripts/lib/cad-lane.mjs keys F-ARCH's
own inputs: its generator, its corpus, this test, cad/tests/arch/ and F-RCC6-BNBC's model, which
F-ARCH reads its structure from); the cheap checks over the committed bytes run every time.
"""

from __future__ import annotations

import hashlib
import re
import time
from pathlib import Path

import pytest

WROTE_LINE = re.compile(r"^wrote (?P<path>\S+) sha256=(?P<sha>[0-9a-f]{64})$")
GENERATOR_MODULE = "fixtures.gen.arch"

_ROOT = Path(__file__).resolve().parents[3]
_CORPUS_DIR = _ROOT / "fixtures" / "arch"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _files_under(root: Path) -> set[str]:
    return {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}


@pytest.fixture(scope="module")
def arch_corpus(corpus):
    """The committed F-ARCH corpus, read through the sanity suite's own Corpus helper."""
    return type(corpus)(_CORPUS_DIR)


def _generated(arch_corpus, tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    def run_once() -> tuple[Path, dict[str, str]]:
        out_dir = tmp_path_factory.mktemp("arch-fresh") / "arch"
        started = time.monotonic()
        run = arch_corpus.run_in_fixtures_group(["-m", GENERATOR_MODULE, "--out", str(out_dir)])
        elapsed = time.monotonic() - started
        assert run.returncode == 0, (
            f"the generator exited {run.returncode}\n--- stderr ---\n{run.stderr[-4000:]}\n"
            f"--- stdout ---\n{run.stdout[-1500:]}"
        )
        wrote: dict[str, str] = {}
        for line in run.stdout.splitlines():
            if not line.strip():
                continue
            match = WROTE_LINE.match(line)
            assert match, f"a stdout line is not a `wrote <relative path> sha256=<hex>` line: {line!r}"
            assert match["path"] not in wrote, f"{match['path']} was reported as written twice"
            wrote[match["path"]] = match["sha"]
        print(f"\nfixtures.gen.arch rebuilt {len(wrote)} files in {elapsed:.1f}s")
        return out_dir, wrote

    return arch_corpus.once("arch-generated", run_once)


def test_the_generator_reports_every_file_it_writes(
    arch_corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote = _generated(arch_corpus, tmp_path_factory)
    assert wrote, "the generator printed no `wrote` line"
    written = _files_under(out_dir)
    assert set(wrote) == written, (
        f"reported but absent: {sorted(set(wrote) - written)}; "
        f"written but unreported: {sorted(written - set(wrote))}"
    )
    wrong = [rel for rel, sha in wrote.items() if _sha256(out_dir / rel) != sha]
    assert wrong == [], f"the printed sha256 is not the file's own for: {wrong}"


def test_every_regenerated_file_is_byte_identical_to_the_committed_one(
    arch_corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote = _generated(arch_corpus, tmp_path_factory)
    committed = _files_under(arch_corpus.root)
    assert committed == set(wrote), (
        f"committed but not written: {sorted(committed - set(wrote))}; written but not committed: "
        f"{sorted(set(wrote) - committed)}"
    )
    differing = [
        rel for rel in sorted(wrote) if (out_dir / rel).read_bytes() != arch_corpus.path(rel).read_bytes()
    ]
    assert differing == [], f"regenerated files differ from the committed bytes: {differing}"
