// The product's grammar reads a question first (docs/design/s-ask.md I-396): it matches the words
// against THIS project's vocabulary — its marks, its level labels and their aliases (I-400), the
// catalogue's classes and kinds in the Dhaka words for them, the note kinds — and against each
// intent's cue words (§1.2). Exactly one intent with every subject resolved to one the project holds
// is a READING, answered with no model call. Anything else is a clarify (at most two readings, the
// person disposes), or a refusal by name. The model routes nothing here: what the grammar cannot
// settle is ASK-2's closed choice, and until it lands the grammar's own clarify or refusal stands.
//
// Where cues overlap, the more specific reading wins and the rule is code's (§1.2): a refusal cue
// outranks every answer; a member-type cue beside a mark outranks a kind word; a "total" beside
// exactly one class is a quantity; cues that still name two intents are a compound question.
//
// Pure: a question and a vocabulary in, an outcome out. Words are whole words of the normalised
// question, never substrings (`C3` is never read inside `PC3`).
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import {
  ASK_BREAKDOWNS,
  ASK_INTENTS,
  ASK_REFUSAL_CODES,
  FOUNDATION_SLOT,
  isAskIntent,
  type AskAnswer,
  type AskBreakdown,
  type AskGloss,
  type AskHeld,
  type AskIntent,
  type AskOffered,
  type AskReading,
  type AskRefused,
} from "./law";
import {
  BY_LEVEL_PHRASES,
  BY_MARK_PHRASES,
  CLASS_WORDS,
  ASKED_UNIT_DIMENSIONS,
  CONCRETE_WORDS,
  DIMENSION_WORDS,
  DISCIPLINE_WORDS,
  ESTIMATE_CUES,
  FLOOR_WORDS,
  FOUNDATION_LABELS,
  FOUNDATION_PHRASES,
  GROUND_LABELS,
  GROUND_PHRASES,
  INTENT_CUES,
  JOINING_WORDS,
  JUDGEMENT_CUES,
  KIND_WORDS,
  LEVEL_WORDS,
  NOTE_KIND_WORDS,
  ORDINAL_WORDS,
  RANGE_WORDS,
  ROOF_LABELS,
  ROOF_PHRASES,
  STEEL_WORDS,
  STRENGTH_WORDS,
  UNITS_ASKED,
  WALL_CLASSES,
  WALL_WORDS,
  WHAT_IS_PHRASES,
  type AskVocabulary,
} from "./vocabulary";

/** What the grammar makes of a question: a reading, or the answer it already is (clarify, refusal). */
export type GrammarOutcome =
  | { readonly outcome: "READ"; readonly reading: AskReading; readonly followUp: boolean }
  | Extract<AskAnswer, { outcome: "CLARIFY" }>
  | AskRefused;

/** A reading with nothing named yet: every subject slot empty. */
export function blankReading(intent: AskIntent): AskReading {
  return { intent, class: null, kind: null, mark: null, level: null, by: null, noteKind: null, discipline: null, unitAsked: null };
}

/* ----------------------------------------------------------------------------- the words */

/** Contractions whose `'s` is a verb, not a possessive — kept whole. */
const KEPT_CONTRACTIONS = new Set(["what's", "it's", "that's", "there's", "where's", "how's", "who's", "here's", "let's"]);

/**
 * The question as whole words: folded to lower case, the typographer's quotes read as the plain one,
 * a possessive `'s` dropped (`C4's` is `C4`), and everything that is not a letter or a digit a gap —
 * so `G.F.` is `g f`, `C-3` is `c 3` and `floor-to-floor` is `floor to floor`.
 */
