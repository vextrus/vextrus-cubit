# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test (unit lane, opens no database) · pnpm test:db · pnpm test:golden · pnpm e2e --journeys A,B · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason. Its `<amendments>` are current law and are read with the clauses they affect — AM-01/02/03 (the fixtures, the junction law, the rebar rulings), AM-08/09/10/11 (the UX standard, the test surface, the gate's budgets, the split registries).
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects. Under AM-08 the Decision opens with a wireframe and a region table (id, width, min, max, owner) and carries the screen's copy verbatim; one file per pattern, and a second spelling of the same document is a defect.
- The craft rubric grades every screen: twelve criteria, 0–5, weights summing to 12, measured at 1440x900 and 1280x800 in both themes, the screen's score the minimum of them. The v22 bar is ≥4.0 with no criterion below 3; a screen under the bar blocks like a failing test. Where a mechanical check exists (read from the DOM after `settled()`) the score is computed and a human may only lower it.
- Quantities: one owner per junction (L-MEA-09, pile > cap > column/wall > beam > slab); beams measure clear between support faces and below the slab soffit; verticals floor-to-floor through the joint; slabs run through. A junction deduction may defer (JUNCTION_DEFERRED) only where the published figure is then under — an over-measured figure is never a disclosure.
- Rebar: the kg/m table bills and d²/162 only checks; laps are their own component (LAP) beside NET, never a percentage; wastage and binding wire touch resource outputs only. BS 8666 governs the BBS — the raw cutting length is never rounded, one rounded surface (≤25 mm), the IS-additive figure printed beside and never billed.

## The product's own conventions (v22)

### The frontend
- `src/ui/testids.ts` is the only spelling of a test id. Components read it, page objects read it, Design Decisions cite it, the testContract is written against it — a literal id string anywhere else is a defect.
- Components consume the semantic alias layer and the density and layout tokens only; `var(--graphite-*)` or `--beam-*` outside `tokens.ts`, `tokens.css` and the alias group is a lint failure (`cubit/no-primitive-token`). Density revalues `--row-h`, `--cell-px`, `--cell-py`, `--text-body` at the root via `[data-density]`, never per screen.
- Dark is the default theme and light is complete; both are baselined. An alias may flip its index between themes — consumer code never branches on the theme.
- Use the shipped primitives (`src/ui/primitives/{core,data,overlay}`): Select, Combobox, IdChip, EnumLabel, Breadcrumb, DataTable v2, NumberInput, Switch, Checkbox. Native `select` and `input type=date` are unlawful. Ids (UUIDs, digests, DXF handles, version keys) render through IdChip, never as body text; enums render through EnumLabel.
- The shell: a 48 px icon rail, a 32 px toolbar, a 24 px status bar, and exactly one inspector — hosted by the shell's single slot through `useInspector`, present only with a selection. No screen renders a second right column. Grids default to the compact 28 px row: no wrapping cells, ellipsis plus tooltip, sticky header, frozen key column, tabular right-aligned numerals with lakh/crore grouping.
- Every screen declares its crumbs in `routes.ts`; the breadcrumb names workspace, project, area and page.

### Doors, registries and errors
- Every entry point — tRPC procedure, server action, route handler, event stream — resolves actor, tenant, project and permission through the one `authorize()` in `src/server/authorize.ts` (`authorizePage()` for pages) before it reads or writes. Each door carries a live-database test proving a caller without the permission is refused by name.
- A door's input is parsed by one zod schema through `serverCall`/`routeHandler` (`src/server/call.ts`): a malformed statement is a refusal, never a 500. `REQUEST_MALFORMED` is the transports' code; `MALFORMED` keeps L-AI-01's copy.
- The registries are split per area and assembled by enumeration: `src/core/errors/<area>.ts`, `src/core/db/schema-<area>.ts`, `src/core/jobs/kinds/<area>.ts`, `src/core/rulesets/methods/registry/<area>.ts`, `src/modules/takeoff/rails/<area>.ts`. The barrel enumerates and never re-declares, each barrel carries a duplicate-key test, and a new area is one spread line in the barrel. A `schema-<area>.ts` is a table file, not a door.
- The notation grammar is a table (`src/modules/takeoff/partition/notation/grammar.ts`) and the parser is generated from it; a method is one Expr tree that both prints the formula and computes the figure.

### Fixtures and the golden
- Two fixtures, never a replacement. F-RCC6 is byte-frozen at v1.1 as the J-000 corpus, the SAMPLE seed and the fast regression lane; F-RCC6-BNBC (`fixtures/gen/rcc6_bnbc/` → `fixtures/rcc6-bnbc/`, pytest at `cad/tests/rcc6_bnbc/`) is the M3/M4 yardstick and the band proof's target.
- Read a golden through `goldenRows(fixtureId)` (`tests/golden/support/golden-fixture.ts`) — the row type admits both schemas. `pnpm test:golden` runs the lane. The golden is authored by the generator's independent model, never derived by the product's own methods; where the two paths disagree the fixture's selfcheck refuses.
- A regenerated fixture, snapshot or baseline goes in its own `baseline:`-subject commit naming the proof.

