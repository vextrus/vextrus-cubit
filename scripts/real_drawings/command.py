"""`scripts/real-drawings <PR number | branch | main> [--no-post]`: the real-drawing check, regression
only (the M0 plan, "The real-drawing check", steps 1-7; ADRs 0026 and 0030 as amended in session 02).

Run from the owner's checkout of main. It measures the head: the engine paths' files into a scratch
checkout, the refusals, the locked wheels fetched by hash, the install and the harness inside the
sandbox, the exports taken out link-free and checked against main's schema (or, when the head changes
the schema, against its own, which the run says so the diff is read). It measures main the same
way when main's code hash is not cached, and diffs each Development Set's export against main's under
the fixed matching, printing the counts gained, lost and changed per measure; the item list, which
holds drawing text, stays under the owner's cache. Exports are cached by (code hash, set content).

A posting run is a PR without `--no-post`: under the drop folder's lock, the owner accepts or rejects
the changes (a lost item only with a reason), the command writes the run's own folder in the drop
folder (the exports, and the metadata and summary it writes itself) and runs the poster as the key
user, which asks the owner's password. A branch or main, or `--no-post`, never posts.
"""

import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import time
import tomllib
from collections import Counter
from collections.abc import Callable, Mapping
from contextlib import nullcontext
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from scripts.real_drawings import drop, sandbox, wheels
from scripts.real_drawings.diff import MEASURES, compare, failures, sizes
from scripts.real_drawings.schema import SchemaError, problems
from scripts.real_drawings.source import (
    MAIN,
    Head,
    Refused,
    code_hash,
    engine_files,
    git,
    refusals,
    resolve,
    set_digest,
    show,
    write_checkout,
)

ROOT = Path(__file__).resolve().parents[2]
SETS = {"sample-project": ".private/reference/sample-project", "edison": ".private/reference/edison"}
SCHEMA = "engine/export.schema.json"
PATTERNS = ".github/engine-paths.txt"
POSTER_CONFIG = "scripts/owner/post-status.toml"
REASON_MOST = 100


@dataclass(frozen=True)
class Machine:
    """Where the check reads and writes, and what tests replace (the sandbox, the fetch, the poster)."""

    repo: Path
    toolchain: Path
    cache: Path
    drop: Path
    sets: Mapping[str, Path]
    sandbox: Callable[[sandbox.Job, Path], None] = sandbox.run
    fetch: Callable[[Path, Path, Path, Path], None] = wheels.fetch
    post: Callable[[str], int] = field(default=lambda run_id: 1)
    ask: Callable[[str], str] = input
    say: Callable[[str], None] = print


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scripts/real-drawings", description=__doc__.split("\n\n")[0])
    parser.add_argument("target", help="a PR number, a local branch, or main")
    parser.add_argument("--no-post", action="store_true", help="measure and diff only; never post")
    args = parser.parse_args(argv)
    machine = owners_machine()
    try:
        return run(args.target, no_post=args.no_post, m=machine)
    except Refused as refused:
        print(f"real-drawings: refused: {refused}", file=sys.stderr)
        return 2


