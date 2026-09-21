#!/usr/bin/env node
// Where a Playwright diff picture differs: the bands of rows that moved, each with its x-range and
// pixel count, so a reader learns WHICH regions moved without opening the picture.
//   node scripts/probe/diff-bbox.mjs <…-diff.png> [<…-diff.png> …]
import { readFileSync } from "node:fs";
import { bandLine, decodePng, diffBands } from "./lib/png.mjs";

for (const file of process.argv.slice(2)) {
  const img = decodePng(readFileSync(file));
  const { total, bands } = diffBands(img);
  console.log(`${file.split("/").slice(-2).join("/")} ${img.width}x${img.height} differing=${total}`);
  for (const band of bands) console.log(`  ${bandLine(band)}`);
}
