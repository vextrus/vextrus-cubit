# The revised M0 plan (session 02), attacked: the refuter

28 Sep 2026. Eight targets; six refuted, one confirmed, one unproven. Written by the orchestrator from the
agent's report.

## Targets
1. **32 tickets, machinery: CONFIRMED.** 8 cloud, 14 cloud+local, 10 local (22 cloud-built, 18 in waves
   1–4); machinery 7 (01a, 01b, 01c, 06a, 06b, 23, 24). Q24's "8" and the spec (M0.md:750) should say 7
   (15 − 8 removed = 7).
2. **Disjoint files per wave: REFUTED; one migration per module per wave: CONFIRMED.** Wave 2: 07
   (invitation and activity codes) and 09 (job status words, machine sentences per plan:173) both add
   codes to `vextrus/platform/schemas/messages.py`, owned by neither. Softer, wave 4: 18 edits
   `engine/render/` while 16 decodes its buffer format.
3. **Blocked-by edges point to earlier waves: REFUTED.** 24 (wave 8) blocked by 26 (wave 8); 22 (wave 5)
   cannot merge until 21c (wave 7) and 26 (wave 8); 01c blocked by 01a inside wave 0 (declared); 26 walks
   22's unmerged head while 22 waits for 26 (an undeclared edge).
4. **The regression check cannot be passed by a silent reading change: REFUTED** (R1–R4). An agent can
   post the status: the guard refuses only a literal `gh api …/statuses/`; a variable-split `gh api` and a
   `curl` POST to the statuses endpoint were both allowed when fed to guard.mjs.
5. **PostgreSQL 18, Python 3.14 and the ezdxf source build in the cloud and CI: UNPROVEN.** The workflow
   was never run on GitHub and the cloud setup time is unmeasured (stack-versions.md); verified:
   `postgres:18.6` on Docker Hub, no cp314 ezdxf wheel, uv 0.12.5 builds ezdxf 1.4.4 on 3.14 from source
   (9 extensions), only PostgreSQL 16 here. The cloud setup must exit 0 within five minutes
   (sdlc-waves-and-cloud.md §1.4); PostgreSQL 18, the ezdxf compile, Chromium and LibreDWG together were
   never timed.
6. **Stories 91–104 owned with testable acceptance: REFUTED in part.** Story 98 says "before wave 0" but
   the plan rebuilds the cloud environments after it (plan:432-436); story 102's "Jump to" (Ctrl K, 03's
   per m0-screens:276) is in no acceptance and not filtered by the member's Projects; story 92's codes from
   10, 11, 12 and 19b have no enum (`engine` is not a Django module), so 03's test cannot see them.
7. **The mapping covers #1–#40 once each: coverage CONFIRMED; "loses nothing" REFUTED** (R6).
8. **The Session 02 section contradicts a ruling: REFUTED.** Q18 and ADR 0034 say 3.14 and 18.6
   "everywhere before wave 0"; the plan rebuilds the cloud environments after wave 0, and this is not among
   its delegated choices (plan:1113-1137).

## Findings
**R1 · critical · The install step escapes the sandbox.** Step 2 (plan:303-307) runs `uv sync --frozen
--no-build` outside bwrap; with `[tool.uv] no-binary-package` in `pyproject.toml`, uv 0.12.5 overrides
`--no-build` (it built pyparsing from source, and a local path package added to the repository: the PR's
own build code, as the owner, with network and home); it would build ezdxf outside the sandbox too;
`pyproject.toml` and `.python-version` are neither engine paths (plan:149-153) nor in the code hash. Fix:
the install inside bwrap, offline, from a wheel folder main's code fetches by uv.lock's hashes; refuse any
non-registry source in uv.lock and any `[tool.uv]` differing from main's; both files into the engine paths
and the code hash.

**R2 · high · Reading changes can pass as "no change".** Until 21c main's command runs the harness, so 21a
and 21b never execute in the check, and 21c's switch (plan:799-800) runs from main's copy; the code hash
(plan:327-328) omits `tools/acadsharp-dump/**`; the matcher (plan:262-270) has no join or value rule for
register entries, Check results, conflicts, the issue date, font and PDF report counts, and compares a
view's Coverage status only (not its proposed steps, Part or exclusion reason); a `libredwg.version` bump
changes the hash but the installed `dwgread` runs. Fix: the product-job mode in main's command in 21a, the
owner accepting the first harness-to-job diff; hash every engine path; join and value rules for those
fields; refuse to run when `dwgread` differs from the pin.

**R3 · high · The status can be forged.** The guard is bypassable (target 4); the ruleset is left unpinned
(plan:1091); any PR workflow (`real-drawings-na.yml`, 22's new `e2e.yml`) can post `real-drawings` success
with GITHUB_TOKEN from the PR's own copy, with the same author as the legitimate "not applicable". Fix:
the not-applicable job on `pull_request_target` (main's copy runs); a CI check failing any workflow that
requests `statuses: write` or names `real-drawings`; the guard matching `/statuses` in any command.

**R4 · medium-high · The drop folder is writable from inside the sandbox** (plan:310-311), later read
unsandboxed by the owner's diff and the key user's poster: the PR's code can plant a summary, forged
metadata or symlinks. Fix: the sandbox writes only to a fresh scratch folder; the command checks the export
against its schema, writes the metadata itself, and copies into the drop folder without following links.

**R5 · medium · The sandbox as listed cannot run here.** Python 3.14 (`~/.local/share/uv/python`),
`dwgread` (`~/.local/bin`) and .NET (`~/.dotnet`) live in the owner's home, which step 3 does not mount.
Fix: install them under `/opt` (as the cloud setup does with `UV_PYTHON_INSTALL_DIR=/opt/uv-python`) or
bind each by name; an owner step before 06a.

**R6 · medium · Acceptance lost in the move to M1.** The key-matching contract of the signed plan (commit
f47854b5~3, docs/plans/M0.md:162-168: Edison joins by normalised sheet number, then title; views by
reading order after undoing page rotation; IoU for the Sample Project) and #8's tests (invented keys; no
key value, name or title printed; the join on a rotated key; the export's run id checked) did not reach
docs/specs/M1.md:1054-1056 or 1430; #40's "Run `drop-setup.sh`" dropped from the baseline step
(plan:337-343, 542-543). Fix: copy these into M1 ticket 01 word for word; `drop-setup.sh` into the
baseline step.

**R7 · medium · Shared files nobody owns.** The platform codes file in wave 2; engine codes with nowhere to
live; 15's `vextrus/testing/jev.py` missing from 01a's conftest stubs (plan:369-370). Fix: one messages
module per ticket collected by a glob; an `engine/messages/` package, one file per Check; jev in 01a's
stubs; 24 stated "after 26".

**R8 · low-medium · Ruling contradicted; the owner's time undercounted.** The Q18/ADR 0034 contradiction
(target 8): put it to the owner as a delegated choice, or rebuild the environments before 01a with a
stopgap setup script and time the five-minute budget. Posting runs "about 13" but 12 listed; every rebase
of an up-to-date branch needs a fresh owner-posted status: count the reposts.
