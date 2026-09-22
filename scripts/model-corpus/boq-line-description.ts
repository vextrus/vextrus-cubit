// The boq-line-description question's recorder (L-BD-01, Q-08): one subject per measured group the
// closed catalogue holds more than one description for, put as the product itself composes it
// (`boqDescriptionRequest`).
//
// THE SUBJECTS ARE HAND-WRITTEN STATE, AND SAY SO. What a group's drawings state — a wall's nominal
// thickness, a foundation pit's depth — is read off the committed BNBC fixture
// (`fixtures/rcc6-bnbc/model.json` and its `site` facts, the 36 M3 gate cells of `cells.json`) and
// written down once, as JSON, under `./boq-line-description-states/`. There is no database here and
// no drawing is ingested: the recorder reads FILES, and each state file names where its values came
// from in its own `note`.
//
// THE CANDIDATES ARE NEVER HAND-WRITTEN. They are `candidateItemsFor`'s, so a subject is recorded
// over exactly the options the product would offer, and a pair the catalogue holds ONE description
// for is refused by name rather than recorded — the product never asks that question, and a corpus
// that answered it would be a corpus of a question nobody puts (I-298).
//
// Its own flags: `--states <dir>` where the state files live (the directory beside this file by
// default), and `--limit N` for how many subjects are asked.
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { candidateItemsFor } from "../../src/core/catalogue/item-descriptions";
import { ELEMENT_TYPES, type ElementType } from "../../src/core/catalogue/classes";
import { KINDS, type Kind } from "../../src/core/catalogue/kinds";
import { boqDescriptionRequest, type BoqAttributeState, type BoqLineState } from "../../src/modules/takeoff/boq/description-question";
import type { Asked, RecorderContext } from "./recorder";

/** Where the hand-written states live when the command line names no other directory. */
const STATES = resolve(dirname(fileURLToPath(import.meta.url)), "boq-line-description-states");

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "50";

/** One hand-written subject: the group as the draft would state it, and where its values came from. */
type StateFile = {
  readonly subject: string;
  readonly note: string;
  readonly artifact: string;
  readonly line: BoqLineState;
  readonly attributes: readonly BoqAttributeState[];
  readonly keys: readonly string[];
};

/** Every hand-written group, put as the product would ask it, in the states' own file order. */
export function subjectsOf(ctx: RecorderContext): Asked[] {
  const dir = ctx.option("--states") ?? STATES;
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) ctx.fail(`${dir} holds no hand-written state — a recording asks about a group somebody wrote down`);

  const asked: Asked[] = [];
  for (const file of files) {
    const path = join(dir, file);
    const state = stateAt(path, ctx);
    const klass = closed(state.line.class, ELEMENT_TYPES, `${file}: line.class`, ctx) as ElementType;
    const kind = closed(state.line.kind, KINDS, `${file}: line.kind`, ctx) as Kind;
    const candidates = candidateItemsFor(klass, kind);
    if (candidates.length < 2) {
      ctx.fail(`${file} names ${klass} × ${kind}, which the catalogue holds one description for — the product never asks it, so there is nothing to record`);
    }
    if (state.attributes.length === 0) ctx.fail(`${file} states no attribute, so nothing could tell the options apart`);
    if (state.keys.length === 0) ctx.fail(`${file} cites no source key, so nothing it answered could be sourced (L-AI-02)`);
    const request = boqDescriptionRequest({ line: { ...state.line, class: klass, kind }, attributes: state.attributes, candidates, keys: state.keys });
    asked.push({ request, subject: `${state.subject} · ${candidates.length} candidates`, artifact: state.artifact });
    ctx.say(`${basename(file)}: ${klass} × ${kind}, ${state.attributes.length} stated attributes, ${candidates.length} candidates`);
  }
  return asked.slice(0, limit);
}

/** One state file, as it must be written, or the fault that says how it is not. */
function stateAt(path: string, ctx: RecorderContext): StateFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    ctx.fail(`${path} is not readable JSON: ${String(cause)}`);
  }
  const state = parsed as Partial<StateFile>;
  if (state === null || typeof state !== "object" || state.line === undefined || !Array.isArray(state.attributes) || !Array.isArray(state.keys)) {
    ctx.fail(`${path} names a subject, a note, an artifact, a line, its attributes and its keys`);
  }
  return state as StateFile;
}

/** A word of a closed roster, or the fault that names the roster it is not a member of (B-19). */
function closed(value: string, roster: readonly string[], where: string, ctx: RecorderContext): string {
  if (!roster.includes(value)) ctx.fail(`${where} is ${JSON.stringify(value)}, which is no member of ${roster.join(", ")}`);
  return value;
}
