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
- Test runs are SCOPED: an unscoped runner discovers .builder-heldout/ and recurses. Run the exact files your task names (`pnpm vitest run <files>`), never the whole tree; never read or touch .builder-heldout/.
- Before editing test config, tests/e2e/**, CLAUDE.md or .claude/**: confirm your increment's approved spec owns that path — locked by default, and each attempt costs a denial plus a structural red.
- Read-only roles (reviewer/skeptic/adversary/planner) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` (stdout) and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input — denied; `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it. The engine's CLI (`builder …`) is never reachable from a session.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.
- Toolchain churn (`next build` rewrites tsconfig.json and next-env.d.ts): never hand-edit them; `git checkout main -- tsconfig.json next-env.d.ts` is always allowed (chained too), or leave the dirt — the engine restores them to main's form at the gate and at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- An Object.keys exact-set assertion is lawful only where a Bible clause quotes the member list closed; for a type another increment owns, derive both sides in … — An arbitration (that increment, 2026-09-03) struck a nine-name `MODEL_ANSWER_KEYS` literal out of `src/core/model/__tests__/proposal.acceptance.test.ts` as the B-19 class — a transcribed literal standing in for a rule.
- `uv run --offline --with pkg==v` refuses packages that ARE in ~/.cache/uv (charset-normalizer 3.5.1 \"needs to be downloaded\"), while `uv lock --offline` + … — Measured 2026-09-03 with uv 0.12.5, network off: `uv run --offline --project cad --with reportlab==4.4.9 --with pillow==12.3.0 --with pypdfium2==5.13.0 python x.py` fails with "No solution found … charset-normalizer==3.5.1 needs to be downloaded from a …
- Grade a \"mild skew\" raster fixture by pixels against an unskewed pypdfium2 render; pypdfium2 ceils page pixels so a round() size pin false-reds — Measured 2026-09-03 (pypdfium2 5.13.0, pillow 12.3.0, reportlab 4.4.9, numpy 2.5.2) while amending the F-RCC6 held-out set (that increment) after the audit found "skew_deg in manifest.json" unbound: - `page.render(scale=dpi/72, grayscale=True).to_pil()` gives …
### Tests & acceptance
- Q-07's REFUSAL_SHAPE needs an underscore, so a Bible code like UNSOURCED or MALFORMED can never be \"exercised\" and fails taxonomy.test.ts's shape check — Found 2026-09-03 writing that increment's acceptance (L-AI-02: `UNSOURCED`, `SOURCE_UNRESOLVED`, `MALFORMED`). Both register suites transcribe `REFUSAL_SHAPE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`, which requires at least one `_`: - `src/core/errors/taxonomy.test.
- ezdxf 1.4.4 writes the CLASSES section from a set (entitydb.dxf_types_in_use), so a 'deterministic' DXF flips LAYOUT/ACDBPLACEHOLDER order between processes; … — Measured 2026-09-03 while F-RCC6's byte-identity test flaked (1 in ~3 runs): two DXFs from the same script differed only in the CLASSES section, where the `LAYOUT` and `ACDBPLACEHOLDER` CLASS records swapped places.
### Screens & design
- convert_dwg's geometry pass (dwg2dxf -m) keeps model space and the FIRST paper layout; every later layout arrives empty and is refused SHORTFALL by name, so a … — Measured 2026-09-03 (LibreDWG 0.13.3, ezdxf 1.4.4) on an ezdxf R2000 DXF with model space + two paper layouts ("FOUNDATION PLAN", "ROOF PLAN") minted with `dxf2dwg`: - `convert_dwg(...).census` names all three spaces with the right per-type counts (LAYOUT …
<!-- builder:lessons:end -->
