"""Shared ground for the F-RCC6 sanity suite (L-CAD-09).

The corpus under `fixtures/rcc6/` is read as data — the committed drawing, its authoring-time
tallies, the authored inputs and the hand golden. Nothing here reads the generator's source: the
generator is driven exactly as the increment spec spells its CLI, and judged by what it writes.

Every read asserts from inside the test that asks for it (a corpus that is not there fails the
test by name rather than erroring its fixture), and expensive reads are memoised per session.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

#: cad/tests/sanity/conftest.py -> cad/ -> the checkout.
CAD_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = CAD_ROOT.parent

#: Where the increment spec puts the generator and the corpus it writes.
GENERATOR_REL = "fixtures/gen/rcc6.py"
CORPUS_REL = "fixtures/rcc6"

#: What a corpus manifest is called, and the golden takeoff a graded corpus promises in it.
MANIFEST_REL = "manifest.json"
GOLDEN_REL = "takeoff.golden.json"

#: The dependency group the spec adds for fixture generation (reportlab, pillow, pypdfium2).
FIXTURES_GROUP = "fixtures"

#: A budget for the suite's own subprocesses: the first `uv run` with a fresh group syncs it, and
#: the generator renders eight sheets at 200 DPI.
SUBPROCESS_TIMEOUT_SECONDS = 900.0


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def declared_files(manifest: dict[str, Any]) -> frozenset[str]:
    """Every file a corpus manifest promises: v1.1 spells them as a list, schema 2 as a digest map."""
    names: set[str] = set()
    files = manifest.get("files")
    if isinstance(files, list):
        names |= {str(name) for name in files}
    outputs = manifest.get("outputs")
    if isinstance(outputs, dict):
        names |= {str(name) for name in outputs}
    return frozenset(names)


@dataclass(frozen=True)
class Corpus:
    """The committed F-RCC6 corpus, addressed by the paths the spec names."""

    root: Path
    _memo: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)

    @property
    def generator(self) -> Path:
        return REPO_ROOT / GENERATOR_REL

    def path(self, relative: str) -> Path:
        return self.root / relative

    def require(self, relative: str) -> Path:
        target = self.path(relative)
        assert target.is_file(), (
            f"fixtures/{self.root.name}/{relative} is not committed — the corpus does not provide it yet"
        )
        return target

    def manifest(self) -> dict[str, Any]:
        """What the corpus says of itself. A graded corpus owes one; a missing one fails by name."""
        return self.once(f"manifest:{self.root.name}", lambda: self.read_json(MANIFEST_REL))

    def declares(self, relative: str) -> bool:
        """Whether the manifest promises `relative` — what arms a check, in place of the file itself."""
        return relative in declared_files(self.manifest())

    def read_json(self, relative: str, **kwargs: Any) -> Any:
        return json.loads(self.require(relative).read_text(encoding="utf-8"), **kwargs)

    def once(self, name: str, make: Any) -> Any:
        """`make()` at most once per session under `name` — for an ingest or a generator run."""
        if name not in self._memo:
            self._memo[name] = make()
        return self._memo[name]

    def run_in_fixtures_group(self, argv: list[str]) -> subprocess.CompletedProcess[str]:
        """`uv run --project cad --group fixtures python <argv…>` from the checkout root."""
        return subprocess.run(
            ["uv", "run", "--project", "cad", "--group", FIXTURES_GROUP, "python", *argv],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )

    def require_generator(self) -> Path:
        assert self.generator.is_file(), (
            f"{GENERATOR_REL} is not committed — the generator does not exist yet"
        )
        return self.generator

    def generate(self, out_dir: Path) -> subprocess.CompletedProcess[str]:
        """The generator CLI, exactly as the spec spells it, writing into `out_dir`."""
        self.require_generator()
        return self.run_in_fixtures_group([GENERATOR_REL, "--out", str(out_dir)])

    def generate_from_a_bare_copy(self, scratch: Path) -> tuple[Path, subprocess.CompletedProcess[str]]:
        """The generator copied ALONE into `scratch` and run from there.

        No corpus sits beside the copy and the working directory is `scratch`, so whatever lands
        in `scratch/out` can only be what the script authors — L-CAD-09's "authored by committed
        scripts" is a property of the script, not of the bytes committed next to it. The cad
        project (its `fixtures` group, `vextrus_cad`) is reached by absolute path.
        """
        script = scratch / self.generator.name
        shutil.copyfile(self.require_generator(), script)
        out_dir = scratch / "out"
        run = subprocess.run(
            [
                "uv",
                "run",
                "--project",
                str(CAD_ROOT),
                "--group",
                FIXTURES_GROUP,
                "python",
                str(script),
                "--out",
                str(out_dir),
            ],
            cwd=scratch,
            capture_output=True,
            text=True,
            check=False,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
        return out_dir, run


@pytest.fixture(scope="session")
def corpus() -> Corpus:
    return Corpus(REPO_ROOT / CORPUS_REL)


def _golden_corpora() -> tuple[str, ...]:
    """Every fixture whose own manifest declares a golden takeoff (AM-01: two fixtures today).

    The list is read off `fixtures/*/manifest.json` rather than authored here, so a third corpus is
    graded from the day its manifest lands and not from the day someone remembers to edit a tuple.
    F-RCC6 is the frozen J-000 corpus with its drawings; F-RCC6-BNBC is the M3/M4 yardstick, which
    has no DXF yet — its sanity is the golden's own self-consistency, so the checks that read a
    drawing stay on `corpus` and the golden checks run over every declared corpus through
    `golden_corpus`.
    """
    declared = [
        path.parent.name
        for path in sorted((REPO_ROOT / "fixtures").glob(f"*/{MANIFEST_REL}"))
        if GOLDEN_REL in declared_files(json.loads(path.read_text(encoding="utf-8")))
    ]
    assert declared, (
        f"no fixtures/*/{MANIFEST_REL} declares a {GOLDEN_REL} — the golden lane would grade nothing"
    )
    return tuple(declared)


GOLDEN_CORPORA = _golden_corpora()

#: F-RCC6-BNBC's drawing corpus (Wave B: rcc6-bnbc.dxf/.model.dxf/.dwg, both PDFs, rasters,
#: sanity.json). Its generator is the package `fixtures/gen/rcc6_bnbc` (`python -m`), so the
#: bare-copy run does not apply; test_rcc6_bnbc_*.py read it through this fixture.
BNBC_CORPUS_REL = "fixtures/rcc6-bnbc"
BNBC_GENERATOR_MODULE = "fixtures.gen.rcc6_bnbc"


@pytest.fixture(scope="session", params=GOLDEN_CORPORA, ids=GOLDEN_CORPORA)
def golden_corpus(request: pytest.FixtureRequest) -> Corpus:
    return Corpus(REPO_ROOT / "fixtures" / str(request.param))


@pytest.fixture(scope="session")
def bnbc_corpus() -> Corpus:
    return Corpus(REPO_ROOT / BNBC_CORPUS_REL)
