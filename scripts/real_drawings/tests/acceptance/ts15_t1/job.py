"""An invented read job for ticket S15-T1's tests, committed on main over `world.py`'s own: the job's
two entries (`vextrus/takeoff/tasks/read_file.py`, `vextrus/takeoff/services/export.py`), the engine
modules they load (one at the top, one inside a function, one as a child process, one by `-m`), a
conventions file read beside a loaded module, an engine module nothing names, tests beside both, and a
web file (no engine path). Invented names only (`qx_`); no real module, no drawing text."""

import json

from scripts.real_drawings.tests.world import REPO, World, run_git

READ_FILE = "vextrus/takeoff/tasks/read_file.py"
EXPORT = "vextrus/takeoff/services/export.py"
PLAN = "engine/read/qx_plan.py"
"""Imported at the top of the read job's entry: the reader every reading change goes through."""
LAZY = "engine/read/qx_lazy.py"
"""Imported inside the entry's function only: loaded when the job reads, not when it is imported."""
CHILD = "engine/read/qx_child.py"
"""Imported by code the reader hands a child interpreter (`python -c`)."""
RUNNER = "engine/read/qx_runner.py"
"""Run by the reader as `python -m engine.read.qx_runner`."""
CONVENTIONS = "engine/read/conventions/qx-default.json"
"""Read by the reader from its own folder's `conventions/`."""
SPARE = "engine/read/qx_spare.py"
"""An engine module the job never imports or names."""
JOB_TEST = "vextrus/takeoff/tests/test_qx_read.py"
ENGINE_TEST = "engine/read/tests/test_qx_plan.py"
WEB = "web/src/qx-panel.ts"

JOB: dict[str, str | None] = {
    "vextrus/__init__.py": "",
    "vextrus/settings/__init__.py": 'INSTALLED_APPS = ["vextrus.takeoff"]\n',
    "vextrus/settings/job.py": (REPO / "vextrus" / "settings" / "job.py").read_text(encoding="utf-8"),
    ".github/checkout-also.txt": (REPO / ".github" / "checkout-also.txt").read_text(encoding="utf-8"),
    "engine/read/__init__.py": "",
    PLAN: (
        "import json\nimport subprocess\nimport sys\nfrom pathlib import Path\n\n"
        'QX_CONVENTIONS = Path(__file__).with_name("conventions") / "qx-default.json"\n'
        'QX_CHILD = "from engine.read import qx_child\\nqx_child.qx_main()\\n"\n\n\n'
        "def qx_plan(name: str) -> str:\n"
        '    subprocess.run([sys.executable, "-c", QX_CHILD], check=True)\n'
        '    subprocess.run([sys.executable, "-m", "engine.read.qx_runner"], check=True)\n'
        '    return name + json.loads(QX_CONVENTIONS.read_text())["qx"]\n'
    ),
    LAZY: 'QX_LAZY = "an invented lazy reading"\n',
    CHILD: "def qx_main() -> None:\n    return None\n",
    RUNNER: 'QX_RUNNER = "an invented runner"\n',
    CONVENTIONS: json.dumps({"qx": "an invented convention"}) + "\n",
    SPARE: "QX_SPARE = 7\n",
    "engine/read/tests/__init__.py": "",
    ENGINE_TEST: "from engine.read import qx_plan\n\nQX = qx_plan\n",
    "vextrus/takeoff/__init__.py": "",
    "vextrus/takeoff/apps.py": "QX_TAKEOFF_APP = 1\n",
    "vextrus/takeoff/models.py": "QX_TAKEOFF_MODEL = 2\n",
    "vextrus/takeoff/tasks/__init__.py": "",
    READ_FILE: (
        "from engine.read.qx_plan import qx_plan\n\n\n"
        "def read(name: str) -> str:\n"
        "    from engine.read import qx_lazy\n\n"
        "    return qx_plan(name) + qx_lazy.QX_LAZY\n"
    ),
    "vextrus/takeoff/services/__init__.py": "",
    EXPORT: (
        "from vextrus.takeoff.tasks import read_file\n\n\n"
        'def main() -> str:\n    return read_file.read("an invented set")\n'
    ),
    "vextrus/takeoff/tests/__init__.py": "",
    JOB_TEST: "from vextrus.takeoff.tasks import read_file\n\nQX = read_file\n",
    WEB: "export const qxPanel = 1;\n",
}


def job_world(world: World, extra: dict[str, str | None] | None = None) -> World:
    """`world` with the invented job (and `extra` over it) committed on main."""
    world.commit("main", {**JOB, **(extra or {})})
    return world


def edited(world: World, path: str) -> str:
    """The file as main holds it, with one invented change that keeps it what it was."""
    text = run_git(world.repo, "show", f"main:{path}")
    if path.endswith(".py"):
        return text + "\nQX_EDITED = True\n"
    if path.endswith(".json"):
        return json.dumps({**json.loads(text), "qx_edited": True}) + "\n"
    return text + "\n// an invented edit\n"


def edits(world: World, *paths: str) -> dict[str, str | None]:
    return {path: edited(world, path) for path in paths}
