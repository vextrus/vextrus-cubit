# Acceptance layout

Written before the implementation. Every file here is red until the Foundation
increment lands.

| path | runner | notes |
| --- | --- | --- |
| `src/**/__tests__/*.spec.ts` | `pnpm test` (and verify's vitest stage) | pure unit/contract, no database |
| `tests/contract/*.spec.ts` | `pnpm test` | static toolchain + composition contracts; `lint-rules.spec.ts` drives ESLint's Node API over the fixtures |
| `db/__tests__/*.spec.ts` | **`pnpm test:db` only** | live Postgres on 127.0.0.1:5544; they throw at import when `DATABASE_URL_MIGRATE` / `DATABASE_URL_APP` are unset, so `vitest.config.ts` must exclude `db/**` from the default project and `test:db` must include it |
| `tests/e2e/journeys/*.spec.ts` | `pnpm e2e` | Playwright; support and page objects under `tests/e2e/support/**` |
| `tests/lint-fixtures/**` | data only | excluded from tree-wide `eslint .` and from `tsc`, but the flat config must still *apply* the `cubit/*` rules to these paths so `lint-rules.spec.ts` can lint them with `ignore: false` |

Three things the config has to arrange for the suite to be runnable at all:

1. `vitest.config.ts` includes `tests/contract/**` and `src/**/__tests__/**`,
   and excludes `tests/e2e/**` and `db/__tests__/**`.
2. `tsconfig.json` and `eslint.config.mjs` both exclude `tests/lint-fixtures/**`
   from the tree-wide run — otherwise `pnpm verify` is permanently red.
3. `playwright.config.ts` points `snapshotPathTemplate` at
   `tests/e2e/baselines/auth/` with `maxDiffPixelRatio: 0.002`, and serves the
   app on 3211. Baselines are generated on Linux with
   `pnpm e2e --update-baselines` and committed.

Page objects (`tests/e2e/support/pages/**`) are the Builder's to adjust; the
journeys and the assertions are not.
