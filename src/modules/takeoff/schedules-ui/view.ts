// S-Schedules' reading, as one value (R-TO-034, L-CAD-08, docs/design/s-schedules.md §1). The screen
// renders this and derives nothing from it: every cell, every mark, every figure and every standing
// below was read by the code path that owns it, and the workspace only shows it (I-250, B-17).
//
// Nothing here is a count of members. L-CAD-08 forbids a schedule's rows being read as a quantity, so
// no field of this value is a number of anything a bill could carry (I-251).
import type { ElementType } from "@/core/catalogue/classes";
import type { PrintedQuantityRefusal } from "@/core/errors";
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

/**
 * One table a SCHEDULE view yielded, exactly as it was stored (I-250).
 *
 * The stored header band stands BESIDE the rows rather than first among them: it is the grid's own
 * sticky header, and a header is not data. `rows` is therefore the bands of data the schedule holds,
 * which is the number the grid draws and states — the screen re-counts nothing either way (B-17).
 * A table whose stored shape carries no header band at all answers `header: undefined`, and its
 * columns are then named by nothing, which is what the drawing said.
 */
export type ScheduleTableView = {
  readonly scheduleKey: string;
  readonly viewKey: string;
  readonly title: string;
  readonly header: ScheduleRowView | undefined;
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

/**
 * What the registry's Band cell says for one banded variant (I-436).
 *
 * `written` where the stored band text IS a band of floors the notation reads (`parseFloorZone`):
 * a column schedule's `GF TO 2ND`, `3RD & 4TH`, `ROOF-SRR` — said verbatim, as the schedule wrote it.
 *
 * `from`/`to` where the store banded the variant off a longer text that is not itself a band — a
 * long-section strip sheet's whole title, `TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)`
 * (I-343) — and the cell says the band's two ends as the grammar spelled them when it read that
 * title. The stored text is kept byte for byte and stands a hover away (L-CAD-08).
 */
export type BandFace = { readonly written: string } | { readonly from: string; readonly to: string };

/** One variant of a mark family: the band of floors it stands over, and the section carried there. */
export type VariantView = {
  readonly variantKey: string;
  readonly bandText: string;
  /**
   * Whether the schedule states a band of floors for this variant at all. A schedule that states none
   * — a beam schedule — files its section column's HEADER as the band text, which is no band; the
   * screen says the band is absent there (I-sch-1). Absent where the store was not asked.
   */
  readonly banded?: boolean;
  /**
   * How the Band cell says this variant's floors (I-436): null where it is unbanded, absent where
   * the store was not asked — the cell then says the band text, as it always did.
   */
  readonly bandFace?: BandFace | null;
  readonly sectionText: string;
  readonly sourceKeys: readonly string[];
  readonly zones: readonly ZoneView[];
  /**
   * What an opening schedule PRINTS for this row over these floors (I-507, I-510): the cell
   * verbatim — never a count the screen took (I-251) — and, where the reading is declared rather
   * than read as it stands, the registered code it is declared under. Absent on every other variant.
   */
  readonly printed?: PrintedView;
};

/**
 * One printed quantity as the screen says it (I-510): the schedule's own cell and the texts it
 * was read from, the code it is declared under or null, and — where it was checked against a plan —
 * that plan's tags of the mark, which are the evidence behind a disagreement and never a figure the
 * screen prints.
 */
export type PrintedView = {
  readonly text: string;
  readonly sourceKeys: readonly string[];
  readonly refusal: PrintedQuantityRefusal | null;
  readonly planKey: string | null;
  readonly tagKeys: readonly string[];
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
 * How one kind stands over every reading made of it on this sheet, in one scope (L-REG-03, I-652).
 * A SUSPENDED standing carries NO figure and names the code its absence is refused under: a number
 * printed beside the word *suspended* is the claim the suspension denies (I-253).
 */
export type StandingView = {
  readonly kind: NoteKind;
  /** The element class this standing is the figure for, or null for every class no scoped figure speaks for. */
  readonly scopeClass: ElementType | null;
  readonly standing: NoteStandingName;
  readonly canonical: string | null;
  readonly unitAsWritten: string | null;
  readonly code: NoteContestedCode | null;
};

/**
 * Who read a figure off a clause: the deterministic grammar, or a model asked about a clause the
 * grammar read nothing in (L-AI-03, I-296). Closed, because the screen renders the origin and a
 * third word would be a third thing to render.
 */
export const PROPOSED_BY = ["grammar", "model"] as const;

/** One of the two. */
export type ProposedBy = (typeof PROPOSED_BY)[number];

/**
 * One figure this sheet offers, and who offered it (I-253, I-296). A model's offer is one more
 * proposal in this list: it carries the same kind, the same words and the same figure — which is the
 * GRAMMAR's reading of the clause the model classified, never a digit the model moved (L-AI-03) —
 * and it is kept through the same NumberInput and the same one act door (I-254).
 */
export type ProposalView = NoteProposal & {
  readonly proposedBy: ProposedBy;
  /** The ledger call that proposed the class, where a model did; null where the grammar read it. */
  readonly callId: string | null;
  /**
   * What a model made of whether this clause's lap governs over the sheet's own development-length
   * table (AM-03(e)) — the probability exactly as it was stated, or null where none was. A
   * proposition presented for disposition: it moves no figure and enters no applied value.
   */
  readonly governs: string | null;
};

/** What one sheet's general notes hold: the answer, the record, and the offer (I-253). */
export type NotesView = {
  readonly proposals: readonly ProposalView[];
  readonly readings: readonly ReadingView[];
  readonly standings: readonly StandingView[];
};

/**
 * The extractor's word for a drawing's MODEL space (L-CAD-05, L-CAD-06): the one space views are cut
 * out of, so the schedules and their deferrals stand there. Its layout NAME is the DXF's own
 * (`model`), which is no sheet's title — the rail says the space in words instead (I-353).
 */
export const MODEL_SPACE = "model";

/** One sheet of the pinned revision, with everything this screen renders of it (I-248). */
export type SheetView = {
  readonly drawingId: string;
  readonly layoutName: string;
  /**
   * The extractor's own word for the space this sheet is — `model`, or a paper layout's (L-CAD-05).
   * Absent where the store was not asked; the rail then says the layout's name, as it always did.
   */
  readonly kind?: string;
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
