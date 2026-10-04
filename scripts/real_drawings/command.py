"""`scripts/real-drawings <PR number | branch | main> [--no-post] [--fresh] [--harness]`: the
real-drawing check, regression only (the M0 plan, "The real-drawing check", steps 1-7; ADRs 0026 and
0030 as amended in session 02).

Run from the owner's checkout of main. It measures the head: the engine paths' files into a scratch
checkout, the refusals, the locked wheels fetched by hash, the install and the product's job inside
the sandbox, the exports taken out link-free and checked against main's schema (or, when the head
changes the schema, against its own, which the run says so the diff is read). It measures main the same
way when main's code hash is not cached, and diffs each Development Set's export against main's under
the fixed matching, printing the counts gained, lost and changed per measure; the item list, which
holds drawing text, stays under the owner's cache. Exports are cached by (code hash, the sandbox's
version, set content); one is reused only when it passes the schema again and nothing in it failed (a
stage, or a file's process), and `--fresh` reads both runs again.

A posting run is a PR without `--no-post`: under the drop folder's lock, the owner accepts or rejects
the changes (a lost item only with a reason), or the orchestrator does without a prompt (ADR 0041):
`--accept-if-clean` accepts only a run with nothing lost or changed and no failed stage gained (else it
posts nothing and exits 3), and `--accept REASON` accepts a run it has judged. The command writes the
run's own folder in the drop folder (the exports, and the metadata and summary it writes itself) and
runs the poster as the key user. A branch or main, or `--no-post`, never posts.

A scored run (ticket 24s) is a PR's posting run, or `--score` on a branch or main (main's baseline,
posting nothing). Once `scripts/owner/keys-custody.sh` has made the pipeline's user, the owner's side
only spools what the run reads and the pipeline's user runs the check from its installed copy
(`runner.py`), writing the run's folder before the verdict; the blind scorer then scores that folder as
the key user and prints its answer under the table. An export taken from the cache names the run its
harness was started for, not this one: the metadata records that pair (`export_run`) for the scorer,
which trusts it as it trusts the digest, because only the pipeline's user writes its cache and the
run's folder (the pair itself is the engine's word, never checked against anything else). A PR whose
code hash is not main's (it changes the engine's reading) that the scorer could not score posts
nothing and exits 3. Before then, a posting run runs as the owner's user and says it is not scored,
and `--score` is refused.

**The product's read job reads both runs** (21a's `--job` mode, the default since 21d: the owner's
ruling of 30 Sep 2026 kept the harness the default until the job's export filled what the harness's
gave, which 21d's export does): against a throwaway PostgreSQL 18 cluster inside the sandbox
(`sandbox.py`), its export from the job's export entry point. A job's exports are cached apart from
the harness's, never one for the other. `--harness` reads both runs with the engine harness instead,
the way back, with `--no-post` on a branch or main only: a posting or scored run reads with the job
and takes neither flag (the installed copy, `runner.py`, is handed the command line as typed and
knows neither); `--job`, the default, is still taken elsewhere for older command lines.
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

from scripts.real_drawings import drop, runner, sandbox, wheels
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
    set_files,
    show,
    write_checkout,
)

ROOT = Path(__file__).resolve().parents[2]
SETS = {"sample-project": ".private/reference/sample-project", "edison": ".private/reference/edison"}
SCHEMA = "engine/export.schema.json"
PATTERNS = ".github/engine-paths.txt"
POSTER_CONFIG = "scripts/owner/post-status.toml"
REASON_MOST = 100
# What the sandbox gives the harness also decides what it reads (the first baseline's sandbox had no
# /tmp, so 04's reader could not start): an export is reused only by the same sandbox. These are the
# files of main's check that shape what runs inside it: the Job (this file), the bwrap arguments and
# the script (sandbox.py), the checkout's files and modes (source.py), and the requirements and the
# wheels, the compiled or the pure ezdxf (wheels.py). The rest reads what the sandbox left, after it.
SHAPING = ("command.py", "sandbox.py", "source.py", "wheels.py")


def sandbox_version(folder: Path) -> str:
    """The sandbox's version: every shaping file's name and content, in `folder`."""
    digest = hashlib.sha256()
    for name in SHAPING:
        content = (folder / name).read_bytes()
        digest.update(f"{name} {len(content)}\n".encode())
        digest.update(content)
    return digest.hexdigest()[:16]


SANDBOX_VERSION = sandbox_version(Path(__file__).parent)


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
    # The blind scorer, run as the key user on the run's folder; None where the pipeline's user did not
    # write the run (the owner's own runs), which the scorer would refuse.
    score: Callable[[str], int] | None = None
    fetch_prs: bool = True  # False for the pipeline's user, whose mirror already holds the PR's head
    ask: Callable[[str], str] = input
    say: Callable[[str], None] = print
    sandbox_version: str = SANDBOX_VERSION


HARNESS_REFUSED = (
    "--harness is never scored or posted (a posting or scored run reads with the product's job):"
    " run it with --no-post, on a branch or main, without --score"
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scripts/real-drawings", description=__doc__.split("\n\n")[0])
    parser.add_argument("target", help="a PR number, a local branch, or main")
    parser.add_argument("--no-post", action="store_true", help="measure and diff only; never post")
    parser.add_argument(
        "--fresh", action="store_true", help="read the head and main again, ignoring the cache"
    )
    parser.add_argument(
        "--score",
        action="store_true",
        help="a scored run of a branch or main (main's baseline): the pipeline's user reads it and"
        " writes the run's folder, and the blind scorer scores it; nothing is posted",
    )
    reader = parser.add_mutually_exclusive_group()
    reader.add_argument(
        "--job",
        action="store_true",
        help="read with the product's read job against a throwaway PostgreSQL inside the sandbox:"
        " the default since 21d (taken for older command lines)",
    )
    reader.add_argument(
        "--harness",
        action="store_true",
        help="read the head and main with the engine harness, not the product's job (the way back;"
        " never scored or posted)",
    )
    how = parser.add_mutually_exclusive_group()
    how.add_argument(
        "--accept-if-clean",
        action="store_true",
        help="accept without asking only when nothing was lost or changed and no failed stage was"
        " gained; otherwise post nothing and exit 3 (ADR 0041's accept rule)",
    )
    how.add_argument(
        "--accept",
        metavar="REASON",
        help="accept without asking, with this reason (needed when anything was lost); for the"
        " orchestrator after judging the table",
    )
    args = parser.parse_args(argv)
    if args.score and (args.no_post or args.target.isdigit()):
        parser.error("--score is a scored run of a branch or main (a PR's posting run is scored anyway)")
    scored_or_posting = args.score or (args.target.isdigit() and not args.no_post)
    if args.harness and scored_or_posting:
        parser.error(HARNESS_REFUSED)
    if args.job and scored_or_posting:  # the installed copy (runner.py) takes no reader's flag
        parser.error("--job is the default: a posting or scored run takes no reader's flag")
    machine = owners_machine()
    try:
        if args.score or (args.target.isdigit() and not args.no_post):
            if runner.installed():
                return runner.delegate(
                    sys.argv[1:] if argv is None else argv,
                    args.target,
                    repo=machine.repo,
                    sets=machine.sets,
                    wheels=machine.cache / "wheels",
                )
            if args.score:
                raise Refused(
                    "a scored run is written by the pipeline's user, who is not set up here: the owner"
                    " runs scripts/owner/keys-custody.sh"
                )
            machine.say("Not scored: the pipeline's user is not set up (scripts/owner/keys-custody.sh).")
        return run(
            args.target,
            no_post=args.no_post,
            m=machine,
            fresh=args.fresh,
            accept=args.accept,
            accept_if_clean=args.accept_if_clean,
            job=not args.harness,
        )
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


def run(
    target: str,
    *,
    no_post: bool,
    m: Machine,
    fresh: bool = False,
    accept: str | None = None,
    accept_if_clean: bool = False,
    job: bool = True,
    score: bool = False,
) -> int:
    started = time.monotonic()
    posting = target.isdigit() and not no_post
    if not job and (score or posting):
        raise Refused(HARNESS_REFUSED)
    with drop.posting_lock(m.drop) if posting else nullcontext():
        if posting and git(m.repo, "symbolic-ref", "--short", "HEAD").decode().strip() != MAIN:
            raise Refused("a posting run runs main's copy of the command: check out main first")
        head = resolve(m.repo, target, fetch=m.fetch_prs)
        base = resolve(m.repo, MAIN)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        run_id = f"{stamp}-{head.commit[:12]}-{secrets.token_hex(2)}"
        main = mains(m.repo, base.commit)
        missing = [str(folder) for folder in m.sets.values() if not folder.is_dir()]
        if missing:
            raise Refused(f"a Development Set is not where the check reads it: {missing[0]}")
        work = m.cache / "runs" / run_id
        work.mkdir(parents=True)
        listings = {name: set_files(folder) for name, folder in sorted(m.sets.items())}
        digests = {name: set_digest(m.sets[name], files) for name, files in listings.items()}
        m.say(f"real-drawings {run_id}: {head.target} at {head.commit[:12]}, main at {base.commit[:12]}")
        head_hash, head_exports, head_cached = measure(
            m, head, main, work / "head", run_id, digests, fresh, job=job
        )
        main_hash, main_exports = head_hash, head_exports
        if head.commit != base.commit:  # main is read the same way as the head
            main_hash, main_exports, _ = measure(
                m, base, main, work / "main", run_id, digests, fresh, job=job
            )
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
            "mode": "job" if job else "harness",
            "sets": {
                name: {
                    "set_sha256": digests[name],
                    "export_sha256": _sha(path),
                    "files": listings[name],
                    # An export from the cache names an earlier run, not this one: the scorer accepts
                    # that pair only when this run's metadata records it (session 06's F4).
                    **({"export_run": export_run(path)} if head_cached else {}),
                }
                for name, path in head_exports.items()
            },
            "seconds": round(time.monotonic() - started),
        }
        drop.write_new(work / "metadata.json", _json(metadata))
        m.say(f"{metadata['seconds']} s; the item list and the exports are under {work}")
        if not posting and not score:
            m.say("Nothing posted (a posting run is a PR without --no-post).")
            return 0
        if posting and accept_if_clean and (why := unclean(counts)):
            m.say(f"Not clean ({why}): nothing posted; judge the table and use --accept or reject.")
            return 3
        # The run's folder before the verdict, so the scorer can read it: its exports and metadata.
        folder = m.drop / run_id
        folder.mkdir(mode=0o750)
        for name, path in head_exports.items():
            drop.write_new(folder / f"export-{name}.json", path.read_bytes())
        drop.write_new(folder / "metadata.json", _json(metadata))
        scored = scored_by(m, run_id)
        if not posting:
            m.say("Nothing posted (a scored run of a branch or main).")
            return scored
        # A PR that changes what the engine reads (its code hash is not main's) posts no success
        # unscored: its reading would be accepted with nobody having measured it against the keys.
        if scored != 0 and m.score is not None and head_hash != main_hash:
            m.say("Not scored, and this PR changes the engine's reading: nothing posted; run it again.")
            return 3
        summary = verdict(m, run_id, counts, head_failed, accept="" if accept_if_clean else accept)
        drop.write_new(folder / "summary.json", _json(summary))
        drop.write_new(work / "summary.json", _json(summary))
        code = m.post(run_id)
        m.say("Posted." if code == 0 else f"The poster ended with exit code {code}: nothing was posted.")
        return code


def scored_by(m: Machine, run_id: str) -> int:
    """The blind scorer's answer on the run's folder, which it prints under the table itself; its exit
    code (0 when scored)."""
    if m.score is None:
        m.say("Not scored: the pipeline's user did not write this run (scripts/owner/keys-custody.sh).")
        return 1
    m.say("The blind scorer, against the Development Sets' keys:")
    code = m.score(run_id)
    if code != 0:
        m.say(f"Not scored: the scorer ended with exit code {code}.")
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
    m: Machine,
    head: Head,
    main: Mains,
    work: Path,
    run_id: str,
    digests: Mapping[str, str],
    fresh: bool = False,
    *,
    job: bool = True,
) -> tuple[str, dict[str, Path], bool]:
    """One commit's code hash and exports, and whether they came from the cache: they do when its code
    hash has read these sets before in the same sandbox (and mode) and no stage failed; `fresh` reads
    them again whatever the cache holds; `job` reads them with the product's job (see the module)."""
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
    if job and not (sandbox.PG_BIN / "initdb").exists():
        found.append(
            f"the product's job needs PostgreSQL 18's binaries: {sandbox.PG_BIN} has no initdb"
            " (--harness reads without them)"
        )
    if found:
        raise Refused(f"{head.target}: " + "; ".join(found))
    shaped_by = f"{m.sandbox_version}-job" if job else m.sandbox_version
    cached = {
        name: m.cache / "exports" / hashed / shaped_by / f"{name}-{digest}.json"
        for name, digest in digests.items()
    }
    schema = json.loads(schema_text)
    head_schema = (checkout / SCHEMA).read_bytes() if (checkout / SCHEMA).exists() else schema_text
    if head_schema != schema_text:
        m.say(f"{head.target} changes {SCHEMA}: its export is checked against its own; read that diff")
        schema = json.loads(head_schema)
    # A cached export is reused only when it passes the schema again and nothing in it failed. The
    # cache is shared with every local copy of the command, so this copy checks what it reads, not only
    # what it wrote. A failure may be the machine's (a timeout, an OOM kill, SandboxUnavailable), not the
    # code's: reused, it would stand as main's run, and as a non-engine PR's own, until the code hash
    # changed. A failure the code causes repeats, at one run's cost.
    if fresh:
        m.say(f"{head.target}: --fresh, so read again whatever the cache holds")
    elif all(path.exists() for path in cached.values()):
        why = next(filter(None, (_unusable(path, schema) for path in cached.values())), "")
        if not why:
            m.say(f"{head.target}: code hash {hashed[:12]} is cached; not run again")
            return hashed, cached, True
        m.say(f"{head.target}: the cached run of code hash {hashed[:12]} {why}; read again")
    requirements = work / "requirements.txt"
    m.fetch(checkout, m.cache / "wheels", python, requirements)
    scratch = work / "out"
    scratch.mkdir()
    env = {"VEXTRUS_RUN_ID": run_id, "VEXTRUS_COMMIT": head.commit, "VEXTRUS_CODE_HASH": hashed}
    inside = sandbox.Job(
        python, m.toolchain, checkout, m.cache / "wheels", requirements, m.sets, scratch, env, job=job
    )
    how = "the product's job" if job else "the harness"
    m.say(f"{head.target}: installing, then reading {len(m.sets)} sets with {how} (log in {work})")
    m.sandbox(inside, work / "sandbox.log")
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
    return hashed, exports, False


