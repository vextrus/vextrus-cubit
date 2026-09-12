"""AC-1 for F-RCC6-BNBC — the corpus regenerates from its committed generator (L-CAD-09, §3.9).

The generator is a package, so it is driven exactly as its own docstring spells it — `python -m
fixtures.gen.rcc6_bnbc --out <tmp>` under the `fixtures` group — once per session, into a scratch
directory. What it prints must be what it wrote (`wrote <relative> sha256=<hex>`), what it wrote
must be the committed corpus byte for byte, and the committed corpus must hold nothing the
generator does not write.

Two files are exempt from byte identity and only from that: the DWGs. `dxf2dwg` is not promised
byte-stable (W-04), so each is judged by the census the product's own DWG lane reads off it — the
same number the DWG sanity test pins. Everything else, the rasters included, is a pure function of
the authored model and must come back identical.

The run takes over a minute; its wall time is printed so a reader with `-s` can see what a
regeneration costs.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path

import pytest

from vextrus_cad.dwg import convert_dwg

#: `wrote <path relative to DIR> sha256=<64 hex>` — one line per file the generator writes.
WROTE_LINE = re.compile(r"^wrote (?P<path>\S+) sha256=(?P<sha>[0-9a-f]{64})$")

GENERATOR_MODULE = "fixtures.gen.rcc6_bnbc"
MANIFEST_REL = "manifest.json"

#: Judged by census, never by bytes (W-04).
DWG_NAMES = ("rcc6-bnbc.dwg", "rcc6-bnbc.model.dwg")

#: cad/tests/sanity/<this file> -> the checkout.
_ROOT = Path(__file__).resolve().parents[3]
_CORPUS_DIR = _ROOT / "fixtures" / "rcc6-bnbc"
_PACKAGE = _ROOT / "fixtures" / "gen" / "rcc6_bnbc"

pytestmark = pytest.mark.skipif(
    not (_CORPUS_DIR / MANIFEST_REL).is_file() or "sheets" not in json.loads(
        (_CORPUS_DIR / MANIFEST_REL).read_text(encoding="utf-8")
    ),
    reason="fixtures/rcc6-bnbc/ does not carry a Wave B manifest yet — the drawings land with the "
    "generator run, and the golden checks stand on their own until then",
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _files_under(root: Path) -> set[str]:
    return {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}


def _generated(corpus, tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str], float]:
    """One generator run for the whole session: where it wrote, what it printed, what it cost."""

    def run_once() -> tuple[Path, dict[str, str], float]:
        out_dir = tmp_path_factory.mktemp("rcc6-bnbc-fresh") / "rcc6-bnbc"
        started = time.monotonic()
        run = corpus.run_in_fixtures_group(["-m", GENERATOR_MODULE, "--out", str(out_dir)])
        elapsed = time.monotonic() - started
        assert run.returncode == 0, (
            f"the generator exited {run.returncode}\n"
            f"--- stderr ---\n{run.stderr[-4000:]}\n--- stdout ---\n{run.stdout[-1500:]}"
        )
        wrote: dict[str, str] = {}
        for line in run.stdout.splitlines():
            if not line.strip():
                continue
            match = WROTE_LINE.match(line)
            assert match, f"a stdout line is not a `wrote <relative path> sha256=<hex>` line: {line!r}"
            assert match["path"] not in wrote, f"{match['path']} was reported as written twice"
            wrote[match["path"]] = match["sha"]
        print(f"\nfixtures.gen.rcc6_bnbc rebuilt {len(wrote)} files in {elapsed:.1f}s")
        return out_dir, wrote, elapsed

    return corpus.once("bnbc-generated", run_once)


def test_ac1_the_generator_reports_every_file_it_writes(
    bnbc_corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote, _ = _generated(bnbc_corpus, tmp_path_factory)
    assert wrote, "the generator printed no `wrote` line"
    written = _files_under(out_dir)
    assert set(wrote) == written, (
        f"the `wrote` lines and the files on disk disagree — reported but absent: "
        f"{sorted(set(wrote) - written)}; written but unreported: {sorted(written - set(wrote))}"
    )
    wrong_hash = [rel for rel, sha in wrote.items() if _sha256(out_dir / rel) != sha]
    assert wrong_hash == [], f"the printed sha256 is not the file's own for: {wrong_hash}"


def test_ac1_every_regenerated_file_is_byte_identical_to_the_committed_one(
    bnbc_corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote, _ = _generated(bnbc_corpus, tmp_path_factory)
    committed = _files_under(bnbc_corpus.root)
    assert committed <= set(wrote), (
        "committed files the generator does not write (a stale corpus is not regenerable): "
        f"{sorted(committed - set(wrote))}"
    )
    missing = [rel for rel in sorted(wrote) if not bnbc_corpus.path(rel).is_file()]
    assert missing == [], f"the generator writes files that are not committed: {missing}"
    differing = [
        rel
        for rel in sorted(wrote)
        if rel not in DWG_NAMES
        and (out_dir / rel).read_bytes() != bnbc_corpus.path(rel).read_bytes()
    ]
    assert differing == [], f"regenerated files differ from the committed bytes: {differing}"


@pytest.mark.parametrize("name", DWG_NAMES)
def test_ac1_the_regenerated_dwg_reads_the_same_census_as_the_committed_one(
    bnbc_corpus, tmp_path_factory: pytest.TempPathFactory, tmp_path: Path, name: str
) -> None:
    out_dir, wrote, _ = _generated(bnbc_corpus, tmp_path_factory)
    assert name in wrote, f"the generator did not write {name}"
    fresh = convert_dwg(out_dir / name, tmp_path / "fresh")
    committed = convert_dwg(bnbc_corpus.require(name), tmp_path / "committed")
    assert fresh.census, f"the regenerated {name}'s census is empty"
    assert fresh.census == committed.census, (
        f"the {name} minted today reads a different LibreDWG census than the committed one — "
        "the drawing in the corpus is not the drawing this generator mints"
    )


def test_ac1_the_manifest_pins_the_generator_that_minted_the_corpus(bnbc_corpus) -> None:
    modules = bnbc_corpus.read_json(MANIFEST_REL)["generator"]["modules"]
    on_tree = {
        path.relative_to(_PACKAGE).as_posix()
        for path in _PACKAGE.rglob("*")
        if path.is_file() and path.suffix in (".py", ".json") and "__pycache__" not in path.parts
    }
    assert set(modules) == on_tree, (
        f"the manifest's module roster is not the tree's — missing {sorted(on_tree - set(modules))}, "
        f"stale {sorted(set(modules) - on_tree)}"
    )
    moved = [name for name, sha in modules.items() if _sha256(_PACKAGE / name) != sha]
    assert moved == [], (
        f"generator modules that changed since the corpus was minted (regenerate and commit): {moved}"
    )


def test_ac1_the_corpus_carries_every_output_its_own_plan_names(bnbc_corpus) -> None:
    """The roster in `emit/plan.OUTPUTS` is the promise; the corpus is the keeping of it."""
    committed = _files_under(bnbc_corpus.root)
    promised = {
        "rcc6-bnbc.dxf",
        "rcc6-bnbc.model.dxf",
        "arch-plan.dxf",
        "rcc6-bnbc.libredwg-r2000.dxf",
        "rcc6-bnbc.dwg",
        "rcc6-bnbc.model.dwg",
        "rcc6-bnbc.pdf",
        "rcc6-bnbc.shx.pdf",
        "notation.corpus.json",
        "sanity.json",
        "manifest.json",
    }
    assert promised <= committed, (
        f"outputs plan.OUTPUTS names but the corpus lacks: {sorted(promised - committed)}"
    )
    assert any(rel.startswith("raster/") for rel in committed), "the corpus carries no raster variant"
