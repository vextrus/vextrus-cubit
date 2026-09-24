// Every registered object a measure run published no line for, said by name (I-668; walk-2 BD-3;
// R-UI-020: "every refusal carries a named reason").
//
// The deferred-and-refused region named a run's deferrals — a view with no scale of record, a view
// whose floors nobody has stated, a storey with no height — and the queue items and refused
// sightings the stores hold. A member the rails reported under any OTHER code (an uncovered band, a
// schedule nobody read, an unknown member type) published nothing and was named nowhere a QS looks:
// the walker's fresh project said "6 view scales and ROOF storey height" over 27 columns that had
// each been reported, by the rail, for a reason the region never showed. So each such object is
// stated here, once per reason its latest report gives, with the kind where one kind carried it.
//
// It judges nothing: the codes are the rails' own reports as the residue reads them (each
// question's latest answer, I-615), and an object a view deferral already names is left to that
// row — one row about the view is what the QS acts on, and repeating it per member is noise.
import { compareCanonical } from "@/core/identity";
import { VIEW_DEFERRAL_CODES } from "@/core/residue/deferrals";

/** The codes a run names against a VIEW (`runDeferralsOf`): an object reported under one is named by the view's row. */
const VIEW_NAMED: ReadonlySet<string> = new Set(VIEW_DEFERRAL_CODES);

/** What the reading is composed from — each already scoped to the campaign being read. */
export type UnlinedInput = {
  /** The register's objects, the struck already left out: a repudiation is stated on its own. */
  readonly objects: readonly { readonly objectKey: string }[];
  /** Every object key a line of the campaign was published for. */
  readonly lined: ReadonlySet<string>;
  /** Every object key a queue item or a refused sighting already names. */
  readonly named: ReadonlySet<string>;
  /** The run's standing reports, as the residue reads them. */
  readonly observations: readonly { readonly code: string | null; readonly kind: string; readonly objectKey: string | null }[];
};

/** One object the region names, by the code a report gave it and the kind, where one kind carried it. */
export type UnlinedRow = { readonly code: string; readonly objectKey: string; readonly kind: string | null };

/**
 * The objects that published no line and that nothing else in the region names, each by every
 * distinct code its standing reports carry — in the register's own object order, codes in canonical
 * order. An object with no standing report is not invented a reason here: the caller's proof is
 * that the fresh drawing's run leaves none.
 */
export function unlinedRefusalsOf(input: UnlinedInput): UnlinedRow[] {
  const reports = new Map<string, Map<string, Set<string>>>();
  for (const observation of input.observations) {
    if (observation.objectKey === null || observation.code === null || observation.code === "") continue;
    const byCode = reports.get(observation.objectKey) ?? new Map<string, Set<string>>();
    const kinds = byCode.get(observation.code) ?? new Set<string>();
    kinds.add(observation.kind);
    byCode.set(observation.code, kinds);
    reports.set(observation.objectKey, byCode);
  }

  const rows: UnlinedRow[] = [];
  for (const object of input.objects) {
    if (input.lined.has(object.objectKey) || input.named.has(object.objectKey)) continue;
    const byCode = reports.get(object.objectKey);
    if (byCode === undefined) continue;
    if ([...byCode.keys()].some((code) => VIEW_NAMED.has(code))) continue;
    for (const code of [...byCode.keys()].sort(compareCanonical)) {
      const kinds = [...(byCode.get(code) ?? [])];
      rows.push({ code, objectKey: object.objectKey, kind: kinds.length === 1 ? (kinds[0] ?? null) : null });
    }
  }
  return rows;
}
