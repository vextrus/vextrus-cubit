#!/usr/bin/env node
// THE GALLERY, TAKEN (Design Direction 00 §9.3). One command, one browser, one geometry.
//
// It runs `tests/e2e/gallery-v22.spec.ts` through the journeys' own Playwright config, which is the
// whole point: that config already builds the product, serves it on the journeys' port, provisions
// the frozen picture tenant and its frozen clock, and states §9.3's capture geometry. A capture
// script that drove a browser of its own would be a second lane with a second idea of what 1440×900
// means, and the two would drift the first time one of them was revalued (B-17).
//
//   node scripts/capture-gallery.mjs
//
// The stills land in docs/design/gallery-v22/<screen>-{light,dark}.png.
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "node",
  ["node_modules/@playwright/test/cli.js", "test", "tests/e2e/gallery-v22.spec.ts", "--project=dark", "--reporter=list"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // The gallery is a picture run by definition: the geometry, the frozen tenant and the frozen
      // clock are what make two runs of the same still the same file.
      CUBIT_E2E_PICTURE: "1",
      CUBIT_GALLERY: "1",
      // One project, both themes: the theme is set per navigation by the instrument (`?__theme=`),
      // so a second Playwright project would take every still twice and throw one of each pair
      // away. Since v22's speed pass the lane HAS one project — dark — and this runs in it; the
      // light ground is still scored, from the emulated captures this very spec takes.
    },
  },
);
process.exit(result.status ?? 1);
