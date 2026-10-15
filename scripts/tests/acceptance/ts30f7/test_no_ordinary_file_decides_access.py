"""S30-F7, issue #898's owed check: no file of the repository's tree that the review tiers judge
ordinary (one lens, the refuter on one head in five) decides access.

PR #896's round 1 CONFIRMED (60) that four access-deciding files took the one-lens tier inside the
folders it listed ordinary (`web/src/**`, `vextrus/drawings/**`). This walks every file of HEAD's tree
(`git ls-tree -r HEAD`), asks the tiers' reader which are ordinary (`scripts.factory.tiers.risk_matches`:
a file it does not return is ordinary), and fails on each ordinary file that sits in an access module,
imports from one, or names the access nouns (`_access_markers.py`, beside this file, says why that is
enough). A wall added later on an ordinary path fails here until the tiers judge it risk."""

import posixpath
import re
import subprocess
from pathlib import Path

import scripts.factory.tiers as tiers  # type: ignore[import-not-found, unused-ignore]
from scripts.tests.acceptance.ts30f7 import _access_markers as markers

ROOT = Path(__file__).resolve().parents[4]

# The four files PR #896's round 1 found deciding access on the one-lens tier: the marks must catch
# each of them, or the walk below proves nothing.
FOUND_BY_896 = (
    "vextrus/drawings/acts.py",
    "vextrus/drawings/http/files.py",
    "web/src/routes/_app/members/index.tsx",
    "web/src/api/client.ts",
)

PY_IMPORT = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import\s+([^\n#]+)|import\s+([\w., ]+))", re.M)
JS_IMPORT = re.compile(r"""(?:\bfrom|\bimport|\brequire)\s*\(?\s*["']([^"']+)["']""")


def head_tree() -> list[str]:
    done = subprocess.run(
        ["git", "ls-tree", "-r", "-z", "--name-only", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    assert done.returncode == 0, f"git ls-tree HEAD failed: {done.stderr.decode(errors='replace')}"
    files = [name.decode(errors="replace") for name in done.stdout.split(b"\0") if name]
    assert len(files) > 100, f"HEAD's tree read as {len(files)} files: the walk would prove nothing"
    return files


def in_access_path(path: str) -> bool:
    return any(
        path == place or path.startswith((place + "/", place + ".")) for place in markers.ACCESS_PATHS
    )


def python_modules(text: str) -> list[str]:
    found: list[str] = []
    for source, names, plain in PY_IMPORT.findall(text):
        if source:
            found.append(source)
            found += [f"{source}.{name.strip().split(' ')[0]}" for name in names.strip("()").split(",")]
        else:
            found += [name.strip().split(" ")[0] for name in plain.split(",")]
    return [module for module in found if module]


def web_targets(path: str, text: str) -> list[str]:
    alias, folder = markers.WEB_ALIAS
    targets = []
    for spec in JS_IMPORT.findall(text):
        if spec.startswith(alias):
            targets.append(folder + spec[len(alias) :])
        elif spec.startswith("."):
            targets.append(posixpath.normpath(posixpath.join(posixpath.dirname(path), spec)))
    return targets


def access_marks(path: str) -> list[str]:
    """Why `path` decides access (empty when nothing marks it)."""
    why: list[str] = []
    if in_access_path(path):
        why.append("in an access module")
    if noun := markers.NOUNS.search(path):
        why.append(f"its path names {noun.group(0)!r}")
    if not path.endswith(markers.SOURCE_SUFFIXES):
        return why
    try:
        text = (ROOT / path).read_text(errors="replace")
    except OSError:
        return why
    if path.endswith(".py"):
        for module in python_modules(text):
            if any(module == m or module.startswith(m + ".") for m in markers.ACCESS_MODULES):
                why.append(f"imports {module}")
    else:
        for target in web_targets(path, text):
            if in_access_path(target):
                why.append(f"imports {target}")
    if noun := markers.NOUNS.search(text):
        why.append(f"names {noun.group(0)!r}")
    return why


def test_no_file_the_tiers_judge_ordinary_decides_access() -> None:
    tree = head_tree()
    unmarked = [path for path in FOUND_BY_896 if path in tree and not access_marks(path)]
    assert not unmarked, f"_access_markers.py does not mark the walls #896 missed: {unmarked}"
    risk = set(tiers.risk_matches(tree))
    ordinary = [path for path in tree if path not in risk]
    deciding = {path: why for path in ordinary if (why := access_marks(path))}
    assert not deciding, (
        f"scripts.factory.tiers judges {len(deciding)} access-deciding file(s) ordinary (one lens):\n"
        + "\n".join(f"  {path}: {', '.join(why)}" for path, why in sorted(deciding.items()))
    )
