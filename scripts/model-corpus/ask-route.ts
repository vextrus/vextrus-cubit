// The ask-route question's recorder (R-AI-003, docs/design/s-ask.md I-396, I-397, Q-08): one subject
// per committed paraphrase the grammar cannot route, put as the product itself composes it — the
// grammar's own `openIntentOf` reads the subjects, `askRouteStateOf` and `askRouteRequest` compose
// the request — so agreement and the confidence floor are measured on the arm's OWN composed request.
//
// Why a committed project and not a database. The request carries the question's words and each
// subject with its one defining key; the keys are read by the server off the pinned records (a mark's
// entity, a level's first storey-height reading). This script opens no database, so the project the
// paraphrases are asked over is TRANSCRIBED beside them in `tests/ai/ask/paraphrases.json`: J-043's
// staged register (`tests/e2e/takeoff/register-stage.ts`), its marks, its level and the keys its
// drawing draws them at. J-043 asks one of these paraphrases in the running product and replays this
// very recording, which is what holds the transcription to the stage.
//
// Its own flags: `--paraphrases <file>` (defaulting to the committed one) and `--limit N`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openIntentOf, type AskSubject } from "../../src/modules/takeoff/ask/grammar";
import type { AskLevel, AskLine, AskObject } from "../../src/modules/takeoff/ask/law";
import { askRouteRequest, askRouteStateOf, isRoutable } from "../../src/modules/takeoff/ask/route-question";
import { vocabularyOf, type AskVocabulary } from "../../src/modules/takeoff/ask/vocabulary";
import type { Asked, RecorderContext } from "./recorder";

/** The committed paraphrase corpus when the command line names no other. */
export const PARAPHRASES = resolve(import.meta.dirname, "..", "..", "tests", "ai", "ask", "paraphrases.json");

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/** The project the paraphrases are asked over, as transcribed. */
export type ParaphraseProject = {
  readonly about: string;
  /** Each registered object: class, mark, level. */
  readonly objects: readonly (readonly [string, string, string])[];
  /** Each (class, kind, unit) the campaign published a line of. */
  readonly lines: readonly (readonly [string, string, string])[];
  /** The stack's labels, from the ground up. */
  readonly levels: readonly string[];
  /** Each subject's defining key, by `slot|label`, as the server reads it off the pinned records. */
  readonly keys: Readonly<Record<string, string>>;
};

/** One paraphrase, and the reading it was written to ask: the intent (null for none of these) and any slot it singles out. */
export type Paraphrase = { readonly question: string; readonly intent: string | null; readonly slots?: Readonly<Record<string, string>> };

/** The committed corpus. */
export type ParaphraseCorpus = { readonly project: ParaphraseProject; readonly paraphrases: readonly Paraphrase[] };

/** The corpus at a path. */
export function paraphrasesAt(path: string = PARAPHRASES): ParaphraseCorpus {
  return JSON.parse(readFileSync(path, "utf8")) as ParaphraseCorpus;
}

/** The project's vocabulary, read by the product's own reader over the transcribed register. */
export function projectVocabulary(project: ParaphraseProject): AskVocabulary {
  const objects: AskObject[] = project.objects.map(([klass, mark, level], at) => ({ objectKey: `o${at}`, class: klass, mark, level, sourceKey: `o${at}`, role: "MEASURED", corroboration: "NONE" }));
  const lines: AskLine[] = project.lines.map(([klass, kind, unit], at) => ({
    lineId: `l${at}`,
    objectKey: "o0",
    class: klass,
    kind,
    level: project.levels[0] ?? "",
    value: "1",
    unit,
    coverage: "COMPLETE",
    repudiated: false,
    drawingId: null,
    layoutName: null,
    sheetLabel: null,
    traceKeys: [],
  }));
  const stack: AskLevel[] = project.levels.map((label, ordinal) => ({ levelId: label, label, ordinal, height: { standing: "AGREED", canonicalMetres: null, current: [] } }));
  return vocabularyOf({ objects, lines, stack });
}

/** The key the server would read for one subject, off the transcription. */
export function keyOf(project: ParaphraseProject): (subject: AskSubject) => string | null {
  return (subject) => project.keys[`${subject.slot}|${subject.label}`] ?? null;
}

/** Every committed paraphrase the grammar leaves open, once each, as the product would route it. */
export function subjectsOf(ctx: RecorderContext): Asked[] {
  const path = resolve(ctx.option("--paraphrases") ?? PARAPHRASES);
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const corpus = paraphrasesAt(path);
  const vocabulary = projectVocabulary(corpus.project);
  const asked: Asked[] = [];
  for (const paraphrase of corpus.paraphrases) {
    // The product's OWN reading of whether the machine is asked: a paraphrase the grammar answers,
    // clarifies or refuses by another name is a corpus defect, named rather than recorded (B-17).
    const subjects = openIntentOf(paraphrase.question, vocabulary);
    if (subjects === null) ctx.fail(`${JSON.stringify(paraphrase.question)} is routed by the grammar itself, so the machine is never asked it — it does not belong in ${path}`);
    const state = askRouteStateOf(paraphrase.question, subjects, keyOf(corpus.project));
    if (!isRoutable(state)) ctx.fail(`${JSON.stringify(paraphrase.question)} names no subject with a key to cite, so the machine is never asked it (I-397)`);
    asked.push({ request: askRouteRequest(state), subject: `paraphrases.json · ${paraphrase.question}`, artifact: path });
  }
  ctx.say(`${asked.length} paraphrase(s) read from ${path}`);
  return asked.slice(0, limit);
}