def export_run(export: Path) -> dict[str, Any]:
    """The run a cached export names (`run.id`, `run.commit`), as the new run's metadata records it."""
    named = json.loads(export.read_bytes()).get("run") or {}
    return {"id": named.get("id"), "commit": named.get("commit")}


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
    message, which may quote a drawing), a file's process that did not end ok among them as "process";
    empty when none failed."""
    found: Counter[tuple[str, str]] = Counter()
    for path in exports.values():
        found += failures(json.loads(path.read_bytes()))
    return "; ".join(
        f"{stage} ({kind})"
        if stage.startswith("set ")
        else f"{stage} on {n} {'file' if n == 1 else 'files'} ({kind})"
        for (stage, kind), n in sorted(found.items())
    )


def unclean(counts: Mapping[str, Mapping[str, int]]) -> str:
    """Why a run is not clean under ADR 0041's accept rule, or "" when it is: a failed stage gained, or
    anything lost or changed in any measure."""
    why = (
        [f"failed_stages gained {counts['failed_stages']['gained']}"]
        if counts["failed_stages"]["gained"]
        else []
    )
    why += [
        f"{measure} {change} {counts[measure][change]}"
        for measure in MEASURES
        for change in ("lost", "changed")
        if counts[measure][change]
    ]
    return ", ".join(why)


def verdict(
    m: Machine,
    run_id: str,
    counts: Mapping[str, Mapping[str, int]],
    head_failed: str = "",
    accept: str | None = None,
) -> dict[str, Any]:
    """The owner's (or, with `accept`, the orchestrator's already judged) verdict and reason."""
    lost = sum(c["lost"] for c in counts.values())
    if accept is not None:
        accepted, reason = True, " ".join(accept.split())
    else:
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


def _unusable(export: Path, schema: Mapping[str, Any]) -> str:
    """Why a cached export may not be reused, or "" when it may: it cannot be read or checked, it
    breaks the schema, or something in it failed (a stage, a file's or the set's, or a file's process:
    `failures`, where a process whose status is not ok, or not said, counts)."""
    try:
        document = json.loads(export.read_bytes())
        breaches = problems(document, schema)
    except ValueError, SchemaError:
        return "cannot be checked"
    if breaches:
        return "breaks the schema"
    return "had a failure" if failures(document) else ""


def _pin(checkout: Path, name: str) -> str:
    return (checkout / "toolchain" / name).read_text().strip()


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()
