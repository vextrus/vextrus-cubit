# The probe

The instrument a session looks at the product with: one verdict line per screen, pixels only on
request, the craft rubric read from the DOM after `settled()`. It serves the same built product the
journey lane serves (`scripts/e2e-server.mjs`, `build-if-stale start`), on the journeys' own
database and roots, with the shipped worker beside it. Nothing here is a dev server, and nothing
here is a lane: the gate's verdicts are the lanes' own.

```
pnpm probe:server                # build-if-stale, serve on 3211, start the worker; exits when ready
pnpm probe:server -- --stop      # stop both
pnpm probe -- signin <email> <password> [--out cookies.json]
pnpm probe -- walk [--cookies f] [--themes dark,light] [--viewports 1440x900,1280x800] \
                   [--kind grid|canvas] [--shot] [--json] [--out dir] <route> [<route> …]
pnpm probe -- run <script.mjs> [--cookies f] [--shot] [--out dir]
bash scripts/probe/craft-walk.sh test-results/j-000-golden-run.dark.w0.json test-results/probe/craft
node scripts/probe/diff-bbox.mjs test-results/**/x-diff.png     # where a diff picture differs, by bands
node scripts/probe/pixdiff.mjs a.png b.png                       # where two captures differ
node scripts/probe/crop.mjs expected.png actual.png x y w h out.png
```

A verdict line:

```
OK  route=/t/… state=<root data-state> regions=<n> rows=<…> axe=S/C/M console=<n> net5xx=<n> fcp=<ms> long=<n> craft=<total>/min<min> theme=dark 1440x900
RED route=/t/… … why=<cause>
```

`craft` is the rubric of AM-08 Part 2's mechanical half (`lib/craft.mjs`: twelve criteria 0–5,
weights summing to 12, the score the minimum across captures; ≥ 4.0 with none below 3 is the bar).
`--kind canvas` grades a sheet's canvas as the work surface. The per-route JSON (`--json`, or the
`<route>.<theme>.<w>x<h>.json` beside each capture) carries every criterion's score and its reason.

Test ids are read from `src/ui/testids.ts` through `lib/testids.mjs` — the harness spells none.
The readers that run inside the page (`probe.mjs`, `server.mjs`, `lib/{axe,craft,settled}.mjs`
and the three picture tools) are excluded from the node type program in `tsconfig.json`: their
DOM code is the browser's; `lib/png.mjs` and `lib/testids.mjs`, which the lanes import, are typed.
`craft-walk.sh` walks every screen of a measured J-000 project with the run's own cookies (a
`pnpm e2e --journeys J-000` leaves `test-results/j-000-golden-run.dark.w<N>.json`; pick one with
`"measured": true`).

Outputs go under `test-results/probe/` by default, which git ignores. The J-000 run files hold the
run's session cookies: never commit a probe output directory.
