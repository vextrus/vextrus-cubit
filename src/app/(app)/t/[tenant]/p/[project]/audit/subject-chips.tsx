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
 * count, never silent loss (R-UI-084). The rest stay in the DOM as `data-value`s, so every subject an
 * act cites is still on the page for a suite, an export and the clipboard.
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
      return sheetWord(parsed.layoutName);
    case "id":
      return names.levels[parsed.id] ?? names.drawings[parsed.id] ?? names.people[parsed.id];
    case "opaque":
      return undefined;
  }
}

/** The words a subject is read by on screen: its presented name, or the chip's short form. */
export function subjectWords(subject: string, names: SubjectNames): string {
  return presentSubject(subject, names) ?? shortForm(subject);
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

export interface SubjectChipsProps {
  readonly subjects: readonly string[];
  readonly names: SubjectNames;
  readonly cap?: number;
  readonly className?: string;
  readonly "data-testid"?: string;
}

export function SubjectChips({ subjects, names, cap = SUBJECT_CAP, className, "data-testid": testId }: SubjectChipsProps) {
  const shown = subjects.slice(0, cap);
  const rest = subjects.slice(cap);
  return (
    <span className={className === undefined ? "cx-subject-chips" : `cx-subject-chips ${className}`} data-testid={testId} data-count={subjects.length}>
      {shown.map((subject, at) => (
        <IdChip key={`${String(at)}:${subject}`} value={subject} short={presentSubject(subject, names)} />
      ))}
      {rest.length === 0 ? null : (
        // The tooltip's own trigger idiom: a button that opens nothing but the hint, so the keyboard
        // reaches the folded names exactly as the pointer does (R-UI-012).
        <Tooltip content={rest.map((subject) => subjectWords(subject, names)).join(", ")}>
          <button type="button" className="cx-subject-chips-more">
            {fill(auditStrings.audit_subject_more, { count: formatUserFigure(String(rest.length)) })}
            {rest.map((subject, at) => (
              <span key={`${String(at)}:${subject}`} hidden data-value={subject} />
            ))}
          </button>
        </Tooltip>
      )}
    </span>
  );
}
