# Visual baselines (Q-06, V-E2E)

Committed Linux screenshots, one per named journey checkpoint, compared with
`toHaveScreenshot` at `maxDiffPixelRatio` 0.002 and animations disabled. They are generated
and refreshed on Ubuntu 24.04 (WSL2 here, `ubuntu-24.04` in CI) with:

```
pnpm e2e --journey J-004 --update-baselines
```

A refreshed baseline is committed with the reason it changed in the commit message (Q-06:
"an approved baseline update with a recorded reason").

## Snapshot names are path segments, never a string with a slash

`playwright.config.ts` pins `snapshotPathTemplate` to `{snapshotDir}/baselines/{arg}{ext}`, so
a checkpoint's baseline is `tests/e2e/baselines/<journey folder>/<checkpoint>.png` — which is
the path the acceptance names and the path the images live at.

Playwright sanitises a *string* snapshot name before it reaches `{arg}`: the `/` in
`toHaveScreenshot('design/gallery-light.png')` becomes `-`, and the runner resolves
`baselines/design-gallery-light.png` — not the committed image. Only an array name
(`['design', 'gallery-light.png']`) is path-joined and keeps the separator, so that is the
form every journey spec uses.

Recorded correction (Q-06, arbitration 2026-08-22): this directory briefly carried
`design-gallery-light.png` and `design-gallery-dark.png` as symlinks into `design/`, which
made the string-named assertion resolve by compensation rather than by the criterion. The
journey spec now passes both names as segments and the symlinks are deleted. The images
themselves are unchanged — no baseline update, no pixels rewritten.
