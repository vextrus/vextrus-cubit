// The coverage-cause question's recorder (R-TO-052, Q-08): one subject per committed STATE file,
// put as the product itself composes it (`coverageCauseRequest`).
//
// Why files and not a campaign. The state is the residue's answer for one cell, and the residue is a
// QUERY over a measured campaign — `residueOf` opens a transaction on a tenant's database and the
// rails' observations are rows a measure run wrote. This script opens no database and runs no
// ingest, so the states it records over are HAND-AUTHORED and COMMITTED beside it, transcribed from
// what the F-RCC6-BNBC campaign yields: its kinds, its classes, its level labels and the codes its
// rails publish. They are deliberate corpus in their own right (Q-08) — a reader can chase every
// subject back to the file it was asked over, and a state edited after it was recorded fails the
// unit lane's roster test rather than quietly answering a question nobody asked.
//
// Its own flags: `--states <dir>` (the directory of `*.state.json` files, defaulting to the
// committed one beside this file) and `--limit N` for how many subjects are asked.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { coverageCauseRequest, isCoverageCauseState } from "../../src/modules/takeoff/coverage/cause-proposal";
import type { Asked, RecorderContext } from "./recorder";

/** The committed states this question is recorded over when the command line names no other set. */
const STATES = resolve(import.meta.dirname, "coverage-cause-states");

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/** What a state file is called: the suffix, so a README or a manifest beside them is not a subject. */
const SUFFIX = ".state.json";

/** Every committed unmeasured cell, once each, as the product would ask about it. */
export function subjectsOf(ctx: RecorderContext): Asked[] {
  const dir = resolve(ctx.option("--states") ?? STATES);
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(SUFFIX))
    .sort();
  if (files.length === 0) ctx.fail(`${dir} holds no ${SUFFIX} file — --states <dir> names the states the cause question is recorded over`);

  const asked: Asked[] = [];
  for (const name of files) {
    const file = join(dir, name);
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    // The product's OWN guard, never a second reading of what a state is: a file this script would
    // compose a request over that the module would not is a corpus defect, and it is named rather
    // than recorded (B-17, B-21).
    if (!isCoverageCauseState(parsed)) ctx.fail(`${file} is not a coverage-cause state: a cell of kind, class, level and ordinal, one source key, its sightings and its observations`);
    asked.push({
      request: coverageCauseRequest(parsed),
      subject: `${basename(file)} · ${parsed.cell.kind} on ${parsed.cell.class}, ${parsed.cell.level}`,
      artifact: file,
    });
  }
  ctx.say(`${asked.length} unmeasured cell(s) read from ${dir}`);
  return asked.slice(0, limit);
}
