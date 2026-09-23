---
name: product-review
description: Review the RUNNING Vextrus Cubit in a real browser the way a quantity surveyor and a design lead would — serve it, sign in, walk a real task end to end with the chrome-devtools MCP, capture what the eye sees in both themes and both viewports, and turn what is wrong into a ranked, evidenced defect list that feeds the next fix wave. Use to judge any screen or flow, before and after a change, and before every demo.
---
# Product review in the browser

The e2e lanes prove contracts; they do not prove the product is good. This is how a session looks at
the product itself (the owner's ruling for session 8: "use the browser directly to critically judge").

## 1. Serve it
- Nothing else served: `node scripts/harness/state.mjs` (3210/3211/3213 free; no db lane running).
- `pnpm demo --no-open` serves the newest measured "Bashundhara G+6" project on
  `http://127.0.0.1:3213`, runs the worker, and prints one block with the sign-in it PROVED against the
  stored hash (`j000-legs-<stamp>@cubit.test` / `golden-path-legs-<stamp>`) and the register URL. No
  measured project yet → `pnpm e2e --journeys J-000` first (demo stopped). For a screen not reached by
  the demo project, `pnpm dev` (3210, cubit_dev) is the other served product — never both beside a lane.
- `pnpm demo --stop` before any `pnpm e2e`, `pnpm test:perf`, `pnpm test:db` or `pnpm gate` (they refuse).

## 2. Walk it (chrome-devtools MCP, headless Chromium 1440x900 — the journeys' engine)
- `new_page` the sign-in URL → `take_snapshot` → `fill_form` the credentials → click Sign in.
- Walk the task a QS actually does, in order, clicking what a customer clicks: project home → drawings
  (sets, disciplines, scale) → viewer → levels → schedules & notes → takeoff register → coverage → BOQ
  → BBS → documents/exports → audit. Say at each step what the QS is trying to achieve and whether the
  screen lets them.
- Evidence: `take_screenshot` with `filePath: ".private/work/review/<area>-<step>-<theme>-<width>.png"`,
  then Read the PNG and look at it — every claim about a screen cites a picture you looked at.
  `resize_page` 1280x800 for the second viewport; toggle the theme in the shell for light.
- `list_console_messages` (errors are defects), `list_network_requests` (a slow or failed call is a
  defect with a cause), `performance_start_trace`/`stop_trace` + `performance_analyze_insight` where a
  step feels slow (PB-1…PB-7 are the budgets), `lighthouse_audit` for accessibility on a settled page.
- Opus 5.5 reads screenshots precisely; for dense detail (a schedule, a drawing region) take a
  full-resolution element screenshot (`uid`) rather than squinting at the whole page.

## 3. Judge it
Against, in order: the QS's real workflow and the Bible's personas (P-QS, P-LEAD); trust (the Trace,
basis, coverage, honest refusals — L-QTY-*, R-UI-020/022); the screen's Design Decision
(`docs/design/<screen>.md`) and the craft rubric (`.claude/rules/frontend.md`); Datum's visual law; and
the competitors the Bible names (Bluebeam, CostX, PlanSwift, Togal) — what would a QS who uses them
miss here? Fan the walk out when it is wide: `ux-critic` agents per area, `qs-critic` on figures and
documents, `refuter` on any finding you are about to spend a fix on.

## 4. Record and act
- A ranked defect list (BLOCKS_DEMO › FRICTION › POLISH), each with screen, element (testid), repro,
  screenshot path, the law or Decision it breaks, and the fix. Keep it in the session's ledger
  (`docs/handoff/session-N-ledger.md`); screenshots stay in `.private/work/review/` unless a Decision
  needs an annotated capture (then it is a committed picture of OUR product only).
- Fix in waves: foundation defects (shared primitives, shell, tokens) before screen defects; each fix
  amends its Design Decision in the same commit; re-walk the screen in the browser after the fix, and
  let the gate re-take any baseline the fix moved (`pnpm e2e:retake`, a `baseline:` commit).
- Stop the demo when done: `pnpm demo --stop`.
