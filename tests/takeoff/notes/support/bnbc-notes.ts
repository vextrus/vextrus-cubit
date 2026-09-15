/**
 * The general-note strings this increment's grammar is graded on, and the homes the criteria name
 * (R-TO-034, L-CAD-08, AC-1).
 *
 * Mechanics only — nothing here judges the product. The four sentences below are F-RCC6-BNBC's own
 * words, declared ONCE (B-19) and proved against the fixture's committed corpus by the suite beside
 * this file: a roster that drifted from the drawing it claims to quote would grade the grammar on a
 * sentence no sheet ever carried.
 *
 * This file opens no database and imports no product module at load time, so the suites that stand
 * on it stay in the unit lane (the lane split is derived from the import graph).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The checkout these suites run against. */
export const REPO_ROOT: string = process.cwd();

/* ------------------------------------------------------------------ the homes the spec names */

/** The vocabulary of a note reading: the kinds, the two acceptances and the one basis (interfaces). */
export const NOTES_LAW_MODULE = "src/modules/takeoff/notes/law.ts";

/** The deterministic grammar itself — pure, over the sheet's own text (interfaces, AC-1). */
export const NOTES_GRAMMAR_MODULE = "src/modules/takeoff/notes/grammar.ts";

/** How a kind stands over the readings made of it (AC-4). */
export const NOTES_STANDING_MODULE = "src/modules/takeoff/notes/standing.ts";

/** The module's door: the applied detailing values, the sheet's texts, the reading key (goal). */
export const NOTES_MODULE = "src/modules/takeoff/notes/index.ts";

/** The act pair TRANSCRIBE_SHEET_NOTES stands behind (AC-2). */
export const TRANSCRIBE_ACT_MODULE = "src/core/acts/transcribe-sheet-notes.ts";

/** SEAM-ACT, the act law beside it, and the area's own refusal register (AC-2). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";
export const SCHEDULES_ERRORS_MODULE = "src/core/errors/takeoff-schedules.ts";

/** Where a foreign or law-owned closed set is declared once, so Q-07's register can tell it apart. */
export const VOCABULARY_MODULE = "src/core/errors/transport-vocabulary.ts";

/** The vocabulary line the note kinds are declared as (interfaces). */
export const NOTE_KINDS_VOCABULARY = "note kinds (R-TO-034)";

/** The two UI homes a copy string stands in, which may never differ (AC-7). */
export const STRINGS_MODULE = "src/ui/strings/schedules.ts";
export const COPY_MIRROR_MODULE = "src/modules/takeoff/schedules-ui/copy.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The act this increment lands, and the permission L-ACT-03 cuts it under. */
export const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES";
export const MEASURE = "MEASURE";

/** The roles the criteria drive the act as. */
export const MEASURER = "MEASURER";
export const REVIEWER = "REVIEWER";

/** The one basis a note reading carries, and the two verdicts the seam judges it under. */
export const TRANSCRIBED = "TRANSCRIBED";
export const ACCEPTED = "ACCEPTED";
export const EDITED = "EDITED";

/** The five kinds, as the criteria spell them (the ROSTER is read from the product's own law). */
export const FY = "FY";
export const FC = "FC";
export const LAP = "LAP";
export const HOOK = "HOOK";
export const HOOK_MIN = "HOOK_MIN";

/** How a kind stands over the readings made of it (AC-4). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const NONE = "NONE";

/** The refusals these criteria name by their own spelling. */
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";
export const REQUEST_MALFORMED = "REQUEST_MALFORMED";
export const NOTE_READING_CONTESTED = "NOTE_READING_CONTESTED";
export const NOTE_SOURCE_NOT_ON_SHEET = "NOTE_SOURCE_NOT_ON_SHEET";
export const NOTES_NONE_PROPOSED = "NOTES_NONE_PROPOSED";

/** The table this increment lands, and the table its deferral rows are read from. */
export const NOTES_READINGS_TABLE = "notes_readings";

/**
 * The two edition stores AM-03(h) speaks of, which a note may move NEITHER of (AC-4).
 *
 * `ruleset_editions` is the platform's own: it carries no `tenant_id` at all — "a platform edition
 * belongs to no workspace, and a row in a tenant-scoped table that no tenant owns is a row no policy
 * can answer for" (src/core/db/schema-rulesets.ts) — so it is counted whole. `tenant_ruleset_editions`
 * is where a campaign's own editions live, and that one IS scoped by workspace.
 */
export const RULESET_EDITIONS_TABLE = "ruleset_editions";
export const TENANT_RULESET_EDITIONS_TABLE = "tenant_ruleset_editions";

/* ------------------------------------------------------------------ the fixture, declared once */

