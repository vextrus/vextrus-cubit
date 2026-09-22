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
- The Bible is the default reading: take the most defensible reading and record an Interpretation.
  Its `<amendments>` are current law, read with the clauses they affect (AM-01/02/03 fixtures,
  junctions, rebar; AM-08/09/10/11 UX standard, test surface, gate budgets, split registries).
  **The owner's ruling of session 6: the Bible is a default, not a cage.** Where testing, measurement
  or research shows a clause wrong, stale, self-contradictory or harmful to the product, depart from
  it and record a Deviation in `docs/decisions/deviations.md` in the same commit — the clause, the
  evidence, what the product does instead, what it costs. A Deviation is never silent, never edits
  `docs/specs/**`, and never loosens a proof to pass a gate.
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

## Standing facts from sessions 5 and 6 (the owner asked for them here; the handoffs hold the proofs)
- The M3 door stands on F-RCC6-BNBC: a viewport's title captions its model-space region (I-290),
  block bubbles georeference (I-292), `EL` marks propose the stack (I-293), the stacked schedule
  reads (I-294), a feet-and-inches dimension scales a unitless header (I-295), a band written in
  ordinal words covers the stack's floor labels (`sameStorey`), and the unit a drawing DECLARES is
  the last word on a unitless section (I-302). Session 6 added: a plan note naming a mark is evidence
  about the MEMBER (I-303 — read only where its remainder states a shape or a `STARTS`-bounded range;
  C7 → GF alone, C5 minted on 1F..6F), the plan states a column's SHAPE and the schedule its SIZE
  (I-304), and a circular column is PRISM_POLY billed by `rcc.column.circular.concrete@1` (I-305;
  edition IS1200_IN @ 2027.03, migration 0056).
- **The register still ignores the notes, and the cause is named**: `src/core/acts/author-typical-range.ts`
  is a THIRD spelling of the expansion — it reads `placements` raw, re-does the band cut, never reads
  a note, and registers objects that are never retracted. So the journey measures 189 column lines /
  94.196 m³ where the doors give 182 / 90.83. `m3-bill-and-schedules` stays fixme until that lands AND
  its leg does: the BBS test moves to its own file (blocked by the rebar schedule reader,
  `REBAR_SCHEDULE_UNREAD`), and the band admits the document's own rounding, `(n + 1) × ½ulp`, because
  the XLSX states each line to 3 dp and the golden rounds each cell once.
- `stack` and `mark` are two namespaces that both spell `C<n>` (mark C7 = stack C7X, mark C5 = stack
  B4). Two spellings of one fact are the defect to look for first: session 6 found six (a test stage
  calling the tabs-row hook for an effect it no longer has, `MEMBER_SHAPES`, `SEED_VERSION` in four
  places, the typical-range act, the Noul-confidence contract, the model ledger's rates). A reader
  that answers nothing over a drawing it should read: diff the keys.
- A screen fills the lane's tabs row by a portal in place (`useTakeoffTabsAside` answers a node the
  surface RENDERS); the frame's own slots still hand over by effect and are the next defect of that
  class. Hydration stands the register twice for ~100 ms; nothing may depend on mount order.
- Read the run's own database after a journey (`cubit_e2e`, `set cubit.system_reason` first), never
  while the db lane runs, and SCOPE every query to the project — the database holds every earlier
  run. A killed run keeps no trace (`CUBIT_E2E_TRACE=on`); the M3 staging caps every action at a
  minute (`capActions`). The run file records no password: `j000-legs-<stamp>@cubit.test` signs in
  with `golden-path-legs-<stamp>`. `pnpm probe signin …` takes no `--`.
- Jev: a Noul states a probability and NO confidence; a call's confidence is the minimum over the
  answers that state one (`7689a117`). The corpus (240 fixtures) stores the judgment the seam DERIVED,
  not the provider's body, so no change to how an answer is read is provable against it and the
  recorded schedule-cell line reads 0.01–0.18 until re-recorded. The model ledger's rates
  (`model-ledger.types.ts`: $15/$75, $3/$15) are the product's own — AS-05 names ids, not rates — and
  are wrong against the published $5/$25 and $2/$10.
- A fan-out is a heavy lane while the gate's e2e or perf lanes run (PERF-011's instrument is coarsened
  to 0.1 ms with a half-tick tolerance). A fast green is read with `--reporter=verbose` before it is
  trusted. The served product binds 127.0.0.1; from Windows under WSL2 NAT it needs a relay on the WSL
  address (`socat TCP-LISTEN:3211,bind=<wsl-ip>,fork,reuseaddr TCP:127.0.0.1:3211`) or mirrored
  networking. The builder MCP tools have been absent in every interactive session: lanes run by shell.

## Compact instructions
When this session's context is compacted, the summary must carry, verbatim where it can: the
increment id and every acceptance criterion id with its current verdict (green, red, untouched);
every file changed so far and why, one line each; the lanes asked through `mcp__builder__check` and
their last verdicts; the open questions and objections; the exact next step. Never a narrative of
the work. The session continues after the summary — the Handoff is for the end of the work only.

<!-- builder:lessons:start -->
<!-- builder:lessons:end -->
