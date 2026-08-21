# Visual baselines (Q-06, V-E2E)

Committed Linux screenshots, one per named journey checkpoint, compared with
`toHaveScreenshot` at `maxDiffPixelRatio` 0.002 and animations disabled. They are generated
and refreshed on Ubuntu 24.04 (WSL2 here, `ubuntu-24.04` in CI) with:

```
pnpm e2e --journey J-004 --update-baselines
```

A refreshed baseline is committed with the reason it changed in the commit message (Q-06:
"an approved baseline update with a recorded reason").

## Why the two symlinks

`playwright.config.ts` pins `snapshotPathTemplate` to `{snapshotDir}/baselines/{arg}{ext}`, so
a checkpoint's baseline is `tests/e2e/baselines/<journey folder>/<checkpoint>.png` — which is
the path the acceptance names and the path the images live at.

Playwright, though, sanitises a *string* snapshot name before it reaches `{arg}`: the `/` in
`toHaveScreenshot('design/gallery-light.png')` becomes `-`, and the runner looks for
`design-gallery-light.png` in this directory. Only an array name (`['design',
'gallery-light.png']`) keeps the separator, and the journey spec is the Verifier's file.

So each sanitised name is a symlink to the real baseline in `design/`. The image is stored
once, under the path the criterion names; the runner reads and updates it through the link.
The symlinks can be deleted the day the spec passes its snapshot name as path segments.
