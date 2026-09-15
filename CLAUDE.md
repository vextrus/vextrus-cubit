# VEXTRUS CUBIT — the product's law for every session

Vextrus Cubit is a construction quantity-takeoff product (Next.js, tRPC, Postgres, a Python cad lane)
built by the Vextrus Builder engine against `docs/specs/cubit.bible.xml`. This file is the product's
conventions and the paths the hooks admit; your role, your increment and its acceptance arrive in
your prompt. The engine rewrites the lessons block after merges; nothing here is edited in a session.

## Commands that must be green
`pnpm verify` (prints `LANE <id> <seconds>` per lane — quote it, never time a lane by hand) ·
`pnpm test` (unit lane, opens no database) · `pnpm test:db` · `pnpm test:golden` ·
`pnpm e2e --journeys A,B` · `pnpm checkup`.

## Law
- The Bible is immutable: take the most defensible reading and record an Interpretation; a
  contradiction stops the increment with a named reason. Its `<amendments>` are current law, read with
  the clauses they affect (AM-01/02/03 fixtures, junctions, rebar; AM-08/09/10/11 UX standard, test
  surface, gate budgets, split registries).
- A screen is implemented against its Design Decision in `docs/design/<screen>.md` — wireframe,
  region table (id, width, min, max, owner), every state, copy verbatim, motion, tokens. A deviation
  is a defect; a second spelling of the same document is a defect.
- The craft rubric grades every screen: twelve criteria 0–5, weights summing to 12, at 1440x900 and
  1280x800, the score the minimum; the bar is ≥ 4.0 with no criterion below 3 and blocks like a
  failing test. A mechanical criterion (read from the DOM after `settled()`) is computed, and a human
  may only lower it.
- Quantities: one owner per junction (L-MEA-09: pile > cap > column/wall > beam > slab); beams clear
  between support faces below the soffit; verticals floor-to-floor through the joint; slabs run
  through. A deduction defers (JUNCTION_DEFERRED) only where the published figure is then under —
  an over-measured figure is never a disclosure.
- Rebar: the kg/m table bills, d²/162 only checks; laps are their own component (LAP) beside NET,
  never a percentage; wastage and binding wire touch resource outputs only. BS 8666 governs the
  BBS: the raw cutting length is never rounded, one rounded surface (≤ 25 mm), the IS-additive
  figure printed beside and never billed.

## Frontend
- `src/ui/testids.ts` is the only spelling of a test id: components, page objects, Design Decisions
  and the testContract read it; a literal id anywhere else fails `cubit/no-literal-testid` (under
  `src/modules/**` a warning with a frozen count that may only fall). `RegisterChrome.testIds` is how
  a module screen publishes its own.
- Components consume the semantic alias layer and the density/layout tokens only; `--graphite-*` or
  `--beam-*` outside `tokens.ts`, `tokens.css` and the alias group fails `cubit/no-primitive-token`.
  Density revalues `--row-h`, `--cell-px`, `--cell-py`, `--text-body` at the root via
  `[data-density]`, never per screen.
- Dark is the default theme and light is complete; both are baselined. Consumer code never branches
  on the theme.
- Use the shipped primitives (`src/ui/primitives/{core,data,overlay}`): Select, Combobox, IdChip,
  EnumLabel, Breadcrumb, DataTable v2, NumberInput, Switch, Checkbox. Native `select` and
  `input type=date` are unlawful; ids render through IdChip, enums through EnumLabel.
- The shell: a 48 px icon rail, a 32 px toolbar, a 24 px status bar, exactly one inspector hosted by
  the shell's slot through `useInspector`, present only with a selection. Grids: compact 28 px rows,
  no wrapping, ellipsis plus tooltip, sticky header, frozen key column, tabular right-aligned
  numerals with lakh/crore grouping. Every screen declares its crumbs in `routes.ts`.

## Doors, registries, errors
- Every entry point (tRPC procedure, server action, route handler, event stream) resolves actor,
  tenant, project, participation and permission through the one `authorize()` in
  `src/server/authorize.ts` (`authorizePage()` in `src/server/authorize-page.ts` for pages) before it reads or writes, and carries a
  live-database test that a caller without the permission is refused by name.
- Input is parsed by one zod schema through `serverCall`/`routeHandler` (`src/server/call.ts`): a
  malformed statement is a refusal (`REQUEST_MALFORMED`; `MALFORMED` keeps L-AI-01's copy), never a 500.
- Registries are split per area and assembled by enumeration (`src/core/errors/<area>.ts`,
  `src/core/db/schema-<area>.ts`, `src/core/jobs/kinds/<area>.ts`,
  `src/core/rulesets/methods/registry/<area>.ts`, `src/modules/takeoff/rails/<area>.ts`): the barrel
  enumerates and never re-declares, carries a duplicate-key test, and a new area is one spread line.
- The notation grammar is a table (`src/modules/takeoff/partition/notation/grammar.ts`); the parser
  is generated from it; a method is one Expr tree that prints the formula and computes the figure.
  The notation corpus test is a ratchet: the corpus may grow, never shrink.
- The mail outbox has exactly one reader; a second consumer is a defect.

## Fixtures and the golden
- Two fixtures, never a replacement: F-RCC6 is byte-frozen at v1.1 (the J-000 corpus, the SAMPLE
  seed, the fast regression lane); F-RCC6-BNBC (`fixtures/gen/rcc6_bnbc/` → `fixtures/rcc6-bnbc/`,
  pytest at `cad/tests/rcc6_bnbc/`) is the M3/M4 yardstick. A numeric assertion names its roster.
- Read a golden through `goldenRows(fixtureId)` (`tests/golden/support/golden-fixture.ts`). The
  golden is authored by the generator's independent model, never by the product's methods; the lane
  is armed by the fixtures' manifests (`fixtures/rcc6/manifest.json`,
  `scripts-data/sample-seed/manifest.json`) — a lane with no manifest proves nothing.
