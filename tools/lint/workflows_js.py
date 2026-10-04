"""The workflow-script check (docs/specs/factory.md 3.8). A Claude Code workflow script under
`.claude/workflows/` must replay the same way on resume, so it may not read the clock or a random
number (`Date.now()`, `Math.random()`, a no-argument `new Date()`; a date passed in through `args` is
fine) nor load code at run time (`import(`); it must parse (`node --check`); and its name may not be a
built-in command's or alias's, which would shadow or be shadowed by it. It reads the files as text,
comments included, and so errs towards failing (like `tools/lint/workflows.py`). Standard library and
`node` only.

    python -m tools.lint.workflows_js [root]
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

# The built-in commands and aliases (the Claude Code commands table, 4 Oct 2026).
BUILT_INS = frozenset(
    """
    add-dir advisor agents artifact-capabilities artifact-diagramming artifacts auto-mode-setup
    autocompact autofix-pr background batch branch btw bug cd chrome claude-api claude-in-chrome clear
    code-review color compact config context copy cost dataviz debug deep-research design design-login
    design-sync desktop diff doctor effort exit export fast feedback fewer-permission-prompts focus fork
    goal heapdump help hooks ide import init insights install-github-app install-slack-app keybindings
    list-agents login logout loop mcp memory mobile model output-style passes permissions plan plugin
    plugin-authoring powerup pr-comments privacy-settings radio rate-limit-options recap release-notes
    reload-plugins reload-skills remote-control remote-env rename resume review rewind run
    run-skill-generator sandbox schedule scroll-speed security-review setup-bedrock setup-vertex simplify
    skill-doctor skills slides stats status statusline stickers stop subtask tasks team-onboarding
    teleport terminal-setup theme tui ultraplan ultrareview update-config upgrade usage usage-credits
    verify vim voice web-setup workflow-authoring workflows
    reset new ios android checkpoint undo bashes tp
    """.split()
)
BANNED = (
    (re.compile(r"\bDate\s*\.\s*now\s*\("), "Date.now() reads the clock: pass the time in args"),
    (re.compile(r"\bMath\s*\.\s*random\s*\("), "Math.random() is not replayable"),
    (re.compile(r"\bnew\s+Date\s*\(\s*\)"), "new Date() with no argument reads the clock"),
    (re.compile(r"\bimport\s*\("), "import( loads code at run time"),
)


def scripts(root: Path) -> list[Path]:
    folder = root / ".claude" / "workflows"
    return sorted(path for path in folder.glob("*.js") if path.is_file()) if folder.is_dir() else []


def syntax_problem(path: Path) -> str | None:
    node = shutil.which("node")
    if node is None:
        return "node is not on PATH: cannot check the syntax"
    # As an ES module: workflow scripts use `export` and top-level `await`.
    done = subprocess.run(
        [node, "--input-type=module", "--check"],
        input=path.read_text(errors="replace"),
        capture_output=True,
        text=True,
        check=False,
    )
    if done.returncode == 0:
        return None
    lines = [line for line in done.stderr.splitlines() if "Error" in line]
    return lines[0].strip() if lines else "node --check failed"


def problems(root: Path) -> list[str]:
    found = []
    for path in scripts(root):
        name = path.relative_to(root).as_posix()
        if path.stem in BUILT_INS:
            found.append(f"{name}: '{path.stem}' is a built-in command or alias: rename the workflow")
        text = path.read_text(errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            found.extend(f"{name}:{number}: {why}" for pattern, why in BANNED if pattern.search(line))
        if (problem := syntax_problem(path)) is not None:
            found.append(f"{name}: does not parse: {problem}")
    return found


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) > 1:
        print("usage: python -m tools.lint.workflows_js [root]", file=sys.stderr)
        return 2
    found = problems(Path(args[0]) if args else Path.cwd())
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
