"""Shared helpers for ticket S26-FX0's acceptance tests (not a test file): a pull request's runs of
`.github/workflows/e2e.yml` and `.github/workflows/real-drawings-na.yml`, simulated offline.

The workflows are read with S14-C14's reader of the YAML and expression subset they use
(`tools/lint/tests/acceptance/ts14c14/_workflows.py`). Nothing here reads the network.

`real_drawings_na(files)` runs real-drawings-na.yml's job for a PR changing `files` the way the runner
does: in a folder holding only what its checkout step's `sparse-checkout:` list names (main's copy, never
the PR's), every `run:` step in order under bash (`-eo pipefail` for `shell: bash`, `-e` otherwise), with
`$RUNNER_TEMP`, `$GITHUB_OUTPUT`, `$GITHUB_ENV`, the job's and the step's `env:` and `${{ }}` expanded
from the `pull_request_target` context. `gh` is a stub first on PATH: `gh api ... pulls/<n>/files`
prints the changed paths one per line (what the workflow's `--jq` gives: each filename, and a renamed
file's previous name); `gh api -X POST .../statuses/<sha> -f k=v ...` (or `--method POST`, `-F`,
`--field`, `--raw-field`) is recorded as a posted status. It returns every status posted.

`e2e_smoke(files)` is what GitHub does with e2e.yml for a PR into main changing `files`:
- "not triggered" when the workflow does not run on `pull_request` (or its `branches`/`paths` filters
  leave this PR out);
- else the job whose check name is `smoke` (its `name:`, or its id when it has none): "runs" when its
  `if:` holds, "skipped" (GitHub reports a skipped job's check as passing) when not. The jobs it
  `needs` are run first, their `run:` steps executed as above in a synthetic git repository (a base
  commit on `main` holding the repo's `scripts/`, `tools/` and `.github/`, and the PR's head commit
  adding `files`, its message READY by the trailer rule) to give their outputs; `actions/checkout` and
  `actions/setup-*` steps are taken as done; any other action is not simulated (`Unsupported`).
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
from pathlib import Path
from typing import Any

from tools.lint.engine_paths import compile_glob
from tools.lint.tests.acceptance.ts14c14._workflows import (
    Unsupported,
    condition,
    interpolate,
    jobs,
    load,
    needs,
    pull_request_context,
    triggers,
)

REPO = Path(__file__).resolve().parents[5]
WORKFLOWS = REPO / ".github" / "workflows"
E2E = WORKFLOWS / "e2e.yml"
NOT_APPLICABLE = WORKFLOWS / "real-drawings-na.yml"
DATE = "2026-10-13T10:00:00Z"

GH_STUB = """#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
if not args or args[0] != "api":
    sys.exit("gh stub: only `gh api` is simulated: " + " ".join(args))
method, fields, endpoint, i = "GET", {}, None, 1
while i < len(args):
    a = args[i]
    if a in ("-X", "--method"):
        method, i = args[i + 1].upper(), i + 2
        continue
    if a.startswith("--method="):
        method, i = a.split("=", 1)[1].upper(), i + 1
        continue
    if a in ("-f", "-F", "--field", "--raw-field"):
        key, _, value = args[i + 1].partition("=")
        fields[key], i = value, i + 2
        continue
    if a in ("--jq", "-q", "-H", "--header", "--template", "-t", "--input", "--hostname"):
        i += 2
        continue
    if not a.startswith("-") and endpoint is None:
        endpoint = a
    i += 1
endpoint = (endpoint or "").lstrip("/")
if method == "POST" and "/statuses/" in endpoint:
    with open(os.environ["GH_STUB_POSTS"], "a") as log:
        log.write(json.dumps({"endpoint": endpoint, **fields}) + "\\n")
    sys.exit(0)
if method == "GET" and "/pulls/" in endpoint and endpoint.endswith("/files"):
    sys.stdout.write(open(os.environ["GH_STUB_FILES"]).read())
    sys.exit(0)
sys.exit("gh stub: not simulated: " + " ".join(args))
"""


class StepFailed(AssertionError):
    """A `run:` step exited non-zero."""


def _git(root: Path, *args: str) -> str:
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(root),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_AUTHOR_NAME": "Builder",
        "GIT_AUTHOR_EMAIL": "builder@example.com",
        "GIT_COMMITTER_NAME": "Builder",
        "GIT_COMMITTER_EMAIL": "builder@example.com",
        "GIT_AUTHOR_DATE": DATE,
        "GIT_COMMITTER_DATE": DATE,
        "LC_ALL": "C",
    }
    done = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, env=env, check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout.strip()


def _outputs(path: Path) -> dict[str, str]:
    """A `$GITHUB_OUTPUT` file's `k=v` and `k<<EOF ... EOF` entries."""
    found: dict[str, str] = {}
    lines = path.read_text().splitlines() if path.exists() else []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "<<" in line and ("=" not in line or line.index("<<") < line.index("=")):
            key, delimiter = line.split("<<", 1)
            body: list[str] = []
            i += 1
            while i < len(lines) and lines[i] != delimiter:
                body.append(lines[i])
                i += 1
            found[key] = "\n".join(body)
        elif "=" in line:
            key, value = line.split("=", 1)
            found[key] = value
        i += 1
    return found


