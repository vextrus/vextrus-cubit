# The CUBIT toolchain

Increment zero delivers the toolchain and nothing else (C-06 as amended by
AM-02, B-15). The gate's own instruments are born before the gate arms, so that
the locks have something to hold and no later increment has to fight its own
scaffolding.

This document is the paper half of that: the pins that are not expressible in
`package.json`, and the rules by which the gate's stages arm themselves.

## Pinned runtimes

| Tool     | Pin           | Where it is recorded                    |
| -------- | ------------- | --------------------------------------- |
| Node     | 24            | `.nvmrc` — one line, read by CI          |
| pnpm     | 10.34.5       | `package.json` `packageManager`, via corepack |
| uv       | 0.12.5        | `cad/pyproject.toml` `[tool.uv] required-version` |
| Python   | ==3.13.\*     | `cad/pyproject.toml` `requires-python`    |
| ruff     | 0.16.4        | `cad/pyproject.toml`, locked in `cad/uv.lock` |
| pytest   | 9.1.1         | `cad/pyproject.toml`, locked in `cad/uv.lock` |
| typst    | 0.15.1        | this file (see below)                    |
| LibreDWG | 0.13.4        | this file (see below)                    |

Every JavaScript dependency in `package.json` is an exact version — no `^`, no
`~` — and `pnpm-lock.yaml` is committed, so `pnpm install --frozen-lockfile`
installs the same bytes on the dev machine and in CI.

The uv pin is mechanical rather than documentary (B-05): `required-version`
makes uv itself refuse to run when the uv on `PATH` is not `0.12.5`, so the
resolver that produced `cad/uv.lock` is the resolver every machine uses.
`pnpm checkup` reads that same line and reports the mismatch at session start
instead of leaving it for the first `cad-ruff` failure; `.github/workflows/
ci.yml` names the version on `setup-uv`, the one place CI cannot read the tree.

### typst 0.15.1

Typst is not an npm package and is not installed by this increment; the
document increment installs it and arms `checkup: typst`. The pin is a release
artefact and a digest, so that installation is verifiable rather than trusting:

```
version: 0.15.1
artefact: typst-x86_64-unknown-linux-musl.tar.xz
url: https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz
sha256: a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c
```

Verify with `sha256sum typst-x86_64-unknown-linux-musl.tar.xz` before unpacking.

### LibreDWG 0.13.4

LibreDWG reads DWG for the drawing lane. The 0.13 line is pinned deliberately:
0.14 is the moving upstream head, and a DWG reader that changes under a
regression corpus is a reader whose output nobody can reproduce.

```
version: 0.13.4 (upstream tag 0.13.4.8043)
artefact: libredwg-0.13.4.8043.tar.gz
url: https://github.com/LibreDWG/libredwg/releases/download/0.13.4.8043/libredwg-0.13.4.8043.tar.gz
sha256: 149d61ecd463a1f4e203c667ff22072c41419f66d035d3dd8236e3048d2137e5
```

The CAD increment builds it and arms `checkup: libredwg`.

## `pnpm verify`

Fail-fast; the exit code is the whole contract; the wall time is printed. Every
contract line is written to stdout, so `pnpm verify 2>/dev/null` still carries
the entire roster and the verdict — a failing stage's own output is diagnostics
and goes to stderr.

The roster, in order, with the input root that arms each stage:

| Stage             | Input root            | Armed today |
| ----------------- | --------------------- | ----------- |
| `typegen`         | `src/app`             | no          |
| `tsc`             | — (always)            | yes         |
| `eslint`          | — (always)            | yes         |
| `vitest`          | — (always)            | yes         |
| `db-drift`        | `db/schema`           | no          |
| `method-hashes`   | `src/core/methods`    | no          |
| `catalogue-drift` | `src/core/catalogue`  | no          |
| `cad-ruff`        | — (always)            | yes         |
| `cad-pytest`      | `cad/tests`           | no          |
| `build`           | `src/app`             | no          |

A stage whose input root is absent prints `verify: <stage> SKIP
LANE_NOT_YET_BUILT`. It is never silently passed, and arming is never a config
flag or an environment variable: the tree decides. `cad-pytest` is a stage of
its own precisely because pytest exits 5 — not 0 — when it collects no tests,
so the empty `cad/tests` must skip rather than run.

### Stages that are armed but not yet wired

`db-drift`, `method-hashes`, `catalogue-drift` and `build` carry no command in
this increment, and the roster records that as `command: null`: the stage arms
on its input root like every other, and being armed without a command is a
`FAIL` with a recorded reason, never a pass. A command that cannot do its job
would be worse than none, because it would answer `ok`:

- `db-drift` — V-VERIFY's check is "generate into scratch and compare with the
  committed migrations". `drizzle-kit generate` into a scratch `--out` has no
  journal to compare against, regenerates the whole schema and exits 0 whether
  the tree has drifted or not. The scratch directory is `.cubit-scratch/`,
  gitignored, so that when the check is written it leaves the tree as it found
  it.
