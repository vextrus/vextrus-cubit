"""AC-1 — the F-RCC6 corpus regenerates from its committed generator (F-RCC6, L-CAD-09).

The generator is run twice. Once exactly as the spec spells it, from the checkout, into a scratch
directory: what it prints and what it writes are judged against the committed corpus. And once as
a bare copy of the script alone, in a scratch tree with no corpus beside it and that tree as the
working directory: a script that merely copied `fixtures/rcc6/` forward has nothing to copy there,
so byte identity from that run is what "authored by a committed script" means. Every file must
come back byte-identical, except the DWG: LibreDWG's `dxf2dwg` is not promised byte-stable, so the
DWG is judged by the census the DWG lane reads off it (the same number AC-4 pins).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import ezdxf
import pytest
from ezdxf.lldxf.const import versions_supported_by_new

from vextrus_cad.dwg import convert_dwg

#: `wrote <path relative to DIR> sha256=<64 hex>` — one line per file the generator writes.
WROTE_LINE = re.compile(r"^wrote (?P<path>\S+) sha256=(?P<sha>[0-9a-f]{64})$")

#: The one file exempt from byte identity, judged by its LibreDWG census instead.
DWG_NAME = "rcc6.dwg"
DXF_NAME = "rcc6.dxf"

#: ezdxf stamps every document it writes as its last saver (`$LASTSAVEDBY`).
EZDXF_SAVER = "ezdxf"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _files_under(root: Path) -> set[str]:
    return {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}


def _generated(corpus, tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    """One in-tree generator run for the session: the output directory and its `wrote` lines."""

    def run_once() -> tuple[Path, dict[str, str]]:
        out_dir = tmp_path_factory.mktemp("rcc6-fresh") / "rcc6"
        run = corpus.generate(out_dir)
        assert run.returncode == 0, (
            f"the generator exited {run.returncode}\n"
            f"--- stderr ---\n{run.stderr[-3000:]}\n--- stdout ---\n{run.stdout[-1500:]}"
        )
        wrote: dict[str, str] = {}
        for line in run.stdout.splitlines():
            if not line.strip():
                continue
            match = WROTE_LINE.match(line)
            assert match, f"a stdout line is not a `wrote <relative path> sha256=<hex>` line: {line!r}"
            assert match["path"] not in wrote, f"{match['path']} was reported as written twice"
            wrote[match["path"]] = match["sha"]
        return out_dir, wrote

    return corpus.once("generated", run_once)


def _generated_alone(corpus, tmp_path_factory: pytest.TempPathFactory) -> Path:
    """One bare-copy generator run for the session: the script alone, in a tree without the corpus."""

    def run_once() -> Path:
        out_dir, run = corpus.generate_from_a_bare_copy(tmp_path_factory.mktemp("rcc6-alone"))
        assert run.returncode == 0, (
            f"the generator, copied alone into a scratch tree, exited {run.returncode}\n"
            f"--- stderr ---\n{run.stderr[-3000:]}\n--- stdout ---\n{run.stdout[-1500:]}"
        )
        assert out_dir.is_dir(), "the bare copy exited 0 but wrote no --out directory"
        return out_dir

    return corpus.once("generated-alone", run_once)


def test_ac1_the_generator_reports_every_file_it_writes(
    corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote = _generated(corpus, tmp_path_factory)
    assert wrote, "the generator printed no `wrote` line"
    written = _files_under(out_dir)
    assert set(wrote) == written, (
        f"the `wrote` lines and the files on disk disagree — reported but absent: "
        f"{sorted(set(wrote) - written)}; written but unreported: {sorted(written - set(wrote))}"
    )
    wrong_hash = [rel for rel, sha in wrote.items() if _sha256(out_dir / rel) != sha]
    assert wrong_hash == [], f"the printed sha256 is not the file's own for: {wrong_hash}"


def test_ac1_every_regenerated_file_is_byte_identical_to_the_committed_one(
    corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir, wrote = _generated(corpus, tmp_path_factory)
    assert corpus.root.is_dir(), f"{corpus.root} is not committed — the F-RCC6 corpus does not exist yet"
    committed = _files_under(corpus.root)
    assert committed <= set(wrote), (
        f"committed files the generator does not write (a stale corpus is not regenerable): "
        f"{sorted(committed - set(wrote))}"
    )
    missing = [rel for rel in wrote if not corpus.path(rel).is_file()]
    assert missing == [], f"the generator writes files that are not committed under fixtures/rcc6: {missing}"
    differing = [
        rel
        for rel in sorted(wrote)
        if rel != DWG_NAME and (out_dir / rel).read_bytes() != corpus.path(rel).read_bytes()
    ]
    assert differing == [], f"regenerated files differ from the committed bytes: {differing}"


def test_ac1_the_regenerated_dwg_reads_the_same_census_as_the_committed_one(
    corpus, tmp_path_factory: pytest.TempPathFactory, tmp_path: Path
) -> None:
    out_dir, wrote = _generated(corpus, tmp_path_factory)
    assert DWG_NAME in wrote, f"the generator did not write {DWG_NAME}"
    fresh = convert_dwg(out_dir / DWG_NAME, tmp_path / "fresh")
    committed = convert_dwg(corpus.require(DWG_NAME), tmp_path / "committed")
    assert fresh.census, "the regenerated DWG's census is empty"
    assert fresh.census == committed.census, (
        "the regenerated DWG's LibreDWG census differs from the committed DWG's — "
        "the drawing minted today is not the drawing that was committed"
    )


def test_ac1_the_generator_alone_authors_the_committed_corpus_byte_for_byte(
    corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir = _generated_alone(corpus, tmp_path_factory)
    assert corpus.root.is_dir(), f"{corpus.root} is not committed — the F-RCC6 corpus does not exist yet"
    committed, fresh = _files_under(corpus.root), _files_under(out_dir)
    assert fresh == committed, (
        f"the bare copy's roster is not the committed corpus — it lacks {sorted(committed - fresh)} "
        f"and adds {sorted(fresh - committed)}"
    )
    differing = [
        rel
        for rel in sorted(committed)
        if rel != DWG_NAME and (out_dir / rel).read_bytes() != corpus.path(rel).read_bytes()
    ]
    assert differing == [], (
        f"files the generator authors on its own differ from the committed bytes — "
        f"the committed corpus is not what the committed script produces: {differing}"
    )


def test_ac1_the_generator_alone_mints_a_dwg_with_the_committed_census(
    corpus, tmp_path_factory: pytest.TempPathFactory, tmp_path: Path
) -> None:
    out_dir = _generated_alone(corpus, tmp_path_factory)
    fresh_dwg = out_dir / DWG_NAME
    assert fresh_dwg.is_file(), f"the bare copy did not write {DWG_NAME}"
    fresh = convert_dwg(fresh_dwg, tmp_path / "fresh-alone")
    committed = convert_dwg(corpus.require(DWG_NAME), tmp_path / "committed-alone")
    assert fresh.census, "the DWG minted by the bare copy has an empty census"
    assert fresh.census == committed.census, (
        "the DWG minted by the generator on its own reads a different LibreDWG census than the "
        "committed DWG"
    )


def test_ac1_the_dxf_the_generator_authors_is_an_ezdxf_document(
    corpus, tmp_path_factory: pytest.TempPathFactory
) -> None:
    out_dir = _generated_alone(corpus, tmp_path_factory)
    fresh_dxf = out_dir / DXF_NAME
    assert fresh_dxf.is_file(), f"the bare copy did not write {DXF_NAME}"
    document = ezdxf.readfile(str(fresh_dxf))
    assert document.dxfversion in versions_supported_by_new, (
        f"{DXF_NAME} declares {document.dxfversion}, which is not a version ezdxf writes"
    )
    assert document.header["$ACADVER"] == document.dxfversion
    assert document.header.get("$LASTSAVEDBY") == EZDXF_SAVER, (
        f"{DXF_NAME}'s $LASTSAVEDBY is {document.header.get('$LASTSAVEDBY')!r}, not ezdxf's stamp — "
        "the drawing was not written by ezdxf"
    )
