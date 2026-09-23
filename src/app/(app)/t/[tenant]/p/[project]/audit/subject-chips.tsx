"use client";
/**
 * An act's cited subjects as a person reads them (s-audit I-38, s-project I-146): ONE presenter over
 * the key schemes the act log records, shared by S-Audit's cited evidence and S-Project's subject
 * column, so a subject is called the same thing on both screens (B-17).
 *
 * A subject is still an IdChip — the whole key in `data-value`, on the tooltip and on the clipboard
 * (R-UI-082) — but its MEASURE is what the key names rather than its leading characters: a placement
 * reads by its mark and level ("C1 · GF"), a note reading by its kind and sheet ("LAP · S-02"), a
 * storey-height reading by its level, a view by its caption, a surrogate by the level, drawing or
 * person the store names by it. A key the presenter cannot read keeps the chip's own short form.
 *
 * A row shows at most `cap` chips and then a `+k` that lists the rest on its tooltip — ellipsis plus a
 * count, never silent loss (R-UI-083). The rest stay in the DOM as `data-value`s, so every subject an
 * act cites is still on the page for a suite, an export and the clipboard.
 *
 * s-audit I-427: the chips shown stand in their own box, the only one that clips, and the `+k`
 * stands beside it — never inside it — so a short cell takes width from the chips, shared evenly,
 * and never the count (subject-chips.css).
 *
 * s-audit I-347: subjects that READ the same are one chip with a count ("C1 ×9"), not three chips of
 * one word a reader cannot tell apart. The chip's value is the first key it stands for; the others it
 * folds stay in the DOM beside it as hidden `data-value`s, exactly as the `+k`'s do.
 */
import "./subject-chips.css";

import { formatUserFigure } from "@/core/format";
// The parse is read from its own file and not the module's barrel: the barrel holds the audit read,
// and with it the store's driver, which has no business in a browser bundle.
import { parseSubject, type SubjectLevel, type SubjectNames } from "@/modules/spine/audit/subjects";
import { IdChip, Tooltip } from "@/ui/primitives/core";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { shortForm } from "@/ui/primitives/core/id-chip";
import { fill } from "@/ui/strings";
import { auditStrings } from "./strings";

/** How many subjects a row shows before the rest fold into `+k`. */
export const SUBJECT_CAP = 3;

/**
 * The width an act's actor reads at, on both screens that list acts: S-Audit's Actor and S-Project's
 * Who (s-audit I-428, s-project I-147 as amended). 280 holds a workspace address whole. One person,
 * one width, one home: it lives beside the presenter both screens already share, so neither screen
 * spells it for itself (B-17).
 */
export const ACTOR_COLUMN_WIDTH = 280;

/** Between two facts of one subject: the pause a reader takes, the separator the facts line uses. */
const BETWEEN = " · ";

/** A level slot that states no level at all: a placement not yet assigned to one says nothing about it. */
const UNRESOLVED_SLOT = "UNRESOLVED";

/**
 * The sheet a layout is, by the number its name leads with ("S-02 GENERAL NOTES" → "S-02"). A name
 * whose first word carries no numeral leads with no number, and is shown whole.
 */
function sheetWord(layoutName: string): string {
  const trimmed = layoutName.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  return /\d/.test(first) ? first : trimmed;
}

/** The level a placement stands on, as a person calls it — or null where the key states none. */
function levelWord(level: SubjectLevel | null, names: SubjectNames): string | null {
  if (level === null) return null;
  if ("levelId" in level) return names.levels[level.levelId] ?? null;
  if ("unregistered" in level) return level.unregistered;
  return level.slot === UNRESOLVED_SLOT ? null : humaniseEnum(level.slot);
}

/**
 * What one subject is called, or undefined where its key names nothing this screen can say — the
 * chip then shows its own short form of the key.
 */
export function presentSubject(subject: string, names: SubjectNames): string | undefined {
  const parsed = parseSubject(subject);
  switch (parsed.scheme) {
    case "placement": {
      const level = levelWord(parsed.level, names);
      return level === null ? parsed.mark : `${parsed.mark}${BETWEEN}${level}`;
    }
    case "view":
      return names.views[parsed.viewKey] ?? humaniseEnum(parsed.viewClass);
    case "note":
      return `${parsed.kind}${BETWEEN}${sheetWord(parsed.layoutName)}`;
    case "storey":
      return names.levels[parsed.levelId] ?? shortForm(parsed.levelId);
    case "proposed":
      return fill(auditStrings.audit_subject_proposed_level, { n: formatUserFigure(String(parsed.index + 1)) });
    case "sheet":
      // Model space carries no sheet number, and its layout's own name is the artifact's word for
      // it, not a reader's: it reads as the space it is (s-audit I-347, R-UI-083).
      return parsed.modelSpace ? auditStrings.audit_subject_model_space : sheetWord(parsed.layoutName);
    case "id":
      return names.levels[parsed.id] ?? names.drawings[parsed.id] ?? names.people[parsed.id];
    case "opaque":
      return undefined;
  }
}

