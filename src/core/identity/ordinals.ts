// L-REG-05's ordinals: "Rows of a mark family sort by a canonical content signature of authored
// inputs only (length, breadth, count as fixed-precision strings; correctable attributes excluded),
// keyed `mark#i` (singletons keep the bare mark), tie-broken by row id — so ordinals freeze and never
// move."
//
// Two properties are the whole point, and both are properties of this file rather than of a caller:
// the answer does not depend on the order the rows arrived in (they are sorted before they are
// keyed), and it does not depend on how a number was written (each authored input is spelled at one
// fixed precision, so `300` and `300.0` are one length). L-REG-02's correctable attributes — storey
// height, concrete grade, rebar spec — are excluded: they participate in diffs, never in identity,
// and an ordinal that moved when somebody corrected a grade would not be frozen.
import { compareCanonical } from "./compare-canonical";
import { exact } from "../units/canon";

/**
 * The precision every authored input is spelled at. Fixed, so two spellings of one number are one
 * signature; the same for all three inputs, so their code-unit order is their numeric order for
 * values of equal width.
 */
const SIGNATURE_PRECISION = 3;

/** The separator between a signature's fields, spelled once. */
const FIELD = "|";

/** One row of a mark family, as its ordinal is derived: its mark, its authored inputs, its id. */
export type FamilyRow = {
  readonly rowId: string;
  readonly mark: string;
  readonly length: string;
  readonly breadth: string;
  readonly count: string;
};

/** How an ordinal key names a row of a family of more than one (L-REG-05). */
const ORDINAL = "#";

/** One authored input at the one fixed precision, through the canon's own exact decimals (B-17). */
function fixed(value: string, what: string): string {
  try {
    return exact(value).toFixed(SIGNATURE_PRECISION);
  } catch {
    throw new Error(`"${value}" is no ${what} a content signature can be taken over — authored inputs are numbers (L-REG-05)`);
  }
}

/**
 * The canonical content signature of one row: its authored inputs, each at one fixed precision, in
 * the order the law lists them. Correctable attributes are absent by construction — the signature is
 * taken over the three inputs L-REG-05 names and over nothing the row happens to carry beside them.
 */
export function contentSignature(row: FamilyRow): string {
  return `length:${fixed(row.length, "length")}${FIELD}breadth:${fixed(row.breadth, "breadth")}${FIELD}count:${fixed(row.count, "count")}`;
}

/**
 * The ordinal key of every row of a mark family: the bare mark where the mark is borne once, and
 * `mark#i` in content-signature order — tie-broken by row id, both under the one code-unit sort —
 * where it is borne more than once (L-REG-05).
 *
 * Rows of several marks may arrive together: each mark is its own family, so a mark borne once keeps
 * its bare mark however many other rows stand beside it.
 */
export function ordinalKeys(family: readonly FamilyRow[]): Map<string, string> {
  const families = new Map<string, FamilyRow[]>();
  const seen = new Set<string>();
  for (const row of family) {
    if (seen.has(row.rowId)) throw new Error(`row ${row.rowId} stands twice in one mark family — a row is one row, and its ordinal is one ordinal (L-REG-05)`);
    seen.add(row.rowId);
    const borne = families.get(row.mark);
    if (borne === undefined) families.set(row.mark, [row]);
    else borne.push(row);
  }

  const keys = new Map<string, string>();
  for (const [mark, rows] of families) {
    const only = rows[0];
    if (rows.length === 1 && only !== undefined) {
      keys.set(only.rowId, mark);
      continue;
    }
    const signatures = new Map(rows.map((row) => [row.rowId, contentSignature(row)]));
    const ordered = [...rows].sort((left, right) => {
      const bySignature = compareCanonical(signatures.get(left.rowId) ?? "", signatures.get(right.rowId) ?? "");
      return bySignature === 0 ? compareCanonical(left.rowId, right.rowId) : bySignature;
    });
    ordered.forEach((row, at) => keys.set(row.rowId, `${mark}${ORDINAL}${at + 1}`));
  }
  return keys;
}
