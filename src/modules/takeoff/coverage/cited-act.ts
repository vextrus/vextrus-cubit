// Which act one residue cell's reading was declared by — the act of the AXIS the cell is read under
// (L-QTY-05, R-UI-050).
//
// A cell stands on two axes and each carries its own act: what the measurement declared about this
// object, and what the bill declared about it. Reaching for whichever act happens to be present
// would send a reader to an act that says nothing about why the cell reads as it does, so the axis
// asked decides, and an axis standing under no act cites none.

/** As far as this reading looks at a cell: the two axes, and the act each stands under. */
type CitedCell = {
  readonly measurement: string;
  readonly bill: string;
  readonly measurementActId: string | null;
  readonly billActId: string | null;
};

/** The two axes a residue cell is read under, by the names the coverage grid spells them. */
export const MEASUREMENT_AXIS = "MEASUREMENT";
export const BILL_AXIS = "BILL";

/** What a bill axis says about a cell a person has held out of this bill (I-198). */
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";

/**
 * Which axis a cell is READ under: the bill's where a person held it out of this bill, and the
 * measurement's everywhere else. One rule, one home — the glyph, the words and the citation all read
 * one cell the same way (B-17, I-198).
 */
export function axisReadOf(cell: Pick<CitedCell, "bill">): string {
  return cell.bill === NOT_IN_THIS_BILL ? BILL_AXIS : MEASUREMENT_AXIS;
}

/** The act this cell's reading on that axis was declared by, or null where the axis declares none. */
export function citedActOf(cell: Omit<CitedCell, "measurement" | "bill">, axis: string): string | null {
  if (axis === BILL_AXIS) return cell.billActId;
  if (axis === MEASUREMENT_AXIS) return cell.measurementActId;
  return null;
}