def owners_machine() -> Machine:
    config = tomllib.loads((ROOT / POSTER_CONFIG).read_text())
    cache = Path(os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache") / "vextrus-real-drawings"
    # The sets live under the main checkout's .private/, which a worktree does not have.
    common = git(ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir").decode().strip()
    sets_root = Path(common).parent

    def post(run_id: str) -> int:
        command = ["sudo", "-u", config["key_user"], config["installed"], "real-drawings", run_id]
        print("The poster runs as the key user: type your password.")
        return subprocess.run(command, check=False).returncode

    return Machine(
        repo=ROOT,
        toolchain=Path("/opt/vextrus"),
        cache=cache,
        drop=Path(config["drop"]),
        sets={name: sets_root / path for name, path in SETS.items()},
        post=post,
    )


def run(target: str, *, no_post: bool, m: Machine) -> int:
    started = time.monotonic()
    posting = target.isdigit() and not no_post
    with drop.posting_lock(m.drop) if posting else nullcontext():
        if posting and git(m.repo, "symbolic-ref", "--short", "HEAD").decode().strip() != MAIN:
            raise Refused("a posting run runs main's copy of the command: check out main first")
        head = resolve(m.repo, target)
        base = resolve(m.repo, MAIN)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        run_id = f"{stamp}-{head.commit[:12]}-{secrets.token_hex(2)}"
        main = mains(m.repo, base.commit)
        missing = [str(folder) for folder in m.sets.values() if not folder.is_dir()]
        if missing:
            raise Refused(f"a Development Set is not where the check reads it: {missing[0]}")
        work = m.cache / "runs" / run_id
        work.mkdir(parents=True)
        digests = {name: set_digest(folder) for name, folder in sorted(m.sets.items())}
        m.say(f"real-drawings {run_id}: {head.target} at {head.commit[:12]}, main at {base.commit[:12]}")
        head_hash, head_exports = measure(m, head, main, work / "head", run_id, digests)
        main_hash, main_exports = head_hash, head_exports
        if head.commit != base.commit:
            main_hash, main_exports = measure(m, base, main, work / "main", run_id, digests)
        counts, items = report(m, main_exports, head_exports, head.commit == base.commit)
        head_failed = failed_text(head_exports)
        drop.write_new(work / "items.json", _json(items))  # holds drawing text: the owner's cache only
        metadata = {
            "run_id": run_id,
            "target": head.target,
            "pr": head.pr,
            "commit": head.commit,
            "code_hash": head_hash,
            "main_commit": base.commit,
            "main_code_hash": main_hash,
            "sets": {
                name: {"set_sha256": digests[name], "export_sha256": _sha(path)}
                for name, path in head_exports.items()
            },
            "seconds": round(time.monotonic() - started),
        }
        drop.write_new(work / "metadata.json", _json(metadata))
        m.say(f"{metadata['seconds']} s; the item list and the exports are under {work}")
        if not posting:
            m.say("Nothing posted (a posting run is a PR without --no-post).")
            return 0
        summary = verdict(m, run_id, counts, head_failed)
        folder = m.drop / run_id
        folder.mkdir(mode=0o750)
        for name, path in head_exports.items():
            drop.write_new(folder / f"export-{name}.json", path.read_bytes())
        drop.write_new(folder / "metadata.json", _json(metadata))
        drop.write_new(folder / "summary.json", _json(summary))
        drop.write_new(work / "summary.json", _json(summary))
        code = m.post(run_id)
        m.say("Posted." if code == 0 else f"The poster ended with exit code {code}: nothing was posted.")
        return code


@dataclass(frozen=True)
class Mains:
    """What main decides for every run: the engine paths, `[tool.uv]` and the export's schema."""

    patterns: bytes
    pyproject: bytes
    schema: bytes


def mains(repo: Path, commit: str) -> Mains:
    patterns, pyproject, schema = (show(repo, commit, p) for p in (PATTERNS, "pyproject.toml", SCHEMA))
    if patterns is None or pyproject is None:
        raise Refused(f"main has no {PATTERNS} or pyproject.toml")
    if schema is None:
        raise Refused(f"main has no {SCHEMA}: the engine harness (06b) is not merged")
    return Mains(patterns, pyproject, schema)


def measure(
    m: Machine, head: Head, main: Mains, work: Path, run_id: str, digests: Mapping[str, str]
) -> tuple[str, dict[str, Path]]:
    """One commit's exports, from the cache when its code hash has read these sets before."""
    main_pyproject, schema_text = main.pyproject, main.schema
    files = engine_files(m.repo, head.commit, main.patterns.decode())
    hashed = code_hash(files)
    checkout = work / "src"
    write_checkout(m.repo, files, checkout)
    python = (
        m.toolchain
        / "python"
        / f"cpython-{_pin(checkout, 'python.version')}-linux-x86_64-gnu"
        / "bin"
        / "python3"
    )
    dwgread = m.toolchain / "libredwg" / "bin" / "dwgread"
    version = subprocess.run([dwgread, "--version"], capture_output=True, text=True, check=False).stdout
    found = refusals(checkout, main_pyproject, version)
    if not python.exists():
        found.append(f"the head's Python is not installed: {python}")
    if found:
        raise Refused(f"{head.target}: " + "; ".join(found))
    cached = {
        name: m.cache / "exports" / hashed / f"{name}-{digest}.json" for name, digest in digests.items()
    }
    if all(path.exists() for path in cached.values()):
        m.say(f"{head.target}: code hash {hashed[:12]} is cached; not run again")
        return hashed, cached
    requirements = work / "requirements.txt"
    m.fetch(checkout, m.cache / "wheels", python, requirements)
    scratch = work / "out"
    scratch.mkdir()
    env = {"VEXTRUS_RUN_ID": run_id, "VEXTRUS_COMMIT": head.commit, "VEXTRUS_CODE_HASH": hashed}
    job = sandbox.Job(
        python, m.toolchain, checkout, m.cache / "wheels", requirements, m.sets, scratch, env
    )
    m.say(f"{head.target}: installing and reading {len(m.sets)} sets in the sandbox (log in {work})")
    m.sandbox(job, work / "sandbox.log")
    schema = json.loads(schema_text)
    head_schema = (checkout / SCHEMA).read_bytes() if (checkout / SCHEMA).exists() else schema_text
    if head_schema != schema_text:
        m.say(f"{head.target} changes {SCHEMA}: its export is checked against its own; read that diff")
        schema = json.loads(head_schema)
    exports = {}
    for name in sorted(m.sets):
        taken = work / f"export-{name}.json"
        drop.take(scratch, f"export-{name}.json", taken)
        try:
            breaches = problems(json.loads(taken.read_bytes()), schema)
        except (ValueError, SchemaError) as error:
            raise Refused(f"{head.target}: export-{name}.json cannot be checked: {error}") from None
        if breaches:
            raise Refused(f"{head.target}: export-{name}.json breaks the schema at {breaches[0]}")
        exports[name] = taken
    shutil.rmtree(scratch)  # the environment the sandbox made (about 300 MB); links are never followed
    for name, path in exports.items():  # cached only once every set's export passed
        cached[name].parent.mkdir(parents=True, exist_ok=True)
        cached[name].unlink(missing_ok=True)
        drop.write_new(cached[name], path.read_bytes())
    return hashed, exports


def report(
    m: Machine, before: Mapping[str, Path], after: Mapping[str, Path], baseline: bool
) -> tuple[dict[str, dict[str, int]], list[dict[str, Any]]]:
    """Prints the counts per measure, summed over the sets; returns them and the item list."""
    total = {measure: {"gained": 0, "lost": 0, "changed": 0} for measure in MEASURES}
    items: list[dict[str, Any]] = []
    held = dict.fromkeys(MEASURES, 0)
    unbuilt: set[str] = set()
    for name in sorted(after):
        old, new = json.loads(before[name].read_bytes()), json.loads(after[name].read_bytes())
        unbuilt |= {stage for stage, row in (new.get("stages") or {}).items() if not row.get("built")}
        diff = compare(old, new)
        for measure, found in diff.counts().items():
            for change, n in found.items():
                total[measure][change] += n
        for measure, n in sizes(new).items():
            held[measure] += n
        items += [{"set": name, **vars(item)} for item in diff.items]
        for sha, s0, s1, r0, r1 in diff.timings:
            m.say(f"  {name} {sha[:12]}: read {s0} -> {s1} s, peak {r0} -> {r1} KiB (not counted)")
    if unbuilt:
        m.say(f"Not built on the head: {', '.join(sorted(unbuilt))}")
    for run, exports in (("the head", after), ("main", {} if baseline else before)):
        if failed := failed_text(exports):
            m.say(f"Failed on {run}: {failed}")
    m.say(
        "The baseline: items per measure"
        if baseline
        else "Against main: gained, lost, changed (items now)"
    )
    for measure in MEASURES:
        c = total[measure]
        m.say(f"  {measure:14} {c['gained']:6} {c['lost']:6} {c['changed']:6}   ({held[measure]})")
    return total, items


def failed_text(exports: Mapping[str, Path]) -> str:
    """The stages that failed in these exports, by stage, file count and error kind (never the error's
    message, which may quote a drawing); empty when none failed."""
    found: Counter[tuple[str, str]] = Counter()
    for path in exports.values():
        found += failures(json.loads(path.read_bytes()))
    return "; ".join(
        f"{stage} ({kind})"
        if stage.startswith("set ")
        else f"{stage} on {n} {'file' if n == 1 else 'files'} ({kind})"
        for (stage, kind), n in sorted(found.items())
    )


def verdict(
    m: Machine, run_id: str, counts: Mapping[str, Mapping[str, int]], head_failed: str = ""
) -> dict[str, Any]:
    lost = sum(c["lost"] for c in counts.values())
    warning = f"Stages failed on the head: {head_failed}. " if head_failed else ""
    accepted = m.ask(f"{warning}Accept these changes? [y/N] ").strip().lower() in ("y", "yes")
    prompt = "Why is what was lost acceptable? " if accepted and lost else "A reason (optional): "
    reason = " ".join(m.ask(prompt).split())
    if accepted and lost and not reason:
        raise Refused("a lost item is accepted only with a reason; nothing was posted")
    if len(reason) > REASON_MOST or not reason.isprintable():
        raise Refused(f"the reason must be plain text of at most {REASON_MOST} characters")
    return {
        "run_id": run_id,
        "verdict": "accepted" if accepted else "rejected",
        "reason": reason,
        "measures": {measure: dict(counts[measure]) for measure in MEASURES},
    }


def _pin(checkout: Path, name: str) -> str:
    return (checkout / "toolchain" / name).read_text().strip()


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()
