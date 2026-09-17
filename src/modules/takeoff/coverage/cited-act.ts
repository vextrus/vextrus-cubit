// Which act one residue cell's reading was declared by — the act of the AXIS the cell is read under
// (L-QTY-05, R-UI-050).
//
// A cell stands on two axes and each carries its own act: what the measurement declared about this
// object, and what the bill declared about it. Reaching for whichever act happens to be present
// would send a reader to an act that says nothing about why the cell reads as it does, so the axis
// asked decides, and an axis standing under no act cites none.

/** As far as this reading looks at a cell: the act each axis stands under. */
type CitedCell = {
  readonly measurementActId: string | null;
  readonly billActId: string | null;
};

/** The two axes a residue cell is read under, by the names the coverage grid spells them. */
const MEASUREMENT = "MEASUREMENT";
const BILL = "BILL";

/** The act this cell's reading on that axis was declared by, or null where the axis declares none. */
export function citedActOf(cell: CitedCell, axis: string): string | null {
  if (axis === BILL) return cell.billActId;
  if (axis === MEASUREMENT) return cell.measurementActId;
  return null;
}