def _with(context: dict[str, Any], **extra: Any) -> dict[str, Any]:
    merged = dict(context)
    merged.update(extra)
    return merged


def _env_values(block: Any, context: dict[str, Any]) -> dict[str, str]:
    if not block:
        return {}
    assert isinstance(block, dict)
    found = {}
    for key, value in block.items():
        value = interpolate(value, context)
        found[str(key)] = "true" if value is True else "false" if value is False else str(value)
    return found


def run_job(
    job: dict[str, Any], context: dict[str, Any], cwd: Path, temp: Path, base_env: dict[str, str]
) -> dict[str, str]:
    """Run a job's `run:` steps in `cwd`; return its `outputs:` expanded from its steps' outputs."""
    steps: dict[str, Any] = {}
    job_env = _env_values(job.get("env"), context)
    github_env: dict[str, str] = {}
    for index, step in enumerate(job.get("steps") or []):
        here = _with(context, steps=steps, env={**job_env, **github_env})
        if "uses" in step:
            action = str(step["uses"])
            if action.startswith(("actions/checkout@", "actions/setup-")):
                continue
            raise Unsupported(f"step {index}: the action {action} is not simulated")
        if "if" in step and not condition(step, here):
            continue
        output = temp / f"output-{index}"
        envfile = temp / f"env-{index}"
        output.touch()
        envfile.touch()
        script = temp / f"step-{index}.sh"
        script.write_text(str(interpolate(str(step["run"]), here)))
        env = {
            **base_env,
            **job_env,
            **github_env,
            **_env_values(step.get("env"), here),
            "GITHUB_OUTPUT": str(output),
            "GITHUB_ENV": str(envfile),
        }
        if step.get("shell") == "bash":
            command = ["bash", "--noprofile", "--norc", "-eo", "pipefail", str(script)]
        elif step.get("shell") in (None, ""):
            command = ["bash", "-e", str(script)]
        else:
            raise Unsupported(f"step {index}: shell {step.get('shell')} is not simulated")
        done = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, check=False)
        if done.returncode != 0:
            raise StepFailed(
                f"step {index} ({step.get('name', step.get('id', ''))}) exited {done.returncode}:\n"
                f"--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"
            )
        github_env.update(_outputs(envfile))
        if "id" in step:
            steps[str(step["id"])] = {"outputs": _outputs(output), "outcome": "success"}
    finished = _with(context, steps=steps)
    return {str(k): str(interpolate(v, finished)) for k, v in (job.get("outputs") or {}).items()}