/**
 * Does this subject answer what a person typed into the subject filter? A pasted key matches itself
 * whole (I-32); otherwise the entry matches the subject's presented name, or one whole fact of it —
 * "C1" finds "C1 · GF" and never "C10 · GF", because a fact is compared whole, never in part.
 */
export function subjectAnswers(subject: string, names: SubjectNames, typed: string): boolean {
  if (typed === subject) return true;
  const presented = presentSubject(subject, names);
  if (presented === undefined) return false;
  const asked = typed.toLocaleLowerCase();
  return presented.toLocaleLowerCase() === asked || presented.split(BETWEEN).some((fact) => fact.toLocaleLowerCase() === asked);
}

/** The subjects that read as one name, in the order the act cited the first of them. */
export interface SubjectGroup {
  /** What the group's chip reads before its count: the presented name, or the key's short form. */
  readonly words: string;
  /** The presented name, or undefined where the key names nothing and the chip keeps its short form. */
  readonly presented: string | undefined;
  /** Every key that reads as `words`, the first of them the chip's own value. */
  readonly subjects: readonly [string, ...string[]];
}

/**
 * The cited subjects gathered by the words a person reads them by (s-audit I-347): three placements
 * of mark C1 at a level nobody has resolved are one fact to a reader, "C1 ×3", not three chips of one
 * word. The order is the act's own — each group stands where its first key was cited.
 */
export function groupSubjects(subjects: readonly string[], names: SubjectNames): readonly SubjectGroup[] {
  const groups = new Map<string, { presented: string | undefined; subjects: [string, ...string[]] }>();
  for (const subject of subjects) {
    // The words a subject is read by on screen: its presented name, or the chip's own short form.
    const presented = presentSubject(subject, names);
    const words = presented ?? shortForm(subject);
    const held = groups.get(words);
    if (held === undefined) groups.set(words, { presented, subjects: [subject] });
    else held.subjects.push(subject);
  }
  return [...groups].map(([words, group]) => ({ words, presented: group.presented, subjects: group.subjects }));
}

/** A group as a person reads it: its name, and how many subjects it stands for where that is more than one. */
function groupWords(group: SubjectGroup): string {
  return group.subjects.length === 1 ? group.words : fill(auditStrings.audit_subject_repeated, { name: group.words, count: formatUserFigure(String(group.subjects.length)) });
}

export interface SubjectChipsProps {
  readonly subjects: readonly string[];
  readonly names: SubjectNames;
  readonly cap?: number;
  readonly className?: string;
  readonly "data-testid"?: string;
}

export function SubjectChips({ subjects, names, cap = SUBJECT_CAP, className, "data-testid": testId }: SubjectChipsProps) {
  const groups = groupSubjects(subjects, names);
  const shown = groups.slice(0, cap);
  const rest = groups.slice(cap);
  /** The `+k` counts SUBJECTS, as `data-count` does — the groups past the cap may each fold several. */
  const folded = rest.reduce((held, group) => held + group.subjects.length, 0);
  return (
    <span className={className === undefined ? "cx-subject-chips" : `cx-subject-chips ${className}`} data-testid={testId} data-count={subjects.length}>
      {/* The only box that clips (s-audit I-427): its chips give up width evenly when the cell is
          short, each ellipsising inside its own measure (subject-chips.css) — never cut mid-glyph. */}
      <span className="cx-subject-chips-shown">
        {shown.map((group, at) => {
          const [first, ...alike] = group.subjects;
          return [
            <IdChip key={`${String(at)}:${first}`} className="cx-subject-chip" value={first} short={alike.length === 0 ? group.presented : groupWords(group)} />,
            // The keys the chip folds are cited all the same: whole in the DOM, for a suite, an export
            // and the clipboard, exactly as the `+k`'s are (R-UI-082).
            ...alike.map((subject, index) => <span key={`${String(at)}:${String(index)}:${subject}`} hidden data-value={subject} />),
          ];
        })}
      </span>
      {rest.length === 0 ? null : (
        // The tooltip's own trigger idiom: a button that opens nothing but the hint, so the keyboard
        // reaches the folded names exactly as the pointer does (R-UI-012). It stands OUTSIDE the box
        // that clips, so no width the chips need can take it (s-audit I-427).
        <Tooltip content={rest.map(groupWords).join(", ")}>
          <button type="button" className="cx-subject-chips-more">
            {fill(auditStrings.audit_subject_more, { count: formatUserFigure(String(folded)) })}
            {rest.flatMap((group, at) => group.subjects.map((subject, index) => <span key={`${String(at)}:${String(index)}:${subject}`} hidden data-value={subject} />))}
          </button>
        </Tooltip>
      )}
    </span>
  );
}