- `method-hashes` — the manifest is a file that does not exist yet;
  `scripts/method-hashes.mjs` is the skeleton C-06 asks for.
- `catalogue-drift` — there is no catalogue table to drift from.
- `build` — V-VERIFY wants a cold build in a distDir of its own, never the dev
  server's `.next`. Next reads `distDir` from `next.config` and from nowhere
  else: there is no CLI flag and no environment variable. So the command
  belongs to the increment that lands `src/app` and its `next.config`, where
  `distDir: '.next-verify'` can be written; `.gitignore` already carries
  `.next-verify/` for it.

Wiring any of these is a toolchain change, and C-06 already requires the
increment that lands the input to be tagged `toolchain` and to name the files.

`.github/workflows/ci.yml` runs the whole determinism chain on a fresh
checkout, in order: `pnpm install --frozen-lockfile`, `pnpm verify`, an empty
`git status --porcelain --untracked-files=all`, then a *second* `pnpm verify`
whose roster must match the first line for line with the durations blanked.
The second pass is the part a single run cannot show: a stage that cached
something into the tree, or that decides its verdict from the state a previous
run left behind, is green once and different twice. The logs are written under
`$RUNNER_TEMP`, never beside the tree, so the porcelain check answers for
verify alone.

## `pnpm checkup`

