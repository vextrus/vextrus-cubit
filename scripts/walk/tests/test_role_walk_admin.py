"""The role walker's and the retry's briefs name the Django admin's URL (the API origin) for M0-FL1.

M0-FL1 (staff create two Developers) is done in the Django admin, which sits on the API origin; the web
dev server proxies only /api. A brief naming only the web origin leaves M0-FL1 NOT_WALKED. The workflow
runs under the S25-W3 acceptance harness (stubbed runtime); its served API is http://127.0.0.1:8999.
"""

import importlib.util
from pathlib import Path
from types import ModuleType

ACCEPTANCE = Path(__file__).parent / "acceptance" / "ts25w3" / "test_s25_w3_role_walk.py"
ADMIN = "http://127.0.0.1:8999/admin/"
WEB = "http://127.0.0.1:5999"


def _harness() -> ModuleType:
    spec = importlib.util.spec_from_file_location("ts25w3_role_walk_harness", ACCEPTANCE)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_the_role_walkers_brief_names_the_admin_url_and_the_web_origin(tmp_path: Path) -> None:
    h = _harness()
    calls = h._run(tmp_path, ux_unwalked=h.ROLE_ITEMS, others=[h.ALL_PASS])
    prompt = h._role_stage(calls)["prompt"]
    assert ADMIN in prompt
    assert WEB in prompt


def test_the_retrys_brief_names_the_admin_url(tmp_path: Path) -> None:
    h = _harness()
    stuck = {**h.ALL_PASS, "M0-FL1": "NOT_WALKED"}
    calls = h._run(tmp_path, ux_unwalked=h.ROLE_ITEMS, others=[stuck, h.ALL_PASS])
    retries = [c for c in h._stages(calls) if c is not h._role_stage(calls)]
    assert len(retries) == 1
    assert ADMIN in retries[0]["prompt"]
