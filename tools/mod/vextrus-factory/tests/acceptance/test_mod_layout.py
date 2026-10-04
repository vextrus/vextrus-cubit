"""Acceptance tests for ticket f8 (the band's layout): docs/specs/factory.md §4(b), §10 row f8.

Written by the acceptance-writer before the build; the builder never changes this file. Files only:
no database, no process, no network.

    uv run pytest -rf tools/mod/vextrus-factory/tests/acceptance
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
MOD = ROOT / "tools/mod/vextrus-factory"
STATUSLINE = ROOT / "scripts/factory/statusline.mjs"
CONTRACTS = ROOT / "docs/specs/factory/contracts"
BAND_TEST = MOD / "tests/acceptance/band.test.ts"
EXPORTS_REGISTER = re.compile(
    r"export\s+(?:async\s+)?function\s+register\b|export\s+const\s+register\b|export\s*\{[^}]*\bregister\b[^}]*\}"
)


def _json(path: Path) -> object:
    assert path.is_file(), f"{path.relative_to(ROOT)} exists"
    return json.loads(path.read_text(encoding="utf-8"))


def _hooks_module() -> Path:
    """The hooks module hooks.json names, resolved as Claude Code resolves it: relative to hooks.json."""
    hooks = _json(MOD / "hooks/hooks.json")
    assert isinstance(hooks, dict)
    return (MOD / "hooks" / hooks["modules"][0]).resolve()


def test_l1_the_manifest_names_the_mod_and_a_version() -> None:
    manifest = _json(MOD / ".claude-plugin/plugin.json")
    assert isinstance(manifest, dict)
    assert manifest.get("name") == "vextrus-factory"
    assert isinstance(manifest.get("version"), str)
    assert manifest["version"].strip()


def test_l2_hooks_json_loads_register_js_which_exports_register_and_types_exist() -> None:
    hooks = _json(MOD / "hooks/hooks.json")
    assert isinstance(hooks, dict)
    assert hooks.get("modules") == ["./register.js"]
    module = _hooks_module()
    assert module.is_file(), f"the hooks module {module} exists"
    assert module.is_relative_to(MOD.resolve()), "the hooks module lies inside the mod"
    assert EXPORTS_REGISTER.search(module.read_text(encoding="utf-8")), "register.js exports register"
    assert (MOD / "types/index.d.ts").is_file(), "types/index.d.ts exists"


def test_l3_the_mod_lives_only_under_tools_mod_and_nothing_enables_or_runs_it() -> None:
    assert (MOD / ".claude-plugin/plugin.json").is_file(), (
        "the mod's folder exists at tools/mod/vextrus-factory"
    )
    for scanned in (ROOT / ".claude/skills", ROOT / ".claude/plugins"):
        if scanned.exists():
            found = [p for p in scanned.rglob("*") if p.name.startswith("vextrus-factory")]
            assert found == [], (
                f"nothing named vextrus-factory under {scanned.relative_to(ROOT)}: {found}"
            )
    settings = _json(ROOT / ".claude/settings.json")
    assert isinstance(settings, dict)
    enabled = settings.get("enabledPlugins") or {}
    assert isinstance(enabled, dict)
    on = [key for key, value in enabled.items() if key.startswith("vextrus-factory") and value is True]
    assert on == [], f".claude/settings.json enables the mod: {on}"
    workflows = sorted((ROOT / ".github/workflows").glob("*.y*ml"))
    assert workflows, "the workflows folder is read"
    runs = [
        w.name for w in workflows if re.search(r"\bclaude\s+plugin\b", w.read_text(encoding="utf-8"))
    ]
    assert runs == [], f"CI must not depend on `claude plugin`: {runs}"


def test_l4_the_status_contract_exists_parses_and_is_the_sample_the_band_test_carries() -> None:
    schema = _json(CONTRACTS / "status.schema.json")
    sample = _json(CONTRACTS / "status.sample.json")
    assert isinstance(schema, dict)
    assert isinstance(sample, dict)
    assert set(schema["required"]) <= set(sample), "the sample holds every required field"
    text = BAND_TEST.read_text(encoding="utf-8")
    carried = re.search(r"/\* SAMPLE:BEGIN \*/(.*?)/\* SAMPLE:END \*/", text, re.DOTALL)
    assert carried, "band.test.ts carries the sample between SAMPLE:BEGIN and SAMPLE:END"
    assert json.loads(carried.group(1)) == sample, "band.test.ts's SAMPLE equals status.sample.json"


def test_l5_register_js_and_statusline_mjs_hold_no_secret_or_home_path() -> None:
    files = [_hooks_module(), STATUSLINE]
    for path in files:
        assert path.is_file(), f"{path} exists"
        text = path.read_text(encoding="utf-8")
        assert "/home/riz" not in text, f"{path.name}: a home path"
        assert "TYPESAFE" not in text, f"{path.name}: a key name"
        assert not re.search(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{6,}", text), (
            f"{path.name}: a secret-looking token"
        )
        for number, line in enumerate(text.splitlines(), 1):
            code = line.strip()
            if "/home/" in code and not code.startswith(("//", "*", "/*")):
                raise AssertionError(f"{path.name}:{number}: an absolute /home/ path outside a comment")