export function wordsOf(question: string): string[] {
  const folded = question.normalize("NFKC").toLowerCase().replace(/[’‘´`ʹ]/gu, "'");
  const raw = folded.match(/৳|[a-z0-9]+(?:'[a-z]+)?/gu) ?? [];
  return raw.map((word) => (word.endsWith("'s") && !KEPT_CONTRACTIONS.has(word) ? word.slice(0, -2) : word));
}

/** A label or a mark as it is compared: upper case, nothing but letters and digits. */
export function compact(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/gu, "");
}

/** The words of one question, and which of them a subject has already taken. */
class Words {
  readonly words: readonly string[];
  private readonly taken: boolean[];

  constructor(words: readonly string[]) {
    this.words = words;
    this.taken = words.map(() => false);
  }

  /** Where a phrase stands among the words not yet taken, or -1. */
  find(phrase: string): number {
    const parts = phrase.split(" ");
    for (let at = 0; at + parts.length <= this.words.length; at += 1) {
      let fits = true;
      for (let offset = 0; offset < parts.length; offset += 1) {
        if (this.taken[at + offset] === true || this.words[at + offset] !== parts[offset]) {
          fits = false;
          break;
        }
      }
      if (fits) return at;
    }
    return -1;
  }

  /** Whether a phrase stands in the question at all, taken or not — how a cue is read. */
  says(phrase: string): boolean {
    return ` ${this.words.join(" ")} `.includes(` ${phrase} `);
  }

  /** Take a phrase where it stands; whether it stood. */
  take(phrase: string): boolean {
    const at = this.find(phrase);
    if (at < 0) return false;
    this.takeAt(at, phrase.split(" ").length);
    return true;
  }

  takeAt(at: number, length: number): void {
    for (let offset = 0; offset < length; offset += 1) this.taken[at + offset] = true;
  }

  isTaken(at: number): boolean {
    return this.taken[at] === true;
  }
}

/** Every (member, phrase) pair of a roster, longest phrase first — so `pile cap` is read before `pile`. */
function longestFirst<K extends string>(roster: Readonly<Record<K, readonly string[]>>): { key: K; phrase: string }[] {
  const pairs: { key: K; phrase: string }[] = [];
  for (const key of Object.keys(roster) as K[]) for (const phrase of roster[key]) pairs.push({ key, phrase });
  return pairs.sort((left, right) => right.phrase.split(" ").length - left.phrase.split(" ").length || right.phrase.length - left.phrase.length);
}

/** Take every member of a roster the words name, in the order they stand in the question. */
function takeAll<K extends string>(words: Words, roster: Readonly<Record<K, readonly string[]>>): K[] {
  const found: { key: K; at: number }[] = [];
  for (const { key, phrase } of longestFirst(roster)) {
    for (;;) {
      const at = words.find(phrase);
      if (at < 0) break;
      words.takeAt(at, phrase.split(" ").length);
      found.push({ key, at });
    }
  }
  const ordered: K[] = [];
  for (const { key } of found.sort((left, right) => left.at - right.at)) if (!ordered.includes(key)) ordered.push(key);
  return ordered;
}

/* ----------------------------------------------------------------------------- the levels */

/** One label a level named may be, with the count it is read by where it was counted (I-400). */
type LevelOffer = { readonly label: string; readonly gloss: AskGloss | null };

/** What the words make of a level: one label, a clarify between two, one the stack does not hold. */
type LevelRead =
  | { readonly read: "LEVEL"; readonly label: string }
  | { readonly read: "CLARIFY"; readonly offered: readonly LevelOffer[] }
  | { readonly read: "UNKNOWN" };

/**
 * One level a question names, where its words start, and the count it was named in — `FLOOR` for
 * `Nth floor` and a stack label spelled `NF`, `LEVEL` for `level N` — which a bare number joined to
 * it is read in too (I-494).
 */
type LevelMention = { readonly at: number; readonly count: "FLOOR" | "LEVEL" | null; readonly level: LevelRead };

/** The stack's label a compact spelling names, or null. */
function heldLabel(vocabulary: AskVocabulary, spelled: string): string | null {
  const wanted = compact(spelled);
  if (wanted.length === 0) return null;
  return vocabulary.levels.find((label) => compact(label) === wanted) ?? null;
}

/** The first of several labels the stack holds. */
function firstHeld(vocabulary: AskVocabulary, labels: readonly string[]): string | null {
  for (const label of labels) {
    const held = heldLabel(vocabulary, label);
    if (held !== null) return held;
  }
  return null;
}

/** A number as a question writes one: digits, a digit ordinal (`5th`), or an ordinal word. */
function numberOf(word: string | undefined): number | null {
  if (word === undefined) return null;
  const digits = /^(\d{1,3})(?:st|nd|rd|th)?$/u.exec(word);
  if (digits !== null) return Number(digits[1]);
  const at = ORDINAL_WORDS.indexOf(word);
  return at < 0 ? null : at + 1;
}

/** The foundation, where a question names it: the stack's own label, else the register's slot (I-400). */
function foundationOf(vocabulary: AskVocabulary): string | null {
  return firstHeld(vocabulary, FOUNDATION_LABELS) ?? (vocabulary.foundationSlot ? FOUNDATION_SLOT : null);
}

/** `Nth floor`: `NF`, the British count a Dhaka drawing uses — or UNKNOWN where the stack holds none. */
function floorCounted(n: number, vocabulary: AskVocabulary): LevelRead {
  const label = heldLabel(vocabulary, `${n}F`);
  return label === null ? { read: "UNKNOWN" } : { read: "LEVEL", label };
}

/**
 * `level N`: `LN` or `LEVEL N` where the stack holds one verbatim; otherwise a clarify between `NF`
 * (N floors above the ground floor, so `level 0` is the ground floor) and the stack's Nth storey
 * counted with the ground floor as level 1, each offered only where the stack holds it (I-400).
 */
function levelCounted(n: number, vocabulary: AskVocabulary): LevelRead {
  const verbatim = heldLabel(vocabulary, `L${n}`) ?? heldLabel(vocabulary, `LEVEL${n}`);
  if (verbatim !== null) return { read: "LEVEL", label: verbatim };
  const offered: LevelOffer[] = [];
  const ground = firstHeld(vocabulary, GROUND_LABELS);
  const floor = n === 0 ? ground : heldLabel(vocabulary, `${n}F`);
  if (floor !== null) offered.push({ label: floor, gloss: { count: "FLOOR", n, label: floor } });
  const groundAt = ground === null ? -1 : vocabulary.levels.indexOf(ground);
  const storey = groundAt < 0 ? undefined : vocabulary.levels[groundAt + n - 1];
  if (storey !== undefined && storey !== floor) offered.push({ label: storey, gloss: { count: "STOREY", n, label: storey } });
  return offered.length === 0 ? { read: "UNKNOWN" } : { read: "CLARIFY", offered };
}

/**
 * A word shaped like a label of the stack's own notation (`9F`, `10fl`), which the stack may not
 * hold: read as a level the stack does not hold, never passed over (I-400). A basement's `B2` is one
 * only where the stack spells its basements so — otherwise it is a mark's shape (a beam's `B2`).
 */
const LEVEL_SHAPE = /^\d{1,3}(?:f|fl|flr)$/u;
const BASEMENT_SHAPE = /^b\d{1,2}$/u;

/**
 * The first level the words not yet taken name (I-400), taking its words — or null where they name
 * none:
 * - the stack's own label, in any case, with or without a space or a dot (`5F`, `5 f`, `G.F.`, `fdn`);
 * - the ground floor's, the roof's (`roof`, `RF`) and the foundation's words;
 * - `Nth floor` / `floor N` (digits or words) — `NF`, the British count a Dhaka drawing uses;
 * - `level N` / `L N` / `lvl N` — `levelCounted`: never a silent alias, the ambiguity is the person's.
 * An alias the stack does not hold, and a word shaped like one of its labels that it does not hold
 * (`9F` on a stack that stops at `6F`), is UNKNOWN: the refusal lists the labels it does hold.
 */
function readLevel(words: Words, vocabulary: AskVocabulary, marks: ReadonlySet<string>): LevelMention | null {
  const all = words.words;

  // `level N`, `lvl N`, `L N`, and the one-word `level5` / `lvl5` / `l5` (where no mark is spelled so).
  for (let at = 0; at < all.length; at += 1) {
    if (words.isTaken(at)) continue;
    const word = all[at] as string;
    let n: number | null = null;
    let length = 0;
    if (LEVEL_WORDS.includes(word) && !words.isTaken(at + 1) && !marks.has(compact(`${word}${all[at + 1] ?? ""}`))) {
      n = numberOf(all[at + 1]);
      length = 2;
    } else {
      const joined = /^(?:level|lvl|l)(\d{1,3})$/u.exec(word);
      if (joined !== null && !marks.has(compact(word))) {
        n = Number(joined[1]);
        length = 1;
      }
    }
    if (n === null) continue;
    words.takeAt(at, length);
    return { at, count: "LEVEL", level: levelCounted(n, vocabulary) };
  }

  // `Nth floor`, `floor N`, `fifth storey`.
  for (let at = 0; at < all.length; at += 1) {
    if (words.isTaken(at) || !FLOOR_WORDS.includes(all[at] as string)) continue;
    const before = at > 0 && !words.isTaken(at - 1) ? numberOf(all[at - 1]) : null;
    const after = before === null && !words.isTaken(at + 1) ? numberOf(all[at + 1]) : null;
    const n = before ?? after;
    if (n === null) continue;
    const from = before === null ? at : at - 1;
    words.takeAt(from, 2);
    return { at: from, count: "FLOOR", level: floorCounted(n, vocabulary) };
  }

  // The ground floor, the roof, the foundation, by their words.
  for (const [phrases, labels] of [
    [GROUND_PHRASES, GROUND_LABELS],
    [ROOF_PHRASES, ROOF_LABELS],
  ] as const) {
    for (const phrase of phrases) {
      const at = words.find(phrase);
      if (at < 0) continue;
      words.takeAt(at, phrase.split(" ").length);
      const label = firstHeld(vocabulary, labels);
      return { at, count: null, level: label === null ? { read: "UNKNOWN" } : { read: "LEVEL", label } };
    }
  }
  for (const phrase of FOUNDATION_PHRASES) {
    const at = words.find(phrase);
    if (at < 0) continue;
    words.takeAt(at, phrase.split(" ").length);
    const label = foundationOf(vocabulary);
    return { at, count: null, level: label === null ? { read: "UNKNOWN" } : { read: "LEVEL", label } };
  }

  // The stack's own label, one word or two (`5F`, `5 f`, `g f`) — or a word shaped like one it does not hold.
  const basements = vocabulary.levels.some((label) => /^B\d{1,2}$/u.test(compact(label)));
  const countOf = (label: string): "FLOOR" | null => (/^\d{1,3}F$/u.test(compact(label)) ? "FLOOR" : null);
  for (let at = 0; at < all.length; at += 1) {
    if (words.isTaken(at)) continue;
    const one = all[at] as string;
    if (!marks.has(compact(one))) {
      const label = heldLabel(vocabulary, one);
      if (label !== null && /\d|^[a-z]{2,}$/u.test(one)) {
        words.takeAt(at, 1);
        return { at, count: countOf(label), level: { read: "LEVEL", label } };
      }
      if (LEVEL_SHAPE.test(one) || (basements && BASEMENT_SHAPE.test(one))) {
        words.takeAt(at, 1);
        return { at, count: "FLOOR", level: { read: "UNKNOWN" } };
      }
    }
    const next = all[at + 1];
    if (next !== undefined && !words.isTaken(at + 1)) {
      const label = heldLabel(vocabulary, `${one}${next}`);
      if (label !== null && one.length <= 2 && next.length <= 2 && !marks.has(compact(`${one}${next}`))) {
        words.takeAt(at, 2);
        return { at, count: countOf(label), level: { read: "LEVEL", label } };
      }
      if (/^\d{1,3}$/u.test(one) && (next === "f" || next === "fl")) {
        words.takeAt(at, 2);
        return { at, count: "FLOOR", level: { read: "UNKNOWN" } };
      }
    }
  }
  return null;
}

/**
 * Every level the question names, in the order it names them (I-494). Where one of them was
 * counted, a bare number beside `and`, `or` or a range word, or beside a level already read (the
 * list `floors 1, 2, 3`, its commas gaps), is a level of the same count — `floor 5 and 6` is 5F and
 * 6F — unless it completes a mark the register holds (`c 3`). Only level words are taken when this
 * runs, so a taken neighbour is a level's.
 */
function readLevels(words: Words, vocabulary: AskVocabulary, marks: ReadonlySet<string>): LevelMention[] {
  const mentions: LevelMention[] = [];
  for (let one = readLevel(words, vocabulary, marks); one !== null; one = readLevel(words, vocabulary, marks)) mentions.push(one);
  const counted = mentions.find((mention) => mention.count !== null);
  if (counted !== undefined) {
    const all = words.words;
    for (let joinedOne = true; joinedOne; ) {
      joinedOne = false;
      for (let at = 0; at < all.length; at += 1) {
        if (words.isTaken(at)) continue;
        const n = numberOf(all[at]);
        if (n === null) continue;
        const joined = [at - 1, at + 1].some((beside) => {
          const word = all[beside];
          return word !== undefined && (JOINING_WORDS.includes(word) || words.isTaken(beside));
        });
        const markPart = at > 0 && marks.has(compact(`${all[at - 1] as string}${all[at] as string}`));
        if (!joined || markPart) continue;
        words.takeAt(at, 1);
        joinedOne = true;
        mentions.push({ at, count: counted.count, level: counted.count === "LEVEL" ? levelCounted(n, vocabulary) : floorCounted(n, vocabulary) });
      }
    }
  }
  return mentions.sort((left, right) => left.at - right.at);
}

/** Whether a range word stands between two of the levels named: `from GF to 6F` is a range. */
function namesARange(words: Words, mentions: readonly LevelMention[]): boolean {
  if (mentions.length < 2) return false;
  const first = (mentions[0] as LevelMention).at;
  const last = (mentions[mentions.length - 1] as LevelMention).at;
  return words.words.some((word, at) => at > first && at < last && RANGE_WORDS.includes(word));
}

/* ----------------------------------------------------------------------------- the marks */

/** A word shaped like a mark (`C9`, `PC3`, `RB12`, `C1A`): letters, then digits, then at most a letter. */
const MARK_SHAPE = /^[a-z]{1,4}\d{1,3}[a-z]?$/u;

/** Words shaped like a mark that are units, never marks. */
const NOT_MARKS = new Set(["m2", "m3", "mm2", "cm2", "m1"]);

/**
 * Every mark a question names, in the order it names them, matched whole and normalised (`C-3`,
 * `c 3` → `C3` only where the register holds `C3`) and as a word — `C3` never inside `PC3`. A word
 * shaped like a mark that the register does not hold is UNKNOWN, never a near one — beside a mark it
 * does hold as much as alone (`C3 and C9`).
 */
function readMarks(words: Words, vocabulary: AskVocabulary): { readonly read: "MARKS"; readonly marks: readonly string[] } | { readonly read: "UNKNOWN" } {
  const held = new Map([...vocabulary.marks.keys()].map((mark) => [compact(mark), mark]));
  const all = words.words;
  const marks: string[] = [];
  for (let at = 0; at < all.length; at += 1) {
    if (words.isTaken(at)) continue;
    const one = all[at] as string;
    const whole = held.get(compact(one));
    if (whole !== undefined && /\d/u.test(one)) {
      words.takeAt(at, 1);
      if (!marks.includes(whole)) marks.push(whole);
      continue;
    }
    const next = all[at + 1];
    if (next !== undefined && !words.isTaken(at + 1) && /^[a-z]{1,4}$/u.test(one) && /^\d{1,3}[a-z]?$/u.test(next)) {
      const joined = held.get(compact(`${one}${next}`));
      if (joined !== undefined) {
        words.takeAt(at, 2);
        if (!marks.includes(joined)) marks.push(joined);
      }
    }
  }
  for (let at = 0; at < all.length; at += 1) {
    if (words.isTaken(at)) continue;
    const one = all[at] as string;
    if (MARK_SHAPE.test(one) && !NOT_MARKS.has(one)) return { read: "UNKNOWN" };
  }
  return { read: "MARKS", marks };
}

/* ----------------------------------------------------------------------------- the slots */

/** A level the question named: one label, or the two counts it may be read by (I-400). */
type NamedLevel = Extract<LevelRead, { read: "LEVEL" | "CLARIFY" }>;

/** Everything the words name, before an intent is chosen — every subject of a slot, in the order named. */
type Slots = {
  readonly classes: readonly ElementType[];
  /** `wall` named where the register holds both wall classes: the person chooses. */
  readonly wallChoice: readonly ElementType[] | null;
  readonly kinds: readonly Kind[];
  readonly marks: readonly string[];
  readonly levels: readonly NamedLevel[];
  readonly noteKinds: readonly NoteKind[];
  /** `strength`, `grade`, `psi` or `MPa` with no material beside it: concrete's or steel's. */
  readonly strengthChoice: boolean;
  readonly disciplines: readonly Discipline[];
  readonly by: AskBreakdown | null;
  readonly unitAsked: string | null;
  /** The unit a `length`, an `area`, a `volume` or a unit in feet names (I-494). */
  readonly dimension: string | null;
};

/** A refusal naming what the project holds of the subject it did not know. */
function unknownSubject(held: AskHeld, reading: AskReading | null = null): AskRefused {
  return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, reading, held };
}

/** A refusal with nothing beneath it. */
function refused(code: AskRefused["code"], reading: AskReading | null = null): AskRefused {
  return { outcome: "REFUSED", code, reading, held: null };
}

/** The marks the register holds, of one class or of every class. */
export function heldMarks(vocabulary: AskVocabulary, klass: ElementType | null): AskHeld {
  const items = [...vocabulary.marks.entries()].filter(([, classes]) => klass === null || classes.includes(klass)).map(([mark]) => mark);
  return { subject: "MARKS", class: klass, items };
}

/** The labels the stack holds, from the ground up, and the foundation slot where objects are filed in it. */
export function heldLevels(vocabulary: AskVocabulary): AskHeld {
  return { subject: "LEVELS", class: null, items: vocabulary.foundationSlot && !vocabulary.levels.includes(FOUNDATION_SLOT) ? [FOUNDATION_SLOT, ...vocabulary.levels] : [...vocabulary.levels] };
}

/** Read every subject a question names, or the refusal a subject it names unknown earns. */
function readSlots(words: Words, vocabulary: AskVocabulary): Slots | AskRefused {
  const markSet = new Set([...vocabulary.marks.keys()].map(compact));
  const mentions = readLevels(words, vocabulary, markSet);
  if (mentions.some((mention) => mention.level.read === "UNKNOWN")) return unknownSubject(heldLevels(vocabulary));
  // A range of levels is a question no one reading holds: it is not guessed at as either end (I-494).
  if (namesARange(words, mentions)) return refused(ASK_REFUSAL_CODES.notUnderstood);
  const levels: NamedLevel[] = [];
  for (const { level } of mentions) {
    if (level.read === "UNKNOWN") continue;
    const same = levels.some((held) => held.read === "LEVEL" && level.read === "LEVEL" && held.label === level.label);
    if (!same) levels.push(level);
  }

  // The note kinds before the kinds: `concrete strength` is FC, not concrete.
  const noteKinds = takeAll(words, NOTE_KIND_WORDS);
  const unitAsked = takeAll(words, Object.fromEntries(Object.keys(UNITS_ASKED).map((spelling) => [spelling, [spelling]])) as Record<string, readonly string[]>)[0];
  // The classes before a strength is read: `grade beams` are tie beams, not a grade of anything.
  const classes = takeAll(words, CLASS_WORDS);
  let wallChoice: ElementType[] | null = null;
  if (WALL_WORDS.some((word) => words.take(word))) {
    const held = WALL_CLASSES.filter((klass) => vocabulary.classes.has(klass));
    const candidates = held.length === 0 ? [...WALL_CLASSES] : held;
    if (candidates.length === 1) {
      if (!classes.includes(candidates[0] as ElementType)) classes.push(candidates[0] as ElementType);
    } else wallChoice = candidates;
  }

  // `strength` or `grade` beside a material settles the note kind; with none beside it, the person does.
  let strengthChoice = false;
  const strength = STRENGTH_WORDS.find((word) => words.find(word) >= 0);
  if (noteKinds.length === 0 && strength !== undefined) {
    words.take(strength);
    const concrete = CONCRETE_WORDS.find((word) => words.find(word) >= 0);
    const steel = STEEL_WORDS.find((word) => words.find(word) >= 0);
    if (concrete !== undefined && steel === undefined) {
      noteKinds.push("FC");
      words.take(concrete);
    } else if (steel !== undefined && concrete === undefined) {
      noteKinds.push("FY");
      words.take(steel);
    } else strengthChoice = true;
  }
  const kinds = takeAll(words, KIND_WORDS);
  const marks = readMarks(words, vocabulary);
  if (marks.read === "UNKNOWN") return unknownSubject(heldMarks(vocabulary, classes.length === 1 ? (classes[0] as ElementType) : null));

  const disciplines = takeAll(words, DISCIPLINE_WORDS);
  const by: AskBreakdown | null = BY_LEVEL_PHRASES.some((phrase) => words.says(phrase)) ? "LEVEL" : BY_MARK_PHRASES.some((phrase) => words.says(phrase)) ? "MARK" : null;
  const named = Object.keys(DIMENSION_WORDS).find((word) => words.find(word) >= 0);
  const asked = unitAsked === undefined ? null : (UNITS_ASKED[unitAsked] ?? null);

  return {
    classes,
    wallChoice,
    kinds,
    marks: marks.marks,
    levels,
    noteKinds,
    strengthChoice,
    disciplines,
    by,
    unitAsked: asked,
    dimension: named !== undefined ? (DIMENSION_WORDS[named] ?? null) : asked === null ? null : (ASKED_UNIT_DIMENSIONS[asked] ?? null),
  };
}

/** The one label the question named, where it named exactly one and it is no choice. */
function levelOf(slots: Slots): string | null {
  const only = slots.levels.length === 1 ? slots.levels[0] : undefined;
  return only?.read === "LEVEL" ? only.label : null;
}

/** Whether the words named any subject at all — what a follow-up needs to be one. */
function namesASubject(slots: Slots): boolean {
  return slots.classes.length > 0 || slots.wallChoice !== null || slots.kinds.length > 0 || slots.marks.length > 0 || slots.levels.length > 0 || slots.noteKinds.length > 0;
}

/* ----------------------------------------------------------------------------- the intents */

/**
 * The intents a question's cue words name, after the precedence §1.2 holds: code's rule, never a
 * model's. What is left is one intent, two (a compound question), or none.
 */
function intentsOf(words: Words, slots: Slots): AskIntent[] {
  const cued = new Set<AskIntent>(ASK_INTENTS.filter((intent) => INTENT_CUES[intent].some((cue) => words.says(cue))));
  if (WHAT_IS_PHRASES.some((phrase) => words.says(phrase)) && slots.kinds.length > 0) cued.add("QUANTITY");
  // "List the structural sheets": the sheets asked after, whatever words stand between.
  if (words.says("sheets") && ["list", "which", "what", "show"].some((word) => words.says(word))) cued.add("SHEET_LIST");

  if (cued.has("SHEET_LIST")) return ["SHEET_LIST"];
  // A note kind named outright is the note's, whatever else cued: `lap length` is no quantity.
  if (slots.noteKinds.length > 0 || slots.strengthChoice) {
    cued.add("NOTE");
    for (const intent of ["QUANTITY", "COUNT", "MEASURED_SO_FAR"] as const) cued.delete(intent);
    if (slots.marks.length === 0) cued.delete("MEMBER_TYPE");
  } else if (cued.has("NOTE") && !["notes", "note", "general notes", "specify", "specified", "specifies"].some((word) => words.says(word))) {
    cued.delete("NOTE");
  }
  if (cued.has("LEVEL_HEIGHT")) cued.delete("QUANTITY");
  if (cued.has("MEMBER_TYPE")) {
    if (slots.marks.length > 0) {
      for (const intent of ["QUANTITY", "COUNT", "NOTE", "MARKS"] as const) cued.delete(intent);
    } else if (cued.size > 1) cued.delete("MEMBER_TYPE");
  }
  if (cued.has("WHY_NOT_MEASURED")) for (const intent of ["QUANTITY", "COUNT", "MEASURED_SO_FAR", "MARKS"] as const) cued.delete(intent);
  if (cued.has("MARKS")) {
    cued.delete("COUNT");
    // A kind asked by mark is a quantity broken down by mark, not a count of marks.
    if (slots.kinds.length > 0 && !words.says("how many")) {
      cued.delete("MARKS");
      cued.add("QUANTITY");
    }
  }
  if (cued.has("MEASURED_SO_FAR")) {
    if (slots.classes.length === 1 || slots.marks.length > 0) {
      cued.delete("MEASURED_SO_FAR");
      cued.add("QUANTITY");
    } else cued.delete("QUANTITY");
  }
  if (cued.size === 0 && slots.kinds.length > 0) cued.add("QUANTITY");
  return ASK_INTENTS.filter((intent) => cued.has(intent));
}

/* ----------------------------------------------------------------------------- the reading */

/** What completing a reading makes of it: the reading, or the clarify or refusal it becomes. */
type Completed = { readonly outcome: "READ"; readonly reading: AskReading } | Extract<AskAnswer, { outcome: "CLARIFY" }> | AskRefused;

/** A clarify offering these readings, in the order given. */
function clarify(lead: "AMBIGUOUS" | "COMPOUND", offered: readonly AskOffered[]): Extract<AskAnswer, { outcome: "CLARIFY" }> {
  return { outcome: "CLARIFY", lead, offered: offered.slice(0, 2) };
}

/**
 * One intent's reading, completed against the project (I-396): the class a mark is borne by, the kind
 * a class's only lines are of — or its only lines in the unit a question's `length`, `area` or `volume`
 * names (I-494) — a quantity with no class read across classes as measured so far. Where a subject
 * is still two things, the person chooses (a clarify of at most two); where the intent needs a subject
 * nobody named, it is not understood — never guessed.
 */
export function completeReading(draft: AskReading, vocabulary: AskVocabulary, dimension: string | null = null): Completed {
  let reading = draft;

  if (reading.mark !== null) {
    const bearing = vocabulary.marks.get(reading.mark);
    if (bearing === undefined) return unknownSubject(heldMarks(vocabulary, reading.class), reading);
    if (reading.class !== null && !bearing.includes(reading.class)) return unknownSubject(heldMarks(vocabulary, reading.class), reading);
    if (reading.class === null && bearing.length === 1) reading = { ...reading, class: bearing[0] as ElementType };
  }
  if (reading.level !== null && !vocabulary.levels.includes(reading.level) && !(reading.level === FOUNDATION_SLOT && vocabulary.foundationSlot)) {
    return unknownSubject(heldLevels(vocabulary), reading);
  }

  switch (reading.intent) {
    case "COUNT":
      if (reading.class === null && reading.mark === null) return refused(ASK_REFUSAL_CODES.notUnderstood, reading);
      return { outcome: "READ", reading: { ...reading, kind: null, noteKind: null } };
    case "MARKS":
      return { outcome: "READ", reading: { ...reading, kind: null, mark: null, by: "MARK", noteKind: null } };
    case "QUANTITY": {
      if (reading.class === null) {
        if (reading.kind === null) return refused(ASK_REFUSAL_CODES.notUnderstood, reading);
        // A kind asked of no class is that kind measured so far across the classes (I-399).
        return { outcome: "READ", reading: { ...reading, intent: "MEASURED_SO_FAR", mark: null } };
      }
      if (reading.kind === null) {
        const held = vocabulary.kindsOf.get(reading.class) ?? [];
        const units = vocabulary.unitsOf.get(reading.class);
        const kinds = dimension === null ? held : held.filter((kind) => units?.get(kind) === dimension);
        // A length of a class none of whose lines is measured in metres is not measured, never its concrete.
        if (dimension !== null && held.length > 0 && kinds.length === 0) return refused(ASK_REFUSAL_CODES.notMeasured, reading);
        if (kinds.length === 1) return { outcome: "READ", reading: { ...reading, kind: kinds[0] as Kind } };
        if (kinds.length >= 2) return clarify("AMBIGUOUS", kinds.slice(0, 2).map((kind) => ({ reading: { ...reading, kind }, gloss: null })));
      }
      return { outcome: "READ", reading };
    }
    case "MEASURED_SO_FAR":
      return { outcome: "READ", reading: { ...reading, class: null, mark: null, by: null } };
    case "WHY_NOT_MEASURED":
      return { outcome: "READ", reading: { ...reading, by: null } };
    case "MEMBER_TYPE":
      if (reading.mark === null) return refused(ASK_REFUSAL_CODES.notUnderstood, reading);
      return { outcome: "READ", reading: { ...reading, kind: null, level: null, by: null } };
    case "NOTE":
      return { outcome: "READ", reading: { ...blankReading("NOTE"), noteKind: reading.noteKind } };
    case "LEVEL_HEIGHT":
      return { outcome: "READ", reading: { ...blankReading("LEVEL_HEIGHT"), level: reading.level } };
    case "SHEET_LIST":
      return { outcome: "READ", reading: { ...blankReading("SHEET_LIST"), discipline: reading.discipline } };
  }
}

/** The draft reading of one intent over what the words named: each slot's first subject, a level only where one was named. */
function draftOf(intent: AskIntent, slots: Slots): AskReading {
  return {
    intent,
    class: slots.classes.length === 1 ? (slots.classes[0] as ElementType) : null,
    kind: slots.kinds[0] ?? null,
    mark: slots.marks[0] ?? null,
    level: levelOf(slots),
    by: slots.by,
    noteKind: slots.noteKinds[0] ?? null,
    discipline: slots.disciplines[0] ?? null,
    unitAsked: slots.unitAsked,
  };
}

/** A completed reading, carrying whether it was read as a follow-up. */
function asRead(completed: Completed, followUp: boolean): GrammarOutcome {
  return completed.outcome === "READ" ? { outcome: "READ", reading: completed.reading, followUp } : completed;
}

/** The slots each intent's reading keeps: a second subject in any of them is a second question. */
const SLOTS_READ: Readonly<Record<AskIntent, readonly ("class" | "mark" | "level" | "kind" | "noteKind" | "discipline")[]>> = Object.freeze({
  COUNT: ["class", "mark", "level"],
  MARKS: ["class", "level"],
  QUANTITY: ["class", "mark", "level", "kind"],
  MEASURED_SO_FAR: ["class", "mark", "level", "kind"],
  WHY_NOT_MEASURED: ["class", "mark", "level", "kind"],
  MEMBER_TYPE: ["mark"],
  NOTE: ["noteKind"],
  LEVEL_HEIGHT: ["level"],
  SHEET_LIST: ["discipline"],
});

/** The subjects the words named in each slot a reading keeps — the wall a clarify would ask about counted as a class. */
function subjectsOf(slots: Slots): { class: readonly ElementType[]; mark: readonly string[]; level: readonly NamedLevel[]; kind: readonly Kind[]; noteKind: readonly NoteKind[]; discipline: readonly Discipline[] } {
  const walls = slots.wallChoice !== null && slots.classes.length > 0 ? [slots.wallChoice[0] as ElementType] : [];
  return { class: [...slots.classes, ...walls], mark: slots.marks, level: slots.levels, kind: slots.kinds, noteKind: slots.noteKinds, discipline: slots.disciplines };
}

/**
 * A question naming two subjects in one slot its reading keeps — two marks, two levels, two classes,
 * two kinds, two note kinds, two disciplines — asks two things, and is a clarify of the two readings
 * (§1.2's compound questions, I-494): the first reading takes the first of each doubled slot, the
 * second the second, so `C3 on 5F and C4 on 6F` pairs as it was said; a mark named once goes with the
 * class that bears it (`C3 columns and pile caps`); measured so far over two named classes is each
 * class's quantity. Never one subject answered in place of both, and never every subject in place of
 * the two named. Where a reading is itself refused, the refusal stands by its name; where it is itself
 * a choice, or a slot names three subjects, the question needs more readings than a clarify holds and
 * is not understood. Null where no slot the intent keeps names two subjects.
 */
function compoundOf(draft: AskReading, slots: Slots, vocabulary: AskVocabulary, followUp: boolean): GrammarOutcome | null {
  const subjects = subjectsOf(slots);
  const doubled = SLOTS_READ[draft.intent].filter((slot) => subjects[slot].length >= 2);
  if (doubled.length === 0) return null;
  // Three subjects in a slot are three questions: a clarify offers two, and the third is never dropped.
  if (doubled.some((slot) => subjects[slot].length > 2)) return refused(ASK_REFUSAL_CODES.notUnderstood);
  const pick = (index: 0 | 1): AskOffered | AskRefused => {
    let reading: AskReading = { ...draft };
    for (const slot of doubled) {
      if (slot === "class") reading = { ...reading, class: subjects.class[index] as ElementType };
      if (slot === "mark") reading = { ...reading, mark: subjects.mark[index] as string };
      if (slot === "kind") reading = { ...reading, kind: subjects.kind[index] as Kind };
      if (slot === "noteKind") reading = { ...reading, noteKind: subjects.noteKind[index] as NoteKind };
      if (slot === "discipline") reading = { ...reading, discipline: subjects.discipline[index] as Discipline };
      if (slot === "level") {
        const level = subjects.level[index] as NamedLevel;
        // A level that is itself counted two ways inside a two-part question: more than two readings.
        if (level.read === "CLARIFY") return refused(ASK_REFUSAL_CODES.notUnderstood);
        reading = { ...reading, level: level.label };
      }
    }
    if (doubled.includes("class") && !doubled.includes("mark") && reading.mark !== null && reading.class !== null && !(vocabulary.marks.get(reading.mark) ?? []).includes(reading.class)) {
      reading = { ...reading, mark: null };
    }
    if (doubled.includes("class") && reading.intent === "MEASURED_SO_FAR") reading = { ...reading, intent: "QUANTITY" };
    const completed = completeReading(reading, vocabulary, slots.dimension);
    if (completed.outcome === "REFUSED") return completed;
    if (completed.outcome === "CLARIFY") return refused(ASK_REFUSAL_CODES.notUnderstood);
    return { reading: completed.reading, gloss: null };
  };
  const first = pick(0);
  if ("outcome" in first) return first;
  const second = pick(1);
  if ("outcome" in second) return second;
  if (JSON.stringify(first.reading) === JSON.stringify(second.reading)) return { outcome: "READ", reading: first.reading, followUp };
  return clarify("COMPOUND", [first, second]);
}

/**
 * Complete a draft, first putting the choices the words left open to the person: two subjects in one
 * slot (a compound), a level counted two ways (I-400), `wall` where both wall classes are held, a
 * strength of concrete or of steel. A clarify holds one choice; a question leaving two open is not
 * understood — never answered for one part of it (I-494).
 */
function settle(draft: AskReading, slots: Slots, vocabulary: AskVocabulary, followUp: boolean): GrammarOutcome {
  const open: GrammarOutcome[] = [];
  const compound = compoundOf(draft, slots, vocabulary, followUp);
  if (compound !== null) open.push(compound);
  const only = slots.levels.length === 1 ? slots.levels[0] : undefined;
  if (only?.read === "CLARIFY" && SLOTS_READ[draft.intent].includes("level")) {
    open.push(clarify("AMBIGUOUS", only.offered.map((offer) => ({ reading: { ...draft, level: offer.label }, gloss: offer.gloss }))));
  }
  if (slots.wallChoice !== null && slots.classes.length === 0 && draft.class === null && SLOTS_READ[draft.intent].includes("class")) {
    open.push(clarify("AMBIGUOUS", slots.wallChoice.map((klass) => ({ reading: { ...draft, class: klass }, gloss: null }))));
  }
  if (draft.intent === "NOTE" && slots.strengthChoice && draft.noteKind === null) {
    open.push(clarify("AMBIGUOUS", (["FC", "FY"] as const).map((noteKind) => ({ reading: { ...blankReading("NOTE"), noteKind }, gloss: null }))));
  }
  if (open.length > 1) return refused(ASK_REFUSAL_CODES.notUnderstood);
  if (open.length === 1) return open[0] as GrammarOutcome;
  return asRead(completeReading(draft, vocabulary, slots.dimension), followUp);
}

/** Whether the words leave a choice open beyond the intents themselves: what a two-intent clarify cannot also hold. */
function leavesAChoice(intents: readonly AskIntent[], slots: Slots): boolean {
  const subjects = subjectsOf(slots);
  const keeps = (slot: keyof typeof subjects): boolean => intents.some((intent) => SLOTS_READ[intent].includes(slot));
  const doubled = (["class", "mark", "level", "kind", "noteKind", "discipline"] as const).some((slot) => keeps(slot) && subjects[slot].length >= 2);
  const counted = slots.levels.some((level) => level.read === "CLARIFY") && keeps("level");
  const wall = slots.wallChoice !== null && slots.classes.length === 0 && keeps("class");
  return doubled || counted || wall || (slots.strengthChoice && intents.includes("NOTE"));
}

/**
 * Read one question against one project's vocabulary (I-396). `previous` is the reading of the
 * answer before it — a question that names a subject and no intent ("and on 6F?") is read against it,
 * with that subject replaced (§1.2's follow-ups).
 */
export function readQuestion(question: string, vocabulary: AskVocabulary, previous: AskReading | null = null): GrammarOutcome {
  const words = new Words(wordsOf(question));
  // A refusal cue outranks every answer: a cost is never answered as a quantity (§1.2).
  if (ESTIMATE_CUES.some((cue) => words.says(cue))) return refused(ASK_REFUSAL_CODES.estimateNotBuilt);
  if (JUDGEMENT_CUES.some((cue) => words.says(cue))) return refused(ASK_REFUSAL_CODES.judgementNotOffered);

  const slots = readSlots(words, vocabulary);
  if ("outcome" in slots) return slots;
  const intents = intentsOf(words, slots);

  if (intents.length === 0) {
    if (previous === null || !namesASubject(slots)) return refused(ASK_REFUSAL_CODES.notUnderstood);
    // A follow-up: the previous reading with the subjects this question names put in their place.
    const firstMark = slots.marks[0] ?? null;
    const markClass = firstMark === null ? null : (vocabulary.marks.get(firstMark) ?? []);
    const klass = slots.classes.length === 1 ? (slots.classes[0] as ElementType) : markClass !== null && markClass.length === 1 ? (markClass[0] as ElementType) : null;
    const walls = slots.wallChoice !== null && slots.classes.length === 0;
    const draft: AskReading = {
      ...previous,
      class: walls || slots.classes.length >= 2 ? null : (klass ?? previous.class),
      mark: firstMark ?? (walls || slots.classes.length >= 2 || (klass !== null && klass !== previous.class) ? null : previous.mark),
      kind: slots.kinds[0] ?? previous.kind,
      level: slots.levels.length > 0 ? levelOf(slots) : previous.level,
      noteKind: slots.noteKinds[0] ?? previous.noteKind,
    };
    return settle(draft, slots, vocabulary, true);
  }
  if (intents.length >= 2) {
    if (leavesAChoice(intents, slots)) return refused(ASK_REFUSAL_CODES.notUnderstood);
    const offered: AskOffered[] = [];
    for (const intent of intents) {
      const one = completeReading(draftOf(intent, slots), vocabulary, slots.dimension);
      if (one.outcome === "READ" && !offered.some((held) => held.reading.intent === one.reading.intent)) offered.push({ reading: one.reading, gloss: null });
      if (offered.length === 2) break;
    }
    if (offered.length === 2) return clarify("COMPOUND", offered);
    if (offered.length === 1) return { outcome: "READ", reading: (offered[0] as AskOffered).reading, followUp: false };
    return refused(ASK_REFUSAL_CODES.notUnderstood);
  }
  return settle(draftOf(intents[0] as AskIntent, slots), slots, vocabulary, false);
}

/* ------------------------------------------------------------- what the machine is asked (ASK-2) */

/** The slots a subject may stand in, in the order the routing question lists them (I-397). */
export const ASK_SLOTS = ["class", "kind", "mark", "level", "noteKind", "discipline"] as const;

/** One of them. */
export type AskSlot = (typeof ASK_SLOTS)[number];

/** One subject the words name, by its slot and the project's own label for it. */
export type AskSubject = { readonly slot: AskSlot; readonly label: string };

/** What a routing chose beside the intent: for a slot the words named two subjects of, the one asked about. */
export type AskSlotChoice = Readonly<Partial<Record<AskSlot, string>>>;

/** The subjects the words name, slot by slot in `ASK_SLOTS` order, each in the order it was named. */
function subjectListOf(slots: Slots): AskSubject[] {
  const classes = [...slots.classes, ...(slots.wallChoice ?? []).filter((klass) => !slots.classes.includes(klass))];
  return [
    ...classes.map((label) => ({ slot: "class" as const, label })),
    ...slots.kinds.map((label) => ({ slot: "kind" as const, label })),
    ...slots.marks.map((label) => ({ slot: "mark" as const, label })),
    // A level counted two ways is the person's to settle (I-400), never the machine's: it is no subject here.
    ...slots.levels.flatMap((level) => (level.read === "LEVEL" ? [{ slot: "level" as const, label: level.label }] : [])),
    ...slots.noteKinds.map((label) => ({ slot: "noteKind" as const, label })),
    ...slots.disciplines.map((label) => ({ slot: "discipline" as const, label })),
  ];
}

/**
 * Whether the machine may be asked this question, and about which subjects (I-396, I-397): exactly
 * where the grammar refuses it `ASK_NOT_UNDERSTOOD` because its INTENT is open — the words carry no
 * cue the roster reads and it is no follow-up, or they cue two intents and leave a choice beside them
 * — while every subject it names is one the project holds. Null for every other outcome: an answer,
 * a clarify, a refusal by another name, a subject unknown, a range, three subjects in one slot. Those
 * are code's own rulings and never a model's.
 */
export function openIntentOf(question: string, vocabulary: AskVocabulary, previous: AskReading | null = null): readonly AskSubject[] | null {
  const outcome = readQuestion(question, vocabulary, previous);
  if (outcome.outcome !== "REFUSED" || outcome.code !== ASK_REFUSAL_CODES.notUnderstood || outcome.reading !== null) return null;
  const words = new Words(wordsOf(question));
  const slots = readSlots(words, vocabulary);
  if ("outcome" in slots) return null;
  const intents = intentsOf(words, slots);
  if (intents.length === 1) return null;
  if (intents.length === 0 && previous !== null && namesASubject(slots)) return null;
  return subjectListOf(slots);
}

/**
 * The question read under an intent the machine chose (I-396): the grammar's own slots, narrowed where
 * the machine chose one of two subjects of a slot, settled exactly as the grammar settles its own —
 * so a compound, a level counted two ways or a reading missing its subject is still a clarify or a
 * refusal by name, and the machine never answers what code would not.
 */
export function readWithIntent(question: string, vocabulary: AskVocabulary, intent: AskIntent, chosen: AskSlotChoice = {}): GrammarOutcome {
  const words = new Words(wordsOf(question));
  const read = readSlots(words, vocabulary);
  if ("outcome" in read) return read;
  const only = <T extends string>(held: readonly T[], label: string | undefined): readonly T[] => (label !== undefined && (held as readonly string[]).includes(label) ? [label as T] : held);
  const level = chosen.level;
  const levels = level !== undefined && read.levels.some((one) => one.read === "LEVEL" && one.label === level) ? read.levels.filter((one) => one.read === "LEVEL" && one.label === level) : read.levels;
  // A wall the words left to a choice between the two wall classes is settled by the class chosen.
  const wall = chosen.class !== undefined && (read.wallChoice ?? []).includes(chosen.class as ElementType);
  const slots: Slots = {
    ...read,
    classes: wall ? [chosen.class as ElementType] : only(read.classes, chosen.class),
    wallChoice: wall ? null : read.wallChoice,
    kinds: only(read.kinds, chosen.kind),
    marks: only(read.marks, chosen.mark),
    levels,
    noteKinds: only(read.noteKinds, chosen.noteKind),
    disciplines: only(read.disciplines, chosen.discipline),
  };
  return settle(draftOf(intent, slots), slots, vocabulary, false);
}

/* ------------------------------------------------------------- a reading that crossed the wire */

/**
 * A reading a person chose or kept, resolved against the project again (§6): it names subjects by
 * the project's own labels and is never trusted — a label the project does not hold is
 * `ASK_SUBJECT_UNKNOWN`, and a reading outside the rosters is not understood.
 */
export function resolveReading(stated: AskReading, vocabulary: AskVocabulary): Completed {
  const inRoster = <T extends string>(roster: readonly T[], value: string | null): boolean => value === null || (roster as readonly string[]).includes(value);
  if (
    !isAskIntent(stated.intent) ||
    !inRoster(ELEMENT_TYPES, stated.class) ||
    !inRoster(KINDS, stated.kind) ||
    !inRoster(NOTE_KINDS, stated.noteKind) ||
    !inRoster(DISCIPLINES, stated.discipline) ||
    !inRoster(ASK_BREAKDOWNS, stated.by) ||
    !(stated.unitAsked === null || Object.values(UNITS_ASKED).includes(stated.unitAsked))
  ) {
    return refused(ASK_REFUSAL_CODES.notUnderstood);
  }
  return completeReading(stated, vocabulary);
}
