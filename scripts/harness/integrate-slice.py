#!/usr/bin/env python3
"""Integrate one slice (a worktree branch) into this checkout — the orchestrator's merge tool.

    uv run --project cad python scripts/harness/integrate-slice.py <SLICE-ID> <worktree> [--base <sha>] [--continue]
    uv run --project cad python scripts/harness/integrate-slice.py --errors-check <base-rev>

What it does, in order (learned the hard way in session 8):
1. The slice's non-baseline commits are cherry-picked with -n in order (their law placeholders agree
   with each other, so they apply on top of one another). A conflict confined to db/migrations/meta/
   is resolved by keeping this branch's metadata; any other conflict stops the tool — resolve it (the
   slice's intent wins in its own files, merge by hand in shared registries), `git add`, and re-run with
   --continue.
2. A slice migration whose number another migration already holds is regenerated at the next number
   by drizzle-kit from the merged schema, and its hand-written tail block (opened by a line
   `-- hand-written (…)`) re-appended — BEFORE the slice commit, so no `baseline:` commit ever carries
   a migration (AC-3).
3. Every placeholder I-<TAG>-<l> / D-<TAG>-<l> (TAG = a slice id without punctuation, listed in
   <work>/slices/*.json) in the staged files and messages is renumbered at once, in sorted order, to
   the next free ids; the table is kept in <work>/law-ids.tsv.
4. One commit carries the slice (its first subject, every other subject in the body); then its
   `baseline:` commits are cherry-picked one by one.

--errors-check <base-rev> diffs the refusal register (src/core/errors.ts REFUSALS) against <base-rev>
and exits non-zero if any existing entry changed or vanished — run it before re-freezing
src/core/errors/aggregate.test.ts's digest, which must only ever grow by additions.

The session's working directory is CUBIT_SESSION_WORK (default .private/work/current).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / os.environ.get("CUBIT_SESSION_WORK", ".private/work/current")
TSV, MSG, STATE = WORK / "law-ids.tsv", WORK / "integrate-msg.txt", WORK / "integrate-state.txt"
TOKEN = re.compile(r"\b([ID])-([A-Z][A-Za-z0-9]*)-([a-z])\b")
BINARY = {".png", ".jpg", ".jpeg", ".pdf", ".dwg", ".xlsx", ".zip", ".gz"}
HAND = "-- hand-written"
UNMERGED = {"UU", "AA", "DU", "UD", "AU", "UA", "DD"}


def git(*a, check=True):
    r = subprocess.run(["git", *a], cwd=ROOT, text=True, capture_output=True, check=False)
    if check and r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        raise SystemExit(f"git {' '.join(a)} failed")
    return r.stdout


def tags():
    return {re.sub(r"[^A-Za-z0-9]", "", f.stem) for f in (WORK / "slices").glob("*.json")}


def load():
    table = {}
    if TSV.exists():
        for line in TSV.read_text().splitlines():
            if line.strip():
                token, real, *_ = line.split("\t")
                table[token] = real
    return table


def highest(kind, table):
    text = subprocess.run(["git", "grep", "-hoE", rf"\*\*{kind}-[0-9]{{3}}\b", "--", "docs/design", "docs/decisions"], cwd=ROOT, text=True, capture_output=True, check=False).stdout
    nums = [int(m[len(kind) + 3:]) for m in re.findall(rf"\*\*{kind}-[0-9]{{3}}", text)]
    nums += [int(v.split("-")[1]) for v in table.values() if v.startswith(kind + "-")]
    return max([{"I": 369, "D": 4}[kind], *nums])


def unmerged():
    return [line[3:] for line in git("status", "--short").splitlines() if line[:2] in UNMERGED]


def keep_meta():
    """Resolve conflicts confined to drizzle's metadata by keeping this branch's copy. True if none remain."""
    for path in unmerged():
        if not path.startswith("db/migrations/meta/"):
            return False
        if subprocess.run(["git", "cat-file", "-e", f"HEAD:{path}"], cwd=ROOT, check=False).returncode == 0:
            (ROOT / path).write_text(git("show", f"HEAD:{path}"))
            git("add", "--", path)
        else:
            git("rm", "-q", "--cached", "--", path)
            (ROOT / path).unlink(missing_ok=True)
    return not unmerged()


def renumber_migrations():
    """Regenerate a staged slice migration whose number is already held, at the next free number."""
    staged_new = [p for p in git("diff", "--cached", "--name-only", "--diff-filter=A").splitlines() if re.match(r"db/migrations/\d{4}_.+\.sql$", p)]
    held = {m.group(1) for p in git("ls-tree", "--name-only", "HEAD", "db/migrations/").splitlines() if (m := re.match(r"db/migrations/(\d{4})_", p))}
    for path in staged_new:
        number, name = re.match(r"db/migrations/(\d{4})_(.+)\.sql$", path).groups()
        if number not in held:
            continue
        original = (ROOT / path).read_text()
        git("rm", "-q", "-f", "--", path)
        subprocess.run(["npx", "drizzle-kit", "generate", "--name", name], cwd=ROOT, check=True, capture_output=True)
        fresh = max(ROOT.glob(f"db/migrations/*_{name}.sql"))
        cut = original.find(HAND)
        if cut >= 0:
            body = fresh.read_text().rstrip()
            if not body.endswith("--> statement-breakpoint"):
                body += "--> statement-breakpoint"
            fresh.write_text(body + "\n" + original[cut:])
        snap = ROOT / "db/migrations/meta" / f"{fresh.name[:4]}_snapshot.json"
        git("add", "--", str(fresh.relative_to(ROOT)), str(snap.relative_to(ROOT)), "db/migrations/meta/_journal.json")
        print(f"migration {path} regenerated as {fresh.relative_to(ROOT)}")


def errors_check(base):
    """Exit non-zero if any refusal entry present at <base> changed or vanished."""
    dump = "const m = await import(process.argv[2]); console.log(JSON.stringify(m.REFUSALS));"
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(f"git archive {base} src/core/errors.ts src/core/errors | tar -x -C {tmp}", cwd=ROOT, shell=True, check=True)
        script = Path(tmp) / "dump.mts"
        script.write_text(dump)
        read = lambda p: json.loads(subprocess.run(["node", "--import", "tsx", str(script), p], cwd=ROOT, text=True, capture_output=True, check=True).stdout)
        old, new = read(str(Path(tmp) / "src/core/errors.ts")), read(str(ROOT / "src/core/errors.ts"))
    changed = [c for c in old if c in new and old[c] != new[c]]
    removed = [c for c in old if c not in new]
    print(f"refusals: {len(old)} at {base}, {len(new)} now; added {len(new) - len(old) + len(removed)}, removed {removed}, changed {changed}")
    raise SystemExit(1 if changed or removed else 0)


def main():
    args = sys.argv[1:]
    if args and args[0] == "--errors-check":
        errors_check(args[1])
    slice_id, wt = args[0], args[1]
    base = args[args.index("--base") + 1] if "--base" in args else subprocess.run(["git", "-C", wt, "merge-base", "HEAD", git("rev-parse", "--abbrev-ref", "HEAD").strip()], text=True, capture_output=True, check=False).stdout.strip()
    commits = [c.split("\t", 1) for c in subprocess.run(["git", "-C", wt, "log", "--reverse", "--format=%H%x09%s", f"{base}..HEAD"], text=True, capture_output=True, check=False).stdout.strip().splitlines() if c]
    code = [c for c in commits if not c[1].startswith("baseline:")]
    baselines = [c for c in commits if c[1].startswith("baseline:")]
    done = int(STATE.read_text()) if "--continue" in args and STATE.exists() else 0
    for i, (sha, _subject) in enumerate(code):
        if i < done:
            continue
        r = subprocess.run(["git", "cherry-pick", "-n", sha], cwd=ROOT, text=True, capture_output=True, check=False)
        if r.returncode != 0 and not keep_meta():
            STATE.write_text(str(i + 1))
            print(r.stdout + r.stderr)
            print(f"CONFLICT at {sha[:10]} ({i + 1}/{len(code)}): {unmerged()} — resolve, git add, re-run with --continue")
            raise SystemExit(2)
    # Every pick is in: a failure from here on (the migration's regeneration) resumes past the picks
    # rather than applying the slice a second time on top of itself.
    STATE.write_text(str(len(code)))
    renumber_migrations()
    STATE.unlink(missing_ok=True)
    table, known = load(), tags()
    paths = [p for p in git("diff", "--cached", "--name-only").splitlines() if p]
    texts = {}
    for p in paths:
        f = ROOT / p
        if f.exists() and f.suffix.lower() not in BINARY:
            try:
                texts[p] = f.read_text()
            except UnicodeDecodeError:
                pass
    msgs = [git("log", "-1", "--format=%B", sha) for sha, _ in commits]
    found = {m.group(0) for t in [*texts.values(), *msgs] for m in TOKEN.finditer(t) if m.group(2) in known}
    fresh = []
    for tok in sorted(found - set(table), key=lambda t: (t[0], t.split("-")[1], t.split("-")[2])):
        n = highest(tok[0], table) + 1
        table[tok] = f"{tok[0]}-{(5 if tok[0] == 'D' and n == 3 else n):03d}"
        fresh.append(tok)
    rewrite = lambda t: TOKEN.sub(lambda m: table.get(m.group(0), m.group(0)) if m.group(2) in known else m.group(0), t)
    for p, t in texts.items():
        if rewrite(t) != t:
            (ROOT / p).write_text(rewrite(t))
    present = [p for p in paths if (ROOT / p).exists()]
    if present:
        git("add", "--", *present)
    if code and git("diff", "--cached", "--name-only").strip():
        rest = [rewrite(s) for _, s in code[1:]]
        MSG.write_text(rewrite(git("log", "-1", "--format=%B", code[0][0])).rstrip() + (f"\n\nThe slice's further commits ({slice_id}, integrated as one):\n" + "\n".join(f"- {s}" for s in rest) if rest else "") + "\n")
        git("commit", "-q", "-F", str(MSG))
        print(git("log", "--oneline", "-1").strip()[:150])
    for sha, _subject in baselines:
        if subprocess.run(["git", "cherry-pick", "-n", sha], cwd=ROOT, capture_output=True, check=False).returncode != 0:
            raise SystemExit(f"CONFLICT in baseline {sha[:10]} — resolve and commit it by hand with its own message")
        MSG.write_text(rewrite(git("log", "-1", "--format=%B", sha)))
        git("commit", "-q", "-F", str(MSG))
        print(git("log", "--oneline", "-1").strip()[:150])
    with TSV.open("a") as out:
        for tok in fresh:
            out.write(f"{tok}\t{table[tok]}\t{slice_id}\n")
    print("allocated:", {k: table[k] for k in fresh})


if __name__ == "__main__":
    main()