The machine's report, run at session start. One line per item, then `checkup:
ok`; any `FAIL` makes the exit code nonzero and suppresses the final line.

| Item       | Armed today | What arms it                        |
| ---------- | ----------- | ----------------------------------- |
| `node`     | yes         | —                                   |
| `pnpm`     | yes         | —                                   |
| `uv`       | yes         | —                                   |
| `typst`    | no          | the document increment installs it  |
| `libredwg` | no          | the CAD increment builds it         |
| `postgres` | no          | the schema increment                |
| `ports`    | no          | the dev-server and e2e increments   |
| `storage`  | no          | the storage root increment          |
| `env`      | no          | the first increment with an env contract |

## The guardrail registry

B-05: every guardrail that matters is mechanical. Each Bible NEVER below is an
ESLint rule at severity `error` with a committed fixture pair proving it fires
on `bad.*` and stays silent on `good.*`.

| Fixture directory        | Rule                                | Fires on                                                       | Clause      |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------- | ----------- |
| `no-float-arithmetic`    | `cubit/no-float-arithmetic`         | fractional numeric literal or `parseFloat` outside `src/core/units.ts` | B-07  |
| `format-seam-only`       | `cubit/format-seam-only`            | `Intl` / `toLocale*` / `localeCompare` outside `src/core/format.ts`, and `en-BD` anywhere | L-FMT-01 |
| `model-seam-only`        | `cubit/model-seam-only`             | model-SDK import outside `src/core`                             | L-AI-01     |
| `db-seam-only`           | `cubit/db-seam-only`                | driver or `db/schema` import outside `src/core/db.ts`           | SEAM-TENANT |
| `no-colour-literal`      | `cubit/no-colour-literal`           | hex/rgb/hsl/oklch literal, or a `0xRRGGBB(AA)` number, outside `src/ui/tokens.ts` | R-UI-001    |
| `no-jsx-string-literal`  | `cubit/no-jsx-string-literal`       | string rendered in JSX — as text, in `{braces}`, or in a user-facing attribute — except test ids and codes | R-SPINE-060 |
| `no-conversion-literal`  | `cubit/no-conversion-literal`       | a unit-canon constant outside `src/core/units.ts`               | L-FRM-06    |
| `no-suppressions`        | `cubit/no-suppressions`             | a lint-disable directive or a type-error suppression comment    | Q-08        |
| `no-skip-only`           | `cubit/no-skip-only`                | `.skip`/`.only` on a test or describe                           | Q-08        |
| `no-explicit-any`        | `@typescript-eslint/no-explicit-any`| explicit `any`                                                  | Q-08        |

### The recorded reason for the fixtures themselves

Q-08 forbids the suppression comments, the `.skip`/`.only` markers and `any`
*in a change without a recorded reason*, and a structural diff of a change
reads text: it cannot tell a suppression from a fixture that proves a
suppression is caught. This increment holds those constructs at exactly three
sites, each carrying the recorded reason `GUARDRAIL_FIXTURE` in its header and
again on the line itself. Three lines in the whole increment hold a construct —
one per Q-08 rule, the floor AC-2 sets, since a rule with no committed bad
fixture has nothing to fire on:

| Site                                          | Lines | Construct                          | Recorded reason                                                  |
| --------------------------------------------- | ----- | ---------------------------------- | ---------------------------------------------------------------- |
| `tests/lint-fixtures/no-suppressions/bad.ts`  | 1     | a blanket lint disable              | AC-2: `cubit/no-suppressions` must report this file as an error   |
| `tests/lint-fixtures/no-skip-only/bad.ts`     | 1     | a skipped suite                     | AC-2: `cubit/no-skip-only` must report this file as an error      |
| `tests/lint-fixtures/no-explicit-any/bad.ts`  | 1     | one annotated parameter             | AC-2: `@typescript-eslint/no-explicit-any` must report this file  |

Each rule has branches those three lines do not cover — the type-error
suppression comments, the one-line disable, the exclusive marker, the bracket
form. They are proved in `tests/lint-fixtures/guardrails.test.ts` by linting
source assembled at run time (`['eslint','disable'].join('-')`, `` `@ts-${word}`
``) at the fixture's own path, so the branch is enforced without the change
containing the text. That is why the fixtures hold one construct each and not
six: a committed line is a line in the diff, an assembled string is not.

B-05 requires each NEVER to be a lint rule *with a fixture test that proves it
fires*, and a fixture that proves a rule fires on a directive can only do so by
containing that directive. That is not an argument on paper: strip the
constructs from those three files and three AC-2 rows of
`tests/toolchain/guardrail-registry.test.ts` and
`tests/lint-fixtures/guardrails.test.ts` go red with "said nothing about
`bad.ts`". Nowhere else in the increment is a construct spelled — not the rule
that forbids it (it assembles the directives from their parts), not the
registry table above, not this paragraph: they name the constructs by
category. `tests/lint-fixtures/q08-confinement.test.ts` is the mechanical form
of this section (B-05: prose is not enforcement) — it walks the toolchain
surface and fails if a Q-08 construct appears at any site other than the three
listed here.

None of the three sites is a suppression in effect: they are config-ignored
from `eslint .`, excluded from `tsc` by `tsconfig.json`, never imported, never
collected by Vitest, and `linterOptions.noInlineConfig` means the directives in
them switch nothing off even when the probe reads them.

`eslint.config.mjs` ignores `tests/lint-fixtures/**` globally, because the bad
fixtures would otherwise make `eslint .` — and therefore `pnpm verify` —
permanently red. The probe opts back in:

```
pnpm exec eslint --no-ignore tests/lint-fixtures/no-float-arithmetic/bad.ts   # nonzero
pnpm exec eslint --no-ignore tests/lint-fixtures/no-float-arithmetic/good.ts  # zero
```

Two scoping decisions worth stating, because neither is obvious from the clause
alone:

- The seam rules are pre-wired to `src/**` and `db/**` and match nothing today.
  They arm themselves the moment a later increment lands product code — no
  config change, no list to keep in step.
- `src/core/units.ts` is exempt from `cubit/no-conversion-literal`, and from
  the *literal* half of `cubit/no-float-arithmetic`. L-FRM-06 requires the
  canon — `0.3048`, `0.028316846592`, `0.09290304`, `0.45359237`, kg/MT — to
  live there as exact constants, so a float rule that fired on them would
  forbid the one place the Bible demands floats and make the first increment to
  write the canon fight the gate (B-15). The exemption stops exactly there:
  `parseFloat` and `Number.parseFloat` are reported inside `src/core/units.ts`
  like anywhere else, because the canon is a set of written constants and
  parsing is how a user's typed quantity becomes a binary float in the one file
  every quantity passes through (B-07). `tests/lint-fixtures/guardrails.test.ts`
  proves both halves, by linting text at that filename — no fixture file can
  sit at a seam path this increment does not deliver.
- `cubit/db-seam-only` is scoped to `src/**` only. `db/**` *is* the schema, so
  banning the schema import there would ban the schema from itself; inside
  `src/**`, `src/core/db.ts` exempts itself.

`linterOptions.noInlineConfig` is on for the whole tree. A suppression comment
therefore cannot switch a guardrail off before `cubit/no-suppressions` reports
it (Q-08).

## The lane scripts

`package.json` defines the full scripts block. Every lane whose input does not
exist yet prints `<script>: SKIP LANE_NOT_YET_BUILT` on stdout and exits 0:
`dev`, `build`, `start`, `worker`, `test:db`, `e2e`, `test:golden`,
`test:docs`, `test:perf`, `db:migrate`, `db:drift`, `seed`, `gen:fixtures`,
`traceability`. Only `verify` and `checkup` do work in this increment.

Turning one of those stubs into a real lane is a toolchain change: C-06 allows
it only on an increment whose spec is tagged `toolchain` and names
`package.json` and the script file it replaces.

## Changing this toolchain

Gate stages arm progressively across the foundation series, of which increment
zero is the first: a lane whose input root does not exist yet is skipped with
the recorded reason `LANE_NOT_YET_BUILT`, never silently passed. From the end
of that series — after tokens, primitives, the shell and the auth scaffold have
landed — every stage is armed (C-06 as amended by AM-02, B-15).

The lock on this toolchain does not wait for that. It is already in force: a
change to any file listed here rides only on an increment whose spec is tagged
`toolchain` and names the files it touches. Arming is what the roster does as
inputs appear; locking is what governs edits to the roster itself, and only the
first of the two is progressive.
