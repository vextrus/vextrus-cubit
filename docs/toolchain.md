# The toolchain

inc-000 of the foundation series delivers the complete toolchain surface and nothing else
(C-06 as amended by AM-02, B-15). The gate's own toolchain is born before the gate arms;
from the end of the foundation series every stage is armed, and a later change to anything
in this document rides an increment whose spec is tagged `toolchain` and names the files.

## Pins

Everything below is exact. `pnpm` is exact via `packageManager` and corepack; every
dependency in package.json is a bare version with no `^` and no `~`; Python is pinned by
`requires-python` and resolved by `cad/uv.lock`.

| Tool | Pin | Where it is recorded |
| --- | --- | --- |
| Node.js | 24 | `.nvmrc` (single line), `engines.node` |
| pnpm | 10.34.5 | `package.json` → `packageManager`, activated by corepack |
| TypeScript | 6.0.3 | `package.json` → devDependencies |
| Next.js | 16.3.1 | `package.json` → dependencies |
| React | 19.2.8 | `package.json` → dependencies |
| Vitest | 4.1.11 | `package.json` → devDependencies |
| ESLint | 10.8.1 + typescript-eslint 8.67.0 | `package.json` → devDependencies |
| Playwright | 1.62.1 | `package.json` → devDependencies |
| Python | 3.13 (`>=3.13,<3.14`) | `cad/pyproject.toml`, resolved in `cad/uv.lock` |
| ruff | 0.16.4 | `cad/pyproject.toml` dev group |
| pytest | 9.1.1 | `cad/pyproject.toml` dev group |
| uv | not version-pinned | it is the bootstrapper; what it installs is pinned by `cad/uv.lock` |

`package.json` declares `pnpm.onlyBuiltDependencies` as an empty list: pnpm 10 blocks
postinstall scripts by default, and stating that explicitly makes it a decision rather than
a default. Nothing in this stack needs its own build step — esbuild and the rest ship
prebuilt platform binaries — so an install is the same install every time. A package that
genuinely needs one is added to that list by name, in the increment that needs it.

### Binaries this increment does not install

Typst and LibreDWG are subprocesses the document and DWG lanes call. Neither lane exists
yet, so neither binary is installed here — but a pin is a version *and* a hash, or the
machine cannot check it, so both are recorded now and `pnpm checkup` reports them with the
recorded reason `LANE_NOT_YET_BUILT` until the increment that installs them arms the item.

- **Typst 0.15.1** — `typst-x86_64-unknown-linux-musl.tar.xz` from the upstream release,
  sha256 `a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c`.
- **LibreDWG 0.13.4.8043** — `libredwg-0.13.4.8043.tar.xz` from the upstream release,
  sha256 `e2b206ddc2d82e197f75cc30d1c304bd2b70985673fb74e9931b08855a581a32`, built
  `--enable-release` and called as a subprocess (two-pass, audited).

## `pnpm verify`

Fail-fast. The exit code is the whole contract, and every contract line is on stdout, so
`pnpm verify 2>/dev/null` still reads the whole roster. A stage prints exactly one line:

```
verify: <stage> ok (<N>ms)
verify: <stage> SKIP LANE_NOT_YET_BUILT
verify: <stage> FAIL (<N>ms)
```

and a green run ends `verify: ok (<S>s)`. What a stage says for itself is captured and
re-emitted on stderr; the gate reports stderr after stdout, so mixing the two would read
out of order.

| # | Stage | Input root | Armed today | Command |
| --- | --- | --- | --- | --- |
| 1 | typegen | `src/app` | no | `next typegen` |
| 2 | tsc | — | yes | `tsc --noEmit` |
| 3 | eslint | — | yes | `eslint .` |
| 4 | vitest | — | yes | `vitest run` |
| 5 | db-drift | `db/schema` | no | `drizzle-kit generate` into `.scratch/db-drift` |
| 6 | method-hashes | `src/core/methods` | no | `scripts/method-hashes.mjs` |
| 7 | catalogue-drift | `src/core/catalogue` | no | not wired — see below |
| 8 | cad-ruff | `cad` | yes | `uv run --frozen ruff check .` |
| 9 | cad-pytest | `cad/tests` | no | `uv run --frozen pytest -q` |
| 10 | build | `src/app` | no | `next build` into `.next-verify` |

**Arming is a directory question and nothing else** — never a config flag, never an env
var. A stage arms when its input root exists as a directory, so an increment arms a lane by
delivering it, not by declaring it. Two consequences worth stating:

- `cad-pytest` is a stage of its own rather than part of `cad-ruff` because pytest exits 5
  when it collects no tests; the empty `cad/tests` is what keeps the lane skipped, and
  ruff's zero-file run is honestly green.
- `catalogue-drift` has no command yet. If `src/core/catalogue` appears before one is
  wired, the stage arms and **fails**, loudly, rather than passing on nothing. Same for
  `method-hashes`. That is C-06's "never silently passed" applied to the gate's own gaps.

## `pnpm checkup`

The machine's report, at session start. Every item is read before a conclusion is drawn —
checkup does not fail fast — but it never ends `checkup: ok` after a FAIL, and it exits
nonzero. Armed: node, pnpm, uv. Skipped with the recorded reason: typst, libredwg (not
installed here), postgres, ports, storage, env (no roles, no storage root and no env
contract are defined until the database and e2e increments define them; a green light for
an undefined machine state asserts nothing).

