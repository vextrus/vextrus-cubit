"""Ticket S25-E2E: the served product's smoke test (`.github/workflows/e2e.yml`) gets the dumper.

Authority:
- The e2e workflow's own header: it serves "the job workers (the CAD queue's on the toolchain at its
  pins, installed as engine.yml installs it)".
- `engine/read/acadsharp/__init__.py`: the reader runs "the dumper installed at the checkout's pin, in
  the install folder's `<sha256[:12]>/`". The folder is `/opt/vextrus/acadsharp-dump` and the pin is
  `toolchain/acadsharp-dump.sha256`. A dumper that is missing is `DumperNotInstalled`; one that differs
  is `DumperNotPinned`.
- `scripts/owner/toolchain.sh`: the dumper is "built here from tools/acadsharp-dump/ with that SDK, and
  installed only when its sha256 is the pin". Afterwards `/opt/vextrus` goes to root, writable by none.

Measured on CI run 38337666520 (main, 13 Oct 2026): the CAD worker failed every read with
`engine.decoders_agree.not_installed` (`/opt/vextrus/acadsharp-dump` missing). The Step 1 Count stayed
"Confirmed 0 / —" and `web/e2e/acceptance/t22/smoke.spec.ts:62` timed out. With the dumper installed,
the same spec passes locally.

The workflow is read as text, step by step, and judged by what each step runs. Step names are not
used. Two routes are accepted:
- build from tools/acadsharp-dump/ with the pinned SDK;
- download a built dumper and check its sha256 against the pin.
Running `scripts/owner/toolchain.sh`, the owner's install of record, counts as the build route and
brings its own pin check. A step the workflow runs as a repo shell script (`scripts/...sh`,
`tools/...sh`) is read with that script's text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from engine.read.acadsharp import PIN, pinned_sha256

ROOT = Path(__file__).resolve().parents[4]
WORKFLOW = ROOT / ".github" / "workflows" / "e2e.yml"
INSTALL_FOLDER = "/opt/vextrus/acadsharp-dump"
TOOLCHAIN_SH = "scripts/owner/toolchain.sh"
NOT_INSTALLED = "e2e.yml installs no ACadSharp dumper"

# The ways a shell or Python line takes the first 12 characters of the pin.
FIRST_12 = re.compile(r":0:12\}|::12\}|cut -c ?1?-12\b|head -c ?12\b|\[:12\]")


@dataclass(frozen=True)
class Step:
    index: int
    block: str  # the step's whole YAML text
    run: str  # its `run` script, shell comment lines left out, with any repo script it runs appended


def _keys(block: str) -> dict[str, str]:
    """The step's own keys (`if`, `continue-on-error`, ...) as written on their first line."""
    lines = block.splitlines()
    first = re.match(r"^( *)- ", lines[0])
    assert first, lines[0]
    indent = len(first.group(1)) + 2
    keys: dict[str, str] = {}
    for n, line in enumerate(lines):
        text = line[indent:] if n else line[len(first.group(0)) :]
        if n and (len(line) - len(line.lstrip(" ")) != indent):
            continue
        match = re.match(r"^([A-Za-z][\w-]*):\s*(.*)$", text)
        if match:
            keys[match.group(1)] = match.group(2).strip()
    return keys


def _run_text(block: str) -> str:
    match = re.search(r"^[ \t]*(?:- )?run:[ \t]*(.*)$", block, re.MULTILINE)
    if not match:
        return ""
    text = match.group(1) + "\n" + block[match.end() :]
    for script in re.findall(r"\b((?:scripts|tools)/[\w./-]+\.sh)\b", text):
        path = ROOT / script
        if path.is_file():
            text += "\n" + path.read_text(encoding="utf-8")
    return "\n".join(line for line in text.splitlines() if not line.strip().startswith("#"))


def smoke_steps() -> list[Step]:
    """The smoke job's steps, in order."""
    text = WORKFLOW.read_text(encoding="utf-8")
    job = re.search(r"^  smoke:\s*$", text, re.MULTILINE)
    assert job, "e2e.yml has no `smoke` job"
    body = text[job.end() :]
    following = re.search(r"^  [A-Za-z][\w-]*:\s*$", body, re.MULTILINE)
    body = body[: following.start()] if following else body
    steps = re.search(r"^( +)steps:[ \t]*$", body, re.MULTILINE)
    assert steps, "e2e.yml's smoke job has no steps"
    items = body[steps.end() :]
    dash = re.search(r"^( +)- ", items, re.MULTILINE)
    assert dash, "e2e.yml's smoke job has no steps"
    starts = [m.start() for m in re.finditer(rf"^{dash.group(1)}- ", items, re.MULTILINE)]
    blocks = [items[a:b] for a, b in zip(starts, [*starts[1:], len(items)], strict=True)]
    return [Step(n, block, _run_text(block)) for n, block in enumerate(blocks)]


