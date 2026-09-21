#!/usr/bin/env node
// The same region of an expected and an actual capture, stacked (expected above, actual below, a
// red rule between) into one small picture a reader can look at.
//   node scripts/probe/crop.mjs <expected.png> <actual.png> <x> <y> <w> <h> <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { cropRgb, decodePng, encodeRgb } from "./lib/png.mjs";

const [expectedFile, actualFile, xs, ys, ws, hs, outFile] = process.argv.slice(2);
if (outFile === undefined) {
  console.error("usage: crop.mjs <expected.png> <actual.png> <x> <y> <w> <h> <out.png>");
  process.exit(2);
}
const x = Number(xs);
const y = Number(ys);
const w = Number(ws);
const h = Number(hs);
const above = cropRgb(decodePng(readFileSync(expectedFile)), x, y, w, h);
const below = cropRgb(decodePng(readFileSync(actualFile)), x, y, w, h);
const rule = Buffer.alloc(w * 2 * 3);
for (let i = 0; i < w * 2; i += 1) {
  rule[i * 3] = 255;
  rule[i * 3 + 1] = 0;
  rule[i * 3 + 2] = 0;
}
writeFileSync(outFile, encodeRgb(w, h * 2 + 2, Buffer.concat([above, rule, below])));
console.log(`${outFile} ${w}x${h * 2 + 2}`);
