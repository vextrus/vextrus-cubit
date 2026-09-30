"""The CAD worker's cap sits above every sandboxed reader's own memory limit (ticket 24).

The cap is the worker's hard RLIMIT_AS, inherited by every reader it starts; each reader's `prlimit`
then sets that reader's own limit, and may not raise it above the inherited hard limit ("Operation not
permitted"). A cap below a reader's limit would fail every read that starts that reader.
"""

import resource
import subprocess
from pathlib import Path

from django.conf import settings

from engine.plot import picture
from engine.read import pdf, sandbox

ROOT = Path(__file__).resolve().parents[3]


def test_the_cap_is_at_least_every_sandboxed_readers_memory_limit() -> None:
    cap = settings.VEXTRUS_CAD_WORKER_MEMORY_BYTES
    assert cap is not None
    for limits in (sandbox.DEFAULT_LIMITS, pdf.LIMITS, picture.LIMITS):
        assert limits.memory_bytes <= cap


def test_a_reader_limit_above_an_inherited_hard_limit_is_refused() -> None:
    # Why the floor matters: prlimit cannot raise a limit past the hard limit it inherits.
    low = 2 * 2**30

    def lower() -> None:
        resource.setrlimit(resource.RLIMIT_AS, (low, low))

    refused = subprocess.run(
        [sandbox.PRLIMIT, f"--as={low + 2**30}", "true"],
        preexec_fn=lower,
        capture_output=True,
        text=True,
        check=False,
    )
    allowed = subprocess.run(
        [sandbox.PRLIMIT, f"--as={low - 2**30}", "true"],
        preexec_fn=lower,
        capture_output=True,
        text=True,
        check=False,
    )

    assert refused.returncode != 0
    assert "Operation not permitted" in refused.stderr
    assert allowed.returncode == 0


def test_the_docs_no_longer_say_the_cad_worker_has_no_cap() -> None:
    # Review of 24: CLAUDE.md and the M0 plan still said the cap was None after 24 set it.
    for path in (ROOT / "CLAUDE.md", ROOT / "docs" / "plans" / "M0.md"):
        text = " ".join(path.read_text(encoding="utf-8").split())
        assert "no memory cap yet" not in text, path
        assert "is `None` until 24" not in text, path
        assert "is `None` in `vextrus/settings/jobs.py`" not in text, path


def test_the_owners_cold_3d_load_is_on_10_mbps_with_no_cache() -> None:
    # ADR 0022: the 3D model on screen in 3 s cold on 10 Mbps.
    note = (ROOT / "docs" / "research" / "m0-measurements.md").read_text(encoding="utf-8")
    owner = note[note.index("## The owner's run") :]
    assert "10 Mbps" in owner
    assert "Disable cache" in owner
