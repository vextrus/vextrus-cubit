// S-Schedules' reading, as one value (R-TO-034, L-CAD-08, docs/design/s-schedules.md §1). The screen
// renders this and derives nothing from it: every cell, every mark, every figure and every standing
// below was read by the code path that owns it, and the workspace only shows it (I-250, B-17).
//
// Nothing here is a count of members. L-CAD-08 forbids a schedule's rows being read as a quantity, so
// no field of this value is a number of anything a bill could carry (I-251).
import type { NoteProposal } from "@/core/notes/grammar";
import type { NoteContestedCode, NoteKind, NoteStandingName } from "@/core/notes/law";
import type { NoteReadingRow } from "@/core/notes/store";
import type { ScheduleDeferralReason, RebarZone } from "@/modules/takeoff/partition";

/** One cell of a reconstructed table: where it stands, what it says, and the texts it was read off. */
export type ScheduleCellView = {
  readonly columnIndex: number;
  /** The drawing's own words, verbatim — two texts of one cell keep the notation's own sign. */
  readonly text: string;
  readonly sourceKeys: readonly string[];
};

/** One band of a reconstructed table, at the row index the store holds it under. */
export type ScheduleRowView = {
  readonly rowIndex: number;
  readonly cells: readonly ScheduleCellView[];
};

/** One table a SCHEDULE view yielded, exactly as it was stored (I-250). */
export type ScheduleTableView = {
  readonly scheduleKey: string;
  readonly viewKey: string;
  readonly title: string;
  readonly rows: readonly ScheduleRowView[];
};

/** A schedule view that yielded no table, and the closed reason it yielded none (R-UI-050). */
export type ScheduleDeferralView = {
  readonly viewKey: string;
  readonly reason: ScheduleDeferralReason;
};

/** One rebar zone beneath a variant: the zone, and the cell text it was read from, verbatim. */
export type ZoneView = {
  readonly zone: RebarZone;
  readonly text: string;
  readonly sourceKeys: readonly string[];
};

/** One variant of a mark family: the band of floors it stands over, and the section carried there. */
export type VariantView = {
  readonly variantKey: string;
  readonly bandText: string;
  readonly sectionText: string;
  readonly sourceKeys: readonly string[];
  readonly zones: readonly ZoneView[];
};

/** One mark family the sheet's schedules named — its mark as written, and never how many exist. */
export type FamilyView = {
  readonly family: string;
  readonly markText: string;
  readonly sourceKeys: readonly string[];
  readonly variants: readonly VariantView[];
};

/** One committed reading of a note, with whether a later reading stands over it (R-TO-051). */
export type ReadingView = NoteReadingRow & { readonly superseded: boolean };

/**
 * How one kind stands over every reading made of it on this sheet (L-REG-03). A SUSPENDED standing
 * carries NO figure and names the code its absence is refused under: a number printed beside the word
 * *suspended* is the claim the suspension denies (I-253).
 */
export type StandingView = {
  readonly kind: NoteKind;
  readonly standing: NoteStandingName;
  readonly canonical: string | null;
  readonly unitAsWritten: string | null;
  readonly code: NoteContestedCode | null;
};

/** What one sheet's general notes hold: the answer, the record, and the offer (I-253). */
export type NotesView = {
  readonly proposals: readonly NoteProposal[];
  readonly readings: readonly ReadingView[];
  readonly standings: readonly StandingView[];
};

/** One sheet of the pinned revision, with everything this screen renders of it (I-248). */
export type SheetView = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly schedules: readonly ScheduleTableView[];
  readonly deferrals: readonly ScheduleDeferralView[];
  readonly families: readonly FamilyView[];
  readonly notes: NotesView;
};

/** The whole reading S-Schedules renders: the revision it stands on, and its sheets (I-248). */
export type SchedulesView = {
  readonly projectId: string;
  /** Null where nothing has been pinned on this project — the screen's empty cell (R-UI-050). */
  readonly setRevisionId: string | null;
  readonly sheets: readonly SheetView[];
};
