// The lawful counterpart to `bad.ts`: a channel reader says what it SAW, and says it as a union of
// EXISTS (L-QTY-05). Nothing below states an absence, so the scan must stay silent on this file.
//
// One deliberate trap: the banned phrase — NOT EXISTS — appears in THIS comment, and in the prose of
// the doc comments beneath, and nowhere in the code. A scan that greps the text rather than reading
// it through the tree's one source lexer fires here, and a scan that fires here would refuse a file
// for explaining the ban it obeys. Judged is code and only code: a string literal states a value, a
// comment states nothing.

/** One channel's EXISTS over the register: rows of the class, within the pinned manifest. */
export const registerSighted = `select 1 from register_objects o where EXISTS (select 1 from manifest m where m.drawing_id = o.drawing_id)`;

/** The partition's own EXISTS: placements and member-type families of the class. */
export const partitionSighted = "select 1 from placements p where EXISTS (select 1 from member_types t where t.family = p.family)";

/** The union L-QTY-05 states — three EXISTS, or-ed, never one absence. */
export const unionOfExists = `
  select s.class
  from classes s
  where EXISTS (select 1 from register_objects o where o.class = s.class)
     or EXISTS (select 1 from placements p where p.class = s.class)
     or EXISTS (select 1 from view_members v where v.class = s.class)
`;

/** A reader answers a list of what it saw; an empty list is the only way it can say "nothing". */
export function sightedClasses(rows: readonly { class: string }[]): string[] {
  return [...new Set(rows.map((row) => row.class))].sort();
}
