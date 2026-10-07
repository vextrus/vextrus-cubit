"""`python -m scripts.factory.review_cloud --pr <n> --head <sha> --agent pr-reviewer|refuter
[--claim-file <f> --claim-n <n>] [--model <id>] [--task <text>]`: launch a cloud reviewer or refuter
on a fresh review branch (docs/specs/factory.md 2.2 "Launch, cloud review";
`docs/specs/factory/contracts/review-verdict.schema.json`, `launch-cli.md` 2).

It makes a 128-bit nonce, pushes the PR's head to `refs/heads/review/<pr>-<nonce8>`, writes the
`--review-file` (`{"pr", "head_sha", "nonce"}`, mode 0600) and the prompt (mode 0600) under the records
folder, and launches the session through `scripts.factory.launch cloud`. Only that file, the launch
record it is copied into and the reviewer's prompt hold the nonce: never a command line. The reviewer
commits one verdict file on the head and pushes only its review branch; `python -m scripts.ledger
fetch-verdict` checks it locally before anything is recorded.

Exit codes: 0 launched, 2 bad input, 3 refused (the push or the launch failed).
"""

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

SHA = re.compile(r"[0-9a-f]{40}")
ROLES = {"pr-reviewer": "reviewer", "refuter": "refuter"}

Push = Callable[[list[str]], int]
Launch = Callable[[list[str], str], int]


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> Any:
        raise ValueError(message)


def parse(argv: list[str]) -> argparse.Namespace:
    parser = _Parser(prog="python -m scripts.factory.review_cloud", add_help=False)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--agent", choices=sorted(ROLES), required=True)
    parser.add_argument("--claim-file", type=Path)
    parser.add_argument("--claim-n", type=int)
    parser.add_argument("--model")  # the lens's model (scripts.factory.review's map); else launch's
    parser.add_argument("--task")  # the lens's task, one paragraph, for a reviewer
    args = parser.parse_args(argv)
    if args.pr < 1 or not SHA.fullmatch(args.head):
        raise ValueError("--pr is 1 or more and --head a full 40-hex sha")
    refuter = args.agent == "refuter"
    if refuter != (args.claim_file is not None) or refuter != (args.claim_n is not None):
        raise ValueError("a refuter takes --claim-file and --claim-n; a reviewer neither")
    if refuter and args.claim_n < 1:
        raise ValueError("--claim-n counts from 1")
    if refuter and args.task is not None:
        raise ValueError("--task is a reviewer's; a refuter's task is its claim")
    return args


def private_write(path: Path, text: str) -> None:
    """A new file only the owner can read (it holds the nonce)."""
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as out:
        out.write(text)


def prompt_for(args: argparse.Namespace, nonce: str, branch: str, claim: str | None) -> str:
    pr, head, nonce8 = args.pr, args.head, nonce[:8]
    lines = [
        "First run `git remote get-url origin` (it must be github.com/vextrus/vextrus-cubit)",
        f"and `git rev-parse HEAD` (it must be {head}); if either is wrong, stop, push nothing.",
        "",
    ]
    if claim is None:
        verdict_path = f".review/{pr}-{nonce8}.json"
        lines += [
            f"Follow `.claude/agents/pr-reviewer.md` in its cloud mode: review PR {pr} at head {head}.",
            "Run the full Python and web suites on this VM. Findings in public words only.",
            *([] if args.task is None else [args.task]),
        ]
        agent, verdicts = "pr-reviewer", "PASS, FIX or BLOCK"
    else:
        verdict_path = f".review/refute-{pr}-{nonce8}-{args.claim_n}.json"
        lines += [
            "Follow `.claude/agents/refuter.md` in its cloud mode: try to refute this claim about",
            f"PR {pr} at head {head}, running the full suites on this VM:",
            "",
            claim.strip(),
            "",
        ]
        agent, verdicts = "refuter", "CONFIRMED, REFUTED or UNPROVEN"
    lines += [
        f"Then commit exactly one file, `{verdict_path}`, as a child of {head}: the JSON object",
        f'{{"pr": {pr}, "head_sha": "{head}", "nonce": "{nonce}", "agent": "{agent}",',
        f'"verdict": <{verdicts}>, "findings": [{{"score": 0-100, "file": "<repo path>", "line": <n>,',
        '"summary": "<public words>"}]}',
        "(docs/specs/factory/contracts/review-verdict.schema.json; a refuter writes []).",
        f"Push only that commit: `git push origin HEAD:refs/heads/{branch}`. Never push another branch,",
        "never open a PR, never comment anywhere. The nonce goes only in that file.",
        "End with your verdict line ("
        + (
            "`VERDICT: PASS|FIX|BLOCK at " + head + "`)."
            if claim is None
            else "CONFIRMED, REFUTED or UNPROVEN)."
        ),
    ]
    return "\n".join(lines) + "\n"


def run(argv: list[str], *, push: Push, launch: Launch, records_dir: Path) -> int:
    try:
        args = parse(argv)
        claim = args.claim_file.read_text() if args.claim_file is not None else None
    except (ValueError, OSError) as error:
        print(f"review_cloud: {error}", file=sys.stderr)
        return 2
    nonce = secrets.token_hex(16)
    branch = f"review/{args.pr}-{nonce[:8]}"
    if push(["git", "push", "origin", f"{args.head}:refs/heads/{branch}"]) != 0:
        print(f"review_cloud: refused: pushing {branch} failed; nothing launched", file=sys.stderr)
        return 3
    records_dir.mkdir(parents=True, exist_ok=True)
    stem = f"review-{args.pr}-{nonce[:8]}"
    review_file = records_dir / f"{stem}.json"
    prompt_file = records_dir / f"{stem}.prompt.md"
    private_write(review_file, json.dumps({"pr": args.pr, "head_sha": args.head, "nonce": nonce}) + "\n")
    prompt = prompt_for(args, nonce, branch, claim)
    private_write(prompt_file, prompt)
    ticket = stem if claim is None else f"{stem}-refute-{args.claim_n}"
    command = [
        "uv", "run", "python", "-m", "scripts.factory.launch", "cloud",
        "--branch", branch,
        "--prompt-file", str(prompt_file),
        "--ticket", ticket,
        "--effort", "high",
        "--role", ROLES[args.agent],
        "--review-file", str(review_file),
        *([] if args.model is None else ["--model", args.model]),
    ]  # fmt: skip
    if launch(command, prompt) != 0:
        print(f"review_cloud: refused: the launch of {branch} failed", file=sys.stderr)
        return 3
    print(f"review_cloud: launched {ROLES[args.agent]} on {branch}; review file {review_file}")
    return 0


def _push(argv: list[str]) -> int:
    return subprocess.run(argv, check=False).returncode


def _launch(argv: list[str], prompt: str) -> int:
    return subprocess.run(argv, check=False).returncode


def _records_dir() -> Path:
    done = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(done.stdout.strip()).parent / ".private" / "work" / "factory" / "review"


def main(
    argv: list[str] | None = None,
    *,
    push: Push = _push,
    launch: Launch = _launch,
    records_dir: Path | None = None,
) -> int:
    return run(
        sys.argv[1:] if argv is None else argv,
        push=push,
        launch=launch,
        records_dir=_records_dir() if records_dir is None else records_dir,
    )


if __name__ == "__main__":
    sys.exit(main())
