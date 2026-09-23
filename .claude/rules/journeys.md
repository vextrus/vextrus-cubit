---
paths:
  - "tests/e2e/**"
  - "playwright.config.ts"
  - "scripts/e2e*.mjs"
  - "scripts/probe/**"
  - "tests/journeys/**"
---
# Journey law (V-E2E, J-000)

- The journey lane is dark; `CUBIT_E2E_LIGHT=1` adds light and only the gallery walk asks for it.
  Viewport 1440x900, reduced motion, fonts ready; `settled(page)` before every axe run and capture;
  `checkpoint()` attaches the capture and runs axe (serious/critical fail; moderate held to
  `tests/e2e/support/axe-budget.ts`; a screen's height to `tests/e2e/support/height-budget.ts`, which may
  only fall).
- A journey signs in with `signInAsSeededTenant` (`tests/e2e/support/seeded-session.ts`) and stages its
  own screen (J-0xx). J-000 is the golden path: `tests/e2e/journeys/j-000/<cp>-<leg>.spec.ts`, its roster
  derived from the Bible's text (AM-17's rider names the M3 and M4 segments); a leg clicks what a
  customer clicks and stages nothing.
- A read asserts a RENDERED contract (`data-state`, `data-rows-rendered`, `data-rendered-region`)
  through `tests/e2e/support/retrying-read.ts` after `settled()`; one page object per screen under
  `tests/e2e/pages/`; `.count()`/`.all()` on a virtualised table is not an assertion; `waitForTimeout` is
  unlawful (`cubit/no-unretried-read`). A flake is a defect with a cause.
- **Hydration**: a control the server painted is not live until the client hydrates, and `settled()`
  does not read hydration. After a full load (`page.goto`, `window.location.assign`) a click waits for a
  fact only the client renders, such as the page crumb a screen claims (`c94b9dc7`). A lost click reads
  as a write that never reached the store.
- `test.skip` never; `test.fixme` only where `tests/journeys/fixme-roster.test.ts` admits it, on the J-000
  roster, opening with `MISSING DOOR:`, deleted by the door's own increment.
- Baselines: a picture a lawful change moved is re-taken by `pnpm e2e:retake` (dry run, read the bands:
  uniform anti-aliasing noise means the browser moved, a local change is a defect; then `-- --write`),
  committed alone under a `baseline:` subject naming the proving run. Never `--update-snapshots`.
- Ceilings: V-E2E ≤ 12 min, ≤ 90 s a journey (J-000 carries its own budget). Performance assertions
  live only in PERF- specs (`pnpm test:perf`).
- No journey walks while the demo stands (its worker takes the journeys' jobs): `pnpm e2e` refuses, and
  `pnpm demo --stop` is the remedy. A killed run keeps no trace (`CUBIT_E2E_TRACE=on`); the M3 staging
  caps every action at a minute (`capActions`). `pnpm e2e:clean` takes the lane's leavings.
- The run file records no password: `j000-legs-<stamp>@cubit.test` signs in with
  `golden-path-legs-<stamp>`. `pnpm probe signin …` takes no `--`.
- Worktree agents cannot run e2e (Turbopack refuses the symlinked `node_modules`).