def _first(steps: list[Step], pattern: str, what: str) -> int:
    for step in steps:
        if re.search(pattern, step.run):
            return step.index
    raise AssertionError(f"e2e.yml's smoke job has no step that {what}")


def handover(steps: list[Step]) -> int:
    """The step that hands /opt/vextrus to root."""
    return _first(steps, r"chown -R root:root /opt/vextrus\b", "hands /opt/vextrus to root")


def workers_start(steps: list[Step]) -> int:
    """The step that starts the CAD queue's worker."""
    return _first(steps, r"manage\.py worker --queue cad", "starts the CAD queue's worker")


def pinned_sdk(steps: list[Step]) -> int:
    """The step that installs the .NET SDK at toolchain/dotnet.version."""
    return _first(steps, r"toolchain/dotnet\.version", "installs the .NET SDK at its pin")


def _by_toolchain_sh(step: Step) -> bool:
    return bool(re.search(rf"(^|[\s/]){re.escape(TOOLCHAIN_SH)}\b", step.run))


def install_steps(steps: list[Step]) -> list[Step]:
    """The steps that put a dumper under the install folder the engine reads."""
    return [s for s in steps if INSTALL_FOLDER + "/" in s.run or _by_toolchain_sh(s)]


def the_install() -> tuple[list[Step], Step]:
    steps = smoke_steps()
    found = install_steps(steps)
    assert found, f"{NOT_INSTALLED} under {INSTALL_FOLDER}/ (the engine's DumperNotInstalled on CI)"
    return steps, found[-1]


def test_the_dumper_is_installed_before_root_takes_opt_vextrus() -> None:
    steps, install = the_install()
    assert install.index < handover(steps), (
        "e2e.yml installs the ACadSharp dumper after /opt/vextrus is handed to root, writable by none"
    )


def test_the_dumper_is_installed_before_the_workers_start() -> None:
    steps, install = the_install()
    assert install.index < workers_start(steps), (
        "e2e.yml starts the CAD worker before the dumper is installed"
    )


def test_the_dumper_lands_in_the_folder_its_pin_names() -> None:
    _, install = the_install()
    digest = pinned_sha256()
    written_in = "e2e.yml writes the dumper's pin in; it is read from toolchain/acadsharp-dump.sha256"
    assert digest not in install.run, written_in
    assert digest[:12] not in install.run, written_in
    if _by_toolchain_sh(install):
        return
    assert f"toolchain/{PIN.name}" in install.run, (
        f"the install does not read the pin from toolchain/{PIN.name}, where the engine reads it"
    )
    assert FIRST_12.search(install.run), (
        f"the install does not name the folder {INSTALL_FOLDER}/<the pin's first 12 hex>/ the engine"
        f" runs the dumper from (now {INSTALL_FOLDER}/{digest[:12]}/acadsharp-dump)"
    )
    assert re.search(r"\bacadsharp-dump\b", install.run.replace(INSTALL_FOLDER, "")), (
        "the install does not name the program acadsharp-dump in the pin's folder"
    )


def test_the_dumper_is_installed_only_when_its_sha256_is_the_pin() -> None:
    _, install = the_install()
    if _by_toolchain_sh(install):
        return  # toolchain.sh installs the dumper only when its sha256 is the pin
    lines = install.run.splitlines()
    checks = [line for line in lines if "sha256sum" in line and "acadsharp-dump" in line]
    unchecked = (
        f"the install does not check acadsharp-dump's sha256 (sha256sum) against toolchain/{PIN.name}"
    )
    assert checks, unchecked
    assert f"toolchain/{PIN.name}" in install.run, unchecked


def test_the_dumper_is_built_with_the_pinned_sdk_or_downloaded() -> None:
    steps, install = the_install()
    built = "tools/acadsharp-dump" in install.run and "dotnet" in install.run
    fetched = re.search(r"\bgh release download\b|\bcurl\b|\bwget\b", install.run) is not None
    assert built or fetched, (
        "the install neither builds the dumper from tools/acadsharp-dump/ nor downloads a built one"
    )
    if built and not fetched and not _by_toolchain_sh(install):
        assert install.index > pinned_sdk(steps), (
            "the dumper is built before the pinned .NET SDK is installed"
        )


def test_the_install_cannot_be_skipped_or_fail_quietly() -> None:
    _, install = the_install()
    keys = _keys(install.block)
    assert "if" not in keys, f"the dumper's install runs only `if: {keys.get('if')}`"
    assert keys.get("continue-on-error", "false") == "false", (
        "the dumper's install may fail and the job go on"
    )