- A regenerated fixture, snapshot or baseline goes in its own `baseline:`-subject commit naming the
  proof. A design picture your lawful change moved is the gate's to re-take, never `--update-snapshots`.

## Tests and lanes
- `pnpm test` opens no database; `pnpm test:db` copies one migrated template per test file over the
  pooled connection — never a psql of your own beside it, never `pnpm test:db` while an e2e server is
  up. A unit-lane suite that opens a database is a defect.
- The journey lane is dark; `CUBIT_E2E_LIGHT=1` adds light and only the gallery walk asks for it.
  `CUBIT_E2E_WORKERS` and `CUBIT_VERIFY_SLOTS` are the engine's sizing. Viewport 1440x900, reduced
  motion, fonts ready; `settled(page)` before every axe run and capture; `checkpoint()` attaches the
  capture and runs axe (serious/critical fail; moderate held to `tests/e2e/support/axe-budget.ts`;
  a screen's height to `tests/e2e/support/height-budget.ts`, which may only fall).
- A journey signs in with `signInAsSeededTenant` (`tests/e2e/support/seeded-session.ts`) and stages
  its own screen (J-0xx). J-000 is the golden path: `tests/e2e/journeys/j-000/<cp>-<leg>.spec.ts`,
  its roster derived from the Bible's text; a leg clicks what a customer clicks and stages nothing.
- A read asserts a RENDERED contract (`data-state`, `data-rows-rendered`, `data-rendered-region`)
  through `tests/e2e/support/retrying-read.ts` after `settled()`; one page object per screen under
  `tests/e2e/pages/`; `.count()`/`.all()` on a virtualised table is not an assertion;
  `waitForTimeout` is unlawful (`cubit/no-unretried-read`). A flake is a defect with a cause.
- `test.skip` never; `test.fixme` only where `tests/journeys/fixme-roster.test.ts` admits it, on the
  J-000 roster (`tests/journeys/j-000-roster.test.ts`), opening with `MISSING DOOR:`, deleted by the
  door's own increment. `pnpm e2e:clean` takes away the lane's leavings.
- Ceilings are law: V-VERIFY ≤ 60 s, V-E2E ≤ 12 min, V-GOLDEN ≤ 3 min, ≤ 90 s a journey (J-000 carries
  its own budget). Performance assertions live only in PERF- specs (`pnpm test:perf`).
- The toolchain is pinned save-exact (Typst 0.15.1, exceljs 4.4.0; `pnpm checkup` refuses drift). No
  session has web access; moving a pin is a `toolchain`-tagged increment.

## What the hooks admit
- Scratch: `mcp__builder__scratch_dir` is the writable directory. `rm -rf` also takes this lane's
  regenerable output by RELATIVE path (`.next*/`, `dist/`, `coverage/`, `.turbo/`, `.vite/`,
  `*.tsbuildinfo`); an absolute path is refused. Heredoc and `python - <<` writes are opaque and denied.
- Runs are by name in the lane the suite belongs to (`pnpm vitest run <files>`); the gate's lanes go
  through `mcp__builder__check` (`unit` → `types` → the bare call for eslint on your changed files →
  `journeys`; `db` when db/** moved, `checkup` when the toolchain moved; `{ "full": true }` once) — a
  raw `pnpm verify`, `pnpm test:db` or `pnpm checkup` by shell is denied.
- A Bash output over 6,000 chars arrives compacted (head, tail, every verdict line, the scratch file
  holding the whole) — read the file, don't re-run.
- A failed Edit means your copy is stale: re-Read the region and edit from it; a whole-file Write to
  get around it is SCOPE_CREEP.
- A restore names explicit files (`git checkout main -- <file>`, chained if several); `.`, a
  directory or a glob is refused. `next build` appends a dist dir to `tsconfig.json`: restore it or
  leave it, never hand-edit; `next-env.d.ts` is untracked build output — never commit or restore it. A config change is lawful only
  under a `toolchain` tag or an approved spec naming the path.
- The cad lane: `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` and
  `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input.
- History is append-only: a landed migration is superseded, never edited.
- Locked to every session: `docs/specs/**`, `.claude/**`, this file, `.builder-heldout/**`
  (the Verifier's), the toolchain scripts and CI unless owned. A debt sweep's worklist is
  `mcp__builder__debt_rows`; fix each row where it lives, test beside it.

## Compact instructions
When this session's context is compacted, the summary must carry, verbatim where it can: the
increment id and every acceptance criterion id with its current verdict (green, red, untouched);
every file changed so far and why, one line each; the lanes asked through `mcp__builder__check` and
their last verdicts; the open questions and objections; the exact next step. Never a narrative of
the work. The session continues after the summary — the Handoff is for the end of the work only.

<!-- builder:lessons:start -->
<!-- builder:lessons:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
