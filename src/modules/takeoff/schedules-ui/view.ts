// S-Schedules' reading, as one value (R-TO-034, L-CAD-08, docs/design/s-schedules.md §1). The screen
// renders this and derives nothing from it: every cell, every mark family, every standing and every
// proposal below was computed by the code path that owns what it names, and the workspace only shows
// it (I-250, I-251, B-17).
import type { RefusalCode } from "@/core/errors";

/** One cell of a reconstructed table, where it stands and what it cites (L-CAD-03, I-252). */
export type SchedulesViewCell = {
  readonly rowIndex: number;
  readonly columnIndex: number;
  /** The drawing's own words, verbatim — empty where the table's grid held no text there. */
  readonly text: string;
  readonly sourceKeys: readonly string[];
};

/** One reconstructed schedule, exactly as the partition stored it (I-250). */
export type SchedulesViewTable = {
  readonly scheduleKey: string;
  readonly title: string;
  /** The header band's own texts, in column order — the columns the table was rebuilt on. */
  readonly columns: readonly string[];
  /** Every stored row, header band included, in the order the sheet drew them. */
  readonly rows: readonly (readonly SchedulesViewCell[])[];
};

/** One rebar zone of one variant, as the schedule wrote it — never a count of bars (I-251). */
export type SchedulesViewZone = {
  readonly variantKey: string;
  readonly zone: string;
  readonly text: string;
};

/** One band a mark family carries a section over, in the schedule's own words (I-251). */
export type SchedulesViewVariant = {
  readonly variantKey: string;
  readonly bandText: string;
  readonly sectionText: string;
  readonly zones: readonly SchedulesViewZone[];
};

/** One mark family a schedule named: what the member IS, and never how many stand (R-TO-031). */
export type SchedulesViewFamily = {
  readonly family: string;
  readonly markText: string;
  readonly sourceKeys: readonly string[];
  readonly variants: readonly SchedulesViewVariant[];
};

/** A schedule-titled view that yielded no table, stated where it stood (R-UI-050). */
export type SchedulesViewDeferral = {
  readonly viewKey: string;
  readonly code: RefusalCode;
  readonly sourceKeys: readonly string[];
};

/** One figure the grammar offers off a sentence of this sheet, for a person to accept or edit. */
export type SchedulesViewProposal = {
  readonly kind: string;
  readonly sourceKey: string;
  readonly text: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  /** True where this figure already stands under this reader's own key: pressing would move nothing. */
  readonly alreadyRead: boolean;
};

/** One committed reading of this sheet, as the store holds it (R-TO-051: superseded, never erased). */
export type SchedulesViewReading = {
  readonly readingKey: string;
  readonly kind: string;
  readonly actorId: string;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  readonly basis: string;
  readonly acceptance: string;
  /** True where a LATER reading under the same key replaced this one. */
  readonly superseded: boolean;
};

/** How one kind stands over every reading made of it on this sheet (I-253). */
export type SchedulesViewStanding = {
  readonly kind: string;
  readonly standing: string;
  /** Null under SUSPENDED and under NONE — a suspension prints no figure at all (I-253). */
  readonly canonical: string | null;
  readonly unitAsWritten: string | null;
  readonly code: RefusalCode | null;
};

/** The notes half of one sheet: what stands, what was read, and what is offered (I-253). */
export type SchedulesViewNotes = {
  readonly standings: readonly SchedulesViewStanding[];
  readonly readings: readonly SchedulesViewReading[];
  readonly proposals: readonly SchedulesViewProposal[];
  /** The code a sheet whose texts state no figure says in the panel's place (R-UI-050). */
  readonly code: RefusalCode | null;
};

/** One sheet of the pinned revision that holds something this screen can show (I-248). */
export type SchedulesViewSheet = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly drawingName: string;
  readonly tables: readonly SchedulesViewTable[];
  readonly families: readonly SchedulesViewFamily[];
  readonly deferrals: readonly SchedulesViewDeferral[];
  readonly notes: SchedulesViewNotes;
};

/** The whole reading S-Schedules renders: the sheets of the pinned revision that hold something. */
export type SchedulesView = {
  readonly projectId: string;
  /** Null where no set of this project has been pinned — the campaign has no revision to read over. */
  readonly setRevisionId: string | null;
  readonly sheets: readonly SchedulesViewSheet[];
};
