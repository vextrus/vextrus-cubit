---
name: lanes
description: Run and read Vextrus Cubit's verification lanes — verify, unit, db, golden, e2e, J-000, perf, checkup and the whole gate — with their ceilings, their collisions, how to run them in the background and read their verdict lines, and what to do when one goes red. Use before running any lane, and whenever a lane's result must be reported.
---
# The lanes

| Command | What | Ceiling / typical |
|---|---|---|
| `pnpm verify` | typegen → TS7 types → eslint → unit → schema/method/catalogue drift → golden → cad (6 workers) → build, in waves; prints `LANE <id> <s>` | ≤ 60 s (V-VERIFY) |
| `pnpm vitest run <files>` | one or a few unit suites (no database) | — |
| `pnpm test:db [files]` | live Postgres suites, template per file; batch then drift-lane-breaker alone | ≤ 5 min |
| `pnpm test:golden` | goldens + cad recompute | ≤ 3 min |
| `pnpm e2e [--journeys J-0xx,…]` | builds once, serves 3211 + worker, Playwright; no arg = the sweep without J-000 | ≤ 12 min, ≤ 90 s a journey |
| `pnpm e2e --journeys J-000` | the golden path, every milestone leg | its own budget |
| `pnpm test:perf` | PERF- specs only (PB-1…PB-7) | ≤ 10 min |
| `pnpm checkup` | machine pins and health | — |
| `pnpm gate` | verify → checkup → golden → db → e2e → e2e-j000 → perf; `--only a,b` | ~9 min; last verdict kept in `node_modules/.cache/cubit/gate/summary.txt` |

**Collisions (each refuses by itself):** the db lane never runs beside a served product (3210 dev,
3211 journeys/probe, 3213 demo); no journey walks while the demo stands; one served product at a time.
`pnpm demo --stop`, `pnpm probe:server --stop`, and wait until `node scripts/harness/state.mjs` reads the
ports free (Windows' TIME_WAIT holds a port ~20 s after a run). A fan-out of agents is a heavy lane
while the gate's e2e or perf lanes run — don't overlap them.

**Running long lanes:** `run_in_background: true`, then a Monitor on the log for verdict lines
(`LANE `, `GATE `, `FAIL`, `wall-time`, `passed`, `failed`). Quote a lane's own verdict line when you
report it; never time a lane by hand. A fast green is read with `--reporter=verbose` before it is
trusted. The gate's lane logs are under `node_modules/.cache/cubit/gate/<lane>.log`.

**Red:** read the lane's own log from the first failure, reproduce it with the narrowest command, find
the cause (a flake is a defect with a cause, never a retry), fix it where it lives with a test beside it.
Known shapes: a verify over 60 s right after a reboot is cold caches (read the next); a build that is
cold after every journey means a runtime path is traced as a build input (annotate it
`/* turbopackIgnore: true */` and read the build's own warnings); a lost click after a full load is
hydration (wait for a client-only fact); db reds in a source-mutating window are the drift lock.
Met in session 8: a build that panics `TurbopackInternalError … was canceled` on the SAME task id every
retry is a persistent cache a failed build poisoned — set `.next-cubit/cache/turbopack` aside and
rebuild cold; `checkup` red on "cubit_dev migration drift" after new migrations is `pnpm db:migrate:dev`;
the perf lane deletes `test-results/`, so re-run the journeys before `pnpm e2e:retake` after a gate.
Every picture is `expect.soft(page).toHaveScreenshot(…)` (session 8's close): one run reports every
moved picture of a walk, where a hard one hid each next checkpoint until the one before was re-taken
(three gates lost to it). A new picture is written soft; the AC-3 guard and the roster count it.

**Pictures:** a baseline a lawful change moved is re-taken with `pnpm e2e:retake` (dry run first, read
the bands) and committed alone under a `baseline:` subject naming the proving run.

**Before a commit that claims green:** the lanes the change touches, then `pnpm gate` once for anything
that can move a served screen, a stored figure or the toolchain. Commit, then `sync` (the after-bash hook
does it for you).