/** The fixture these strings are quoted from, and its committed notation corpus (declared fixtures). */
export const BNBC_FIXTURE = "F-RCC6-BNBC";
export const BNBC_CORPUS = "fixtures/rcc6-bnbc/notation.corpus.json";

/** One text entity of a sheet, as the grammar is handed one (interfaces: `SheetText`). */
export type SheetText = { readonly sourceKey: string; readonly text: string };

/**
 * F-RCC6-BNBC's four general-note sentences, each with the source key the declared fixture support
 * names for it (AC-1, the increment's interfaces). The words are the drawing's; the keys are this
 * acceptance's own DXF handles, and every criterion that names a source key names one of these.
 */
export const BNBC_GENERAL_NOTES: readonly SheetText[] = Object.freeze([
  Object.freeze({ sourceKey: "DXF_HANDLE:1F43", text: "fy = 72,500 psi (500 MPa) BDS ISO 6935-2 B500DWR" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F41", text: "f'c = 3500 psi (24 MPa) cylinder" }),
  // A DXF handle, not the sheet's name: L-CAD-02's scheme admits `DXF_HANDLE:<hex>` and nothing else,
  // which the product's own EntityGraph mirror enforces at the ingest.
  Object.freeze({ sourceKey: "DXF_HANDLE:1F4C", text: "LAP 50d TENSION / 40d COMPRESSION U.N.O." }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F4E", text: "HOOKS: 90° = 12d; stirrup/tie 135° = 10d, min 75 mm (S-03)" }),
]);

/** The pile note of the same fixture: a second concrete strength, stated for one member (AC-1). */
export const BNBC_PILE_NOTE: SheetText = Object.freeze({ sourceKey: "DXF_HANDLE:1F45", text: "f'c = 3000 psi (BORED PILES)" });

/**
 * Three strings the same fixture's S-01 carries which state no reinforcement figure at all: a
 * standard's name, a heading and a label. A grammar that read a figure out of one of these would be
 * guessing (L-MEA-01: nothing is assumed where a note is silent).
 */
export const BNBC_SILENT_NOTES: readonly SheetText[] = Object.freeze([
  Object.freeze({ sourceKey: "DXF_HANDLE:1F47", text: "B500DWR" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F49", text: "CLEAR COVER" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F4B", text: "MATERIALS" }),
]);

/** Every text this acceptance ever stages on a sheet — the four notes and the pile note beside them. */
export const BNBC_SHEET_TEXTS: readonly SheetText[] = Object.freeze([...BNBC_GENERAL_NOTES, ...BNBC_SILENT_NOTES]);

/* ------------------------------------------------------------------ what the grammar owes them */

/** One reading the grammar owes, and the sentence it is owed from (AC-1). */
export type ExpectedProposal = {
  readonly kind: string;
  readonly canonical: string;
  readonly unitAsWritten: string;
  readonly valueAsWritten: string;
  readonly from: SheetText;
};

/**
 * The five readings AC-1 spells out of the four sentences: the grade, the strength, the tension lap,
 * the 135° stirrup hook multiplier and its minimum length. The ORDER the grammar answers them in is
 * derived from the product's own `NOTE_KINDS` beside the source keys (`expectedOrder`), never from
 * the order they are written here.
 */
export const EXPECTED_PROPOSALS: readonly ExpectedProposal[] = Object.freeze([
  Object.freeze({ kind: FY, canonical: "500", unitAsWritten: "MPa", valueAsWritten: "500 MPa", from: BNBC_GENERAL_NOTES[0] as SheetText }),
  Object.freeze({ kind: FC, canonical: "3500", unitAsWritten: "psi", valueAsWritten: "3500 psi", from: BNBC_GENERAL_NOTES[1] as SheetText }),
  Object.freeze({ kind: LAP, canonical: "50", unitAsWritten: "d", valueAsWritten: "50d", from: BNBC_GENERAL_NOTES[2] as SheetText }),
  Object.freeze({ kind: HOOK, canonical: "10", unitAsWritten: "d", valueAsWritten: "10d", from: BNBC_GENERAL_NOTES[3] as SheetText }),
  Object.freeze({ kind: HOOK_MIN, canonical: "75", unitAsWritten: "mm", valueAsWritten: "75 mm", from: BNBC_GENERAL_NOTES[3] as SheetText }),
]);

/**
 * The expected readings in the order the grammar owes them: by source key, then by the order the
 * product's own `NOTE_KINDS` stands in (AC-1). Derived from the roster the law publishes, so a kind
 * the law re-orders re-orders this too rather than failing it (B-19).
 */
export function expectedOrder(kinds: readonly string[], proposals: readonly ExpectedProposal[] = EXPECTED_PROPOSALS): ExpectedProposal[] {
  return [...proposals].sort((left, right) => {
    if (left.from.sourceKey !== right.from.sourceKey) return left.from.sourceKey < right.from.sourceKey ? -1 : 1;
    return kinds.indexOf(left.kind) - kinds.indexOf(right.kind);
  });
}

/** The same expectation, in the shape `proposalFacts` answers — what a deep comparison is made on. */
export function expectedFacts(
  kinds: readonly string[],
  proposals: readonly ExpectedProposal[] = EXPECTED_PROPOSALS,
): { kind: string; sourceKey: string; text: string; valueAsWritten: string; unitAsWritten: string; canonical: string }[] {
  return expectedOrder(kinds, proposals).map((one) => ({
    kind: one.kind,
    sourceKey: one.from.sourceKey,
    text: one.from.text,
    valueAsWritten: one.valueAsWritten,
    unitAsWritten: one.unitAsWritten,
    canonical: one.canonical,
  }));
}

/* ------------------------------------------------------------------ the fixture's own corpus */

/**
 * Every `raw` string of the fixture's committed notation corpus (declared fixtures, AC-1).
 *
 * The guards are `node:assert` rather than a runner's `expect`: this file is read by the Playwright
 * process too, where a unit lane's `expect` has no runner to bind to.
 */
export function corpusRawStrings(): string[] {
  const path = join(REPO_ROOT, BNBC_CORPUS);
  assert.ok(existsSync(path), `${BNBC_CORPUS} is ${BNBC_FIXTURE}'s committed notation corpus, and the checkout does not carry it`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { fixture?: unknown; strings?: unknown };
  assert.equal(String(parsed.fixture), BNBC_FIXTURE, `${BNBC_CORPUS} is the corpus of ${String(parsed.fixture)}, not of ${BNBC_FIXTURE}`);
  assert.ok(Array.isArray(parsed.strings), `${BNBC_CORPUS} carries no strings`);
  return (parsed.strings as { raw?: unknown }[]).map((entry) => String(entry.raw));
}

/* ------------------------------------------------------------------ the same forms, other figures */

/**
 * Sentences of the SAME grammar as the fixture's, stating other figures — and carried by no drawing
 * in the tree. They are the acceptance's own probes, never a claim about F-RCC6-BNBC, and the suite
 * beside this file proves the corpus carries none of them.
 *
 * Their purpose is the one thing a fixture roster cannot prove: that `proposeNotes` reads the FORM of
 * a sentence rather than recognising the five sentences it was written against. A lookup table keyed
 * on the fixture's strings answers nothing here.
 */
export const GRAMMAR_VARIANTS: readonly SheetText[] = Object.freeze([
  Object.freeze({ sourceKey: "DXF_HANDLE:2A01", text: "fy = 60,000 psi (420 MPa) BDS ISO 6935-2 B420DWR" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:2A03", text: "f'c = 4000 psi (28 MPa) cylinder" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:2A05", text: "LAP 45d TENSION / 36d COMPRESSION U.N.O." }),
  Object.freeze({ sourceKey: "DXF_HANDLE:2A07", text: "HOOKS: 90° = 12d; stirrup/tie 135° = 8d, min 100 mm (S-05)" }),
  Object.freeze({ sourceKey: "DXF_HANDLE:2A09", text: "fy = 420 MPa" }),
]);

/** What each probe states, read the way the interfaces rule each kind is read (AC-1). */
export const EXPECTED_VARIANT_PROPOSALS: readonly ExpectedProposal[] = Object.freeze([
  Object.freeze({ kind: FY, canonical: "420", unitAsWritten: "MPa", valueAsWritten: "420 MPa", from: GRAMMAR_VARIANTS[0] as SheetText }),
  Object.freeze({ kind: FC, canonical: "4000", unitAsWritten: "psi", valueAsWritten: "4000 psi", from: GRAMMAR_VARIANTS[1] as SheetText }),
  Object.freeze({ kind: LAP, canonical: "45", unitAsWritten: "d", valueAsWritten: "45d", from: GRAMMAR_VARIANTS[2] as SheetText }),
  Object.freeze({ kind: HOOK, canonical: "8", unitAsWritten: "d", valueAsWritten: "8d", from: GRAMMAR_VARIANTS[3] as SheetText }),
  Object.freeze({ kind: HOOK_MIN, canonical: "100", unitAsWritten: "mm", valueAsWritten: "100 mm", from: GRAMMAR_VARIANTS[3] as SheetText }),
  Object.freeze({ kind: FY, canonical: "420", unitAsWritten: "MPa", valueAsWritten: "420 MPa", from: GRAMMAR_VARIANTS[4] as SheetText }),
]);

/** The probes that state one kind alone, so a sentence can be handed to the grammar by itself. */
export function variantsOf(text: SheetText): ExpectedProposal[] {
  return EXPECTED_VARIANT_PROPOSALS.filter((one) => one.from.sourceKey === text.sourceKey);
}
