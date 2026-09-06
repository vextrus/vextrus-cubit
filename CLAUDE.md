# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test:db · pnpm e2e --journey <J> · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason.
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects.
- Never delete a test or weaken a check to green a build; raise an Objection in the handoff.

## Lawful paths (the hooks enforce these — don't rediscover them by denial)
- Scratch: `mcp__builder__scratch_dir` is the writable directory; `rm -rf` only there and on regenerable output (.next*/, dist/, coverage/, .turbo/, .vite/, *.tsbuildinfo) by relative path.
- Test runs are by name (`pnpm vitest run <files>`); `mcp__builder__check` runs the gate's fast lane in one call; `pnpm verify` once, before the handoff. `.builder-heldout/` is the Verifier's — never read by another role.
- A Bash output over 6,000 chars arrives compacted (head, tail, every verdict line, and the scratch file holding the whole text) — read that file, don't re-run the command.
- Before editing test config, tests/e2e/**, CLAUDE.md or .claude/**: confirm your increment's approved spec owns that path — locked by default, and each attempt costs a denial plus a structural red.
- Read-only roles (reviewer/skeptic/adversary/planner) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input (denied); `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it. The engine's CLI (`builder …`) is never reachable from a session.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.
- Toolchain churn (`next build` rewrites tsconfig.json and next-env.d.ts): never hand-edit them; `git checkout main -- tsconfig.json next-env.d.ts` is always allowed (chained too), or leave the dirt — the engine restores them to main's form at the gate and at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- Held-out commit belongs to the engine's verifier step — An increment whose plan moves the held-out set out of the tree hit the same denial three times in one increment: the engine makes the verifier commit itself, and the session must leave the tree dirty rather than add or commit it.
### Tests & acceptance
- userEvent.setup() overwrites navigator.clipboard with its own stub, so a vi.fn installed in beforeEach has no .mock by assertion time — `@testing-library/user-event` 14.6's `setup()` calls `attachClipboardStubToView(window)` unconditionally (`dist/cjs/setup/setup.js:58`), which does `Object.defineProperty(window.navigator, "clipboard", { get: () => stub })`.
- A new small top-bar occupant did NOT move any committed full-frame baseline — maxDiffPixelRatio 0.002 absorbed it — the job timeline increment added a permanent jobs tray to the top bar and planned re-baselines of `shell-light/dark.png`, `shell-tenant-switcher-open.png`, `shell-user-menu-open.png`, `j-001-auth/*`, `j-002-tenant-admin/*`, `j-003/*`, `s-audit/explorer.png` …
- A TEST_AMENDED ruling can order the Verifier to regenerate a baseline in its own `baseline:` commit — the role's commit hook refuses anyway; generate, prove, … — Hit on the viewer inspector increment (2026-09-05).
- A repeated SNAPSHOT_REGENERATED red is unresolved drift, not a baseline update — An increment whose plan changed rendered/visual output drew the same structural gate red (SNAPSHOT_REGENERATED) across every attempt, alongside a DESIGN_BASELINE_RETAKEN finding — the pattern of a session re-accepting the new snapshot each time instead of …
- J-000's rename→breadcrumb assertion can fail on the first (cold) e2e run and pass on a re-run — On 2026-09-05 (inc-sweep-src-app-2) the first `pnpm e2e --journey J-000` of a session failed at `j-000-golden-path.spec.ts:70` — `shell.breadcrumb` still read the sign-up workspace name ("First Workspace <suffix>") after the rename door had saved "Golden Path …
### Screens & design
- R-UI-020 binds secondary surfaces too — a tray/list row that says \"Refused\" owes the RefusalState, even when a Decision says that panel shows no refusal card — the job timeline increment shipped a jobs tray whose refused row showed only the status word, following `docs/design/shell-top-bar.md` §1 ("No refusal card, no fault id and no evidence link renders in the panel: a refused job is answered in place, by the …
<!-- builder:lessons:end -->
