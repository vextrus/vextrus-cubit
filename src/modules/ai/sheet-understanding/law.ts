// R-AI-001's vocabulary: what a sheet's reading holds, who read it, and how a model's answer is read
// back into one. Pure — it names no store, no clock and no seam, so the same wire answer decodes to
// the same reading forever.
//
// The bases are module-local. `src/core/sheets/law.ts`'s PROPOSAL_BASES stays ["GRAMMAR", "NONE"]:
// that roster closes the title-block grammar's own answer and the sheet card's column reads it, and
// a third member there would claim the grammar can answer "MODEL", which it cannot. What this module
// publishes is a different question — who understood the sheet — so it has its own closed roster.
import { DISCIPLINES, isDiscipline, type Discipline } from "@/core/sheets";
import type { ModelId } from "@/core/model-ledger.types";
import type { DecodeResult, SourceKey } from "@/core/model";
import type { SheetReadingRecord } from "@/core/db";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * What one sheet's reading holds. The declaration's own home is the store's column
 * (`SheetReadingRecord`), because the CHECK-bearing table has to name the shape it carries and core
 * may not import a module (ARCH-01); this alias is the name R-AI-001's readers know it by, and the
 * two are one type rather than two spellings of one (B-17).
 */
export type SheetReading = SheetReadingRecord;

/** Who read the sheet: the deterministic title-block grammar, or the model where it was silent. */
export const UNDERSTANDING_BASES = ["GRAMMAR", "MODEL"] as const;

/** One basis, drawn from the closed roster above. */
export type UnderstandingBasis = (typeof UNDERSTANDING_BASES)[number];

/**
 * The model a silent sheet is read by (AS-05: `claude-opus-5` for reading and proposals). The answer
 * asked for is a four-field reading with citations, not a class, so the cheap classifier is not it.
 */
export const UNDERSTANDING_MODEL: ModelId = "claude-opus-5";

/**
 * What one sheet amounts to: the reading, the entities it rests on, and — where a model made it —
 * the call that did. A GRAMMAR understanding names no call and no model because none was asked; a
 * MODEL one names both, and its citations are source keys the seam resolved against the sheet.
 */
export type SheetUnderstanding =
  | { readonly basis: "GRAMMAR"; readonly reading: SheetReading; readonly cited: readonly string[]; readonly callId: null; readonly model: null }
  | { readonly basis: "MODEL"; readonly reading: SheetReading; readonly cited: readonly SourceKey[]; readonly callId: string; readonly model: ModelId };

/** The fields a reading names, sorted — the key set a model's payload must carry, exactly. */
const READING_FIELDS = ["captions", "discipline", "number", "title"] as const;

/**
 * A model's payload as a reading, or the detail that says why it is not one (L-AI-02: a decoder
 * answers a result and never throws — a throw would be a fault, not a refusal).
 *
 * The key set is exact because the reading is a closed shape: a payload carrying a fifth field is a
 * model answering a question this module did not ask, and one missing a field is a reading with a
 * hole in it. Blank text is refused rather than trimmed to nothing: a title nobody can read is not a
 * title, and publishing one would claim the sheet was understood.
 */
export function readSheetReading(payload: JsonValue): DecodeResult<SheetReading> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, detail: `a sheet reading is an object naming ${READING_FIELDS.join(", ")}` };
  }
  const named = Object.keys(payload).sort();
  if (named.length !== READING_FIELDS.length || READING_FIELDS.some((field, index) => named[index] !== field)) {
    return { ok: false, detail: `a sheet reading names exactly ${READING_FIELDS.join(", ")}, and this one names ${named.join(", ") || "nothing"}` };
  }

  const number = payload["number"] ?? null;
  if (number !== null && !isSaid(number)) return { ok: false, detail: "a sheet number is a non-blank string, or null where the sheet states none" };

  const title = payload["title"];
  if (!isSaid(title)) return { ok: false, detail: "a reading proposes a title, and a blank one names no sheet" };

  const discipline = payload["discipline"];
  if (typeof discipline !== "string" || !isDiscipline(discipline)) {
    return { ok: false, detail: `${JSON.stringify(discipline)} is no discipline — R-TO-004 closes them over ${DISCIPLINES.join(", ")}` };
  }

  const captions = saidStrings(payload["captions"]);
  if (captions === null) return { ok: false, detail: "the view captions are an array of non-blank strings, empty where the sheet carries none" };

  return { ok: true, value: readingOf({ number: isSaid(number) ? number.trim() : null, title: title.trim(), discipline, captions }) };
}

/** A reading as this module hands one on: the four fields, in R-AI-001's own order, frozen. */
export function readingOf(reading: { number: string | null; title: string; discipline: Discipline; captions: readonly string[] }): SheetReading {
  return Object.freeze({ number: reading.number, title: reading.title, discipline: reading.discipline, captions: Object.freeze([...reading.captions]) });
}

/** Is this a string that says something? Whitespace is not text a sheet was read out of. */
function isSaid(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** The captions as the strings they must be — every one saying something — or null where they are not. */
function saidStrings(value: JsonValue | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const said: string[] = [];
  for (const item of value) {
    if (!isSaid(item)) return null;
    said.push(item.trim());
  }
  return said;
}
