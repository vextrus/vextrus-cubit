// What the drawings name and a measure run measured none of, as the register lists it beside what the
// run deferred and refused (s-takeoff-register I-650). Read off the coverage certificate's own
// measurement statement — `measurementStatementOf` and `unclassedStatementOf` over the one residue —
// so the register and the certificate cannot name two different sets (B-17). Pure: the statement rows
// are handed in, and a test judges the reading without a database.
import { compareCanonical } from "@/core/identity";
import { UNPLACED, type StatementRow, type UnclassedStatementRow } from "@/core/residue";
import type { ViewDeclared } from "./view";

/**
 * The declared-but-unmeasured sightings, classes first and then members, each in canonical order:
 *
 * - every class the statement names in the "Not placed" slot — a caption declares it and the
 *   partition placed no member of it — once, with the kinds the statement names it under; a class
 *   the register holds an object of is left to its own rows, because "placed nowhere" would then be
 *   untrue of it;
 * - every member no class of the catalogue is (the statement's third enumeration), by its word and
 *   the caption that shows it.
 */
export function declaredOf(input: {
  readonly measurement: readonly StatementRow[];
  readonly unclassed: readonly UnclassedStatementRow[];
  readonly registeredClasses: ReadonlySet<string>;
}): ViewDeclared[] {
  const kindsByClass = new Map<string, Set<string>>();
  for (const row of input.measurement) {
    if (row.levelSlot !== UNPLACED || row.class === null || input.registeredClasses.has(row.class)) continue;
    const held = kindsByClass.get(row.class) ?? new Set<string>();
    held.add(row.kind);
    kindsByClass.set(row.class, held);
  }
  const classes: ViewDeclared[] = [...kindsByClass.entries()]
    .sort(([left], [right]) => compareCanonical(left, right))
    .map(([klass, kinds]) => ({ subject: "CLASS", class: klass, kinds: [...kinds].sort(compareCanonical) }));
  const members: ViewDeclared[] = input.unclassed.map((row) => ({ subject: "MEMBER", word: row.word, caption: row.caption, drawingId: row.drawingId, address: row.address }));
  return [...classes, ...members];
}