### Tests and lanes
- `pnpm test` is the unit lane and opens no database; `pnpm test:db` is the database lane over a migrated template DB copied per test file. The two lanes partition every suite — a unit-lane suite that opens a database is a defect.
- `pnpm e2e --journeys A,B` runs several journeys in one Playwright invocation, each with its own verdict; `CUBIT_E2E_WORKERS` and `CUBIT_VERIFY_SLOTS` are how much of the box the lane may have. `pnpm e2e:clean` takes away its leavings.
- V-E2E determinism: viewport 1440x900, reduced motion, fonts ready, and `settled(page)` awaited before every axe run and every capture. `checkpoint()` is where a journey attaches a capture and runs axe — serious and critical violations fail the journey, moderate ones are held to `tests/e2e/support/axe-budget.ts`; a screen's recorded height is held to `tests/e2e/support/height-budget.ts`.
- Page objects use retrying reads only (`cubit/no-unretried-read`); `.all()`/`.count()` on a virtualised table is not an assertion, and `waitForTimeout` is unlawful in a journey. A flake is a defect with a cause, never a retry.
- The golden path is a directory: `tests/e2e/journeys/j-000/<cp>-<leg>.spec.ts`, with a roster test that derives the leg list from the Bible's own text and fails when a named segment has no executed file. A leg never stages state — it clicks what a customer clicks; a leg that cannot be reached through the UI is a missing screen, written as a `test.fixme` opening with a `MISSING DOOR:` line that the door's own increment deletes.
- Lane ceilings are law: V-VERIFY ≤60 s, V-E2E ≤12 min full, V-GOLDEN ≤3 min, ≤90 s per journey (J-000 exempt, carrying its own budget re-set at each milestone close). A lane over its ceiling is a defect with an owner, not a new normal. Performance assertions live only in PERF- specs (`pnpm test:perf`) — no gate lane asserts a PB budget.
- The machine runs one heavy lane per slot, through the engine: never `pnpm test:db` while an e2e server is up.
- The toolchain is pinned save-exact: Typst 0.15.1 (sha256 29273eaa…) and exceljs 4.4.0, refused by `pnpm checkup` on drift. Builders have no web access — moving a pin is a `toolchain`-tagged increment naming the files, never a session's download.

## Lawful paths (what the hooks admit — a denial only says no; these say what works)
- Scratch: `mcp__builder__scratch_dir` is the writable directory; `rm -rf` also takes this lane's own regenerable output named by a relative path (.next*/, dist/, coverage/, .turbo/, .vite/, *.tsbuildinfo) — the same directory spelled as an absolute path is refused, even inside your own worktree.
- Test runs are by name (`pnpm vitest run <files>`, every path spelled out, in the lane that suite belongs to); `mcp__builder__check` is the gate's fast lane in one call, and `{ "full": true }` the whole chain once, before the handoff.
- A Bash output over 6,000 chars arrives compacted (head, tail, every verdict line, and the scratch file holding the whole text) — read that file, don't re-run the command.
- A failed Edit means your copy of the file is stale, not that the string was wrong: re-Read the exact region and edit from what you just read — a re-guessed `old_string` fails again, and a whole-file Write to get around it buys SCOPE_CREEP.
- A restore from a ref names explicit files, one path at a time (`git checkout main -- <file>`, chained if you need several); `.`, a directory or a glob is refused because it can reach the acceptance tree.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input (denied); `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it.
- History is append-only: a landed migration is superseded, never edited; a regenerated snapshot or baseline goes in its own commit whose subject starts `baseline:` and names the proof. A design picture your lawful change moved is the gate's to re-take — don't spend a turn on `--update-snapshots`.
- Toolchain churn (`next build` appends a dist dir to tsconfig.json): never hand-edit it; `git checkout main -- tsconfig.json` is always allowed (chained too), or leave the dirt — the engine restores it to main's form at the gate and at merge. A deliberate config change is lawful only where the increment is tagged `toolchain` or its approved spec names the path; otherwise it belongs to the increment that owns it. `next-env.d.ts` is untracked build output (`pnpm typecheck` regenerates it); never commit or restore it.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- Diagnosis that reaches for source introspection instead of read-only probes — A session tried to inspect runtime state by running arbitrary code (e.g. a code-evaluation flag) rather than a read-only probe, and was denied — diagnosis is read-only.
- Held-out criteria must quote only what the Builder reads — An increment's first attempt went HELDOUT_RED because its spec's held-out criteria quoted literal strings that appear nowhere in the goal, the public criteria, or the test contract — the only three places the Builder can check a quote against.
- UI-scoped work that reaches into a shared string table breaks the unrelated golden path — An increment scoped to one UI feature edited another module's shared string table and a locked path, drew SCOPE_CREEP findings, and the unrelated golden-path journey test went red on repeated attempts, not just its own feature's journey.
- UI string keys belong in the touching module's own file — An increment that needs new UI copy sometimes reaches for another module's existing string table and gets denied — twice in this increment alone.
- The session that re-runs the gate chain by hand — An increment repeatedly (4x) tried to run the whole gate chain tool-by-tool instead of calling the fast lane.
### Tests & acceptance
- Scan-corpus exemptions need the corpus committed and armed, not just referenced — An increment writing a lint/scan-law test that excuses a NEVER via a named corpus can pass its own unit test while failing the AC that the corpus sits in an armed lane.
- Prove 'this module imports only from X' behaviourally with a module.register resolve hook that refuses everything else — never by scanning the file's text — An acceptance criterion of the form *"`<module>` imports only from `@/core/**`"* is a **source-text** assertion if you scan it with `tests/support/source-lex` — and the engine's mechanical check flags it (v15 §7).
<!-- builder:lessons:end -->