## The lane stubs

Every script but `verify` and `checkup` prints `<script>: SKIP LANE_NOT_YET_BUILT` on
stdout and exits 0. They skip unconditionally, not by input root: C-06 makes flipping a
stub into a real lane an increment whose spec is tagged `toolchain` and names package.json
and the script, and a stub that self-armed would let a lane go live without it.

## The guardrail registry

Every NEVER is a named rule with a committed fixture that proves it fires (C-06, B-05,
Q-01). `eslint .` globally ignores `tests/lint-fixtures/*/`, because those files are broken
on purpose; `--no-ignore` re-includes them, and one config block per row binds that row's
rule to its directory.

| Fixture directory | Rule | Fires on | Clause |
| --- | --- | --- | --- |
| `no-float-arithmetic` | `cubit/no-float-arithmetic` | fractional numeric literal, parseFloat | B-07 |
| `format-seam-only` | `cubit/format-seam-only` | `Intl`, locale-aware string methods, the `en-BD` tag outside `src/core/format.ts` | L-FMT-01 |
| `model-seam-only` | `cubit/model-seam-only` | a model SDK imported outside `src/core` | L-AI-01 |
| `db-seam-only` | `cubit/db-seam-only` | driver or schema import outside `src/core/db.ts` | SEAM-TENANT |
| `no-colour-literal` | `cubit/no-colour-literal` | hex/rgb/hsl/oklch literal outside `src/ui/tokens.ts` | R-UI-001 |
| `no-jsx-string-literal` | `cubit/no-jsx-string-literal` | copy rendered in JSX; test ids and codes exempt | R-SPINE-060 |
| `no-conversion-literal` | `cubit/no-conversion-literal` | a canon conversion factor outside `src/core/units.ts` | L-FRM-06 |
| `no-suppressions` | `cubit/no-suppressions` | a lint suppression or compiler-silencing comment | Q-08 |
| `no-skip-only` | `cubit/no-skip-only` | an excluded or exclusive test marker | Q-08 |
| `no-explicit-any` | `@typescript-eslint/no-explicit-any` | an explicit `any` annotation | Q-08 |

The config sets `noInlineConfig`, so **no comment in this tree can turn a rule off**.
Without it the guardrail has a hole exactly where it matters: a blanket suppression at the
top of a file silences every rule in that file, including the rule that reports
suppressions — which would report on the comment and then be suppressed by it.

Four scoping decisions, recorded so they are not re-argued:

1. **`cubit/db-seam-only` binds to `src/**` only.** `db/**` is the schema, and banning the
   schema import there would ban the schema from importing drizzle to define itself. The
   other seam rules bind to both.
2. **kg/MT is the integer 1000**, which is also a timeout and a page size. It is reported
   only as an operand of `*` or `/`, where it reads as a conversion. The four exact
   decimals are reported wherever they appear. A rule that fired on every 1000 would be
   switched off within a week, which is how a mechanical guardrail becomes prose.
3. **A "code" is the machine's vocabulary, not a short word.** `LANE_NOT_YET_BUILT` and
   `R-UI-001` are codes and may be rendered verbatim; `SAVE`, `OK` and `PAID` are copy in
   upper case and belong in the string table (R-SPINE-060).
4. **`.npmrc` sets `shell-emulator=true`.** pnpm then runs a script through its own shell
   rather than the machine's `/bin/sh`, so a script is the same command everywhere and
   running one does not depend on what the ambient PATH contains — which `pnpm checkup`
   has to be able to vary in order to report on the machine at all. The same file sets
   `save-exact`, so a later `pnpm add` cannot quietly unpin the stack.

## RECORDED REASON — where a Q-08 construct is allowed to exist

Q-08 forbids a suppression, a compiler-silencing directive, an excluded or exclusive test
and an explicit `any` "in a change without a recorded reason". Delivering the guardrails
means proving each one fires against the real construct, so exactly three files in this
tree contain one, each on a single line that carries the marker `RECORDED REASON
GUARDRAIL_FIXTURE`:

- `tests/lint-fixtures/no-suppressions/bad.ts` — one lint suppression comment.
- `tests/lint-fixtures/no-skip-only/bad.ts` — one excluded suite.
- `tests/lint-fixtures/no-explicit-any/bad.ts` — one loosely typed parameter.

Everywhere else — the rules that forbid these constructs, this document, the tests — the
constructs are assembled from parts at run time or named by category, never spelled. The
structural diff check is textual and cannot tell a guardrail from the thing it guards
against; a rule that could not be read without tripping its own gate would not survive
maintenance. `tests/lint-fixtures/q08-confinement.test.ts` enforces exactly this: the
marker is valid only on a flagged line inside `tests/lint-fixtures/<rule>/bad.*`, and the
rest of the delivered surface must be clean. The remaining branches of each rule — the
other spellings of a suppression, the exclusive marker, the bracket form — are proved in
`tests/lint-fixtures/guardrails.test.ts` by linting source assembled at run time at the
fixture's own path: identical enforcement, no extra text in the diff.

## Fresh-clone determinism

`pnpm install --frozen-lockfile` → `pnpm verify` → `git status --porcelain` empty → a
second `pnpm verify` with the same roster. CI runs that chain on every push and pull
request, which is what keeps it true: verify writes only to gitignored paths
(`.scratch/`, `.next-verify/`, `cad/.venv/`), so a green run leaves the tree exactly as it
found it.
