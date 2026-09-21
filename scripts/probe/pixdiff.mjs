#!/usr/bin/env node
// The pixels two same-sized captures differ in, as bands — the read that tells a run-to-run drift
// (an id, a name's width, a race) from a picture that stands.
//   node scripts/probe/pixdiff.mjs <a.png> <b.png>
import { readFileSync } from "node:fs";
import { bandLine, compareBands, decodePng } from "./lib/png.mjs";

const [fileA, fileB] = process.argv.slice(2);
if (fileA === undefined || fileB === undefined) {
  console.error("usage: pixdiff.mjs <a.png> <b.png>");
  process.exit(2);
}
const result = compareBands(decodePng(readFileSync(fileA)), decodePng(readFileSync(fileB)));
if (result.total < 0) console.log(`${fileA} vs ${fileB}: sizes differ ${result.sizes}`);
else console.log(`${fileA.split("/").pop()} vs ${fileB.split("/").pop()}: differing=${result.total}${result.bands.map((band) => `  ${bandLine(band)}`).join("")}`);
