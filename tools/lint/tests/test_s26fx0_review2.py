"""S26-FX0 review round 2: a changed file name holding a newline cannot split into two names that the
design-gate's test-only rule reads as a test and an unrelated path (the API's names are JSON; `gh --jq`
prints them raw)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts14c14._workflows import Unsupported  # noqa: F401
from tools.lint.tests.acceptance.ts26fx0 import _runs
from tools.lint.tests.acceptance.ts26fx0._runs import StepFailed, posted, real_drawings_na

# The same stub, but the files listing runs the workflow's own --jq expression through real jq on the
# API's JSON, so a name holding a newline reaches the workflow as the API gives it.
JQ_STUB = _runs.GH_STUB.replace(
    'if method == "GET" and "/pulls/" in endpoint and endpoint.endswith("/files"):\n'
    '    sys.stdout.write(open(os.environ["GH_STUB_FILES"]).read())\n'
    "    sys.exit(0)\n",
    'if method == "GET" and "/pulls/" in endpoint and endpoint.endswith("/files"):\n'
    "    import subprocess\n"
    "    expr = args[args.index('--jq') + 1]\n"
    '    rows = json.dumps([{"filename": f} for f in json.load(open(os.environ["GH_STUB_FILES"]))])\n'
    '    done = subprocess.run(["jq", "-r", expr], input=rows, text=True, capture_output=True)\n'
    "    sys.stdout.write(done.stdout)\n"
    "    sys.stderr.write(done.stderr)\n"
    "    sys.exit(done.returncode)\n",
)
assert JQ_STUB != _runs.GH_STUB


@pytest.fixture(autouse=True)
def _api_json(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(_runs, "GH_STUB", JQ_STUB)

    def listed(temp: Path, files: list[str]) -> Path:
        path = temp / "changed-files.json"
        path.write_text(json.dumps(files))
        return path

    monkeypatch.setattr(_runs, "_listed", listed)


@pytest.mark.parametrize(
    "name",
    [
        "web/src/x.test.\n/locales/en.po",
        "web/src/ui/x.test.\n/Button.tsx",
        "web/src/x.test.\r/Button.tsx",
        "web/src/x.test.\x00/Button.tsx",
    ],
)
def test_a_name_holding_a_control_character_never_reads_as_a_test(name: str, tmp_path: Path) -> None:
    try:
        statuses = real_drawings_na([name], tmp_path)
    except StepFailed:
        return  # fails closed: the list step fails, nothing is posted
    assert posted(statuses, "design-gate") == [], f"design-gate posted n/a for {name!r}"


def test_a_plain_test_file_is_still_not_applicable(tmp_path: Path) -> None:
    statuses = real_drawings_na(["web/src/x.test.ts"], tmp_path)
    assert [s["state"] for s in posted(statuses, "design-gate")] == ["success"]