def _stub_bin(temp: Path) -> Path:
    folder = temp / "bin"
    folder.mkdir(exist_ok=True)
    gh = folder / "gh"
    gh.write_text(GH_STUB)
    gh.chmod(gh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return folder


def _base_env(temp: Path, workspace: Path, event: str, files: list[str]) -> dict[str, str]:
    listed = temp / "files.txt"
    listed.write_text("".join(f"{path}\n" for path in files))
    return {
        "PATH": f"{_stub_bin(temp)}:{os.environ.get('PATH', '/usr/bin:/bin')}",
        "HOME": str(temp),
        "LC_ALL": "C",
        "RUNNER_TEMP": str(temp),
        "GITHUB_WORKSPACE": str(workspace),
        "GITHUB_EVENT_NAME": event,
        "GITHUB_REPOSITORY": "vextrus/vextrus-cubit",
        "CI": "true",
        "GITHUB_ACTIONS": "true",
        "GH_STUB_FILES": str(listed),
        "GH_STUB_POSTS": str(temp / "posts.jsonl"),
    }


def _context(event: str, files: list[str], head: str, base: str) -> dict[str, Any]:
    context = pull_request_context("pr", 901, "s99-branch", head, 4242)
    github = context["github"]
    github["event_name"] = event
    github["token"] = "ghs_stub_token"
    github["event"]["pull_request"]["changed_files"] = len(set(files))
    github["event"]["pull_request"]["base"]["sha"] = base
    return context


def _sparse_folder(job: dict[str, Any], into: Path) -> Path:
    """What the job's checkout leaves: only the sparse-checkout list's paths, copied from the repo."""
    into.mkdir()
    for step in job.get("steps") or []:
        if not str(step.get("uses", "")).startswith("actions/checkout@"):
            continue
        listed = str((step.get("with") or {}).get("sparse-checkout") or "")
        if not listed.strip():
            raise Unsupported("a checkout of the whole repository is not simulated here")
        for line in listed.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            for source in (
                REPO.glob(line.lstrip("/"))
                if any(c in line for c in "*?[")
                else [REPO / line.lstrip("/")]
            ):
                if not source.exists():
                    continue
                target = into / source.relative_to(REPO)
                target.parent.mkdir(parents=True, exist_ok=True)
                if source.is_dir():
                    shutil.copytree(source, target, dirs_exist_ok=True)
                else:
                    shutil.copy2(source, target)
    return into


def real_drawings_na(files: list[str], temp: Path) -> list[dict[str, str]]:
    """The statuses real-drawings-na.yml posts for a PR into main changing `files`."""
    temp.mkdir(parents=True, exist_ok=True)
    workflow = load(NOT_APPLICABLE)
    head = "a" * 40
    context = _context("pull_request_target", files, head, "b" * 40)
    posts = temp / "posts.jsonl"
    for name, job in jobs(workflow).items():
        if not condition(job, context):
            continue
        folder = _sparse_folder(job, temp / f"checkout-{name}")
        scratch = temp / f"runner-{name}"
        scratch.mkdir()
        run_job(
            job,
            context,
            folder,
            scratch,
            _base_env(scratch, folder, "pull_request_target", files)
            | {"GH_STUB_POSTS": str(posts), "GH_STUB_FILES": str(_listed(temp, files))},
        )
    if not posts.exists():
        return []
    return [json.loads(line) for line in posts.read_text().splitlines() if line.strip()]


def _listed(temp: Path, files: list[str]) -> Path:
    listed = temp / "changed-files.txt"
    listed.write_text("".join(f"{path}\n" for path in files))
    return listed


def posted(statuses: list[dict[str, str]], context: str) -> list[dict[str, str]]:
    return [status for status in statuses if status.get("context") == context]


def _filtered_in(settings: Any, files: list[str]) -> bool:
    """Whether a `pull_request` trigger's branch and path filters let this PR into main run it."""
    if not isinstance(settings, dict):
        return True

    def last_match(path: str, patterns: list[str]) -> bool:
        hit = False
        for pattern in patterns:
            negated = pattern.startswith("!")
            if compile_glob(pattern[1:] if negated else pattern).fullmatch(path):
                hit = not negated
        return hit

    for key in ("branches", "branches-ignore", "paths", "paths-ignore"):
        if isinstance(settings.get(key), str):
            settings[key] = [settings[key]]
    if "branches" in settings and not last_match("main", settings["branches"]):
        return False
    if "branches-ignore" in settings and last_match("main", settings["branches-ignore"]):
        return False
    if "paths" in settings and not any(last_match(f, settings["paths"]) for f in files):
        return False
    ignored = settings.get("paths-ignore")
    return not (ignored is not None and all(last_match(f, ignored) for f in files))


def _synthetic_repo(root: Path, files: list[str]) -> tuple[str, str]:
    """A repo whose `main` holds the repo's scripts/, tools/, .github/ and whose head adds `files`."""
    root.mkdir()
    _git(root, "init", "-q", "-b", "main")
    tracked = (
        subprocess.run(
            ["git", "-C", str(REPO), "ls-files", "-z", "--", "scripts", "tools", ".github"],
            capture_output=True,
            check=True,
        )
        .stdout.decode()
        .split("\0")
    )
    for name in filter(None, tracked):
        source = REPO / name
        if source.is_file() and not source.is_symlink():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", "base")
    base = _git(root, "rev-parse", "HEAD")
    _git(root, "checkout", "-q", "-b", "s99-branch")
    for name in files:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a") as handle:
            handle.write("synthetic change\n")
    _git(root, "add", "-A")
    tree = _git(root, "write-tree")
    message = f"S99: a change\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n"
    _git(root, "commit", "-q", "-m", message)
    return base, _git(root, "rev-parse", "HEAD")


def e2e_smoke(files: list[str], temp: Path) -> str:
    """ "not triggered", "runs" or "skipped": e2e.yml's `smoke` check on a PR into main."""
    temp.mkdir(parents=True, exist_ok=True)
    workflow = load(E2E)
    on = triggers(workflow)
    if "pull_request" not in on or not _filtered_in(on["pull_request"], files):
        return "not triggered"
    all_jobs = jobs(workflow)
    smoke = [jid for jid, job in all_jobs.items() if str(job.get("name") or jid) == "smoke"]
    assert len(smoke) == 1, f"e2e.yml has {len(smoke)} jobs whose check is named smoke"
    repo = temp / "repo"
    base, head = _synthetic_repo(repo, files)
    context = _context("pull_request", files, head, base)
    results: dict[str, dict[str, Any]] = {}

    def result(jid: str) -> dict[str, Any]:
        if jid in results:
            return results[jid]
        job = all_jobs[jid]
        before = {n: result(n) for n in needs(job)}
        status = "success" if all(r["result"] == "success" for r in before.values()) else "failure"
        here = _with(context, needs=before, __status__=status)
        if not condition(job, here):
            results[jid] = {"result": "skipped", "outputs": {}}
        elif jid == smoke[0]:
            results[jid] = {"result": "runs", "outputs": {}}
        else:
            scratch = temp / f"runner-{jid}"
            scratch.mkdir()
            outputs = run_job(job, here, repo, scratch, _base_env(scratch, repo, "pull_request", files))
            results[jid] = {"result": "success", "outputs": outputs}
        return results[jid]

    return "runs" if result(smoke[0])["result"] == "runs" else "skipped"
